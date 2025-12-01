# Generate APK - Quick Guide

## ⚠️ Android Studio Required

To build the APK, you need Android Studio installed.

## Option 1: Install Android Studio (Recommended)

### Step 1: Download & Install
1. Download from: https://developer.android.com/studio
2. Install Android Studio
3. Open it and complete setup wizard
4. It will download Android SDK automatically

### Step 2: Generate APK
```bash
# Open Android Studio with your project
npm run cap:android

# In Android Studio:
# Build → Build Bundle(s) / APK(s) → Build APK(s)
```

APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Option 2: Use Cloud Build (No Installation)

### GitHub Actions (Free)
I can set up automated APK builds that run on GitHub's servers.

### Codemagic (Free Tier)
1. Sign up at https://codemagic.io
2. Connect your GitHub repo
3. Configure build
4. Download APK from dashboard

---

## Option 3: Command Line (If SDK Installed)

If you have Android SDK but not Studio:

```bash
# Set SDK location
export ANDROID_HOME=/path/to/android/sdk

# Build
cd android
./gradlew assembleDebug

# APK at:
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Current Status

✅ Web app built
✅ Synced to Android
❌ Need Android Studio to build APK

**Next Step**: Install Android Studio or use cloud build service.

---

## Quick Install Android Studio

**Mac:**
```bash
brew install --cask android-studio
```

**Or download**: https://developer.android.com/studio

After install, run:
```bash
npm run cap:android
```

Then: **Build → Build APK**
