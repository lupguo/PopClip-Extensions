"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.action = void 0;
const axios_1 = require("axios");
const martian_1 = require("@tryfabric/martian");
// Notion Message
class Message {
    constructor(content, ctx) {
        this.content = content;
        this.ctx = ctx;
    }
    getMessageMarkdown() {
        return `**Content:** ${this.content}
      **Markdown:** ${popclip.input.markdown}
      **Refer:** ${getReference(this.ctx)}
      **LogTime:** ${formatCurrentDateTime()}
      ---
    `;
    }
}
// Notion api root
const notion = axios_1.default.create({ baseURL: 'https://api.notion.com/v1/' });
// digest is an action save awesome info from website or app to your Notion Page
const digest = (input, options, context) => {
    // format input data
    const msg = new Message(input.text, context);
    // popclip.showText("markdown: " + msg.getMessageMarkdown())
    // async send to Notion
    notion.defaults.headers.common.Authorization = `Bearer ${options.secrets}`;
    notion.defaults.headers.common['Notion-Version'] = '2022-06-28';
    // send json data
    const pageId = options.pageId;
    const blocks = (0, martian_1.markdownToBlocks)(msg.getMessageMarkdown());
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
function getReference(context) {
    let ref = context.appName.length > 0 ? context.appName : 'unknown source';
    if (context.browserUrl.length > 0) {
        ref = `[${context.browserTitle.length > 0 ? context.browserTitle : context.browserUrl}](${context.browserUrl})`;
    }
    return ref;
}
// current date & time in current locale's format
function formatCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}
exports.action = {
    title: "Luping's Remark",
    icon: "iconify:mingcute:quill-pen-line'",
    code: digest
};
