// Tạo ảnh qua cổng tương thích OpenAI: POST {baseUrl}/images/generations.
// CHƯA kiểm chứng với dịch vụ thật: tài liệu của cổng không nêu đường dẫn; dùng đúng chuẩn OpenAI Images API.
import { AiError } from './anthropic.js';

const MAX_B64 = 8_000_000; // ~6 MB ảnh; chặn phản hồi quá lớn

export async function callImages({ baseUrl, apiKey, model, prompt, size, signal, timeoutMs = 90000 }) {
  const timeout = AbortSignal.timeout(timeoutMs);
  let res;
  try {
    res = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt, size, n: 1 }),
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
    if (res.status === 400 || res.status === 404) throw new AiError('image_rejected', 502);
    throw new AiError('upstream', 503);
  }
  let out;
  try {
    out = await res.json();
  } catch {
    throw new AiError('upstream', 502);
  }
  const item = out?.data?.[0];
  if (typeof item?.b64_json === 'string' && item.b64_json) {
    if (item.b64_json.length > MAX_B64 || !/^[A-Za-z0-9+/=\s]+$/.test(item.b64_json)) throw new AiError('bad_image', 502);
    return { src: `data:image/png;base64,${item.b64_json.replace(/\s/g, '')}` };
  }
  if (typeof item?.url === 'string') {
    let u;
    try {
      u = new URL(item.url);
    } catch {
      throw new AiError('bad_image', 502);
    }
    if (u.protocol !== 'https:') throw new AiError('bad_image', 502);
    return { src: u.href };
  }
  throw new AiError('bad_image', 502);
}
