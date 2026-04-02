-- ============================================================
-- BELYO — Mise à jour base de données
-- Lance uniquement ces lignes dans Supabase SQL Editor
-- ============================================================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;

-- Table products (si pas encore créée)
CREATE TABLE IF NOT EXISTS products (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name              TEXT NOT NULL,
  brand             TEXT,
  quantity          INTEGER DEFAULT 0,
  alert_threshold   INTEGER DEFAULT 2,
  price             NUMERIC(10,2),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_select') THEN
    CREATE POLICY "products_select" ON products FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_insert') THEN
    CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_update') THEN
    CREATE POLICY "products_update" ON products FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_delete') THEN
    CREATE POLICY "products_delete" ON products FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- RAPPELS EMAIL — Ajouter ces colonnes
-- ============================================================

-- Colonne pour tracker si le rappel a été envoyé
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Mettre à jour la table clients pour s'assurer que l'email existe
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;

-- Index pour accélérer la requête du cron
CREATE INDEX IF NOT EXISTS idx_appointments_reminder
  ON appointments(status, reminder_sent, datetime)
  WHERE status = 'pending' AND reminder_sent = false;

-- ============================================================
-- STRIPE — Table abonnements
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  plan                    TEXT DEFAULT 'trial' CHECK (plan IN ('trial', 'starter', 'pro')),
  status                  TEXT DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SALON SETTINGS — Paramètres personnalisés du salon
-- ============================================================
CREATE TABLE IF NOT EXISTS salon_settings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  prestations JSONB DEFAULT '{"homme":["Coupe","Dégradé","Barbe","Coupe + Barbe","Soin"],"femme":["Coupe","Brushing","Coloration","Balayage","Soin"]}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE salon_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salon_settings_all" ON salon_settings
  FOR ALL USING (auth.uid() = user_id);

-- Ajouter custom_prestations à salon_settings
ALTER TABLE salon_settings ADD COLUMN IF NOT EXISTS
  custom_prestations JSONB DEFAULT '{"homme":[],"femme":[]}';

-- Ajouter prix_duree à salon_settings
ALTER TABLE salon_settings ADD COLUMN IF NOT EXISTS
  prix_duree JSONB DEFAULT '{"homme":{},"femme":{}}';

-- Ajouter duration_minutes aux appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;

-- ============================================================
-- RÉSERVATION PUBLIQUE
-- ============================================================

-- Permettre la lecture publique des paramètres salon (pour la page de réservation)
CREATE POLICY "salon_settings_public_read" ON salon_settings
  FOR SELECT USING (true);

-- Permettre l'insertion publique de RDV (depuis la page de réservation)
CREATE POLICY "appointments_public_insert" ON appointments
  FOR INSERT WITH CHECK (true);

-- Vue publique du profil salon (nom + email pour afficher sur la page)
-- On lit user_metadata depuis auth.users via une fonction
CREATE OR REPLACE FUNCTION get_salon_public_info(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'salon_name', COALESCE(raw_user_meta_data->>'salon_name', 'Mon Salon'),
    'email', email
  )
  INTO result
  FROM auth.users
  WHERE id = p_user_id;
  RETURN result;
END;
$$;

-- ============================================================
-- B2C CLIENT ACCOUNTS
-- ============================================================

-- Slug unique par salon
ALTER TABLE salon_settings ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Table comptes clients (séparée des coiffeurs)
CREATE TABLE IF NOT EXISTS client_accounts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  phone       TEXT,
  password_hash TEXT, -- géré par Supabase Auth
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Lier les RDV publics à un compte client
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_account_id UUID REFERENCES client_accounts(id) ON DELETE SET NULL;

-- Policy publique pour lire le slug d'un salon (DROP si existe déjà)
DROP POLICY IF EXISTS "salon_settings_slug_read" ON salon_settings;
CREATE POLICY "salon_settings_slug_read" ON salon_settings
  FOR SELECT USING (true);

-- Fonction pour trouver un salon par slug
CREATE OR REPLACE FUNCTION get_salon_by_slug(p_slug TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'user_id',    ss.user_id,
    'salon_name', COALESCE(u.raw_user_meta_data->>'salon_name', 'Mon Salon'),
    'slug',       ss.slug
  )
  INTO result
  FROM salon_settings ss
  JOIN auth.users u ON u.id = ss.user_id
  WHERE ss.slug = p_slug;
  RETURN result;
END;
$$;

-- Fonction pour chercher des salons par nom
CREATE OR REPLACE FUNCTION search_salons(p_query TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT json_agg(json_build_object(
      'user_id',    ss.user_id,
      'salon_name', COALESCE(u.raw_user_meta_data->>'salon_name', 'Mon Salon'),
      'slug',       ss.slug
    ))
    FROM salon_settings ss
    JOIN auth.users u ON u.id = ss.user_id
    WHERE ss.slug IS NOT NULL
    AND LOWER(COALESCE(u.raw_user_meta_data->>'salon_name', '')) LIKE LOWER('%' || p_query || '%')
    LIMIT 10
  );
END;
$$;