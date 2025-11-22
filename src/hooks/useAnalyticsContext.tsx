import { createContext, useContext, useRef, ReactNode } from 'react';

interface AnalyticsContextValue {
  currentScreen: { current: string | null };
  setCurrentScreen: (screen: string) => void;
  currentVirtualPath: { current: string | null };
  setCurrentVirtualPath: (path: string) => void;
  getScreenCategory: () => string | null;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export const AnalyticsProvider = ({ children }: { children: ReactNode }) => {
  const currentScreen = useRef<string | null>(null);
  const currentVirtualPath = useRef<string | null>(null);

  const setCurrentScreen = (screen: string) => {
    currentScreen.current = screen;
    currentVirtualPath.current = `/app/${screen}`;
  };

  const setCurrentVirtualPath = (path: string) => {
    currentVirtualPath.current = path;
  };

  const getScreenCategory = () => {
    if (!currentScreen.current) return null;
    if (currentScreen.current.startsWith('stylecheck')) return 'stylecheck';
    if (currentScreen.current.startsWith('wardrobe')) return 'wardrobe';
    if (currentScreen.current === 'chat') return 'chat';
    return currentScreen.current;
  };

  return (
    <AnalyticsContext.Provider value={{
      currentScreen,
      setCurrentScreen,
      currentVirtualPath,
      setCurrentVirtualPath,
      getScreenCategory
    }}>
      {children}
    </AnalyticsContext.Provider>
  );
};

export const useAnalyticsContext = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    // Return default implementation if used outside provider
    return {
      currentScreen: { current: null },
      setCurrentScreen: () => {},
      currentVirtualPath: { current: null },
      setCurrentVirtualPath: () => {},
      getScreenCategory: () => null
    };
  }
  return context;
};
