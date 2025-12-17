export function parseCurrency(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "−") {
    return 0;
  }

  let sign = 1;
  let index = 0;
  const firstChar = trimmed[0] ?? "";
  if (firstChar === "+" || firstChar === "-" || firstChar === "−") {
    sign = firstChar === "+" ? 1 : -1;
    index = 1;
  }

  const digits = trimmed
    .slice(index)
    .replace(/,/g, "")
    .replace(/円/g, "")
    .trim();

  const parsed = Number.parseFloat(digits);
  return Number.isNaN(parsed) ? 0 : parsed * sign;
}

export function parseInteger(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value.trim().replace(/,/g, ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function parseDecimal(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const normalized = value.trim().replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function normalizeTimeString(value: string | undefined): string {
  if (!value) {
    return "00:00";
  }
  const [hourRaw, minuteRaw = "00"] = value.split(":");
  const hour = Number.parseInt(hourRaw ?? "0", 10);
  const minute = Number.parseInt(minuteRaw ?? "0", 10);
  const safeHour = Number.isNaN(hour) ? 0 : hour;
  const safeMinute = Number.isNaN(minute) ? 0 : minute;
  return `${safeHour.toString().padStart(2, "0")}:${safeMinute.toString().padStart(2, "0")}`;
}

export function toIsoDate(dateString: string | undefined): string | null {
  if (!dateString) {
    return null;
  }
  const [year, month, day] = dateString.split("/");
  if (!year || !month || !day) {
    return null;
  }
  const yyyy = year.padStart(4, "0");
  const mm = month.padStart(2, "0");
  const dd = day.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function safeInteger(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function padTimePart(value: number): string {
  return Math.max(0, value).toString().padStart(2, "0");
}

export interface ParsedDateTime {
  isoDate: string;
  isoTime: string;
  isoDateTime: string;
}

export function parseDateTimeWithSeconds(value: string | undefined): ParsedDateTime | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const [datePart, timePartRaw] = trimmed.split(/\s+/);
  const isoDate = toIsoDate(datePart);
  if (!isoDate) {
    return null;
  }

  if (!timePartRaw) {
    return {
      isoDate,
      isoTime: "00:00",
      isoDateTime: `${isoDate}T00:00:00`,
    };
  }

  const [hourRaw, minuteRaw = "00", secondRaw = "00"] = timePartRaw.split(":");
  const hour = safeInteger(hourRaw);
  const minute = safeInteger(minuteRaw);
  const second = safeInteger(secondRaw);

  const hh = padTimePart(hour);
  const mm = padTimePart(minute);
  const ss = padTimePart(second);

  return {
    isoDate,
    isoTime: `${hh}:${mm}`,
    isoDateTime: `${isoDate}T${hh}:${mm}:${ss}`,
  };
}
