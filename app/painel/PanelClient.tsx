'use client';

import { useEffect, useRef, useState } from 'react';
import { api, poll, store } from '@/lib/client';
import { clockIn, clockAt, fmtMin, initials, maskPhone, mmss } from '@/lib/format';

type T = {
  id: string; code: string; name: string; phone: string | null; status: string; present: boolean; skips: number;
  source: string; push: boolean; startedAt: number; calledLeftMs: number | null; etaMin?: number;
};
type B = { id: string; name: string; avg: number; active: boolean; doneToday: number; serving: T | null; queue: T[]; waitMin: number };
type S = {
  serverNow: number;
  shop: { id: string; name: string; slug: string; status: string; tolerance: number; policy: string; alertAhead: number };
  barbers: B[];
  log: { id: number; kind: string; text: string; created_at: string }[];
};

export default function PanelClient() {
  const [s, setS] = useState<S | null>(null);
  const [at, setAt] = useState(0);
  const [, setTick] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<'fila' | 'ajustes'>('fila');
  const [qName, setQName] = useState('');
  const [qPhone, setQPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  function apply(ns: S) {
    setS(ns);
    setAt(Date.now());
  }
  const load = () => {
    if (busyRef.current) return;
    api<S>('/api/painel').then(apply).catch((e) => { if (e.status === 401) location.reload(); });
  };

  useEffect(() => {
    setSel(store.get('nv:barber'));
    load();
    const stop = poll(load, 4000);
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => { stop(); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(action: string, extra: Record<string, any> = {}) {
    setErr('');
    setBusy(true);
    busyRef.current = true;
    try {
      apply(await api<S>('/api/painel', { action, ...extra }));
      return true;
    } catch (e: any) {
      setErr(e.message);
      return false;
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  if (!s) return <main className="wrap"><p className="muted">Carregando a fila…</p></main>;

  const b = s.barbers.find((x) => x.id === sel) || s.barbers[0];
  const elapsed = Date.now() - at;
  const now = s.serverNow + elapsed;
  const called = b?.queue.find((t) => t.status === 'called');
  const waiting = b?.queue.filter((t) => t.status === 'waiting') || [];
  const pick = (id: string) => { setSel(id); store.set('nv:barber', id); };

  return (
    <>
      <div className="top">
        <div className="pole" />
        <div className="top-in">
          <div className="brand"><b>{s.shop.name}</b><span>Painel da barbearia · Na Vez</span></div>
          <nav className="tabs" aria-label="Seções">
            <button className={tab === 'fila' ? 'on' : ''} onClick={() => setTab('fila')}>Fila</button>
            <button className={tab === 'ajustes' ? 'on' : ''} onClick={() => setTab('ajustes')}>Ajustes</button>
            <a href={`/placa/${s.shop.slug}`} target="_blank" rel="noreferrer">Placa QR</a>
          </nav>
          <button className="link" onClick={() => api('/api/painel', { action: 'logout' }).finally(() => location.reload())}>Sair</button>
        </div>
      </div>

      <main className="wrap stack">
        {err && <p className="err" role="alert">{err}</p>}
        {s.shop.status === 'suspensa' && <div className="banner">A fila pelo celular está suspensa. Fale com o administrador do Na Vez.</div>}

        {tab === 'fila' && b && (
          <>
            <div className="chips">
              {s.barbers.map((x) => (
                <button key={x.id} className={`chip ${x.id === b.id ? 'on' : ''} ${x.active ? '' : 'off'}`} onClick={() => pick(x.id)} aria-pressed={x.id === b.id}>
                  <span className="av">{initials(x.name)}</span>{x.name}<span className="cnt num">{x.queue.length}</span>
                </button>
              ))}
            </div>

            <div className="card stack">
              <div className="phead">
                <h2>{b.name}</h2>
                <div className="stepper">
                  Tempo médio
                  <button onClick={() => act('avg', { barberId: b.id, value: b.avg - 5 })} aria-label="Diminuir tempo médio">−</button>
                  <span className="num">{b.avg} min</span>
                  <button onClick={() => act('avg', { barberId: b.id, value: b.avg + 5 })} aria-label="Aumentar tempo médio">+</button>
                </div>
                <button className="switch" role="switch" aria-checked={b.active} onClick={() => act('toggle', { barberId: b.id })}>
                  <span className="tr" />{b.active ? 'Recebendo fila' : 'Fila pausada'}
                </button>
              </div>
              <div className="stats">
                <div className="stat"><div className="k">Na fila</div><div className="v num">{b.queue.length}</div></div>
                <div className="stat"><div className="k">Quem entra agora</div><div className="v num">{fmtMin(Math.max(0, b.waitMin - elapsed / 60000))}</div></div>
                <div className="stat"><div className="k">Atendidos hoje</div><div className="v num">{b.doneToday}</div></div>
              </div>
            </div>

            {!b.active && <div className="banner">Fila pausada: ninguém novo entra com {b.name} pelo QR Code. Quem já está na fila continua.</div>}

            <div className="grid2">
              {b.serving ? (
                <div className="card chair">
                  <div className="lbl">Na cadeira</div>
                  <div className="who">{b.serving.name}</div>
                  <div className="meta num">Cortando há <b>{Math.max(0, Math.floor((now - b.serving.startedAt) / 60000))} min</b> · média {b.avg} min</div>
                  <div className="acts"><button className="btn primary block" disabled={busy} onClick={() => act('finish', { barberId: b.id })}>Terminei o corte</button></div>
                </div>
              ) : (
                <div className="card chair">
                  <div className="lbl">Na cadeira</div>
                  <div className="who muted">Cadeira livre</div>
                  <div className="meta">{called ? 'Esperando o cliente chamado sentar.' : b.queue.length ? 'Chame o próximo da fila.' : 'Ninguém na fila agora.'}</div>
                  {!called && b.queue.length > 0 && (
                    <div className="acts"><button className="btn primary block" disabled={busy} onClick={() => act('callnext', { barberId: b.id })}>Chamar próximo</button></div>
                  )}
                </div>
              )}

              {called ? (
                <div className="card chair called">
                  <div className="lbl" style={{ color: 'var(--accent)' }}>Chamado · aguardando</div>
                  <div className="who">{called.name}</div>
                  <div className="meta num">
                    {called.present ? <span className="pill ok"><i className="dot" /> Já está na barbearia</span> : <>Tempo para chegar: <b>{mmss((called.calledLeftMs ?? 0) - elapsed)}</b></>}
                    {!called.push && !called.present && <> · <span className="pill warn">sem aviso no celular</span></>}
                  </div>
                  <div className="acts">
                    <button className="btn dark" disabled={busy} onClick={() => act('start', { ticketId: called.id })}>Sentou, começar</button>
                    <button className="btn" disabled={busy} onClick={() => act('noshow', { ticketId: called.id })}>Não veio</button>
                  </div>
                </div>
              ) : (
                <div className="card chair">
                  <div className="lbl">Próximo</div>
                  {waiting[0] ? (
                    <>
                      <div className="who">{waiting[0].name}</div>
                      <div className="meta">É chamado automaticamente quando você terminar o corte atual.</div>
                    </>
                  ) : (
                    <>
                      <div className="who muted">Fila vazia</div>
                      <div className="meta">Quem escanear o QR Code entra aqui.</div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="card">
              <div className="lbl">Fila de {b.name}</div>
              {b.queue.length ? (
                <ol className="qlist">
                  {b.queue.map((t, i) => {
                    const isCalled = t.status === 'called';
                    const eta = Math.max(0, (t.etaMin ?? 0) - elapsed / 60000);
                    return (
                      <li className="qrow" key={t.id}>
                        <div className="p num">{i + 1}</div>
                        <div>
                          <div className="n">{t.name}</div>
                          <div className="s">
                            <span className="num">{t.code}</span>
                            {t.phone && <span className="num hide-sm">· {t.phone}</span>}
                            {isCalled && <span className="pill red">Chamado</span>}
                            {t.present && <span className="pill ok">Na barbearia</span>}
                            {t.push && <span className="pill">🔔 avisos</span>}
                            {t.skips > 0 && <span className="pill warn">Já perdeu a vez</span>}
                            {t.source === 'balcao' && <span className="pill">Balcão</span>}
                          </div>
                        </div>
                        <div className="eta num">
                          {isCalled ? (
                            <>{mmss((t.calledLeftMs ?? 0) - elapsed)}<small>p/ chegar</small></>
                          ) : (
                            <>{clockIn(eta)}<small>{fmtMin(eta)}</small></>
                          )}
                        </div>
                        <div className="ac">
                          <button className="ib" disabled={busy || i === 0 || isCalled || b.queue[i - 1]?.status === 'called'} onClick={() => act('up', { ticketId: t.id })} aria-label={`Subir ${t.name}`}>↑</button>
                          <button className="ib" disabled={busy || i === b.queue.length - 1 || isCalled} onClick={() => act('down', { ticketId: t.id })} aria-label={`Descer ${t.name}`}>↓</button>
                          <button className="ib" disabled={busy} onClick={() => { if (confirmRemove(t.name)) act('remove', { ticketId: t.id }); }} aria-label={`Tirar ${t.name} da fila`}>✕</button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="muted">Ninguém esperando.</p>
              )}
              <form
                className="add"
                noValidate
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (qName.trim().length < 2) return setErr('Digite o nome de quem chegou.');
                  if (await act('add', { barberId: b.id, name: qName.trim(), phone: qPhone })) { setQName(''); setQPhone(''); }
                }}
              >
                <input className="inp sm" value={qName} onChange={(e) => setQName(e.target.value)} placeholder="Nome de quem chegou" aria-label="Nome" maxLength={40} />
                <input className="inp sm num" value={qPhone} onChange={(e) => setQPhone(maskPhone(e.target.value))} inputMode="tel" placeholder="Celular (opcional)" aria-label="Celular" />
                <button className="btn dark" type="submit" disabled={busy}>+ Pôr na fila</button>
              </form>
            </div>

            <div className="card">
              <div className="lbl">Movimento de hoje</div>
              {s.log.length ? (
                <ul className="log">
                  {s.log.map((m) => (
                    <li key={m.id} className={m.kind}>
                      <div className="h num">{clockAt(m.created_at)}</div>{m.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nada ainda.</p>
              )}
            </div>
          </>
        )}

        {tab === 'ajustes' && <Settings s={s} act={act} busy={busy} />}
      </main>
    </>
  );
}

function confirmRemove(name: string) {
  try { return window.confirm(`Tirar ${name} da fila?`); } catch { return true; }
}

function Settings({ s, act, busy }: { s: S; act: (a: string, x?: any) => Promise<boolean>; busy: boolean }) {
  const [tol, setTol] = useState(s.shop.tolerance);
  const [pol, setPol] = useState(s.shop.policy);
  const [al, setAl] = useState(s.shop.alertAhead);
  const [nb, setNb] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <div className="card stack">
        <h2 style={{ fontSize: 32, textTransform: 'uppercase' }}>Regras da fila</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="s-tol">Tempo para chegar quando chamado</label>
            <select className="inp" id="s-tol" value={tol} onChange={(e) => setTol(+e.target.value)}>
              {[3, 5, 8, 10, 15].map((v) => <option key={v} value={v}>{v} minutos</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="s-al">Aviso de “vá se aproximando”</label>
            <select className="inp" id="s-al" value={al} onChange={(e) => setAl(+e.target.value)}>
              {[1, 2, 3, 4].map((v) => <option key={v} value={v}>Quando faltar{v > 1 ? 'em' : ''} {v} pessoa{v > 1 ? 's' : ''}</option>)}
            </select>
          </div>
        </div>
        <div className="lbl" style={{ marginTop: 6 }}>Se o cliente não chegar a tempo</div>
        <div className="form-grid">
          <label className={`opt ${pol === 'back' ? 'on' : ''}`}>
            <input type="radio" name="pol" checked={pol === 'back'} onChange={() => setPol('back')} />
            <span><b>Volta 2 lugares</b><br /><span className="note">Uma segunda chance. Na segunda vez, sai da fila.</span></span>
          </label>
          <label className={`opt ${pol === 'out' ? 'on' : ''}`}>
            <input type="radio" name="pol" checked={pol === 'out'} onChange={() => setPol('out')} />
            <span><b>Sai da fila</b><br /><span className="note">Mais rígido, a fila anda mais rápido.</span></span>
          </label>
        </div>
        <div className="row">
          <button className="btn dark" disabled={busy} onClick={async () => { if (await act('settings', { tolerance: tol, policy: pol, alertAhead: al })) { setSaved(true); setTimeout(() => setSaved(false), 2500); } }}>Salvar regras</button>
          {saved && <span className="pill ok">Salvo</span>}
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ fontSize: 32, textTransform: 'uppercase' }}>Barbeiros</h2>
        <div className="tblwrap">
          <table>
            <thead><tr><th>Nome</th><th>Tempo médio</th><th>Recebendo fila</th><th /></tr></thead>
            <tbody>
              {s.barbers.map((b) => (
                <tr key={b.id}>
                  <td style={{ minWidth: 180 }}>
                    <input className="inp sm" value={names[b.id] ?? b.name} aria-label="Nome do barbeiro"
                      onChange={(e) => setNames({ ...names, [b.id]: e.target.value })}
                      onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== b.name) act('barberRename', { barberId: b.id, name: e.target.value }); }} />
                  </td>
                  <td>
                    <select className="inp sm" value={b.avg} aria-label={`Tempo médio de ${b.name}`} onChange={(e) => act('avg', { barberId: b.id, value: +e.target.value })}>
                      {[10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90].map((v) => <option key={v} value={v}>{v} min</option>)}
                    </select>
                  </td>
                  <td><button className="switch" role="switch" aria-checked={b.active} onClick={() => act('toggle', { barberId: b.id })}><span className="tr" /></button></td>
                  <td className="right">
                    <button className="btn sm" disabled={busy || b.queue.length > 0 || !!b.serving} title={b.queue.length || b.serving ? 'Tem gente na fila' : ''}
                      onClick={() => { if (window.confirm(`Remover ${b.name}?`)) act('barberDelete', { barberId: b.id }); }}>Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="add" style={{ gridTemplateColumns: '1fr auto' }} noValidate
          onSubmit={async (e) => { e.preventDefault(); if (await act('barberAdd', { name: nb })) setNb(''); }}>
          <input className="inp sm" value={nb} onChange={(e) => setNb(e.target.value)} placeholder="Nome do novo barbeiro" aria-label="Nome do novo barbeiro" />
          <button className="btn" type="submit" disabled={busy}>+ Adicionar barbeiro</button>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ fontSize: 32, textTransform: 'uppercase' }}>Link da fila</h2>
        <p className="note">É para este endereço que o QR Code e a etiqueta NFC apontam.</p>
        <code className="num" style={{ fontSize: 15, wordBreak: 'break-all' }}>{typeof window !== 'undefined' ? `${location.origin}/f/${s.shop.slug}` : `/f/${s.shop.slug}`}</code>
        <div className="row"><a className="btn" href={`/placa/${s.shop.slug}`} target="_blank" rel="noreferrer">Abrir placa para imprimir</a></div>
      </div>
    </div>
  );
}
