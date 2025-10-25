import { supabase } from "@/integrations/supabase/client";

export interface AnalyticsEvent {
  event_name: string;
  screen?: string;
  element_id?: string;
  payload?: Record<string, any>;
}

/**
 * Track user interaction events for the Interactive Profile
 */
export const trackEvent = async (event: AnalyticsEvent) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn("Cannot track event: User not authenticated");
      return;
    }

    const { error } = await supabase.from("analytics_events").insert({
      user_id: user.id,
      event_name: event.event_name,
      screen: event.screen,
      element_id: event.element_id,
      payload_json: event.payload || {},
    });

    if (error) {
      console.error("Error tracking event:", error);
    }
  } catch (error) {
    console.error("Error tracking event:", error);
  }
};

// Convenience functions for common events
export const analytics = {
  // AI Companion events
  promptClicked: (prompt: string, screen: string) =>
    trackEvent({ event_name: "prompt_clicked", screen, payload: { prompt } }),
  
  messageSent: (messageLength: number, screen: string) =>
    trackEvent({ event_name: "sent_message", screen, payload: { messageLength } }),
  
  imageUploaded: (screen: string) =>
    trackEvent({ event_name: "uploaded_image", screen }),
  
  suggestionFollowed: (suggestion: string, screen: string) =>
    trackEvent({ event_name: "suggestion_followed", screen, payload: { suggestion } }),

  // Wardrobe events
  wardrobeUploadStarted: () =>
    trackEvent({ event_name: "wardrobe_upload_started", screen: "wardrobe" }),
  
  wardrobeUploadCompleted: (itemCount: number) =>
    trackEvent({ event_name: "wardrobe_upload_completed", screen: "wardrobe", payload: { itemCount } }),
  
  itemCategorized: (category: string) =>
    trackEvent({ event_name: "item_categorized", screen: "wardrobe", payload: { category } }),
  
  itemEdited: (itemId: string) =>
    trackEvent({ event_name: "item_edited", screen: "wardrobe", payload: { itemId } }),
  
  filterApplied: (filter: string) =>
    trackEvent({ event_name: "filter_applied", screen: "wardrobe", payload: { filter } }),

  // Outfit events
  outfitGenerated: (outfitId: string) =>
    trackEvent({ event_name: "outfit_generated", screen: "wardrobe", payload: { outfitId } }),
  
  outfitSaved: (outfitId: string) =>
    trackEvent({ event_name: "outfit_saved", screen: "wardrobe", payload: { outfitId } }),
  
  tryOnStarted: (outfitId: string) =>
    trackEvent({ event_name: "try_on_started", screen: "wardrobe", payload: { outfitId } }),
  
  tryOnCompleted: (outfitId: string) =>
    trackEvent({ event_name: "try_on_completed", screen: "wardrobe", payload: { outfitId } }),
  
  tryOnFailed: (reason: string) =>
    trackEvent({ event_name: "try_on_failed_reason", screen: "wardrobe", payload: { reason } }),

  // Style Check events
  styleCheckSubmitted: (checkId: string) =>
    trackEvent({ event_name: "style_check_submitted", screen: "style_check", payload: { checkId } }),
  
  styleScoreDisplayed: (score: number) =>
    trackEvent({ event_name: "style_score_displayed", screen: "style_check", payload: { score } }),
  
  itemsExtracted: (itemCount: number) =>
    trackEvent({ event_name: "items_extracted_from_photo", screen: "style_check", payload: { itemCount } }),
  
  shareOpened: (type: string) =>
    trackEvent({ event_name: "share_template_opened", screen: "style_check", payload: { type } }),
  
  shared: (channel: string) =>
    trackEvent({ event_name: "shared_to_channel", screen: "style_check", payload: { channel } }),

  // Battle events
  battleCreated: (battleId: string, participantCount: number) =>
    trackEvent({ event_name: "battle_created", screen: "battles", payload: { battleId, participantCount } }),
  
  participantNamed: (name: string) =>
    trackEvent({ event_name: "participant_added", screen: "battles", payload: { name } }),
  
  battleRankingsViewed: (battleId: string) =>
    trackEvent({ event_name: "battle_rankings_generated", screen: "battles", payload: { battleId } }),
  
  battleShared: (battleId: string) =>
    trackEvent({ event_name: "battle_shared", screen: "battles", payload: { battleId } }),

  // Calendar events
  calendarEventCreated: (date: string) =>
    trackEvent({ event_name: "calendar_event_created", screen: "wardrobe", payload: { date } }),
  
  outfitAssigned: (outfitId: string, date: string) =>
    trackEvent({ event_name: "outfit_assigned_to_date", screen: "wardrobe", payload: { outfitId, date } }),
};
