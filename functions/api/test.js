// POST /api/test { characterId }: kiểm tra kết nối của một nhân vật bằng một lời gọi rất nhỏ (chỉ khi người dùng bấm).
import { CHARACTERS, resolve } from '../_lib/config.js';
import { callAnthropic, AiError } from '../_lib/anthropic.js';
import { json, fail, sameOrigin, rateLimited } from '../_lib/guard.js';
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
  const id = data?.characterId;
  const cfg = typeof id === 'string' && Object.hasOwn(CHARACTERS, id) ? resolve(id, env) : null;
  if (!cfg) return bad('unknown_character', 400);
  if (cfg.issue) return bad(cfg.issue, 503);
  if (rateLimited(request, env)) return bad('rate_limited', 429);
  const started = Date.now();
  try {
    await callAnthropic({ apiKey: env[cfg.keyEnv], model: cfg.model, system: 'Chỉ trả lời đúng một từ: OK.', user: 'ping', maxTokens: 1000, signal: request.signal, timeoutMs: 20000 });
    return json({ ok: true, characterId: id, model: cfg.model, latencyMs: Date.now() - started });
  } catch (e) {
    if (e instanceof AiError) return bad(e.code, e.status);
    return bad('upstream', 500);
  }
}
