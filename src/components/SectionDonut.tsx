import { useEffect, useMemo, useState } from "react";
import { formatFocusTime } from "@/lib/utils";

export interface SectionDatum {
  id: string;
  name: string;
  seconds: number;
}

const OPACITY_RAMP = [1, 0.8, 0.6, 0.4, 0.25, 0.15];

export function SectionDonut({ data }: { data: SectionDatum[] }) {
  const trimmed = data.slice(0, 6);
  const totalSeconds = trimmed.reduce((acc, d) => acc + d.seconds, 0);
  const isZero = totalSeconds === 0;

  // Geometry
  const totalLabel = formatFocusTime(totalSeconds);

  const size = 220;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const gapPx = 5;

  // Build segments — equal slices in zero state
  const segments = useMemo(() => {
    if (isZero) {
      const count = Math.max(trimmed.length, 6);
      const each = 1 / count;
      return Array.from({ length: count }, (_, i) => ({
        key: `ghost-${i}`,
        name: "",
        seconds: 0,
        fraction: each,
        ghost: true,
        opacity: 1,
      }));
    }
    return trimmed.map((d, i) => ({
      key: d.id,
      name: d.name,
      seconds: d.seconds,
      fraction: d.seconds / totalSeconds,
      ghost: false,
      opacity: OPACITY_RAMP[i] ?? 0.15,
    }));
  }, [trimmed, totalSeconds, isZero]);

  // Animation: stagger sweep in
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Compute arcs
  let cumulative = 0;
  const arcs = segments.map((seg, i) => {
    const segLen = seg.fraction * circumference;
    const visibleLen = Math.max(segLen - gapPx, 0.5);
    const dashArray = `${visibleLen} ${circumference - visibleLen}`;
    // rotate so segment starts at top + cumulative
    const rotation = -90 + (cumulative / circumference) * 360 + (gapPx / circumference) * 180;
    cumulative += segLen;
    return { dashArray, rotation, seg, i, visibleLen };
  });

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible">
          {arcs.map(({ dashArray, rotation, seg, i }) => {
            const isHover = hoverIdx === i;
            const colorClass = seg.ghost ? "stroke-secondary/40" : "stroke-primary";
            const delay = mounted ? i * 80 : 0;
            return (
              <circle
                key={seg.key}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="butt"
                className={`${colorClass} cursor-pointer transition-[opacity,stroke-width] duration-150`}
                style={{
                  opacity: mounted ? seg.opacity * (hoverIdx === null || isHover ? 1 : 0.35) : 0,
                  strokeDasharray: mounted ? dashArray : `0 ${circumference}`,
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: `stroke-dasharray 600ms ease-out ${delay}ms, opacity 400ms ease-out ${delay}ms, stroke-width 150ms ease`,
                  strokeWidth: isHover && !seg.ghost ? stroke + 4 : stroke,
                }}
                onMouseEnter={() => !seg.ghost && setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                onTouchStart={() => !seg.ghost && setHoverIdx(i)}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-semibold text-cream tabular-nums">{totalLabel}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            total focused
          </div>
        </div>

        {/* Tooltip */}
        {hoverIdx !== null && !segments[hoverIdx].ghost && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full rounded-xl bg-popover px-3 py-2 text-xs text-cream shadow-amber whitespace-nowrap">
            <div className="font-medium">{segments[hoverIdx].name}</div>
            <div className="text-muted-foreground">
              {formatFocusTime(segments[hoverIdx].seconds)} ·{" "}
              {Math.round(segments[hoverIdx].fraction * 100)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
