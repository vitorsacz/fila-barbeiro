import Link from 'next/link';

export default function Home() {
  return (
    <main className="login" style={{ maxWidth: 520 }}>
      <div className="card">
        <div className="pole" />
        <div className="in">
          <p className="lbl">Na Vez</p>
          <h1>Fila digital para barbearias</h1>
          <p className="muted" style={{ margin: 0 }}>
            O cliente escaneia o QR Code da barbearia, entra na fila pelo celular e recebe um aviso quando estiver chegando a vez dele.
            Sem aplicativo e sem ficar esperando sentado.
          </p>
          <Link className="btn dark block" href="/painel">Entrar no painel da barbearia</Link>
          <p className="note">É cliente? Escaneie o QR Code que está na barbearia.</p>
        </div>
      </div>
    </main>
  );
}
