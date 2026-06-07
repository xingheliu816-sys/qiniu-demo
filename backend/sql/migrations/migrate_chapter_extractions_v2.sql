-- 创建章节提炼结果表，每个章节一条记录
-- 请在 Supabase SQL Editor 中执行

CREATE TABLE IF NOT EXISTS chapter_extractions (
  id SERIAL PRIMARY KEY,
  chapter_id INT NOT NULL,
  user_id INT NOT NULL,
  novel_id INT NOT NULL,
  extraction_json JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'extracted',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id)
);

-- 索引：按小说查询章节提炼
CREATE INDEX IF NOT EXISTS idx_chapter_extractions_novel_id ON chapter_extractions(novel_id);
CREATE INDEX IF NOT EXISTS idx_chapter_extractions_user_id ON chapter_extractions(user_id);
