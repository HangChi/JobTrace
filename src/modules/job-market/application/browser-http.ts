// 公开搜索引擎/招聘站点请求共用的浏览器伪装头。
// 两处采集器（微信文章、公司官网研究）必须保持一致，
// 各搜索引擎按 UA+语言指纹做风控。
export const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "accept-language": "zh-CN,zh;q=0.9",
} as const;
