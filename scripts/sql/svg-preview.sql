CREATE TABLE IF NOT EXISTS svg_preview (
  id text PRIMARY KEY NOT NULL,
  visitor_hash text NOT NULL,
  user_id text REFERENCES user(id) ON DELETE CASCADE,
  input_hash text NOT NULL,
  mode text NOT NULL,
  status text NOT NULL,
  attempt integer DEFAULT 1 NOT NULL,
  options text NOT NULL,
  provider_task_id text,
  svg text,
  preview_png text,
  stats text,
  cost_credits integer DEFAULT 0 NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS svg_preview_visitor_hash_unique ON svg_preview(visitor_hash);
CREATE UNIQUE INDEX IF NOT EXISTS svg_preview_user_id_unique ON svg_preview(user_id);
CREATE TABLE IF NOT EXISTS svg_preview_quota (
  id text PRIMARY KEY NOT NULL,
  count integer DEFAULT 0 NOT NULL
);
