import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';

// In-memory fallback for iOS Private Mode
let memorySessionId: string | null = null;

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
}

export const useAnalytics = () => {
  const location = useLocation();
  const sessionId = useRef(getSessionId());
  const pageStartTime = useRef<number>(Date.now());
  const lastScrollPosition = useRef<number>(0);
  const scrollDebounceTimer = useRef<NodeJS.Timeout>();

  // Track an event - never throw errors
  const trackEvent = useCallback(async ({ eventType, eventCategory, eventData }: AnalyticsEvent) => {
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
      });
    } catch (error) {
      // Silently fail - analytics should never break the app
      if (process.env.NODE_ENV === 'development') {
        console.warn('Analytics tracking error:', error);
      }
    }
  }, [location.pathname]);

  // Track click events with semantic IDs
  const trackClick = useCallback((element: string, elementId?: string, additionalData?: Record<string, any>) => {
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
    }
  }, [trackEvent]);

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

  // Auto-track clicks with semantic IDs
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
      });
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

  // Track session timeout (5+ minutes inactive)
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
            total_session_time: Date.now() - pageStartTime.current,
          },
        });
      }
    }, 30000); // Check every 30 seconds

    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => document.addEventListener(event, updateActivity, { passive: true }));

    return () => {
      clearInterval(checkInactivity);
      activityEvents.forEach(event => document.removeEventListener(event, updateActivity));
    };
  }, [trackEvent]);

  return {
    trackEvent,
    trackClick,
    trackScroll,
    trackCustom,
    trackPageDuration,
  };
};
