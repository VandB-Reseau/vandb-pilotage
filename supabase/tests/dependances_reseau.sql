-- Ce que l'app réseau a déjà créé dans la base partagée et dont le pilotage dépend (tests uniquement).
-- Copie fidèle des définitions des migrations 0001_tables_de_base.sql, 0004_acces_franchises.sql et 0005_cloisonnement_equipe.sql (et store_finance de 0001)
-- du dépôt vandb-reseau : à mettre à jour si elles changent là-bas.

CREATE OR REPLACE FUNCTION public.mon_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT u.raw_app_meta_data->>'role' FROM auth.users u WHERE u.id = auth.uid()), '')
$$;

CREATE OR REPLACE FUNCTION public.est_directeur() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.mon_role() = 'directeur'
$$;

CREATE TABLE IF NOT EXISTS public.acces_franchises (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  franchise  text NOT NULL,
  magasins   text[] NOT NULL DEFAULT '{}',
  ouvert_le  timestamptz NOT NULL DEFAULT now(),
  maj_le     timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.mes_magasins() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN public.mon_role() = 'franchise'
    THEN coalesce((SELECT a.magasins FROM public.acces_franchises a WHERE a.user_id = auth.uid()), '{}')
    ELSE '{}'::text[] END
$$;

CREATE TABLE IF NOT EXISTS public.perimetre_equipe (
  store_name text PRIMARY KEY,
  coach      text,
  rrs        text[] NOT NULL DEFAULT '{}',
  maj_le     timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.magasins_visibles() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((
    SELECT array_agg(p.store_name) FROM public.perimetre_equipe p, auth.users u
    WHERE u.id = auth.uid() AND (
      (u.raw_app_meta_data->>'role' = 'coach' AND p.coach = u.raw_app_meta_data->>'coach')
      OR (u.raw_app_meta_data->>'role' = 'rr' AND (u.raw_app_meta_data->>'rr') = ANY(p.rrs)))
  ), '{}'::text[])
$$;

-- 0001_tables_de_base.sql et 0004_acces_franchises.sql : réglages en clé / valeur, fiche des RR dans 'drs_data'
CREATE TABLE IF NOT EXISTS public.app_config (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key        text UNIQUE NOT NULL,
  value      text,
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.json_sur(t text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  RETURN t::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

-- 0001_tables_de_base.sql : fiche des magasins (surcharges), lue par pilotage.ouvertures_reseau() (0024)
CREATE TABLE IF NOT EXISTS public.store_overrides (
  store_name text PRIMARY KEY,
  tel        text,
  email_mag  text,
  tel_cs     text,
  email_cs   text,
  resp       text,
  tel_resp   text,
  email_resp text,
  adj        text,
  tel_adj    text,
  addr       text,
  num        text,
  rue        text,
  cp         text,
  ville      text,
  code       text,
  plat       text,
  open_date  text,                   -- AAAA-MM-JJ
  dept       text,
  franchise  boolean DEFAULT true,   -- true = franchisé, false = intégré
  pays       text,                   -- vide = France
  rr         text,                   -- identifiant du RR qui gère le magasin en direct
  lon        double precision,
  lat        double precision,
  updated_at timestamptz DEFAULT now()
);

-- Chiffres mensuels saisis dans l'app réseau (0001_tables_de_base.sql), lus par pilotage.concordance_ca (0028)
CREATE TABLE IF NOT EXISTS public.store_finance (
  store_name text NOT NULL,
  month      date NOT NULL,
  ca_cave    numeric,
  ca_bar     numeric,
  ebitda     numeric,
  panier     numeric,
  freq       numeric,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (store_name, month)
);
ALTER TABLE public.store_finance ADD COLUMN IF NOT EXISTS ca_ext    numeric;
ALTER TABLE public.store_finance ADD COLUMN IF NOT EXISTS pm_cave   numeric;
ALTER TABLE public.store_finance ADD COLUMN IF NOT EXISTS flux_cave numeric;
ALTER TABLE public.store_finance ADD COLUMN IF NOT EXISTS pm_bar    numeric;
ALTER TABLE public.store_finance ADD COLUMN IF NOT EXISTS flux_bar  numeric;
ALTER TABLE public.store_finance ADD COLUMN IF NOT EXISTS marge     numeric;
ALTER TABLE public.store_finance ENABLE ROW LEVEL SECURITY;
