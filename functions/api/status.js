// GET /api/status → cấu hình từng nhân vật (không chứa khóa API)
import { CHARACTERS, ORDER, PROVIDERS, resolve, timezone } from '../_lib/config.js';
import { json, fail, sameOrigin } from '../_lib/guard.js';

export function onRequestGet({ request, env }) {
  if (!sameOrigin(request)) return fail('forbidden', 'Yêu cầu bị từ chối (khác nguồn gốc).', 403);
  const characters = ORDER.map((id) => {
    const c = resolve(id, env);
    return { id, role: c.role, provider: c.provider, providerLabel: c.providerLabel, model: c.model, modelLabel: PROVIDERS[c.provider].models[c.model] ?? null, configured: !c.issue, issue: c.issue };
  });
  return json({ ok: true, characters, timezone: timezone(env), known: Object.keys(CHARACTERS).length });
}
