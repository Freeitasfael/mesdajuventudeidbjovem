// -----------------------------------------------------------------------------
// Datas normalizadas para o fuso oficial da aplicação (America/Sao_Paulo).
// Nunca depender de `new Date()` local do navegador para lógica de negócio.
// -----------------------------------------------------------------------------

export const APP_TIMEZONE = "America/Sao_Paulo";

/** Retorna "YYYY-MM-DD" no fuso oficial da app. */
export function todayISO(d: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // en-CA formata como YYYY-MM-DD
}

/** ISO UTC representando o início do dia (00:00:00) daquela data em SP. */
export function startOfDayISO(dateYMD: string): string {
  // "-03:00" cobre o fuso atual do Brasil (sem DST desde 2019).
  return new Date(`${dateYMD}T00:00:00-03:00`).toISOString();
}

/** ISO UTC representando o fim do dia (23:59:59.999) daquela data em SP. */
export function endOfDayISO(dateYMD: string): string {
  return new Date(`${dateYMD}T23:59:59.999-03:00`).toISOString();
}

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "last90"
  | "thisMonth"
  | "thisYear"
  | "all";

export interface DateRange {
  from: string; // YYYY-MM-DD (vazio = aberto)
  to: string;   // YYYY-MM-DD (vazio = aberto)
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function rangeFor(preset: DateRangePreset, today: string = todayISO()): DateRange {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "last30":
      return { from: addDays(today, -29), to: today };
    case "last90":
      return { from: addDays(today, -89), to: today };
    case "thisMonth":
      return { from: today.slice(0, 8) + "01", to: today };
    case "thisYear":
      return { from: today.slice(0, 4) + "-01-01", to: today };
    case "all":
    default:
      return { from: "", to: "" };
  }
}
