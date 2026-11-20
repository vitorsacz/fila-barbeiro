-- Dados de exemplo só para o banco LOCAL (nunca rodar no Neon de produção).
-- Painel: /painel  → barbearia "salaodochico", PIN 1234

insert into shops (slug, name, owner_name, owner_phone, pin_hash, monthly_price_cents, status)
values ('salaodochico', 'Salão do Chico', 'Léo Borges', '(11) 90000-0000',
        '$2b$10$HbOdfq/apdjV76KXd6toNOt2zYAD7CpB9Y9gJSNA2TJU3eECtPCt2', 4990, 'ativa')
on conflict (slug) do nothing;

insert into barbers (shop_id, name, avg_min, sort)
select id, 'Léo Borges', 30, 0 from shops where slug = 'salaodochico'
union all
select id, 'Seu Chico', 25, 1 from shops where slug = 'salaodochico';

-- uma fila de exemplo com o Léo
with s as (select id from shops where slug = 'salaodochico'),
     b as (select id from barbers where name = 'Léo Borges' and shop_id = (select id from s))
insert into tickets (shop_id, barber_id, code, name, phone, status, ord, present, alerted, source, eta_at_join, created_at, started_at)
values
  ((select id from s), (select id from b), 'L-001', 'Marcos Vinícius', '(11) 98431-2207', 'serving', 1, true, true, 'qr', 30, now() - interval '40 minutes', now() - interval '12 minutes'),
  ((select id from s), (select id from b), 'L-002', 'Rafael Souza', '(11) 99120-4471', 'waiting', 2, true, true, 'qr', 45, now() - interval '30 minutes', null),
  ((select id from s), (select id from b), 'L-003', 'Lucas Andrade', null, 'waiting', 3, false, true, 'qr', 60, now() - interval '15 minutes', null),
  ((select id from s), (select id from b), 'L-004', 'Paulo (balcão)', null, 'waiting', 4, true, false, 'balcao', 80, now() - interval '5 minutes', null);

-- um pagamento de exemplo para o admin
insert into payments (shop_id, ref_month, amount_cents, method)
select id, date_trunc('month', now())::date, 4990, 'pix' from shops where slug = 'salaodochico'
on conflict do nothing;
