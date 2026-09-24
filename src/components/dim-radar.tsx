/**
 * 维度雷达图（纯 SVG，无依赖，随 currentColor 取色）。
 *
 * 名字评测的五维展示用；naming.tsx 里那份是起名页私有的实现，两者互不影响。
 * 轴数由 axes.length 决定（顶点从正上方开始顺时针分布），分数 0-100 夹取。
 */
export type RadarAxis = { label: string; score: number };

export function DimRadar({
  axes,
  size = 220,
  className,
}: {
  axes: RadarAxis[];
  size?: number;
  className?: string;
}) {
  const n = axes.length;
  if (n < 3) return null;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const pt = (i: number, ratio: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + Math.cos(a) * r * ratio, cy + Math.sin(a) * r * ratio] as const;
  };
  const ring = (ratio: number) => axes.map((_, i) => pt(i, ratio).join(",")).join(" ");
  const ratioOf = (score: number) => Math.min(100, Math.max(0, score)) / 100;
  const area = axes.map((d, i) => pt(i, ratioOf(d.score)).join(",")).join(" ");
  // 标签锚点按角度外推：右侧贴边左对齐、左侧右对齐，顶/底居中，避免文字越界
  const anchorOf = (i: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const cos = Math.cos(a);
    return cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`-16 -10 ${size + 32} ${size + 20}`}
      className={className}
      role="img"
      aria-label={`五维雷达：${axes.map((d) => `${d.label} ${Math.round(d.score)}`).join("，")}`}
    >
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon
          key={k}
          points={ring(k)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.16}
          strokeWidth={0.8}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={0.8}
          />
        );
      })}
      <polygon
        points={area}
        fill="currentColor"
        fillOpacity={0.16}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {axes.map((d, i) => {
        const [x, y] = pt(i, 1.24);
        return (
          <g key={d.label} textAnchor={anchorOf(i)} fill="currentColor">
            <text x={x} y={y} dominantBaseline="middle" fontSize={size / 16} fillOpacity={0.7}>
              {d.label}
            </text>
            <text
              x={x}
              y={y}
              dy={size / 15}
              dominantBaseline="middle"
              fontSize={size / 17}
              fontWeight={600}
              fillOpacity={0.9}
            >
              {Math.round(d.score)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
