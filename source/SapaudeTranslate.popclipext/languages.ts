export interface Language {
  // internal code, also used in the option name lang_<code>
  code: string;
  label: { en: string; "zh-Hans": string };
  icon: string;
  // the language code or name each backend expects
  google: string;
  microsoft: string;
  ai: string;
}

export const languages: Language[] = [
  {
    code: "en",
    label: { en: "English", "zh-Hans": "英文" },
    icon: "square filled En",
    google: "en",
    microsoft: "en",
    ai: "English",
  },
  {
    code: "zh",
    label: { en: "Simplified Chinese", "zh-Hans": "简体中文" },
    icon: "square filled 中",
    google: "zh-CN",
    microsoft: "zh-Hans",
    ai: "Simplified Chinese",
  },
  {
    code: "zht",
    label: { en: "Traditional Chinese", "zh-Hans": "繁体中文" },
    icon: "square filled 繁",
    google: "zh-TW",
    microsoft: "zh-Hant",
    ai: "Traditional Chinese",
  },
  {
    code: "ja",
    label: { en: "Japanese", "zh-Hans": "日语" },
    icon: "square filled 日",
    google: "ja",
    microsoft: "ja",
    ai: "Japanese",
  },
  {
    code: "ko",
    label: { en: "Korean", "zh-Hans": "韩语" },
    icon: "square filled 한",
    google: "ko",
    microsoft: "ko",
    ai: "Korean",
  },
  {
    code: "es",
    label: { en: "Spanish", "zh-Hans": "西班牙语" },
    icon: "square filled Es",
    google: "es",
    microsoft: "es",
    ai: "Spanish",
  },
  {
    code: "fr",
    label: { en: "French", "zh-Hans": "法语" },
    icon: "square filled Fr",
    google: "fr",
    microsoft: "fr",
    ai: "French",
  },
  {
    code: "de",
    label: { en: "German", "zh-Hans": "德语" },
    icon: "square filled De",
    google: "de",
    microsoft: "de",
    ai: "German",
  },
  {
    code: "ru",
    label: { en: "Russian", "zh-Hans": "俄语" },
    icon: "square filled Ру",
    google: "ru",
    microsoft: "ru",
    ai: "Russian",
  },
];
