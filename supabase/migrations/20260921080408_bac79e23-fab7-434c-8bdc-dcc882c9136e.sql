CREATE POLICY "domain_registry_service_only" ON public.domain_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "transfers_service_only" ON public.transfers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "transfer_files_service_only" ON public.transfer_files FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anonymous_sessions_service_only" ON public.anonymous_device_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "download_claims_service_only" ON public.transfer_download_claims FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "code_attempts_service_only" ON public.transfer_code_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "payment_events_service_only" ON public.payment_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "idempotency_service_only" ON public.idempotency_keys FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE EXECUTE ON FUNCTION public.claim_transfer_download(uuid,text,text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_developer_billing(uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;