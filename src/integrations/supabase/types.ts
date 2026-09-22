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
      anonymous_device_sessions: {
        Row: {
          created_at: string
          device_token_hash: string
          expires_at: string
          id: string
          transfer_ids: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_token_hash: string
          expires_at: string
          id?: string
          transfer_ids?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_token_hash?: string
          expires_at?: string
          id?: string
          transfer_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      application_origins: {
        Row: {
          application_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["origin_kind"]
          origin: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["origin_kind"]
          origin: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["origin_kind"]
          origin?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_origins_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          developer_id: string
          domain_status: Database["public"]["Enums"]["domain_status"]
          id: string
          max_upload_bytes: number
          name: string
          production_domain: string | null
          public_key: string
          secret_key_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          developer_id: string
          domain_status?: Database["public"]["Enums"]["domain_status"]
          id?: string
          max_upload_bytes?: number
          name: string
          production_domain?: string | null
          public_key: string
          secret_key_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          developer_id?: string
          domain_status?: Database["public"]["Enums"]["domain_status"]
          id?: string
          max_upload_bytes?: number
          name?: string
          production_domain?: string | null
          public_key?: string
          secret_key_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_ledger: {
        Row: {
          amount_minor_units: number
          created_at: string
          developer_id: string
          id: string
          kind: string
          metadata: Json
          reference: string
        }
        Insert: {
          amount_minor_units: number
          created_at?: string
          developer_id: string
          id?: string
          kind: string
          metadata?: Json
          reference: string
        }
        Update: {
          amount_minor_units?: number
          created_at?: string
          developer_id?: string
          id?: string
          kind?: string
          metadata?: Json
          reference?: string
        }
        Relationships: []
      }
      developer_billing: {
        Row: {
          capacity_bytes: number
          consumed_bytes: number
          debt_minor_units: number
          developer_id: string
          free_allowance_bytes: number
          updated_at: string
        }
        Insert: {
          capacity_bytes?: number
          consumed_bytes?: number
          debt_minor_units?: number
          developer_id: string
          free_allowance_bytes?: number
          updated_at?: string
        }
        Update: {
          capacity_bytes?: number
          consumed_bytes?: number
          debt_minor_units?: number
          developer_id?: string
          free_allowance_bytes?: number
          updated_at?: string
        }
        Relationships: []
      }
      domain_registry: {
        Row: {
          created_at: string
          domain: string
          first_verified_at: string
          status: Database["public"]["Enums"]["registry_status"]
          updated_at: string
          verification_token_hash: string
          verifying_developer_id: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          first_verified_at: string
          status?: Database["public"]["Enums"]["registry_status"]
          updated_at?: string
          verification_token_hash: string
          verifying_developer_id?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          first_verified_at?: string
          status?: Database["public"]["Enums"]["registry_status"]
          updated_at?: string
          verification_token_hash?: string
          verifying_developer_id?: string | null
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          completed_at: string | null
          created_at: string
          expires_at: string
          key: string
          operation: string
          response: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expires_at: string
          key: string
          operation: string
          response?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          key?: string
          operation?: string
          response?: Json | null
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          payload_hash: string
          processed_at: string | null
          processing_error: string | null
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          payload_hash: string
          processed_at?: string | null
          processing_error?: string | null
          provider_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          payload_hash?: string
          processed_at?: string | null
          processing_error?: string | null
          provider_event_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_complete: boolean
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_complete?: boolean
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_complete?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      transfer_code_attempts: {
        Row: {
          attempted_at: string
          code_hint: number
          id: number
          network_hash: string
          succeeded: boolean
        }
        Insert: {
          attempted_at?: string
          code_hint: number
          id?: never
          network_hash: string
          succeeded?: boolean
        }
        Update: {
          attempted_at?: string
          code_hint?: number
          id?: never
          network_hash?: string
          succeeded?: boolean
        }
        Relationships: []
      }
      transfer_download_claims: {
        Row: {
          claim_token_hash: string
          claimed_at: string
          client_fingerprint_hash: string
          completed_at: string | null
          id: string
          transfer_id: string
        }
        Insert: {
          claim_token_hash: string
          claimed_at?: string
          client_fingerprint_hash: string
          completed_at?: string | null
          id?: string
          transfer_id: string
        }
        Update: {
          claim_token_hash?: string
          claimed_at?: string
          client_fingerprint_hash?: string
          completed_at?: string | null
          id?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_download_claims_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_files: {
        Row: {
          checksum_sha256: string | null
          created_at: string
          id: string
          mime_type: string
          object_key: string
          original_name: string
          size_bytes: number
          transfer_id: string
          updated_at: string
          upload_id: string | null
          upload_status: string
        }
        Insert: {
          checksum_sha256?: string | null
          created_at?: string
          id?: string
          mime_type: string
          object_key: string
          original_name: string
          size_bytes: number
          transfer_id: string
          updated_at?: string
          upload_id?: string | null
          upload_status?: string
        }
        Update: {
          checksum_sha256?: string | null
          created_at?: string
          id?: string
          mime_type?: string
          object_key?: string
          original_name?: string
          size_bytes?: number
          transfer_id?: string
          updated_at?: string
          upload_id?: string | null
          upload_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_files_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          application_id: string | null
          cleanup_completed_at: string | null
          code_hash: string
          code_hint: number
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          max_downloaders: number | null
          owner_id: string | null
          owner_type: Database["public"]["Enums"]["owner_type"]
          session_token_hash: string
          status: Database["public"]["Enums"]["transfer_status"]
          successful_downloads: number
          total_bytes: number
          updated_at: string
          widget_id: string | null
        }
        Insert: {
          application_id?: string | null
          cleanup_completed_at?: string | null
          code_hash: string
          code_hint: number
          completed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          max_downloaders?: number | null
          owner_id?: string | null
          owner_type: Database["public"]["Enums"]["owner_type"]
          session_token_hash: string
          status?: Database["public"]["Enums"]["transfer_status"]
          successful_downloads?: number
          total_bytes: number
          updated_at?: string
          widget_id?: string | null
        }
        Update: {
          application_id?: string | null
          cleanup_completed_at?: string | null
          code_hash?: string
          code_hint?: number
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          max_downloaders?: number | null
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["owner_type"]
          session_token_hash?: string
          status?: Database["public"]["Enums"]["transfer_status"]
          successful_downloads?: number
          total_bytes?: number
          updated_at?: string
          widget_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          amount_minor_units: number
          application_id: string | null
          bytes: number
          created_at: string
          developer_id: string | null
          event_type: Database["public"]["Enums"]["usage_event_type"]
          id: string
          idempotency_key: string
          transfer_id: string
        }
        Insert: {
          amount_minor_units?: number
          application_id?: string | null
          bytes?: number
          created_at?: string
          developer_id?: string | null
          event_type: Database["public"]["Enums"]["usage_event_type"]
          id?: string
          idempotency_key: string
          transfer_id: string
        }
        Update: {
          amount_minor_units?: number
          application_id?: string | null
          bytes?: number
          created_at?: string
          developer_id?: string | null
          event_type?: Database["public"]["Enums"]["usage_event_type"]
          id?: string
          idempotency_key?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
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
      widgets: {
        Row: {
          application_id: string
          config: Json
          created_at: string
          id: string
          public_widget_id: string
          updated_at: string
        }
        Insert: {
          application_id: string
          config?: Json
          created_at?: string
          id?: string
          public_widget_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          config?: Json
          created_at?: string
          id?: string
          public_widget_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "widgets_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_transfer_download: {
        Args: {
          _claim_hash: string
          _fingerprint_hash: string
          _transfer_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recompute_developer_billing: {
        Args: { _developer_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "developer"
      domain_status: "pending" | "verified" | "failed" | "revoked"
      origin_kind: "development" | "production_subdomain"
      owner_type: "anon" | "app"
      registry_status: "verified" | "released_blocked"
      transfer_status: "waiting" | "active" | "expired" | "completed" | "failed"
      usage_event_type: "upload" | "download" | "lifetime_extension"
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
      app_role: ["admin", "developer"],
      domain_status: ["pending", "verified", "failed", "revoked"],
      origin_kind: ["development", "production_subdomain"],
      owner_type: ["anon", "app"],
      registry_status: ["verified", "released_blocked"],
      transfer_status: ["waiting", "active", "expired", "completed", "failed"],
      usage_event_type: ["upload", "download", "lifetime_extension"],
    },
  },
} as const
