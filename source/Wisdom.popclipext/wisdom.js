const axios = require("axios");

module.exports = {
    actions: [
        {
            code: async (selection, options, context) => {

                console.log("Wisdom Selection text:", selection.text);
                console.log("Wisdom Options:", options);
                console.log("Wisdom Context:", context);

                let response
                try {
                    // 对选中的内容进行处理，去除多余的空格、Tab、换行符
                    const cleanedText = selection.text
                        .replace(/\s+/g, ' ') // 替换多余空格
                        .trim(); // 去掉首尾空格

                    // 组装请求数据
                    const payload = {
                        speaker: options.speaker || "", // 默认 speaker 为空
                        refer_url: context.browser?.url || "", // 当前页面 URL
                        sentence: cleanedText,
                        skey: options.skey || "" // Include skey for API key
                    };

                    // 调试日志
                    console.log("Request payload:", payload);

                    // 发送 POST 请求
                    response = await axios({
                        method: "POST",
                        url: `${options.host}/api/wisdom`,
                        headers: {
                            "Content-Type": "application/json"
                        },
                        data: payload
                    });

                    // 请求成功后输出结果
                    popclip.showText(JSON.stringify(response.data));

                } catch (error) {
                    // 请求出错时处理
                    const errorMessage = error.response ?
                        `Err: ${error.message}, Resp: ${JSON.stringify(error.response.data)}` :
                        `Err: ${error.message}`;
                    popclip.showText(errorMessage);
                    // popclip.showText("Err:" + error + ", Resp:" + response.data);
                }
            }
        }
    ]
}