import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { shellCls } from "@/components/app-shell";
import { cn } from "@/lib/utils";

/* ───────── 水墨幅面（内联 SVG，色值与 styles.css 主题 token 一致） ───────── */

function SlideArt({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 1600 560"
      preserveAspectRatio="xMidYMid slice"
      className="block h-full w-full"
    >
      {children}
    </svg>
  );
}

/** 典籍出处：远山层叠 · 朱日 · 竖排诗句 */
function ArtClassic() {
  const poem = ["重", "湖", "叠", "巘", "清", "嘉"];
  return (
    <SlideArt>
      <defs>
        <linearGradient id="hb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.965 0.018 92)" />
          <stop offset="1" stopColor="oklch(0.93 0.028 90)" />
        </linearGradient>
      </defs>
      <rect width="1600" height="560" fill="url(#hb-sky)" />
      {/* 朱日（居安全区内，超宽屏上下裁切不丢） */}
      <circle cx="1230" cy="215" r="46" fill="oklch(0.54 0.155 38)" opacity="0.9" />
      <circle cx="1230" cy="215" r="62" fill="oklch(0.54 0.155 38)" opacity="0.12" />
      {/* 远山三层，自左向右渐重 */}
      <path
        d="M 600 560 L 760 300 L 830 380 L 900 250 L 1010 420 L 1080 340 L 1200 560 Z"
        fill="oklch(0.28 0.02 70)"
        opacity="0.08"
      />
      <path
        d="M 860 560 L 990 240 L 1060 330 L 1150 190 L 1270 400 L 1330 320 L 1460 560 Z"
        fill="oklch(0.28 0.02 70)"
        opacity="0.14"
      />
      <path
        d="M 1100 560 L 1220 210 L 1290 300 L 1390 150 L 1520 380 L 1600 300 L 1600 560 Z"
        fill="oklch(0.28 0.02 70)"
        opacity="0.22"
      />
      {/* 雾带 */}
      <rect x="560" y="362" width="1040" height="44" fill="oklch(0.955 0.021 92)" opacity="0.55" />
      <rect x="720" y="430" width="880" height="28" fill="oklch(0.955 0.021 92)" opacity="0.4" />
      {/* 竖排诗句 */}
      {poem.map((ch, i) => (
        <text
          key={ch}
          x="1058"
          y={150 + i * 46}
          textAnchor="middle"
          fontSize="34"
          fill="oklch(0.47 0.022 75)"
          className="font-seal"
        >
          {ch}
        </text>
      ))}
    </SlideArt>
  );
}

/** 五格数理：金木水火土五行相生链 · 朱砂标记喜用 */
function ArtGrid() {
  // 横向安全区：移动端 2/1 卡片可见 x≈240-1360，需容纳整行
  const elements = [
    { ch: "金", x: 670 },
    { ch: "木", x: 805 },
    { ch: "水", x: 940, favor: true },
    { ch: "火", x: 1075 },
    { ch: "土", x: 1210 },
  ];
  const SIZE = 110;
  const TOP = 215;
  const CY = TOP + SIZE / 2;
  return (
    <SlideArt>
      <defs>
        <linearGradient id="hb-grid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.955 0.021 92)" />
          <stop offset="1" stopColor="oklch(0.928 0.03 90)" />
        </linearGradient>
      </defs>
      <rect width="1600" height="560" fill="url(#hb-grid)" />
      {/* 底纹大字（左侧，宽屏被遮罩覆盖、移动端补白） */}
      <text x="420" y="380" textAnchor="middle" fontSize="220" fill="oklch(0.28 0.02 70)" opacity="0.06" className="font-seal">
        数
      </text>
      {/* 相生链：虚线穿行五格之间 */}
      <path
        d="M 640 268 C 850 222, 1000 316, 1290 264"
        fill="none"
        stroke="oklch(0.54 0.155 38 / 0.5)"
        strokeWidth="3"
        strokeDasharray="2 10"
        strokeLinecap="round"
      />
      {elements.map((e) => (
        <g key={e.ch}>
          <rect
            x={e.x}
            y={TOP}
            width={SIZE}
            height={SIZE}
            rx="14"
            fill={e.favor ? "oklch(0.54 0.155 38)" : "oklch(0.955 0.021 92 / 0.78)"}
            stroke={e.favor ? "oklch(0.45 0.13 35 / 0.4)" : "oklch(0.28 0.02 70 / 0.16)"}
            strokeWidth="2"
          />
          <text
            x={e.x + SIZE / 2}
            y={CY + 19}
            textAnchor="middle"
            fontSize="54"
            className="font-seal"
            fill={e.favor ? "oklch(0.955 0.021 92)" : "oklch(0.28 0.02 70)"}
          >
            {e.ch}
          </text>
        </g>
      ))}
      {/* 数理点缀 */}
      <circle cx="1315" cy="170" r="5" fill="oklch(0.28 0.02 70 / 0.18)" />
      <circle cx="1390" cy="248" r="3.5" fill="oklch(0.28 0.02 70 / 0.14)" />
      <circle cx="1360" cy="120" r="3" fill="oklch(0.54 0.155 38 / 0.35)" />
    </SlideArt>
  );
}

/** 亲友共决：云纹回环 · 三点归心 */
function ArtCloud() {
  const cloud = (cx: number, cy: number, scale: number) => (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`} fill="none" stroke="oklch(0.28 0.02 70 / 0.16)" strokeWidth="3" strokeLinecap="round">
      <path d="M -80 0 q 20 -36 56 -22 q 14 -34 52 -20 q 34 10 28 42" />
      <path d="M -80 14 q 40 26 92 8 q 40 -14 66 6" />
    </g>
  );
  return (
    <SlideArt>
      <defs>
        <linearGradient id="hb-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.96 0.02 91)" />
          <stop offset="1" stopColor="oklch(0.9 0.034 89)" />
        </linearGradient>
      </defs>
      <rect width="1600" height="560" fill="url(#hb-cloud)" />
      {cloud(900, 190, 1)}
      {cloud(1250, 170, 0.8)}
      {cloud(1330, 400, 1.1)}
      {/* 三点归心：亲友之票汇于一处 */}
      {[
        { x: 880, y: 230 },
        { x: 1290, y: 220 },
        { x: 1090, y: 410 },
      ].map((p, i) => (
        <g key={i}>
          <line x1={p.x} y1={p.y} x2="1090" y2="300" stroke="oklch(0.28 0.02 70 / 0.25)" strokeWidth="2" />
          <circle cx={p.x} cy={p.y} r="9" fill="oklch(0.54 0.155 38)" opacity={0.55 + i * 0.15} />
        </g>
      ))}
      <circle cx="1090" cy="300" r="34" fill="none" stroke="oklch(0.54 0.155 38 / 0.5)" strokeWidth="3" />
      <circle cx="1090" cy="300" r="14" fill="oklch(0.54 0.155 38)" />
    </SlideArt>
  );
}

const SLIDES = [
  { art: <ArtClassic />, seal: "典", title: "典籍出处", desc: "诗经楚辞 · 字字有来处", to: "/naming" },
  { art: <ArtGrid />, seal: "数", title: "五格数理", desc: "五行喜用 · 81 数理", to: "/analysis" },
  { art: <ArtCloud />, seal: "议", title: "亲友共决", desc: "一条链接 · 投票定名", to: "/naming" },
] as const;

/* ───────── 轮播容器 ───────── */

const AUTOPLAY_MS = 5000;

/**
 * 首页全宽 banner：lg+ 轮播幅面铺满视口、文字叠加左侧（宣纸渐变遮罩保证可读）；
 * 小屏文字在上、轮播为下方圆角卡片。自动轮换沿用 NamingDemo 的定时器惯例
 * （悬停/聚焦暂停，prefers-reduced-motion 下仅去掉推近微动画）。
 */
export function HeroBanner({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<CarouselApi>();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (!api) return;
    const sync = () => setActive(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    api.on("reInit", sync);
    return () => {
      api.off("select", sync);
    };
  }, [api]);

  useEffect(() => {
    if (paused || !api) return;
    const timer = setTimeout(() => api.scrollNext(), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [paused, api, active]);

  return (
    <section className="relative">
      {/* 文字层：小屏常规流，lg+ 叠加在轮播之上（容器放行点击，仅内容块拦截） */}
      <div className={`${shellCls} relative z-10 pt-5 pb-7 lg:pointer-events-none lg:flex lg:min-h-[30rem] lg:items-center`}>
        <div className="lg:pointer-events-auto lg:max-w-[36rem] lg:rounded-2xl lg:bg-gradient-to-r lg:from-paper/95 lg:via-paper/60 lg:to-transparent lg:py-10 lg:pr-24 lg:pl-7">
          {children}
        </div>
      </div>

      {/* 轮播层：小屏为卡片，lg+ 铺满整个区域（覆盖 shellCls 的宽度约束） */}
      <div
        className={`${shellCls} pb-8 lg:absolute lg:inset-0 lg:max-w-none lg:p-0`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <Carousel
          opts={{ loop: true, duration: 32 }}
          setApi={setApi}
          className="group/carousel h-full overflow-hidden rounded-2xl ring-1 ring-ink/10 lg:rounded-none lg:ring-0"
        >
          <CarouselContent className="-ml-0">
            {SLIDES.map((s, i) => (
              <CarouselItem key={s.title} className="pl-0">
                <Link to={s.to} aria-label={`查看${s.title}`} className="block">
                  <div className="relative aspect-[2/1] w-full overflow-hidden md:aspect-[21/9] lg:aspect-auto lg:h-[30rem]">
                    <div className={cn("h-full w-full", i === active && !reducedMotion && "banner-zoom")}>
                      {s.art}
                    </div>
                    <img
                      src="/paper-grain.png"
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-multiply"
                    />
                    <div className="absolute right-4 bottom-4 flex items-center gap-3 rounded-full bg-paper/85 py-1.5 pr-5 pl-1.5 ring-1 ring-ink/10 backdrop-blur-sm lg:right-8 lg:bottom-6">
                      <span className="grid size-9 place-items-center rounded-full bg-vermilion font-seal text-lg text-paper">
                        {s.seal}
                      </span>
                      <span className="leading-tight">
                        <span className="block text-sm font-semibold">{s.title}</span>
                        <span className="block text-[11px] text-ink-soft">{s.desc}</span>
                      </span>
                    </div>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* 指示点 */}
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2 lg:bottom-5">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`切换到第 ${i + 1} 幅：${s.title}`}
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === active ? "w-7 bg-vermilion" : "w-1.5 bg-ink/25 hover:bg-ink/50",
                )}
              />
            ))}
          </div>

          {/* 左右切换（仅桌面，悬停浮现） */}
          <CarouselPrevious className="left-3 hidden size-9 bg-paper/85 opacity-0 ring-ink/15 backdrop-blur-sm transition-opacity duration-300 group-hover/carousel:opacity-100 hover:bg-paper lg:inline-flex" />
          <CarouselNext className="right-3 hidden size-9 bg-paper/85 opacity-0 ring-ink/15 backdrop-blur-sm transition-opacity duration-300 group-hover/carousel:opacity-100 hover:bg-paper lg:inline-flex" />
        </Carousel>
      </div>
    </section>
  );
}
