'use client';

import { useState } from 'react';
import { api } from '@/lib/client';

export default function AdminLogin() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <form
        className="card"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setErr('');
          setBusy(true);
          try { await api('/api/admin', { op: 'login', password: pw }); location.reload(); }
          catch (e: any) { setErr(e.message); setBusy(false); }
        }}
      >
        <div className="pole" />
        <div className="in">
          <p className="lbl">Na Vez</p>
          <h1>Administração</h1>
          <div className="field">
            <label htmlFor="pw">Senha</label>
            <input className="inp" id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn dark block" disabled={busy || !pw}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </div>
      </form>
    </main>
  );
}
