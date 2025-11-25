export function trackEvent(name: string, props: Record<string, any> = {}) {
  if (typeof window === "undefined") {
    console.log('[Mixpanel] Window undefined');
    return;
  }

  const host = window.location.hostname;
  console.log('[Mixpanel] Host:', host);
  
  const allowedHosts = ["mymirro.in", "www.mymirro.in", "mymirro-style-companion.lovable.app"];
  if (!allowedHosts.includes(host)) {
    console.log('[Mixpanel] Not on allowed domain, skipping');
    return;
  }

  if (!window.mixpanel) {
    console.error('[Mixpanel] window.mixpanel not found');
    return;
  }
  
  if (!window.mixpanel.track) {
    console.error('[Mixpanel] window.mixpanel.track not found');
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
  const allowedHosts = ["mymirro.in", "www.mymirro.in", "mymirro-style-companion.lovable.app"];
  if (!allowedHosts.includes(host)) {
    console.log('[Mixpanel] Not on allowed domain, skipping identify');
    return;
  }

  if (!window.mixpanel) {
    console.error('[Mixpanel] window.mixpanel not found (identify)');
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
  window.mixpanel.identify(user.id);
  window.mixpanel.people.set(userData);
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

  if (!window.mixpanel || !window.mixpanel.people) {
    console.error('[Mixpanel] window.mixpanel.people not found');
    return;
  }

  console.log('[Mixpanel] Setting user properties:', props);
  window.mixpanel.people.set(props);
}
