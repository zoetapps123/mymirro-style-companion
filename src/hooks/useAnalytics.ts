import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';

// Generate a session ID that persists during the browser session
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
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

  // Track an event
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
      console.error('Analytics tracking error:', error);
    }
  }, [location.pathname]);

  // Track click events
  const trackClick = useCallback((element: string, elementId?: string, additionalData?: Record<string, any>) => {
    trackEvent({
      eventType: 'click',
      eventCategory: 'interaction',
      eventData: {
        element,
        elementId,
        ...additionalData,
      },
    });
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

  // Track scroll events
  const trackScroll = useCallback((scrollPosition: number, scrollPercentage: number) => {
    trackEvent({
      eventType: 'scroll',
      eventCategory: 'interaction',
      eventData: {
        scroll_position: scrollPosition,
        scroll_percentage: Math.round(scrollPercentage),
        scroll_direction: scrollPosition > lastScrollPosition.current ? 'down' : 'up',
      },
    });
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

  // Auto-track page views
  useEffect(() => {
    pageStartTime.current = Date.now();
    
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

  // Auto-track clicks on the entire document
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const elementType = target.tagName.toLowerCase();
      const elementId = target.id;
      const elementClass = target.className;
      const elementText = target.textContent?.substring(0, 50) || '';

      trackClick(elementType, elementId, {
        class: elementClass,
        text: elementText,
        x: e.clientX,
        y: e.clientY,
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

  // Track visibility changes (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      trackEvent({
        eventType: document.hidden ? 'tab_hidden' : 'tab_visible',
        eventCategory: 'engagement',
        eventData: {
          time_on_page: Date.now() - pageStartTime.current,
        },
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [trackEvent]);

  return {
    trackEvent,
    trackClick,
    trackScroll,
    trackCustom,
    trackPageDuration,
  };
};
