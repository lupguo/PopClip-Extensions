import axios from 'axios'
import {markdownToBlocks} from "@tryfabric/martian";
import {htmlToMarkdown} from "../../source-contrib/CopyAsMarkdown-TablesTest.popclipext/copy-as-markdown";
import {tr} from "voca";

// our own options
type DigestOptions = {
  secrets: string
  pageId: string
  blockId: string
};

// Notion Message
class Message {
  content: string;
  ctx: Context;

  constructor(content: string, ctx: Context) {
    this.content = content;
    this.ctx = ctx;
  }

  getMessageMarkdown(): string {
    return `**Content:** ${this.content}
      **Refer:** ${getReference(this.ctx)}
      **Web:** ${getWebsite(this.ctx)}
      **LogTime:** ${formatCurrentDateTime()}
      ---
    `;
  }
}

// Notion api root
const notion = axios.create({baseURL: 'https://api.notion.com/v1/'})

// digest is an action save awesome info from website or app to your Notion Page
const digest: ActionFunction<DigestOptions> = (input, options, context) => {
  // format input data
  const msg = new Message(input.matchedText, context)
  // popclip.showText("markdown: " + msg.getMessageMarkdown())

  // async send to Notion
  notion.defaults.headers.common.Authorization = `Bearer ${options.secrets}`
  notion.defaults.headers.common['Notion-Version'] = '2022-06-28'

  // send json data
  const pageId = options.pageId
  const blocks = markdownToBlocks(
      msg.getMessageMarkdown(),
      {allowUnsupported: true, strictImageUrls: true}
  )

  // http request
  notion.patch(`blocks/${pageId}/children`, {
    children: blocks,
    after: options.blockId
  }).then((data) => {
    popclip.showText("axios rsp:" + JSON.stringify(data));
  }).catch((error) => {
    popclip.showText("axios err:" + JSON.stringify(error));
  });

};

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
  title: "Luping's Remark",
  icon: "iconify:mingcute:quill-pen-line'",
  code: digest
}

