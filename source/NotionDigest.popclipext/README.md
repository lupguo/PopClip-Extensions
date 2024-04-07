## Params Configure

Notion Digest 包含参数:

- **secrets**: Notion's secret, Obtain a Secrets from: https://www.notion.so/my-integrations
- **pageId**: Save digest content to this page id, which can be got from url by action `copylink`
- **blockId**: Save digest content after this block id: https://developers.notion.com/reference/patch-block-children

## How to get thest params

### Notion's Secret

Obtain a Secrets from: https://www.notion.so/my-integrations

### PageID

首先要获取一个页面ID，再通过copy link → 转uuid得到页面的ID，提取页面pageId信息 `fac77968cbd4410ea2204aafc7063807`

### BlockID

```shell
curl "https://api.notion.com/v1/blocks/{pageId}/children?page_size=1" \
-H 'Authorization: Bearer {Your_Notion_Secret}' \
-H 'Notion-Version: 2022-06-28'
```

**Response**

get first blockId `8fefee27-d477-44b1-aeea-f9cd5a5814c2`

```json
{
  "object": "list",
  "results": [
    {
      "object": "block",
      "id": "8fefee27-d477-44b1-aeea-f9cd5a5814c2",
      "parent": {
        "type": "page_id",
        "page_id": "fac77968-cbd4-410e-a220-4aafc7063807"
      }
      ...
    }
  ],
  "request_id": "58ee3246-84c5-432b-a018-3834dc3c5de2"
}
```