/**
 * Device, browser, and OS detection utilities for analytics
 */

export interface DeviceInfo {
  device_type: 'mobile' | 'tablet' | 'desktop' | 'other';
  os_name: string;
  browser_name: string;
  viewport_width: number;
  viewport_height: number;
}

export interface UTMParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
}

/**
 * Detect device type, OS, and browser from user agent
 */
export function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;
  
  // Device type detection
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  let device_type: 'mobile' | 'tablet' | 'desktop' | 'other' = 'desktop';
  
  if (isTablet) {
    device_type = 'tablet';
  } else if (isMobile) {
    device_type = 'mobile';
  } else if (/Windows|Macintosh|Linux/i.test(ua)) {
    device_type = 'desktop';
  } else {
    device_type = 'other';
  }
  
  // OS detection
  let os_name = 'unknown';
  if (/Windows NT 10/i.test(ua)) os_name = 'Windows 10';
  else if (/Windows NT 11/i.test(ua)) os_name = 'Windows 11';
  else if (/Windows/i.test(ua)) os_name = 'Windows';
  else if (/Mac OS X (\d+)[._](\d+)/i.test(ua)) {
    const match = ua.match(/Mac OS X (\d+)[._](\d+)/i);
    os_name = match ? `macOS ${match[1]}.${match[2]}` : 'macOS';
  }
  else if (/iPhone OS (\d+)[._](\d+)/i.test(ua)) {
    const match = ua.match(/iPhone OS (\d+)[._](\d+)/i);
    os_name = match ? `iOS ${match[1]}.${match[2]}` : 'iOS';
  }
  else if (/iPad.*OS (\d+)[._](\d+)/i.test(ua)) {
    const match = ua.match(/iPad.*OS (\d+)[._](\d+)/i);
    os_name = match ? `iPadOS ${match[1]}.${match[2]}` : 'iPadOS';
  }
  else if (/Android (\d+)/i.test(ua)) {
    const match = ua.match(/Android (\d+)/i);
    os_name = match ? `Android ${match[1]}` : 'Android';
  }
  else if (/Linux/i.test(ua)) os_name = 'Linux';
  else if (/CrOS/i.test(ua)) os_name = 'Chrome OS';
  
  // Browser detection
  let browser_name = 'unknown';
  if (/Edg\//i.test(ua)) browser_name = 'Edge';
  else if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser_name = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser_name = 'Safari';
  else if (/Firefox/i.test(ua)) browser_name = 'Firefox';
  else if (/MSIE|Trident/i.test(ua)) browser_name = 'Internet Explorer';
  else if (/Opera|OPR/i.test(ua)) browser_name = 'Opera';
  
  // Viewport dimensions
  const viewport_width = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewport_height = window.innerHeight || document.documentElement.clientHeight || 0;
  
  return {
    device_type,
    os_name,
    browser_name,
    viewport_width,
    viewport_height
  };
}

/**
 * Extract UTM parameters from URL
 */
export function getUTMParams(): UTMParams {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || ''
  };
}

/**
 * Get referrer URL
 */
export function getReferrer(): string {
  return document.referrer || '';
}

/**
 * Determine if this is an entry point (first page of session)
 */
export function isEntryPoint(): boolean {
  return !document.referrer || !document.referrer.includes(window.location.hostname);
}
