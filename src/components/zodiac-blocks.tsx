import { Link } from "@tanstack/react-router";
import { track } from "@/lib/track";
import {
  ganzhiYearText,
  namingCtaSearch,
  termRange,
  type ZodiacAnimalEntry,
  type ZodiacChar,
  type ZodiacFaqItem,
  type ZodiacInfo,
  type ZodiacName,
  type ZodiacRound,
} from "@/lib/zodiac-guide";

/**
 * 生肖取名的共用版块（/zodiac 三族页面共享）：干支/立春/宜忌口径全部来自服务端，
 * 前端只做展示与内链；名字卡片的字段口径与灵感库一致（出处原句 + 意蕴 + 部首命中）。
 */

const ELEMENT_ZH: Record<string, string> = {
  WOOD: "木",
  FIRE: "火",
  EARTH: "土",
  METAL: "金",
  WATER: "水",
};

const cardCls = "rounded-2xl bg-white p-5 transition-colors hover:bg-vermilion-wash";
const chipOn = "rounded-full bg-vermilion-wash px-3 py-1 text-xs font-medium text-vermilion-deep";
const chipOff = "rounded-full bg-paper-3 px-3 py-1 text-xs text-ink-soft";

/** 生肖年抬头：生肖 + 干支年份 + 立春区间 + 年柱五行（年份由服务端现算，页面不写死）。 */
export function ZodiacYearHeadline({ info, current }: { info: ZodiacInfo; current?: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-seal text-4xl leading-none text-ink">{info.animal}</p>
        <p className="text-sm font-medium text-ink">{ganzhiYearText(info)}</p>
        {current ? <span className={chipOn}>当前生肖年</span> : null}
      </div>
      <p className="mt-2.5 text-xs text-ink-faint">
        生肖年以立春为界：{termRange(info)}（{info.termStartAt} 交节）
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        年柱 {info.ganzhi} · 年干 {info.stemCn}（{info.stemElement}）· 年支 {info.branchCn}（
        {info.branchElement}）
      </p>
    </>
  );
}

/** 宜用 / 忌用部首 chips（口径唯一来自引擎规则表，前台只读展示）。 */
export function ZodiacRadicalChips({ info }: { info: ZodiacInfo }) {
  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs text-ink-faint">宜用部首</span>
        {info.preferredRadicals.map((r) => (
          <span key={r} className={chipOn}>
            {r}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs text-ink-faint">忌用部首</span>
        {info.forbiddenRadicals.map((r) => (
          <span key={r} className={chipOff}>
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 宜用字举例：点击进灵感库搜该字（图上名字按包含匹配）。 */
export function ZodiacCharChips({ chars }: { chars: ZodiacChar[] }) {
  if (chars.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chars.map((c) => (
        <Link
          key={c.char}
          to="/names"
          search={{ keyword: c.char }}
          className="inline-flex items-baseline gap-1.5 rounded-xl bg-paper-2 px-3 py-1.5 transition-colors hover:bg-vermilion-wash"
        >
          <span className="font-seal text-lg leading-none text-ink">{c.char}</span>
          <span className="text-[10px] text-ink-faint">
            {c.radical}部{c.element ? ` · ${c.element}` : ""}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** 取名建议（行文取自 t_zodiac_guide，运营可改）。 */
export function ZodiacTips({ tips }: { tips: string[] }) {
  if (tips.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {tips.map((t) => (
        <li key={t} className="flex gap-2 text-sm leading-relaxed text-ink-soft text-pretty">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-vermilion" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/** 该生肖可用名字（命中喜用部首且不含忌用部首，按命中数/评分排序）。 */
export function ZodiacNameGrid({ names, empty }: { names: ZodiacName[]; empty: string }) {
  if (names.length === 0) {
    return (
      <div className="mt-4 rounded-2xl bg-white p-6 transition-colors hover:bg-vermilion-wash">
        <p className="text-sm text-ink-soft">{empty}</p>
        <Link
          to="/names"
          search={{ keyword: undefined }}
          className="mt-3 inline-block rounded-xl bg-paper-3 px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-vermilion-wash"
        >
          去名字灵感库看看 →
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {names.map((n) => {
        const elements = n.elements ?? [];
        const hits = n.hits ?? [];
        const radicals = n.radicals ?? [];
        return (
          <div key={n.word} className={cardCls}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  to="/names"
                  search={{ keyword: n.word }}
                  className="font-seal text-3xl leading-none text-ink transition-colors hover:text-vermilion-deep"
                >
                  {n.word}
                </Link>
                {n.pinyin ? (
                  <p className="mt-1.5 text-xs tracking-wider text-ink-soft">{n.pinyin}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {n.gender === "M" ? (
                  <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-paper">
                    男
                  </span>
                ) : n.gender === "F" ? (
                  <span className="rounded-full bg-vermilion px-2 py-0.5 text-[10px] font-medium text-paper">
                    女
                  </span>
                ) : null}
                {elements.slice(0, 2).map((e) =>
                  ELEMENT_ZH[e] ? (
                    <span
                      key={e}
                      className="rounded-full bg-paper-3 px-2 py-0.5 text-[10px] text-ink-soft"
                    >
                      {ELEMENT_ZH[e]}
                    </span>
                  ) : null,
                )}
                {typeof n.score === "number" ? (
                  <span className="rounded-full bg-vermilion-wash px-2 py-0.5 text-[10px] font-semibold text-vermilion-deep">
                    {n.score} 分
                  </span>
                ) : null}
              </div>
            </div>

            {hits.length > 0 ? (
              <p className="mt-2.5 text-[11px] text-vermilion-deep">
                喜用部首命中 {hits.join("／")}
                {radicals.length > 0 ? `（全字部首 ${radicals.join("／")}）` : ""}
              </p>
            ) : null}

            {n.meaning ? (
              <p className="mt-2.5 text-sm leading-relaxed text-ink-soft text-pretty">
                {n.meaning}
              </p>
            ) : null}

            {n.text || n.source ? (
              <div className="mt-3 rounded-xl bg-paper-2 p-3">
                {n.text ? (
                  <p className="text-xs leading-relaxed text-ink-soft text-pretty">{n.text}</p>
                ) : null}
                {n.source ? <p className="mt-1 text-[11px] text-ink-faint">—— {n.source}</p> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** 常见问题（行文取自 t_zodiac_guide，页面另有 FAQPage 结构化数据）。 */
export function ZodiacFaqList({ items }: { items: ZodiacFaqItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 space-y-3">
      {items.map((f) => (
        <div key={f.q} className={cardCls}>
          <p className="text-sm font-semibold">{f.q}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft text-pretty">{f.a}</p>
        </div>
      ))}
    </div>
  );
}

/** 口径与免责说明（沿用引擎合规措辞，全站统一）。 */
export function ZodiacNotice() {
  return (
    <p className="mt-4 text-xs leading-relaxed text-ink-faint text-pretty">
      生肖用字宜忌属传统取名习俗整理，不构成吉凶判断，也不是硬性禁忌；建议结合字音、字义、书写和方言谐音综合取舍。生肖年以立春为界，立春当天出生的宝宝以排盘结果为准。
    </p>
  );
}

/** 十二生肖宫格（当前生肖年高亮）。 */
export function ZodiacAnimalGrid({ animals }: { animals: ZodiacAnimalEntry[] }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {animals.map((a) => (
        <Link
          key={a.slug}
          to="/zodiac/$animal"
          params={{ animal: a.slug }}
          className={[
            "rounded-2xl p-4 text-center transition-colors hover:bg-vermilion-wash",
            a.current ? "bg-vermilion-wash" : "bg-white",
          ].join(" ")}
        >
          <p className="font-seal text-2xl leading-none text-ink">{a.animal}</p>
          <p className="mt-1.5 text-[10px] text-ink-faint">
            {a.branchCn} · {a.year}
          </p>
          {a.current ? (
            <p className="mt-1 text-[10px] font-medium text-vermilion-deep">当年</p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

/** 同一生肖的年份列表（近 6 轮 + 下一轮，每年立春自动流转）。 */
export function ZodiacYearNav({
  rounds,
  slug,
  nextRound,
}: {
  rounds: ZodiacRound[];
  slug: string;
  nextRound: number;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {rounds.map((r) => (
        <Link
          key={r.year}
          to="/zodiac/$animal/$year"
          params={{ animal: slug, year: String(r.year) }}
          className={r.current ? chipOn : chipOff}
        >
          {r.year} {r.ganzhi}
          {r.current ? " · 当年" : ""}
        </Link>
      ))}
      <Link
        to="/zodiac/$animal/$year"
        params={{ animal: slug, year: String(nextRound) }}
        className={chipOff}
      >
        下一轮 {nextRound}
      </Link>
    </div>
  );
}

/** 生肖页 → 起名页 CTA（统一口径：不改起名页搜索键，来源靠埋点区分）。 */
export function ZodiacNamingCta({ label, from }: { label: string; from: string }) {
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <Link
        to="/naming"
        search={namingCtaSearch()}
        onClick={() => track("zodiac_cta_click", { from })}
        className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
      >
        {label}
      </Link>
    </div>
  );
}
