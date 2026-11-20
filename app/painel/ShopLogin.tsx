'use client';

import { useState } from 'react';
import { api } from '@/lib/client';

export default function ShopLogin({ slug: s0 }: { slug: string }) {
  const [slug, setSlug] = useState(s0);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api('/api/painel', { action: 'login', slug, pin });
      location.reload();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit} noValidate>
        <div className="pole" />
        <div className="in">
          <p className="lbl">Na Vez · painel</p>
          <h1>Entrar na barbearia</h1>
          <div className="field">
            <label htmlFor="slug">Endereço da barbearia</label>
            <input className="inp" id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex.: salaodochico" autoCapitalize="none" autoCorrect="off" />
          </div>
          <div className="field">
            <label htmlFor="pin">PIN</label>
            <input className="inp num" id="pin" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="••••••" />
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn dark block" disabled={busy || !slug || pin.length < 4}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <p className="note">O login fica salvo neste aparelho por 60 dias.</p>
        </div>
      </form>
    </main>
  );
}
