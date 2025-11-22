/**
 * Comprehensive analytics event types and categories
 * Maps every user interaction to a specific event type
 */

export const ANALYTICS_EVENTS = {
  // Interaction / UI Events
  CLICK: 'click',
  BUTTON_CLICK: 'button_click',
  ICON_CLICK: 'icon_click',
  CTA_CLICK: 'cta_click',
  TOGGLE_CLICK: 'toggle_click',
  TAB_CHANGE: 'tab_change',
  SELECT_OPTION: 'select_option',
  RADIO_SELECT: 'radio_select',
  CHECKBOX_TOGGLE: 'checkbox_toggle',
  DROPDOWN_OPEN: 'dropdown_open',
  DROPDOWN_SELECT: 'dropdown_select',
  CARD_CLICK: 'card_click',
  IMAGE_CLICK: 'image_click',
  CHIP_CLICK: 'chip_click',
  MODAL_OPEN: 'modal_open',
  MODAL_CLOSE: 'modal_close',
  SCROLL: 'scroll',
  SCROLL_MILESTONE: 'scroll_milestone',
  INPUT_FOCUS: 'input_focus',
  INPUT_BLUR: 'input_blur',
  INPUT_SUBMIT: 'input_submit',

  // Wardrobe-Specific Events
  WARDROBE_OPENED: 'wardrobe_opened',
  WARDROBE_ITEM_CLICKED: 'wardrobe_item_clicked',
  WARDROBE_ITEM_VIEWED: 'wardrobe_item_viewed',
  WARDROBE_ITEM_EDITED: 'wardrobe_item_edited',
  WARDROBE_ITEM_DELETED: 'wardrobe_item_deleted',
  WARDROBE_ITEM_UPLOADED: 'wardrobe_item_uploaded',
  WARDROBE_ITEM_UPLOAD_FAILED: 'wardrobe_item_upload_failed',
  WARDROBE_ITEM_SHARED: 'wardrobe_item_shared',
  WARDROBE_FILTER_APPLIED: 'filter_applied',
  WARDROBE_SCROLL_GALLERY: 'scroll_gallery',
  WARDROBE_AI_RECOMMENDATION_CLICKED: 'wardrobe_ai_recommendation_clicked',
  
  // Wardrobe Upload Flow
  ADD_ITEM_CLICKED: 'add_item_clicked',
  ADD_ITEM_IMAGE_SELECTED: 'add_item_image_selected',
  ADD_ITEM_IMAGE_UPLOADED: 'add_item_image_uploaded',
  ADD_ITEM_CONFIRM: 'add_item_confirm',
  ADD_ITEM_FAILED: 'add_item_failed',
  
  // Wardrobe Outfit Generation
  WARDROBE_GENERATE_CLICKED: 'wardrobe_generate_clicked',
  WARDROBE_GENERATED_SUCCESS: 'wardrobe_generated_success',
  WARDROBE_GENERATED_FAILED: 'wardrobe_generated_failed',
  WARDROBE_SAVED_TO_LOOKBOOK: 'wardrobe_saved_to_lookbook',
  WARDROBE_SHARE_CLICKED: 'wardrobe_share_clicked',
  WARDROBE_REGENERATE_CLICKED: 'wardrobe_regenerate_clicked',

  // Style Check Events
  STYLE_CHECK_STARTED: 'style_check_started',
  STYLE_CHECK_IMAGE_UPLOADED: 'style_check_image_uploaded',
  STYLE_CHECK_UPLOAD_FAILED: 'style_check_upload_failed',
  STYLE_CHECK_RESULT_RECEIVED: 'style_check_result_received',
  STYLE_CHECK_RECOMMENDATION_CLICKED: 'style_check_recommendation_clicked',

  // Chat / AI Events
  CHAT_MESSAGE_SENT: 'chat_message_sent',
  CHAT_REPLY_DELIVERED: 'chat_reply_delivered',
  CHAT_ERROR: 'chat_error',
  CHAT_API_ERROR: 'chat_api_error',
  VOICE_INPUT_STARTED: 'voice_input_started',
  VOICE_INPUT_STOPPED: 'voice_input_stopped',

  // Outfit Battle Events
  OUTFIT_BATTLE_STARTED: 'outfit_battle_started',
  OUTFIT_BATTLE_COMPLETED: 'outfit_battle_completed',
  OUTFIT_BATTLE_LEFT_SWIPE: 'outfit_battle_left_swipe',
  OUTFIT_BATTLE_RIGHT_SWIPE: 'outfit_battle_right_swipe',
  OUTFIT_BATTLE_UP_SWIPE: 'outfit_battle_up_swipe',

  // Outfit Suggestion Events
  OUTFIT_GENERATION_OCCASION_SELECTED: 'outfit_generation_occasion_selected',
  OUTFIT_GENERATION_STYLE_SELECTED: 'outfit_generation_style_selected',
  OUTFIT_GENERATION_ANCHOR_SELECTED: 'outfit_generation_anchor_selected',
  OUTFIT_SAVED_TO_LOOKBOOK: 'outfit_saved_to_lookbook',
  OUTFIT_REGENERATE_ALL_CLICKED: 'outfit_regenerate_all_clicked',
  WARDROBE_FEATURE_NAVIGATION: 'wardrobe_feature_navigation',

  // Outfit Editor Events
  OUTFIT_ITEM_ADDED: 'outfit_item_added',
  OUTFIT_ITEM_REMOVED: 'outfit_item_removed',
  OUTFIT_IMAGE_REGENERATED: 'outfit_image_regenerated',
  OUTFIT_EDIT_STARTED: 'outfit_edit_started',
  OUTFIT_SAVE_DIALOG_OPENED: 'outfit_save_dialog_opened',

  // Navigation Events
  PAGE_NAVIGATION: 'page_navigation',
  BACK_NAVIGATION: 'back_navigation',
  FORWARD_NAVIGATION: 'forward_navigation',
  TAB_VISIBLE: 'tab_visible',
  TAB_HIDDEN: 'tab_hidden',
  PAGE_EXIT: 'page_exit',

  // System Events
  SESSION_STARTED: 'session_started',
  SESSION_RESTORED: 'session_restored',
  SESSION_TIMEOUT: 'session_timeout',
  SESSION_END: 'session_end',
  API_CALL_STARTED: 'api_call_started',
  API_CALL_SUCCESS: 'api_call_success',
  API_CALL_FAILED: 'api_call_failed',

  // Frustration Events
  RAGE_CLICK: 'rage_click',
  RAPID_SCROLL: 'rapid_scroll',
  ERROR_POPUP_SHOWN: 'error_popup_shown',
} as const;

export const EVENT_CATEGORIES = {
  INTERACTION: 'interaction',
  ENGAGEMENT: 'engagement',
  NAVIGATION: 'navigation',
  SYSTEM: 'system',
  ERROR: 'error',
  FRUSTRATION: 'frustration',
} as const;

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];
export type EventCategory = typeof EVENT_CATEGORIES[keyof typeof EVENT_CATEGORIES];
