# Capacitor Mobile App Guide

## ✅ Setup Complete!

Your app is now ready to build for **Android** and **iOS**!

### What's Been Done

1. ✅ Capacitor installed and configured
2. ✅ Android platform added
3. ✅ iOS platform added (requires Xcode to build)
4. ✅ Native plugins installed (Camera, Storage, Share, etc.)
5. ✅ App icons configured
6. ✅ Splash screen configured
7. ✅ Permissions configured
8. ✅ Native utility functions created

---

## 📱 Building for Android

### Prerequisites
- [Android Studio](https://developer.android.com/studio) installed
- Java JDK 17+ installed

### Steps

#### 1. Open Android Project
```bash
npx cap open android
```

This opens Android Studio with your project.

#### 2. Build APK (Testing)
In Android Studio:
1. Click **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for build to complete
3. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

#### 3. Install on Device
```bash
# Connect Android device via USB (enable USB debugging)
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### 4. Build for Play Store (Production)
In Android Studio:
1. Click **Build** → **Generate Signed Bundle / APK**
2. Select **Android App Bundle**
3. Create/select keystore
4. Build release bundle
5. Upload to Google Play Console

### Quick Build Commands
```bash
# After making changes to web code
npm run build
npx cap sync android

# Then open in Android Studio
npx cap open android
```

---

## 🍎 Building for iOS

### Prerequisites (Mac Only)
- macOS with Xcode installed
- Apple Developer Account ($99/year)
- CocoaPods installed: `sudo gem install cocoapods`

### Steps

#### 1. Install CocoaPods Dependencies
```bash
cd ios/App
pod install
cd ../..
```

#### 2. Open iOS Project
```bash
npx cap open ios
```

This opens Xcode with your project.

#### 3. Configure Signing
In Xcode:
1. Select **App** target
2. Go to **Signing & Capabilities**
3. Select your **Team**
4. Xcode auto-generates provisioning profile

#### 4. Build for Simulator (Testing)
1. Select simulator from device dropdown
2. Click **Run** (▶️) button
3. App launches in simulator

#### 5. Build for Device (Testing)
1. Connect iPhone via USB
2. Select your device from dropdown
3. Click **Run** (▶️)
4. Trust developer on device if prompted

#### 6. Build for App Store (Production)
1. Select **Any iOS Device** from dropdown
2. Click **Product** → **Archive**
3. Once archived, click **Distribute App**
4. Follow wizard to upload to App Store Connect

### Quick Build Commands
```bash
# After making changes to web code
npm run build
npx cap sync ios

# Then open in Xcode
npx cap open ios
```

---

## 🔧 Native Features Available

### Camera
```typescript
import { takePhoto, pickImage } from '@/lib/capacitor';

// Take photo with camera
const photoUrl = await takePhoto();

// Pick from gallery
const imageUrl = await pickImage();
```

### Storage
```typescript
import { setStorage, getStorage, removeStorage } from '@/lib/capacitor';

// Save data
await setStorage('user', JSON.stringify(userData));

// Get data
const user = await getStorage('user');

// Remove data
await removeStorage('user');
```

### Share
```typescript
import { shareContent } from '@/lib/capacitor';

await shareContent(
  'Check out MyMirro!',
  'AI stylist companion for everyday outfits',
  'https://mymirro.in'
);
```

### Haptics
```typescript
import { hapticImpact } from '@/lib/capacitor';

// Light, medium, or heavy feedback
await hapticImpact('medium');
```

### Platform Detection
```typescript
import { getAppInfo } from '@/lib/capacitor';

const { isNative, isIOS, isAndroid, isWeb } = getAppInfo();

if (isNative) {
  // Native-only code
}
```

---

## 📦 App Store Submission

### Google Play Store (Android)

#### 1. Create App Listing
1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app
3. Fill in app details:
   - App name: **MyMirro**
   - Category: **Lifestyle**
   - Content rating: Complete questionnaire

#### 2. Prepare Assets
- **App icon**: 512x512 PNG (already have: `public/pwa-512x512.png`)
- **Feature graphic**: 1024x500 PNG
- **Screenshots**: 
  - Phone: 2-8 screenshots (min 320px)
  - Tablet: 2-8 screenshots (min 1024px)
- **Privacy policy URL**: Required

#### 3. Upload Bundle
1. Create release in **Production** track
2. Upload AAB file from Android Studio
3. Add release notes
4. Review and rollout

#### 4. Pricing
- Free or Paid
- Available countries

**Timeline**: 1-3 days for review

### Apple App Store (iOS)

#### 1. Create App in App Store Connect
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in details:
   - Name: **MyMirro**
   - Bundle ID: **com.mymirro.app**
   - SKU: **mymirro-001**
   - Category: **Lifestyle**

#### 2. Prepare Assets
- **App icon**: 1024x1024 PNG (no transparency)
- **Screenshots**: 
  - iPhone 6.7": 1290x2796 (required)
  - iPhone 6.5": 1242x2688
  - iPad Pro 12.9": 2048x2732
- **Privacy policy URL**: Required
- **App preview video**: Optional

#### 3. Upload Build
1. Archive in Xcode
2. Upload to App Store Connect
3. Wait for processing (10-30 mins)
4. Select build in App Store Connect

#### 4. Submit for Review
1. Fill in all required info
2. Add screenshots
3. Submit for review

**Timeline**: 1-2 days for review

---

## 🔄 Update Workflow

### Making Changes

1. **Edit web code** (React components, etc.)
2. **Build web app**:
   ```bash
   npm run build
   ```
3. **Sync to native**:
   ```bash
   npx cap sync
   ```
4. **Open native IDE**:
   ```bash
   npx cap open android  # or ios
   ```
5. **Build and test**

### Over-the-Air Updates (Optional)

For instant updates without app store approval, consider:
- [Capgo](https://capgo.app/) - Live updates for Capacitor
- [Appflow](https://ionic.io/appflow) - Ionic's live update service

---

## 🐛 Troubleshooting

### Android

**Build fails in Android Studio**
- Update Gradle: File → Project Structure → Project → Gradle Version
- Sync Gradle: File → Sync Project with Gradle Files
- Clean build: Build → Clean Project

**App crashes on launch**
- Check logcat in Android Studio
- Verify permissions in AndroidManifest.xml
- Check capacitor.config.ts

**White screen on launch**
- Check browser console in Chrome DevTools
- Verify dist folder has built files
- Run `npx cap sync android`

### iOS

**Pod install fails**
```bash
cd ios/App
pod repo update
pod install
```

**Signing errors**
- Verify Apple Developer account
- Check Bundle ID matches
- Update provisioning profiles

**App crashes on device**
- Check Xcode console logs
- Verify Info.plist permissions
- Check capacitor.config.ts

### General

**Changes not showing**
```bash
# Full rebuild
npm run build
npx cap sync
# Then rebuild in native IDE
```

**Plugin not working**
- Check plugin is in package.json
- Run `npm install`
- Run `npx cap sync`
- Rebuild native app

---

## 📊 App Configuration

### App Name
- **Android**: `android/app/src/main/res/values/strings.xml`
- **iOS**: Xcode → General → Display Name

### App Icon
- **Android**: `android/app/src/main/res/mipmap-*/ic_launcher.png`
- **iOS**: Xcode → Assets.xcassets → AppIcon

### Bundle ID
- **Android**: `android/app/build.gradle` → `applicationId`
- **iOS**: Xcode → General → Bundle Identifier

### Version
- **Android**: `android/app/build.gradle` → `versionCode` & `versionName`
- **iOS**: Xcode → General → Version & Build

---

## 🎯 Next Steps

### Immediate
- [x] Capacitor setup complete
- [ ] Test on Android device
- [ ] Test on iOS device (if Mac available)
- [ ] Create app store assets (screenshots, etc.)

### Before Launch
- [ ] Test all features on real devices
- [ ] Create privacy policy
- [ ] Set up app store listings
- [ ] Generate signed builds
- [ ] Submit for review

### Post-Launch
- [ ] Monitor crash reports
- [ ] Gather user feedback
- [ ] Plan updates
- [ ] Consider analytics integration

---

## 📚 Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Studio Guide](https://developer.android.com/studio/intro)
- [Xcode Guide](https://developer.apple.com/xcode/)
- [Google Play Console](https://play.google.com/console)
- [App Store Connect](https://appstoreconnect.apple.com)

---

## 💡 Tips

### Performance
- Keep web bundle size small
- Use lazy loading for routes
- Optimize images
- Test on low-end devices

### User Experience
- Handle offline gracefully
- Show loading states
- Use native UI patterns
- Test on various screen sizes

### Maintenance
- Keep Capacitor updated: `npm update @capacitor/core @capacitor/cli`
- Update plugins regularly
- Test updates before releasing
- Monitor app store reviews

---

**Status**: ✅ Ready to Build
**Android**: Ready for testing
**iOS**: Requires Xcode (Mac)
