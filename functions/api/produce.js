// POST /api/produce  { characterId, topic, inputs, comments? } → { ok, output, meta } hoặc { ok:false, code, message }
import { handleRun } from '../_lib/run.js';

export const onRequestPost = ({ request, env }) => handleRun(request, env);
