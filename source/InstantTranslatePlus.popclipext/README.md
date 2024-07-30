
## lang.json
// build the language list from the json file
// To fetch latest: `curl https://api.cognitive.microsofttranslator.com/languages\?api-version\=3.0\&scope\=translation > langs.json`

## Simplified JSON
```json
{
  "translation": {
    "en": {
      "name": "English",
      "nativeName": "English",
      "dir": "ltr"
    },
    "zh-Hans": {
      "name": "Chinese Simplified",
      "nativeName": "中文 (简体)",
      "dir": "ltr"
    },
    "zh-Hant": {
      "name": "Chinese Traditional",
      "nativeName": "繁體中文 (繁體)",
      "dir": "ltr"
    }
  }
}
```