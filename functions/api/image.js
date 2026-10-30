// POST /api/image { characterId: 'sai', sai: <đầu ra của Sai>, promptIndex } → { ok, image: { src }, meta }
// Chỉ chạy khi người dùng bấm "Tạo ảnh". Khóa, địa chỉ cổng, model và kích thước nằm ở cấu hình server.
import { CHARACTERS, IMAGE, PROVIDERS, validate } from '../_lib/config.js';
import { callImages } from '../_lib/image.js';
import { AiError } from '../_lib/anthropic.js';
import { json, fail, sameOrigin, rateLimited, claim } from '../_lib/guard.js';
import { message } from '../_lib/run.js';

const bad = (code, status) => fail(code, message(code), status);

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  let data;
  try {
    data = await request.json();
  } catch {
    return bad('bad_json', 400);
  }
  if (data?.characterId !== 'sai') return bad('unknown_character', 400);

  // prompt lấy từ đầu ra của Sai (kiểm lại bằng schema), không nhận văn bản tự do từ client
  let prompt;
  try {
    const sai = validate(CHARACTERS.sai.schema, data.sai);
    const i = data.promptIndex;
    if (!Number.isInteger(i) || i < 0 || i >= sai.imagePrompts.length) throw new TypeError('index');
    prompt = sai.imagePrompts[i].trim();
    if (!prompt || prompt.length > 1500) throw new TypeError('prompt');
  } catch {
    return bad('bad_image_prompt', 400);
  }

  const provider = PROVIDERS[IMAGE.provider];
  const model = env.IMAGE_MODEL || IMAGE.model;
  if (!IMAGE.models.includes(model)) return bad('model_not_allowed', 503);
  if (!env[provider.keyEnv]) return bad('not_configured', 503);
  if (rateLimited(request, env, { bucket: 'image', limit: Number(env.IMAGE_RATE_LIMIT_PER_10MIN) || 10 })) return bad('rate_limited', 429);
  const release = claim(`image|${prompt}`);
  if (!release) return bad('duplicate', 409);
  try {
    const { src } = await callImages({ baseUrl: provider.baseUrl, apiKey: env[provider.keyEnv], model, prompt, size: IMAGE.size, signal: request.signal });
    return json({ ok: true, image: { src }, meta: { provider: IMAGE.provider, model, size: IMAGE.size, note: 'Ảnh do AI tạo, chưa kiểm duyệt; chưa đăng đi đâu.' } });
  } catch (e) {
    if (e instanceof AiError) return bad(e.code, e.status);
    return bad('upstream', 500);
  } finally {
    release();
  }
}
