/**
 * 首页「名字灵感库」幻灯片：公开接口取一批好名字，embla 轮播自动播放
 * （悬停/聚焦暂停，与 HeroBanner 同款交互），移动端 1 张/屏、md 2 张、lg 3 张。
 * 接口失败静默隐藏整节（不影响首页其余内容）。
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { get } from "@/lib/api";

interface GalleryItem {
  word: string;
  pinyin?: string | null;
  source?: string | null;
  text?: string | null;
  meaning?: string | null;
  category: string;
}

const AUTOPLAY_MS = 3800;

export function NameGalleryCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [items, setItems] = useState<GalleryItem[]>([]);

  useEffect(() => {
    get<{ items: GalleryItem[] }>(
      "/api/v1/naming/name-gallery",
      { page: 0, size: 12 },
      { auth: false, timeoutMs: 6000 },
    )
      .then((r) => setItems((r?.items ?? []).filter((n) => n.word)))
      .catch(() => setItems([]));
  }, []);

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
    if (paused || !api || items.length < 2) return;
    const timer = setTimeout(() => api.scrollNext(), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [paused, api, active, items.length]);

  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">名字灵感库 · 典籍甄选</h2>
        <Link
          to="/names"
          className="text-xs font-medium text-vermilion-deep underline underline-offset-2"
        >
          浏览全部 →
        </Link>
      </div>

      <div
        className="mt-4"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <Carousel
          opts={{ loop: true, duration: 28, align: "start" }}
          setApi={setApi}
          className="group/carousel"
        >
          <CarouselContent className="-ml-3">
            {items.map((n) => (
              <CarouselItem key={n.word} className="pl-3 md:basis-1/2 lg:basis-1/3">
                <Link
                  to="/names"
                  className="flex h-full flex-col rounded-2xl bg-paper-2 p-5 ring-1 ring-ink/5 transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-seal text-3xl leading-none text-ink">{n.word}</p>
                      {n.pinyin ? (
                        <p className="mt-1.5 text-xs tracking-wider text-ink-soft">{n.pinyin}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-ink/[0.05] px-2.5 py-0.5 text-[11px] text-ink-soft">
                      {n.category}
                    </span>
                  </div>
                  {n.meaning ? (
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-soft text-pretty">
                      {n.meaning}
                    </p>
                  ) : null}
                  {n.text || n.source ? (
                    <div className="mt-auto rounded-xl bg-ink/[0.04] p-3 pt-2.5">
                      {n.text ? (
                        <p className="line-clamp-2 text-xs leading-relaxed text-ink-soft text-pretty">
                          {n.text}
                        </p>
                      ) : null}
                      {n.source ? (
                        <p className="mt-1 text-[11px] text-ink-faint">—— {n.source}</p>
                      ) : null}
                    </div>
                  ) : null}
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-1.5 hidden size-8 border-ink/15 bg-paper-2/90 text-ink md:inline-flex" />
          <CarouselNext className="right-1.5 hidden size-8 border-ink/15 bg-paper-2/90 text-ink md:inline-flex" />
        </Carousel>

        <div className="mt-2 flex justify-center gap-1.5 md:hidden">
          {items.slice(0, 8).map((n, i) => (
            <span
              key={n.word}
              className={[
                "h-1.5 rounded-full transition-all",
                i === active % Math.min(items.length, 8) ? "w-4 bg-vermilion" : "w-1.5 bg-ink/15",
              ].join(" ")}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
