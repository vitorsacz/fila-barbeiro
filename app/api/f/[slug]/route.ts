import { NextResponse } from 'next/server';
import { shopBySlug, shopPublic, join } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = await shopPublic(slug);
  if (!v) return NextResponse.json({ error: 'Barbearia não encontrada.' }, { status: 404 });
  return NextResponse.json(v);
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await shopBySlug(slug);
  if (!shop || !(shop.status === 'ativa' || shop.status === 'teste'))
    return NextResponse.json({ error: 'A fila desta barbearia não está disponível agora.' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 40);
  const phone = String(body.phone || '').replace(/[^\d() -]/g, '').slice(0, 20);
  if (name.length < 2) return NextResponse.json({ error: 'Digite seu nome para entrar na fila.' }, { status: 400 });
  try {
    const t = await join(shop, String(body.barberId), name, phone || null, 'qr');
    return NextResponse.json({ token: t.token });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Não deu para entrar na fila.' }, { status: 400 });
  }
}
