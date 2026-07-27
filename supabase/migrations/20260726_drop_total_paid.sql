-- Remove coluna total_paid (Pagamento Total aos Streamers).
-- Já executado manualmente em produção; registrado aqui para manter o histórico de migrations.
ALTER TABLE campaigns DROP COLUMN IF EXISTS total_paid;
