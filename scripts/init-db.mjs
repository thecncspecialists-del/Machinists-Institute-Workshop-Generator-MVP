import pg from "pg";
import fs from "node:fs";

const { Pool } = pg;

loadLocalEnv();

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/curriculum_asset_builder?schema=public";

const sql = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS contributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL UNIQUE,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  source text NOT NULL DEFAULT 'spreadsheet',
  imported_by text,
  imported_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_count integer NOT NULL,
  notes text
);

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_import_batch_id uuid NOT NULL REFERENCES course_import_batches(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  external_source text NOT NULL,
  external_id text,
  course_code text,
  course_name text NOT NULL,
  description text,
  hours double precision,
  year integer,
  quarter integer,
  syllabus_url text,
  canvas_shell_url text,
  physical_inventory_url text,
  curriculum_url text,
  certs_url text,
  amatrol_url text,
  tooling_u_url text,
  electude_url text,
  development_status text,
  timeline_start timestamp(3),
  timeline_end timestamp(3),
  enrollment_tracker_url text,
  raw_import_json jsonb NOT NULL,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE,
  outcome_code text,
  description text NOT NULL,
  row_index integer NOT NULL,
  raw_import_json jsonb NOT NULL,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS curriculum_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  asset_type text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'Draft',
  input_json jsonb NOT NULL,
  output_json jsonb NOT NULL,
  rich_text_output text NOT NULL,
  html_output text NOT NULL,
  created_by text,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE curriculum_assets ALTER COLUMN course_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS asset_context_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES curriculum_assets(id) ON DELETE CASCADE ON UPDATE CASCADE,
  context_type text NOT NULL,
  course_id uuid REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  snapshot_json jsonb NOT NULL,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS courses_course_code_idx ON courses(course_code);
CREATE INDEX IF NOT EXISTS courses_course_name_idx ON courses(course_name);
CREATE INDEX IF NOT EXISTS courses_development_status_idx ON courses(development_status);
CREATE INDEX IF NOT EXISTS course_outcomes_course_id_idx ON course_outcomes(course_id);
CREATE INDEX IF NOT EXISTS curriculum_assets_course_id_idx ON curriculum_assets(course_id);
CREATE INDEX IF NOT EXISTS curriculum_assets_asset_type_idx ON curriculum_assets(asset_type);
CREATE INDEX IF NOT EXISTS curriculum_assets_status_idx ON curriculum_assets(status);
CREATE INDEX IF NOT EXISTS curriculum_assets_created_at_idx ON curriculum_assets(created_at);
CREATE INDEX IF NOT EXISTS asset_context_links_asset_id_idx ON asset_context_links(asset_id);
CREATE INDEX IF NOT EXISTS asset_context_links_course_id_idx ON asset_context_links(course_id);
CREATE INDEX IF NOT EXISTS asset_context_links_context_type_idx ON asset_context_links(context_type);
`;

const pool = new Pool({ connectionString });

try {
  await pool.query(sql);
  console.log("Database initialized for Curriculum Asset Builder.");
} finally {
  await pool.end();
}

function loadLocalEnv() {
  if (!fs.existsSync(".env")) return;

  const contents = fs.readFileSync(".env", "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    process.env[key] = rawValue.replace(/^"|"$/g, "");
  }
}
