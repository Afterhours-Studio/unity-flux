export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          id: string
          message: string
          meta: Json | null
          project_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          meta?: Json | null
          project_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          meta?: Json | null
          project_id?: string
          type?: string
        }
      }
      entries: {
        Row: {
          created_at: string
          data: Json
          environment: string
          id: string
          is_active: boolean
          schema_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          environment?: string
          id?: string
          is_active?: boolean
          schema_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          environment?: string
          id?: string
          is_active?: boolean
          schema_id?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          anon_key: string
          api_key: string
          created_at: string
          description: string
          environment: string
          id: string
          name: string
          r2_bucket_url: string
          slug: string
          supabase_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anon_key: string
          api_key: string
          created_at?: string
          description?: string
          environment?: string
          id: string
          name: string
          r2_bucket_url?: string
          slug: string
          supabase_url?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anon_key?: string
          api_key?: string
          created_at?: string
          description?: string
          environment?: string
          id?: string
          name?: string
          r2_bucket_url?: string
          slug?: string
          supabase_url?: string
          updated_at?: string
          user_id?: string
        }
      }
      schemas: {
        Row: {
          created_at: string
          fields: Json
          id: string
          mode: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fields?: Json
          id?: string
          mode?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fields?: Json
          id?: string
          mode?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          role?: string
        }
      }
      formulas: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string
          expression: string
          variables: Json
          output_mode: string
          preview_inputs: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          project_id: string
          name: string
          description?: string
          expression: string
          variables?: Json
          output_mode?: string
          preview_inputs?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string
          expression?: string
          variables?: Json
          output_mode?: string
          preview_inputs?: Json
          updated_at?: string
        }
      }
      live_ops_events: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string
          type: string
          status: string
          start_at: string
          end_at: string
          color: string
          config: Json
          recurring: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          description?: string
          type: string
          status?: string
          start_at: string
          end_at: string
          color?: string
          config?: Json
          recurring?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          description?: string
          type?: string
          status?: string
          start_at?: string
          end_at?: string
          color?: string
          config?: Json
          recurring?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      battle_pass_tiers: {
        Row: {
          id: string
          event_id: string
          tier: number
          xp_required: number
          free_reward: string
          premium_reward: string
        }
        Insert: {
          id?: string
          event_id: string
          tier: number
          xp_required?: number
          free_reward?: string
          premium_reward?: string
        }
        Update: {
          id?: string
          event_id?: string
          tier?: number
          xp_required?: number
          free_reward?: string
          premium_reward?: string
        }
      }
      versions: {
        Row: {
          data: Json
          environment: string
          id: string
          project_id: string
          published_at: string
          r2_url: string
          row_count: number
          status: string
          table_count: number
          version_tag: string
        }
        Insert: {
          data?: Json
          environment: string
          id?: string
          project_id: string
          published_at?: string
          r2_url?: string
          row_count?: number
          status?: string
          table_count?: number
          version_tag: string
        }
        Update: {
          data?: Json
          environment?: string
          id?: string
          project_id?: string
          published_at?: string
          r2_url?: string
          row_count?: number
          status?: string
          table_count?: number
          version_tag?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
