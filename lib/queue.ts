/**
 * Regras da fila. Todo o estado vive no Postgres; nada depende do painel estar aberto,
 * mas as transições automáticas (quem não chegou a tempo) rodam a cada leitura (tick).
 */
import { db } from './db';
import { pushTicket } from './push';
import { M, first, clockIn, initials } from './format';

type Row = Record<string, any>;
export type Entry = { b: Row; serving: Row | null; queue: Row[] };

const ms = (d: any) => (d ? new Date(d).getTime() : 0);

export async function shopBySlug(slug: string) {
  return (await db()`select * from shops where slug = ${slug}`)[0] || null;
}
export async function shopById(id: string) {
  return (await db()`select * from shops where id = ${id}`)[0] || null;
}
const barberById = async (id: string) => (await db()`select * from barbers where id = ${id}`)[0];
const ticketById = async (id: string) => (await db()`select * from tickets where id = ${id}`)[0];

export async function snapshot(shopId: string) {
  const [barbers, tickets] = await Promise.all([
    db()`select * from barbers where shop_id = ${shopId} order by sort, created_at`,
    db()`select * from tickets where shop_id = ${shopId} and status in ('waiting','called','serving') order by ord`,
  ]);
  const map: Record<string, Entry> = {};
  for (const b of barbers) map[b.id] = { b, serving: null, queue: [] };
  for (const t of tickets) {
    const e = map[t.barber_id];
    if (!e) continue;
    if (t.status === 'serving') e.serving = t;
    else e.queue.push(t);
  }
  return { barbers, map };
}

/** Minutos até a pessoa na posição idx (0 = primeira da fila) sentar na cadeira. */
export function etaFor(e: Entry, idx: number, now = Date.now()) {
  const s = e.serving;
  const rem = s ? Math.max(e.b.avg_min - (now - ms(s.started_at)) / M, 2) : 0;
  return rem + idx * e.b.avg_min;
}

const TITLES: Record<string, string> = {
  call: 'É a sua vez!',
  alert: 'Sua vez está chegando',
  back: 'Você voltou na fila',
  out: 'Você saiu da fila',
};

async function notify(shop: Row, t: Row, kind: string, text: string) {
  await db()`insert into notifications (shop_id, ticket_id, kind, text) values (${shop.id}, ${t.id}, ${kind}, ${text})`;
  if (TITLES[kind]) {
    await pushTicket(t.id, { title: `${TITLES[kind]} · ${shop.name}`, body: text, url: `/t/${t.token}`, tag: `t-${t.id}` });
  }
}

export async function checkAlerts(shop: Row, barberId: string) {
  const { map } = await snapshot(shop.id);
  const e = map[barberId];
  if (!e) return;
  for (let i = 1; i < e.queue.length && i <= shop.alert_ahead; i++) {
    const t = e.queue[i];
    if (t.status !== 'waiting' || t.alerted) continue;
    const r = await db()`update tickets set alerted = true where id = ${t.id} and alerted = false returning id`;
    if (!r.length) continue;
    const m = etaFor(e, i);
    await notify(
      shop, t, 'alert',
      `${first(t.name)}, falta${i === 1 ? '' : 'm'} ${i} pessoa${i === 1 ? '' : 's'} antes de você com ${e.b.name}. Previsão por volta de ${clockIn(m)}. Já pode ir se aproximando.`
    );
  }
}

export async function callNext(shop: Row, barberId: string) {
  const r = await db()`
    update tickets set status = 'called', called_at = now(), alerted = true
    where id = (select id from tickets where barber_id = ${barberId} and status = 'waiting' order by ord limit 1)
      and not exists (select 1 from tickets where barber_id = ${barberId} and status = 'called')
    returning *`;
  if (r.length) {
    const t = r[0];
    const b = await barberById(barberId);
    await notify(shop, t, 'call', `${first(t.name)}, chegou a sua vez com ${b.name}! Você tem ${shop.tolerance_min} min para chegar.`);
  }
  await checkAlerts(shop, barberId);
}

export async function finish(shop: Row, barberId: string) {
  await db()`update tickets set status = 'done', finished_at = now() where barber_id = ${barberId} and shop_id = ${shop.id} and status = 'serving'`;
  await callNext(shop, barberId);
}

export async function start(shop: Row, ticketId: string) {
  const t = await ticketById(ticketId);
  if (!t || t.shop_id !== shop.id) return;
  await db()`update tickets set status = 'done', finished_at = now() where barber_id = ${t.barber_id} and status = 'serving'`;
  await db()`update tickets set status = 'serving', started_at = now(), present = true where id = ${t.id} and status in ('called','waiting')`;
  await checkAlerts(shop, t.barber_id);
}

export async function noShow(shop: Row, t: Row) {
  const { map } = await snapshot(shop.id);
  const e = map[t.barber_id];
  const q = e ? e.queue.filter((x) => x.id !== t.id) : [];
  if (shop.policy === 'back' && t.skips === 0 && q.length) {
    const ai = Math.min(1, q.length - 1);
    const anchor = q[ai];
    const after = q[ai + 1];
    const ord = after ? (anchor.ord + after.ord) / 2 : anchor.ord + 1;
    const r = await db()`update tickets set status = 'waiting', called_at = null, skips = 1, ord = ${ord}::float8, alerted = true
      where id = ${t.id} and status = 'called' returning id`;
    if (r.length)
      await notify(shop, t, 'back', `${first(t.name)}, você não chegou a tempo e voltou para o ${ai + 2}º lugar na fila de ${e!.b.name}. Fique de olho no próximo aviso.`);
  } else {
    const r = await db()`update tickets set status = 'noshow', finished_at = now() where id = ${t.id} and status in ('called','waiting') returning id`;
    if (r.length)
      await notify(shop, t, 'out', `${first(t.name)}, sua vez passou e você saiu da fila. Se ainda quiser cortar, é só entrar de novo pelo QR Code.`);
  }
  await callNext(shop, t.barber_id);
}

/** Aplica a regra de quem foi chamado e não apareceu dentro do prazo. */
export async function tick(shop: Row) {
  const late = await db()`
    select * from tickets where shop_id = ${shop.id} and status = 'called' and present = false
      and called_at < now() - make_interval(mins => ${shop.tolerance_min}::int)`;
  for (const t of late) await noShow(shop, t);
}

export async function join(shop: Row, barberId: string, name: string, phone: string | null, source: 'qr' | 'balcao') {
  const b = (await db()`select * from barbers where id = ${barberId} and shop_id = ${shop.id}`)[0];
  if (!b || !b.active) throw new Error('Esse barbeiro não está recebendo fila agora. Escolha outro.');
  const [{ n }] = await db()`select count(*)::int as n from tickets where shop_id = ${shop.id}
    and (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date`;
  const code = `${(initials(b.name)[0] || 'X')}-${String(n + 1).padStart(3, '0')}`;
  const { map } = await snapshot(shop.id);
  const e = map[b.id];
  const eta = Math.max(etaFor(e, e.queue.length), 1);
  const [t] = await db()`
    insert into tickets (shop_id, barber_id, code, name, phone, source, ord, eta_at_join)
    values (${shop.id}, ${b.id}, ${code}, ${name}, ${phone || null}, ${source},
            (select coalesce(max(ord), 0) + 1 from tickets where barber_id = ${b.id}), ${eta})
    returning *`;
  await db()`insert into notifications (shop_id, ticket_id, kind, text)
    values (${shop.id}, ${t.id}, 'confirm', ${`${first(name)} entrou na fila de ${b.name} (senha ${code})${source === 'balcao' ? ' pelo balcão' : ' pelo QR Code'}.`})`;
  if (!e.serving && !e.queue.some((x) => x.status === 'called')) await callNext(shop, b.id);
  else await checkAlerts(shop, b.id);
  return t;
}

export async function leave(shop: Row, t: Row, by: 'cliente' | 'barbeiro') {
  const r = await db()`update tickets set status = 'left', finished_at = now() where id = ${t.id} and status in ('waiting','called') returning id`;
  if (r.length)
    await db()`insert into notifications (shop_id, ticket_id, kind, text) values (${shop.id}, ${t.id}, 'left',
      ${by === 'cliente' ? `${first(t.name)} saiu da fila.` : `${first(t.name)} foi tirado da fila.`})`;
  if (t.status === 'called') await callNext(shop, t.barber_id);
  else await checkAlerts(shop, t.barber_id);
}

export async function move(shop: Row, ticketId: string, dir: number) {
  const t = await ticketById(ticketId);
  if (!t || t.shop_id !== shop.id) return;
  const { map } = await snapshot(shop.id);
  const q = map[t.barber_id]?.queue || [];
  const i = q.findIndex((x) => x.id === t.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= q.length || t.status === 'called' || q[j].status === 'called') return;
  await db()`update tickets set ord = case when id = ${t.id} then ${q[j].ord}::float8 else ${t.ord}::float8 end
    where id in (${t.id}, ${q[j].id})`;
  await checkAlerts(shop, t.barber_id);
}

/* ---------- visões (o que cada tipo de usuário pode ver) ---------- */

/** Pública: só nomes dos barbeiros e tamanho das filas, nunca nomes de clientes. */
export async function shopPublic(slug: string) {
  const shop = await shopBySlug(slug);
  if (!shop) return null;
  await tick(shop);
  const { barbers, map } = await snapshot(shop.id);
  return {
    name: shop.name,
    slug: shop.slug,
    open: shop.status === 'ativa' || shop.status === 'teste',
    tolerance: shop.tolerance_min,
    policy: shop.policy,
    barbers: barbers.map((b: Row) => {
      const e = map[b.id];
      return { id: b.id, name: b.name, active: b.active, inQueue: e.queue.length, waitMin: etaFor(e, e.queue.length), free: !e.serving && !e.queue.length };
    }),
  };
}

/** Do cliente: só a própria senha e posição. */
export async function ticketView(token: string) {
  const t0 = (await db()`select * from tickets where token = ${token}`)[0];
  if (!t0) return null;
  const shop = await shopById(t0.shop_id);
  await tick(shop);
  const { map } = await snapshot(shop.id);
  const t = await ticketById(t0.id);
  const e = map[t.barber_id];
  const idx = e ? e.queue.findIndex((x) => x.id === t.id) : -1;
  const notes = await db()`select id::int, kind, text, created_at from notifications
    where ticket_id = ${t.id} and kind in ('call','alert','back','out') order by id desc limit 5`;
  return {
    shop: { name: shop.name, slug: shop.slug, tolerance: shop.tolerance_min, policy: shop.policy, alertAhead: shop.alert_ahead },
    barber: { name: e?.b.name ?? '', active: e?.b.active ?? false },
    ticket: {
      code: t.code,
      firstName: first(t.name),
      status: t.status,
      present: t.present,
      position: idx >= 0 ? idx + 1 : null,
      etaMin: idx >= 0 && e ? etaFor(e, idx) : null,
      etaAtJoin: t.eta_at_join,
      calledLeftMs: t.status === 'called' ? shop.tolerance_min * M - (Date.now() - ms(t.called_at)) : null,
    },
    notes,
  };
}

/** Do barbeiro: tudo da própria barbearia. */
export async function panelState(shopId: string) {
  let shop = await shopById(shopId);
  if (!shop) return null;
  await tick(shop);
  shop = await shopById(shopId);
  const { barbers, map } = await snapshot(shop.id);
  const [done, log, subs] = await Promise.all([
    db()`select barber_id, count(*)::int as n from tickets where shop_id = ${shop.id} and status = 'done'
      and (finished_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date group by barber_id`,
    db()`select n.id::int, n.kind, n.text, n.created_at from notifications n where n.shop_id = ${shop.id} order by n.id desc limit 40`,
    db()`select distinct p.ticket_id from push_subs p join tickets t on t.id = p.ticket_id
      where t.shop_id = ${shop.id} and t.status in ('waiting','called','serving')`,
  ]);
  const doneBy = Object.fromEntries(done.map((d: Row) => [d.barber_id, d.n]));
  const pushSet = new Set(subs.map((s: Row) => s.ticket_id));
  const pickT = (t: Row) => ({
    id: t.id, code: t.code, name: t.name, phone: t.phone, status: t.status, present: t.present, skips: t.skips,
    source: t.source, push: pushSet.has(t.id), startedAt: ms(t.started_at),
    calledLeftMs: t.status === 'called' ? shop.tolerance_min * M - (Date.now() - ms(t.called_at)) : null,
  });
  return {
    serverNow: Date.now(),
    shop: { id: shop.id, name: shop.name, slug: shop.slug, status: shop.status, tolerance: shop.tolerance_min, policy: shop.policy, alertAhead: shop.alert_ahead },
    barbers: barbers.map((b: Row) => {
      const e = map[b.id];
      return {
        id: b.id, name: b.name, avg: b.avg_min, active: b.active, doneToday: doneBy[b.id] || 0,
        serving: e.serving ? pickT(e.serving) : null,
        queue: e.queue.map((t, i) => ({ ...pickT(t), etaMin: etaFor(e, i) })),
        waitMin: etaFor(e, e.queue.length),
      };
    }),
    log,
  };
}
