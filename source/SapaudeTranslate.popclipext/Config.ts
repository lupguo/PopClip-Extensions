// #popclip
// name: Sapaude Translate
// identifier: com.lupguo.popclip.extension.sapaude-translate
// description: Translate the selection with Google, Microsoft or an AI model.
// icon: iconify:material-symbols:translate
// popclipVersion: 4586
// regex: (?s)^.{1,5000}$
// entitlements: [network]

import * as ai from "./ai.ts";
import { BadResponseError, SettingsError } from "./errors.ts";
import * as google from "./google.ts";
import { type Language, languages } from "./languages.ts";
import * as microsoft from "./microsoft.ts";

// the header regex above allows at most this many characters
const hardMaxLength = 5000;
const defaultMaxLength = 500;
// PopClip truncates previews to this many characters
const previewLimit = 160;

export const options = [
  {
    identifier: "engine",
    label: { en: "Translation Service", "zh-Hans": "翻译服务" },
    type: "multiple",
    values: ["google", "microsoft", "ai"],
    valueLabels: ["Google", "Microsoft", "AI"],
    defaultValue: "google",
  },
  {
    identifier: "resultMode",
    label: { en: "Result Handling", "zh-Hans": "结果处理" },
    type: "multiple",
    values: ["preview", "replace", "copy"],
    valueLabels: [
      { en: "Preview", "zh-Hans": "预览" },
      { en: "Replace", "zh-Hans": "替换" },
      { en: "Copy", "zh-Hans": "复制" },
    ],
    defaultValue: "preview",
    description: {
      en: "Hold ⌥ to replace instead (or to preview, when set to Replace).",
      "zh-Hans": "按住 ⌥ 临时改为替换（设为替换时改为预览）。",
    },
  },
  {
    identifier: "maxLength",
    label: { en: "Maximum Text Length", "zh-Hans": "最大文本长度" },
    type: "string",
    defaultValue: "500",
    description: {
      en: "Longest selection to translate, in characters (1–5000).",
      "zh-Hans": "可翻译的最大字符数（1–5000）。",
    },
  },
  {
    identifier: "languagesHeading",
    label: { en: "Target Languages", "zh-Hans": "目标语言" },
    type: "heading",
  },
  {
    identifier: "lang_en",
    label: { en: "English", "zh-Hans": "英文" },
    type: "boolean",
    icon: "square filled En",
    defaultValue: true,
  },
  {
    identifier: "lang_zh",
    label: { en: "Simplified Chinese", "zh-Hans": "简体中文" },
    type: "boolean",
    icon: "square filled 中",
    defaultValue: true,
  },
  {
    identifier: "lang_zht",
    label: { en: "Traditional Chinese", "zh-Hans": "繁体中文" },
    type: "boolean",
    icon: "square filled 繁",
    defaultValue: false,
  },
  {
    identifier: "lang_ja",
    label: { en: "Japanese", "zh-Hans": "日语" },
    type: "boolean",
    icon: "square filled 日",
    defaultValue: false,
  },
  {
    identifier: "lang_ko",
    label: { en: "Korean", "zh-Hans": "韩语" },
    type: "boolean",
    icon: "square filled 한",
    defaultValue: false,
  },
  {
    identifier: "lang_es",
    label: { en: "Spanish", "zh-Hans": "西班牙语" },
    type: "boolean",
    icon: "square filled Es",
    defaultValue: false,
  },
  {
    identifier: "lang_fr",
    label: { en: "French", "zh-Hans": "法语" },
    type: "boolean",
    icon: "square filled Fr",
    defaultValue: false,
  },
  {
    identifier: "lang_de",
    label: { en: "German", "zh-Hans": "德语" },
    type: "boolean",
    icon: "square filled De",
    defaultValue: false,
  },
  {
    identifier: "lang_ru",
    label: { en: "Russian", "zh-Hans": "俄语" },
    type: "boolean",
    icon: "square filled Ру",
    defaultValue: false,
  },
  {
    identifier: "aiHeading",
    label: { en: "AI Translation", "zh-Hans": "AI 翻译" },
    type: "heading",
  },
  {
    identifier: "aiVendor",
    label: { en: "AI Provider", "zh-Hans": "模型厂商" },
    type: "multiple",
    values: ["openai", "deepseek", "qwen", "zhipu", "openrouter", "custom"],
    valueLabels: [
      "OpenAI",
      "DeepSeek",
      { en: "Qwen", "zh-Hans": "通义千问" },
      { en: "Zhipu GLM", "zh-Hans": "智谱 GLM" },
      "OpenRouter",
      { en: "Custom", "zh-Hans": "自定义" },
    ],
    defaultValue: "openai",
  },
  {
    identifier: "aiModel",
    label: { en: "Model", "zh-Hans": "模型" },
    type: "string",
    description: {
      en: "Leave blank to use the provider's default: gpt-6-luna, deepseek-flash, qwen3.7-flash, glm-4.7-flash or openai/gpt-6-luna.",
      "zh-Hans":
        "留空使用厂商默认模型：gpt-6-luna、deepseek-flash、qwen3.7-flash、glm-4.7-flash 或 openai/gpt-6-luna。",
    },
  },
  {
    identifier: "aiKey",
    label: "API Key",
    type: "secret",
  },
  {
    identifier: "aiBaseUrl",
    label: "Base URL",
    type: "string",
    description: {
      en: "Only for the Custom provider, e.g. https://api.moonshot.cn/v1",
      "zh-Hans": "仅用于自定义厂商，例如 https://api.moonshot.cn/v1",
    },
  },
] as const;

type Options = InferOptions<typeof options>;

const engineNames: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  ai: "AI",
};

// blank or non-numeric falls back to the default; the rest is clamped to 1–5000
function parseMaxLength(value: string): number {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) {
    return defaultMaxLength;
  }
  return Math.min(Math.max(n, 1), hardMaxLength);
}

function translate(
  text: string,
  to: Language,
  options: Options,
): Promise<string> {
  switch (options.engine) {
    case "microsoft":
      return microsoft.translate(text, to);
    case "ai":
      return ai.translate(text, to, {
        vendor: options.aiVendor,
        model: options.aiModel,
        key: options.aiKey,
        baseUrl: options.aiBaseUrl,
      });
    default:
      return google.translate(text, to);
  }
}

interface ErrorResponse {
  status: number;
  data?: { error?: { message?: string } };
}

// turn errors into messages a user can act on
function errorMessage(error: unknown, engine: string): string {
  if (error instanceof SettingsError) {
    return error.message;
  }
  const name = engineNames[engine] ?? engine;
  if (error instanceof BadResponseError) {
    return `${name} 返回了无法解析的结果`;
  }
  const response = (error as { response?: ErrorResponse } | null)?.response;
  if (!response) {
    return `无法连接 ${name}：${String(error)}`;
  }
  switch (response.status) {
    case 401:
    case 403:
      return engine === "ai"
        ? "AI API Key 无效或无权限，请检查设置"
        : `${name} 拒绝访问，接口可能已变更或被限流`;
    case 429:
      return `${name} 暂时限制了请求，请稍后再试，或在设置中换一个翻译服务`;
    default: {
      const detail = response.data?.error?.message;
      return `${name} 错误 ${response.status}${detail ? `: ${detail}` : ""}`;
    }
  }
}

async function run(
  input: Input,
  options: Options,
  to: Language,
): Promise<string | undefined> {
  if (!input.text.trim()) {
    return;
  }
  const limit = parseMaxLength(options.maxLength);
  if (input.text.length > limit) {
    popclip.showText(
      `选中文本 ${input.text.length} 字符，超过上限 ${limit}（可在设置中调整，最大 ${hardMaxLength}）`,
    );
    return;
  }
  let result: string;
  try {
    result = await translate(input.text, to, options);
  } catch (e) {
    popclip.showText(errorMessage(e, options.engine));
    return;
  }
  let mode = options.resultMode;
  // holding option swaps replace with preview, and anything else with replace
  if (popclip.modifiers.option) {
    mode = mode === "replace" ? "preview" : "replace";
  }
  switch (mode) {
    case "replace":
      await popclip.pasteText(result);
      return;
    case "copy":
      await popclip.copyText(result);
      return;
    default:
      if (result.length > previewLimit) {
        // too long for the preview: copy it and show it all in Large Type
        await popclip.copyText(result, { notify: false });
        popclip.showText(result, { style: "large" });
        return;
      }
      // shown by the action's "preview-result" step
      return result;
  }
}

// one button per language, shown when the language is ticked in the settings
export const actions: Action<Options>[] = languages.map((language) => ({
  title: language.label,
  icon: language.icon,
  requirements: ["text", `option-lang_${language.code}=1`],
  after: "preview-result",
  code: (input, options) => run(input, options, language),
}));
