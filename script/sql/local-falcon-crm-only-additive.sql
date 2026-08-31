-- Explicit, additive deployment step only. Never run from app startup.
-- Apply to the intended database, then run local-falcon-crm-only-verify.sql.
-- Existing tables/data are untouched; an incompatible existing table must be
-- investigated, not repaired destructively by this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.local_falcon_crm_only_prospects (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_record_id varchar NOT NULL,
  lead_id varchar NOT NULL,
  place_id text NOT NULL,
  company_name text NOT NULL,
  outcome text NOT NULL DEFAULT 'no_visibility_core_found',
  market_reference jsonb NOT NULL,
  contact_tag text NOT NULL,
  qualification_status text NOT NULL DEFAULT 'qualified',
  scan_keyword text NOT NULL,
  google_maps_url text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT local_falcon_crm_only_prospects_place_id_unique UNIQUE (place_id),
  CONSTRAINT local_falcon_crm_only_prospects_batch_record_id_local_falcon_import_batches_id_fk
    FOREIGN KEY (batch_record_id) REFERENCES public.local_falcon_import_batches(id),
  CONSTRAINT local_falcon_crm_only_prospects_lead_id_crm_leads_id_fk
    FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS lf_crm_only_lead_idx
  ON public.local_falcon_crm_only_prospects (lead_id);
CREATE INDEX IF NOT EXISTS lf_crm_only_batch_idx
  ON public.local_falcon_crm_only_prospects (batch_record_id);

COMMIT;
