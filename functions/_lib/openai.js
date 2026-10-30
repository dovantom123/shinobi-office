// Gọi OpenAI Responses API (https://developers.openai.com/api/docs/guides/structured-outputs).
// Đầu ra có cấu trúc dùng text.format = json_schema (strict); JSON nằm trong output[].content[].text.
import { AiError } from './anthropic.js';

const URL_RESPONSES = 'https://api.openai.com/v1/responses';

export async function callOpenAI({ apiKey, model, system, user, maxTokens, schema, signal, timeoutMs = 45000 }) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const body = { model, instructions: system, input: user, max_output_tokens: maxTokens, store: false };
  if (schema) body.text = { format: { type: 'json_schema', name: 'ket_qua', strict: true, schema } };

  let res;
  try {
    res = await fetch(URL_RESPONSES, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch {
    if (timeout.aborted) throw new AiError('timeout', 504);
    if (signal?.aborted) throw new AiError('cancelled', 499);
    throw new AiError('network', 502);
  }
  if (!res.ok) {
    // chỉ phân loại theo mã trạng thái, không đọc/ghi lại nội dung lỗi của nhà cung cấp
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
  const parts = (out.output ?? []).filter((o) => o.type === 'message').flatMap((o) => o.content ?? []);
  if (parts.some((p) => p.type === 'refusal')) throw new AiError('refusal', 502);
  if (out.status === 'incomplete') throw new AiError(out.incomplete_details?.reason === 'content_filter' ? 'refusal' : 'truncated', 502);
  const text = parts.filter((p) => p.type === 'output_text').map((p) => p.text).join('').trim();
  if (!text) throw new AiError('empty', 502);
  return { text, usage: out.usage ? { input: out.usage.input_tokens, output: out.usage.output_tokens } : undefined };
}
