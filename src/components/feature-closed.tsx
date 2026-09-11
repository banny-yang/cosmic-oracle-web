import { Clock3 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";

/** 管理端关闭功能后的功能页占位（保持 enabled=null 未知态不渲染，避免闪烁） */
export function FeatureClosed({ title }: { title: string }) {
  return (
    <div className="ink-in mt-9">
      <PageHeader eyebrow="功能调整" title={title} desc="该功能正在调整中，暂时停止服务，敬请期待。" />
      <div className="mt-8 grid place-items-center rounded-2xl bg-paper-2 p-12 ring-1 ring-ink/5">
        <Clock3 className="size-10 text-ink-faint" strokeWidth={1.5} />
        <p className="mt-4 text-sm text-ink-soft">功能暂未开放</p>
      </div>
    </div>
  );
}
