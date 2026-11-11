# Sapaude Translate

选中文本后点击语言按钮，用 Google、微软（Bing）或 AI 模型翻译。

## 按钮

默认显示两个按钮：**En**（翻译成英文）和 **中**（翻译成简体中文）。
在设置的“目标语言”里还可以勾选繁体中文、日语、韩语、西班牙语、法语、德语、俄语，勾选后出现对应按钮。

## 设置

- **翻译服务**：Google / Microsoft / AI。Google 和 Microsoft 使用免费接口，无需 Key；这些接口是非官方的，可能被限流或变更。
- **结果处理**：预览（默认，译文已复制；不超过 160 字符时在 PopClip 中显示、点击可粘贴，更长时全屏大字显示）/ 替换选中文本 / 复制到剪贴板。按住 ⌥ 点击时临时改为替换（设为替换时改为预览）。
- **最大文本长度**：默认 500 字符，最大 5000。
- **AI 翻译**：选择模型厂商并填写 API Key。模型留空时使用厂商默认模型（已关闭“思考”以节省费用和时间）：

  | 厂商 | 默认模型 |
  |---|---|
  | OpenAI | gpt-6-luna |
  | DeepSeek | deepseek-flash |
  | 通义千问 | qwen3.7-flash |
  | 智谱 GLM | glm-4.7-flash（免费） |
  | OpenRouter | openai/gpt-6-luna |
  | 自定义 | 填写 Base URL（OpenAI 兼容，例如 `https://api.moonshot.cn/v1`）和模型 |
