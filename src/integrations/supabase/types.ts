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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      battles: {
        Row: {
          created_at: string
          id: string
          participants: Json
          results: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          participants: Json
          results: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          participants?: Json
          results?: Json
          user_id?: string
        }
        Relationships: []
      }
      event_outfits: {
        Row: {
          created_at: string
          event_date: string
          event_id: string
          id: string
          outfit_id: string
        }
        Insert: {
          created_at?: string
          event_date: string
          event_id: string
          id?: string
          outfit_id: string
        }
        Update: {
          created_at?: string
          event_date?: string
          event_id?: string
          id?: string
          outfit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_outfits_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_outfits_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          occasion: string | null
          place: string | null
          start_date: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          occasion?: string | null
          place?: string | null
          start_date: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          occasion?: string | null
          place?: string | null
          start_date?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      outfit_items: {
        Row: {
          ai_meta: Json | null
          ai_virtual: boolean
          created_at: string
          id: string
          item_id: string | null
          item_type: string
          outfit_id: string
        }
        Insert: {
          ai_meta?: Json | null
          ai_virtual?: boolean
          created_at?: string
          id?: string
          item_id?: string | null
          item_type: string
          outfit_id: string
        }
        Update: {
          ai_meta?: Json | null
          ai_virtual?: boolean
          created_at?: string
          id?: string
          item_id?: string | null
          item_type?: string
          outfit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "wardrobe_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfits: {
        Row: {
          created_at: string
          id: string
          name: string
          occasion: string | null
          preview_image_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          occasion?: string | null
          preview_image_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          occasion?: string | null
          preview_image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      style_checks: {
        Row: {
          color_score: number
          created_at: string
          fit_score: number
          id: string
          image_url: string
          occasion: string | null
          occasion_score: number
          outfit_name: string | null
          overall_score: number
          texture_score: number
          user_id: string
          verdict_improvements: string
          verdict_positive: string
        }
        Insert: {
          color_score: number
          created_at?: string
          fit_score: number
          id?: string
          image_url: string
          occasion?: string | null
          occasion_score: number
          outfit_name?: string | null
          overall_score: number
          texture_score: number
          user_id: string
          verdict_improvements: string
          verdict_positive: string
        }
        Update: {
          color_score?: number
          created_at?: string
          fit_score?: number
          id?: string
          image_url?: string
          occasion?: string | null
          occasion_score?: number
          outfit_name?: string | null
          overall_score?: number
          texture_score?: number
          user_id?: string
          verdict_improvements?: string
          verdict_positive?: string
        }
        Relationships: []
      }
      tryon_sessions: {
        Row: {
          created_at: string
          id: string
          outfit_id: string | null
          render_url: string | null
          status: string
          user_id: string
          user_image_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          outfit_id?: string | null
          render_url?: string | null
          status?: string
          user_id: string
          user_image_url: string
        }
        Update: {
          created_at?: string
          id?: string
          outfit_id?: string | null
          render_url?: string | null
          status?: string
          user_id?: string
          user_image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tryon_sessions_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      wardrobe_items: {
        Row: {
          category: string
          color: string | null
          created_at: string
          id: string
          image_url: string
          name: string
          processed_image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string
          id?: string
          image_url: string
          name: string
          processed_image_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          processed_image_url?: string | null
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
