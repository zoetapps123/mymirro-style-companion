/**
 * Virtual page routes for Wardrobe subsections
 * Used for analytics tracking of state-based navigation
 */

export const WARDROBE_ROUTES = {
  HUB: '/wardrobe',
  GALLERY: '/wardrobe/gallery',              // WardrobeMyItems - main gallery view
  DETAIL: '/wardrobe/detail/:id',            // Item detail view with editing
  UPLOAD: '/wardrobe/add-item',              // Upload/add new item flow
  OUTFITS: '/wardrobe/generated-outfits',    // AI-generated outfit suggestions
  LOOKBOOK: '/wardrobe/lookbook',            // Saved outfits lookbook
  CALENDAR: '/wardrobe/calendar',            // Coming soon - plan looks
} as const;

export const WARDROBE_PAGE_TITLES = {
  [WARDROBE_ROUTES.HUB]: 'Wardrobe Hub',
  [WARDROBE_ROUTES.GALLERY]: 'My Items',
  [WARDROBE_ROUTES.DETAIL]: 'Item Detail',
  [WARDROBE_ROUTES.UPLOAD]: 'Add Item',
  [WARDROBE_ROUTES.OUTFITS]: 'Generated Outfits',
  [WARDROBE_ROUTES.LOOKBOOK]: 'Lookbook',
  [WARDROBE_ROUTES.CALENDAR]: 'Plan Looks',
} as const;

/**
 * Get page route with dynamic ID replaced
 */
export function getWardrobeRoute(route: string, id?: string): string {
  if (id && route.includes(':id')) {
    return route.replace(':id', id);
  }
  return route;
}
