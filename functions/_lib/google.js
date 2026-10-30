// Gọi Gemini API qua Interactions API (https://ai.google.dev/gemini-api/docs/structured-output).
// Khóa đặt trong header x-goog-api-key; JSON nằm trong steps[] loại model_output → content[].text.
// CHƯA kiểm chứng với khóa thật: cách phân loại lỗi 400/403 và chặn an toàn dựa trên tài liệu + hành vi thường gặp.
import { AiError } from './anthropic.js';

const URL_INTERACTIONS = 'https://generativelanguage.googleapis.com/v1beta/interactions';

export async function callGoogle({ apiKey, model, system, user, maxTokens, schema, signal, timeoutMs = 45000 }) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const body = { model, input: user, system_instruction: system, store: false, generation_config: { max_output_tokens: maxTokens, thinking_level: 'low' } };
  if (schema) body.response_format = { type: 'text', mime_type: 'application/json', schema };

  let res;
  try {
    res = await fetch(URL_INTERACTIONS, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch {
    if (timeout.aborted) throw new AiError('timeout', 504);
    if (signal?.aborted) throw new AiError('cancelled', 499);
    throw new AiError('network', 502);
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new AiError('auth', 502);
    if (res.status === 429) throw new AiError('provider_rate_limited', 429);
    if (res.status === 400) {
      // khóa sai thường trả 400; chỉ đọc mã lý do (reason), không ghi lại nội dung lỗi
      const reason = await res.json().then((j) => JSON.stringify(j?.error?.details ?? j?.error?.status ?? '')).catch(() => '');
      throw new AiError(/API_KEY_INVALID|API key not valid/i.test(reason) ? 'auth' : 'bad_request', 502);
    }
    if (res.status === 404) throw new AiError('bad_request', 502);
    throw new AiError('upstream', 503);
  }
  let out;
  try {
    out = await res.json();
  } catch {
    throw new AiError('upstream', 502);
  }
  if (out.status === 'incomplete') throw new AiError('truncated', 502);
  if (out.status && out.status !== 'completed') throw new AiError('upstream', 502);
  const text = (out.steps ?? [])
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('')
    .trim();
  if (!text) throw new AiError('empty', 502); // gồm cả trường hợp bị chặn an toàn (không có văn bản)
  return { text, usage: out.usage ? { input: out.usage.total_input_tokens ?? out.usage.input_tokens, output: out.usage.total_output_tokens ?? out.usage.output_tokens } : undefined };
}
