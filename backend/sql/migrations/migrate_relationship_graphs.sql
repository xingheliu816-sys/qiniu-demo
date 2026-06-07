-- 关系图谱表（功能 5：关系图谱）
-- 请在 Supabase SQL Editor 中执行

CREATE TABLE IF NOT EXISTS relationship_graphs (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  novel_id INT NOT NULL,

  -- 章节范围（生成时所选章节 id 列表）
  chapter_ids JSONB NOT NULL DEFAULT '[]',

  -- 图谱数据
  graph_data_json JSONB NOT NULL DEFAULT '{}',

  -- 状态：generated / failed / partial / updated
  status VARCHAR(30) NOT NULL DEFAULT 'generated',

  -- 错误报告（生成失败时记录原因）
  error_report TEXT,

  -- 备用字段
  generated_by VARCHAR(50) DEFAULT 'deepseek',
  node_count INT DEFAULT 0,
  edge_count INT DEFAULT 0,

  -- 元数据
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rel_graphs_user_novel ON relationship_graphs(user_id, novel_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rel_graphs_user_novel ON relationship_graphs(user_id, novel_id);
