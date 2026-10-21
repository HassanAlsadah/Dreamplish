export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_requests: {
        Row: {
          created_at: string
          id: number
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      board_stages: {
        Row: {
          category: Database["public"]["Enums"]["job_status"]
          color: string
          created_at: string
          hidden: boolean
          id: string
          is_core: boolean
          name: string | null
          name_i18n: Json | null
          position: number
          preset: string | null
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["job_status"]
          color?: string
          created_at?: string
          hidden?: boolean
          id?: string
          is_core?: boolean
          name?: string | null
          name_i18n?: Json | null
          position?: number
          preset?: string | null
          user_id?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["job_status"]
          color?: string
          created_at?: string
          hidden?: boolean
          id?: string
          is_core?: boolean
          name?: string | null
          name_i18n?: Json | null
          position?: number
          preset?: string | null
          user_id?: string
        }
        Relationships: []
      }
      brief_requests: {
        Row: {
          company_id: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brief_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          industry: string | null
          name: string
          normalized_name: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          normalized_name: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          normalized_name?: string
          website?: string | null
        }
        Relationships: []
      }
      company_briefs: {
        Row: {
          attempts: number
          company_id: string
          error: string | null
          generated_at: string | null
          id: string
          links: Json | null
          locked_at: string | null
          news: Json | null
          projects: Json | null
          provider: string | null
          requested_at: string
          role_insights: Json | null
          roles: string[]
          salary_range: Json | null
          search_suggestions: string | null
          skills: Json | null
          sources: Json
          status: Database["public"]["Enums"]["gen_status"]
          summary: Json | null
          values: Json | null
          watchouts: Json | null
        }
        Insert: {
          attempts?: number
          company_id: string
          error?: string | null
          generated_at?: string | null
          id?: string
          links?: Json | null
          locked_at?: string | null
          news?: Json | null
          projects?: Json | null
          provider?: string | null
          requested_at?: string
          role_insights?: Json | null
          roles?: string[]
          salary_range?: Json | null
          search_suggestions?: string | null
          skills?: Json | null
          sources?: Json
          status?: Database["public"]["Enums"]["gen_status"]
          summary?: Json | null
          values?: Json | null
          watchouts?: Json | null
        }
        Update: {
          attempts?: number
          company_id?: string
          error?: string | null
          generated_at?: string | null
          id?: string
          links?: Json | null
          locked_at?: string | null
          news?: Json | null
          projects?: Json | null
          provider?: string | null
          requested_at?: string
          role_insights?: Json | null
          roles?: string[]
          salary_range?: Json | null
          search_suggestions?: string | null
          skills?: Json | null
          sources?: Json
          status?: Database["public"]["Enums"]["gen_status"]
          summary?: Json | null
          values?: Json | null
          watchouts?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "company_briefs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_connections: {
        Row: {
          account_email: string | null
          created_at: string
          delta_link: string | null
          error: string | null
          id: string
          last_synced_at: string | null
          provider: string
          refresh_token_encrypted: string
          sent_delta_link: string | null
          status: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          created_at?: string
          delta_link?: string | null
          error?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token_encrypted: string
          sent_delta_link?: string | null
          status?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          created_at?: string
          delta_link?: string | null
          error?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token_encrypted?: string
          sent_delta_link?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          action: string
          applied_via: string | null
          company: string | null
          confidence: string
          created_at: string
          detail: string | null
          direction: string
          id: string
          job_description: string | null
          job_id: string | null
          job_link: string | null
          kind: string
          message_id: string
          proposed_status: Database["public"]["Enums"]["job_status"] | null
          received_at: string
          role: string | null
          sender: string | null
          state: string
          subject: string | null
          user_id: string
          web_link: string | null
        }
        Insert: {
          action: string
          applied_via?: string | null
          company?: string | null
          confidence?: string
          created_at?: string
          detail?: string | null
          direction?: string
          id?: string
          job_description?: string | null
          job_id?: string | null
          job_link?: string | null
          kind: string
          message_id: string
          proposed_status?: Database["public"]["Enums"]["job_status"] | null
          received_at: string
          role?: string | null
          sender?: string | null
          state?: string
          subject?: string | null
          user_id: string
          web_link?: string | null
        }
        Update: {
          action?: string
          applied_via?: string | null
          company?: string | null
          confidence?: string
          created_at?: string
          detail?: string | null
          direction?: string
          id?: string
          job_description?: string | null
          job_id?: string | null
          job_link?: string | null
          kind?: string
          message_id?: string
          proposed_status?: Database["public"]["Enums"]["job_status"] | null
          received_at?: string
          role?: string | null
          sender?: string | null
          state?: string
          subject?: string | null
          user_id?: string
          web_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_preps: {
        Row: {
          generated_at: string
          id: string
          job_id: string
          locale: string
          questions: Json
          talking_points: Json
        }
        Insert: {
          generated_at?: string
          id?: string
          job_id: string
          locale?: string
          questions: Json
          talking_points: Json
        }
        Update: {
          generated_at?: string
          id?: string
          job_id?: string
          locale?: string
          questions?: Json
          talking_points?: Json
        }
        Relationships: [
          {
            foreignKeyName: "interview_preps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_history: {
        Row: {
          changed_at: string
          from_status: Database["public"]["Enums"]["job_status"] | null
          id: string
          job_id: string
          note: string | null
          step_kind: string | null
          step_type: string | null
          to_stage_id: string | null
          to_stage_label: string | null
          to_status: Database["public"]["Enums"]["job_status"]
          user_id: string
        }
        Insert: {
          changed_at?: string
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id: string
          note?: string | null
          step_kind?: string | null
          step_type?: string | null
          to_stage_id?: string | null
          to_stage_label?: string | null
          to_status: Database["public"]["Enums"]["job_status"]
          user_id?: string
        }
        Update: {
          changed_at?: string
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id?: string
          note?: string | null
          step_kind?: string | null
          step_type?: string | null
          to_stage_id?: string | null
          to_stage_label?: string | null
          to_status?: Database["public"]["Enums"]["job_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_status_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "board_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          analysis: Json | null
          applied_via: string | null
          applied_via_detail: string | null
          company_id: string
          created_at: string
          date_applied: string | null
          id: string
          job_description: string | null
          link: string | null
          notes: string | null
          position: number
          source: string
          stage_detail: string | null
          stage_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          tailored_cv: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          applied_via?: string | null
          applied_via_detail?: string | null
          company_id: string
          created_at?: string
          date_applied?: string | null
          id?: string
          job_description?: string | null
          link?: string | null
          notes?: string | null
          position?: number
          source?: string
          stage_detail?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tailored_cv?: Json | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          analysis?: Json | null
          applied_via?: string | null
          applied_via_detail?: string | null
          company_id?: string
          created_at?: string
          date_applied?: string | null
          id?: string
          job_description?: string | null
          link?: string | null
          notes?: string | null
          position?: number
          source?: string
          stage_detail?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tailored_cv?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "board_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          cv_file_name: string | null
          cv_file_path: string | null
          cv_file_type: string | null
          cv_text: string | null
          id: string
          locale: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cv_file_name?: string | null
          cv_file_path?: string | null
          cv_file_type?: string | null
          cv_text?: string | null
          id: string
          locale?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cv_file_name?: string | null
          cv_file_path?: string | null
          cv_file_type?: string | null
          cv_text?: string | null
          id?: string
          locale?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_job_step: {
        Args: {
          p_allow_before_created?: boolean
          p_changed_at?: string
          p_job_id: string
          p_kind: string
          p_note?: string
          p_type: string
        }
        Returns: string
      }
      application_row: { Args: { p_job_id: string }; Returns: string }
      applied_at: {
        Args: { p_created: string; p_date: string }
        Returns: string
      }
      claim_brief: {
        Args: { p_company_id?: string }
        Returns: {
          attempts: number
          company_id: string
          error: string | null
          generated_at: string | null
          id: string
          links: Json | null
          locked_at: string | null
          news: Json | null
          projects: Json | null
          provider: string | null
          requested_at: string
          role_insights: Json | null
          roles: string[]
          salary_range: Json | null
          search_suggestions: string | null
          skills: Json | null
          sources: Json
          status: Database["public"]["Enums"]["gen_status"]
          summary: Json | null
          values: Json | null
          watchouts: Json | null
        }[]
        SetofOptions: {
          from: "*"
          to: "company_briefs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_or_create_company: {
        Args: { p_name: string; p_website?: string }
        Returns: string
      }
      set_status_change_date: {
        Args: {
          p_allow_before_created?: boolean
          p_changed_at: string
          p_id: string
          p_local_date?: string
          p_note?: string
        }
        Returns: undefined
      }
      stage_label: { Args: { p_stage_id: string }; Returns: string }
    }
    Enums: {
      gen_status: "pending" | "generating" | "ready" | "failed"
      job_status: "saved" | "applied" | "interview" | "offer" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      gen_status: ["pending", "generating", "ready", "failed"],
      job_status: ["saved", "applied", "interview", "offer", "rejected"],
    },
  },
} as const
