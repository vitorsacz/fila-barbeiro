export const M = 60000;
export const TZ = 'America/Sao_Paulo';

export function fmtMin(m: number | null | undefined) {
  if (m == null) return '—';
  if (m < 1) return 'agora';
  m = Math.round(m);
  if (m < 60) return `~${m} min`;
  return `~${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

export function clockIn(m: number, base = Date.now()) {
  return new Date(base + m * M).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

export function clockAt(d: string | number | Date) {
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

export function mmss(ms: number) {
  ms = Math.max(0, ms);
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const brl = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const initials = (n: string) =>
  n.replace(/^(Seu|Dona|Sr\.?|Sra\.?)\s+/i, '').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export const first = (n: string) => (n || '').trim().split(/\s+/)[0];

export function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function monthLabel(d: string | Date) {
  const x = new Date(d);
  return x.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', '');
}
