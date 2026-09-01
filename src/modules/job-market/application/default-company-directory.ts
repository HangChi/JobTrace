import { DEFAULT_SOURCE_CATALOG } from "./default-source-catalog";
import recentWechatArticles from "./recent-wechat-articles.json";

export type RecruitmentDirectoryChannel = "official_site" | "wechat";

export type DefaultCompanyDirectoryEntry = {
  identityKey: string;
  companyName: string;
  companyType: string;
  industry: string;
  channel: RecruitmentDirectoryChannel;
  channelLabel: string;
  entryUrl: string;
  publishedAt?: string | null;
};

const recentWechatArticleByCompany = new Map(
  recentWechatArticles.map((article) => [article.companyName, article]),
);

function wechatDirectory(input: {
  identityKey: string;
  companyName: string;
  companyType: string;
  industry: string;
  searchTerm?: string;
}): DefaultCompanyDirectoryEntry | null {
  const article = recentWechatArticleByCompany.get(input.companyName);
  if (!article) return null;
  return {
    ...input,
    channel: "wechat",
    channelLabel: "公众号招聘原文",
    entryUrl: article.articleUrl,
    publishedAt: article.publishedAt,
  };
}

function officialDirectory(input: {
  identityKey: string;
  companyName: string;
  companyType: string;
  industry: string;
  entryUrl: string;
}): DefaultCompanyDirectoryEntry {
  return {
    ...input,
    channel: "official_site",
    channelLabel: "官方招聘网站",
  };
}

const ADDITIONAL_WECHAT_COMPANIES = [
  // Internet, enterprise software, AI, and digital services
  ["ant-group-cn", "蚂蚁集团", "民营企业", "金融科技 / 人工智能"],
  ["cainiao-cn", "菜鸟集团", "民营企业", "智慧物流 / 供应链科技"],
  ["alibaba-cloud-cn", "阿里云", "民营企业", "云计算 / 人工智能"],
  ["jd-logistics-cn", "京东物流", "上市公司", "物流 / 供应链科技"],
  ["jd-technology-cn", "京东科技", "民营企业", "金融科技 / 企业服务"],
  ["qunar-cn", "去哪儿旅行", "民营企业", "在线旅游 / 互联网"],
  ["autohome-cn", "汽车之家", "上市公司", "汽车互联网 / 内容平台"],
  ["sohu-cn", "搜狐", "上市公司", "互联网 / 媒体"],
  ["weibo-cn", "微博", "上市公司", "互联网 / 社交媒体"],
  ["58-cn", "58同城", "民营企业", "互联网 / 本地生活"],
  ["ke-cn", "贝壳找房", "上市公司", "居住服务 / 互联网"],
  ["lalamove-cn", "货拉拉", "民营企业", "物流 / 互联网"],
  ["hello-inc-cn", "哈啰", "民营企业", "智慧出行 / 本地生活"],
  ["pony-ai-cn", "小马智行", "上市公司", "自动驾驶 / 人工智能"],
  ["momenta-cn", "Momenta", "民营企业", "自动驾驶 / 人工智能"],
  ["horizon-robotics-cn", "地平线", "上市公司", "智能驾驶 / AI芯片"],
  ["black-sesame-cn", "黑芝麻智能", "上市公司", "智能驾驶 / AI芯片"],
  ["sensetime-cn", "商汤科技", "上市公司", "人工智能 / 计算机视觉"],
  ["megvii-cn", "旷视科技", "民营企业", "人工智能 / 计算机视觉"],
  ["cloudwalk-cn", "云从科技", "上市公司", "人工智能 / 计算机视觉"],
  ["4paradigm-cn", "第四范式", "上市公司", "人工智能 / 企业软件"],
  ["kingsoft-cn", "金山软件", "上市公司", "软件 / 云计算 / 游戏"],
  ["yonyou-cn", "用友网络", "上市公司", "企业软件 / 云服务"],
  ["kingdee-cn", "金蝶国际", "上市公司", "企业软件 / 云服务"],
  ["inspur-cn", "浪潮集团", "国有企业", "云计算 / 服务器 / 软件"],
  ["neusoft-cn", "东软集团", "上市公司", "软件服务 / 医疗科技"],
  ["sinosoft-cn", "中科软", "上市公司", "行业软件 / 数字化服务"],
  ["hundsun-cn", "恒生电子", "上市公司", "金融科技 / 软件"],
  ["10jqka-cn", "同花顺", "上市公司", "金融科技 / 互联网"],
  ["eastmoney-cn", "东方财富", "上市公司", "金融科技 / 证券"],
  ["hikvision-cn", "海康威视", "国有企业", "智能物联 / 计算机视觉"],
  ["dahua-cn", "大华股份", "上市公司", "智能物联 / 计算机视觉"],
  ["sangfor-cn", "深信服", "上市公司", "网络安全 / 云计算"],
  ["qianxin-cn", "奇安信", "上市公司", "网络安全 / 企业服务"],
  ["asiainfo-cn", "亚信科技", "上市公司", "通信软件 / 数字化服务"],
  ["fiberhome-info-cn", "光迅科技", "国有企业", "光通信 / 半导体"],
  ["navinfo-cn", "四维图新", "上市公司", "智能汽车 / 地图数据"],
  ["unionpay-data-cn", "银联数据", "国有企业", "金融科技 / 支付"],
  ["tonghuashun-ai-cn", "思必驰", "民营企业", "人工智能 / 智能语音"],

  // Semiconductors, electronics, advanced manufacturing, and energy technology
  ["hygon-cn", "海光信息", "国有企业", "半导体 / 处理器"],
  ["loongson-cn", "龙芯中科", "国有企业", "半导体 / 处理器"],
  ["montage-cn", "澜起科技", "上市公司", "半导体 / 互连芯片"],
  ["gigadevice-cn", "兆易创新", "上市公司", "半导体 / 存储芯片"],
  ["goodix-cn", "汇顶科技", "上市公司", "半导体 / 传感器"],
  ["sgmicro-cn", "圣邦股份", "上市公司", "模拟芯片 / 半导体"],
  ["naura-cn", "北方华创", "国有企业", "半导体设备 / 高端制造"],
  ["amec-cn", "中微公司", "上市公司", "半导体设备 / 高端制造"],
  ["acmrcsh-cn", "盛美上海", "上市公司", "半导体设备 / 高端制造"],
  ["empyrean-cn", "华大九天", "国有企业", "EDA / 集成电路"],
  ["verisilicon-cn", "芯原股份", "上市公司", "芯片设计 / IP服务"],
  ["silan-cn", "士兰微", "上市公司", "半导体 / 功率器件"],
  ["yandong-cn", "燕东微", "国有企业", "半导体 / 晶圆制造"],
  ["tongfu-cn", "通富微电", "上市公司", "半导体 / 封装测试"],
  ["jcet-cn", "长电科技", "上市公司", "半导体 / 封装测试"],
  ["goertek-cn", "歌尔股份", "上市公司", "消费电子 / 声学 / XR"],
  ["luxshare-cn", "立讯精密", "上市公司", "电子制造 / 消费电子"],
  ["lens-cn", "蓝思科技", "上市公司", "消费电子 / 智能制造"],
  ["lingyi-cn", "领益智造", "上市公司", "电子制造 / 精密结构件"],
  ["sunwoda-cn", "欣旺达", "上市公司", "锂电池 / 新能源"],
  ["eve-energy-cn", "亿纬锂能", "上市公司", "锂电池 / 新能源"],
  ["gotion-cn", "国轩高科", "上市公司", "动力电池 / 新能源"],
  ["sungrow-cn", "阳光电源", "上市公司", "光伏 / 储能 / 新能源"],
  ["longi-cn", "隆基绿能", "上市公司", "光伏 / 新能源"],
  ["jinko-cn", "晶科能源", "上市公司", "光伏 / 新能源"],
  ["trina-cn", "天合光能", "上市公司", "光伏 / 储能"],
  ["tongwei-cn", "通威集团", "民营企业", "光伏 / 农牧 / 新能源"],
  ["envision-cn", "远景科技集团", "民营企业", "风电 / 储能 / 新能源"],
  ["goldwind-cn", "金风科技", "上市公司", "风电 / 新能源"],
  ["mingyang-cn", "明阳智能", "上市公司", "风电 / 新能源"],
  ["xcmg-cn", "徐工集团", "国有企业", "工程机械 / 智能制造"],
  ["sany-cn", "三一集团", "民营企业", "工程机械 / 智能制造"],
  ["zoomlion-cn", "中联重科", "国有企业", "工程机械 / 智能制造"],
  ["weichai-cn", "潍柴动力", "国有企业", "动力系统 / 智能制造"],
  ["crrc-times-cn", "时代电气", "国有企业", "轨道交通 / 功率半导体"],

  // Automotive and mobility supply chain
  ["jac-cn", "江汽集团", "国有企业", "汽车 / 新能源"],
  ["baic-cn", "北汽集团", "国有企业", "汽车 / 新能源"],
  ["faw-jiefang-cn", "一汽解放", "国有企业", "商用车 / 智能制造"],
  ["yutong-cn", "宇通集团", "民营企业", "商用车 / 新能源"],
  ["fuyao-cn", "福耀集团", "上市公司", "汽车零部件 / 玻璃"],
  ["joyson-cn", "均胜电子", "上市公司", "汽车电子 / 智能安全"],
  ["desay-sv-cn", "德赛西威", "国有企业", "汽车电子 / 智能驾驶"],
  ["hirain-cn", "经纬恒润", "上市公司", "汽车电子 / 智能驾驶"],
  ["huayu-cn", "华域汽车", "国有企业", "汽车零部件 / 智能制造"],
  ["zeekr-cn", "极氪", "上市公司", "新能源汽车 / 智能驾驶"],
  ["avatr-cn", "阿维塔科技", "国有企业", "新能源汽车 / 智能驾驶"],
  ["deepal-cn", "深蓝汽车", "国有企业", "新能源汽车 / 智能驾驶"],
  ["neusoft-reach-cn", "东软睿驰", "民营企业", "汽车软件 / 智能驾驶"],
  ["minth-cn", "敏实集团", "上市公司", "汽车零部件 / 智能制造"],
  ["wuling-cn", "上汽通用五菱", "国有企业", "汽车 / 新能源"],
  ["dongfeng-nissan-cn", "东风日产", "合资企业", "汽车 / 智能制造"],
  ["gac-toyota-cn", "广汽丰田", "合资企业", "汽车 / 新能源"],
  ["faw-volkswagen-cn", "一汽-大众", "合资企业", "汽车 / 智能制造"],

  // Consumer, retail, food, and lifestyle
  ["nongfu-cn", "农夫山泉", "上市公司", "饮料 / 消费品"],
  ["haday-cn", "海天味业", "上市公司", "食品 / 消费品"],
  ["eastroc-cn", "东鹏饮料", "上市公司", "饮料 / 消费品"],
  ["tsingtao-cn", "青岛啤酒", "国有企业", "食品 / 啤酒"],
  ["cr-beer-cn", "华润啤酒", "国有企业", "食品 / 啤酒"],
  ["moutai-cn", "贵州茅台", "国有企业", "食品 / 白酒"],
  ["wuliangye-cn", "五粮液", "国有企业", "食品 / 白酒"],
  ["luzhou-laojiao-cn", "泸州老窖", "国有企业", "食品 / 白酒"],
  ["haid-cn", "海大集团", "上市公司", "农牧 / 食品"],
  ["wens-cn", "温氏股份", "上市公司", "农牧 / 食品"],
  ["muyuan-cn", "牧原股份", "上市公司", "农牧 / 食品"],
  ["shuanghui-cn", "双汇发展", "上市公司", "食品 / 消费品"],
  ["yuanqisenlin-cn", "元气森林", "民营企业", "饮料 / 新消费"],
  ["miniso-cn", "名创优品", "上市公司", "零售 / 消费品"],
  ["luckin-cn", "瑞幸咖啡", "民营企业", "餐饮 / 新零售"],
  ["mixue-cn", "蜜雪冰城", "上市公司", "餐饮 / 茶饮"],
  ["chagee-cn", "霸王茶姬", "上市公司", "餐饮 / 茶饮"],
  ["nayuki-cn", "奈雪的茶", "上市公司", "餐饮 / 茶饮"],
  ["heytea-cn", "喜茶", "民营企业", "餐饮 / 茶饮"],
  ["jiumaojiu-cn", "九毛九集团", "上市公司", "餐饮 / 消费服务"],
  ["youngor-cn", "雅戈尔集团", "上市公司", "服装 / 零售"],
  ["bosideng-cn", "波司登", "上市公司", "服装 / 零售"],
  ["semir-cn", "森马服饰", "上市公司", "服装 / 零售"],
  ["liby-cn", "立白集团", "民营企业", "日化 / 消费品"],
  ["proya-cn", "珀莱雅", "上市公司", "美妆 / 消费品"],

  // Healthcare and life sciences
  ["hengrui-cn", "恒瑞医药", "上市公司", "医药研发 / 生命科学"],
  ["beigene-cn", "百济神州", "上市公司", "创新药 / 生命科学"],
  ["fosun-pharma-cn", "复星医药", "上市公司", "医药 / 医疗服务"],
  ["cspc-cn", "石药集团", "上市公司", "医药研发 / 生命科学"],
  ["qilu-pharma-cn", "齐鲁制药", "民营企业", "医药研发 / 生产"],
  ["cttq-cn", "正大天晴", "民营企业", "医药研发 / 生命科学"],
  ["united-imaging-cn", "联影医疗", "上市公司", "医疗器械 / 人工智能"],
  ["yuyue-cn", "鱼跃医疗", "上市公司", "医疗器械 / 健康科技"],
  ["aier-cn", "爱尔眼科", "上市公司", "医疗服务 / 眼科"],
  ["tigermed-cn", "泰格医药", "上市公司", "临床研究 / 医药服务"],
  ["pharmaron-cn", "康龙化成", "上市公司", "医药研发服务 / 生命科学"],
  ["asymchem-cn", "凯莱英", "上市公司", "医药研发服务 / 生命科学"],
  ["innovent-cn", "信达生物", "上市公司", "创新药 / 生命科学"],
  ["zai-lab-cn", "再鼎医药", "上市公司", "创新药 / 生命科学"],
  ["hygeia-cn", "海吉亚医疗", "上市公司", "医疗服务 / 肿瘤医疗"],

  // Banks, securities, and insurance
  ["psbc-cn", "中国邮政储蓄银行", "中央企业", "银行 / 金融科技"],
  ["cmbc-cn", "中国民生银行", "上市公司", "银行 / 金融科技"],
  ["ceb-cn", "中国光大银行", "中央企业", "银行 / 金融科技"],
  ["hxb-cn", "华夏银行", "国有企业", "银行 / 金融科技"],
  ["cgb-cn", "广发银行", "国有企业", "银行 / 金融科技"],
  ["czbank-cn", "浙商银行", "国有企业", "银行 / 金融科技"],
  ["bank-of-beijing-cn", "北京银行", "国有企业", "银行 / 金融科技"],
  ["bank-of-nanjing-cn", "南京银行", "国有企业", "银行 / 金融科技"],
  ["bank-of-ningbo-cn", "宁波银行", "上市公司", "银行 / 金融科技"],
  ["pingan-bank-cn", "平安银行", "上市公司", "银行 / 金融科技"],
  ["citic-securities-cn", "中信证券", "中央企业", "证券 / 金融科技"],
  ["htsc-cn", "华泰证券", "国有企业", "证券 / 金融科技"],
  ["gtja-cn", "国泰海通证券", "国有企业", "证券 / 金融科技"],
  ["cmschina-cn", "招商证券", "中央企业", "证券 / 金融科技"],
  ["gf-securities-cn", "广发证券", "上市公司", "证券 / 金融科技"],
  ["orient-securities-cn", "东方证券", "国有企业", "证券 / 金融科技"],
  ["china-life-cn", "中国人寿", "中央企业", "保险 / 金融科技"],
  ["cpic-cn", "中国太保", "国有企业", "保险 / 金融科技"],
  ["new-china-life-cn", "新华保险", "中央企业", "保险 / 金融科技"],
  ["picc-cn", "中国人保", "中央企业", "保险 / 金融科技"],

  // Central and large state-owned enterprises
  ["china-post-cn", "中国邮政集团", "中央企业", "邮政 / 物流 / 金融"],
  ["crrc-cn", "中国中车", "中央企业", "轨道交通 / 高端制造"],
  ["ccteg-cn", "中国交建", "中央企业", "基建 / 工程建设"],
  ["ceec-cn", "中国能建", "中央企业", "能源工程 / 基础设施"],
  ["powerchina-cn", "中国电建", "中央企业", "能源工程 / 基础设施"],
  ["cnnc-cn", "中国核工业集团", "中央企业", "核能 / 高端制造"],
  ["chng-cn", "中国华能", "中央企业", "电力 / 新能源"],
  ["chn-energy-cn", "国家能源集团", "中央企业", "能源 / 电力"],
  ["chd-cn", "中国华电", "中央企业", "电力 / 新能源"],
  ["spic-cn", "国家电投", "中央企业", "电力 / 新能源"],
  ["ctg-cn", "中国三峡集团", "中央企业", "水电 / 新能源"],
  ["baowu-cn", "中国宝武", "中央企业", "钢铁 / 新材料"],
  ["ansteel-cn", "鞍钢集团", "中央企业", "钢铁 / 新材料"],
  ["hbisco-cn", "河钢集团", "国有企业", "钢铁 / 新材料"],
  ["chalco-cn", "中国铝业集团", "中央企业", "有色金属 / 新材料"],
  ["minmetals-cn", "中国五矿", "中央企业", "金属矿产 / 新材料"],
  ["sinomach-cn", "国机集团", "中央企业", "机械工业 / 工程服务"],
  ["crsc-cn", "中国通号", "中央企业", "轨道交通 / 信息控制"],
  ["comac-cn", "中国商飞", "中央企业", "航空 / 高端制造"],
  ["aecc-cn", "中国航发", "中央企业", "航空发动机 / 高端制造"],
  ["norinco-cn", "中国兵器工业集团", "中央企业", "高端装备 / 新材料"],
  ["csgc-cn", "中国兵器装备集团", "中央企业", "汽车 / 高端装备"],
  ["crta-cn", "中国融通集团", "中央企业", "资产经营 / 综合服务"],
  ["chinalogistics-cn", "中国物流集团", "中央企业", "物流 / 供应链"],
  ["sinochem-cn", "中国中化", "中央企业", "化工 / 农业科技"],
  ["cofco-cn", "中粮集团", "中央企业", "农业 / 食品 / 消费品"],
  ["crc-cn", "华润集团", "中央企业", "消费 / 医药 / 能源"],
  ["cmhk-cn", "招商局集团", "中央企业", "交通物流 / 金融 / 城市开发"],
  ["poly-cn", "保利集团", "中央企业", "城市开发 / 文化 / 工程"],
  ["china-resources-land-cn", "华润置地", "国有企业", "城市开发 / 商业运营"],
] as const;

/**
 * Domestic-company recruitment directory. These entries are intentionally
 * separate from automatic sources: they expose a public recruitment-account
 * lookup without claiming that closed WeChat content has been collected.
 */
const CURATED_COMPANY_DIRECTORY = [
  // Internet, software, and digital platforms
  officialDirectory({
    identityKey: "default:bytedance-cn",
    companyName: "字节跳动",
    companyType: "民营企业",
    industry: "互联网 / 人工智能 / 内容平台",
    entryUrl: "https://jobs.bytedance.com/campus/",
  }),
  officialDirectory({
    identityKey: "default:tencent-cn",
    companyName: "腾讯",
    companyType: "民营企业",
    industry: "互联网 / 游戏 / 云计算",
    entryUrl: "https://careers.tencent.com/",
  }),
  wechatDirectory({
    identityKey: "default:alibaba-cn",
    companyName: "阿里巴巴集团",
    companyType: "民营企业",
    industry: "互联网 / 电商 / 云计算",
    searchTerm: "阿里巴巴招聘",
  }),
  officialDirectory({
    identityKey: "default:meituan-cn",
    companyName: "美团",
    companyType: "民营企业",
    industry: "互联网 / 本地生活 / 科技零售",
    entryUrl: "https://zhaopin.meituan.com/",
  }),
  officialDirectory({
    identityKey: "default:baidu-cn",
    companyName: "百度",
    companyType: "民营企业",
    industry: "互联网 / 人工智能 / 自动驾驶",
    entryUrl: "https://talent.baidu.com/jobs/list",
  }),
  officialDirectory({
    identityKey: "default:jd-cn",
    companyName: "京东集团",
    companyType: "民营企业",
    industry: "电商 / 物流 / 科技",
    entryUrl: "https://zhaopin.jd.com/",
  }),
  officialDirectory({
    identityKey: "default:kuaishou-cn",
    companyName: "快手",
    companyType: "上市公司",
    industry: "互联网 / 短视频 / 直播",
    entryUrl: "https://zhaopin.kuaishou.cn/",
  }),
  wechatDirectory({
    identityKey: "default:didi-cn",
    companyName: "滴滴",
    companyType: "民营企业",
    industry: "智慧出行 / 互联网",
    searchTerm: "滴滴招聘",
  }),
  wechatDirectory({
    identityKey: "default:netease-cn",
    companyName: "网易",
    companyType: "上市公司",
    industry: "互联网 / 游戏 / 教育科技",
    searchTerm: "网易招聘",
  }),
  wechatDirectory({
    identityKey: "default:bilibili-cn",
    companyName: "哔哩哔哩",
    companyType: "上市公司",
    industry: "互联网 / 视频 / 内容社区",
    searchTerm: "哔哩哔哩招聘",
  }),
  wechatDirectory({
    identityKey: "default:pdd-cn",
    companyName: "拼多多",
    companyType: "上市公司",
    industry: "电商 / 互联网",
    searchTerm: "拼多多招聘",
  }),
  wechatDirectory({
    identityKey: "default:trip-cn",
    companyName: "携程集团",
    companyType: "上市公司",
    industry: "在线旅游 / 互联网",
    searchTerm: "携程招聘",
  }),
  wechatDirectory({
    identityKey: "default:360-cn",
    companyName: "三六零",
    companyType: "上市公司",
    industry: "网络安全 / 互联网",
    searchTerm: "360招聘",
  }),
  wechatDirectory({
    identityKey: "default:zhihu-cn",
    companyName: "知乎",
    companyType: "上市公司",
    industry: "互联网 / 内容社区",
    searchTerm: "知乎招聘",
  }),
  wechatDirectory({
    identityKey: "default:xiaohongshu-cn",
    companyName: "小红书",
    companyType: "民营企业",
    industry: "互联网 / 内容社区 / 电商",
    searchTerm: "小红书招聘",
  }),
  wechatDirectory({
    identityKey: "default:dewu-cn",
    companyName: "得物App",
    companyType: "民营企业",
    industry: "电商 / 潮流消费 / 互联网",
    searchTerm: "得物招聘",
  }),
  wechatDirectory({
    identityKey: "default:kingsoft-office-cn",
    companyName: "金山办公",
    companyType: "上市公司",
    industry: "办公软件 / 人工智能",
    searchTerm: "金山办公招聘",
  }),
  wechatDirectory({
    identityKey: "default:iflytek-cn",
    companyName: "科大讯飞",
    companyType: "上市公司",
    industry: "人工智能 / 智能语音",
    searchTerm: "科大讯飞招聘",
  }),
  wechatDirectory({
    identityKey: "default:tongcheng-cn",
    companyName: "同程旅行",
    companyType: "上市公司",
    industry: "在线旅游 / 互联网",
    searchTerm: "同程旅行招聘",
  }),
  wechatDirectory({
    identityKey: "default:vip-cn",
    companyName: "唯品会",
    companyType: "上市公司",
    industry: "电商 / 零售",
    searchTerm: "唯品会招聘",
  }),

  // Consumer electronics, advanced manufacturing, and semiconductors
  wechatDirectory({
    identityKey: "default:huawei-cn",
    companyName: "华为",
    companyType: "民营企业",
    industry: "通信 / 云计算 / 消费电子",
    searchTerm: "华为招聘",
  }),
  wechatDirectory({
    identityKey: "default:honor-cn",
    companyName: "荣耀终端",
    companyType: "民营企业",
    industry: "消费电子 / 智能终端",
    searchTerm: "荣耀招聘",
  }),
  wechatDirectory({
    identityKey: "default:oppo-cn",
    companyName: "OPPO",
    companyType: "民营企业",
    industry: "消费电子 / 智能终端",
    searchTerm: "OPPO招聘",
  }),
  wechatDirectory({
    identityKey: "default:vivo-cn",
    companyName: "vivo",
    companyType: "民营企业",
    industry: "消费电子 / 智能终端",
    searchTerm: "vivo招聘",
  }),
  wechatDirectory({
    identityKey: "default:dji-cn",
    companyName: "大疆创新",
    companyType: "民营企业",
    industry: "无人机 / 机器人 / 智能硬件",
    searchTerm: "DJI大疆招聘",
  }),
  wechatDirectory({
    identityKey: "default:lenovo-cn",
    companyName: "联想集团",
    companyType: "上市公司",
    industry: "计算设备 / 人工智能 / 企业服务",
    searchTerm: "联想招聘",
  }),
  wechatDirectory({
    identityKey: "default:tcl-cn",
    companyName: "TCL科技",
    companyType: "上市公司",
    industry: "显示技术 / 消费电子 / 半导体",
    searchTerm: "TCL招聘",
  }),
  wechatDirectory({
    identityKey: "default:haier-cn",
    companyName: "海尔集团",
    companyType: "民营企业",
    industry: "家电 / 智能制造 / 物联网",
    searchTerm: "海尔招聘",
  }),
  wechatDirectory({
    identityKey: "default:hisense-cn",
    companyName: "海信集团",
    companyType: "国有企业",
    industry: "家电 / 显示技术 / 智慧城市",
    searchTerm: "海信招聘",
  }),
  wechatDirectory({
    identityKey: "default:midea-cn",
    companyName: "美的集团",
    companyType: "上市公司",
    industry: "家电 / 机器人 / 智能制造",
    searchTerm: "美的招聘",
  }),
  wechatDirectory({
    identityKey: "default:gree-cn",
    companyName: "格力电器",
    companyType: "上市公司",
    industry: "家电 / 智能制造",
    searchTerm: "格力招聘",
  }),
  wechatDirectory({
    identityKey: "default:ymtc-cn",
    companyName: "长江存储",
    companyType: "国有企业",
    industry: "半导体 / 存储芯片",
    searchTerm: "长江存储招聘",
  }),
  wechatDirectory({
    identityKey: "default:cxmt-cn",
    companyName: "长鑫存储",
    companyType: "民营企业",
    industry: "半导体 / 存储芯片",
    searchTerm: "长鑫存储招聘",
  }),
  wechatDirectory({
    identityKey: "default:smic-cn",
    companyName: "中芯国际",
    companyType: "上市公司",
    industry: "半导体 / 晶圆制造",
    searchTerm: "中芯国际招聘",
  }),
  wechatDirectory({
    identityKey: "default:unisoc-cn",
    companyName: "紫光展锐",
    companyType: "民营企业",
    industry: "半导体 / 通信芯片",
    searchTerm: "紫光展锐招聘",
  }),

  // Automotive and new energy
  wechatDirectory({
    identityKey: "default:byd-cn",
    companyName: "比亚迪",
    companyType: "上市公司",
    industry: "新能源汽车 / 电池 / 电子",
    searchTerm: "比亚迪招聘",
  }),
  wechatDirectory({
    identityKey: "default:catl-cn",
    companyName: "宁德时代",
    companyType: "上市公司",
    industry: "动力电池 / 新能源",
    searchTerm: "宁德时代招聘",
  }),
  wechatDirectory({
    identityKey: "default:geely-cn",
    companyName: "吉利控股集团",
    companyType: "民营企业",
    industry: "汽车 / 新能源 / 智能出行",
    searchTerm: "吉利招聘",
  }),
  wechatDirectory({
    identityKey: "default:gwm-cn",
    companyName: "长城汽车",
    companyType: "上市公司",
    industry: "汽车 / 新能源 / 智能驾驶",
    searchTerm: "长城汽车招聘",
  }),
  wechatDirectory({
    identityKey: "default:chery-cn",
    companyName: "奇瑞汽车",
    companyType: "国有企业",
    industry: "汽车 / 新能源 / 智能制造",
    searchTerm: "奇瑞招聘",
  }),
  wechatDirectory({
    identityKey: "default:saic-cn",
    companyName: "上汽集团",
    companyType: "国有企业",
    industry: "汽车 / 新能源 / 智能制造",
    searchTerm: "上汽集团招聘",
  }),
  wechatDirectory({
    identityKey: "default:gac-cn",
    companyName: "广汽集团",
    companyType: "国有企业",
    industry: "汽车 / 新能源 / 智能出行",
    searchTerm: "广汽集团招聘",
  }),
  wechatDirectory({
    identityKey: "default:faw-cn",
    companyName: "中国一汽",
    companyType: "中央企业",
    industry: "汽车 / 新能源 / 智能制造",
    searchTerm: "中国一汽招聘",
  }),
  wechatDirectory({
    identityKey: "default:dongfeng-cn",
    companyName: "东风汽车集团",
    companyType: "中央企业",
    industry: "汽车 / 新能源 / 智能制造",
    searchTerm: "东风招聘",
  }),
  wechatDirectory({
    identityKey: "default:changan-cn",
    companyName: "长安汽车",
    companyType: "国有企业",
    industry: "汽车 / 新能源 / 智能驾驶",
    searchTerm: "长安汽车招聘",
  }),
  wechatDirectory({
    identityKey: "default:li-auto-cn",
    companyName: "理想汽车",
    companyType: "上市公司",
    industry: "新能源汽车 / 智能驾驶",
    searchTerm: "理想汽车招聘",
  }),
  wechatDirectory({
    identityKey: "default:nio-cn",
    companyName: "蔚来",
    companyType: "上市公司",
    industry: "新能源汽车 / 智能服务",
    searchTerm: "蔚来招聘",
  }),
  wechatDirectory({
    identityKey: "default:xpeng-cn",
    companyName: "小鹏汽车",
    companyType: "上市公司",
    industry: "新能源汽车 / 智能驾驶",
    searchTerm: "小鹏汽车招聘",
  }),
  wechatDirectory({
    identityKey: "default:leapmotor-cn",
    companyName: "零跑汽车",
    companyType: "上市公司",
    industry: "新能源汽车 / 智能驾驶",
    searchTerm: "零跑招聘",
  }),
  wechatDirectory({
    identityKey: "default:seres-cn",
    companyName: "赛力斯",
    companyType: "上市公司",
    industry: "新能源汽车 / 智能制造",
    searchTerm: "赛力斯招聘",
  }),

  // Finance
  wechatDirectory({
    identityKey: "default:cmb-cn",
    companyName: "招商银行",
    companyType: "上市公司",
    industry: "银行 / 金融科技",
    searchTerm: "招商银行招聘",
  }),
  wechatDirectory({
    identityKey: "default:pingan-cn",
    companyName: "中国平安",
    companyType: "上市公司",
    industry: "保险 / 银行 / 金融科技",
    searchTerm: "平安招聘",
  }),
  wechatDirectory({
    identityKey: "default:icbc-cn",
    companyName: "中国工商银行",
    companyType: "中央企业",
    industry: "银行 / 金融科技",
    searchTerm: "工商银行招聘",
  }),
  wechatDirectory({
    identityKey: "default:ccb-cn",
    companyName: "中国建设银行",
    companyType: "中央企业",
    industry: "银行 / 金融科技",
    searchTerm: "建设银行招聘",
  }),
  wechatDirectory({
    identityKey: "default:abc-cn",
    companyName: "中国农业银行",
    companyType: "中央企业",
    industry: "银行 / 金融科技",
    searchTerm: "农业银行招聘",
  }),
  wechatDirectory({
    identityKey: "default:boc-cn",
    companyName: "中国银行",
    companyType: "中央企业",
    industry: "银行 / 金融科技",
    searchTerm: "中国银行招聘",
  }),
  wechatDirectory({
    identityKey: "default:bocom-cn",
    companyName: "交通银行",
    companyType: "中央企业",
    industry: "银行 / 金融科技",
    searchTerm: "交通银行招聘",
  }),
  wechatDirectory({
    identityKey: "default:spdb-cn",
    companyName: "浦发银行",
    companyType: "国有企业",
    industry: "银行 / 金融科技",
    searchTerm: "浦发银行招聘",
  }),
  wechatDirectory({
    identityKey: "default:cib-cn",
    companyName: "兴业银行",
    companyType: "国有企业",
    industry: "银行 / 金融科技",
    searchTerm: "兴业银行招聘",
  }),
  wechatDirectory({
    identityKey: "default:citic-bank-cn",
    companyName: "中信银行",
    companyType: "中央企业",
    industry: "银行 / 金融科技",
    searchTerm: "中信银行招聘",
  }),

  // Central and state-owned enterprises
  wechatDirectory({
    identityKey: "default:state-grid-cn",
    companyName: "国家电网",
    companyType: "中央企业",
    industry: "电力 / 能源互联网",
    searchTerm: "国家电网招聘",
  }),
  wechatDirectory({
    identityKey: "default:csg-cn",
    companyName: "南方电网",
    companyType: "中央企业",
    industry: "电力 / 能源互联网",
    searchTerm: "南网招聘",
  }),
  wechatDirectory({
    identityKey: "default:china-mobile-cn",
    companyName: "中国移动",
    companyType: "中央企业",
    industry: "通信 / 云计算 / 数字服务",
    searchTerm: "中国移动招聘",
  }),
  wechatDirectory({
    identityKey: "default:china-telecom-cn",
    companyName: "中国电信",
    companyType: "中央企业",
    industry: "通信 / 云计算 / 数字服务",
    searchTerm: "中国电信招聘",
  }),
  wechatDirectory({
    identityKey: "default:china-unicom-cn",
    companyName: "中国联通",
    companyType: "中央企业",
    industry: "通信 / 云计算 / 数字服务",
    searchTerm: "中国联通招聘",
  }),
  wechatDirectory({
    identityKey: "default:cnpc-cn",
    companyName: "中国石油",
    companyType: "中央企业",
    industry: "能源 / 石油化工",
    searchTerm: "中国石油招聘",
  }),
  wechatDirectory({
    identityKey: "default:sinopec-cn",
    companyName: "中国石化",
    companyType: "中央企业",
    industry: "能源 / 石油化工",
    searchTerm: "中国石化人才招聘",
  }),
  wechatDirectory({
    identityKey: "default:cscec-cn",
    companyName: "中国建筑",
    companyType: "中央企业",
    industry: "建筑 / 基础设施",
    searchTerm: "中国建筑招聘",
  }),
  wechatDirectory({
    identityKey: "default:crec-cn",
    companyName: "中国中铁",
    companyType: "中央企业",
    industry: "基建 / 工程建设",
    searchTerm: "中国中铁招聘",
  }),
  wechatDirectory({
    identityKey: "default:crcc-cn",
    companyName: "中国铁建",
    companyType: "中央企业",
    industry: "基建 / 工程建设",
    searchTerm: "中国铁建招聘",
  }),
  wechatDirectory({
    identityKey: "default:casc-cn",
    companyName: "中国航天科技集团",
    companyType: "中央企业",
    industry: "航天 / 高端制造",
    searchTerm: "航天科技人才招聘",
  }),
  wechatDirectory({
    identityKey: "default:avic-cn",
    companyName: "中国航空工业集团",
    companyType: "中央企业",
    industry: "航空 / 高端制造",
    searchTerm: "航空工业招聘",
  }),
  wechatDirectory({
    identityKey: "default:cssc-cn",
    companyName: "中国船舶集团",
    companyType: "中央企业",
    industry: "船舶 / 海洋工程 / 高端制造",
    searchTerm: "中国船舶招聘",
  }),
  wechatDirectory({
    identityKey: "default:cec-cn",
    companyName: "中国电子",
    companyType: "中央企业",
    industry: "电子信息 / 网络安全",
    searchTerm: "中国电子招聘",
  }),
  wechatDirectory({
    identityKey: "default:cetc-cn",
    companyName: "中国电科",
    companyType: "中央企业",
    industry: "电子信息 / 科研 / 高端制造",
    searchTerm: "中国电科招聘",
  }),

  // Logistics, consumer, and healthcare
  wechatDirectory({
    identityKey: "default:sf-cn",
    companyName: "顺丰控股",
    companyType: "上市公司",
    industry: "物流 / 供应链 / 科技",
    searchTerm: "顺丰招聘",
  }),
  wechatDirectory({
    identityKey: "default:boe-cn",
    companyName: "京东方",
    companyType: "上市公司",
    industry: "显示技术 / 物联网 / 半导体",
    searchTerm: "京东方招聘",
  }),
  wechatDirectory({
    identityKey: "default:yili-cn",
    companyName: "伊利集团",
    companyType: "上市公司",
    industry: "食品 / 乳业 / 消费品",
    searchTerm: "伊利招聘",
  }),
  wechatDirectory({
    identityKey: "default:mengniu-cn",
    companyName: "蒙牛集团",
    companyType: "国有企业",
    industry: "食品 / 乳业 / 消费品",
    searchTerm: "蒙牛招聘",
  }),
  wechatDirectory({
    identityKey: "default:haidilao-cn",
    companyName: "海底捞",
    companyType: "上市公司",
    industry: "餐饮 / 消费服务",
    searchTerm: "海底捞招聘",
  }),
  wechatDirectory({
    identityKey: "default:pop-mart-cn",
    companyName: "泡泡玛特",
    companyType: "上市公司",
    industry: "文创 / 潮流消费 / 零售",
    searchTerm: "泡泡玛特招聘",
  }),
  wechatDirectory({
    identityKey: "default:anta-cn",
    companyName: "安踏集团",
    companyType: "上市公司",
    industry: "运动消费 / 零售",
    searchTerm: "安踏招聘",
  }),
  wechatDirectory({
    identityKey: "default:lining-cn",
    companyName: "李宁公司",
    companyType: "上市公司",
    industry: "运动消费 / 零售",
    searchTerm: "李宁招聘",
  }),
  wechatDirectory({
    identityKey: "default:wuxi-apptec-cn",
    companyName: "药明康德",
    companyType: "上市公司",
    industry: "医药研发 / 生命科学",
    searchTerm: "药明康德招聘",
  }),
  wechatDirectory({
    identityKey: "default:mindray-cn",
    companyName: "迈瑞医疗",
    companyType: "上市公司",
    industry: "医疗器械 / 生命科学",
    searchTerm: "迈瑞招聘",
  }),
  ...ADDITIONAL_WECHAT_COMPANIES.map(
    ([identityKey, companyName, companyType, industry]) =>
      wechatDirectory({
        identityKey: `default:${identityKey}`,
        companyName,
        companyType,
        industry,
      }),
  ),
];

function isDirectoryEntry(
  entry: DefaultCompanyDirectoryEntry | null,
): entry is DefaultCompanyDirectoryEntry {
  return entry !== null;
}

function inferCompanyType(industries: string[]) {
  if (industries.some((industry) => /国央企|央企|国企/.test(industry)))
    return "国有企业";
  if (industries.includes("外企")) return "外企";
  if (industries.includes("事业单位")) return "事业单位";
  return "企业";
}

const automaticIdentityKeys = new Set(
  DEFAULT_SOURCE_CATALOG.map((entry) => entry.identityKey),
);
const automaticCompanyNames = new Set(
  DEFAULT_SOURCE_CATALOG.map((entry) => entry.companyName),
);
const curatedDirectory = CURATED_COMPANY_DIRECTORY.filter(
  isDirectoryEntry,
).filter(
  (entry) =>
    !automaticIdentityKeys.has(entry.identityKey) &&
    !automaticCompanyNames.has(entry.companyName),
);
const existingCompanyNames = new Set([
  ...DEFAULT_SOURCE_CATALOG.map((entry) => entry.companyName),
  ...curatedDirectory.map((entry) => entry.companyName),
]);

export const DEFAULT_COMPANY_DIRECTORY = [
  ...curatedDirectory,
  ...recentWechatArticles
    .filter((article) => !existingCompanyNames.has(article.companyName))
    .map((article): DefaultCompanyDirectoryEntry => ({
      identityKey: `default:wechat-article:${article.companyName}`,
      companyName: article.companyName,
      companyType: inferCompanyType(article.industries),
      industry: article.industries.join(" / ") || "综合行业",
      channel: "wechat",
      channelLabel: "公众号招聘原文",
      entryUrl: article.articleUrl,
      publishedAt: article.publishedAt,
    })),
] satisfies readonly DefaultCompanyDirectoryEntry[];

export function publicDefaultCompanyDirectory() {
  return DEFAULT_COMPANY_DIRECTORY.map(
    ({ companyName, industry, channel, channelLabel, entryUrl }) => ({
      companyName,
      industry,
      channel,
      channelLabel,
      websiteUrl: entryUrl,
    }),
  );
}
