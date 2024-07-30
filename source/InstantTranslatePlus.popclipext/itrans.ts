import axios from 'axios'
import {access} from './access.json'

// the translation endpoint
const {key} = util.clarify(access)
const endpoint = axios.create({
  baseURL: 'https://api.cognitive.microsofttranslator.com',
  headers: {'Ocp-Apim-Subscription-Key': key},
  params: {'api-version': '3.0'}
})

// translate using MS Translation api
async function translate(Text: string, to: string): Promise<string> {
  const response = await endpoint.post('translate', [{Text}], {params: {to}})
  return response.data[0].translations[0].text
}

// 翻译成英文
const transToEn: ActionFunction<Options> = async (input, options) => {
  print("opts:" + JSON.stringify(options))

  return await translate(input.text, options.firstLang as string).then(translatedText => {
    popclip.showText(translatedText, {preview: true});
  })
}


// 翻译成中文
const transToZh: ActionFunction<Options> = async (input, options) => {
  print("opts:" + JSON.stringify(options))

  return await translate(input.text, options.secondLang as string).then(translatedText => {
    popclip.showText(translatedText, {preview: true});
  })
}

// export the actions'
export const actions: Action<Options>[] = [
  {
    title: "En",
    icon: "iconify:icon-park-outline:english",
    code: transToEn,
  },
  {
    title: "Zh",
    icon: "iconify:icon-park-outline:chinese",
    code: transToZh,
  },
];

export const options: Option[] = (() => {
  const opts: Option[] = [
    {
      identifier: "firstLang",
      label: "first lang(default en)",
      type: "string",
      defaultValue: "en"
    },
    {
      identifier: "secondLang",
      label: "second lang(default zh-Hans)",
      type: "string",
      defaultValue: "zh-Hans"
    }
  ]
  return opts
})()