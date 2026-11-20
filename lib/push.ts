import webpush from 'web-push';
import { db } from './db';

let configured: boolean | null = null;

function ready() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@example.com', pub, priv);
    configured = true;
  } else configured = false;
  return configured;
}

/** Envia notificação para todos os navegadores inscritos naquela senha. Falhas não travam a fila. */
export async function pushTicket(ticketId: string, payload: { title: string; body: string; url: string; tag?: string }) {
  if (!ready()) return;
  const subs = await db()`select * from push_subs where ticket_id = ${ticketId}`;
  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 900, urgency: 'high' }
        );
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await db()`delete from push_subs where id = ${s.id}`;
      }
    })
  );
}
