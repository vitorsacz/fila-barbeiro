import { notFound } from 'next/navigation';
import { ticketView } from '@/lib/queue';
import TicketClient from './TicketClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Minha vez · Na Vez', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await ticketView(token);
  if (!data) notFound();
  return <TicketClient token={token} initial={data} />;
}
