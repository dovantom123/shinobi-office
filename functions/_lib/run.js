// Xử lý một lượt chạy của một nhân vật: kiểm tra đầu vào → dựng prompt → gọi AI → kiểm tra đầu ra.
import { CHARACTERS, COMMON, resolve, validate, timezone } from './config.js';
import { AiError } from './anthropic.js';
import { callModel } from './provider.js';
import { fail, json, sameOrigin, rateLimited, claim } from './guard.js';

const MSG = {
  bad_json: 'Yêu cầu không hợp lệ.',
  forbidden: 'Yêu cầu bị từ chối (khác nguồn gốc).',
  unknown_character: 'Nhân vật không tồn tại.',
  bad_topic: 'Chủ đề phải dài 3–80 ký tự.',
  missing_input: 'Thiếu hoặc sai kết quả của nhân vật trước.',
  no_comments: 'Chưa có bình luận để trả lời.',
  bad_comments: 'Bình luận không hợp lệ (tối đa 5 dòng, mỗi dòng 300 ký tự).',
  not_configured: 'Chưa cấu hình khóa API trên máy chủ.',
  model_not_allowed: 'Model được cấu hình không nằm trong danh sách cho phép.',
  provider_not_allowed: 'Nhà cung cấp được cấu hình không hợp lệ.',
  rate_limited: 'Quá nhiều lượt gọi, hãy thử lại sau ít phút.',
  duplicate: 'Yêu cầu giống hệt đang được xử lý.',
  auth: 'Khóa API bị từ chối (sai hoặc hết hiệu lực).',
  provider_rate_limited: 'Nhà cung cấp AI đang giới hạn lượt gọi, thử lại sau.',
  bad_request: 'Nhà cung cấp AI từ chối yêu cầu (kiểm tra tên model).',
  upstream: 'Nhà cung cấp AI đang lỗi hoặc quá tải.',
  network: 'Không kết nối được tới nhà cung cấp AI.',
  timeout: 'Nhà cung cấp AI phản hồi quá lâu.',
  refusal: 'Mô hình từ chối trả lời yêu cầu này.',
  truncated: 'Đầu ra bị cắt do quá dài.',
  empty: 'Mô hình không trả nội dung.',
  output_invalid: 'Đầu ra của AI không đúng định dạng yêu cầu.',
  cancelled: 'Đã hủy.',
};
export const message = (code) => MSG[code] ?? 'Lỗi không xác định.';
const failCode = (code, status) => fail(code, message(code), status);

const clean = (s) => String(s).replace(/<\/?du_lieu>/gi, '');

function parseComments(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'no_comments' };
  const list = raw.map((c) => (typeof c === 'string' ? c.trim() : null));
  if (list.length > 5 || list.some((c) => !c || c.length > 300)) return { error: 'bad_comments' };
  return { list };
}

export async function handleRun(request, env, { now = new Date() } = {}) {
  if (!sameOrigin(request)) return failCode('forbidden', 403);
  let data;
  try {
    data = await request.json();
  } catch {
    return failCode('bad_json', 400);
  }
  const id = data?.characterId;
  const cfg = typeof id === 'string' && Object.hasOwn(CHARACTERS, id) ? resolve(id, env) : null;
  if (!cfg) return failCode('unknown_character', 400);
  const topic = typeof data.topic === 'string' ? data.topic.trim() : '';
  if (topic.length < 3 || topic.length > 80) return failCode('bad_topic', 400);

  // đầu ra của nhân vật trước do client chuyển lại: coi là dữ liệu và kiểm tra lại bằng schema của chính nhân vật đó
  const given = data.inputs && typeof data.inputs === 'object' ? data.inputs : {};
  const context = {};
  try {
    for (const nid of cfg.needs) context[nid] = validate(CHARACTERS[nid].schema, given[nid]);
    for (const nid of cfg.optionalNeeds ?? []) if (given[nid] != null) context[nid] = validate(CHARACTERS[nid].schema, given[nid]);
  } catch {
    return failCode('missing_input', 400);
  }
  let comments = null;
  if (cfg.needsComments) {
    const c = parseComments(data.comments);
    if (c.error) return failCode(c.error, 400);
    comments = c.list;
  }

  if (cfg.issue) return failCode(cfg.issue, 503);
  if (rateLimited(request, env)) return failCode('rate_limited', 429);
  const release = claim(`${id}|${topic}|${JSON.stringify(context)}|${JSON.stringify(comments)}`);
  if (!release) return failCode('duplicate', 409);

  try {
    const tz = timezone(env);
    const lines = [`Chủ đề: ${clean(topic)}`];
    if (cfg.usesTimezone) lines.push(`Múi giờ: ${tz}`, `Thời điểm hiện tại (UTC): ${now.toISOString()}`);
    for (const [nid, value] of Object.entries(context)) lines.push(`Kết quả của ${nid}:\n${clean(JSON.stringify(value))}`);
    if (comments) lines.push('Bình luận cần trả lời:\n' + comments.map((c, i) => `${i + 1}. ${clean(c)}`).join('\n'));
    const user = `<du_lieu>\n${lines.join('\n\n')}\n</du_lieu>\n\nHãy làm phần việc của bạn và trả về đúng định dạng JSON được yêu cầu.`;

    const { text, usage } = await callModel(cfg, env, {
      system: `${COMMON}\n\n${cfg.system}`,
      user, maxTokens: cfg.maxTokens, schema: cfg.schema, signal: request.signal,
    });
    let output;
    try {
      // một số cổng bọc JSON trong khối ```; gỡ ra rồi vẫn kiểm tra nghiêm ngặt bằng schema
      output = validate(cfg.schema, JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')));
    } catch {
      return failCode('output_invalid', 502);
    }
    // trường do backend gắn, không do mô hình tự khai
    const meta = { provider: cfg.provider, model: cfg.model, usage };
    if (id === 'shikamaru') Object.assign(meta, { webSearched: false, sources: [], note: 'Chưa tra cứu web: nhận định dựa trên hiểu biết chung của mô hình, cần kiểm chứng.' });
    if (id === 'sai') Object.assign(meta, { imagesGenerated: false, note: 'Chỉ là brief và prompt; chưa tạo ảnh.' });
    if (id === 'neji') Object.assign(meta, { note: 'Đánh giá của AI, không phải xác minh sự thật.' });
    if (id === 'minato') Object.assign(meta, { scheduled: false, timezone: tz, note: 'Lịch đề xuất; chưa lên lịch hay đăng thật.' });
    if (id === 'ino') Object.assign(meta, { sent: false, note: 'Bản nháp; chưa gửi bình luận nào.' });
    return json({ ok: true, characterId: id, output, meta });
  } catch (e) {
    if (e instanceof AiError) return failCode(e.code, e.status === 499 ? 499 : e.status);
    return failCode('upstream', 500);
  } finally {
    release();
  }
}
