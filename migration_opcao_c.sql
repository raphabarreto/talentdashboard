-- Opção C: Pagamentos Simplificados
-- Execute no Supabase SQL Editor

-- 1. Adicionar novos campos
ALTER TABLE campaigns
ADD COLUMN total_received NUMERIC(12,2),
ADD COLUMN commission_percentage INTEGER DEFAULT 20;

-- 2. Migrar dados existentes (campaign_value → total_received)
UPDATE campaigns
SET total_received = campaign_value;

-- 3. Remover campos antigos (OPCIONAL - deixe comentado se quiser manter backup)
-- ALTER TABLE campaigns
-- DROP COLUMN campaign_value,
-- DROP COLUMN my_commission;

-- Nota: Rode apenas as linhas 1 e 2 primeiro, teste, e só então rode linha 3 se quiser limpar.
