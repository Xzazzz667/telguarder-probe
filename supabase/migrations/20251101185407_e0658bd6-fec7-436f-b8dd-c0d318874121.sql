-- Ajouter la colonne signalements pour stocker le nombre de signalements Orange
ALTER TABLE public.scraped_numbers 
ADD COLUMN IF NOT EXISTS signalements INTEGER DEFAULT NULL;

-- Créer un index pour améliorer les performances des requêtes sur les signalements
CREATE INDEX IF NOT EXISTS idx_scraped_numbers_signalements 
ON public.scraped_numbers (signalements) WHERE signalements IS NOT NULL;

-- Commentaire pour la colonne
COMMENT ON COLUMN public.scraped_numbers.signalements IS 'Nombre de signalements sur antispam.orange-telephone.com';