'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { brl, monthLabel, slugify } from '@/lib/format';

type Shop = {
  id: string; slug: string; name: string; owner_name: string | null; owner_phone: string | null;
  monthly_price_cents: number; billing_day: number; status: string; started_at: string; created_at: string;
  barbers: number; today: number; last30: number; waiting: number; last_use: string | null; paid_this_month: boolean;
};
type Pay = { id: number; shop_id: string; shop: string; ref_month: string; amount_cents: number; paid_at: string; method: string; note: string | null };
type Data = { shops: Shop[]; months: { month: string; total: number }[]; payments: Pay[] };

const STATUS: Record<string, [string, string]> = {
  ativa: ['Ativa', 'ok'], teste: ['Em teste', 'warn'], suspensa: ['Suspensa', 'bad'], cancelada: ['Cancelada', ''],
};
const curMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const priceIn = (c: number) => (c ? (c / 100).toFixed(2).replace('.', ',') : '');

export default function AdminClient() {
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [err, setErr] = useState('');

  const load = () => api<Data>('/api/admin').then(setD).catch((e) => (e.status === 401 ? location.reload() : setErr(e.message)));
  useEffect(() => { load(); }, []);

  async function op(body: any) {
    setErr('');
    try { setD(await api<Data>('/api/admin', body)); return true; } catch (e: any) { setErr(e.message); return false; }
  }

  if (!d) return <main className="wrap"><p className="muted">Carregando…</p>{err && <p className="err">{err}</p>}</main>;

  const ativas = d.shops.filter((s) => s.status === 'ativa');
  const teste = d.shops.filter((s) => s.status === 'teste');
  const mrr = ativas.reduce((a, s) => a + s.monthly_price_cents, 0);
  const received = d.months[d.months.length - 1]?.total || 0;
  const pending = ativas.filter((s) => !s.paid_this_month);
  const pendingSum = pending.reduce((a, s) => a + s.monthly_price_cents, 0);
  const visits30 = d.shops.reduce((a, s) => a + s.last30, 0);
  const max = Math.max(1, ...d.months.map((m) => m.total), mrr);
  const shop = open && open !== 'new' ? d.shops.find((s) => s.id === open) : null;

  return (
    <>
      <div className="top">
        <div className="pole" />
        <div className="top-in">
          <div className="brand"><b>Na Vez</b><span>Administração</span></div>
          <button className="btn dark sm" onClick={() => setOpen('new')}>+ Nova barbearia</button>
          <button className="link" onClick={() => api('/api/admin', { op: 'logout' }).finally(() => location.reload())}>Sair</button>
        </div>
      </div>
      <main className="wrap stack">
        {err && !open && <p className="err" role="alert">{err}</p>}

        <div className="stats">
          <div className="stat"><div className="k">Barbearias pagantes</div><div className="v num">{ativas.length}</div><div className="s">{teste.length} em teste · {d.shops.length} no total</div></div>
          <div className="stat"><div className="k">Receita mensal</div><div className="v num">{brl(mrr)}</div><div className="s">{brl(mrr * 12)} por ano</div></div>
          <div className="stat"><div className="k">Recebido em {monthLabel(curMonth() + '-01')}</div><div className="v num">{brl(received)}</div><div className="s">{mrr ? Math.round((received / mrr) * 100) : 0}% da receita mensal</div></div>
          <div className="stat"><div className="k">A receber este mês</div><div className="v num" style={{ color: pendingSum ? 'var(--warn)' : undefined }}>{brl(pendingSum)}</div><div className="s">{pending.length ? `${pending.length} barbearia${pending.length > 1 ? 's' : ''} pendente${pending.length > 1 ? 's' : ''}` : 'Tudo em dia'}</div></div>
          <div className="stat"><div className="k">Clientes na fila (30 dias)</div><div className="v num">{visits30}</div><div className="s">em todas as barbearias</div></div>
        </div>

        <div className="card">
          <div className="lbl">Recebido por mês</div>
          <div className="bars">
            {d.months.map((m, i) => (
              <div key={m.month} className={`b ${i === d.months.length - 1 ? 'cur' : ''}`}>
                <em className="num">{m.total ? brl(m.total).replace(',00', '') : ''}</em>
                <i style={{ height: `${(m.total / max) * 100}%` }} />
                <span>{monthLabel(m.month)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="lbl">Barbearias</div>
          {d.shops.length ? (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr><th>Barbearia</th><th>Situação</th><th className="right">Mensalidade</th><th>Este mês</th><th className="right">Barbeiros</th><th className="right">Fila hoje</th><th className="right">30 dias</th><th>Último uso</th></tr>
                </thead>
                <tbody>
                  {d.shops.map((s) => (
                    <tr key={s.id} className="click" onClick={() => setOpen(s.id)}>
                      <td><b>{s.name}</b><div className="note">/{s.slug}{s.owner_name ? ` · ${s.owner_name}` : ''}</div></td>
                      <td><span className={`pill ${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span></td>
                      <td className="right num">{s.monthly_price_cents ? brl(s.monthly_price_cents) : <span className="muted">definir</span>}<div className="note">dia {s.billing_day}</div></td>
                      <td>{s.status !== 'ativa' ? <span className="muted">—</span> : s.paid_this_month ? <span className="pill ok">Pago</span> : <span className="pill warn">Pendente</span>}</td>
                      <td className="right num">{s.barbers}</td>
                      <td className="right num">{s.today}{s.waiting ? <div className="note">{s.waiting} esperando</div> : null}</td>
                      <td className="right num">{s.last30}</td>
                      <td className="num">{fmtDate(s.last_use)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Nenhuma barbearia ainda.</p>
          )}
        </div>

        <div className="card">
          <div className="lbl">Últimos pagamentos</div>
          {d.payments.length ? (
            <div className="tblwrap">
              <table>
                <thead><tr><th>Barbearia</th><th>Referente a</th><th>Pago em</th><th>Forma</th><th className="right">Valor</th></tr></thead>
                <tbody>
                  {d.payments.slice(0, 12).map((p) => (
                    <tr key={p.id}><td>{p.shop}</td><td>{monthLabel(p.ref_month + '-01')}</td><td className="num">{p.paid_at}</td><td>{p.method}</td><td className="right num">{brl(p.amount_cents)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Nenhum pagamento registrado. Abra uma barbearia e registre quando receber.</p>
          )}
        </div>
      </main>

      {open && (
        <div className="drawer-bg" onClick={(e) => { if (e.target === e.currentTarget) { setOpen(null); setErr(''); } }}>
          <aside className="drawer" role="dialog" aria-modal="true">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 32, textTransform: 'uppercase' }}>{shop ? shop.name : 'Nova barbearia'}</h2>
              <button className="btn sm" onClick={() => { setOpen(null); setErr(''); }}>Fechar</button>
            </div>
            {err && <p className="err" role="alert">{err}</p>}
            <ShopForm key={open} shop={shop} onSave={async (body) => { if (await op(body)) { if (!shop) setOpen(null); return true; } return false; }} />
            {shop && <Links slug={shop.slug} />}
            {shop && <Payments shop={shop} pays={d.payments.filter((p) => p.shop_id === shop.id)} op={op} />}
          </aside>
        </div>
      )}
    </>
  );
}

function ShopForm({ shop, onSave }: { shop: Shop | null | undefined; onSave: (b: any) => Promise<boolean> }) {
  const [f, setF] = useState({
    name: shop?.name || '', slug: shop?.slug || '', owner_name: shop?.owner_name || '', owner_phone: shop?.owner_phone || '',
    price: priceIn(shop?.monthly_price_cents || 0), billing_day: shop?.billing_day || 10, status: shop?.status || 'teste',
    pin: '', barbers: '',
  });
  const [ok, setOk] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <form className="card stack" noValidate onSubmit={async (e) => {
      e.preventDefault();
      const done = await onSave(shop ? { op: 'updateShop', id: shop.id, ...f } : { op: 'createShop', ...f });
      if (done && shop) { setOk(true); setF({ ...f, pin: '' }); setTimeout(() => setOk(false), 2500); }
    }}>
      <div className="form-grid">
        <div className="field"><label htmlFor="a-name">Nome</label><input className="inp sm" id="a-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: shop ? f.slug : slugify(e.target.value).replace(/-/g, '') })} /></div>
        <div className="field"><label htmlFor="a-slug">Endereço (slug)</label><input className="inp sm" id="a-slug" value={f.slug} onChange={set('slug')} disabled={!!shop} /></div>
        <div className="field"><label htmlFor="a-own">Responsável</label><input className="inp sm" id="a-own" value={f.owner_name} onChange={set('owner_name')} /></div>
        <div className="field"><label htmlFor="a-ph">Telefone</label><input className="inp sm num" id="a-ph" value={f.owner_phone} onChange={set('owner_phone')} inputMode="tel" /></div>
        <div className="field"><label htmlFor="a-price">Mensalidade (R$)</label><input className="inp sm num" id="a-price" value={f.price} onChange={set('price')} inputMode="decimal" placeholder="0,00" /></div>
        <div className="field"><label htmlFor="a-day">Dia de vencimento</label><input className="inp sm num" id="a-day" type="number" min={1} max={28} value={f.billing_day} onChange={set('billing_day')} /></div>
        <div className="field">
          <label htmlFor="a-st">Situação</label>
          <select className="inp sm" id="a-st" value={f.status} onChange={set('status')}>
            <option value="teste">Em teste</option><option value="ativa">Ativa (pagante)</option>
            {shop && <option value="suspensa">Suspensa (fila desligada)</option>}
            {shop && <option value="cancelada">Cancelada</option>}
          </select>
        </div>
        <div className="field"><label htmlFor="a-pin">{shop ? 'Novo PIN (opcional)' : 'PIN do painel'}</label><input className="inp sm num" id="a-pin" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 8) })} inputMode="numeric" placeholder="4 a 8 números" /></div>
      </div>
      {!shop && (
        <div className="field"><label htmlFor="a-barb">Barbeiros (separados por vírgula)</label><input className="inp sm" id="a-barb" value={f.barbers} onChange={set('barbers')} placeholder="Léo, Seu Chico" /></div>
      )}
      <div className="row">
        <button className="btn dark" type="submit">{shop ? 'Salvar alterações' : 'Criar barbearia'}</button>
        {ok && <span className="pill ok">Salvo</span>}
      </div>
    </form>
  );
}

function Links({ slug }: { slug: string }) {
  return (
    <div className="card stack">
      <div className="lbl">Links</div>
      <div className="row">
        <a className="btn sm" href={`/f/${slug}`} target="_blank" rel="noreferrer">Fila do cliente</a>
        <a className="btn sm" href={`/painel?b=${slug}`} target="_blank" rel="noreferrer">Painel da barbearia</a>
        <a className="btn sm" href={`/placa/${slug}`} target="_blank" rel="noreferrer">Placa QR</a>
      </div>
    </div>
  );
}

function Payments({ shop, pays, op }: { shop: Shop; pays: Pay[]; op: (b: any) => Promise<boolean> }) {
  const [p, setP] = useState({ ref_month: curMonth(), amount: priceIn(shop.monthly_price_cents), method: 'pix', paid_at: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), note: '' });
  return (
    <div className="card stack">
      <div className="lbl">Pagamentos</div>
      <form className="form-grid" noValidate onSubmit={(e) => { e.preventDefault(); op({ op: 'addPayment', shop_id: shop.id, ...p }); }}>
        <div className="field"><label htmlFor="p-m">Mês de referência</label><input className="inp sm" id="p-m" type="month" value={p.ref_month} onChange={(e) => setP({ ...p, ref_month: e.target.value })} /></div>
        <div className="field"><label htmlFor="p-v">Valor (R$)</label><input className="inp sm num" id="p-v" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} inputMode="decimal" /></div>
        <div className="field"><label htmlFor="p-d">Pago em</label><input className="inp sm" id="p-d" type="date" value={p.paid_at} onChange={(e) => setP({ ...p, paid_at: e.target.value })} /></div>
        <div className="field">
          <label htmlFor="p-f">Forma</label>
          <select className="inp sm" id="p-f" value={p.method} onChange={(e) => setP({ ...p, method: e.target.value })}>
            <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option>
          </select>
        </div>
        <div className="field" style={{ justifyContent: 'flex-end' }}><button className="btn dark" type="submit">Registrar pagamento</button></div>
      </form>
      {pays.length ? (
        <table>
          <thead><tr><th>Referente a</th><th>Pago em</th><th>Forma</th><th className="right">Valor</th><th /></tr></thead>
          <tbody>
            {pays.map((x) => (
              <tr key={x.id}>
                <td>{monthLabel(x.ref_month + '-01')}</td><td className="num">{x.paid_at}</td><td>{x.method}</td>
                <td className="right num">{brl(x.amount_cents)}</td>
                <td className="right"><button className="btn sm" onClick={() => { if (window.confirm('Apagar este pagamento?')) op({ op: 'deletePayment', id: x.id }); }}>Apagar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="note">Nenhum pagamento registrado para esta barbearia.</p>
      )}
    </div>
  );
}
