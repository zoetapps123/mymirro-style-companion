import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Button } from './ui/button';

export function OfflineFallback() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <WifiOff className="w-16 h-16 mx-auto text-muted-foreground" />
        <h2 className="text-2xl font-bold">You're Offline</h2>
        <p className="text-muted-foreground">
          Some features may not be available. Please check your internet connection.
        </p>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
