-- Migration pour restructurer la colonne source avec codes courts
-- et s'assurer que comment contient les vrais commentaires

-- Mettre à jour les sources existantes avec les codes courts
UPDATE scraped_numbers
SET source = CASE
  WHEN source LIKE '%telguarder%' THEN 'TELG'
  WHEN source LIKE '%tellows%' THEN 'TELW'
  WHEN source LIKE '%slick%' THEN 'SLIK'
  WHEN source LIKE '%numeroinconnu%' THEN 'NUMI'
  WHEN source LIKE '%callfilter%' THEN 'CALF'
  ELSE source
END
WHERE source IS NOT NULL;