-- YAML 剧本草稿表（功能 4：YAML 剧本生成）
-- 请在 Supabase SQL Editor 中执行

CREATE TABLE IF NOT EXISTS yaml_drafts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  novel_id INT NOT NULL,
  -- 版本管理
  version INT NOT NULL DEFAULT 1,
  version_type VARCHAR(30) DEFAULT 'ai_generated',
  -- 生成输入快照
  schema_id INT NULL,
  schema_name_snapshot VARCHAR(255),
  schema_content_snapshot TEXT,
  schema_format VARCHAR(20) DEFAULT 'yaml',
  extraction_snapshot_json JSONB,
  -- YAML 内容
  yaml_content TEXT NOT NULL DEFAULT '',
  -- 状态
  status VARCHAR(30) NOT NULL DEFAULT 'not_started',
  error_message TEXT,
  validation_errors TEXT,
  repair_count INT DEFAULT 0,
  -- 用户编辑
  user_edited_content TEXT,
  user_edited_at TIMESTAMP,
  -- 文件系统
  file_path VARCHAR(500),
  -- 元数据
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yaml_drafts_user_novel ON yaml_drafts(user_id, novel_id);
CREATE INDEX IF NOT EXISTS idx_yaml_drafts_novel_version ON yaml_drafts(novel_id, version DESC);
