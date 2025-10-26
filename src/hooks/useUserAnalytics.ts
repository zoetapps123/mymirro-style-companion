import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserAnalytics {
  wardrobeItems: number;
  savedOutfits: number;
  styleChecks: number;
  battlesWon: number;
  totalEvents: number;
  recentActivity: Array<{
    type: string;
    date: string;
    description: string;
  }>;
}

export const useUserAnalytics = () => {
  const [analytics, setAnalytics] = useState<UserAnalytics>({
    wardrobeItems: 0,
    savedOutfits: 0,
    styleChecks: 0,
    battlesWon: 0,
    totalEvents: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch counts from existing tables
      const [wardrobeResult, outfitsResult, styleChecksResult, battlesResult, eventsResult] = await Promise.all([
        supabase.from('wardrobe_items').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('outfits').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('style_checks').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('battles').select('*').eq('user_id', user.id),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      ]);

      // Count battles won
      const battlesWon = battlesResult.data?.filter(battle => {
        const results = battle.results as any;
        return results?.winner === user.id;
      }).length || 0;

      // Get recent activity
      const recentActivity = await buildRecentActivity(user.id);

      setAnalytics({
        wardrobeItems: wardrobeResult.count || 0,
        savedOutfits: outfitsResult.count || 0,
        styleChecks: styleChecksResult.count || 0,
        battlesWon,
        totalEvents: eventsResult.count || 0,
        recentActivity
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildRecentActivity = async (userId: string) => {
    const activities: Array<{ type: string; date: string; description: string }> = [];

    // Fetch recent items from each table
    const [wardrobeItems, outfits, styleChecks, battles, events] = await Promise.all([
      supabase.from('wardrobe_items').select('created_at, name').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('outfits').select('created_at, name').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('style_checks').select('created_at, outfit_name, overall_score').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('battles').select('created_at, participants').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('events').select('created_at, title').eq('user_id', userId).order('created_at', { ascending: false }).limit(5)
    ]);

    // Add wardrobe items
    wardrobeItems.data?.forEach(item => {
      activities.push({
        type: 'wardrobe',
        date: item.created_at,
        description: `Added ${item.name} to wardrobe`
      });
    });

    // Add outfits
    outfits.data?.forEach(outfit => {
      activities.push({
        type: 'outfit',
        date: outfit.created_at,
        description: `Created outfit: ${outfit.name}`
      });
    });

    // Add style checks
    styleChecks.data?.forEach(check => {
      activities.push({
        type: 'style-check',
        date: check.created_at,
        description: `Style checked ${check.outfit_name || 'an outfit'} - Score: ${check.overall_score}/10`
      });
    });

    // Add battles
    battles.data?.forEach(battle => {
      const participants = (battle.participants as any)?.length || 0;
      activities.push({
        type: 'battle',
        date: battle.created_at,
        description: `Participated in outfit battle with ${participants} contestants`
      });
    });

    // Add events
    events.data?.forEach(event => {
      activities.push({
        type: 'event',
        date: event.created_at,
        description: `Planned event: ${event.title}`
      });
    });

    // Sort by date and return top 10
    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  };

  return { analytics, loading, refetch: fetchAnalytics };
};
