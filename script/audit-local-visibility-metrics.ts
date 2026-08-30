import pg from "pg";

const client = new pg.Client({ connectionString: process.env.REPORT_DATABASE_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rows } = await client.query(`select b.batch_id, count(*)::int as reports,
    count(p.atrp)::int as with_atrp,
    count(p.snapshot_storage_key)::int as snapshots,
    count(p.heatmap_storage_key)::int as heatmaps
    from local_falcon_prospect_profiles p join local_falcon_import_batches b on b.id = p.batch_record_id
    group by b.batch_id order by b.batch_id`);
  console.log(JSON.stringify(rows, null, 2));
  console.log(JSON.stringify({ localFalconConfigured: Boolean(process.env.LOCAL_FALCON_API_KEY) }));
} finally { await client.end(); }
