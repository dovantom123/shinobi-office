// Gọi Anthropic Messages API (https://platform.claude.com/docs/en/api/messages).
// Đầu ra có cấu trúc dùng output_config.format = json_schema (JSON nằm trong khối text).
export class AiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const URL_MESSAGES = 'https://api.anthropic.com/v1/messages';

export async function callAnthropic({ apiKey, model, system, user, maxTokens, schema, signal, timeoutMs = 45000 }) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const body = { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] };
  if (schema) body.output_config = { format: { type: 'json_schema', schema } };

  let res;
  try {
    res = await fetch(URL_MESSAGES, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch {
    if (timeout.aborted) throw new AiError('timeout', 504);
    if (signal?.aborted) throw new AiError('cancelled', 499);
    throw new AiError('network', 502);
  }
  if (!res.ok) {
    // không đọc/ghi lại nội dung lỗi của nhà cung cấp để tránh lộ dữ liệu; chỉ phân loại theo mã trạng thái
    if (res.status === 401 || res.status === 403) throw new AiError('auth', 502);
    if (res.status === 429) throw new AiError('provider_rate_limited', 429);
    if (res.status === 400 || res.status === 404) throw new AiError('bad_request', 502);
    throw new AiError('upstream', 503);
  }
  let out;
  try {
    out = await res.json();
  } catch {
    throw new AiError('upstream', 502);
  }
  if (out.stop_reason === 'refusal') throw new AiError('refusal', 502);
  if (out.stop_reason === 'max_tokens') throw new AiError('truncated', 502);
  const text = (out.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!text) throw new AiError('empty', 502);
  return { text, usage: out.usage ? { input: out.usage.input_tokens, output: out.usage.output_tokens } : undefined };
}
