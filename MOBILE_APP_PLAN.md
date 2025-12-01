# Mobile App Conversion Plan

## Option 1: Capacitor (Recommended) ⭐

### Pros
- ✅ Reuse 100% of existing code
- ✅ Quick setup (2-3 days)
- ✅ Access to native APIs
- ✅ Single codebase for web + mobile
- ✅ Easy updates (just rebuild web)
- ✅ Good performance

### Cons
- ❌ Slightly larger app size than pure native
- ❌ Some advanced native features harder to implement

### Setup Steps

#### 1. Install Dependencies
```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
npm install @capacitor/camera @capacitor/preferences @capacitor/share
npm install @capacitor/status-bar @capacitor/splash-screen
```

#### 2. Initialize Capacitor
```bash
npx cap init
# App name: MyMirro
# Package ID: com.mymirro.app
# Web dir: dist
```

#### 3. Update vite.config.ts
```typescript
export default defineConfig({
  base: './', // Important for Capacitor
  // ... rest of config
});
```

#### 4. Add Platforms
```bash
# Build web app first
npm run build

# Add platforms
npx cap add android
npx cap add ios

# Sync web code to native
npx cap sync
```

#### 5. Configure Native Projects

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
```

**iOS** (`ios/App/App/Info.plist`):
```xml
<key>NSCameraUsageDescription</key>
<string>To take photos of your outfits</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>To save outfit photos</string>
```

#### 6. Open in Native IDEs
```bash
# Android (requires Android Studio)
npx cap open android

# iOS (requires Xcode, Mac only)
npx cap open ios
```

#### 7. Build & Test
- **Android**: Click "Run" in Android Studio
- **iOS**: Click "Run" in Xcode

#### 8. Update Workflow
```bash
# After making changes
npm run build
npx cap sync
# Then rebuild in Android Studio/Xcode
```

### Code Changes Needed

#### Update Camera Integration
```typescript
import { Camera } from '@capacitor/camera';

const takePhoto = async () => {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri
  });
  return image.webPath;
};
```

#### Update Storage
```typescript
import { Preferences } from '@capacitor/preferences';

await Preferences.set({ key: 'user', value: JSON.stringify(user) });
const { value } = await Preferences.get({ key: 'user' });
```

#### Add Status Bar Styling
```typescript
import { StatusBar, Style } from '@capacitor/status-bar';

StatusBar.setStyle({ style: Style.Dark });
StatusBar.setBackgroundColor({ color: '#000000' });
```

### Estimated Timeline
- Day 1: Setup & configuration (4-6 hours)
- Day 2: Native features integration (4-6 hours)
- Day 3: Testing & fixes (4-6 hours)
- Day 4-5: App store submission prep (4-8 hours)

### Cost Breakdown
- Development: Free (DIY)
- Apple Developer: $99/year
- Google Play: $25 one-time
- **Total Year 1**: $124

---

## Option 2: React Native (Rewrite)

### Pros
- ✅ True native performance
- ✅ Large ecosystem
- ✅ Better for complex animations

### Cons
- ❌ Complete rewrite needed
- ❌ 2-3 weeks development time
- ❌ Separate codebase from web
- ❌ More maintenance

### Estimated Timeline
- Week 1-2: Core features
- Week 3: Polish & testing
- Week 4: App store submission

### Cost
- Development: 2-3 weeks
- App stores: $124/year

---

## Option 3: Keep PWA Only

### Pros
- ✅ Already done!
- ✅ Zero additional cost
- ✅ Instant updates
- ✅ No app store approval needed
- ✅ Works on all platforms

### Cons
- ❌ Not in app stores
- ❌ Limited native features
- ❌ iOS limitations (no push notifications)

### When to Choose This
- MVP/testing phase
- Limited budget
- Rapid iteration needed
- Web-first audience

---

## Recommendation

### Start with PWA (Current) ✅
- Already implemented
- Test market fit
- Gather user feedback
- Zero cost

### Add Capacitor When:
- Users request app store presence
- Need native features (camera, etc.)
- Have budget for app stores
- Ready for 2-3 days development

### Consider React Native When:
- Need maximum performance
- Complex native integrations
- Separate mobile team
- Long-term mobile focus

---

## Quick Decision Matrix

**Choose PWA if:**
- Just launched
- Testing market
- Limited budget
- Web-first product

**Choose Capacitor if:**
- Need app stores
- Want native features
- Keep existing code
- Quick to market

**Choose React Native if:**
- Mobile-first product
- Complex native needs
- Have mobile expertise
- Long-term investment

---

## Next Steps

1. **Immediate**: Keep PWA, monitor metrics
2. **Month 1-2**: Gather user feedback
3. **Month 3**: Decide on Capacitor if needed
4. **Month 4+**: Implement & launch native apps

---

## Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Capacitor + Vite](https://capacitorjs.com/docs/guides/vite)
- [React Native](https://reactnative.dev/)
- [PWA vs Native](https://web.dev/pwa-vs-native/)
