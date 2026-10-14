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
      admin_whitelist: {
        Row: {
          assigned_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          assigned_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          assigned_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      agency_registrations: {
        Row: {
          assigned_employee_id: string | null
          authorization_text_snapshot: string | null
          catalog_id: string | null
          created_at: string | null
          has_signed_authorization: boolean | null
          id: string
          status: Database["public"]["Enums"]["registration_status"] | null
          target_agency: Database["public"]["Enums"]["agency_name"]
          user_id: string | null
        }
        Insert: {
          assigned_employee_id?: string | null
          authorization_text_snapshot?: string | null
          catalog_id?: string | null
          created_at?: string | null
          has_signed_authorization?: boolean | null
          id?: string
          status?: Database["public"]["Enums"]["registration_status"] | null
          target_agency: Database["public"]["Enums"]["agency_name"]
          user_id?: string | null
        }
        Update: {
          assigned_employee_id?: string | null
          authorization_text_snapshot?: string | null
          catalog_id?: string | null
          created_at?: string | null
          has_signed_authorization?: boolean | null
          id?: string
          status?: Database["public"]["Enums"]["registration_status"] | null
          target_agency?: Database["public"]["Enums"]["agency_name"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_registrations_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_registrations_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_protection_certificates: {
        Row: {
          artist_name: string | null
          attested: boolean
          blockchain_status: string
          catalog_id: string | null
          chain_strength: string | null
          format_type: Database["public"]["Enums"]["content_format"]
          id: string
          is_verified: boolean | null
          isrc: string | null
          issued_at: string | null
          iswc: string | null
          legal_credits: Json
          notes_hash: string | null
          notes_proof_url: string
          ots_calendar: string | null
          ots_receipt: string | null
          proof_digest: string | null
          session_hash: string | null
          session_video_url: string
          track_title: string | null
          upc: string | null
          user_id: string | null
        }
        Insert: {
          artist_name?: string | null
          attested?: boolean
          blockchain_status?: string
          catalog_id?: string | null
          chain_strength?: string | null
          format_type: Database["public"]["Enums"]["content_format"]
          id?: string
          is_verified?: boolean | null
          isrc?: string | null
          issued_at?: string | null
          iswc?: string | null
          legal_credits?: Json
          notes_hash?: string | null
          notes_proof_url?: string
          ots_calendar?: string | null
          ots_receipt?: string | null
          proof_digest?: string | null
          session_hash?: string | null
          session_video_url?: string
          track_title?: string | null
          upc?: string | null
          user_id?: string | null
        }
        Update: {
          artist_name?: string | null
          attested?: boolean
          blockchain_status?: string
          catalog_id?: string | null
          chain_strength?: string | null
          format_type?: Database["public"]["Enums"]["content_format"]
          id?: string
          is_verified?: boolean | null
          isrc?: string | null
          issued_at?: string | null
          iswc?: string | null
          legal_credits?: Json
          notes_hash?: string | null
          notes_proof_url?: string
          ots_calendar?: string | null
          ots_receipt?: string | null
          proof_digest?: string | null
          session_hash?: string | null
          session_video_url?: string
          track_title?: string | null
          upc?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_protection_certificates_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_protection_certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogs: {
        Row: {
          album_title: string | null
          art_url: string | null
          artist_name: string
          audio_url: string | null
          created_at: string | null
          details: Json
          duration: string | null
          featured_artists: string[] | null
          id: string
          is_complete: boolean | null
          isrc: string | null
          iswc: string | null
          publisher_identities: string[] | null
          publisher_percentages: number[] | null
          publisher_pro_affiliations: string[] | null
          release_date: string | null
          track_title: string
          upc: string | null
          updated_at: string
          user_id: string | null
          writer_names: string[] | null
          writer_percentages: number[] | null
          writer_pro_affiliations: string[] | null
        }
        Insert: {
          album_title?: string | null
          art_url?: string | null
          artist_name: string
          audio_url?: string | null
          created_at?: string | null
          details?: Json
          duration?: string | null
          featured_artists?: string[] | null
          id?: string
          is_complete?: boolean | null
          isrc?: string | null
          iswc?: string | null
          publisher_identities?: string[] | null
          publisher_percentages?: number[] | null
          publisher_pro_affiliations?: string[] | null
          release_date?: string | null
          track_title: string
          upc?: string | null
          updated_at?: string
          user_id?: string | null
          writer_names?: string[] | null
          writer_percentages?: number[] | null
          writer_pro_affiliations?: string[] | null
        }
        Update: {
          album_title?: string | null
          art_url?: string | null
          artist_name?: string
          audio_url?: string | null
          created_at?: string | null
          details?: Json
          duration?: string | null
          featured_artists?: string[] | null
          id?: string
          is_complete?: boolean | null
          isrc?: string | null
          iswc?: string | null
          publisher_identities?: string[] | null
          publisher_percentages?: number[] | null
          publisher_pro_affiliations?: string[] | null
          release_date?: string | null
          track_title?: string
          upc?: string | null
          updated_at?: string
          user_id?: string | null
          writer_names?: string[] | null
          writer_percentages?: number[] | null
          writer_pro_affiliations?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contributors: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ipi: string | null
          kind: string
          label: string | null
          name: string
          pro: string | null
          publisher: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ipi?: string | null
          kind?: string
          label?: string | null
          name: string
          pro?: string | null
          publisher?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ipi?: string | null
          kind?: string
          label?: string | null
          name?: string
          pro?: string | null
          publisher?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expert_gateways: {
        Row: {
          agencies: string[]
          id: string
          purchase_id: string
          signature_name: string
          signed_at: string
          user_id: string
        }
        Insert: {
          agencies?: string[]
          id?: string
          purchase_id: string
          signature_name: string
          signed_at?: string
          user_id: string
        }
        Update: {
          agencies?: string[]
          id?: string
          purchase_id?: string
          signature_name?: string
          signed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_gateways_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          legal_name: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          stage_name: string | null
          tier: Database["public"]["Enums"]["subscription_tier"] | null
          updated_at: string | null
        }
        Insert: {
          id: string
          legal_name?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          stage_name?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          legal_name?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          stage_name?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string | null
          details: Json
          environment: string
          id: string
          kind: string
          paddle_transaction_id: string
          price_ids: string[]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json
          environment?: string
          id?: string
          kind: string
          paddle_transaction_id: string
          price_ids?: string[]
          user_id: string
        }
        Update: {
          created_at?: string | null
          details?: Json
          environment?: string
          id?: string
          kind?: string
          paddle_transaction_id?: string
          price_ids?: string[]
          user_id?: string
        }
        Relationships: []
      }
      room_participants: {
        Row: {
          id: string
          joined_at: string | null
          room_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          room_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          room_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "video_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      royalty_health_checks: {
        Row: {
          ascap_compliance: Database["public"]["Enums"]["check_status"] | null
          bmi_compliance: Database["public"]["Enums"]["check_status"] | null
          catalog_id: string | null
          evaluated_at: string | null
          id: string
          ppl_uk_compliance: Database["public"]["Enums"]["check_status"] | null
          soundexchange_compliance:
            | Database["public"]["Enums"]["check_status"]
            | null
          splits_total_percentage: number
        }
        Insert: {
          ascap_compliance?: Database["public"]["Enums"]["check_status"] | null
          bmi_compliance?: Database["public"]["Enums"]["check_status"] | null
          catalog_id?: string | null
          evaluated_at?: string | null
          id?: string
          ppl_uk_compliance?: Database["public"]["Enums"]["check_status"] | null
          soundexchange_compliance?:
            | Database["public"]["Enums"]["check_status"]
            | null
          splits_total_percentage: number
        }
        Update: {
          ascap_compliance?: Database["public"]["Enums"]["check_status"] | null
          bmi_compliance?: Database["public"]["Enums"]["check_status"] | null
          catalog_id?: string | null
          evaluated_at?: string | null
          id?: string
          ppl_uk_compliance?: Database["public"]["Enums"]["check_status"] | null
          soundexchange_compliance?:
            | Database["public"]["Enums"]["check_status"]
            | null
          splits_total_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "royalty_health_checks_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_events: {
        Row: {
          created_at: string | null
          description: string | null
          end_time: string
          event_date: string
          id: string
          meeting_room_id: string | null
          start_time: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_time: string
          event_date: string
          id?: string
          meeting_room_id?: string | null
          start_time: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_time?: string
          event_date?: string
          id?: string
          meeting_room_id?: string | null
          start_time?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_events_meeting_room_id_fkey"
            columns: ["meeting_room_id"]
            isOneToOne: false
            referencedRelation: "video_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          content: Json
          id: string
          updated_at: string | null
        }
        Insert: {
          content: Json
          id: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      split_sheets: {
        Row: {
          assigned_percentage: number
          catalog_id: string | null
          collaborator_email: string
          id: string
          invited_at: string | null
          ipi_number: string | null
          is_owner: boolean
          legal_name: string | null
          pro_affiliation: string | null
          role: string
          signature_hash: string | null
          signature_name: string | null
          signed_at: string | null
        }
        Insert: {
          assigned_percentage: number
          catalog_id?: string | null
          collaborator_email: string
          id?: string
          invited_at?: string | null
          ipi_number?: string | null
          is_owner?: boolean
          legal_name?: string | null
          pro_affiliation?: string | null
          role?: string
          signature_hash?: string | null
          signature_name?: string | null
          signed_at?: string | null
        }
        Update: {
          assigned_percentage?: number
          catalog_id?: string | null
          collaborator_email?: string
          id?: string
          invited_at?: string | null
          ipi_number?: string | null
          is_owner?: boolean
          legal_name?: string | null
          pro_affiliation?: string | null
          role?: string
          signature_hash?: string | null
          signature_name?: string | null
          signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "split_sheets_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          email: string
          id: string
          kind: string
          message: string
          name: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          email: string
          id?: string
          kind?: string
          message: string
          name: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          id?: string
          kind?: string
          message?: string
          name?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_rooms: {
        Row: {
          created_at: string | null
          current_presenter_id: string | null
          description: string | null
          host_id: string | null
          id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["room_status"] | null
          title: string
        }
        Insert: {
          created_at?: string | null
          current_presenter_id?: string | null
          description?: string | null
          host_id?: string | null
          id?: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["room_status"] | null
          title: string
        }
        Update: {
          created_at?: string | null
          current_presenter_id?: string | null
          description?: string | null
          host_id?: string | null
          id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["room_status"] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_rooms_current_presenter_id_fkey"
            columns: ["current_presenter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webrtc_signals: {
        Row: {
          created_at: string | null
          id: string
          payload: Json
          receiver_id: string | null
          room_id: string | null
          sender_id: string | null
          signal_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload: Json
          receiver_id?: string | null
          room_id?: string | null
          sender_id?: string | null
          signal_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json
          receiver_id?: string | null
          room_id?: string | null
          sender_id?: string | null
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "webrtc_signals_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webrtc_signals_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "video_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webrtc_signals_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_split_invite: { Args: { _row_id: string }; Returns: Json }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_room_host: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      sign_split_invite: {
        Args: {
          _hash: string
          _ipi: string
          _pro: string
          _row_id: string
          _signature_name: string
        }
        Returns: undefined
      }
    }
    Enums: {
      agency_name: "MLC" | "SoundExchange" | "ASCAP" | "BMI"
      check_status: "Pass" | "Incomplete" | "Mismatch"
      content_format: "Single" | "EP" | "Album" | "Plus"
      registration_status:
        | "pending_review"
        | "assigned"
        | "submitted"
        | "completed"
      room_status: "scheduled" | "live" | "completed"
      subscription_tier: "free" | "paid"
      user_role: "super_admin" | "employee" | "user"
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
      agency_name: ["MLC", "SoundExchange", "ASCAP", "BMI"],
      check_status: ["Pass", "Incomplete", "Mismatch"],
      content_format: ["Single", "EP", "Album", "Plus"],
      registration_status: [
        "pending_review",
        "assigned",
        "submitted",
        "completed",
      ],
      room_status: ["scheduled", "live", "completed"],
      subscription_tier: ["free", "paid"],
      user_role: ["super_admin", "employee", "user"],
    },
  },
} as const
