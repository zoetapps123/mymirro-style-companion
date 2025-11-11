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
      ai_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          result_json: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          result_json: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          result_json?: Json
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_category: string
          event_data: Json | null
          event_type: string
          id: string
          page_route: string
          session_id: string
          user_id: string
          viewport_height: number | null
          viewport_width: number | null
        }
        Insert: {
          created_at?: string
          event_category: string
          event_data?: Json | null
          event_type: string
          id?: string
          page_route: string
          session_id: string
          user_id: string
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Update: {
          created_at?: string
          event_category?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          page_route?: string
          session_id?: string
          user_id?: string
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Relationships: []
      }
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
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          error_message: string
          error_stack: string | null
          error_type: string
          id: string
          session_id: string | null
          url: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error_message: string
          error_stack?: string | null
          error_type: string
          id?: string
          session_id?: string | null
          url: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          error_type?: string
          id?: string
          session_id?: string | null
          url?: string
          user_id?: string | null
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
          metadata: Json | null
          name: string
          needs_regeneration: boolean | null
          occasion: string | null
          preview_image_url: string | null
          saved_to_lookbook: boolean | null
          style_tag: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          needs_regeneration?: boolean | null
          occasion?: string | null
          preview_image_url?: string | null
          saved_to_lookbook?: boolean | null
          style_tag?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          needs_regeneration?: boolean | null
          occasion?: string | null
          preview_image_url?: string | null
          saved_to_lookbook?: boolean | null
          style_tag?: string | null
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
          quick_fix: string | null
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
          quick_fix?: string | null
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
          quick_fix?: string | null
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
      user_profiles: {
        Row: {
          age_range: string | null
          body_shape: string | null
          created_at: string | null
          demo_stylecheck_image_url: string | null
          gender: string | null
          id: string
          name: string | null
          skin_tone: string | null
          updated_at: string | null
        }
        Insert: {
          age_range?: string | null
          body_shape?: string | null
          created_at?: string | null
          demo_stylecheck_image_url?: string | null
          gender?: string | null
          id: string
          name?: string | null
          skin_tone?: string | null
          updated_at?: string | null
        }
        Update: {
          age_range?: string | null
          body_shape?: string | null
          created_at?: string | null
          demo_stylecheck_image_url?: string | null
          gender?: string | null
          id?: string
          name?: string | null
          skin_tone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wardrobe_items: {
        Row: {
          brand: string | null
          category: string
          closure_type: string | null
          collar_type: string | null
          color: string | null
          color_distribution: number[] | null
          color_family: string | null
          composite_image_url: string | null
          condition: string | null
          created_at: string
          embellishments: string | null
          fabric: string | null
          fabric_primary: string | null
          fabric_weight: string | null
          fit_type: string | null
          formality_level: string | null
          hardware_details: string | null
          heel_type: string | null
          id: string
          image_url: string
          length: string | null
          material_finish: string | null
          name: string
          neckline: string | null
          pattern: string | null
          pattern_colors: string[] | null
          pattern_scale: string | null
          pattern_type: string | null
          pocket_details: string | null
          primary_color: string | null
          primary_color_name: string | null
          processed_image_url: string | null
          rise: string | null
          season: string[] | null
          secondary_colors: string[] | null
          silhouette: string | null
          sleeve_type: string | null
          special_features: string[] | null
          style_aesthetic: string[] | null
          style_notes: string | null
          style_notes_detailed: string | null
          suitable_occasions: string[] | null
          texture: string | null
          toe_style: string | null
          updated_at: string
          user_id: string
          waist_style: string | null
          weather_suitability: string | null
        }
        Insert: {
          brand?: string | null
          category: string
          closure_type?: string | null
          collar_type?: string | null
          color?: string | null
          color_distribution?: number[] | null
          color_family?: string | null
          composite_image_url?: string | null
          condition?: string | null
          created_at?: string
          embellishments?: string | null
          fabric?: string | null
          fabric_primary?: string | null
          fabric_weight?: string | null
          fit_type?: string | null
          formality_level?: string | null
          hardware_details?: string | null
          heel_type?: string | null
          id?: string
          image_url: string
          length?: string | null
          material_finish?: string | null
          name: string
          neckline?: string | null
          pattern?: string | null
          pattern_colors?: string[] | null
          pattern_scale?: string | null
          pattern_type?: string | null
          pocket_details?: string | null
          primary_color?: string | null
          primary_color_name?: string | null
          processed_image_url?: string | null
          rise?: string | null
          season?: string[] | null
          secondary_colors?: string[] | null
          silhouette?: string | null
          sleeve_type?: string | null
          special_features?: string[] | null
          style_aesthetic?: string[] | null
          style_notes?: string | null
          style_notes_detailed?: string | null
          suitable_occasions?: string[] | null
          texture?: string | null
          toe_style?: string | null
          updated_at?: string
          user_id: string
          waist_style?: string | null
          weather_suitability?: string | null
        }
        Update: {
          brand?: string | null
          category?: string
          closure_type?: string | null
          collar_type?: string | null
          color?: string | null
          color_distribution?: number[] | null
          color_family?: string | null
          composite_image_url?: string | null
          condition?: string | null
          created_at?: string
          embellishments?: string | null
          fabric?: string | null
          fabric_primary?: string | null
          fabric_weight?: string | null
          fit_type?: string | null
          formality_level?: string | null
          hardware_details?: string | null
          heel_type?: string | null
          id?: string
          image_url?: string
          length?: string | null
          material_finish?: string | null
          name?: string
          neckline?: string | null
          pattern?: string | null
          pattern_colors?: string[] | null
          pattern_scale?: string | null
          pattern_type?: string | null
          pocket_details?: string | null
          primary_color?: string | null
          primary_color_name?: string | null
          processed_image_url?: string | null
          rise?: string | null
          season?: string[] | null
          secondary_colors?: string[] | null
          silhouette?: string | null
          sleeve_type?: string | null
          special_features?: string[] | null
          style_aesthetic?: string[] | null
          style_notes?: string | null
          style_notes_detailed?: string | null
          suitable_occasions?: string[] | null
          texture?: string | null
          toe_style?: string | null
          updated_at?: string
          user_id?: string
          waist_style?: string | null
          weather_suitability?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_cache: { Args: never; Returns: undefined }
      cleanup_old_analytics: { Args: never; Returns: undefined }
      cleanup_old_error_logs: { Args: never; Returns: undefined }
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
