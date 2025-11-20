import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OutfitItem {
  id: string;
  name: string;
  category: string;
  color?: string;
  fabric?: string;
  pattern?: string;
  style_notes?: string;
  processed_image_url?: string;
  image_url: string;
}

export interface Outfit {
  id: string;
  name: string;
  occasion?: string;
  style_tag?: string;
  preview_image_url?: string;
  saved_to_lookbook: boolean;
  metadata?: {
    type?: string;
    reasoning?: string;
    anchorItemId?: string;
  };
  items: OutfitItem[];
}

const fetchOutfits = async (): Promise<Outfit[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: outfits, error } = await supabase
    .from('outfits')
    .select(`
      *,
      outfit_items (
        item_id,
        item_type,
        wardrobe_items (*)
      )
    `)
    .eq('user_id', user.id)
    .eq('saved_to_lookbook', false);

  if (error) {
    console.error('Error fetching outfits:', error);
    throw error;
  }

  return (outfits || []).map(outfit => ({
    id: outfit.id,
    name: outfit.name,
    occasion: outfit.occasion,
    style_tag: outfit.style_tag,
    preview_image_url: outfit.preview_image_url,
    saved_to_lookbook: outfit.saved_to_lookbook,
    metadata: outfit.metadata as any,
    items: outfit.outfit_items
      ?.map((oi: any) => oi.wardrobe_items)
      .filter(Boolean) || []
  }));
};

export const useOutfits = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['outfits-suggestions'],
    queryFn: fetchOutfits,
    staleTime: 60 * 60 * 1000, // 1 hour - good balance for AI-generated content
    gcTime: 24 * 60 * 60 * 1000, // 24 hours - safe due to invalidation on save/regenerate
  });

  const invalidateOutfits = () => {
    queryClient.invalidateQueries({ queryKey: ['outfits-suggestions'] });
  };

  const refetchOutfits = () => {
    return query.refetch();
  };

  return {
    outfits: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    invalidateOutfits,
    refetchOutfits,
  };
};
