// Helper to check if Mixpanel SDK is fully loaded (not just the stub)
function isMixpanelReady(): boolean {
  return !!(
    window.mixpanel && 
    window.mixpanel.track && 
    window.mixpanel.identify &&
    window.mixpanel.people &&
    window.mixpanel.people.set &&
    typeof window.mixpanel.track === 'function' &&
    window.__mixpanel_initialized__
  );
}

export function trackEvent(name: string, props: Record<string, any> = {}) {
  if (typeof window === "undefined") {
    console.log('[Mixpanel] Window undefined');
    return;
  }

  const host = window.location.hostname;
  console.log('[Mixpanel] Host:', host);
  
  const allowedHosts = ["mymirro.in", "www.mymirro.in"];
  if (!allowedHosts.includes(host)) {
    console.log('[Mixpanel] Not on allowed domain, skipping');
    return;
  }

  if (!isMixpanelReady()) {
    console.error('[Mixpanel] SDK not ready');
    return;
  }

  const eventData = {
    ...props,
    url: window.location.href,
    timestamp: Date.now()
  };
  
  console.log('[Mixpanel] Tracking event:', name, eventData);
  window.mixpanel.track(name, eventData);
}

export function trackPageView(
  screen_name: string, 
  virtual_path: string,
  metadata?: Record<string, any>
) {
  console.log('[Mixpanel] trackPageView called:', { screen_name, virtual_path, metadata });
  trackEvent("page_viewed", {
    screen_name,
    virtual_path,
    path: window.location.pathname,
    ...metadata
  });
}

export function identifyUser(user: any) {
  if (typeof window === "undefined") {
    console.log('[Mixpanel] Window undefined (identify)');
    return;
  }

  const host = window.location.hostname;
  const allowedHosts = ["mymirro.in", "www.mymirro.in"];
  if (!allowedHosts.includes(host)) {
    console.log('[Mixpanel] Not on allowed domain, skipping identify');
    return;
  }

  if (!isMixpanelReady()) {
    console.error('[Mixpanel] SDK not ready for identify');
    // Retry after SDK loads
    setTimeout(() => {
      if (isMixpanelReady()) {
        identifyUser(user);
      }
    }, 500);
    return;
  }

  const userData = {
    $email: user.email || "",
    $phone: user.phone || user.user_metadata?.phone || localStorage.getItem("user_phone") || "",
    $created: user.created_at || null,
    $name: user.user_metadata?.name || localStorage.getItem("onboard_name") || "",
    gender: user.user_metadata?.gender || localStorage.getItem("onboard_gender") || "",
    age_range: user.user_metadata?.age_range || localStorage.getItem("onboard_age_range") || "",
  };

  console.log('[Mixpanel] Identifying user:', user.id, userData);
  
  try {
    // First identify the user
    window.mixpanel.identify(user.id);
    
    // Then set profile properties - remove empty values
    const cleanUserData = Object.fromEntries(
      Object.entries(userData).filter(([_, v]) => v !== "" && v !== null)
    );
    
    console.log('[Mixpanel] Setting user properties:', cleanUserData);
    window.mixpanel.people.set(cleanUserData);
    
    console.log('[Mixpanel] User identified and properties set successfully');
  } catch (error) {
    console.error('[Mixpanel] Error identifying user:', error);
  }
}

export function setUserProperties(props: Record<string, any>) {
  if (typeof window === "undefined") {
    console.log('[Mixpanel] Window undefined (setUserProperties)');
    return;
  }

  const host = window.location.hostname;
  const allowedHosts = ["mymirro.in", "www.mymirro.in", "mymirro-style-companion.lovable.app"];
  if (!allowedHosts.includes(host)) {
    console.log('[Mixpanel] Not on production domain, skipping setUserProperties');
    return;
  }

  if (!isMixpanelReady()) {
    console.error('[Mixpanel] SDK not ready for setUserProperties');
    return;
  }

  try {
    // Remove empty values
    const cleanProps = Object.fromEntries(
      Object.entries(props).filter(([_, v]) => v !== "" && v !== null && v !== undefined)
    );
    
    console.log('[Mixpanel] Setting user properties:', cleanProps);
    window.mixpanel.people.set(cleanProps);
  } catch (error) {
    console.error('[Mixpanel] Error setting user properties:', error);
  }
}
