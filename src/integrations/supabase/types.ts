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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      crop_predictions: {
        Row: {
          actual_yield: number | null
          area_hectares: number
          confidence_score: number | null
          created_at: string | null
          crop_type: string
          district: string | null
          financial_projection: Json | null
          humidity: number | null
          id: string
          notes: string | null
          predicted_yield: number
          rainfall_mm: number
          recommendations: Json | null
          risk_assessment: Json | null
          season: string
          soil_type: string
          state: string
          temperature: number | null
          total_production: number
          user_id: string
        }
        Insert: {
          actual_yield?: number | null
          area_hectares: number
          confidence_score?: number | null
          created_at?: string | null
          crop_type: string
          district?: string | null
          financial_projection?: Json | null
          humidity?: number | null
          id?: string
          notes?: string | null
          predicted_yield: number
          rainfall_mm: number
          recommendations?: Json | null
          risk_assessment?: Json | null
          season: string
          soil_type: string
          state: string
          temperature?: number | null
          total_production: number
          user_id: string
        }
        Update: {
          actual_yield?: number | null
          area_hectares?: number
          confidence_score?: number | null
          created_at?: string | null
          crop_type?: string
          district?: string | null
          financial_projection?: Json | null
          humidity?: number | null
          id?: string
          notes?: string | null
          predicted_yield?: number
          rainfall_mm?: number
          recommendations?: Json | null
          risk_assessment?: Json | null
          season?: string
          soil_type?: string
          state?: string
          temperature?: number | null
          total_production?: number
          user_id?: string
        }
        Relationships: []
      }
      historical_yields: {
        Row: {
          avg_yield: number
          created_at: string | null
          crop_type: string
          data_source: string | null
          district: string | null
          id: string
          rainfall_mm: number | null
          soil_type: string | null
          state: string
          temperature: number | null
          year: number
        }
        Insert: {
          avg_yield: number
          created_at?: string | null
          crop_type: string
          data_source?: string | null
          district?: string | null
          id?: string
          rainfall_mm?: number | null
          soil_type?: string | null
          state: string
          temperature?: number | null
          year: number
        }
        Update: {
          avg_yield?: number
          created_at?: string | null
          crop_type?: string
          data_source?: string | null
          district?: string | null
          id?: string
          rainfall_mm?: number | null
          soil_type?: string | null
          state?: string
          temperature?: number | null
          year?: number
        }
        Relationships: []
      }
      mandi_prices: {
        Row: {
          arrival_date: string
          arrivals_deviation: number | null
          arrivals_tonnes: number | null
          commodity: string
          created_at: string
          district: string
          grade: string | null
          humidity: number | null
          id: string
          is_festival: boolean | null
          is_harvest_season: boolean | null
          is_sowing_season: boolean | null
          market: string
          max_price: number
          min_price: number
          modal_price: number
          momentum_7: number | null
          msp_gap: number | null
          msp_price: number | null
          policy_event: string | null
          price_lag_1: number | null
          price_lag_30: number | null
          price_lag_7: number | null
          rainfall_mm: number | null
          rolling_mean_30: number | null
          rolling_mean_7: number | null
          rolling_std_7: number | null
          state: string
          temp_max: number | null
          temp_min: number | null
          updated_at: string
          variety: string | null
          volatility_30: number | null
        }
        Insert: {
          arrival_date: string
          arrivals_deviation?: number | null
          arrivals_tonnes?: number | null
          commodity: string
          created_at?: string
          district: string
          grade?: string | null
          humidity?: number | null
          id?: string
          is_festival?: boolean | null
          is_harvest_season?: boolean | null
          is_sowing_season?: boolean | null
          market: string
          max_price: number
          min_price: number
          modal_price: number
          momentum_7?: number | null
          msp_gap?: number | null
          msp_price?: number | null
          policy_event?: string | null
          price_lag_1?: number | null
          price_lag_30?: number | null
          price_lag_7?: number | null
          rainfall_mm?: number | null
          rolling_mean_30?: number | null
          rolling_mean_7?: number | null
          rolling_std_7?: number | null
          state: string
          temp_max?: number | null
          temp_min?: number | null
          updated_at?: string
          variety?: string | null
          volatility_30?: number | null
        }
        Update: {
          arrival_date?: string
          arrivals_deviation?: number | null
          arrivals_tonnes?: number | null
          commodity?: string
          created_at?: string
          district?: string
          grade?: string | null
          humidity?: number | null
          id?: string
          is_festival?: boolean | null
          is_harvest_season?: boolean | null
          is_sowing_season?: boolean | null
          market?: string
          max_price?: number
          min_price?: number
          modal_price?: number
          momentum_7?: number | null
          msp_gap?: number | null
          msp_price?: number | null
          policy_event?: string | null
          price_lag_1?: number | null
          price_lag_30?: number | null
          price_lag_7?: number | null
          rainfall_mm?: number | null
          rolling_mean_30?: number | null
          rolling_mean_7?: number | null
          rolling_std_7?: number | null
          state?: string
          temp_max?: number | null
          temp_min?: number | null
          updated_at?: string
          variety?: string | null
          volatility_30?: number | null
        }
        Relationships: []
      }
      market_prices: {
        Row: {
          ArrivalDate: string | null
          Commodity: string | null
          CommodityCode: number | null
          District: string | null
          Grade: string | null
          Market: string | null
          MaxPrice: number | null
          MinPrice: number | null
          ModalPrice: number | null
          State: string | null
          Variety: string | null
        }
        Insert: {
          ArrivalDate?: string | null
          Commodity?: string | null
          CommodityCode?: number | null
          District?: string | null
          Grade?: string | null
          Market?: string | null
          MaxPrice?: number | null
          MinPrice?: number | null
          ModalPrice?: number | null
          State?: string | null
          Variety?: string | null
        }
        Update: {
          ArrivalDate?: string | null
          Commodity?: string | null
          CommodityCode?: number | null
          District?: string | null
          Grade?: string | null
          Market?: string | null
          MaxPrice?: number | null
          MinPrice?: number | null
          ModalPrice?: number | null
          State?: string | null
          Variety?: string | null
        }
        Relationships: []
      }
      price_forecasts: {
        Row: {
          absolute_error: number | null
          actual_modal: number | null
          commodity: string
          confidence_level: number | null
          confidence_lower: number | null
          confidence_upper: number | null
          created_at: string
          district: string
          feature_importance: Json | null
          forecast_date: string
          horizon_days: number
          id: string
          market: string
          model_used: string
          model_version: string | null
          percentage_error: number | null
          predicted_max: number
          predicted_min: number
          predicted_modal: number
          state: string
          target_date: string
          top_drivers: Json | null
          variety: string | null
        }
        Insert: {
          absolute_error?: number | null
          actual_modal?: number | null
          commodity: string
          confidence_level?: number | null
          confidence_lower?: number | null
          confidence_upper?: number | null
          created_at?: string
          district: string
          feature_importance?: Json | null
          forecast_date: string
          horizon_days: number
          id?: string
          market: string
          model_used: string
          model_version?: string | null
          percentage_error?: number | null
          predicted_max: number
          predicted_min: number
          predicted_modal: number
          state: string
          target_date: string
          top_drivers?: Json | null
          variety?: string | null
        }
        Update: {
          absolute_error?: number | null
          actual_modal?: number | null
          commodity?: string
          confidence_level?: number | null
          confidence_lower?: number | null
          confidence_upper?: number | null
          created_at?: string
          district?: string
          feature_importance?: Json | null
          forecast_date?: string
          horizon_days?: number
          id?: string
          market?: string
          model_used?: string
          model_version?: string | null
          percentage_error?: number | null
          predicted_max?: number
          predicted_min?: number
          predicted_modal?: number
          state?: string
          target_date?: string
          top_drivers?: Json | null
          variety?: string | null
        }
        Relationships: []
      }
      user_farms: {
        Row: {
          created_at: string | null
          crops_grown: string[] | null
          district: string | null
          farm_name: string
          id: string
          location: Json | null
          soil_test_results: Json | null
          state: string
          total_area: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          crops_grown?: string[] | null
          district?: string | null
          farm_name: string
          id?: string
          location?: Json | null
          soil_test_results?: Json | null
          state: string
          total_area: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          crops_grown?: string[] | null
          district?: string | null
          farm_name?: string
          id?: string
          location?: Json | null
          soil_test_results?: Json | null
          state?: string
          total_area?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
