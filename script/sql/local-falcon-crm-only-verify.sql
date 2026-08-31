-- Read-only verification. Every returned row must have passed = true.
-- No lead data, connection strings, credentials, or secret values are read.
BEGIN READ ONLY;

WITH expected_columns (column_name, data_type) AS (VALUES
  ('id', 'character varying'), ('batch_record_id', 'character varying'),
  ('lead_id', 'character varying'), ('place_id', 'text'), ('company_name', 'text'),
  ('outcome', 'text'), ('market_reference', 'jsonb'), ('contact_tag', 'text'),
  ('qualification_status', 'text'), ('scan_keyword', 'text'), ('google_maps_url', 'text'),
  ('created_at', 'timestamp without time zone')
), actual_columns AS (
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'local_falcon_crm_only_prospects'
), constraints AS (
  SELECT contype, confdeltype, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
  WHERE conrelid = to_regclass('public.local_falcon_crm_only_prospects')
), checks AS (
  SELECT 'column:' || e.column_name AS check_name,
    COALESCE(a.data_type = e.data_type AND a.is_nullable = 'NO', false) AS passed,
    COALESCE(a.data_type || '; nullable=' || a.is_nullable, 'MISSING') AS detail
  FROM expected_columns e LEFT JOIN actual_columns a USING (column_name)
  UNION ALL
  SELECT 'no_extra_columns', count(*) = 12, 'column count=' || count(*) FROM actual_columns
  UNION ALL
  SELECT 'primary_key:id', EXISTS (SELECT FROM constraints WHERE contype = 'p' AND definition = 'PRIMARY KEY (id)'), 'id primary key'
  UNION ALL
  SELECT 'unique:place_id', EXISTS (SELECT FROM constraints WHERE contype = 'u' AND definition = 'UNIQUE (place_id)'), 'exact Place-ID uniqueness'
  UNION ALL
  SELECT 'foreign_key:lead_id', EXISTS (SELECT FROM constraints WHERE contype = 'f' AND confdeltype = 'c'
    AND definition LIKE 'FOREIGN KEY (lead_id) REFERENCES %crm_leads(id) ON DELETE CASCADE'), 'lead foreign key with delete cascade'
  UNION ALL
  SELECT 'foreign_key:batch_record_id', EXISTS (SELECT FROM constraints WHERE contype = 'f' AND confdeltype = 'a'
    AND definition LIKE 'FOREIGN KEY (batch_record_id) REFERENCES %local_falcon_import_batches(id)'), 'batch foreign key without delete cascade'
  UNION ALL
  SELECT 'default:' || column_name, CASE column_name
    WHEN 'id' THEN COALESCE(column_default LIKE '%gen_random_uuid()%', false)
    WHEN 'outcome' THEN COALESCE(column_default = '''no_visibility_core_found''::text', false)
    WHEN 'qualification_status' THEN COALESCE(column_default = '''qualified''::text', false)
    WHEN 'created_at' THEN COALESCE(column_default = 'now()', false)
  END, COALESCE(column_default, 'MISSING')
  FROM actual_columns WHERE column_name IN ('id', 'outcome', 'qualification_status', 'created_at')
  UNION ALL
  SELECT 'index:' || expected.index_name,
    EXISTS (
      SELECT FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
      WHERE i.indrelid = to_regclass('public.local_falcon_crm_only_prospects')
        AND c.relname = expected.index_name AND i.indisvalid
        AND pg_get_indexdef(i.indexrelid) LIKE '%(' || expected.column_name || ')'
    ), 'valid index on ' || expected.column_name
  FROM (VALUES ('lf_crm_only_lead_idx', 'lead_id'), ('lf_crm_only_batch_idx', 'batch_record_id')) expected(index_name, column_name)
)
SELECT check_name, passed, detail FROM checks ORDER BY check_name;

COMMIT;
