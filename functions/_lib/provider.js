// Chọn nhà cung cấp theo cấu hình nhân vật (không bao giờ theo dữ liệu từ client).
import { callAnthropic } from './anthropic.js';
import { callOpenAI } from './openai.js';
import { callGoogle } from './google.js';

const CALLERS = { anthropic: callAnthropic, openai: callOpenAI, google: callGoogle };

export const callModel = (cfg, env, params) => CALLERS[cfg.provider]({ apiKey: env[cfg.keyEnv], model: cfg.model, ...params });
