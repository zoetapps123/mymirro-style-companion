// Centralized screen names and virtual paths for Mixpanel tracking

export const SCREEN_NAMES = {
  // Authentication
  AUTH_LOGIN: 'auth_login',
  AUTH_OTP: 'auth_otp',
  
  // Onboarding
  ONBOARDING: 'onboarding',
  
  // Main Navigation
  HOME: 'home',
  CHAT: 'chat',
  WARDROBE: 'wardrobe',
  STYLE_CHECK: 'stylecheck',
  PROFILE: 'profile',
  
  // Wardrobe Sub-views
  WARDROBE_GALLERY: 'wardrobe_gallery',
  WARDROBE_UPLOAD: 'wardrobe_upload',
  WARDROBE_OUTFITS: 'wardrobe_outfits',
  WARDROBE_LOOKBOOK: 'wardrobe_lookbook',
  WARDROBE_CALENDAR: 'wardrobe_calendar',
  
  // Style Check Sub-views
  STYLECHECK_HUB: 'stylecheck_hub',
  STYLECHECK_CHECK: 'stylecheck_check',
  STYLECHECK_ANALYZING: 'stylecheck_analyzing',
  STYLECHECK_BATTLE: 'stylecheck_battle',
} as const;

export const SCREEN_PATHS = {
  // Authentication
  AUTH_LOGIN: '/auth/login',
  AUTH_OTP: '/auth/otp',
  
  // Onboarding
  ONBOARDING: '/onboarding',
  
  // Main Navigation
  HOME: '/app/home',
  CHAT: '/app/chat',
  WARDROBE: '/app/wardrobe',
  STYLE_CHECK: '/app/stylecheck',
  PROFILE: '/app/profile',
  
  // Wardrobe Sub-views
  WARDROBE_GALLERY: '/wardrobe/gallery',
  WARDROBE_UPLOAD: '/wardrobe/add-item',
  WARDROBE_OUTFITS: '/wardrobe/generated-outfits',
  WARDROBE_LOOKBOOK: '/wardrobe/lookbook',
  WARDROBE_CALENDAR: '/wardrobe/calendar',
  
  // Style Check Sub-views
  STYLECHECK_HUB: '/stylecheck',
  STYLECHECK_CHECK: '/stylecheck/check',
  STYLECHECK_ANALYZING: '/stylecheck/analyzing',
  STYLECHECK_BATTLE: '/stylecheck/battle',
} as const;

export type ScreenKey = keyof typeof SCREEN_NAMES;

export function getScreenInfo(screenKey: ScreenKey) {
  return {
    screen_name: SCREEN_NAMES[screenKey],
    virtual_path: SCREEN_PATHS[screenKey],
  };
}
