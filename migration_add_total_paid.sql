-- Adicionar coluna total_paid na tabela campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS total_paid NUMERIC DEFAULT 0;

-- Atualizar campanhas existentes: calcular total_paid baseado nos pagamentos individuais
UPDATE campaigns c
SET total_paid = (
  SELECT COALESCE(SUM(payment), 0)
  FROM campaign_streamers cs
  WHERE cs.campaign_id = c.id
)
WHERE total_paid = 0;
