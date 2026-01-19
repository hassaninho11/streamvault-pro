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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_user_metadata: {
        Row: {
          admin_notes: string | null
          created_at: string
          device_count: number | null
          id: string
          last_seen_at: string | null
          provider_count: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          device_count?: number | null
          id?: string
          last_seen_at?: string | null
          provider_count?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          device_count?: number | null
          id?: string
          last_seen_at?: string | null
          provider_count?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_events: {
        Row: {
          app_version: string | null
          created_at: string
          event_type: string
          id: string
          meta_masked: Json | null
          platform: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          event_type: string
          id?: string
          meta_masked?: Json | null
          platform?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          event_type?: string
          id?: string
          meta_masked?: Json | null
          platform?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          admin_user_id: string
          after_json: Json | null
          before_json: Json | null
          created_at: string
          id: string
          ip_address: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_user_id: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          app_version: string | null
          assigned_to: string | null
          attachments: Json | null
          created_at: string
          description: string | null
          diagnostics_masked: Json | null
          id: string
          platform: string | null
          severity: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          created_at?: string
          description?: string | null
          diagnostics_masked?: Json | null
          id?: string
          platform?: string | null
          severity?: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          created_at?: string
          description?: string | null
          diagnostics_masked?: Json | null
          id?: string
          platform?: string | null
          severity?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          created_at: string
          grant_reason: string | null
          granted_by: string | null
          id: string
          premium_source: string
          premium_status: string
          premium_until: string | null
          trial_end_at: string | null
          trial_start_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          grant_reason?: string | null
          granted_by?: string | null
          id?: string
          premium_source?: string
          premium_status?: string
          premium_until?: string | null
          trial_end_at?: string | null
          trial_start_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          grant_reason?: string | null
          granted_by?: string | null
          id?: string
          premium_source?: string
          premium_status?: string
          premium_until?: string | null
          trial_end_at?: string | null
          trial_start_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          provider_id: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          provider_id?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          provider_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          flag_key: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          channel_count: number | null
          created_at: string
          epg_url: string | null
          id: string
          is_active: boolean | null
          last_sync: string | null
          m3u_url: string | null
          name: string
          type: string
          updated_at: string
          user_id: string
          xtream_host: string | null
          xtream_pass_encrypted: string | null
          xtream_user: string | null
        }
        Insert: {
          channel_count?: number | null
          created_at?: string
          epg_url?: string | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          m3u_url?: string | null
          name: string
          type: string
          updated_at?: string
          user_id: string
          xtream_host?: string | null
          xtream_pass_encrypted?: string | null
          xtream_user?: string | null
        }
        Update: {
          channel_count?: number | null
          created_at?: string
          epg_url?: string | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          m3u_url?: string | null
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
          xtream_host?: string | null
          xtream_pass_encrypted?: string | null
          xtream_user?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          currency: string | null
          id: string
          platform: string
          price: number | null
          product_id: string
          purchased_at: string
          receipt_data: string | null
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          id?: string
          platform: string
          price?: number | null
          product_id: string
          purchased_at?: string
          receipt_data?: string | null
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          id?: string
          platform?: string
          price?: number | null
          product_id?: string
          purchased_at?: string
          receipt_data?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recently_watched: {
        Row: {
          channel_id: string
          id: string
          last_watched_at: string
          provider_id: string | null
          user_id: string
          watch_duration: number | null
        }
        Insert: {
          channel_id: string
          id?: string
          last_watched_at?: string
          provider_id?: string | null
          user_id: string
          watch_duration?: number | null
        }
        Update: {
          channel_id?: string
          id?: string
          last_watched_at?: string
          provider_id?: string | null
          user_id?: string
          watch_duration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recently_watched_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_child: boolean
          is_default: boolean
          max_rating: string | null
          name: string
          pin_hash: string | null
          settings: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_child?: boolean
          is_default?: boolean
          max_rating?: string | null
          name: string
          pin_hash?: string | null
          settings?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_child?: boolean
          is_default?: boolean
          max_rating?: string | null
          name?: string
          pin_hash?: string | null
          settings?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_owner: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "user"
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
      app_role: ["owner", "admin", "user"],
    },
  },
} as const
