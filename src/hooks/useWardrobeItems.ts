import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WardrobeItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  color?: string;
  fabric?: string;
  texture?: string;
  pattern?: string;
  style_notes?: string;
  image_url: string;
  processed_image_url?: string;
  composite_image_url?: string;
  created_at: string;
  updated_at: string;
}

const fetchWardrobeItems = async (): Promise<WardrobeItem[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

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
