-- Adiciona coluna my_commission (comissão preenchida manualmente)
-- Substitui o cálculo automático total_received - total_paid (80/20)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS my_commission NUMERIC DEFAULT 0;

-- Preenche campanhas existentes com o valor que era calculado automaticamente,
-- para não zerar comissões já lançadas
UPDATE campaigns
SET my_commission = total_received - total_paid
WHERE my_commission = 0;
