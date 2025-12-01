# Progressive Web App (PWA) Guide

## Overview

MyMirro is now a fully-featured Progressive Web App that can be installed on mobile devices and desktops, providing an app-like experience with offline capabilities.

## Features

### ✅ Installable
- Add to home screen on iOS and Android
- Standalone app experience
- Custom splash screen
- App icon on device

### ✅ Offline Support
- Works without internet connection
- Cached assets for instant loading
- Smart caching strategies for images and API calls
- Offline fallback UI

### ✅ Auto-Updates
- Automatic service worker updates
- User-friendly update prompts
- Background sync when online

### ✅ Performance
- Fast loading with cached resources
- Optimized image caching
- Font caching for instant text rendering
- API response caching

## Installation Instructions

### iOS (iPhone/iPad)
1. Open MyMirro in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" in the top right
5. The app icon will appear on your home screen

### Android
1. Open MyMirro in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home Screen" or "Install App"
4. Confirm by tapping "Add" or "Install"
5. The app icon will appear on your home screen

### Desktop (Chrome/Edge)
1. Open MyMirro in Chrome or Edge
2. Look for the install icon in the address bar
3. Click "Install" in the prompt
4. The app will open in its own window

## Caching Strategy

### Static Assets
- **Strategy**: Cache First
- **Includes**: JS, CSS, HTML, images, fonts
- **Benefit**: Instant loading, works offline

### Google Fonts
- **Strategy**: Cache First
- **Duration**: 1 year
- **Benefit**: Fast text rendering

### Supabase Images
- **Strategy**: Network First
- **Duration**: 7 days
- **Benefit**: Fresh content with offline fallback

### Supabase API
- **Strategy**: Network First
- **Duration**: 5 minutes
- **Benefit**: Real-time data with quick fallback

## Update Mechanism

The app uses a **prompt-based update strategy**:

1. Service worker checks for updates in the background
2. When a new version is available, a notification appears
3. User can choose to update immediately or later
4. Update applies on next page load or manual refresh

## Offline Capabilities

When offline, the app:
- Shows an offline indicator
- Serves cached pages and assets
- Displays cached images
- Shows a friendly offline message
- Automatically reconnects when online

## Technical Details

### Manifest Configuration
```json
{
  "name": "MyMirro - Your AI Stylist",
  "short_name": "MyMirro",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#000000",
  "background_color": "#000000"
}
```

### Service Worker
- Built with Workbox
- Automatic cleanup of old caches
- Skip waiting for instant updates
- Client claim for immediate control

### Browser Support
- ✅ Chrome/Edge (Android & Desktop)
- ✅ Safari (iOS 11.3+)
- ✅ Firefox (Android & Desktop)
- ✅ Samsung Internet

## Development

### Testing PWA Features

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Lighthouse Audit
Run a Lighthouse audit in Chrome DevTools to check PWA score:
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Progressive Web App"
4. Click "Generate report"

### Service Worker Debugging
1. Open Chrome DevTools
2. Go to Application tab
3. Click "Service Workers" in the sidebar
4. View registration status and cache storage

## Best Practices

### For Users
- Install the app for the best experience
- Keep the app updated when prompted
- Allow notifications for important updates

### For Developers
- Test offline functionality regularly
- Monitor cache sizes
- Update service worker when changing caching strategies
- Test on real devices, not just emulators

## Troubleshooting

### App Not Installing
- Ensure you're using HTTPS
- Check browser compatibility
- Clear browser cache and try again

### Updates Not Showing
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear service worker in DevTools
- Unregister and re-register service worker

### Offline Mode Issues
- Check cache storage in DevTools
- Verify network requests in Network tab
- Ensure service worker is active

## Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Workbox Guide](https://developers.google.com/web/tools/workbox)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
