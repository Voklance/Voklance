/** Converts a wall-clock value in an IANA zone to an ISO timestamp with its matching offset. */
export function zonedDateTime(value: string, timezone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Enter a date and time.');
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
  } catch {
    throw new Error('Enter a valid IANA time zone.');
  }
  const wall = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
  const approximate = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  );
  const matches: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const instant = approximate - offset * 60_000;
    const parts = formatter.formatToParts(instant);
    const get = (key: string) => parts.find((part) => part.type === key)?.value ?? '';
    if (`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}` === wall)
      matches.push(offset);
  }
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? 'This local time occurs twice. Choose another time.'
        : 'This local time does not exist in that time zone.'
    );
  const offset = matches[0];
  const sign = offset >= 0 ? '+' : '-';
  const absolute = Math.abs(offset);
  return `${wall}:00${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}
export function displayEventTime(instant: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(new Date(instant));
}
export function wallClockValue(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(instant));
  const get = (key: string) => parts.find((part) => part.type === key)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
