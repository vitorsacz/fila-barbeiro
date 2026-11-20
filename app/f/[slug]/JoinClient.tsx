'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, poll, store } from '@/lib/client';
import { fmtMin, initials, maskPhone } from '@/lib/format';

type Barber = { id: string; name: string; active: boolean; inQueue: number; waitMin: number; free: boolean };
type Data = { name: string; slug: string; open: boolean; tolerance: number; policy: string; barbers: Barber[] };

export default function JoinClient({ slug, initial }: { slug: string; initial: Data }) {
  const router = useRouter();
  const [data, setData] = useState<Data>(initial);
  const [pick, setPick] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<string | null>(null);

  useEffect(() => {
    setName(store.get('nv:name') || '');
    const tok = store.get(`nv:${slug}`);
    if (tok) {
      api(`/api/t/${tok}`)
        .then((v) => (['waiting', 'called', 'serving'].includes(v.ticket.status) ? setMine(tok) : store.del(`nv:${slug}`)))
        .catch(() => store.del(`nv:${slug}`));
    }
    return poll(() => api<Data>(`/api/f/${slug}`).then(setData).catch(() => {}), 15000);
  }, [slug]);

  const barber = data.barbers.find((b) => b.id === pick);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (name.trim().length < 2) return setErr('Digite seu nome para entrar na fila.');
    const digits = phone.replace(/\D/g, '');
    if (digits && digits.length < 10) return setErr('Confira o celular: precisa do DDD e do número. Ou deixe em branco.');
    setBusy(true);
    try {
      const r = await api<{ token: string }>(`/api/f/${slug}`, { barberId: pick, name: name.trim(), phone });
      store.set(`nv:${slug}`, r.token);
      store.set('nv:name', name.trim());
      router.push(`/t/${r.token}?novo=1`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  if (!data.open) {
    return (
      <div className="phone">
        <div className="pole" />
        <header className="ph-head"><div className="shop">{data.name}</div></header>
        <div className="ph-body"><div className="state"><b>A fila pelo celular está desligada agora.</b><p className="note">Fale direto com o barbeiro no balcão.</p></div></div>
      </div>
    );
  }

  return (
    <div className="phone">
      <div className="pole" />
      {!barber ? (
        <>
          <header className="ph-head">
            <div className="shop">{data.name}</div>
            <small>Escolha com quem você quer cortar</small>
          </header>
          <div className="ph-body">
            {mine && (
              <a className="btn primary block" href={`/t/${mine}`}>Você já está na fila · ver minha posição</a>
            )}
            {data.barbers.map((b) => (
              <button key={b.id} className="bcard" disabled={!b.active} onClick={() => setPick(b.id)}>
                <span className="av">{initials(b.name)}</span>
                <span>
                  <span className="nm">{b.name}</span>
                  <br />
                  {!b.active ? (
                    <span className="sub">Não está atendendo agora</span>
                  ) : b.free ? (
                    <span className="pill ok"><i className="dot" /> Livre agora</span>
                  ) : (
                    <span className="sub num">{b.inQueue} na fila · espera <b>{fmtMin(b.waitMin)}</b></span>
                  )}
                </span>
                <span className="chev" aria-hidden="true">›</span>
              </button>
            ))}
            <p className="note">
              Você entra na fila pelo celular e recebe um aviso quando estiver perto da sua vez. Não precisa ficar esperando aqui.
            </p>
          </div>
        </>
      ) : (
        <>
          <header className="ph-head">
            <button className="link" onClick={() => { setPick(null); setErr(''); }}>‹ Voltar</button>
            <div className="shop" style={{ marginTop: 6 }}>Fila de {barber.name}</div>
            <small className="num">
              {barber.inQueue} {barber.inQueue === 1 ? 'pessoa' : 'pessoas'} na frente · previsão {fmtMin(barber.waitMin)}
            </small>
          </header>
          <form className="ph-body" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="f-name">Seu nome</label>
              <input className="inp" id="f-name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como chamamos você?" maxLength={40} />
            </div>
            <div className="field">
              <label htmlFor="f-phone">Celular <span className="muted">(opcional)</span></label>
              <input className="inp num" id="f-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 90000-0000" />
            </div>
            {err && <p className="err" role="alert">{err}</p>}
            <button className="btn primary block" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar na fila'}</button>
            <p className="note">
              Quando for sua vez você terá <b>{data.tolerance} min</b> para chegar.{' '}
              {data.policy === 'back' ? 'Se não chegar, volta 2 lugares na fila (só uma vez).' : 'Se não chegar, sai da fila.'}
            </p>
          </form>
        </>
      )}
    </div>
  );
}
