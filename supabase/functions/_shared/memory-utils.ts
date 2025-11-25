import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface UserPreference {
  id?: string;
  user_id: string;
  preference_type: 'fashion' | 'vibe' | 'brand' | 'emotional' | 'experiment_level';
  preference_key: string;
  preference_value: any;
  confidence_score: number;
  source: 'explicit' | 'inferred' | 'repeated';
  created_at?: string;
  updated_at?: string;
}

export async function savePreference(
  supabase: SupabaseClient,
  userId: string,
  type: UserPreference['preference_type'],
  key: string,
  value: any,
  source: UserPreference['source'] = 'inferred',
  confidence: number = 0.5
): Promise<void> {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      preference_type: type,
      preference_key: key,
      preference_value: value,
      confidence_score: confidence,
      source,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,preference_type,preference_key' });

  if (error) {
    console.error('Error saving preference:', error);
    throw error;
  }
}

export async function getPreferences(
  supabase: SupabaseClient,
  userId: string,
  type?: UserPreference['preference_type']
): Promise<UserPreference[]> {
  let query = supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId);

  if (type) {
    query = query.eq('preference_type', type);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching preferences:', error);
    return [];
  }

  return data || [];
}

export async function updateTasteCalibration(
  supabase: SupabaseClient,
  userId: string,
  interaction: {
    item_type?: string;
    item_attributes?: Record<string, any>;
    reaction: 'positive' | 'negative' | 'neutral';
    context?: string;
  }
): Promise<void> {
  // Extract fashion preferences from interaction
  if (interaction.item_attributes) {
    const { silhouette, color, pattern, style_aesthetic } = interaction.item_attributes;

    // Update silhouette preference
    if (silhouette) {
      const existingPref = await getPreferences(supabase, userId, 'fashion');
      const silhouettePref = existingPref.find(p => p.preference_key === 'preferred_silhouette');
      const currentConfidence = silhouettePref?.confidence_score || 0.3;
      
      const newConfidence = interaction.reaction === 'positive' 
        ? Math.min(currentConfidence + 0.1, 1.0)
        : Math.max(currentConfidence - 0.05, 0.1);

      await savePreference(
        supabase, 
        userId, 
        'fashion', 
        'preferred_silhouette', 
        silhouette,
        interaction.reaction === 'positive' ? 'repeated' : 'inferred',
        newConfidence
      );
    }

    // Update color preference
    if (color) {
      await savePreference(
        supabase,
        userId,
        'fashion',
        'color_preference',
        color,
        interaction.reaction === 'positive' ? 'repeated' : 'inferred',
        interaction.reaction === 'positive' ? 0.7 : 0.4
      );
    }

    // Update style aesthetic
    if (style_aesthetic) {
      await savePreference(
        supabase,
        userId,
        'vibe',
        'aesthetic_preference',
        style_aesthetic,
        'repeated',
        interaction.reaction === 'positive' ? 0.8 : 0.5
      );
    }
  }

  // Update experimentation comfort level
  if (interaction.context?.includes('bold') || interaction.context?.includes('experimental')) {
    const currentLevel = await getPreferences(supabase, userId, 'experiment_level');
    const level = currentLevel[0]?.preference_value || 'medium';
    
    if (interaction.reaction === 'positive') {
      const newLevel = level === 'low' ? 'medium' : level === 'medium' ? 'high' : 'high';
      await savePreference(supabase, userId, 'experiment_level', 'comfort', newLevel, 'inferred', 0.7);
    } else if (interaction.reaction === 'negative') {
      const newLevel = level === 'high' ? 'medium' : level === 'medium' ? 'low' : 'low';
      await savePreference(supabase, userId, 'experiment_level', 'comfort', newLevel, 'inferred', 0.7);
    }
  }
}

export async function getWardrobePersona(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  dominant_colors: string[];
  common_patterns: string[];
  style_aesthetic: string[];
  formality_level: string;
  wardrobe_size: number;
  color_palette: 'warm' | 'cool' | 'neutral' | 'mixed';
}> {
  const { data: items, error } = await supabase
    .from('wardrobe_items')
    .select('primary_color, pattern, style_aesthetic, formality_level')
    .eq('user_id', userId);

  if (error || !items || items.length === 0) {
    return {
      dominant_colors: [],
      common_patterns: [],
      style_aesthetic: [],
      formality_level: 'casual',
      wardrobe_size: 0,
      color_palette: 'neutral',
    };
  }

  // Analyze wardrobe
  const colorCounts: Record<string, number> = {};
  const patternCounts: Record<string, number> = {};
  const aestheticCounts: Record<string, number> = {};
  const formalityCounts: Record<string, number> = {};

  items.forEach(item => {
    if (item.primary_color) {
      colorCounts[item.primary_color] = (colorCounts[item.primary_color] || 0) + 1;
    }
    if (item.pattern) {
      patternCounts[item.pattern] = (patternCounts[item.pattern] || 0) + 1;
    }
    if (item.style_aesthetic && Array.isArray(item.style_aesthetic)) {
      item.style_aesthetic.forEach((aesthetic: string) => {
        aestheticCounts[aesthetic] = (aestheticCounts[aesthetic] || 0) + 1;
      });
    }
    if (item.formality_level) {
      formalityCounts[item.formality_level] = (formalityCounts[item.formality_level] || 0) + 1;
    }
  });

  // Get top items
  const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
  const sortedPatterns = Object.entries(patternCounts).sort((a, b) => b[1] - a[1]);
  const sortedAesthetics = Object.entries(aestheticCounts).sort((a, b) => b[1] - a[1]);
  const sortedFormality = Object.entries(formalityCounts).sort((a, b) => b[1] - a[1]);

  // Determine color palette
  const warmColors = ['red', 'orange', 'yellow', 'gold', 'brown', 'rust'];
  const coolColors = ['blue', 'green', 'purple', 'teal', 'navy', 'indigo'];
  const neutralColors = ['black', 'white', 'grey', 'gray', 'beige', 'cream', 'tan'];

  let warmCount = 0, coolCount = 0, neutralCount = 0;
  sortedColors.forEach(([color]) => {
    const lowerColor = color.toLowerCase();
    if (warmColors.some(c => lowerColor.includes(c))) warmCount++;
    else if (coolColors.some(c => lowerColor.includes(c))) coolCount++;
    else if (neutralColors.some(c => lowerColor.includes(c))) neutralCount++;
  });

  const total = warmCount + coolCount + neutralCount;
  let color_palette: 'warm' | 'cool' | 'neutral' | 'mixed' = 'mixed';
  if (warmCount > total * 0.5) color_palette = 'warm';
  else if (coolCount > total * 0.5) color_palette = 'cool';
  else if (neutralCount > total * 0.5) color_palette = 'neutral';

  return {
    dominant_colors: sortedColors.slice(0, 3).map(([color]) => color),
    common_patterns: sortedPatterns.slice(0, 3).map(([pattern]) => pattern),
    style_aesthetic: sortedAesthetics.slice(0, 3).map(([aesthetic]) => aesthetic),
    formality_level: sortedFormality[0]?.[0] || 'casual',
    wardrobe_size: items.length,
    color_palette,
  };
}
