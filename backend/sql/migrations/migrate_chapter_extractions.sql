-- 章节提炼结果表迁移
-- 在 Supabase SQL Editor 中执行
CREATE TABLE IF NOT EXISTS chapter_extractions (
  id SERIAL PRIMARY KEY,
  chapter_id INT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  novel_id INT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  extraction_json JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id)
);
