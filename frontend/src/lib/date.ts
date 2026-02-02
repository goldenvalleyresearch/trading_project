// src/lib/date.ts
export function parseApiDate(input: string | null | undefined): Date | null {
  if (!input) return null;

  let s = input.trim();

  // Truncate microseconds (6 digits) -> milliseconds (3 digits)
  s = s.replace(/(\.\d{3})\d+/, "$1");

  // If no timezone, assume UTC
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) {
    s += "Z";
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatShortDate(input: string | null | undefined): string {
  const d = parseApiDate(input);
  return d ? d.toLocaleDateString() : "";
}
