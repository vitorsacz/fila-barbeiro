import { isAdmin } from '@/lib/auth';
import AdminClient from './AdminClient';
import AdminLogin from './AdminLogin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administração · Na Vez', robots: { index: false } };

export default async function Page() {
  return (await isAdmin()) ? <AdminClient /> : <AdminLogin />;
}
