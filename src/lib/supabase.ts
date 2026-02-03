import { createClient } from '@supabase/supabase-js'

// Supabase の型定義
export interface Teacher {
  id: string
  email: string
  password: string
  created_at: string
}

export interface ChatConfig {
  id: string
  teacher_id: string
  slug: string
  theme: string
  approach: string
  important_points: string
  source_text: string | null
  created_at: string
  updated_at: string
}

export interface ChatSession {
  id: string
  config_id: string
  grade: string
  class_name: string
  seat_number: string
  student_name: string
  recovery_code: string
  message_count: number
  status: 'active' | 'paused' | 'completed'
  summary: string | null
  advice: string | null
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      teachers: {
        Row: Teacher
        Insert: Omit<Teacher, 'id' | 'created_at'>
        Update: Partial<Omit<Teacher, 'id' | 'created_at'>>
      }
      chat_configs: {
        Row: ChatConfig
        Insert: Omit<ChatConfig, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ChatConfig, 'id' | 'created_at'>>
      }
      chat_sessions: {
        Row: ChatSession
        Insert: Omit<ChatSession, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ChatSession, 'id' | 'created_at'>>
      }
      chat_messages: {
        Row: ChatMessage
        Insert: Omit<ChatMessage, 'id' | 'created_at'>
        Update: Partial<Omit<ChatMessage, 'id'>>
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)
