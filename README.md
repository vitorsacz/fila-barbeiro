# Na Vez · fila digital para barbearias

O cliente escaneia o QR Code (ou encosta o celular na etiqueta NFC), escolhe o barbeiro, deixa o nome e acompanha a própria posição pelo celular. Ele recebe uma notificação no navegador quando estiver chegando a vez e quando for chamado.

Primeira barbearia: **Salão do Chico** (`/f/salaodochico`).

## As três áreas

| Quem | Endereço | O que vê |
| --- | --- | --- |
| Cliente | `/f/<barbearia>` → `/t/<senha>` | Só a própria posição, a previsão e a senha |
| Barbearia | `/painel` (endereço + PIN) | Filas de todos os barbeiros, chamar, finalizar, pôr gente do balcão, regras, barbeiros, placa QR |
| Administrador | `/admin` (senha) | Barbearias, mensalidades, pagamentos, receita mensal, uso de cada uma |

A placa para imprimir fica em `/placa/<barbearia>`.

## Como a fila anda

- **Terminei o corte** → o próximo é chamado sozinho e recebe a notificação.
- **Sentou, começar** → o chamado vai para a cadeira.
- Quem é chamado tem *N* minutos para chegar (padrão 5). Se não chegar, volta 2 lugares uma vez e, na segunda, sai da fila. A regra pode ser trocada para "sai da fila" nos Ajustes.
- Quando faltarem *N* pessoas (padrão 2), o cliente recebe o aviso de "vá se aproximando".
- A previsão usa o tempo médio de corte de cada barbeiro, que dá para ajustar no painel.

Não há tarefa agendada: as regras automáticas rodam sempre que alguém abre a fila, o painel ou a senha (o painel atualiza a cada 4 s e a senha a cada 5 s).

## Notificações

São notificações do navegador (Web Push), sem custo:

- **Android / Chrome / computador:** funciona direto, basta tocar em "Me avise quando for a minha vez".
- **iPhone:** a Apple só permite notificação de site adicionado à Tela de Início (iOS 16.4 ou mais novo). A página explica isso para o cliente. Quem não adicionar pode deixar a página aberta, que ela se atualiza e vibra.

SMS pode entrar depois (Twilio, Zenvia etc.) no mesmo ponto em que a notificação é enviada (`notify` em `lib/queue.ts`).

## Stack

Next.js 15 (App Router) na Vercel · Postgres no Neon (`@neondatabase/serverless`) · `web-push` · `jose` para sessão · `bcryptjs` para os PINs.

## Rodar localmente

```bash
cp .env.example .env.local   # preencha as variáveis
npm install
npm run dev
```

O schema está em `db/schema.sql`.

### Variáveis de ambiente

| Nome | Para quê |
| --- | --- |
| `DATABASE_URL` | Conexão do Neon (use a URL com `-pooler`) |
| `ADMIN_PASSWORD` | Senha do `/admin` |
| `SESSION_SECRET` | Texto aleatório longo para assinar os logins |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Chaves das notificações (`npx web-push generate-vapid-keys`) |
| `VAPID_SUBJECT` | `mailto:` de contato exigido pelo Web Push |

## Próximos passos possíveis

- Cobrança automática (Pix recorrente / Asaas / Mercado Pago) ligada à tabela `payments`
- SMS como alternativa à notificação
- Relatórios de movimento por dia e horário de pico para a barbearia
