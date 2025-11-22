import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';

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

  // Initialize or update session in sessions table
  const ensureSession = useCallback(async (userId: string) => {
    if (sessionInitialized.current) return;
    
    try {
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
          viewport_width: window.innerWidth,
          viewport_height: window.innerHeight,
          session_metadata: {}
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

      // Extract user_action from event_type or event_data
      const user_action = eventData?.user_action || 
        eventType.replace(/_/g, ' ').toLowerCase();
      
      // Extract duration_seconds if present in event_data
      const duration_seconds = typeof eventData?.duration_seconds === 'number' 
        ? eventData.duration_seconds 
        : null;

      // Track to new tables based on event type
      if (eventType === 'page_view' || eventType === 'screen_view') {
        // Insert into page_views table
        const { data: pageView } = await supabase.from('page_views').insert({
          session_id: sessionId.current,
          user_id: user.id,
          page_route: pageRoute || location.pathname,
          screen_name: finalScreenName,
          screen_category: finalScreenCategory,
          virtual_path: finalVirtualPath,
          duration_seconds: null
        }).select('id').single();

        if (pageView) {
          currentPageViewId.current = pageView.id;
        }
      } else {
        // Insert into user_events table
        await supabase.from('user_events').insert({
          session_id: sessionId.current,
          page_view_id: currentPageViewId.current,
          user_id: user.id,
          event_type: eventType,
          event_category: eventCategory,
          event_source: engagementSource || null,
          user_action,
          duration_seconds,
          flow_id: flowId || null,
          event_data: eventData || {}
        });
      }
    } catch (error) {
      // Silently fail - analytics should never break the app
      if (process.env.NODE_ENV === 'development') {
        console.warn('Analytics tracking error:', error);
      }
    }
  }, [location.pathname, getScreenCategory, inferScreenFromPath, ensureSession]);

  // Detect rage taps
  const detectRageTap = useCallback((element: string, x: number, y: number) => {
    const now = Date.now();
    const recentClicks = clickHistory.current.filter(c => 
      now - c.timestamp < 3000 && // Within 3 seconds
      Math.abs(c.x - x) < 50 && // Within 50px radius
      Math.abs(c.y - y) < 50
    );
    
    if (recentClicks.length >= 2) { // 3+ clicks in same area (2 recent + current)
      trackEvent({
        eventType: 'rage_tap',
        eventCategory: 'frustration',
        eventData: {
          element,
          click_count: recentClicks.length + 1,
          coordinates: { x, y }
        },
        engagementSource: `user_action:rage_tap`
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
        detectRageTap(semanticId || elementId || element, x, y);
      }
    }
  }, [trackEvent, detectRageTap, location.pathname]);

  // Track page view duration
  const trackPageDuration = useCallback(() => {
    const duration = Date.now() - pageStartTime.current;
    trackEvent({
      eventType: 'page_view_duration',
      eventCategory: 'navigation',
      eventData: {
        duration_ms: duration,
        duration_seconds: Math.round(duration / 1000),
      },
      engagementSource: `${location.pathname} - Page View Duration`
    });
  }, [trackEvent, location.pathname]);

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
      // Update previous page view with exit time and duration
      const timeOnScreen = Math.round((Date.now() - screenStartTime.current) / 1000);
      try {
        await supabase.from('page_views')
          .update({ 
            exited_at: new Date().toISOString(),
            duration_seconds: timeOnScreen
          })
          .eq('id', currentPageViewId.current);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Page view update error:', error);
        }
      }

      // Track exit event
      trackEvent({
        eventType: 'screen_exit',
        eventCategory: 'navigation',
        eventData: {
          from_screen: currentScreen.current,
          to_screen: screenName,
          time_on_screen: timeOnScreen,
          duration_seconds: timeOnScreen,
          ...metadata
        },
        screenName: currentScreen.current,
        engagementSource: `navigation:screen_exit`,
        pageRoute: currentPageRoute,
        virtualPath: virtualPath
      });
    }
    
    // Track entry to new screen
    currentScreen.current = screenName;
    screenStartTime.current = Date.now();
    
    trackEvent({
      eventType: 'screen_view',
      eventCategory: 'navigation',
      eventData: {
        screen_name: screenName,
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

  // Auto-track page views and reset scroll milestones
  useEffect(() => {
    const currentPath = location.pathname;
    pageStartTime.current = Date.now();
    scrollMilestonesReached.current.clear(); // Reset milestones on page change
    
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

    // Track page duration on unmount
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
