CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.owner_type AS ENUM ('anon', 'app');
CREATE TYPE public.transfer_status AS ENUM ('waiting', 'active', 'expired', 'completed', 'failed');
CREATE TYPE public.domain_status AS ENUM ('pending', 'verified', 'failed', 'revoked');
CREATE TYPE public.registry_status AS ENUM ('verified', 'released_blocked');
CREATE TYPE public.origin_kind AS ENUM ('development', 'production_subdomain');
CREATE TYPE public.usage_event_type AS ENUM ('upload', 'download', 'lifetime_extension');
CREATE TYPE public.app_role AS ENUM ('admin', 'developer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  company_name text,
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  public_key text NOT NULL UNIQUE,
  secret_key_hash text NOT NULL,
  production_domain text,
  domain_status public.domain_status NOT NULL DEFAULT 'pending',
  max_upload_bytes bigint NOT NULL DEFAULT 5368709120 CHECK (max_upload_bytes BETWEEN 1 AND 26843545600),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applications_read_own" ON public.applications FOR SELECT TO authenticated USING (auth.uid() = developer_id);
CREATE POLICY "applications_insert_own" ON public.applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = developer_id);
CREATE POLICY "applications_update_own" ON public.applications FOR UPDATE TO authenticated USING (auth.uid() = developer_id) WITH CHECK (auth.uid() = developer_id);
CREATE POLICY "applications_delete_own" ON public.applications FOR DELETE TO authenticated USING (auth.uid() = developer_id);
CREATE INDEX applications_developer_idx ON public.applications(developer_id);

CREATE TABLE public.domain_registry (
  domain text PRIMARY KEY CHECK (domain = lower(domain)),
  first_verified_at timestamptz NOT NULL,
  verifying_developer_id uuid,
  verification_token_hash text NOT NULL,
  status public.registry_status NOT NULL DEFAULT 'verified',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.domain_registry TO service_role;
ALTER TABLE public.domain_registry ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.application_origins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  origin text NOT NULL,
  kind public.origin_kind NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_id, origin)
);
GRANT SELECT, INSERT, DELETE ON public.application_origins TO authenticated;
GRANT ALL ON public.application_origins TO service_role;
ALTER TABLE public.application_origins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "origins_read_own_app" ON public.application_origins FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.developer_id = auth.uid()));
CREATE POLICY "origins_insert_own_app" ON public.application_origins FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.developer_id = auth.uid()));
CREATE POLICY "origins_delete_own_app" ON public.application_origins FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.developer_id = auth.uid()));

CREATE TABLE public.widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  public_widget_id text NOT NULL UNIQUE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.widgets TO authenticated;
GRANT ALL ON public.widgets TO service_role;
ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "widgets_read_own_app" ON public.widgets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.developer_id = auth.uid()));
CREATE POLICY "widgets_insert_own_app" ON public.widgets FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.developer_id = auth.uid()));
CREATE POLICY "widgets_update_own_app" ON public.widgets FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.developer_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.developer_id = auth.uid()));
CREATE POLICY "widgets_delete_own_app" ON public.widgets FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.developer_id = auth.uid()));

CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type public.owner_type NOT NULL,
  owner_id uuid,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  widget_id uuid REFERENCES public.widgets(id) ON DELETE SET NULL,
  total_bytes bigint NOT NULL CHECK (total_bytes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  max_downloaders integer CHECK (max_downloaders IS NULL OR max_downloaders IN (1,5,10)),
  successful_downloads integer NOT NULL DEFAULT 0 CHECK (successful_downloads >= 0),
  status public.transfer_status NOT NULL DEFAULT 'waiting',
  code_hash text NOT NULL,
  code_hint smallint NOT NULL CHECK (code_hint BETWEEN 0 AND 99),
  session_token_hash text NOT NULL,
  completed_at timestamptz,
  cleanup_completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE INDEX transfers_expiry_idx ON public.transfers(status, expires_at);
CREATE INDEX transfers_code_hint_idx ON public.transfers(code_hint, status, expires_at);
CREATE INDEX transfers_application_idx ON public.transfers(application_id, created_at DESC);

CREATE TABLE public.transfer_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  upload_id text,
  upload_status text NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending','uploading','uploaded','aborted','failed')),
  checksum_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.transfer_files TO service_role;
ALTER TABLE public.transfer_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX transfer_files_transfer_idx ON public.transfer_files(transfer_id);

CREATE TABLE public.anonymous_device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token_hash text NOT NULL UNIQUE,
  transfer_ids uuid[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.anonymous_device_sessions TO service_role;
ALTER TABLE public.anonymous_device_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transfer_download_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  claim_token_hash text NOT NULL UNIQUE,
  client_fingerprint_hash text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(transfer_id, client_fingerprint_hash)
);
GRANT ALL ON public.transfer_download_claims TO service_role;
ALTER TABLE public.transfer_download_claims ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transfer_code_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  network_hash text NOT NULL,
  code_hint smallint NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.transfer_code_attempts TO service_role;
ALTER TABLE public.transfer_code_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX transfer_code_attempts_rate_idx ON public.transfer_code_attempts(network_hash, attempted_at DESC);

CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  developer_id uuid,
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE RESTRICT,
  bytes bigint NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  amount_minor_units bigint NOT NULL DEFAULT 0 CHECK (amount_minor_units >= 0),
  event_type public.usage_event_type NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_read_own" ON public.usage_events FOR SELECT TO authenticated USING (developer_id = auth.uid());
CREATE INDEX usage_developer_idx ON public.usage_events(developer_id, created_at DESC);

CREATE TABLE public.developer_billing (
  developer_id uuid PRIMARY KEY,
  free_allowance_bytes bigint NOT NULL DEFAULT 5368709120 CHECK (free_allowance_bytes >= 0),
  consumed_bytes bigint NOT NULL DEFAULT 0 CHECK (consumed_bytes >= 0),
  debt_minor_units bigint NOT NULL DEFAULT 0 CHECK (debt_minor_units >= 0),
  capacity_bytes bigint NOT NULL DEFAULT 5368709120 CHECK (capacity_bytes BETWEEN 5368709120 AND 26843545600),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.developer_billing TO authenticated;
GRANT ALL ON public.developer_billing TO service_role;
ALTER TABLE public.developer_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_read_own" ON public.developer_billing FOR SELECT TO authenticated USING (developer_id = auth.uid());

CREATE TABLE public.billing_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL,
  amount_minor_units bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('charge','credit','payment','adjustment')),
  reference text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_ledger TO authenticated;
GRANT ALL ON public.billing_ledger TO service_role;
ALTER TABLE public.billing_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_read_own" ON public.billing_ledger FOR SELECT TO authenticated USING (developer_id = auth.uid());

CREATE TABLE public.payment_events (
  provider_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.idempotency_keys (
  key text PRIMARY KEY,
  operation text NOT NULL,
  response jsonb,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.idempotency_keys TO service_role;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER domains_updated_at BEFORE UPDATE ON public.domain_registry FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER widgets_updated_at BEFORE UPDATE ON public.widgets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER transfers_updated_at BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER files_updated_at BEFORE UPDATE ON public.transfer_files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON public.anonymous_device_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_usage_event_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'usage_events are append-only'; END;
$$;
CREATE TRIGGER usage_events_no_update BEFORE UPDATE OR DELETE ON public.usage_events FOR EACH ROW EXECUTE FUNCTION public.prevent_usage_event_mutation();

CREATE OR REPLACE FUNCTION public.prevent_domain_registry_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'verified domain history is permanent'; END;
$$;
CREATE TRIGGER domain_registry_no_delete BEFORE DELETE ON public.domain_registry FOR EACH ROW EXECUTE FUNCTION public.prevent_domain_registry_delete();

CREATE OR REPLACE FUNCTION public.claim_transfer_download(_transfer_id uuid, _claim_hash text, _fingerprint_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.transfers%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.transfers WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND OR t.status <> 'active' OR t.expires_at <= now() THEN RETURN false; END IF;
  IF t.max_downloaders IS NOT NULL AND t.successful_downloads >= t.max_downloaders THEN RETURN false; END IF;
  INSERT INTO public.transfer_download_claims(transfer_id, claim_token_hash, client_fingerprint_hash)
  VALUES (_transfer_id, _claim_hash, _fingerprint_hash) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN true; END IF;
  UPDATE public.transfers SET successful_downloads = successful_downloads + 1,
    status = CASE WHEN max_downloaders IS NOT NULL AND successful_downloads + 1 >= max_downloaders THEN 'completed'::public.transfer_status ELSE status END,
    completed_at = CASE WHEN max_downloaders IS NOT NULL AND successful_downloads + 1 >= max_downloaders THEN now() ELSE completed_at END
  WHERE id = _transfer_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_transfer_download(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_transfer_download(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.recompute_developer_billing(_developer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used bigint; owed bigint;
BEGIN
  SELECT COALESCE(sum(bytes),0), COALESCE(sum(amount_minor_units),0) INTO used, owed
  FROM public.usage_events WHERE developer_id = _developer_id;
  INSERT INTO public.developer_billing(developer_id, consumed_bytes, debt_minor_units)
  VALUES (_developer_id, used, owed)
  ON CONFLICT (developer_id) DO UPDATE SET consumed_bytes = EXCLUDED.consumed_bytes, debt_minor_units = EXCLUDED.debt_minor_units, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.recompute_developer_billing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_developer_billing(uuid) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;