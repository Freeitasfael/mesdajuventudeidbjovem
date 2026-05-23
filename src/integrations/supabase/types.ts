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
      admin_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          details: Json | null
          id: string
          level: string
          message: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          details?: Json | null
          id?: string
          level?: string
          message: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          level?: string
          message?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      buyers: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      manual_sales: {
        Row: {
          amount_cents: number | null
          buyer_name: string
          created_at: string
          id: string
          receipt_path: string
          seller_id: string
        }
        Insert: {
          amount_cents?: number | null
          buyer_name: string
          created_at?: string
          id?: string
          receipt_path: string
          seller_id: string
        }
        Update: {
          amount_cents?: number | null
          buyer_name?: string
          created_at?: string
          id?: string
          receipt_path?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_sales_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      numbers: {
        Row: {
          number: number
          order_id: string | null
          reserved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          number: number
          order_id?: string | null
          reserved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          number?: number
          order_id?: string | null
          reserved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "numbers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_numbers: {
        Row: {
          created_at: string
          id: string
          number: number
          order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          number: number
          order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          number?: number
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_numbers_number_fkey"
            columns: ["number"]
            isOneToOne: false
            referencedRelation: "numbers"
            referencedColumns: ["number"]
          },
          {
            foreignKeyName: "order_numbers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          created_at: string
          expires_at: string
          id: string
          referral_label: string | null
          seller_id: string | null
          status: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          expires_at: string
          id?: string
          referral_label?: string | null
          seller_id?: string | null
          status?: string
          total_cents: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          referral_label?: string | null
          seller_id?: string | null
          status?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          level: string
          message: string
          order_id: string | null
          payment_id: string | null
          provider_payment_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          level?: string
          message: string
          order_id?: string | null
          payment_id?: string | null
          provider_payment_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          level?: string
          message?: string
          order_id?: string | null
          payment_id?: string | null
          provider_payment_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          last_reconcile_at: string | null
          last_reconcile_error: string | null
          next_reconcile_at: string | null
          order_id: string
          provider: string
          provider_payment_id: string | null
          qr_code: string | null
          qr_code_base64: string | null
          raw: Json | null
          reconcile_attempts: number
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          last_reconcile_at?: string | null
          last_reconcile_error?: string | null
          next_reconcile_at?: string | null
          order_id: string
          provider?: string
          provider_payment_id?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          raw?: Json | null
          reconcile_attempts?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          last_reconcile_at?: string | null
          last_reconcile_error?: string | null
          next_reconcile_at?: string | null
          order_id?: string
          provider?: string
          provider_payment_id?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          raw?: Json | null
          reconcile_attempts?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reconcile_lock: {
        Row: {
          id: number
          locked_at: string | null
          locked_by: string | null
          locked_until: string | null
        }
        Insert: {
          id?: number
          locked_at?: string | null
          locked_by?: string | null
          locked_until?: string | null
        }
        Update: {
          id?: number
          locked_at?: string | null
          locked_by?: string | null
          locked_until?: string | null
        }
        Relationships: []
      }
      reconcile_runs: {
        Row: {
          approved: number
          candidates: number
          duration_ms: number | null
          errors: number
          expired_orders: number
          finished_at: string | null
          freed_numbers: number
          id: string
          notes: string | null
          processed: number
          reconciled: number
          skipped: number
          started_at: string
        }
        Insert: {
          approved?: number
          candidates?: number
          duration_ms?: number | null
          errors?: number
          expired_orders?: number
          finished_at?: string | null
          freed_numbers?: number
          id?: string
          notes?: string | null
          processed?: number
          reconciled?: number
          skipped?: number
          started_at?: string
        }
        Update: {
          approved?: number
          candidates?: number
          duration_ms?: number | null
          errors?: number
          expired_orders?: number
          finished_at?: string | null
          freed_numbers?: number
          id?: string
          notes?: string | null
          processed?: number
          reconciled?: number
          skipped?: number
          started_at?: string
        }
        Relationships: []
      }
      sellers: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          ref_code: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          ref_code: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          ref_code?: string
          user_id?: string | null
        }
        Relationships: []
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
      admin_dashboard_stats: {
        Args: never
        Returns: {
          numbers_available: number
          numbers_paid: number
          numbers_reserved: number
          paid_orders: number
          pending_orders: number
          sellers_count: number
          total_revenue_cents: number
        }[]
      }
      admin_free_number: { Args: { _number: number }; Returns: undefined }
      admin_list_orders: {
        Args: { _limit?: number }
        Returns: {
          buyer_name: string
          buyer_phone: string
          created_at: string
          expires_at: string
          numbers: number[]
          order_id: string
          payment_id: string
          payment_status: string
          provider_payment_id: string
          referral_label: string
          seller_name: string
          status: string
          total_cents: number
        }[]
      }
      admin_refund_order: {
        Args: { _order_id: string }
        Returns: {
          freed_numbers: number
        }[]
      }
      admin_reset_all_data: {
        Args: never
        Returns: {
          numbers_reset: number
          orders_deleted: number
        }[]
      }
      confirm_payment: { Args: { _order_id: string }; Returns: undefined }
      ensure_my_seller: {
        Args: never
        Returns: {
          id: string
          name: string
          ref_code: string
        }[]
      }
      expire_reservations: {
        Args: never
        Returns: {
          expired_orders: number
          freed_numbers: number
        }[]
      }
      get_my_manual_sales: {
        Args: never
        Returns: {
          amount_cents: number
          buyer_name: string
          created_at: string
          id: string
          receipt_path: string
        }[]
      }
      get_my_seller: {
        Args: never
        Returns: {
          created_at: string
          id: string
          name: string
          phone: string
          ref_code: string
        }[]
      }
      get_my_seller_order: {
        Args: { _order_id: string }
        Returns: {
          buyer_name: string
          buyer_phone: string
          created_at: string
          expires_at: string
          numbers: number[]
          order_id: string
          payment_id: string
          payment_status: string
          provider_payment_id: string
          qr_code: string
          qr_code_base64: string
          status: string
          total_cents: number
        }[]
      }
      get_my_seller_orders: {
        Args: never
        Returns: {
          buyer_name: string
          buyer_phone: string
          created_at: string
          expires_at: string
          numbers: number[]
          order_id: string
          referral_label: string
          status: string
          total_cents: number
        }[]
      }
      get_my_seller_stats: {
        Args: never
        Returns: {
          paid_orders: number
          pending_orders: number
          pending_revenue_cents: number
          total_numbers_paid: number
          total_orders: number
          total_revenue_cents: number
        }[]
      }
      get_seller_by_ref: {
        Args: { _ref_code: string }
        Returns: {
          id: string
          name: string
          ref_code: string
        }[]
      }
      get_seller_ranking: {
        Args: never
        Returns: {
          ref_code: string
          seller_id: string
          seller_name: string
          total_cents: number
          total_numbers: number
          total_orders: number
        }[]
      }
      next_seller_ref_code: { Args: never; Returns: string }
      register_my_manual_sale: {
        Args: {
          _amount_cents?: number
          _buyer_name: string
          _receipt_path: string
        }
        Returns: string
      }
      register_seller_self: {
        Args: { _name: string; _phone: string }
        Returns: {
          id: string
          name: string
          ref_code: string
        }[]
      }
      reserve_numbers: {
        Args: { _numbers: number[]; _order_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "seller"
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
      app_role: ["admin", "seller"],
    },
  },
} as const
