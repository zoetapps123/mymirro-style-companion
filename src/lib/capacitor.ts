import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

// Camera
export const takePhoto = async () => {
  if (!isNative) {
    throw new Error('Camera only available in native app');
  }
  
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera
  });
  
  return image.webPath;
};

export const pickImage = async () => {
  if (!isNative) {
    throw new Error('Gallery only available in native app');
  }
  
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Photos
  });
  
  return image.webPath;
};

// Storage
export const setStorage = async (key: string, value: string) => {
  await Preferences.set({ key, value });
};

export const getStorage = async (key: string) => {
  const { value } = await Preferences.get({ key });
  return value;
};

export const removeStorage = async (key: string) => {
  await Preferences.remove({ key });
};

// Share
export const shareContent = async (title: string, text: string, url?: string) => {
  if (!isNative) {
    if (navigator.share) {
      await navigator.share({ title, text, url });
    } else {
      throw new Error('Share not supported');
    }
    return;
  }
  
  await Share.share({
    title,
    text,
    url,
    dialogTitle: title
  });
};

// Status Bar
export const initStatusBar = async () => {
  if (!isNative) return;
  
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#000000' });
  } catch (e) {
    console.log('StatusBar not available');
  }
};

// Splash Screen
export const hideSplashScreen = async () => {
  if (!isNative) return;
  
  try {
    await SplashScreen.hide();
  } catch (e) {
    console.log('SplashScreen not available');
  }
};

// Keyboard
export const hideKeyboard = async () => {
  if (!isNative) return;
  
  try {
    await Keyboard.hide();
  } catch (e) {
    console.log('Keyboard not available');
  }
};

// Haptics
export const hapticImpact = async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
  if (!isNative) return;
  
  try {
    const impactStyle = style === 'light' ? ImpactStyle.Light : 
                       style === 'heavy' ? ImpactStyle.Heavy : 
                       ImpactStyle.Medium;
    await Haptics.impact({ style: impactStyle });
  } catch (e) {
    console.log('Haptics not available');
  }
};

// App Info
export const getAppInfo = () => ({
  isNative,
  platform,
  isIOS: platform === 'ios',
  isAndroid: platform === 'android',
  isWeb: platform === 'web'
});
