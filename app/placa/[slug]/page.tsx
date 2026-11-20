import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { shopBySlug } from '@/lib/queue';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await shopBySlug(slug);
  return { title: s ? `Placa · ${s.name}` : 'Placa' };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await shopBySlug(slug);
  if (!shop) notFound();
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'https';
  const url = `${proto}://${host}/f/${shop.slug}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#121417', light: '#ffffff' } });

  return (
    <main style={{ padding: '8px 16px 40px' }}>
      <div className="sign">
        <div className="pole" />
        <div className="in">
          <div className="shop">{shop.name}</div>
          <h2>Entre na fila pelo celular</h2>
          <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR Code da fila" />
          <div className="nfc">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 8.3a6 6 0 0 1 0 7.4" /><path d="M9.5 6a9.5 9.5 0 0 1 0 12" /><path d="M13 4a12.5 12.5 0 0 1 0 16" />
            </svg>
            Ou encoste o celular aqui
          </div>
          <div className="steps">
            <div><b>1</b>Escolha o barbeiro</div>
            <div><b>2</b>Deixe seu nome</div>
            <div><b>3</b>A gente avisa quando for a sua vez</div>
          </div>
          <div className="url num">{url.replace(/^https?:\/\//, '')}</div>
        </div>
      </div>
      <div className="noprint" style={{ maxWidth: 440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrintButton />
        <p className="note">
          Para o NFC, grave este endereço numa etiqueta NTAG213 (pelo app NFC Tools, por exemplo) e cole atrás da placa: {url}
        </p>
      </div>
    </main>
  );
}
