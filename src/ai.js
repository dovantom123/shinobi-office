// Gọi backend AI (functions/api/*). Frontend chỉ gửi characterId và dữ liệu nhiệm vụ; không giữ khóa hay chọn model.
const CLIENT_TIMEOUT = 60000;

async function post(path, body, signal, timeoutMs = CLIENT_TIMEOUT) {
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    let data = null;
    try {
      data = await res.json();
    } catch { /* phản hồi không phải JSON (vd. 404 khi chạy dev không có Functions) */ }
    if (data && typeof data.ok === 'boolean') return data;
    if (res.status === 404) return { ok: false, code: 'no_backend', message: 'Chưa có backend AI (chạy local bằng Vite không có Functions).' };
    return { ok: false, code: 'upstream', message: 'Backend trả về phản hồi không hợp lệ.' };
  } catch {
    if (signal?.aborted) return { ok: false, code: 'cancelled', message: 'Đã hủy.' };
    if (timeout.aborted) return { ok: false, code: 'timeout', message: 'Backend phản hồi quá lâu.' };
    return { ok: false, code: 'network', message: 'Không kết nối được tới backend.' };
  }
}

export const runCharacter = (payload, signal) => post('/api/produce', payload, signal);
// Tạo ảnh từ một prompt của Sai (chỉ gọi khi người dùng bấm nút); server tự chọn model, kích thước và khóa.
export const generateImage = ({ sai, promptIndex }, signal) => post('/api/image', { characterId: 'sai', sai, promptIndex }, signal, 100000);
export const testConnection = (characterId) => post('/api/test', { characterId });

export async function fetchStatus() {
  try {
    const res = await fetch('/api/status', { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    return data?.ok ? data : null;
  } catch {
    return null; // không có backend: giao diện hiển thị "chưa cấu hình"
  }
}

// Chuyển đầu ra có cấu trúc thành văn bản thuần để hiển thị (luôn escape khi chèn vào DOM).
const list = (a) => a.map((x) => `• ${x}`).join('\n');
const FORMAT = {
  shikamaru: (o) => [o.summary, 'Khán giả:\n' + list(o.audience), 'Insight:\n' + list(o.insights), 'Góc nội dung:\n' + list(o.angles.map((a) => `${a.title}: ${a.description}`)), `Giới hạn: ${o.limitations}`].join('\n\n'),
  jiraiya: (o) => [`Tiêu đề: ${o.title}`, o.caption, o.body, o.hashtags.join(' '), o.assumptions.length ? 'Giả định:\n' + list(o.assumptions) : ''].filter(Boolean).join('\n\n'),
  sai: (o) => [`Ý tưởng: ${o.concept}`, 'Bố cục:\n' + list(o.layouts.map((l) => `${l.format} (${l.size}): ${l.description}`)), `Bảng màu: ${o.palette.join(', ')}`, 'Prompt ảnh:\n' + list(o.imagePrompts)].join('\n\n'),
  neji: (o) => [`Kết luận: ${{ approve: 'Duyệt', revise: 'Cần sửa', reject: 'Không duyệt' }[o.verdict]}`, o.consistency, o.issues.length ? 'Vấn đề:\n' + list(o.issues.map((i) => `[${i.severity}] ${i.problem} → ${i.suggestion}`)) : '', o.unsupportedClaims.length ? 'Tuyên bố thiếu căn cứ:\n' + list(o.unsupportedClaims) : '', o.disclaimer].filter(Boolean).join('\n\n'),
  minato: (o) => ['Lịch đề xuất (chưa lên lịch thật):\n' + list(o.slots.map((s) => `${s.channel} · ${s.localTime} — ${s.reason}`)), o.notes].join('\n\n'),
  ino: (o) => 'Bản nháp trả lời (chưa gửi):\n' + o.replies.map((r) => `#${r.commentIndex} [${r.tone}] ${r.draft}${r.escalate ? `\n   ⚑ Chuyển Tổng chỉ huy: ${r.reason}` : ''}`).join('\n'),
  naruto: (o) => [o.headline, o.summary, 'Quyết định đề xuất:\n' + list(o.decisions), 'Rủi ro:\n' + list(o.risks), 'Việc tiếp theo (cho con người):\n' + list(o.nextSteps)].join('\n\n'),
};
export const formatOutput = (id, output) => FORMAT[id](output);

export const headline = (id, output) =>
  ({ shikamaru: (o) => o.summary, jiraiya: (o) => o.title, sai: (o) => o.concept, neji: (o) => ({ approve: 'Duyệt đăng.', revise: 'Cần sửa trước khi đăng.', reject: 'Không duyệt.' })[o.verdict], minato: (o) => `Đề xuất ${o.slots.length} mốc đăng.`, ino: (o) => `Soạn ${o.replies.length} bản nháp.`, naruto: (o) => o.headline })[id](output);
