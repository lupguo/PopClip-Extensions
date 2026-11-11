开发一款popclip插件wisdom，支持将选择的内容通过远程API接口保存到服务端，要求：

1. Data内容部分的sentence为选择的文本，refer_url选取当前Sentence来源，Speaker支持用户输入，默认为空
2. 需要注意对选中的内容进行特殊字符处理（多余空格、Tab、换行符号），调试过程可以日志打印出来
3. 图标从iconify上选择一个和Wisdom相关的图标
4. POST的域名HOST可以支持PopClip选项配置，方便后续动态修改，默认值可以使用 https://wisdom.archstat.com

**远程API接口如下**:
axios({
	"method": "POST",
	"url": HOST+"/api/wisdom",
	"headers": {
		"Content-Type": "application/json"
	},
	"data": {
		"speaker": "《热辣滚烫 - 希林娜依·高》",
		"refer_url": "https://www.digitaling.com/articles/1288090.html",
		"sentence": "人生啊，只有这一次，现在我要好好珍惜，更快乐就有意义，怎么活我自己决定"
	}
})
