-- ============================================================
-- BELYO — SCHEMA COMPLET v3
-- À exécuter entièrement dans Supabase SQL Editor
-- ============================================================

-- Nettoyer les anciennes fonctions
DROP FUNCTION IF EXISTS get_client_appointments(TEXT, TEXT);
DROP FUNCTION IF EXISTS create_salon_for_user(UUID);
DROP FUNCTION IF EXISTS get_salon_public_info(UUID);
DROP FUNCTION IF EXISTS search_salons(TEXT);
DROP FUNCTION IF EXISTS get_salon_by_slug(TEXT);
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- ============================================================
-- TABLES
-- ============================================================

-- Rendez-vous
CREATE TABLE IF NOT EXISTS appointments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_name      TEXT NOT NULL,
  service          TEXT,
  datetime         TIMESTAMPTZ NOT NULL,
  price            NUMERIC(10,2),
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending','done','cancelled')),
  notes            TEXT,
  reminder_sent    BOOLEAN DEFAULT false,
  duration_minutes INTEGER DEFAULT 30,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Clients d'un salon
CREATE TABLE IF NOT EXISTS clients (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  last_visit  DATE,
  visit_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Produits / stocks
CREATE TABLE IF NOT EXISTS products (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  brand           TEXT,
  quantity        INTEGER DEFAULT 0,
  alert_threshold INTEGER DEFAULT 2,
  price           NUMERIC(10,2),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Abonnements Stripe
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  plan                   TEXT DEFAULT 'trial' CHECK (plan IN ('trial','starter','pro')),
  status                 TEXT DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','cancelled')),
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Paramètres salon
CREATE TABLE IF NOT EXISTS salon_settings (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  slug               TEXT UNIQUE,
  salon_name         TEXT,
  prestations        JSONB DEFAULT '{"homme":["Coupe","Dégradé","Barbe","Coupe + Barbe","Soin"],"femme":["Coupe","Brushing","Coloration","Balayage","Soin"]}',
  custom_prestations JSONB DEFAULT '{"homme":[],"femme":[]}',
  prix_duree         JSONB DEFAULT '{"homme":{},"femme":{}}',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE appointments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_settings  ENABLE ROW LEVEL SECURITY;

-- Appointments : le salon voit ses propres RDV
DROP POLICY IF EXISTS "appt_salon"  ON appointments;
DROP POLICY IF EXISTS "appt_insert" ON appointments;
CREATE POLICY "appt_salon"  ON appointments FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "appt_insert" ON appointments FOR INSERT WITH CHECK (true); -- résa publique

-- Clients
DROP POLICY IF EXISTS "clients_all" ON clients;
CREATE POLICY "clients_all" ON clients FOR ALL USING (auth.uid() = user_id);

-- Products
DROP POLICY IF EXISTS "products_all" ON products;
CREATE POLICY "products_all" ON products FOR ALL USING (auth.uid() = user_id);

-- Subscriptions
DROP POLICY IF EXISTS "subs_select" ON subscriptions;
CREATE POLICY "subs_select" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Salon settings : lecture publique pour la page de résa
DROP POLICY IF EXISTS "settings_all"    ON salon_settings;
DROP POLICY IF EXISTS "settings_public" ON salon_settings;
CREATE POLICY "settings_all"    ON salon_settings FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "settings_public" ON salon_settings FOR SELECT USING (true);

-- ============================================================
-- TRIGGER updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS settings_updated_at ON salon_settings;
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON salon_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INDEX
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_appt_user     ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appt_datetime ON appointments(datetime);
CREATE INDEX IF NOT EXISTS idx_appt_reminder ON appointments(status, reminder_sent, datetime)
  WHERE status = 'pending' AND reminder_sent = false;
CREATE INDEX IF NOT EXISTS idx_clients_user  ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_settings_slug ON salon_settings(slug);

-- ============================================================
-- FONCTIONS SÉCURISÉES (SECURITY DEFINER = bypass RLS)
-- ============================================================

-- Info publique d'un salon
CREATE OR REPLACE FUNCTION get_salon_public_info(p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'salon_name',    COALESCE(ss.salon_name, u.raw_user_meta_data->>'salon_name', 'Salon'),
    'first_name',    COALESCE(u.raw_user_meta_data->>'first_name', ''),
    'salon_address', COALESCE(u.raw_user_meta_data->>'salon_address', ''),
    'slug',          ss.slug
  )
  INTO result
  FROM auth.users u
  LEFT JOIN salon_settings ss ON ss.user_id = u.id
  WHERE u.id = p_user_id;
  RETURN result;
END;
$$;

-- Trouver un salon par slug
CREATE OR REPLACE FUNCTION get_salon_by_slug(p_slug TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'user_id',       ss.user_id,
    'salon_name',    COALESCE(ss.salon_name, u.raw_user_meta_data->>'salon_name', 'Salon'),
    'salon_address', COALESCE(u.raw_user_meta_data->>'salon_address', ''),
    'slug',          ss.slug
  )
  INTO result
  FROM salon_settings ss
  JOIN auth.users u ON u.id = ss.user_id
  WHERE ss.slug = p_slug;
  RETURN result;
END;
$$;

-- Chercher des salons (query vide = tous)
CREATE OR REPLACE FUNCTION search_salons(p_query TEXT DEFAULT '')
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT json_agg(json_build_object(
      'user_id',       ss.user_id,
      'salon_name',    COALESCE(ss.salon_name, u.raw_user_meta_data->>'salon_name', 'Salon'),
      'salon_address', COALESCE(u.raw_user_meta_data->>'salon_address', ''),
      'slug',          ss.slug
    ) ORDER BY u.raw_user_meta_data->>'salon_name')
    FROM salon_settings ss
    JOIN auth.users u ON u.id = ss.user_id
    WHERE ss.slug IS NOT NULL
    AND (
      p_query = ''
      OR LOWER(COALESCE(ss.salon_name, u.raw_user_meta_data->>'salon_name','')) LIKE LOWER('%'||p_query||'%')
    )
    LIMIT 20
  );
END;
$$;

-- RDV d'un client (bypass RLS) — cherche par email ET nom
CREATE OR REPLACE FUNCTION get_client_appointments(p_email TEXT, p_name TEXT DEFAULT '')
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t) ORDER BY t.datetime ASC)
    FROM (
      SELECT DISTINCT ON (a.id)
        a.id, a.client_name, a.service,
        a.datetime::TEXT,
        a.price, a.status, a.notes, a.user_id,
        ss.slug,
        COALESCE(ss.salon_name, u.raw_user_meta_data->>'salon_name', 'Salon') AS salon_name
      FROM appointments a
      LEFT JOIN salon_settings ss ON ss.user_id = a.user_id
      LEFT JOIN auth.users u ON u.id = a.user_id
      LEFT JOIN clients c ON c.user_id = a.user_id
        AND LOWER(TRIM(c.name)) = LOWER(TRIM(a.client_name))
      WHERE
        -- Email dans les notes (résa publique)
        (p_email != '' AND a.notes ILIKE '%' || p_email || '%')
        -- Email dans la fiche client du salon
        OR (p_email != '' AND c.email IS NOT NULL AND LOWER(TRIM(c.email)) = LOWER(TRIM(p_email)))
        -- Nom exact
        OR (p_name != '' AND LOWER(TRIM(a.client_name)) = LOWER(TRIM(p_name)))
      ORDER BY a.id, a.datetime
    ) t
  );
END;
$$;

-- Créer salon_settings pour un utilisateur (upgrade client → salon)
CREATE OR REPLACE FUNCTION create_salon_for_user(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO salon_settings (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;