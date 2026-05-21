/** ~13 weeks + buffer for FocusHeatmap (WEEKS = 13, Sunday-aligned grid). */
export const DASHBOARD_SESSION_LOOKBACK_DAYS = 91;

export function dashboardSessionCutoffIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - DASHBOARD_SESSION_LOOKBACK_DAYS);
  return d.toISOString();
}

/** Local calendar day as YYYY-MM-DD */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Alias used by Dashboard / heatmap */
export const localDateKey = dayKey;

/** Start of today in the user's local timezone */
export function startOfLocalDay(d = new Date()): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function startOfLocalDayIso(d = new Date()): string {
  return startOfLocalDay(d).toISOString();
}

export function todayKey(d = new Date()): string {
  return dayKey(d);
}
