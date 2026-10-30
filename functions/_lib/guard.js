// Bảo vệ endpoint công khai. Giới hạn nằm trong bộ nhớ của từng isolate Cloudflare nên chỉ là lớp phụ trợ
// ("best-effort"); muốn giới hạn chắc chắn hãy đặt Rate Limiting rule / Access của Cloudflare và hạn mức chi tiêu ở nhà cung cấp.
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map(); // ip -> [timestamps]
const inflight = new Set();

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const fail = (code, message, status) => json({ ok: false, code, message }, status);

export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // lời gọi không phải từ trình duyệt (curl, kiểm thử)
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function rateLimited(request, env, { bucket = 'run', limit = Number(env?.RATE_LIMIT_PER_10MIN) || 40 } = {}) {
  const ip = `${bucket}|${request.headers.get('cf-connecting-ip') || 'local'}`;
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= limit) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

// Chặn cùng một yêu cầu giống hệt đang chạy (gửi đúp).
export function claim(key) {
  if (inflight.has(key)) return null;
  inflight.add(key);
  return () => inflight.delete(key);
}

export function resetGuard() {
  hits.clear();
  inflight.clear();
}
