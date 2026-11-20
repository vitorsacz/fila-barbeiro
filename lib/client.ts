'use client';

/** fetch com JSON e mensagem de erro em português. */
export async function api<T = any>(url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const e: any = new Error(data?.error || 'Sem conexão. Tente de novo.');
    e.status = res.status;
    throw e;
  }
  return data as T;
}

/** Repete fn a cada ms enquanto a aba estiver visível; atualiza na hora quando ela volta. */
export function poll(fn: () => void, ms: number) {
  let id: any = setInterval(() => { if (document.visibilityState === 'visible') fn(); }, ms);
  const onVis = () => { if (document.visibilityState === 'visible') fn(); };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('focus', onVis);
  return () => { clearInterval(id); id = null; document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); };
}

export const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignora */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* ignora */ } },
};
