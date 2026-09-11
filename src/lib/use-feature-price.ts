/**
 * 功能点数单价与开放状态（与扣点同源 t_feature，经 /plans/features 动态读取；失败回退静态值）。
 * 四个功能页 eyebrow 统一走此 hook，杜绝页面标价与实扣不一致；
 * 管理端关闭某功能（t_feature.enabled=false）后，接口不再返回该功能——
 * useFeatureEnabled 据此判 false，入口卡片与功能页均下线该功能。
 */
import { useEffect, useState } from "react";
import { get } from "./api";

interface FeatureMeta {
  price: number | null;
  /** null=未知（加载中/失败，按开放处理）；false=管理端已关闭 */
  enabled: boolean | null;
}

type FeatureRow = { featureCode: string; price: number };

const cache = new Map<string, FeatureMeta>();

function readMeta(code: string): FeatureMeta | undefined {
  return cache.get(code);
}

function loadFeatures(code: string, apply: (meta: FeatureMeta) => void) {
  get<FeatureRow[]>("/api/v1/plans/features", {}, { auth: false, timeoutMs: 6000 })
    .then((list) => {
      const rows = Array.isArray(list) ? list : [];
      cache.clear();
      for (const it of rows) {
        if (it?.featureCode) {
          cache.set(it.featureCode, { price: typeof it.price === "number" ? it.price : null, enabled: true });
        }
      }
      apply(cache.get(code) ?? { price: null, enabled: false });
    })
    .catch(() => {});
}

export function useFeaturePrice(code: string, fallback: number): number {
  const [price, setPrice] = useState<number | null>(() => readMeta(code)?.price ?? null);
  useEffect(() => {
    let alive = true;
    const cached = readMeta(code);
    if (cached) setPrice(cached.price);
    loadFeatures(code, (meta) => {
      if (alive && meta.price != null) setPrice(meta.price);
    });
    return () => {
      alive = false;
    };
  }, [code]);
  return price ?? fallback;
}

export function useFeatureEnabled(code: string): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(() => readMeta(code)?.enabled ?? null);
  useEffect(() => {
    let alive = true;
    loadFeatures(code, (meta) => {
      if (alive) setEnabled(meta.enabled);
    });
    return () => {
      alive = false;
    };
  }, [code]);
  return enabled;
}
