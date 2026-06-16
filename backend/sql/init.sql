-- PostgreSQL 建表语句
-- 在 Supabase SQL Editor 中执行

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(512) NOT NULL,
  password_salt VARCHAR(512) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 小说表
CREATE TABLE IF NOT EXISTS novels (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  input_type VARCHAR(20) NOT NULL DEFAULT 'paste',
  original_text TEXT NOT NULL DEFAULT '',
  total_word_count INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  chapter_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 章节表
CREATE TABLE IF NOT EXISTS chapters (
  id SERIAL PRIMARY KEY,
  novel_id INT NOT NULL REFERENCES novels(id),
  user_id INT NOT NULL REFERENCES users(id),
  chapter_index INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  word_count INT NOT NULL DEFAULT 0,
  parse_status VARCHAR(20) NOT NULL DEFAULT 'not_parsed',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 章节解析记录表
CREATE TABLE IF NOT EXISTS chapter_parse_records (
  id SERIAL PRIMARY KEY,
  novel_id INT NOT NULL REFERENCES novels(id),
  user_id INT NOT NULL REFERENCES users(id),
  chapter_count INT NOT NULL,
  is_success SMALLINT NOT NULL,
  message VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 小说提炼表（功能 2）
CREATE TABLE IF NOT EXISTS novel_extractions (
  id SERIAL PRIMARY KEY,
  novel_id INT NOT NULL REFERENCES novels(id),
  user_id INT NOT NULL REFERENCES users(id),
  status VARCHAR(30) NOT NULL DEFAULT 'not_started',
  ai_result_json JSONB NULL,
  user_result_json JSONB NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (novel_id)
);

-- AI 调用记录表（功能 2）
CREATE TABLE IF NOT EXISTS ai_call_records (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  novel_id INT NOT NULL REFERENCES novels(id),
  task_type VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NULL,
  model_name VARCHAR(100) NULL,
  request_summary TEXT NULL,
  response_summary TEXT NULL,
  status VARCHAR(30) NOT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 章节提炼结果表
CREATE TABLE IF NOT EXISTS chapter_extractions (
  id SERIAL PRIMARY KEY,
  chapter_id INT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  novel_id INT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  extraction_json JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id)
);

-- YAML Schema 规则库（功能 3）
-- user_id 为 NULL 表示系统默认 Schema
CREATE TABLE IF NOT EXISTS yaml_schemas (
  id SERIAL PRIMARY KEY,
  user_id INT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  schema_type VARCHAR(50) NOT NULL DEFAULT 'custom',
  content_format VARCHAR(20) NOT NULL DEFAULT 'yaml',
  content TEXT NOT NULL DEFAULT '',
  is_default SMALLINT NOT NULL DEFAULT 0,
  is_system SMALLINT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  source_type VARCHAR(30) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 用户 Schema 偏好表（记录每个用户的默认 Schema）
CREATE TABLE IF NOT EXISTS user_schema_preferences (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  default_schema_id INT NULL REFERENCES yaml_schemas(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
