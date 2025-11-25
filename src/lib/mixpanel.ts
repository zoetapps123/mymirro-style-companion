export function trackEvent(name: string, props: Record<string, any> = {}) {
  if (typeof window === "undefined") return;

  const host = window.location.hostname;
  if (host !== "mymirro.in" && host !== "www.mymirro.in") return;

  if (!window.mixpanel || !window.mixpanel.track) return;

  window.mixpanel.track(name, {
    ...props,
    url: window.location.href,
    timestamp: Date.now()
  });
}

export function trackPageView(
  screen_name: string, 
  virtual_path: string,
  metadata?: Record<string, any>
) {
  trackEvent("page_viewed", {
    screen_name,
    virtual_path,
    path: window.location.pathname,
    ...metadata
  });
}

export function identifyUser(user: any) {
  if (typeof window === "undefined") return;

  const host = window.location.hostname;
  if (host !== "mymirro.in" && host !== "www.mymirro.in") return;

  if (!window.mixpanel) return;

  window.mixpanel.identify(user.id);
  window.mixpanel.people.set({
    email: user.email || "",
    phone: user.phone || user.user_metadata?.phone || "",
    created_at: user.created_at || null,
    name: user.user_metadata?.name || localStorage.getItem("onboard_name") || "",
    gender: user.user_metadata?.gender || localStorage.getItem("onboard_gender") || "",
    age_range: user.user_metadata?.age_range || localStorage.getItem("onboard_age_range") || "",
  });
}
