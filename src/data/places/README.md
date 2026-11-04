# 地名数据

本目录由 `scripts/build-places.mjs` 生成，**不要手改**。页面只把地名用于 H1/title/URL 关键词，不生成本地概况。

## 数据源

- 仓库：modood/Administrative-divisions-of-China
- 文件：`dist/pca-code.json`
- commit：`dc3a1d7acd85ca1b0979543e9259604142c52e8e`（2023-09-13）
- SHA-256：`83b7536f853ad16beb4d37b92890a3fd7bb9d33d4f37e7c8885fb948749a9bc4`
- 数据口径：2022-10-31（该 commit 的 README 标注；之后仓库的更新不涉及此数据文件）
- 许可：WTFPL（以数据源仓库为准）
- 生成日期：2026-11-04

## 命令

```bash
npm run gen:places
# 或指定本地缓存：
PCA_CODE_PATH=/path/to/pca-code.json npm run gen:places
```

生成脚本会校验 SHA-256；换数据源版本时必须同时更新脚本里的 `SOURCE_URL` 和 `SOURCE_SHA256`。

## 规模

- 省级：31
- 地级：333
- 县级：2843
- 合计地名页：3207（不含 `/qiming` 总入口）

硬闸门分组：

| group | 内容 | 数量 |
|---|---|---|
| 1 | 31 省级 + 27 省会 | 58 |
| 2 | 其余地级 | 306 |
| 3 | 直辖市/省会下辖区县 | 390 |
| 4 | 其余县级 | 2453 |

## 归一化规则

- 折叠 `市辖区`、`县`、`省直辖县级行政区划`、`自治区直辖县级行政区划` 分组，子节点直接挂到省/市。
- 只保留县级行政区（区/县/县级市/旗/林区/特区）；丢弃数据源里的开发区、园区、管理区、示范区等统计口径节点，以及直筒子市下的街道/镇/乡。
- 省级去 `省/市/自治区` 与民族名；地级去 `市/自治州/地区/盟` 与民族名；直辖市不设重复的市级层。
- 市辖区保留「区」；县/县级市/旗/林区/特区/行政区去后缀。
- 与父级同名（长沙县/大理市）、短名不足 2 字（单县/东区）、同级同名（伊宁市/伊宁县）时改用完整名称和完整名称拼音。
- 跨省/跨级同名：`海南藏族自治州`→`海南州`，`河南蒙古族自治县`→`河南县`。
- 多音字特例在 `scripts/place-overrides.mjs`；生成脚本同时写 `scripts/.cache/pinyin-audit.txt`（全部 path + displayName + 拼音），发布前抽查。

## 抽查记录

| path | H1 地名 |
|---|---|
| `/qiming/sichuan/chengdu` | 成都 |
| `/qiming/sichuan/nanchong/nanbu` | 南部 |
| `/qiming/beijing/dongcheng` | 东城区 |
| `/qiming/hubei/xiantao` | 仙桃 |
| `/qiming/guangdong/dongguan` | 东莞 |
| `/qiming/xinjiang/shihezi` | 石河子 |
| `/qiming/chongqing/chengkou` | 城口 |
| `/qiming/hainan/wuzhishan` | 五指山 |
| `/qiming/jilin/jilinshi` | 吉林市 |
| `/qiming/hunan/changsha/changshaxian` | 长沙县 |
| `/qiming/qinghai/hainan` | 海南州 |
| `/qiming/qinghai/huangnan/henan` | 河南县 |
| `/qiming/guangdong/guangzhou/panyu` | 番禺区 |
| `/qiming/anhui/luan` | 六安 |
| `/qiming/chongqing` | 重庆 |
| `/qiming/xinjiang/kashi` | 喀什 |
| `/qiming/xinjiang/kashi/kashishi` | 喀什市 |
| `/qiming/xinjiang/yili/yiningshi` | 伊宁市 |
| `/qiming/xinjiang/yili/yiningxian` | 伊宁县 |
| `/qiming/guangxi/guilin/longsheng` | 龙胜 |
| `/qiming/yunnan/honghe/honghexian` | 红河县 |
| `/qiming/hubei/shennongjia` | 神农架 |
| `/qiming/guizhou/liupanshui/liuzhi` | 六枝 |
| `/qiming/shanghai/pudong` | 浦东新区 |

## 已知边界

- 数据截止 2022-10-31，2023 年之后的撤县设市/设区不会出现在这里；更新需重跑生成脚本。
- 不含港澳台。
- 东莞/中山/儋州/嘉峪关等不设县级节点的地级市只生成地级页，不生成县级页。
- 东莞市、中山市等无县级节点的市在数据里标 `noCountyLevel: true`，页面不使用该字段。
