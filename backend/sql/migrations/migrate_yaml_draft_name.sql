-- 为 yaml_drafts 增加 draft_name 字段
-- 请在 Supabase SQL Editor 中执行

ALTER TABLE yaml_drafts ADD COLUMN IF NOT EXISTS draft_name VARCHAR(100) DEFAULT 'AI 生成 YAML';
