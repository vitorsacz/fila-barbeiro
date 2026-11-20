import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { shopPublic, shopBySlug } from '@/lib/queue';
import JoinClient from './JoinClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await shopBySlug(slug);
  return { title: s ? `Fila · ${s.name}` : 'Fila' };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await shopPublic(slug);
  if (!data) notFound();
  return <JoinClient slug={slug} initial={data} />;
}
