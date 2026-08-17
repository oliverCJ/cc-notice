export function currentLocalIsoString(): string {
  const date = new Date();
  return formatLocalIsoString(date, -date.getTimezoneOffset());
}

export function formatLocalIsoString(date: Date, offsetMinutes: number): string {
  const shiftedTimestamp = date.getTime() + offsetMinutes * 60_000;
  const localDateTime = new Date(shiftedTimestamp).toISOString().slice(0, 19);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0');
  const minutes = String(absoluteOffset % 60).padStart(2, '0');

  return `${localDateTime}${sign}${hours}:${minutes}`;
}

export function formatSystemTimeLabel(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}
