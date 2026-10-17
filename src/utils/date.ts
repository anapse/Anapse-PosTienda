/**
 * Formato de fecha y hora local para Colombia (es-CO)
 */
export function formatColombianDate(dateString: string | undefined | null, includeTime: boolean = true): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = true;
  }

  return new Intl.DateTimeFormat('es-CO', options).format(date);
}

export function formatShortDate(dateString: string | undefined | null): string {
  return formatColombianDate(dateString, false);
}

export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString();
}
