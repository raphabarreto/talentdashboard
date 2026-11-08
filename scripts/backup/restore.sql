-- Restaura o backup (JSON) em um banco NOVO. Variável de ambiente BACKUP_JSON = caminho do arquivo.
-- Ordem respeita as chaves estrangeiras. Sem "on conflict": banco vazio, qualquer conflito deve falhar.
\set content `cat "$BACKUP_JSON"`
begin;
insert into public.allowed_users select * from jsonb_populate_recordset(null::public.allowed_users, :'content'::jsonb->'tables'->'allowed_users');
insert into public.streamers select * from jsonb_populate_recordset(null::public.streamers, :'content'::jsonb->'tables'->'streamers');
insert into public.campaigns select * from jsonb_populate_recordset(null::public.campaigns, :'content'::jsonb->'tables'->'campaigns');
insert into public.campaign_streamers select * from jsonb_populate_recordset(null::public.campaign_streamers, :'content'::jsonb->'tables'->'campaign_streamers');
insert into public.prospect_shortlist select * from jsonb_populate_recordset(null::public.prospect_shortlist, :'content'::jsonb->'tables'->'prospect_shortlist');
insert into public.streamer_history select * from jsonb_populate_recordset(null::public.streamer_history, :'content'::jsonb->'tables'->'streamer_history');
commit;
