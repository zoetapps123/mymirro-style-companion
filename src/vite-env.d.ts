/// <reference types="vite/client" />

// Snapchat Pixel global function
declare global {
  interface Window {
    snaptr: (command: string, eventName: string, parameters?: Record<string, any>) => void;
  }
}

export {};
