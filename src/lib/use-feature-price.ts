/**
 * 功能点数单价（与扣点同源 t_feature，经 /plans/features 动态读取；失败回退静态值）。
 * 四个功能页 eyebrow 统一走此 hook，杜绝页面标价与实扣不一致。
 */
import { useEffect, useState } from "react";
import { get } from "./api";

export function useFeaturePrice(code: string, fallback: number): number {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    get<{ featureCode: string; price: number }[]>("/api/v1/plans/features", {}, { auth: false, timeoutMs: 6000 })
      .then((list) => {
        const hit = (Array.isArray(list) ? list : []).find((it) => it?.featureCode === code);
        if (alive && hit && typeof hit.price === "number") setPrice(hit.price);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [code]);
  return price ?? fallback;
}
