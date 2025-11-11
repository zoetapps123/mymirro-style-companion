import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WardrobeItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  // Legacy field
  color?: string;
  fabric?: string;
  texture?: string;
  pattern?: string;
  style_notes?: string;
  // Enhanced color fields
  primary_color?: string;
  primary_color_name?: string;
  color_family?: string;
  secondary_colors?: string[];
  color_distribution?: number[];
  // Fabric & material
  fabric_primary?: string;
  fabric_weight?: string;
  material_finish?: string;
  // Pattern
  pattern_type?: string;
  pattern_scale?: string;
  pattern_colors?: string[];
  // Cut & fit
  fit_type?: string;
  silhouette?: string;
  length?: string;
  // Design elements
  neckline?: string;
  sleeve_type?: string;
  closure_type?: string;
  pocket_details?: string;
  hardware_details?: string;
  embellishments?: string;
  special_features?: string[];
  // Style & aesthetic
  style_aesthetic?: string[];
  formality_level?: string;
  style_notes_detailed?: string;
  // Occasion & use
  suitable_occasions?: string[];
  season?: string[];
  weather_suitability?: string;
  // Category-specific
  rise?: string;
  waist_style?: string;
  heel_type?: string;
  toe_style?: string;
  collar_type?: string;
  // Optional
  brand?: string;
  condition?: string;
  // Images
  image_url: string;
  processed_image_url?: string;
  composite_image_url?: string;
  created_at: string;
  updated_at: string;
}

const fetchWardrobeItems = async (): Promise<WardrobeItem[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Explicitly select all metadata fields for comprehensive AI outfit generation
  // Using wildcard (*) ensures we get all current and future fields
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching wardrobe items:", error);
    throw error;
  }

  // Deduplicate items client-side
  const uniqueItems = data?.reduce((acc: WardrobeItem[], item: WardrobeItem) => {
    const isDuplicate = acc.some(existing => 
      existing.category?.toLowerCase() === item.category?.toLowerCase() &&
      existing.name?.toLowerCase() === item.name?.toLowerCase() &&
      existing.color?.toLowerCase() === item.color?.toLowerCase()
    );
    if (!isDuplicate) {
      acc.push(item);
    }
    return acc;
  }, []) || [];

  return uniqueItems;
};

export const useWardrobeItems = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['wardrobe-items'],
    queryFn: fetchWardrobeItems,
    staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Cache persists for 10 minutes
  });

  const invalidateItems = () => {
    queryClient.invalidateQueries({ queryKey: ['wardrobe-items'] });
  };

  const refetchItems = () => {
    return query.refetch();
  };

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    invalidateItems,
    refetchItems,
  };
};
