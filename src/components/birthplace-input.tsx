/**
 * 出生地输入：关键词搜索 + 下拉选择。
 * 与小程序 / Flutter 端同源，经后端 /api/v1/places 代理（天地图 / Google）解析坐标；
 * 下拉无候选时退化为自由文本地址解析（blur 触发）。
 */
import { useEffect, useRef, useState } from "react";
import { get } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { inputCls } from "./app-shell";

type Prediction = { description: string; place_id: string };
type Location = { lat: number; lng: number };

export type BirthplaceValue = { lat: number; lng: number; place: string };

export function BirthplaceInput({
  lat,
  lng,
  place = "",
  placeholder = "输入城市或地区名，如：杭州",
  onPick,
}: {
  lat: number;
  lng: number;
  place?: string;
  placeholder?: string;
  onPick: (v: BirthplaceValue) => void;
}) {
  const [keyword, setKeyword] = useState(place);
  const [sugs, setSugs] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const pickedRef = useRef(place);

  useEffect(() => {
    setKeyword(place);
    pickedRef.current = place;
  }, [place]);

  const search = (text: string) => {
    window.clearTimeout(timer.current);
    if (!text.trim()) {
      setSugs([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    // places 接口需要登录态；未登录时提示而非触发全局 401 跳转
    if (!getToken()) {
      setSugs([]);
      setSearching(false);
      setOpen(true);
      return;
    }
    setSearching(true);
    timer.current = window.setTimeout(async () => {
      try {
        const r = await get<{ status?: string; predictions?: Prediction[] }>(
          "/api/v1/places/autocomplete",
          { input: text, language: "zh-CN" },
        );
        setSugs(r?.status === "OK" ? (r.predictions ?? []) : []);
      } catch {
        setSugs([]);
      } finally {
        setSearching(false);
        setOpen(true);
      }
    }, 300);
  };

  const apply = (v: BirthplaceValue) => {
    pickedRef.current = v.place;
    setKeyword(v.place);
    setOpen(false);
    onPick(v);
  };

  const select = async (s: Prediction) => {
    try {
      const r = await get<{ status?: string; location?: Location }>("/api/v1/places/geocode", {
        placeId: s.place_id,
      });
      if (r?.status === "OK" && r.location) apply({ ...r.location, place: s.description });
    } catch {
      // 坐标解析失败则不落选，保持原值
    }
  };

  const blur = () => {
    const hadSugs = sugs.length > 0;
    window.setTimeout(() => setOpen(false), 250);
    // 有候选时以点击选择为准；无候选时尝试把整段文本当地址解析
    if (hadSugs || !getToken()) return;
    const text = keyword.trim();
    if (!text || text === pickedRef.current) return;
    get<{ status?: string; location?: Location }>("/api/v1/places/geocode/address", { address: text })
      .then((r) => {
        if (r?.status === "OK" && r.location) apply({ ...r.location, place: text });
      })
      .catch(() => {});
  };

  return (
    <div className="relative">
      <input
        className={inputCls}
        value={keyword}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setKeyword(e.target.value);
          search(e.target.value);
        }}
        onFocus={() => {
          if (sugs.length) setOpen(true);
        }}
        onBlur={blur}
        onKeyDown={(e) => {
          if (e.key === "Enter" && sugs[0]) select(sugs[0]);
        }}
      />
      {open ? (
        <div className="absolute z-20 mt-1.5 max-h-56 w-full overflow-auto rounded-xl bg-white p-1">
          {searching ? (
            <p className="px-3 py-2.5 text-xs text-ink-faint">搜索中…</p>
          ) : !getToken() ? (
            <p className="px-3 py-2.5 text-xs text-ink-faint">登录后可搜索地点</p>
          ) : sugs.length ? (
            sugs.map((s) => (
              <button
                key={s.place_id}
                type="button"
                className="block w-full truncate px-3 py-2.5 text-left text-xs text-ink hover:bg-paper-3"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(s)}
              >
                {s.description}
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-xs text-ink-faint">没有匹配的地点，换个关键词试试</p>
          )}
        </div>
      ) : null}
      <p className="mt-1 text-[11px] text-ink-faint">
        {place ? `${place} · ${lat.toFixed(2)}, ${lng.toFixed(2)}` : "用于出生时刻的地点校正"}
      </p>
    </div>
  );
}
