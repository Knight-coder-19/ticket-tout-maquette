export function formatEuros(value: number, signed = false) {
  const amount = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  const sign = signed ? (value < 0 ? "-" : "+") : value < 0 ? "-" : "";
  return `${sign}${amount} €`;
}

const dayLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "long" });
const timeLabel = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

/** "Aujourd'hui, 12:41" · "Hier, 09:00" · "Lun. 25 août, 08:15" */
export function formatRelativeDateTime(iso: string, now: Date = new Date()) {
  const d = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const time = timeLabel.format(d);
  if (isSameDay(d, now)) return `Aujourd'hui, ${time}`;
  if (isSameDay(d, yesterday)) return `Hier, ${time}`;
  return `${dayLabel.format(d)}, ${time}`;
}

/** "il y a 45 min" · "il y a 6 h" · "il y a 2 j" - for compact request queues. */
export function formatRelativeShort(iso: string, now: Date = new Date()) {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

/** "320 m" below 1 km, "1,4 km" above - round-trip from a plain meters number. */
export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}
