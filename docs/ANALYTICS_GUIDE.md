# Analytics Tracking Guide

## Overview
This guide explains how to use the analytics system in the application to track user behavior accurately and consistently.

## Field Definitions

| Field | Purpose | Always Set? | Example | Description |
|-------|---------|-------------|---------|-------------|
| `user_id` | Who | ✅ Yes (auto) | `uuid` | Unique user identifier |
| `session_id` | Which session | ✅ Yes (auto) | `session_123_abc` | Session identifier |
| `screen_name` | Which screen | ✅ Yes (auto) | `wardrobe-items` | Standardized screen name |
| `screen_category` | Screen group | ✅ Yes (auto) | `wardrobe` | High-level category |
| `virtual_path` | Where in app | ✅ Yes (auto) | `/app/wardrobe/items` | Virtual navigation path |
| `user_action` | What they did | ✅ Yes (computed) | `click`, `view_wardrobe` | Action performed |
| `event_source` | What triggered it | ⚠️ Optional | `user_action:button_click` | Event trigger source |
| `duration_seconds` | How long | ⚠️ When applicable | `45` | Duration of action |
| `event_data` | Extra details | ⚠️ Optional | `{ outfit_id: 123 }` | Additional context |
| `page_route` | Browser path | ✅ Yes (auto) | `/` | Actual browser route |

## Standard Screen Names

### Home & Navigation
- **Home**: `home`
- **Chat/AI Companion**: `chat`
- **Profile**: `profile`

### Style Check Section
- **Style Check Hub**: `stylecheck-hub`
- **Outfit Check**: `stylecheck-check`
- **Outfit Battle**: `stylecheck-battle`

### Wardrobe Section
- **Wardrobe Hub**: `wardrobe-hub`
- **My Items**: `wardrobe-items`
- **Outfit Suggestions**: `wardrobe-outfits`
- **Lookbook**: `wardrobe-lookbook`
- **Calendar** (future): `wardrobe-calendar`

## Standard Event Sources

Event sources follow the pattern: `<type>:<specific_action>`

### User Actions
Format: `user_action:<action>`

Examples:
- `user_action:button_click` - User clicked a button
- `user_action:send_message` - User sent a message
- `user_action:upload_start` - User started an upload
- `user_action:save_outfit` - User saved an outfit
- `user_action:delete_item` - User deleted an item
- `user_action:generate_outfit` - User generated an outfit
- `user_action:complete_style_check` - User completed style check

### System Events
Format: `system:<event>`

Examples:
- `system:session_timeout` - Session timed out
- `system:auto_save` - System auto-saved
- `system:processing_complete` - Background processing finished
- `system:error` - System error occurred

### Navigation
Format: `navigation:<from>_to_<to>`

Examples:
- `navigation:home_to_wardrobe` - Navigated from home to wardrobe
- `navigation:tab_change` - Changed tabs
- `navigation:app_start` - App started

### Component Events
Format: `component:<name>`

Examples:
- `component:chat_input` - Chat input component
- `component:outfit_card` - Outfit card component

## When to Use What

### 1. `trackScreenView()` - Navigation Events
Use when user navigates to a new screen/view.

```typescript
trackScreenView(
  'wardrobe-items',              // screen_name (standardized)
  { tab: 'wardrobe' },           // metadata (optional)
  '/app/wardrobe/items'          // virtual_path
);
```

**Auto-populated fields:**
- `screen_category` - Derived from `screen_name`
- `user_action` - Set to screen name
- `event_type` - Set to `'screen_view'`

### 2. `trackCustom()` - User Actions
Use for clicks, submissions, completions, and other user-initiated events.

```typescript
trackCustom(
  'outfit_saved',                // event_type
  {                              // event_data
    outfit_id: id,
    outfit_name: name,
    duration_seconds: timeSpent  // Always include when applicable
  },
  'user_action:save_outfit'      // event_source
);
```

**Always include `duration_seconds` when tracking:**
- Upload processes
- Form completions
- Style checks
- Outfit generation
- Any timed activity

### 3. `trackClick()` - Generic Clicks
Use only for buttons/elements without semantic meaning or IDs.

```typescript
trackClick('Save Button', 'save-btn');
```

**Note:** Prefer `trackCustom()` with specific event types over generic clicks.

## Best Practices

### ✅ DO:
1. **Always include `duration_seconds` for timed actions**
   ```typescript
   const startTime = Date.now();
   // ... user does something ...
   const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
   
   trackCustom('style_check_completed', {
     overall_score: score,
     duration_seconds: durationSeconds  // ✅ Always include
   }, 'user_action:complete_style_check');
   ```

2. **Use standardized screen names**
   ```typescript
   // ✅ GOOD
   trackScreenView('wardrobe-items', {}, '/app/wardrobe/items');
   
   // ❌ BAD
   trackScreenView('wardrobe', {}, '/wardrobe');
   trackScreenView('items', {}, '/items');
   ```

3. **Use descriptive event_source values**
   ```typescript
   // ✅ GOOD
   trackCustom('outfit_saved', data, 'user_action:save_outfit');
   
   // ❌ BAD
   trackCustom('outfit_saved', data, 'button_click');
   trackCustom('outfit_saved', data, 'save');
   ```

4. **Include relevant context in event_data**
   ```typescript
   trackCustom('wardrobe_item_deleted', {
     item_id: itemId,
     item_name: itemName,
     category: item.category  // ✅ Include relevant context
   }, 'user_action:delete_item');
   ```

### ❌ DON'T:
1. **Don't use inconsistent screen names**
   ```typescript
   // ❌ BAD - Mixing naming conventions
   trackScreenView('stylecheck', ...);
   trackScreenView('StyleCheck', ...);
   trackScreenView('style-check', ...);
   ```

2. **Don't forget duration for timed events**
   ```typescript
   // ❌ BAD - Missing duration
   trackCustom('upload_complete', { file_count: 5 });
   
   // ✅ GOOD
   trackCustom('upload_complete', { 
     file_count: 5,
     duration_seconds: uploadDuration 
   });
   ```

3. **Don't use vague event_source values**
   ```typescript
   // ❌ BAD
   trackCustom('message_sent', data, 'click');
   trackCustom('message_sent', data, '/');
   
   // ✅ GOOD
   trackCustom('message_sent', data, 'user_action:send_message');
   ```

## Code Examples

### Example 1: Screen Navigation with Duration
```typescript
const Profile = () => {
  const { trackScreenView } = useAnalytics();
  const [screenStartTime] = useState(Date.now());
  
  useEffect(() => {
    trackScreenView('profile', { context: 'user_profile' }, '/app/profile');
    
    return () => {
      const durationSeconds = Math.floor((Date.now() - screenStartTime) / 1000);
      trackCustom('screen_exit', {
        screen_name: 'profile',
        duration_seconds: durationSeconds
      }, 'system:screen_exit');
    };
  }, [trackScreenView]);
  
  // ... rest of component
};
```

### Example 2: Upload with Progress Tracking
```typescript
const handleUpload = async (files: FileList) => {
  const startTime = Date.now();
  
  trackCustom('upload_started', {
    file_count: files.length,
    total_size: Array.from(files).reduce((sum, f) => sum + f.size, 0)
  }, 'user_action:upload_start');
  
  try {
    // ... upload logic ...
    
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    trackCustom('upload_completed', {
      file_count: files.length,
      success: true,
      duration_seconds: durationSeconds
    }, 'system:processing_complete');
  } catch (error) {
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    trackCustom('upload_failed', {
      error: error.message,
      duration_seconds: durationSeconds
    }, 'system:error');
  }
};
```

### Example 3: Chat Message with Context
```typescript
const sendMessage = async (message: string, images: string[]) => {
  const chatDuration = Math.floor((Date.now() - chatStartTime) / 1000);
  
  trackCustom('chat_message_sent', {
    message_number: messageCount,
    has_images: images.length > 0,
    image_count: images.length,
    message_length: message.length,
    duration_seconds: chatDuration
  }, 'user_action:send_message');
  
  // ... send message logic ...
};
```

## Analysis Queries

### Query 1: User Journey
```sql
SELECT 
  user_id,
  session_id,
  screen_name,
  screen_category,
  user_action,
  duration_seconds,
  created_at
FROM v_user_journey_detailed
WHERE user_id = 'your-user-id'
ORDER BY created_at;
```

### Query 2: Screen Time Analysis
```sql
SELECT 
  screen_name,
  screen_category,
  unique_users,
  avg_duration_seconds,
  median_duration_seconds,
  total_time_seconds
FROM v_screen_time_analysis
ORDER BY total_time_seconds DESC;
```

### Query 3: User Action Frequency
```sql
SELECT 
  user_action,
  screen_category,
  event_source,
  event_count,
  unique_users,
  avg_duration_seconds
FROM v_user_action_frequency
ORDER BY event_count DESC
LIMIT 20;
```

## Troubleshooting

### Problem: `screen_name` is null
**Solution:** Ensure `trackScreenView()` is called in `useEffect` on component mount.

### Problem: `duration_seconds` is null
**Solution:** Always calculate and include `duration_seconds` in `event_data` for timed events.

### Problem: Inconsistent `event_source` values
**Solution:** Use the standard patterns: `user_action:`, `system:`, `navigation:`, `component:`

### Problem: `virtual_path` is always "/"
**Solution:** The hook now auto-populates `virtual_path` from `screen_name`. Ensure `screen_name` is set.

## Migration Notes

If you're updating existing tracking code:

1. **Screen names**: Update to standardized names (see "Standard Screen Names" section)
2. **Event sources**: Replace `engagement_source` with `event_source` using new patterns
3. **Duration**: Extract `duration_seconds` to top-level column (auto-extracted from `event_data`)
4. **Category**: `screen_category` is now auto-populated from `screen_name`

## Support

For questions or issues with analytics tracking, refer to:
- `src/hooks/useAnalytics.ts` - Main analytics hook
- `src/hooks/useAnalyticsContext.tsx` - Context provider (optional)
- Database views: `v_user_journey_detailed`, `v_screen_time_analysis`, `v_user_action_frequency`
