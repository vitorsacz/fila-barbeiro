'use client';

import { useEffect, useRef, useState } from 'react';
import { api, poll, store } from '@/lib/client';
import { clockIn, fmtMin, mmss } from '@/lib/format';

type View = {
  shop: { name: string; slug: string; tolerance: number; policy: string; alertAhead: number };
  barber: { name: string; active: boolean };
  ticket: {
    code: string; firstName: string; status: string; present: boolean; position: number | null;
    etaMin: number | null; etaAtJoin: number; calledLeftMs: number | null;
  };
  notes: { id: number; kind: string; text: string; created_at: string }[];
};

type PushState = 'checking' | 'unsupported' | 'ios-install' | 'off' | 'denied' | 'on' | 'working';

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function b64ToBytes(s: string) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function TicketClient({ token, initial }: { token: string; initial: View }) {
  const [v, setV] = useState<View>(initial);
  const [at, setAt] = useState(() => Date.now());
  const [, setNow] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [push, setPush] = useState<PushState>('checking');
  const [leaving, setLeaving] = useState(false);
  const [err, setErr] = useState('');
  const seen = useRef<number>(Math.max(0, ...initial.notes.map((n) => n.id)));
  const t = v.ticket;
  const active = ['waiting', 'called', 'serving'].includes(t.status);

  function apply(nv: View) {
    setV(nv);
    setAt(Date.now());
    const fresh = nv.notes.filter((n) => n.id > seen.current);
    if (fresh.length) {
      seen.current = Math.max(...fresh.map((n) => n.id));
      setToast(fresh[0].text);
      try { navigator.vibrate?.([300, 120, 300]); } catch { /* ignora */ }
      setTimeout(() => setToast(null), 9000);
    }
  }
  const refresh = () => api<View>(`/api/t/${token}`).then(apply).catch(() => {});

  useEffect(() => {
    store.set(`nv:${initial.shop.slug}`, token);
    const stop = poll(refresh, 5000);
    const tick = setInterval(() => setNow((x) => x + 1), 1000);
    initPush();
    return () => { stop(); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!active) store.del(`nv:${v.shop.slug}`);
    const base = t.status === 'called' ? 'É a sua vez!' : t.position ? `${t.position}º na fila` : 'Na Vez';
    document.title = `${base} · ${v.shop.name}`;
  }, [active, t.status, t.position, v.shop.slug, v.shop.name]);

  async function subscribe() {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(KEY) });
    await api(`/api/t/${token}`, { action: 'subscribe', subscription: sub.toJSON() });
  }

  async function initPush() {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!KEY;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (!ok) return setPush(ios && !standalone ? 'ios-install' : 'unsupported');
    if (Notification.permission === 'denied') return setPush('denied');
    if (Notification.permission === 'granted') {
      try { await subscribe(); setPush('on'); } catch { setPush('off'); }
      return;
    }
    setPush('off');
  }

  async function enablePush() {
    setPush('working');
    try {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return setPush(p === 'denied' ? 'denied' : 'off');
      await subscribe();
      setPush('on');
    } catch {
      setPush('off');
      setErr('Não deu para ligar os avisos neste navegador. Deixe esta página aberta que ela também avisa.');
    }
  }

  async function act(action: string) {
    setErr('');
    try { apply(await api<View>(`/api/t/${token}`, { action })); } catch (e: any) { setErr(e.message); }
    setLeaving(false);
  }

  const elapsed = Date.now() - at;
  const eta = t.etaMin != null ? Math.max(0, t.etaMin - elapsed / 60000) : null;
  const left = t.calledLeftMs != null ? t.calledLeftMs - elapsed : null;
  const ahead = t.position ? t.position - 1 : 0;
  const prog = eta != null ? Math.min(96, Math.max(4, (1 - eta / Math.max(t.etaAtJoin, 1)) * 100)) : 0;

  return (
    <div className="phone">
      <div className="pole" />
      {toast && (
        <div className="toast" role="status" onClick={() => setToast(null)}>
          <b>{v.shop.name}</b>
          {toast}
        </div>
      )}
      <header className="ph-head">
        <div className="shop">{v.shop.name}</div>
        <small>Olá, {t.firstName}</small>
      </header>
      <div className="ph-body">
        {t.status === 'waiting' && (
          <>
            <div className="ticket">
              <div className="pole" />
              <div className="tin">
                <div className="who">Você é o</div>
                <div className="pos num">{t.position}<sup>º</sup></div>
                <div className="who">
                  na fila de {v.barber.name} · {ahead === 0 ? 'você é o próximo' : `${ahead} ${ahead === 1 ? 'pessoa' : 'pessoas'} na sua frente`}
                </div>
                <div className="bar"><i style={{ width: `${prog}%` }} /></div>
                <div className="trow">
                  <div><div className="k">Previsão</div><div className="v num">{eta != null ? clockIn(eta) : '—'}</div></div>
                  <div><div className="k">Falta</div><div className="v num">{fmtMin(eta)}</div></div>
                  <div><div className="k">Senha</div><div className="v num">{t.code}</div></div>
                </div>
              </div>
            </div>
            {!v.barber.active && <div className="banner">{v.barber.name} pausou a fila por um momento. Seu lugar está guardado.</div>}
            {t.present ? (
              <div className="here">✓ Você avisou que está na barbearia</div>
            ) : (
              <button className="btn dark block" onClick={() => act('present')}>Já estou na barbearia</button>
            )}
          </>
        )}

        {t.status === 'called' && (
          <>
            <div className="ticket call">
              <div className="pole" />
              <div className="tin">
                <div className="big-msg">É a sua vez!</div>
                <div className="who" style={{ marginTop: 8 }}>{v.barber.name} está te esperando.</div>
                <div className="trow">
                  <div><div className="k">Chegue em</div><div className="v num">{left != null ? mmss(left) : '—'}</div></div>
                  <div><div className="k">Senha</div><div className="v num">{t.code}</div></div>
                </div>
              </div>
            </div>
            {t.present ? (
              <div className="here">✓ Avisamos que você chegou</div>
            ) : (
              <button className="btn dark block" onClick={() => act('present')}>Cheguei</button>
            )}
          </>
        )}

        {t.status === 'serving' && (
          <div className="state"><div className="big-msg">Na cadeira</div><p className="note">Bom corte, {t.firstName}!</p></div>
        )}

        {['done', 'noshow', 'left'].includes(t.status) && (
          <>
            <div className="state">
              <div className="big-msg">
                {t.status === 'done' ? 'Até a próxima!' : t.status === 'noshow' ? 'Sua vez passou' : 'Você saiu da fila'}
              </div>
              <p className="note">
                {t.status === 'done' ? 'Valeu pela visita.' : t.status === 'noshow' ? 'Você não chegou a tempo e saiu da fila.' : 'Seu lugar foi liberado para o próximo.'}
              </p>
            </div>
            <a className="btn primary block" href={`/f/${v.shop.slug}`}>Entrar na fila de novo</a>
          </>
        )}

        {(t.status === 'waiting' || t.status === 'called') && (
          <>
            <PushBox state={push} onEnable={enablePush} alertAhead={v.shop.alertAhead} />
            {leaving ? (
              <div className="state">
                <b>Sair da fila?</b>
                <p className="note" style={{ margin: '4px 0 10px' }}>Você perde o seu lugar.</p>
                <div className="chan">
                  <button onClick={() => setLeaving(false)}>Continuar</button>
                  <button className="on" onClick={() => act('leave')}>Sair</button>
                </div>
              </div>
            ) : (
              <button className="link" style={{ alignSelf: 'center' }} onClick={() => setLeaving(true)}>Sair da fila</button>
            )}
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        <p className="note" style={{ marginTop: 'auto' }}>
          Quando for chamado, você tem {v.shop.tolerance} min para chegar.{' '}
          {v.shop.policy === 'back' ? 'Se não chegar, volta 2 lugares (uma vez).' : 'Se não chegar, sai da fila.'}
        </p>
      </div>
    </div>
  );
}

function PushBox({ state, onEnable, alertAhead }: { state: PushState; onEnable: () => void; alertAhead: number }) {
  if (state === 'checking') return null;
  if (state === 'on')
    return <div className="here">🔔 Avisos ligados: você recebe uma notificação quando faltar{alertAhead > 1 ? 'em' : ''} {alertAhead} pessoa{alertAhead > 1 ? 's' : ''} e quando for sua vez.</div>;
  if (state === 'ios-install')
    return (
      <div className="state">
        <b>Quer receber o aviso no iPhone?</b>
        <p className="note" style={{ marginTop: 4 }}>
          Toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. Abra pelo ícone e ligue os avisos.
          Se preferir, é só deixar esta página aberta: ela se atualiza sozinha.
        </p>
      </div>
    );
  if (state === 'unsupported')
    return <div className="state"><p className="note">Deixe esta página aberta: ela se atualiza sozinha e vibra quando for sua vez.</p></div>;
  if (state === 'denied')
    return <div className="state"><p className="note">Os avisos estão bloqueados neste navegador. Deixe esta página aberta para acompanhar.</p></div>;
  return (
    <button className="btn primary block" onClick={onEnable} disabled={state === 'working'}>
      {state === 'working' ? 'Ligando…' : '🔔 Me avise quando for a minha vez'}
    </button>
  );
}
