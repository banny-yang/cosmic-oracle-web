import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { shellCls } from "@/components/app-shell";
import { festivalImageUrl, type FestivalHeroData } from "@/lib/festival";
import { track } from "@/lib/track";

/**
 * 节日营销 Hero：运营上传的整图成品，前端不叠任何系统文字。
 * 高度与 HeroBanner 同口径：小屏 2:1 圆角卡片、md 21:9、lg+ 30rem 铺满全宽，
 * 整图 object-cover 居中裁切（素材两侧各留 15% 安全区即可不被裁掉主体）。
 * children（h1 与简介）以 sr-only 保留在 DOM——换图期间 SEO 与无障碍不丢。
 */
export function FestivalHero({ data, children }: { data: FestivalHeroData; children: ReactNode }) {
  const url = festivalImageUrl(data.imageUrl!);
  const cta = data.ctaTarget?.trim() ?? "";
  const external = cta.startsWith("https://");

  useEffect(() => {
    track("festival_hero_view", { code: data.code ?? "", label: data.label ?? "" });
  }, [data.code, data.label]);

  const onClick = () => track("festival_hero_click", { code: data.code ?? "", label: data.label ?? "" });

  const frame = (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl md:aspect-[21/9] lg:aspect-auto lg:h-[30rem] lg:rounded-none">
      <img
        src={url}
        alt={data.label ? `${data.label}活动图` : "节日活动图"}
        className="h-full w-full object-cover object-center"
        // 首屏主视觉：立即加载，不用懒加载首帧
        loading="eager"
        decoding="async"
      />
    </div>
  );

  return (
    <section className="relative">
      {/* sr-only 文案层：撑起 lg+ 的 30rem 区高（小屏零高度不可见） */}
      <div className={`${shellCls} relative z-10 lg:min-h-[30rem]`}>
        <div className="sr-only">{children}</div>
      </div>
      {/* 整图层：小屏为卡片，lg+ 铺满整个区域（与 HeroBanner 的轮播层同构） */}
      <div className={`${shellCls} pb-8 lg:absolute lg:inset-0 lg:max-w-none lg:p-0`}>
        {cta && external ? (
          <a href={cta} target="_blank" rel="noopener noreferrer" onClick={onClick} className="block">
            {frame}
          </a>
        ) : cta ? (
          /* CTA 站内路径由后端白名单校验后下发，这里收窄回路由字面量类型 */
          <Link to={cta as "/naming"} onClick={onClick} className="block">
            {frame}
          </Link>
        ) : (
          frame
        )}
      </div>
    </section>
  );
}
