-- YAML 导出记录表
-- 请在 Supabase SQL Editor 中执行

CREATE TABLE IF NOT EXISTS yaml_exports (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  novel_id INT NOT NULL,
  draft_id INT NOT NULL,
  version_number INT NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000),
  file_format VARCHAR(10) NOT NULL DEFAULT 'yaml',
  yaml_content_snapshot TEXT,
  status VARCHAR(30) DEFAULT 'exported',
  exported_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yaml_exports_user_novel ON yaml_exports(user_id, novel_id);
CREATE INDEX IF NOT EXISTS idx_yaml_exports_draft_id ON yaml_exports(draft_id);
