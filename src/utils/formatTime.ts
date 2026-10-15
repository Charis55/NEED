/**
 * Formats time strings to 12-hour AM/PM format
 */

export function to12HourFormat(timeStr: string): string {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  if (trimmed.toUpperCase().includes("AM") || trimmed.toUpperCase().includes("PM")) {
    return trimmed;
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return trimmed;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function formatDateTime12Hour(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return "";
  // Converts e.g. "2026-10-15 at 14:30" to "2026-10-15 at 2:30 PM"
  return dateTimeStr.replace(/(\b\d{1,2}:\d{2}\b)(?!\s*[AaPp][Mm])/g, (match) => {
    return to12HourFormat(match);
  });
}
