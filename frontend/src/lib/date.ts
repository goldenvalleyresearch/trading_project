export function parseApiDate(input: string | null | undefined): Date | null {
  if (!input) return null;

  let s = input.trim();

  // If fractional seconds have 6 digits (microseconds), truncate to 3 (milliseconds)
  // 2026-02-02T01:21:50.863000 -> 2026-02-02T01:21:50.863
  s = s.replace(/(\.\d{3})\d+/, "$1");

  // If there is no timezone info, assume UTC by appending Z
  // (no trailing Z or +/-hh:mm)
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) {
    s += "Z";
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
