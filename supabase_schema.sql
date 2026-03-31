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