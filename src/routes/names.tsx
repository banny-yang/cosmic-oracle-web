import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader, BreadcrumbJsonLd, inputCls } from "@/components/app-shell";
import { get } from "@/lib/api";
import { sourceToCategory, categoryToExpectation } from "@/lib/gallery-signals";

export const Route = createFileRoute("/names")({
  component: NameGallery,
  // 环 1 回流深链：起名结果「灵感库同款」徽章带 ?keyword=名字 直达搜索
  validateSearch: (search: Record<string, unknown>) => ({
    keyword: typeof search["keyword"] === "string" ? search["keyword"].slice(0, 20) : undefined,
  }),
  head: () => ({
    links: [{ rel: "canonical", href: "https://www.oracle.duimai.net/names" }],
    meta: [
      { title: "名字灵感库 · 对脉名鉴" },
      {
        name: "keywords",
        content: "好名字,名字大全,诗经取名,楚辞取名,唐诗宋词取名,男孩名,女孩名",
      },
      { property: "og:url", content: "https://www.oracle.duimai.net/names" },
      {
        name: "description",
        content:
          "人工甄别的好名字灵感库：按气质风格、性别、五行、典籍出处筛选，每个名字附拼音、出处原句与意蕴。",
      },
    ],
  }),
});

interface GalleryItem {
  word: string;
  pinyin?: string | null;
  gender?: string | null;
  score?: number | null;
  source?: string | null;
  text?: string | null;
  meaning?: string | null;
  category: string;
  elements?: string[] | string | null;
}

interface GalleryPage {
  items: GalleryItem[];
  total: number;
  page: number;
  size: number;
}

interface CategoryInfo {
  categories: { category: string; count: number }[];
  genders: string[];
  elements: string[];
}

const ELEMENT_ZH: Record<string, string> = {
  WOOD: "木",
  FIRE: "火",
  EARTH: "土",
  METAL: "金",
  WATER: "水",
};

const chips = "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors";
const chipOn = "bg-ink text-paper ring-ink";
const chipOff = "bg-paper-3 text-ink-soft ring-ink/10";

function NameGallery() {
  const keywordSearch = Route.useSearch();
  const [meta, setMeta] = useState<CategoryInfo | null>(null);
  const [data, setData] = useState<GalleryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [category, setCategory] = useState("");
  const [gender, setGender] = useState("");
  const [element, setElement] = useState("");
  const [keywordInput, setKeywordInput] = useState(() => keywordSearch["keyword"] ?? "");
  const [keyword, setKeyword] = useState(() => keywordSearch["keyword"] ?? "");

  useEffect(() => {
    get<CategoryInfo>(
      "/api/v1/naming/name-gallery/categories",
      {},
      { auth: false, timeoutMs: 8000 },
    )
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get<GalleryPage>(
      "/api/v1/naming/name-gallery",
      {
        page,
        size: 20,
        ...(category ? { category } : {}),
        ...(gender ? { gender } : {}),
        ...(element ? { element } : {}),
        ...(keyword ? { keyword } : {}),
      },
      { auth: false, timeoutMs: 10000 },
    )
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, category, gender, element, keyword]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const pick = (fn: () => void) => {
    fn();
    setPage(0);
  };

  return (
    <AppShell>
      <BreadcrumbJsonLd name="名字灵感库" path="/names" />
      <PageHeader
        eyebrow="免费浏览 · 典籍甄选"
        title="名字灵感库"
        desc="人工甄别的好名字：按气质风格分类，附拼音、五行、出处原句与意蕴，喜欢哪个直接用「宝宝起名」生成完整方案。"
      />

      {/* 筛选区：分类为主轴 + 性别/五行/搜索 */}
      <section className="mt-7 space-y-3 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
        <div className="flex flex-wrap gap-2">
          <button
            className={[chips, category === "" ? chipOn : chipOff].join(" ")}
            onClick={() => pick(() => setCategory(""))}
          >
            全部分类
          </button>
          {(meta?.categories ?? [])
            .filter((c) => c.count > 0)
            .map((c) => (
              <button
                key={c.category}
                className={[chips, category === c.category ? chipOn : chipOff].join(" ")}
                onClick={() => pick(() => setCategory(c.category))}
              >
                {c.category}
                <span className="ml-1 opacity-60">{c.count}</span>
              </button>
            ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { v: "", label: "不限性别" },
            { v: "M", label: "男孩" },
            { v: "F", label: "女孩" },
          ].map((g) => (
            <button
              key={g.v}
              className={[chips, gender === g.v ? chipOn : chipOff].join(" ")}
              onClick={() => pick(() => setGender(g.v))}
            >
              {g.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-ink/10" />
          <button
            className={[chips, element === "" ? chipOn : chipOff].join(" ")}
            onClick={() => pick(() => setElement(""))}
          >
            不限五行
          </button>
          {(meta?.elements ?? []).map((e) => (
            <button
              key={e}
              className={[chips, element === e ? chipOn : chipOff].join(" ")}
              onClick={() => pick(() => setElement(e))}
            >
              {ELEMENT_ZH[e] ?? e}
            </button>
          ))}
          <input
            className={inputCls + " ml-auto max-w-44"}
            placeholder="搜名字 / 出处…"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") pick(() => setKeyword(keywordInput.trim()));
            }}
          />
        </div>
      </section>

      {/* 名字卡网格 */}
      {loading ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-paper-2 ring-1 ring-ink/5" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-paper-2 p-10 text-center ring-1 ring-ink/5">
          <p className="text-sm text-ink-soft">没有符合条件的名字，换个筛选试试。</p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {data.items.map((n) => {
              const elements = Array.isArray(n.elements)
                ? n.elements
                : typeof n.elements === "string" && n.elements
                  ? n.elements.split(",")
                  : [];
              return (
                <div key={n.word} className="rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-seal text-3xl leading-none text-ink">{n.word}</p>
                      {n.pinyin ? (
                        <p className="mt-1.5 text-xs tracking-wider text-ink-soft">{n.pinyin}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {n.gender === "M" ? (
                        <span className="rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-medium text-paper">
                          男
                        </span>
                      ) : n.gender === "F" ? (
                        <span className="rounded-full bg-vermilion px-2 py-0.5 text-[10px] font-medium text-paper">
                          女
                        </span>
                      ) : null}
                      {elements.slice(0, 2).map((e, i) =>
                        ELEMENT_ZH[e] ? (
                          <span
                            key={i}
                            className="rounded-full bg-paper-3 px-2 py-0.5 text-[10px] text-ink-soft ring-1 ring-ink/10"
                          >
                            {ELEMENT_ZH[e]}
                          </span>
                        ) : null,
                      )}
                      {typeof n.score === "number" ? (
                        <span className="rounded-full bg-vermilion/10 px-2 py-0.5 text-[10px] font-semibold text-vermilion-deep">
                          {n.score} 分
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-3 inline-block rounded-full bg-ink/[0.05] px-2.5 py-0.5 text-[11px] text-ink-soft">
                    {n.category}
                  </p>

                  {n.meaning ? (
                    <p className="mt-2.5 text-sm leading-relaxed text-ink-soft text-pretty">
                      {n.meaning}
                    </p>
                  ) : null}
                  {n.text || n.source ? (
                    <div className="mt-3 rounded-xl bg-ink/[0.04] p-3">
                      {n.text ? (
                        <p className="text-xs leading-relaxed text-ink-soft text-pretty">
                          {n.text}
                        </p>
                      ) : null}
                      {n.source ? (
                        <p className="mt-1 text-[11px] text-ink-faint">—— {n.source}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {/* 环 1：带风格信号跳起名页——偏好字 + 典籍出处 + 性别 + 气质分类 */}
                  <Link
                    to="/naming"
                    search={{
                      prefer: n.word,
                      src: sourceToCategory(n.source),
                      g: n.gender === "M" || n.gender === "F" ? n.gender : undefined,
                      cat: categoryToExpectation(n.category) ? n.category : undefined,
                    }}
                    className="mt-4 block w-full rounded-xl bg-ink py-2.5 text-center text-sm font-medium text-paper ring-1 ring-ink/40 transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    按「{n.word}」的风格起名 →
                  </Link>
                </div>
              );
            })}
          </div>

          {/* 分页 */}
          <div className="mt-6 flex items-center justify-between text-sm text-ink-faint">
            <span>共 {data.total} 个名字</span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-xl bg-paper-2 px-4 py-2 text-xs font-medium text-ink ring-1 ring-ink/10 disabled:opacity-40"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                上一页
              </button>
              <span className="tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <button
                className="rounded-xl bg-paper-2 px-4 py-2 text-xs font-medium text-ink ring-1 ring-ink/10 disabled:opacity-40"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
