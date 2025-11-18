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

  // Track an event - never throw errors
  const trackEvent = useCallback(async ({ eventType, eventCategory, eventData, screenName, flowId }: AnalyticsEvent) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('analytics_events').insert({
        user_id: user.id,
        session_id: sessionId.current,
        event_type: eventType,
        event_category: eventCategory,
        event_data: eventData || null,
        page_route: location.pathname,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        screen_name: screenName || currentScreen.current || null,
        flow_id: flowId || null,
      });
    } catch (error) {
      // Silently fail - analytics should never break the app
      if (process.env.NODE_ENV === 'development') {
        console.warn('Analytics tracking error:', error);
      }
    }
  }, [location.pathname]);

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
        }
      });
    }
    
    clickHistory.current.push({ element, timestamp: now, x, y });
    // Keep only last 10 seconds of clicks
    clickHistory.current = clickHistory.current.filter(c => now - c.timestamp < 10000);
  }, [trackEvent]);

  // Track click events with semantic IDs
  const trackClick = useCallback((element: string, elementId?: string, additionalData?: Record<string, any>, x?: number, y?: number) => {
    // Only track clicks with semantic IDs or important elements
    const semanticId = additionalData?.['data-analytics-id'];
    const importantElements = ['button', 'a', 'input', 'select'];
    
    if (semanticId || importantElements.includes(element.toLowerCase())) {
      trackEvent({
        eventType: 'click',
        eventCategory: 'interaction',
        eventData: {
          element: semanticId || element,
          elementId,
          ...additionalData,
        },
      });
      
      // Detect rage taps for buttons
      if (element.toLowerCase() === 'button' && x !== undefined && y !== undefined) {
        detectRageTap(semanticId || elementId || element, x, y);
      }
    }
  }, [trackEvent, detectRageTap]);

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
    });
  }, [trackEvent]);

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
      });
    }
    lastScrollPosition.current = scrollPosition;
  }, [trackEvent]);

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
      flowId
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
        flowId: flow.flowId
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
        flowId: flow.flowId
      });
      activeFlows.current.delete(flowName);
    }
  }, [trackEvent]);

  // Screen tracking functions
  const trackScreenView = useCallback((screenName: string, metadata?: Record<string, any>) => {
    if (currentScreen.current) {
      // Track exit from previous screen
      trackEvent({
        eventType: 'screen_exit',
        eventCategory: 'navigation',
        eventData: {
          from_screen: currentScreen.current,
          to_screen: screenName,
          time_on_screen: Date.now() - screenStartTime.current,
          ...metadata
        },
        screenName: currentScreen.current
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
      screenName
    });
  }, [trackEvent]);

  // Track custom events
  const trackCustom = useCallback((eventType: string, eventData?: Record<string, any>) => {
    trackEvent({
      eventType,
      eventCategory: 'custom',
      eventData,
    });
  }, [trackEvent]);

  // Auto-track page views and reset scroll milestones
  useEffect(() => {
    pageStartTime.current = Date.now();
    scrollMilestonesReached.current.clear(); // Reset milestones on page change
    
    trackEvent({
      eventType: 'page_view',
      eventCategory: 'navigation',
      eventData: {
        referrer: document.referrer,
      },
    });

    // Track page duration on unmount
    return () => {
      trackPageDuration();
    };
  }, [location.pathname, trackEvent, trackPageDuration]);

  // Auto-track clicks with semantic IDs and coordinates
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const elementType = target.tagName.toLowerCase();
      const elementId = target.id;
      const analyticsId = target.getAttribute('data-analytics-id');
      const elementText = target.textContent?.substring(0, 50) || '';

      trackClick(elementType, elementId, {
        'data-analytics-id': analyticsId,
        text: elementText,
      }, e.clientX, e.clientY);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [trackClick]);

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
        trackEvent({
          eventType: 'session_timeout',
          eventCategory: 'engagement',
          eventData: {
            inactive_duration_ms: inactiveTime,
            total_session_time: Date.now() - sessionStartTime,
          },
        });
      }
    }, 30000); // Check every 30 seconds

    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => document.addEventListener(event, updateActivity, { passive: true }));

    // Track session end on page unload
    const handleBeforeUnload = () => {
      const sessionDuration = Date.now() - sessionStartTime;
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/analytics_events`,
        JSON.stringify({
          user_id: sessionId.current,
          session_id: sessionId.current,
          event_type: 'session_end',
          event_category: 'navigation',
          event_data: {
            exit_route: location.pathname,
            exit_screen: currentScreen.current,
            session_duration_ms: sessionDuration,
            session_duration_seconds: Math.round(sessionDuration / 1000),
            reason: 'user_exit'
          },
          page_route: location.pathname,
          screen_name: currentScreen.current,
          viewport_width: window.innerWidth,
          viewport_height: window.innerHeight,
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
          trackEvent({
            eventType: 'session_end',
            eventCategory: 'navigation',
            eventData: {
              reason: 'long_inactivity',
              inactive_duration_ms: hiddenDuration,
              session_duration_ms: Date.now() - sessionStartTime
            }
          });
          // Generate new session
          sessionStartTime = Date.now();
          sessionId.current = getSessionId();
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
