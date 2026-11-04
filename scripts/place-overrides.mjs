/**
 * 行政区划数据的少量人工覆盖。
 *
 * 这里只放机器读音/短名规则处理不好的特例；通用规则在 build-places.mjs 里。
 * 新增覆盖时请同步在 src/data/places/README.md 的抽查记录里补一行。
 */

/** 省级元数据：只用于内部 group 计算，不会输出到页面。 */
export const PROVINCE_META = {
  北京市: { capital: null, isMunicipality: true },
  天津市: { capital: null, isMunicipality: true },
  河北省: { capital: "石家庄市", isMunicipality: false },
  山西省: { capital: "太原市", isMunicipality: false },
  内蒙古自治区: { capital: "呼和浩特市", isMunicipality: false },
  辽宁省: { capital: "沈阳市", isMunicipality: false },
  吉林省: { capital: "长春市", isMunicipality: false },
  黑龙江省: { capital: "哈尔滨市", isMunicipality: false },
  上海市: { capital: null, isMunicipality: true },
  江苏省: { capital: "南京市", isMunicipality: false },
  浙江省: { capital: "杭州市", isMunicipality: false },
  安徽省: { capital: "合肥市", isMunicipality: false },
  福建省: { capital: "福州市", isMunicipality: false },
  江西省: { capital: "南昌市", isMunicipality: false },
  山东省: { capital: "济南市", isMunicipality: false },
  河南省: { capital: "郑州市", isMunicipality: false },
  湖北省: { capital: "武汉市", isMunicipality: false },
  湖南省: { capital: "长沙市", isMunicipality: false },
  广东省: { capital: "广州市", isMunicipality: false },
  广西壮族自治区: { capital: "南宁市", isMunicipality: false },
  海南省: { capital: "海口市", isMunicipality: false },
  重庆市: { capital: null, isMunicipality: true },
  四川省: { capital: "成都市", isMunicipality: false },
  贵州省: { capital: "贵阳市", isMunicipality: false },
  云南省: { capital: "昆明市", isMunicipality: false },
  西藏自治区: { capital: "拉萨市", isMunicipality: false },
  陕西省: { capital: "西安市", isMunicipality: false },
  甘肃省: { capital: "兰州市", isMunicipality: false },
  青海省: { capital: "西宁市", isMunicipality: false },
  宁夏回族自治区: { capital: "银川市", isMunicipality: false },
  新疆维吾尔自治区: { capital: "乌鲁木齐市", isMunicipality: false },
};

/** 数据源里必须恰好出现的 31 个省级节点（不含港澳台）。 */
export const EXPECTED_PROVINCES = Object.keys(PROVINCE_META);

/**
 * 短名覆盖：默认规则是去后缀/去民族名，下面这些跨省/跨级同名会撞车，
 * 改用更明确的短名。键是数据源里的完整 name。
 */
export const DISPLAY_NAME_OVERRIDES = {
  海南藏族自治州: "海南州",
  河南蒙古族自治县: "河南县",
};

/**
 * 拼音覆盖：键可以是完整 name，也可以是去后缀后的 base。
 * 只收录 pinyin-pro 会读错的地名；读对的不要重复添加，免得以后数据源修正后过时。
 */
export const PINYIN_OVERRIDES = {
  // 多音字
  乐清: "yueqing",
  乐亭: "laoting",
  蔚县: "yuxian",
  歙县: "shexian",
  筠连: "junlian",
  浚县: "xunxian",
  泌阳: "biyang",
  繁峙: "fanshi",
  洪洞: "hongtong",
  尉犁: "yuli",
  喀什: "kashi",
  喀什市: "kashishi",
  阿图什: "atushi",
  阿图什市: "atushishi",
  塔什库尔干: "tashikuergen",
  // 常见但 pinyin-pro 当前能读对的，留作回归基准（键为完整 name 或 base）
  六安: "luan",
  // 省级唯一冲突：山西 shanxi / 陕西 shaanxi（通行区分写法）
  陕西: "shaanxi",
  蚌埠: "bengbu",
  亳州: "bozhou",
  台州: "taizhou",
  丽水: "lishui",
  重庆: "chongqing",
  厦门: "xiamen",
  铅山: "yanshan",
  黟县: "yixian",
  犍为: "qianwei",
  荥经: "yingjing",
  邛崃: "qionglai",
  郫都: "pidu",
  番禺: "panyu",
  大埔: "dapu",
  东莞: "dongguan",
  儋州: "danzhou",
  嘉峪关: "jiayuguan",
  石河子: "shihezi",
  可克达拉: "kekedala",
  胡杨河: "huyanghe",
};

/** 56 个民族名，按长度降序匹配；用于剥离自治州/自治县/自治旗前的民族名。 */
export const ETHNIC_NAMES = [
  "各族",
  "维吾尔",
  "柯尔克孜",
  "乌孜别克",
  "鄂温克",
  "鄂伦春",
  "达斡尔",
  "哈萨克",
  "塔吉克",
  "俄罗斯",
  "撒拉",
  "保安",
  "裕固",
  "塔塔尔",
  "土家",
  "哈尼",
  "傈僳",
  "拉祜",
  "景颇",
  "纳西",
  "布朗",
  "毛南",
  "仡佬",
  "仫佬",
  "锡伯",
  "阿昌",
  "普米",
  "独龙",
  "赫哲",
  "门巴",
  "珞巴",
  "基诺",
  "布依",
  "朝鲜",
  "蒙古",
  "藏",
  "回",
  "苗",
  "彝",
  "壮",
  "满",
  "侗",
  "瑶",
  "白",
  "傣",
  "黎",
  "佤",
  "畲",
  "水",
  "东乡",
  "土",
  "羌",
  "怒",
  "京",
  "高山",
].sort((a, b) => b.length - a.length);
