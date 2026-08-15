// Plain types/constants shared between server-only analytics queries (src/server/queries/analytics.ts)
// and client components (e.g. src/components/period-select.tsx) — kept dependency-free (no db
// import) specifically so client components can import it without pulling the DB client into
// the browser bundle.
export type AnalyticsPeriod = "7d" | "30d" | "3m" | "6m";

export const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "3m": "3 meses",
  "6m": "6 meses",
};
