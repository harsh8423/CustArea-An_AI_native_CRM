-- Import jobs (one CSV / Excel upload)
CREATE TABLE import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  source text,            -- csv | xlsx | google_sheets
  filename text,
  status text,            -- uploaded | parsed | mapped | applied | failed

  total_rows int DEFAULT 0,
  processed_rows int DEFAULT 0,
  error_rows int DEFAULT 0,

  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Import columns (dynamic schema)
CREATE TABLE import_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid REFERENCES import_jobs(id) ON DELETE CASCADE,

  original_name text,        -- column name in CSV
  normalized_name text,      -- snake_case
  detected_type text,        -- string | number | date | email | phone

  mapped_to text,            -- contact.email | lead.stage | custom
  is_custom boolean DEFAULT false,

  created_at timestamptz DEFAULT now()
);

-- Import rows (raw data storage) - Option A: Row-per-record JSONB
CREATE TABLE import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid REFERENCES import_jobs(id) ON DELETE CASCADE,

  row_index int,
  data jsonb,              -- {"Email":"x@a.com","Budget":"5000"}
  validation_errors jsonb,

  created_at timestamptz DEFAULT now()
);

ALTER TABLE leads ADD COLUMN score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 5);
