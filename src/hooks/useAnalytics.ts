import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import { getDeviceInfo, getUTMParams, getReferrer, isEntryPoint } from '@/lib/deviceDetection';

// In-memory fallback for iOS Private Mode
let memorySessionId: string | null = null;
let sessionStartTime: number = Date.now();

// Generate a session ID that persists during the browser session
const getSessionId = (): string => {
  try {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      try {
        sessionStorage.setItem('analytics_session_id', sessionId);
      } catch {
        // Private mode - use memory fallback
        memorySessionId = sessionId;
      }
    }
    return sessionId;
  } catch {
    // sessionStorage not available - use memory fallback
    if (!memorySessionId) {
      memorySessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    return memorySessionId;
  }
};

interface AnalyticsEvent {
  eventType: string;
  eventCategory: string;
  eventData?: Record<string, any>;
  screenName?: string;
  flowId?: string;
  engagementSource?: string;
  pageRoute?: string;
  virtualPath?: string;
}

interface FlowState {
  startTime: number;
  steps: string[];
  flowId: string;
}

export const useAnalytics = () => {
  const location = useLocation();
  const sessionId = useRef(getSessionId());
  const pageStartTime = useRef<number>(Date.now());
  const lastScrollPosition = useRef<number>(0);
  const scrollDebounceTimer = useRef<NodeJS.Timeout>();
  
  // Rage tap detection
  const clickHistory = useRef<Array<{ element: string; timestamp: number; x: number; y: number }>>([]);
  
  // Flow tracking
  const activeFlows = useRef<Map<string, FlowState>>(new Map());
  
  // Screen tracking
  const currentScreen = useRef<string>('');
  const screenStartTime = useRef<number>(Date.now());

  // Deduplication tracking
  const recentEvents = useRef<Map<string, number>>(new Map());

  // Page view tracking
  const currentPageViewId = useRef<string | null>(null);
  const sessionInitialized = useRef<boolean>(false);
  const entryPointTracked = useRef<boolean>(false);

  // Helper function to get screen category from screen name
  const getScreenCategory = useCallback((screenName: string): string | null => {
    if (!screenName) return null;
    if (screenName.startsWith('stylecheck')) return 'stylecheck';
    if (screenName.startsWith('wardrobe')) return 'wardrobe';
    if (screenName === 'chat') return 'chat';
    if (screenName === 'home') return 'home';
    if (screenName === 'profile') return 'profile';
    return 'other';
  }, []);

  // Helper function to infer screen from current path
  const inferScreenFromPath = useCallback((): string | null => {
    const path = location.pathname;
    if (path.includes('/stylecheck')) return 'stylecheck-hub';
    if (path.includes('/wardrobe')) return 'wardrobe-hub';
    if (path.includes('/chat')) return 'chat';
    if (path === '/') return 'home';
    return null;
  }, [location.pathname]);

  // Generate human-readable user_action from event type and data
  const generateUserAction = useCallback((eventType: string, eventData: any = {}): string => {
    const actionMap: Record<string, (data: any) => string> = {
      // Wardrobe interactions
      'wardrobe_item_clicked': (d) => `Opened ${d.item_name || 'wardrobe item'} details`,
      'wardrobe_item_deleted': (d) => `Deleted ${d.item_name || 'item'} from wardrobe`,
      'wardrobe_item_edited': (d) => `Updated ${d.item_name || 'item'} properties`,
      'wardrobe_item_shared': (d) => `Shared ${d.item_name || 'item'}`,
      
      // Navigation
      'tab_change': (d) => `Switched from ${d.from_tab} to ${d.to_tab}`,
      'wardrobe_nav': (d) => `Navigated to ${d.view} view`,
      
      // Outfit generation
      'outfit_generation_occasion_selected': (d) => `Selected ${d.occasion} occasion for outfit generation`,
      'outfit_generation_style_selected': (d) => `Selected ${d.style} style for outfits`,
      'outfit_generation_anchor_selected': (d) => `Selected ${d.item_name} as anchor item`,
      'outfit_card_clicked': (d) => `Opened ${d.outfit_name || 'outfit'} details`,
      'outfit_saved_to_lookbook': (d) => `Saved ${d.outfit_name} to Lookbook`,
      'outfit_regenerate_all': (d) => `Regenerated all outfit suggestions`,
      'outfit_generation_try_another': (d) => `Switched anchor item for outfit generation`,
      
      // Filters
      'filter_applied': (d) => {
        if (d.filter_type === 'category') return `Filtered wardrobe to show only ${d.filter_value}`;
        if (d.filter_type === 'lookbook') return `Filtered lookbook by ${d.filter_value}`;
        return `Applied ${d.filter_type} filter: ${d.filter_value}`;
      },
      
      // Profile actions
      'settings_opened': () => `Opened settings menu`,
      'referral_initiated': (d) => `Shared referral link via ${d.share_method || 'unknown'}`,
      'sign_out_clicked': () => `Signed out from profile`,
      'profile_stat_clicked': (d) => `Viewed ${d.stat_type?.replace(/_/g, ' ')} details`,
      
      // Upload actions
      'add_item_clicked': (d) => `Opened wardrobe upload from ${d.source}`,
      'add_item_image_selected': () => `Selected image for wardrobe upload`,
      
      // Auth
      'auth_signup_success': (d) => `Signed up successfully via ${d.method}`,
      'auth_signin_success': (d) => `Signed in successfully via ${d.method}`,
      
      // Frustration events
      'error_popup_shown': (d) => `Error: ${d.error_message || 'Unknown error'}`,
      'rage_click': (d) => `Rage clicked on ${d.element_text || d.element_id || 'element'} ${d.click_count || 3} times`,
      
      // Style Check
      'style_check_image_selected': () => `Selected image for style check`,
      'outfit_battle_completed': (d) => `Completed outfit battle (Winner: ${d.winner})`,
    };
    
    // Use custom mapping if available, otherwise fallback
    return actionMap[eventType]?.(eventData) || eventType.replace(/_/g, ' ').toLowerCase();
  }, []);

  // Initialize or update session in sessions table
  const ensureSession = useCallback(async (userId: string) => {
    if (sessionInitialized.current) return;
    
    try {
      const deviceInfo = getDeviceInfo();
      
      const { data: existing } = await supabase
        .from('sessions')
        .select('session_id')
        .eq('session_id', sessionId.current)
        .single();

      if (!existing) {
        await supabase.from('sessions').insert({
          session_id: sessionId.current,
          user_id: userId,
          started_at: new Date(sessionStartTime).toISOString(),
          viewport_width: deviceInfo.viewport_width,
          viewport_height: deviceInfo.viewport_height,
          session_metadata: {
            device_type: deviceInfo.device_type,
            os_name: deviceInfo.os_name,
            browser_name: deviceInfo.browser_name
          }
        });
      }
      
      sessionInitialized.current = true;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Session initialization error:', error);
      }
    }
  }, []);

  // Update session end time
  const updateSessionEnd = useCallback(async () => {
    try {
      await supabase
        .from('sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('session_id', sessionId.current);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Session end update error:', error);
      }
    }
  }, []);

  // Track an event - never throw errors
  const trackEvent = useCallback(async ({ eventType, eventCategory, eventData, screenName, flowId, engagementSource, pageRoute, virtualPath }: AnalyticsEvent) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Ensure session exists
      await ensureSession(user.id);

      // Deduplication: Skip if same event was tracked within last 1 second
      const dedupKey = `${eventType}_${user.id}_${sessionId.current}_${JSON.stringify(eventData || {})}`;
      const now = Date.now();
      const lastTracked = recentEvents.current.get(dedupKey);
      
      if (lastTracked && now - lastTracked < 1000) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Skipping duplicate event:', eventType, eventData);
        }
        return;
      }
      
      recentEvents.current.set(dedupKey, now);
      
      // Clean old entries (keep only last 10 seconds)
      if (recentEvents.current.size > 100) {
        const oldestAllowed = now - 10000;
        for (const [key, timestamp] of recentEvents.current.entries()) {
          if (timestamp < oldestAllowed) {
            recentEvents.current.delete(key);
          }
        }
      }

      // Auto-populate missing context
      const finalScreenName = screenName || currentScreen.current || inferScreenFromPath();
      const finalVirtualPath = virtualPath || 
        (finalScreenName ? `/app/${finalScreenName}` : null) ||
        location.pathname;
      const finalScreenCategory = finalScreenName ? getScreenCategory(finalScreenName) : null;

      // Generate descriptive user_action from event context
      const user_action = eventData?.user_action || generateUserAction(eventType, eventData);
      
      // Extract duration_seconds if present in event_data
      const duration_seconds = typeof eventData?.duration_seconds === 'number' 
        ? eventData.duration_seconds 
        : null;

      // Track to new tables based on event type
      if (eventType === 'page_view' || eventType === 'screen_view') {
        // Get device and UTM info
        const deviceInfo = getDeviceInfo();
        const utmParams = getUTMParams();
        const referrer = getReferrer();
        const entry_point = (!entryPointTracked.current && isEntryPoint()) ? finalVirtualPath : null;
        
        if (entry_point) {
          entryPointTracked.current = true;
        }
        
        // Insert into page_views table with comprehensive metadata
        const { data: pageView } = await supabase.from('page_views').insert({
          session_id: sessionId.current,
          user_id: user.id,
          occurred_at: new Date().toISOString(),
          page_route: pageRoute || location.pathname,
          page_title: eventData?.page_title || document.title,
          screen_name: finalScreenName,
          screen_category: finalScreenCategory,
          virtual_path: finalVirtualPath,
          referrer: referrer || null,
          utm_source: utmParams.utm_source || null,
          utm_medium: utmParams.utm_medium || null,
          utm_campaign: utmParams.utm_campaign || null,
          entry_point: entry_point,
          device_type: deviceInfo.device_type,
          os_name: deviceInfo.os_name,
          browser_name: deviceInfo.browser_name,
          viewport_width: deviceInfo.viewport_width,
          viewport_height: deviceInfo.viewport_height,
          duration_ms: null,
          exit_reason: null,
          metadata: eventData || {}
        }).select('id').single();

        if (pageView) {
          currentPageViewId.current = pageView.id;
        }
      } else {
        // Insert into user_events table with enhanced fields
        await supabase.from('user_events').insert({
          session_id: sessionId.current,
          page_view_id: currentPageViewId.current,
          user_id: user.id,
          occurred_at: new Date().toISOString(),
          event_type: eventType,
          event_category: eventCategory,
          event_name: eventData?.event_name || user_action,
          event_source: engagementSource || null,
          user_action,
          element_id: eventData?.element_id || eventData?.element || null,
          element_text: eventData?.element_text || eventData?.text || null,
          value: eventData?.value || null,
          numeric_value: eventData?.numeric_value !== undefined ? eventData.numeric_value : null,
          duration_seconds,
          flow_id: flowId || null,
          metadata: eventData || {}
        });
      }
    } catch (error) {
      // Silently fail - analytics should never break the app
      if (process.env.NODE_ENV === 'development') {
        console.warn('Analytics tracking error:', error);
      }
    }
  }, [location.pathname, getScreenCategory, inferScreenFromPath, ensureSession]);

  // Detect rage taps (rapid repeated clicks)
  const detectRageTap = useCallback((element: string, elementText: string, x: number, y: number) => {
    const now = Date.now();
    const recentClicks = clickHistory.current.filter(c => 
      now - c.timestamp < 2000 && // Within 2 seconds
      Math.abs(c.x - x) < 50 && // Within 50px radius
      Math.abs(c.y - y) < 50
    );
    
    if (recentClicks.length >= 2) { // 3+ clicks in same area (2 recent + current)
      trackEvent({
        eventType: 'rage_click',
        eventCategory: 'frustration',
        eventData: {
          element_id: element,
          element_text: elementText,
          click_count: recentClicks.length + 1,
          time_span_ms: now - recentClicks[0].timestamp,
          coordinates: { x, y }
        },
        engagementSource: `frustration:rage_click`
      });
    }
    
    clickHistory.current.push({ element, timestamp: now, x, y });
    // Keep only last 10 seconds of clicks
    clickHistory.current = clickHistory.current.filter(c => now - c.timestamp < 10000);
  }, [trackEvent]);

  // Track click events with semantic IDs
  const trackClick = useCallback((element: string, elementId?: string, additionalData?: Record<string, any>, x?: number, y?: number, pageRoute?: string) => {
    // Only track clicks with semantic IDs or important elements
    const semanticId = additionalData?.['data-analytics-id'];
    const importantElements = ['button', 'a', 'input', 'select'];
    
    if (semanticId || importantElements.includes(element.toLowerCase())) {
      const elementText = additionalData?.text || '';
      const currentPageRoute = pageRoute || location.pathname;
      const engagementSource = semanticId 
        ? `${currentPageRoute} - ${semanticId}`
        : elementText 
          ? `${currentPageRoute} - ${elementText.substring(0, 50)}`
          : `${currentPageRoute} - ${element}`;
      
      trackEvent({
        eventType: 'click',
        eventCategory: 'interaction',
        eventData: {
          element: semanticId || element,
          elementId,
          ...additionalData,
        },
        engagementSource,
        pageRoute: currentPageRoute
      });
      
      // Detect rage taps for buttons
      if (element.toLowerCase() === 'button' && x !== undefined && y !== undefined) {
        detectRageTap(semanticId || elementId || element, elementText, x, y);
      }
    }
  }, [trackEvent, detectRageTap, location.pathname]);

  // Track page view duration by updating page_views table directly
  const trackPageDuration = useCallback(async () => {
    if (!currentPageViewId.current) return;
    
    const durationMs = Date.now() - pageStartTime.current;
    const durationSeconds = Math.round(durationMs / 1000);
    
    try {
      await supabase
        .from('page_views')
        .update({ 
          duration_ms: durationMs,
          duration_seconds: durationSeconds,
          exited_at: new Date().toISOString(),
          exit_reason: 'navigation'
        })
        .eq('id', currentPageViewId.current);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Page duration update error:', error);
      }
    }
  }, []);

  // Track scroll milestones
  const scrollMilestonesReached = useRef<Set<number>>(new Set());
  const trackScroll = useCallback((scrollPosition: number, scrollPercentage: number) => {
    // Only track milestone percentages: 25%, 50%, 75%, 100%
    const milestones = [25, 50, 75, 100];
    const currentMilestone = milestones.find(m => 
      scrollPercentage >= m && !scrollMilestonesReached.current.has(m)
    );
    
    if (currentMilestone) {
      scrollMilestonesReached.current.add(currentMilestone);
      trackEvent({
        eventType: 'scroll_milestone',
        eventCategory: 'engagement',
        eventData: {
          milestone: currentMilestone,
          scroll_position: scrollPosition,
        },
        engagementSource: `${location.pathname} - ${currentMilestone}% Scrolled`
      });
    }
    lastScrollPosition.current = scrollPosition;
  }, [trackEvent, location.pathname]);

  // Flow tracking functions
  const startFlow = useCallback((flowName: string, metadata?: Record<string, any>) => {
    const flowId = `${flowName}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    activeFlows.current.set(flowName, {
      startTime: Date.now(),
      steps: [],
      flowId
    });
    
    trackEvent({
      eventType: 'flow_started',
      eventCategory: 'conversion',
      eventData: {
        flow_name: flowName,
        ...metadata
      },
      flowId,
      engagementSource: `${flowName} - Started`
    });
    
    return flowId;
  }, [trackEvent]);

  const trackFlowStep = useCallback((flowName: string, stepName: string, metadata?: Record<string, any>) => {
    const flow = activeFlows.current.get(flowName);
    if (flow) {
      flow.steps.push(stepName);
      trackEvent({
        eventType: 'flow_step',
        eventCategory: 'conversion',
        eventData: {
          flow_name: flowName,
          step_name: stepName,
          step_index: flow.steps.length,
          time_since_start: Date.now() - flow.startTime,
          ...metadata
        },
        flowId: flow.flowId,
        engagementSource: `${flowName} - ${stepName}`
      });
    }
  }, [trackEvent]);

  const completeFlow = useCallback((flowName: string, success: boolean, metadata?: Record<string, any>) => {
    const flow = activeFlows.current.get(flowName);
    if (flow) {
      const duration = Date.now() - flow.startTime;
      trackEvent({
        eventType: success ? 'flow_completed' : 'flow_abandoned',
        eventCategory: 'conversion',
        eventData: {
          flow_name: flowName,
          duration_ms: duration,
          duration_seconds: Math.round(duration / 1000),
          steps_completed: flow.steps,
          total_steps: flow.steps.length,
          ...metadata
        },
        flowId: flow.flowId,
        engagementSource: `${flowName} - ${success ? 'Completed' : 'Abandoned'}`
      });
      activeFlows.current.delete(flowName);
    }
  }, [trackEvent]);

  // Screen tracking functions
  const trackScreenView = useCallback(async (screenName: string, metadata?: Record<string, any>, virtualPath?: string, pageRoute?: string) => {
    const currentPageRoute = pageRoute || virtualPath || `/app/${screenName}`;
    
    if (currentScreen.current && currentPageViewId.current) {
      // Update previous page view with exit time and duration (in ms for precision)
      const timeOnScreenMs = Date.now() - screenStartTime.current;
      const timeOnScreen = Math.round(timeOnScreenMs / 1000);
      try {
        await supabase.from('page_views')
          .update({ 
            exited_at: new Date().toISOString(),
            duration_seconds: timeOnScreen,
            duration_ms: timeOnScreenMs,
            exit_reason: 'navigation'
          })
          .eq('id', currentPageViewId.current);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Page view update error:', error);
        }
      }

    }
    
    // Track entry to new screen
    currentScreen.current = screenName;
    screenStartTime.current = Date.now();
    
    trackEvent({
      eventType: 'screen_view',
      eventCategory: 'navigation',
      eventData: {
        screen_name: screenName,
        page_title: metadata?.page_title,
        ...metadata
      },
      screenName,
      engagementSource: `navigation:screen_view`,
      pageRoute: currentPageRoute,
      virtualPath: virtualPath
    });
  }, [trackEvent]);

  // Track custom events
  const trackCustom = useCallback((eventType: string, eventData?: Record<string, any>, engagementSource?: string, pageRoute?: string) => {
    trackEvent({
      eventType,
      eventCategory: 'custom',
      eventData,
      engagementSource: engagementSource || `Custom - ${eventType}`,
      pageRoute: pageRoute
    });
  }, [trackEvent]);

  // Track errors (for integration with toast)
  const trackError = useCallback((errorMessage: string, errorContext?: Record<string, any>) => {
    trackEvent({
      eventType: 'error_popup_shown',
      eventCategory: 'frustration',
      eventData: {
        error_message: errorMessage,
        error_type: errorContext?.error_type || 'toast_error',
        error_context: errorContext,
        screen_name: currentScreen.current || inferScreenFromPath()
      },
      engagementSource: 'frustration:error_popup'
    });
  }, [trackEvent, inferScreenFromPath]);

  // Auto-track page views with duration tracking
  useEffect(() => {
    // Track page duration before route change
    if (currentPageViewId.current) {
      trackPageDuration();
    }
    
    // Reset tracking for new page
    const currentPath = location.pathname;
    pageStartTime.current = Date.now();
    scrollMilestonesReached.current.clear();
    
    // Infer screen name from path
    const screenName = currentPath === '/' ? 'index' : 
                       currentPath === '/history' ? 'history' : 
                       currentPath.startsWith('/') ? currentPath.slice(1) || 'unknown' : 
                       'unknown';
    
    trackEvent({
      eventType: 'page_view',
      eventCategory: 'navigation',
      screenName: screenName,
      eventData: {
        referrer: document.referrer,
      },
      engagementSource: 'navigation:page_view',
      pageRoute: currentPath
    });

    // Track page duration on unmount/route change
    return () => {
      trackPageDuration();
    };
  }, [location.pathname, trackEvent, trackPageDuration]);

  // Auto-track scroll events with debouncing
  useEffect(() => {
    const handleScroll = () => {
      if (scrollDebounceTimer.current) {
        clearTimeout(scrollDebounceTimer.current);
      }

      scrollDebounceTimer.current = setTimeout(() => {
        const scrollPosition = window.scrollY;
        const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercentage = (scrollPosition / documentHeight) * 100;

        trackScroll(scrollPosition, scrollPercentage);
      }, 500); // Debounce scroll events by 500ms
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollDebounceTimer.current) {
        clearTimeout(scrollDebounceTimer.current);
      }
    };
  }, [trackScroll]);

  // Track session timeout (5+ minutes inactive) and session end
  const lastActivityTime = useRef<number>(Date.now());
  const sessionTimeoutTracked = useRef<boolean>(false);

  useEffect(() => {
    const updateActivity = () => {
      lastActivityTime.current = Date.now();
      sessionTimeoutTracked.current = false;
    };

    const checkInactivity = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityTime.current;
      const fiveMinutes = 5 * 60 * 1000;

        if (inactiveTime >= fiveMinutes && !sessionTimeoutTracked.current) {
        sessionTimeoutTracked.current = true;
        updateSessionEnd();
        trackEvent({
          eventType: 'session_timeout',
          eventCategory: 'engagement',
          eventData: {
            inactive_duration_ms: inactiveTime,
            inactive_duration_seconds: Math.round(inactiveTime / 1000),
            total_session_time: Date.now() - sessionStartTime,
          },
          engagementSource: 'system:session_timeout'
        });
      }
    }, 30000); // Check every 30 seconds

    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => document.addEventListener(event, updateActivity, { passive: true }));

    // Track session end on page unload
    const handleBeforeUnload = () => {
      // Update session end time
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/sessions?session_id=eq.${sessionId.current}`,
        JSON.stringify({
          ended_at: new Date().toISOString()
        })
      );
    };

    // Track long tab inactivity as session end
    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastActivityTime.current = Date.now();
      } else {
        const hiddenDuration = Date.now() - lastActivityTime.current;
        if (hiddenDuration > 30 * 60 * 1000) { // 30 minutes
          updateSessionEnd();
          // Generate new session ID for next activity
          sessionId.current = getSessionId();
          sessionStartTime = Date.now();
          sessionInitialized.current = false;
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(checkInactivity);
      activityEvents.forEach(event => document.removeEventListener(event, updateActivity));
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [trackEvent, location.pathname]);

  return {
    trackEvent,
    trackClick,
    trackScroll,
    trackCustom,
    trackPageDuration,
    startFlow,
    trackFlowStep,
    completeFlow,
    trackScreenView,
  };
};
