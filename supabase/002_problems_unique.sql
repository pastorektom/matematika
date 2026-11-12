-- Migrace 002: pořadí pevných příkladů je v rámci tématu jednoznačné.
-- Spusťte po schema.sql v Supabase: SQL Editor -> New query -> Run. Lze spustit opakovaně.
-- Primární klíč (topic, type, ord) zůstává; aplikace řadí příklady tématu podle ord,
-- proto nesmí mít dva příklady jednoho tématu stejné ord.
create unique index if not exists problems_topic_ord on public.problems (topic, ord);
