import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Human-readable focus duration:
//   < 1 hr  → "23 min"
//   exact hr → "2 hrs"
//   mixed    → "1 hr 30 min"
export function formatFocusTime(seconds: number): string {
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 60) return `${totalMins} min`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const hLabel = hrs === 1 ? "hr" : "hrs";
  return mins === 0 ? `${hrs} ${hLabel}` : `${hrs} ${hLabel} ${mins} min`;
}
