import axios from "axios";
import { BadResponseError, SettingsError } from "./errors.ts";
import type { Language } from "./languages.ts";

interface Vendor {
  baseUrl: string;
  model: string;
  // extra request fields that turn off "thinking", which translation doesn't need
  // and which costs extra tokens and time
  extraBody: Record<string, unknown>;
}

// Default models are chosen for cost first, then quality, then speed.
// Prices per 1M tokens (input / output), checked 2026-11-11.
// When changing a default model, update the aiModel description in Config.ts and README.md.
const vendors: Record<string, Vendor | undefined> = {
  // $0.10 / $0.50
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-6-luna",
    extraBody: { reasoning_effort: "none" },
  },
  // ¥1 / ¥4 off-peak, ¥2 / ¥8 peak
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-flash",
    extraBody: { thinking: { type: "disabled" } },
  },
  // ¥0.2 / ¥0.8 for inputs up to 32K
  qwen: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.7-flash",
    extraBody: { enable_thinking: false },
  },
  // free
  zhipu: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.7-flash",
    extraBody: { thinking: { type: "disabled" } },
  },
  // about $0.05–0.10 / $0.25–0.50, depending on the provider OpenRouter picks
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-6-luna",
    extraBody: { reasoning: { effort: "none" } },
  },
};

export interface AiConfig {
  // a key of `vendors`, or "custom"
  vendor: string;
  model: string;
  key: string;
  baseUrl: string;
}

interface ChatResponse {
  choices?: { message?: { content?: unknown } }[];
}

export async function translate(
  text: string,
  to: Language,
  config: AiConfig,
): Promise<string> {
  const key = config.key.trim();
  if (!key) {
    throw new SettingsError("请在设置中填写 AI API Key");
  }
  let model = config.model.trim();
  let baseUrl: string;
  let extraBody: Record<string, unknown> = {};
  if (config.vendor === "custom") {
    baseUrl = config.baseUrl.trim().replace(/\/+$/, "");
    if (!baseUrl || !model) {
      throw new SettingsError("自定义厂商需要填写 Base URL 和模型");
    }
  } else {
    const vendor = vendors[config.vendor];
    if (!vendor) {
      throw new SettingsError("请在设置中重新选择模型厂商");
    }
    baseUrl = vendor.baseUrl;
    // only the default model is known to accept the extra fields
    if (!model) {
      model = vendor.model;
      extraBody = vendor.extraBody;
    }
  }
  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      ...extraBody,
      messages: [
        {
          role: "system",
          content: `You are a translation engine. Translate the user's text into ${to.ai}. Output only the translation, keep the original formatting and line breaks, no explanations.`,
        },
        { role: "user", content: text },
      ],
    },
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const content = (response.data as ChatResponse | null)?.choices?.[0]?.message
    ?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new BadResponseError();
  }
  return content.trim();
}
