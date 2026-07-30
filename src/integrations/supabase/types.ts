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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          balance: number
          created_at: string
          enabled: boolean
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          owner_label: string
          total_cost: number
          total_requests: number
          user_id: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          enabled?: boolean
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          owner_label: string
          total_cost?: number
          total_requests?: number
          user_id?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          enabled?: boolean
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          owner_label?: string
          total_cost?: number
          total_requests?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banned_ips: {
        Row: {
          banned_at: string
          expires_at: string | null
          ip: string
          reason: string | null
          strikes: number
        }
        Insert: {
          banned_at?: string
          expires_at?: string | null
          ip: string
          reason?: string | null
          strikes?: number
        }
        Update: {
          banned_at?: string
          expires_at?: string | null
          ip?: string
          reason?: string | null
          strikes?: number
        }
        Relationships: []
      }
      error_events: {
        Row: {
          final_result: string | null
          http_status: number | null
          id: number
          key_fingerprint: string | null
          latency_ms: number | null
          message: string | null
          model: string | null
          provider_id: string | null
          provider_name: string | null
          provider_response: string | null
          retries: number
          token_label: string | null
          ts: string
        }
        Insert: {
          final_result?: string | null
          http_status?: number | null
          id?: number
          key_fingerprint?: string | null
          latency_ms?: number | null
          message?: string | null
          model?: string | null
          provider_id?: string | null
          provider_name?: string | null
          provider_response?: string | null
          retries?: number
          token_label?: string | null
          ts?: string
        }
        Update: {
          final_result?: string | null
          http_status?: number | null
          id?: number
          key_fingerprint?: string | null
          latency_ms?: number | null
          message?: string | null
          model?: string | null
          provider_id?: string | null
          provider_name?: string | null
          provider_response?: string | null
          retries?: number
          token_label?: string | null
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      fallbacks: {
        Row: {
          created_at: string
          id: string
          ordinal: number
          scope: string
          source_model_id: string | null
          source_provider_id: string | null
          target_provider_id: string
          target_upstream_model: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ordinal?: number
          scope: string
          source_model_id?: string | null
          source_provider_id?: string | null
          target_provider_id: string
          target_upstream_model?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ordinal?: number
          scope?: string
          source_model_id?: string | null
          source_provider_id?: string | null
          target_provider_id?: string
          target_upstream_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fallbacks_source_model_id_fkey"
            columns: ["source_model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fallbacks_source_provider_id_fkey"
            columns: ["source_provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fallbacks_target_provider_id_fkey"
            columns: ["target_provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_strikes: {
        Row: {
          count: number
          ip: string
          last_at: string
          last_reason: string | null
        }
        Insert: {
          count?: number
          ip: string
          last_at?: string
          last_reason?: string | null
        }
        Update: {
          count?: number
          ip?: string
          last_at?: string
          last_reason?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempts: number
          email: string
          first_at: string
          ip: string
          last_at: string
        }
        Insert: {
          attempts?: number
          email: string
          first_at?: string
          ip: string
          last_at?: string
        }
        Update: {
          attempts?: number
          email?: string
          first_at?: string
          ip?: string
          last_at?: string
        }
        Relationships: []
      }
      models: {
        Row: {
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          input_cost_per_1m: number
          internal_cost_per_1m: number
          output_cost_per_1m: number
          provider_id: string
          request_cost: number
          updated_at: string
          upstream_model: string
          user_cost_per_1m: number
        }
        Insert: {
          created_at?: string
          display_name: string
          enabled?: boolean
          id?: string
          input_cost_per_1m?: number
          internal_cost_per_1m?: number
          output_cost_per_1m?: number
          provider_id: string
          request_cost?: number
          updated_at?: string
          upstream_model: string
          user_cost_per_1m?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          input_cost_per_1m?: number
          internal_cost_per_1m?: number
          output_cost_per_1m?: number
          provider_id?: string
          request_cost?: number
          updated_at?: string
          upstream_model?: string
          user_cost_per_1m?: number
        }
        Relationships: [
          {
            foreignKeyName: "models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          suspended: boolean
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id: string
          suspended?: boolean
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          suspended?: boolean
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_tokens: {
        Row: {
          api_key_enc: string
          balance: number
          cooldown_until: string | null
          created_at: string
          daily_limit: number
          enabled: boolean
          health: string
          hourly_limit: number
          id: string
          label: string
          last_health_at: string | null
          last_used_at: string | null
          max_input_tokens: number
          max_output_tokens: number
          monthly_limit: number
          notes: string | null
          priority: number
          provider_id: string
          requests_this_month: number
          requests_today: number
          rpm_limit: number
          rpm_window_count: number
          rpm_window_start: string | null
          rps_limit: number
          updated_at: string
        }
        Insert: {
          api_key_enc: string
          balance?: number
          cooldown_until?: string | null
          created_at?: string
          daily_limit?: number
          enabled?: boolean
          health?: string
          hourly_limit?: number
          id?: string
          label?: string
          last_health_at?: string | null
          last_used_at?: string | null
          max_input_tokens?: number
          max_output_tokens?: number
          monthly_limit?: number
          notes?: string | null
          priority?: number
          provider_id: string
          requests_this_month?: number
          requests_today?: number
          rpm_limit?: number
          rpm_window_count?: number
          rpm_window_start?: string | null
          rps_limit?: number
          updated_at?: string
        }
        Update: {
          api_key_enc?: string
          balance?: number
          cooldown_until?: string | null
          created_at?: string
          daily_limit?: number
          enabled?: boolean
          health?: string
          hourly_limit?: number
          id?: string
          label?: string
          last_health_at?: string | null
          last_used_at?: string | null
          max_input_tokens?: number
          max_output_tokens?: number
          monthly_limit?: number
          notes?: string | null
          priority?: number
          provider_id?: string
          requests_this_month?: number
          requests_today?: number
          rpm_limit?: number
          rpm_window_count?: number
          rpm_window_start?: string | null
          rps_limit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_tokens_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          api_key_enc: string | null
          balance: number
          base_url_enc: string
          created_at: string
          daily_limit: number
          enabled: boolean
          headers_enc: string | null
          health: string
          hourly_limit: number
          id: string
          last_health_at: string | null
          max_input_tokens: number
          max_output_tokens: number
          monthly_limit: number
          name: string
          notes: string | null
          priority: number
          requires_auth: boolean
          rpm_limit: number
          rps_limit: number
          status: string
          updated_at: string
        }
        Insert: {
          api_key_enc?: string | null
          balance?: number
          base_url_enc: string
          created_at?: string
          daily_limit?: number
          enabled?: boolean
          headers_enc?: string | null
          health?: string
          hourly_limit?: number
          id?: string
          last_health_at?: string | null
          max_input_tokens?: number
          max_output_tokens?: number
          monthly_limit?: number
          name: string
          notes?: string | null
          priority?: number
          requires_auth?: boolean
          rpm_limit?: number
          rps_limit?: number
          status?: string
          updated_at?: string
        }
        Update: {
          api_key_enc?: string | null
          balance?: number
          base_url_enc?: string
          created_at?: string
          daily_limit?: number
          enabled?: boolean
          headers_enc?: string | null
          health?: string
          hourly_limit?: number
          id?: string
          last_health_at?: string | null
          max_input_tokens?: number
          max_output_tokens?: number
          monthly_limit?: number
          name?: string
          notes?: string | null
          priority?: number
          requires_auth?: boolean
          rpm_limit?: number
          rps_limit?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_bindings: {
        Row: {
          fingerprint: string
          ip: string | null
          ua: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          fingerprint: string
          ip?: string | null
          ua?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          fingerprint?: string
          ip?: string | null
          ua?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          api_key_id: string | null
          cost: number
          id: number
          input_tokens: number
          internal_cost: number
          latency_ms: number
          model_id: string | null
          model_name: string | null
          output_tokens: number
          provider_id: string | null
          provider_name: string | null
          success: boolean
          total_tokens: number
          ts: string
        }
        Insert: {
          api_key_id?: string | null
          cost?: number
          id?: number
          input_tokens?: number
          internal_cost?: number
          latency_ms?: number
          model_id?: string | null
          model_name?: string | null
          output_tokens?: number
          provider_id?: string | null
          provider_name?: string | null
          success?: boolean
          total_tokens?: number
          ts?: string
        }
        Update: {
          api_key_id?: string | null
          cost?: number
          id?: number
          input_tokens?: number
          internal_cost?: number
          latency_ms?: number
          model_id?: string | null
          model_name?: string | null
          output_tokens?: number
          provider_id?: string | null
          provider_name?: string | null
          success?: boolean
          total_tokens?: number
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gw_debit_api_key: {
        Args: { _cost: number; _id: string; _tokens: number }
        Returns: undefined
      }
      gw_debit_provider_token: {
        Args: { _cost: number; _id: string }
        Returns: undefined
      }
      gw_is_ip_banned: { Args: { _ip: string }; Returns: boolean }
      gw_manual_ban_ip: {
        Args: { _hours?: number; _ip: string; _reason: string }
        Returns: boolean
      }
      gw_record_ip_strike: {
        Args: { _ip: string; _reason: string }
        Returns: number
      }
      gw_reserve_token_slot: {
        Args: { _id: string; _rpm_limit: number }
        Returns: boolean
      }
      gw_unban_ip: { Args: { _ip: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_suspended: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
