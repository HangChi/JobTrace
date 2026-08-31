export type RecruitmentDirectoryChannel = "official_site" | "wechat";

export type DefaultCompanyDirectoryEntry = {
  identityKey: string;
  companyName: string;
  companyType: string;
  industry: string;
  channel: RecruitmentDirectoryChannel;
  channelLabel: string;
  entryUrl: string;
};

function wechatDirectory(input: {
  identityKey: string;
  companyName: string;
  companyType: string;
  industry: string;
  searchTerm?: string;
}): DefaultCompanyDirectoryEntry {
  const searchTerm = input.searchTerm ?? `${input.companyName}招聘`;
  return {
    ...input,
    channel: "wechat",
    channelLabel: `公众号搜索：${searchTerm}`,
    entryUrl: `https://weixin.sogou.com/weixin?type=1&query=${encodeURIComponent(searchTerm)}`,
  };
}

/**
 * Domestic-company recruitment directory. These entries are intentionally
 * separate from automatic sources: they expose a public recruitment-account
 * lookup without claiming that closed WeChat content has been collected.
 */
export const DEFAULT_COMPANY_DIRECTORY = [
  // Internet, software, and digital platforms
  wechatDirectory({
    identityKey: "default:bytedance-cn",
    companyName: "字节跳动",
    companyType: "民营企业",
    industry: "互联网 / 人工智能 / 内容平台",
    searchTerm: "字节跳动招聘",
  }),
  wechatDirectory({
    identityKey: "default:tencent-cn",
    companyName: "腾讯",
    companyType: "民营企业",
    industry: "互联网 / 游戏 / 云计算",
    searchTerm: "腾讯招聘",
  }),
  wechatDirectory({
    identityKey: "default:alibaba-cn",
    companyName: "阿里巴巴集团",
    companyType: "民营企业",
    industry: "互联网 / 电商 / 云计算",
    searchTerm: "阿里巴巴招聘",
  }),
  wechatDirectory({
    identityKey: "default:meituan-cn",
    companyName: "美团",
    companyType: "民营企业",
    industry: "互联网 / 本地生活 / 科技零售",
    searchTerm: "美团招聘",
  }),
  wechatDirectory({
    identityKey: "default:baidu-cn",
    companyName: "百度",
    companyType: "民营企业",
    industry: "互联网 / 人工智能 / 自动驾驶",
    searchTerm: "百度招聘",
  }),
  wechatDirectory({
    identityKey: "default:jd-cn",
    companyName: "京东集团",
    companyType: "民营企业",
    industry: "电商 / 物流 / 科技",
    searchTerm: "京东招聘",
  }),
  wechatDirectory({
    identityKey: "default:kuaishou-cn",
    companyName: "快手",
    companyType: "上市公司",
    industry: "互联网 / 短视频 / 直播",
    searchTerm: "快手招聘",
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
] as const satisfies readonly DefaultCompanyDirectoryEntry[];

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
