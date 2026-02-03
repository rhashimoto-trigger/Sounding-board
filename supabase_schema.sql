-- ============================================
-- Supabase SQL Schema
-- Supabaseの管理画面 > SQL Editor で実行してください
-- ============================================

-- 先生アカウント
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- URL設定（チャットの設計図）
CREATE TABLE IF NOT EXISTS chat_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  theme TEXT NOT NULL,
  approach TEXT NOT NULL,
  important_points TEXT NOT NULL,
  source_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- セッション（生徒1回分の会話）
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES chat_configs(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  class_name TEXT NOT NULL,
  seat_number TEXT NOT NULL,
  student_name TEXT NOT NULL,
  recovery_code TEXT UNIQUE NOT NULL,
  message_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  summary TEXT,
  advice TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- メッセージ本文
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 以下はALL USERS（認証なし）でアクセス可能にするためのポリシー
-- 今のところ認証はApp側で管理するため、RLSはオフにしておきます
ALTER TABLE teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
