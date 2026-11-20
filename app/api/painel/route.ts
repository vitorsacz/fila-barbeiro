import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { SHOP_COOKIE, setSession, clearSession, shopSessionId } from '@/lib/auth';
import { shopById, shopBySlug, panelState, finish, callNext, start, noShow, move, leave, join } from '@/lib/queue';

export const dynamic = 'force-dynamic';

const err = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function GET() {
  const id = await shopSessionId();
  if (!id) return err('Faça login de novo.', 401);
  const st = await panelState(id);
  if (!st) return err('Barbearia não encontrada.', 404);
  return NextResponse.json(st);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const a = body.action;

  if (a === 'login') {
    const shop = await shopBySlug(String(body.slug || '').trim().toLowerCase());
    if (!shop) return err('Não achamos essa barbearia. Confira o endereço.');
    if (shop.locked_until && new Date(shop.locked_until).getTime() > Date.now())
      return err('Muitas tentativas erradas. Espere 10 minutos e tente de novo.', 429);
    const ok = await bcrypt.compare(String(body.pin || ''), shop.pin_hash);
    if (!ok) {
      await db()`update shops set failed_logins = failed_logins + 1,
        locked_until = case when failed_logins + 1 >= 5 then now() + interval '10 minutes' else null end where id = ${shop.id}`;
      return err('PIN incorreto.', 401);
    }
    await db()`update shops set failed_logins = 0, locked_until = null where id = ${shop.id}`;
    await setSession(SHOP_COOKIE, { role: 'shop', shopId: shop.id });
    return NextResponse.json({ ok: true });
  }
  if (a === 'logout') {
    await clearSession(SHOP_COOKIE);
    return NextResponse.json({ ok: true });
  }

  const id = await shopSessionId();
  if (!id) return err('Faça login de novo.', 401);
  const shop = await shopById(id);
  if (!shop) return err('Barbearia não encontrada.', 404);
  const own = async (table: 'barbers' | 'tickets', rid: string) =>
    (table === 'barbers'
      ? await db()`select * from barbers where id = ${rid} and shop_id = ${shop.id}`
      : await db()`select * from tickets where id = ${rid} and shop_id = ${shop.id}`)[0];

  try {
    switch (a) {
      case 'finish': if (await own('barbers', body.barberId)) await finish(shop, body.barberId); break;
      case 'callnext': if (await own('barbers', body.barberId)) await callNext(shop, body.barberId); break;
      case 'start': await start(shop, body.ticketId); break;
      case 'noshow': { const t = await own('tickets', body.ticketId); if (t?.status === 'called') await noShow(shop, t); break; }
      case 'up': await move(shop, body.ticketId, -1); break;
      case 'down': await move(shop, body.ticketId, 1); break;
      case 'remove': { const t = await own('tickets', body.ticketId); if (t) await leave(shop, t, 'barbeiro'); break; }
      case 'add': {
        const name = String(body.name || '').trim().slice(0, 40);
        if (name.length < 2) return err('Digite o nome de quem chegou.');
        await join(shop, body.barberId, name, String(body.phone || '') || null, 'balcao');
        break;
      }
      case 'avg': {
        const v = Math.min(120, Math.max(5, Number(body.value) || 30));
        await db()`update barbers set avg_min = ${v} where id = ${body.barberId} and shop_id = ${shop.id}`;
        break;
      }
      case 'toggle': await db()`update barbers set active = not active where id = ${body.barberId} and shop_id = ${shop.id}`; break;
      case 'barberAdd': {
        const name = String(body.name || '').trim().slice(0, 40);
        if (name.length < 2) return err('Digite o nome do barbeiro.');
        await db()`insert into barbers (shop_id, name, avg_min, sort)
          values (${shop.id}, ${name}, ${Number(body.avg) || 30}, (select coalesce(max(sort), 0) + 1 from barbers where shop_id = ${shop.id}))`;
        break;
      }
      case 'barberRename': {
        const name = String(body.name || '').trim().slice(0, 40);
        if (name.length >= 2) await db()`update barbers set name = ${name} where id = ${body.barberId} and shop_id = ${shop.id}`;
        break;
      }
      case 'barberDelete': {
        const busy = await db()`select 1 from tickets where barber_id = ${body.barberId} and status in ('waiting','called','serving') limit 1`;
        if (busy.length) return err('Esse barbeiro ainda tem gente na fila. Atenda ou tire da fila antes de remover.');
        await db()`delete from barbers where id = ${body.barberId} and shop_id = ${shop.id}`;
        break;
      }
      case 'settings': {
        const tol = Math.min(30, Math.max(2, Number(body.tolerance) || 5));
        const pol = body.policy === 'out' ? 'out' : 'back';
        const al = Math.min(5, Math.max(1, Number(body.alertAhead) || 2));
        await db()`update shops set tolerance_min = ${tol}, policy = ${pol}, alert_ahead = ${al} where id = ${shop.id}`;
        break;
      }
      default: return err('Ação desconhecida.');
    }
  } catch (e: any) {
    return err(e.message || 'Algo deu errado.');
  }
  return NextResponse.json(await panelState(shop.id));
}
