import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { ADMIN_COOKIE, setSession, clearSession, isAdmin, checkAdminPassword } from '@/lib/auth';
import { slugify } from '@/lib/format';

export const dynamic = 'force-dynamic';

const err = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
const cents = (v: any) => Math.max(0, Math.round(Number(String(v ?? '0').replace(/\./g, '').replace(',', '.')) * 100) || 0);

async function overview() {
  const shops = await db()`
    select s.id, s.slug, s.name, s.owner_name, s.owner_phone, s.monthly_price_cents, s.billing_day, s.status, s.started_at, s.created_at,
      (select count(*)::int from barbers b where b.shop_id = s.id) as barbers,
      (select count(*)::int from tickets t where t.shop_id = s.id
         and (t.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) as today,
      (select count(*)::int from tickets t where t.shop_id = s.id and t.created_at > now() - interval '30 days') as last30,
      (select count(*)::int from tickets t where t.shop_id = s.id and t.status in ('waiting','called')) as waiting,
      (select max(created_at) from tickets t where t.shop_id = s.id) as last_use,
      exists (select 1 from payments p where p.shop_id = s.id
         and p.ref_month = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date) as paid_this_month
    from shops s order by s.created_at`;
  const months = await db()`
    select to_char(m, 'YYYY-MM-01') as month, coalesce(sum(p.amount_cents), 0)::int as total
    from generate_series(date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '5 months',
                         date_trunc('month', now() at time zone 'America/Sao_Paulo'), interval '1 month') m
    left join payments p on p.ref_month = m::date
    group by m order by m`;
  const payments = await db()`
    select p.id::int, p.shop_id, s.name as shop, to_char(p.ref_month, 'YYYY-MM') as ref_month, p.amount_cents, to_char(p.paid_at, 'DD/MM/YYYY') as paid_at, p.method, p.note
    from payments p join shops s on s.id = p.shop_id order by p.ref_month desc, p.id desc limit 60`;
  return { shops, months, payments, now: Date.now() };
}

export async function GET() {
  if (!(await isAdmin())) return err('Faça login.', 401);
  return NextResponse.json(await overview());
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.op === 'login') {
    if (!checkAdminPassword(String(b.password || ''))) {
      await new Promise((r) => setTimeout(r, 800));
      return err('Senha incorreta.', 401);
    }
    await setSession(ADMIN_COOKIE, { role: 'admin' });
    return NextResponse.json({ ok: true });
  }
  if (b.op === 'logout') {
    await clearSession(ADMIN_COOKIE);
    return NextResponse.json({ ok: true });
  }
  if (!(await isAdmin())) return err('Faça login.', 401);

  try {
    if (b.op === 'createShop') {
      const name = String(b.name || '').trim();
      const slug = slugify(b.slug || name);
      const pin = String(b.pin || '').trim();
      if (name.length < 2) return err('Dê um nome para a barbearia.');
      if (!slug) return err('Escolha um endereço (slug) válido.');
      if (!/^\d{4,8}$/.test(pin)) return err('O PIN precisa ter de 4 a 8 números.');
      const taken = await db()`select 1 from shops where slug = ${slug}`;
      if (taken.length) return err(`O endereço "${slug}" já está em uso.`);
      const [s] = await db()`insert into shops (slug, name, owner_name, owner_phone, pin_hash, monthly_price_cents, billing_day, status)
        values (${slug}, ${name}, ${b.owner_name || null}, ${b.owner_phone || null}, ${await bcrypt.hash(pin, 10)},
                ${cents(b.price)}, ${Math.min(28, Math.max(1, Number(b.billing_day) || 10))}, ${['ativa', 'teste'].includes(b.status) ? b.status : 'teste'})
        returning id`;
      const names = String(b.barbers || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 20);
      for (let i = 0; i < names.length; i++) await db()`insert into barbers (shop_id, name, sort) values (${s.id}, ${names[i]}, ${i})`;
    } else if (b.op === 'updateShop') {
      const status = ['ativa', 'teste', 'suspensa', 'cancelada'].includes(b.status) ? b.status : 'teste';
      await db()`update shops set name = ${String(b.name).trim()}, owner_name = ${b.owner_name || null}, owner_phone = ${b.owner_phone || null},
        monthly_price_cents = ${cents(b.price)}, billing_day = ${Math.min(28, Math.max(1, Number(b.billing_day) || 10))}, status = ${status}
        where id = ${b.id}`;
      if (b.pin) {
        if (!/^\d{4,8}$/.test(String(b.pin))) return err('O PIN precisa ter de 4 a 8 números.');
        await db()`update shops set pin_hash = ${await bcrypt.hash(String(b.pin), 10)}, failed_logins = 0, locked_until = null where id = ${b.id}`;
      }
    } else if (b.op === 'addPayment') {
      if (!/^\d{4}-\d{2}$/.test(String(b.ref_month))) return err('Escolha o mês de referência.');
      const amount = cents(b.amount);
      if (!amount) return err('Digite o valor recebido.');
      await db()`insert into payments (shop_id, ref_month, amount_cents, paid_at, method, note)
        values (${b.shop_id}, ${b.ref_month + '-01'}::date, ${amount}, ${b.paid_at || new Date().toISOString().slice(0, 10)}::date, ${b.method || 'pix'}, ${b.note || null})
        on conflict (shop_id, ref_month) do update set amount_cents = excluded.amount_cents, paid_at = excluded.paid_at, method = excluded.method, note = excluded.note`;
    } else if (b.op === 'deletePayment') {
      await db()`delete from payments where id = ${Number(b.id)}`;
    } else return err('Operação desconhecida.');
  } catch (e: any) {
    return err(e.message || 'Algo deu errado.');
  }
  return NextResponse.json(await overview());
}
