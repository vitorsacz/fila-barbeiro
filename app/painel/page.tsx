import { shopSessionId } from '@/lib/auth';
import { shopById } from '@/lib/queue';
import PanelClient from './PanelClient';
import ShopLogin from './ShopLogin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Painel da barbearia · Na Vez', robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const id = await shopSessionId();
  const shop = id ? await shopById(id) : null;
  if (!shop) return <ShopLogin slug={b || ''} />;
  return <PanelClient />;
}
