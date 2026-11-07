/**
 * 长尾矩阵的常量：五行元素 slug、典籍类目 slug、直辖市清单。
 * 这些清单同时被路由 loader 校验、sitemap 生成与内链使用——改这里三处同步。
 */
import type { LongtailMatrix } from "./rollout";
import { TOP_SURNAMES } from "@/lib/surnames";

export const LONGTAIL_MATRICES: {
  matrix: LongtailMatrix;
  label: string;
}[] = [
  { matrix: "surname", label: "姓氏单页" },
  { matrix: "classic", label: "典籍取名页" },
  { matrix: "surnamePlace", label: "城市×姓氏页" },
  { matrix: "wuxing", label: "五行用字页" },
  { matrix: "zodiacGender", label: "生肖×性别页" },
];

/** 五行元素：slug 取拼音，element 与字库/灵感库的枚举（WOOD/FIRE/…）同口径。 */
export const WUXING_ELEMENTS: {
  slug: string;
  han: string;
  element: string;
  intro: string;
}[] = [
  {
    slug: "mu",
    han: "木",
    element: "WOOD",
    intro:
      "属木的字多带生长、舒展的意象（木字旁、草字头与部分竹字头），传统上认为与春季、生发之气相应。",
  },
  {
    slug: "huo",
    han: "火",
    element: "FIRE",
    intro:
      "属火的字多带光明、温暖的意象（火字旁、日字头与部分心字底），传统上认为与夏季、炎上之气相应。",
  },
  {
    slug: "tu",
    han: "土",
    element: "EARTH",
    intro:
      "属土的字多带厚重、安稳的意象（土字旁、山字旁与部分田字旁），传统上认为与四季之末、稼穑之气相应。",
  },
  {
    slug: "jin",
    han: "金",
    element: "METAL",
    intro:
      "属金的字多带清亮、坚毅的意象（金字旁、玉字旁与部分刀字旁），传统上认为与秋季、收敛之气相应。",
  },
  {
    slug: "shui",
    han: "水",
    element: "WATER",
    intro:
      "属水的字多带流动、润泽的意象（三点水、雨字头与部分子字旁），传统上认为与冬季、闭藏之气相应。",
  },
];

export function wuxingBySlug(slug: string) {
  return WUXING_ELEMENTS.find((e) => e.slug === slug) ?? null;
}

/**
 * 典籍类目：code 与后端 classic-books 的类目编码同口径（/classic/{code}），
 * label 是页面 H1 用的通称（「世说文心」这类内部名对读者不友好，换成通称）。
 */
export const CLASSIC_CATEGORIES: { code: string; label: string; note: string }[] = [
  { code: "shijing", label: "诗经", note: "先秦四言，女性名字的经典来源" },
  { code: "chuci", label: "楚辞", note: "香草美人的意象传统，男取楚辞" },
  { code: "tangshi", label: "唐诗", note: "气象开阔，用字铿锵" },
  { code: "songci", label: "宋词", note: "音律婉转，适合女名" },
  { code: "songshi", label: "宋诗", note: "理趣与画面感并存" },
  { code: "weijin", label: "魏晋诗文", note: "世说新语与文心雕龙的清朗气度" },
  { code: "songwen", label: "宋文", note: "唐宋八大家的散文用字" },
  { code: "weijinwen", label: "魏晋文", note: "骈散相间的文人趣味" },
  { code: "zhouyi", label: "周易", note: "卦爻辞里的古雅字" },
  { code: "lunyu", label: "论语", note: "儒家名句，端方大气" },
  { code: "rujia", label: "儒家经典", note: "孟子、大学、中庸、尚书、礼记" },
  { code: "daojia", label: "道家经典", note: "道德经与庄子的自然意象" },
  { code: "shishi", label: "史书", note: "史记与资治通鉴的叙事用字" },
  { code: "zhanguoce", label: "战国策", note: "纵横家策论的雄辩之字" },
  { code: "shanhaijing", label: "山海经", note: "神话地理的奇想用字" },
  { code: "shuijingzhu", label: "水经注", note: "山水散文的地名与景物字" },
  { code: "bencaogangmu", label: "本草纲目", note: "草木鸟兽之名，清雅少见" },
  { code: "mengxue", label: "蒙学经典", note: "三字经、千字文、声律启蒙等" },
];

export function classicByCode(code: string) {
  return CLASSIC_CATEGORIES.find((c) => c.code === code) ?? null;
}

/** 直辖市：省级页兼作城市页，城市×姓氏页挂在二级路径（/qiming/beijing/wang）。 */
export const MUNICIPALITY_SLUGS = ["beijing", "shanghai", "tianjin", "chongqing"] as const;

export function isMunicipalitySlug(slug: string): boolean {
  return (MUNICIPALITY_SLUGS as readonly string[]).includes(slug);
}

/**
 * 城市×姓氏页的宿主清单（scripts 由地名数据生成，58 条）：
 * 31 个省级入口（直辖市即城市页）+ 27 个省会城市。path 是地名页规范地址，
 * 姓氏页地址 = path + "/" + 姓氏拼音。数据由 src/data/places 生成，改地名数据后需重新生成。
 */
import capitals from "@/data/places/capitals.json";

export interface SurnamePlaceHost {
  provinceSlug: string;
  display: string;
  level: "city" | "province";
  path: string;
}

export const SURNAME_PLACE_HOSTS = capitals as SurnamePlaceHost[];

/** 姓氏在 50 大姓中的位次（1 起）；城市×姓氏页按「放开前 N 大姓」截断。 */
export function surnameRank(pinyin: string): number {
  return TOP_SURNAMES.findIndex((s) => s.pinyin === pinyin) + 1;
}
