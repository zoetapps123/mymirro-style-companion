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
          duration_seconds: number | null
          event_category: string
          event_data: Json | null
          event_source: string | null
          event_type: string
          flow_id: string | null
          id: string
          page_route: string
          screen_category: string | null
          screen_name: string | null
          session_id: string
          session_metadata: Json | null
          user_action: string | null
          user_id: string
          viewport_height: number | null
          viewport_width: number | null
          virtual_path: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          event_category: string
          event_data?: Json | null
          event_source?: string | null
          event_type: string
          flow_id?: string | null
          id?: string
          page_route: string
          screen_category?: string | null
          screen_name?: string | null
          session_id: string
          session_metadata?: Json | null
          user_action?: string | null
          user_id: string
          viewport_height?: number | null
          viewport_width?: number | null
          virtual_path?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          event_category?: string
          event_data?: Json | null
          event_source?: string | null
          event_type?: string
          flow_id?: string | null
          id?: string
          page_route?: string
          screen_category?: string | null
          screen_name?: string | null
          session_id?: string
          session_metadata?: Json | null
          user_action?: string | null
          user_id?: string
          viewport_height?: number | null
          viewport_width?: number | null
          virtual_path?: string | null
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
      chat_logs: {
        Row: {
          ai_response: string | null
          conversation_turn: number | null
          created_at: string | null
          id: string
          intent: string | null
          messages: Json | null
          user_id: string
          user_message: string | null
        }
        Insert: {
          ai_response?: string | null
          conversation_turn?: number | null
          created_at?: string | null
          id?: string
          intent?: string | null
          messages?: Json | null
          user_id: string
          user_message?: string | null
        }
        Update: {
          ai_response?: string | null
          conversation_turn?: number | null
          created_at?: string | null
          id?: string
          intent?: string | null
          messages?: Json | null
          user_id?: string
          user_message?: string | null
        }
        Relationships: []
      }
      conversation_state: {
        Row: {
          chat_direction: string | null
          consecutive_outfit_blocks: number | null
          created_at: string | null
          current_turn: number | null
          emotional_tone: string | null
          id: string
          last_5_intents: Json | null
          last_generated_outfit_ids: string[] | null
          last_intent_confidence: number | null
          last_intent_detected: string | null
          last_known_occasion: string | null
          last_mode_used: string | null
          last_outfit_generation_turn: number | null
          last_user_query_type: string | null
          outstanding_question_flag: boolean | null
          recommendation_mode: string | null
          updated_at: string | null
          user_id: string
          wardrobe_validation_state: Json | null
        }
        Insert: {
          chat_direction?: string | null
          consecutive_outfit_blocks?: number | null
          created_at?: string | null
          current_turn?: number | null
          emotional_tone?: string | null
          id?: string
          last_5_intents?: Json | null
          last_generated_outfit_ids?: string[] | null
          last_intent_confidence?: number | null
          last_intent_detected?: string | null
          last_known_occasion?: string | null
          last_mode_used?: string | null
          last_outfit_generation_turn?: number | null
          last_user_query_type?: string | null
          outstanding_question_flag?: boolean | null
          recommendation_mode?: string | null
          updated_at?: string | null
          user_id: string
          wardrobe_validation_state?: Json | null
        }
        Update: {
          chat_direction?: string | null
          consecutive_outfit_blocks?: number | null
          created_at?: string | null
          current_turn?: number | null
          emotional_tone?: string | null
          id?: string
          last_5_intents?: Json | null
          last_generated_outfit_ids?: string[] | null
          last_intent_confidence?: number | null
          last_intent_detected?: string | null
          last_known_occasion?: string | null
          last_mode_used?: string | null
          last_outfit_generation_turn?: number | null
          last_user_query_type?: string | null
          outstanding_question_flag?: boolean | null
          recommendation_mode?: string | null
          updated_at?: string | null
          user_id?: string
          wardrobe_validation_state?: Json | null
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
      page_views: {
        Row: {
          browser_name: string | null
          device_type: string | null
          duration_ms: number | null
          duration_seconds: number | null
          entered_at: string
          entry_point: string | null
          exit_reason: string | null
          exited_at: string | null
          id: string
          metadata: Json | null
          occurred_at: string
          os_name: string | null
          page_route: string
          page_title: string | null
          referrer: string | null
          screen_category: string | null
          screen_name: string | null
          session_id: string
          user_id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          viewport_height: number | null
          viewport_width: number | null
          virtual_path: string | null
        }
        Insert: {
          browser_name?: string | null
          device_type?: string | null
          duration_ms?: number | null
          duration_seconds?: number | null
          entered_at?: string
          entry_point?: string | null
          exit_reason?: string | null
          exited_at?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          os_name?: string | null
          page_route: string
          page_title?: string | null
          referrer?: string | null
          screen_category?: string | null
          screen_name?: string | null
          session_id: string
          user_id: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
          virtual_path?: string | null
        }
        Update: {
          browser_name?: string | null
          device_type?: string | null
          duration_ms?: number | null
          duration_seconds?: number | null
          entered_at?: string
          entry_point?: string | null
          exit_reason?: string | null
          exited_at?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          os_name?: string | null
          page_route?: string
          page_title?: string | null
          referrer?: string | null
          screen_category?: string | null
          screen_name?: string | null
          session_id?: string
          user_id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
          virtual_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_views_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "page_views_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_session_analytics"
            referencedColumns: ["session_id"]
          },
        ]
      }
      sessions: {
        Row: {
          ended_at: string | null
          session_id: string
          session_metadata: Json | null
          started_at: string
          user_id: string
          viewport_height: number | null
          viewport_width: number | null
        }
        Insert: {
          ended_at?: string | null
          session_id: string
          session_metadata?: Json | null
          started_at?: string
          user_id: string
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Update: {
          ended_at?: string | null
          session_id?: string
          session_metadata?: Json | null
          started_at?: string
          user_id?: string
          viewport_height?: number | null
          viewport_width?: number | null
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
      user_events: {
        Row: {
          created_at: string
          duration_seconds: number | null
          element_id: string | null
          element_text: string | null
          event_category: string
          event_data: Json | null
          event_name: string | null
          event_source: string | null
          event_type: string
          flow_id: string | null
          id: string
          metadata: Json | null
          numeric_value: number | null
          occurred_at: string
          page_view_id: string | null
          session_id: string
          user_action: string | null
          user_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          element_id?: string | null
          element_text?: string | null
          event_category: string
          event_data?: Json | null
          event_name?: string | null
          event_source?: string | null
          event_type: string
          flow_id?: string | null
          id?: string
          metadata?: Json | null
          numeric_value?: number | null
          occurred_at?: string
          page_view_id?: string | null
          session_id: string
          user_action?: string | null
          user_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          element_id?: string | null
          element_text?: string | null
          event_category?: string
          event_data?: Json | null
          event_name?: string | null
          event_source?: string | null
          event_type?: string
          flow_id?: string | null
          id?: string
          metadata?: Json | null
          numeric_value?: number | null
          occurred_at?: string
          page_view_id?: string | null
          session_id?: string
          user_action?: string | null
          user_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_events_page_view_id_fkey"
            columns: ["page_view_id"]
            isOneToOne: false
            referencedRelation: "page_views"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "user_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_session_analytics"
            referencedColumns: ["session_id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          id: string
          preference_key: string
          preference_type: string
          preference_value: Json | null
          source: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          preference_key: string
          preference_type: string
          preference_value?: Json | null
          source?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          preference_key?: string
          preference_type?: string
          preference_value?: Json | null
          source?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          age_range: string | null
          body_shape: string | null
          created_at: string | null
          demo_stylecheck_image_url: string | null
          email: string | null
          gender: string | null
          id: string
          name: string | null
          phone: string | null
          skin_tone: string | null
          updated_at: string | null
        }
        Insert: {
          age_range?: string | null
          body_shape?: string | null
          created_at?: string | null
          demo_stylecheck_image_url?: string | null
          email?: string | null
          gender?: string | null
          id: string
          name?: string | null
          phone?: string | null
          skin_tone?: string | null
          updated_at?: string | null
        }
        Update: {
          age_range?: string | null
          body_shape?: string | null
          created_at?: string | null
          demo_stylecheck_image_url?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          skin_tone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wardrobe_items: {
        Row: {
          category: string
          color: string | null
          created_at: string
          fabric_primary: string | null
          fit_type: string | null
          formality_level: string | null
          id: string
          image_url: string
          item_type: string | null
          length: string | null
          name: string
          original_image_url: string | null
          pattern_description: string | null
          pattern_type: string | null
          primary_color: string | null
          processed_image_url: string | null
          season: string[] | null
          style_aesthetic: string[] | null
          style_notes_detailed: string | null
          suitable_occasions: string[] | null
          texture: string | null
          updated_at: string
          user_id: string
          weather_suitability: string | null
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string
          fabric_primary?: string | null
          fit_type?: string | null
          formality_level?: string | null
          id?: string
          image_url: string
          item_type?: string | null
          length?: string | null
          name: string
          original_image_url?: string | null
          pattern_description?: string | null
          pattern_type?: string | null
          primary_color?: string | null
          processed_image_url?: string | null
          season?: string[] | null
          style_aesthetic?: string[] | null
          style_notes_detailed?: string | null
          suitable_occasions?: string[] | null
          texture?: string | null
          updated_at?: string
          user_id: string
          weather_suitability?: string | null
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          fabric_primary?: string | null
          fit_type?: string | null
          formality_level?: string | null
          id?: string
          image_url?: string
          item_type?: string | null
          length?: string | null
          name?: string
          original_image_url?: string | null
          pattern_description?: string | null
          pattern_type?: string | null
          primary_color?: string | null
          processed_image_url?: string | null
          season?: string[] | null
          style_aesthetic?: string[] | null
          style_notes_detailed?: string | null
          suitable_occasions?: string[] | null
          texture?: string | null
          updated_at?: string
          user_id?: string
          weather_suitability?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      analytics_flow_funnel: {
        Row: {
          abandoned: number | null
          completed: number | null
          completion_rate: number | null
          flow_name: string | null
          started: number | null
        }
        Relationships: []
      }
      analytics_rage_taps: {
        Row: {
          affected_users: number | null
          avg_clicks: number | null
          element: string | null
          page_route: string | null
          rage_tap_count: number | null
        }
        Relationships: []
      }
      analytics_screen_dropoff: {
        Row: {
          exit_count: number | null
          exit_rate: number | null
          screen_name: string | null
          total_views: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      analytics_upload_success: {
        Row: {
          avg_duration_seconds: number | null
          date: string | null
          failed_uploads: number | null
          success_rate: number | null
          successful_uploads: number | null
          total_attempts: number | null
        }
        Relationships: []
      }
      v_analytics_events_clean: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          event_category: string | null
          event_data: Json | null
          event_source: string | null
          event_type: string | null
          flow_id: string | null
          id: string | null
          page_route: string | null
          screen_category: string | null
          screen_name: string | null
          session_id: string | null
          session_metadata: Json | null
          user_action: string | null
          user_id: string | null
          viewport_height: number | null
          viewport_width: number | null
          virtual_path: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          event_category?: string | null
          event_data?: Json | null
          event_source?: string | null
          event_type?: string | null
          flow_id?: string | null
          id?: string | null
          page_route?: string | null
          screen_category?: string | null
          screen_name?: string | null
          session_id?: string | null
          session_metadata?: Json | null
          user_action?: string | null
          user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
          virtual_path?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          event_category?: string | null
          event_data?: Json | null
          event_source?: string | null
          event_type?: string | null
          flow_id?: string | null
          id?: string | null
          page_route?: string | null
          screen_category?: string | null
          screen_name?: string | null
          session_id?: string | null
          session_metadata?: Json | null
          user_action?: string | null
          user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
          virtual_path?: string | null
        }
        Relationships: []
      }
      v_analytics_events_unified: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          event_category: string | null
          event_data: Json | null
          event_source: string | null
          event_type: string | null
          flow_id: string | null
          id: string | null
          page_route: string | null
          screen_category: string | null
          screen_name: string | null
          session_id: string | null
          session_metadata: Json | null
          user_action: string | null
          user_id: string | null
          viewport_height: number | null
          viewport_width: number | null
          virtual_path: string | null
        }
        Relationships: []
      }
      v_analytics_health: {
        Row: {
          affected_rows: number | null
          issue: string | null
          pct_of_total: number | null
        }
        Relationships: []
      }
      v_event_analytics: {
        Row: {
          avg_duration_seconds: number | null
          event_count: number | null
          event_source: string | null
          screen_category: string | null
          screen_name: string | null
          unique_sessions: number | null
          unique_users: number | null
          user_action: string | null
        }
        Relationships: []
      }
      v_feature_engagement: {
        Row: {
          active_days: number | null
          first_seen: string | null
          last_seen: string | null
          total_events: number | null
          unique_sessions: number | null
          unique_users: number | null
          user_action: string | null
        }
        Relationships: []
      }
      v_page_analytics: {
        Row: {
          avg_duration_seconds: number | null
          current_viewers: number | null
          median_duration_seconds: number | null
          screen_category: string | null
          screen_name: string | null
          total_views: number | null
          unique_sessions: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      v_screen_time_analysis: {
        Row: {
          avg_duration_seconds: number | null
          median_duration_seconds: number | null
          screen_category: string | null
          screen_name: string | null
          total_time_seconds: number | null
          unique_sessions: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      v_session_analytics: {
        Row: {
          actions_performed: string[] | null
          ended_at: string | null
          page_views_count: number | null
          screens_visited: string[] | null
          session_duration_seconds: number | null
          session_id: string | null
          started_at: string | null
          user_events_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_session_summary: {
        Row: {
          actions_performed: string[] | null
          screens_visited: string[] | null
          session_duration_seconds: number | null
          session_end: string | null
          session_id: string | null
          session_start: string | null
          total_events: number | null
          unique_actions: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_user_action_frequency: {
        Row: {
          avg_duration_seconds: number | null
          event_count: number | null
          event_source: string | null
          screen_category: string | null
          unique_sessions: number | null
          unique_users: number | null
          user_action: string | null
        }
        Relationships: []
      }
      v_user_journey: {
        Row: {
          created_at: string | null
          next_action: string | null
          previous_action: string | null
          screen_name: string | null
          seconds_since_last_action: number | null
          session_id: string | null
          user_action: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_user_journey_detailed: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          event_data: Json | null
          event_source: string | null
          next_screen: string | null
          previous_screen: string | null
          screen_category: string | null
          screen_name: string | null
          seconds_since_last_event: number | null
          session_id: string | null
          user_action: string | null
          user_id: string | null
          virtual_path: string | null
        }
        Relationships: []
      }
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
