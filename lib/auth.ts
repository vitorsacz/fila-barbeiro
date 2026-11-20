import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'crypto';

export const ADMIN_COOKIE = 'nv_admin';
export const SHOP_COOKIE = 'nv_shop';

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-change-me');

export async function setSession(name: string, payload: Record<string, any>) {
  const token = await new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('60d').sign(key());
  (await cookies()).set(name, token, {
    httpOnly: true,
    secure: !!process.env.VERCEL,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 24 * 3600,
  });
}

export async function getSession(name: string): Promise<Record<string, any> | null> {
  const c = (await cookies()).get(name)?.value;
  if (!c) return null;
  try {
    return (await jwtVerify(c, key())).payload as any;
  } catch {
    return null;
  }
}

export async function clearSession(name: string) {
  (await cookies()).delete(name);
}

export function checkAdminPassword(pw: string) {
  const real = process.env.ADMIN_PASSWORD || '';
  if (!real || !pw) return false;
  const a = Buffer.from(pw);
  const b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin() {
  return (await getSession(ADMIN_COOKIE))?.role === 'admin';
}

export async function shopSessionId(): Promise<string | null> {
  const s = await getSession(SHOP_COOKIE);
  return s?.role === 'shop' ? (s.shopId as string) : null;
}
