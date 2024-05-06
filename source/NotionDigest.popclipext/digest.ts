import axios from 'axios'
import {markdownToBlocks} from "@tryfabric/martian";

// our own options
type DigestOptions = {
  secrets: string
  pageId: string
  blockId: string
};

// Notion Message
class Message {
  input: Input;
  ctx: Context;

  constructor(input: Input, ctx: Context) {
    this.input = input;
    this.ctx = ctx;
  }

  getMessageMarkdown(): string {
    return `**Content**: ${replaceNewLine(this.input.text, " ")}
      **Refer**: ${getReference(this.ctx)}
      **Web**: ${getWebsite(this.ctx)}
      **LogTime**: ${formatCurrentDateTime()}
      ---
    `;
  }
}

// Notion api root
const notion = axios.create({baseURL: 'https://api.notion.com/v1/'})

// digest is an action save info from website or app to Notion Page
const digest: ActionFunction<DigestOptions> = async (input, options, context) => {
  // notion's block data
  const msg = new Message(input, context)
  const blocks = markdownToBlocks(msg.getMessageMarkdown())

  // http request
  notion.defaults.headers.common.Authorization = `Bearer ${options.secrets}`
  notion.defaults.headers.common['Notion-Version'] = '2022-06-28'
  await notion.patch(`blocks/${options.pageId}/children`, {
    children: blocks,
    after: options.blockId
  }).then((data) => {
    popclip.showSuccess()
  }).catch((error) => {
    popclip.showText("axios err:" + JSON.stringify(error));
  });

};

// 将换行符替换层指定字符串
function replaceNewLine(text, replacement) {
  text = text.replace(/\n+/g, '\n')
  const secondIdx = text.indexOf('\n', text.indexOf('\n') + 1);
  if (secondIdx !== -1) {
    // 从第二个换行符开始，用指定的字符串替换所有换行符
    return text.slice(0, secondIdx) +
        text.slice(secondIdx).replace(/\n/g, replacement);
  }

  return text;
}

// a markdown fragment to represent the clip's source
function getReference(ctx: Context): string {
  let ref = ctx.appName.length > 0 ? ctx.appName : 'unknown source'
  if (ctx.browserUrl.length > 0) {
    ref = `[${ctx.browserTitle.length > 0 ? ctx.browserTitle : ctx.browserUrl}](${ctx.browserUrl})`
  }

  return ref
}

function getWebsite(ctx: Context): string {
  // default get app name as website
  let website = ctx.appName.length > 0 ? ctx.appName : 'unknown website'

  // if browser url, return website
  if (ctx.browserUrl.length > 0) {
    try {
      const urlObj = new URL(ctx.browserUrl);
      website = `${urlObj.protocol}//${urlObj.hostname}`;
    } catch (err) {
      return 'invalid website url'
    }
  }

  return website
}

// current date & time in current locale's format
function formatCurrentDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

export const action: Action<DigestOptions> = {
  title: "Save Digest To Notion",
  code: digest
}