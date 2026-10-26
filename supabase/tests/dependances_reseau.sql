-- Ce que l'app réseau a déjà créé dans la base partagée et dont le pilotage dépend (tests uniquement).
-- Copie fidèle des définitions des migrations 0004_acces_franchises.sql et 0005_cloisonnement_equipe.sql
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
