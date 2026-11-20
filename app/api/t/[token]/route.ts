import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ticketView, shopById, leave } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const v = await ticketView(token);
  if (!v) return NextResponse.json({ error: 'Senha não encontrada.' }, { status: 404 });
  return NextResponse.json(v);
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = (await db()`select * from tickets where token = ${token}`)[0];
  if (!t) return NextResponse.json({ error: 'Senha não encontrada.' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const shop = await shopById(t.shop_id);

  if (body.action === 'present') {
    await db()`update tickets set present = true where id = ${t.id} and status in ('waiting','called')`;
    await db()`insert into notifications (shop_id, ticket_id, kind, text) values (${shop.id}, ${t.id}, 'present', ${`${t.name.split(' ')[0]} avisou que está na barbearia.`})`;
  } else if (body.action === 'leave') {
    await leave(shop, t, 'cliente');
  } else if (body.action === 'subscribe') {
    const s = body.subscription;
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) return NextResponse.json({ error: 'Inscrição inválida.' }, { status: 400 });
    await db()`insert into push_subs (ticket_id, endpoint, p256dh, auth) values (${t.id}, ${s.endpoint}, ${s.keys.p256dh}, ${s.keys.auth})
      on conflict (endpoint) do update set ticket_id = excluded.ticket_id, p256dh = excluded.p256dh, auth = excluded.auth`;
  } else {
    return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 });
  }
  return NextResponse.json(await ticketView(token));
}
