import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui/button';

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const [show, setShow] = useState(false);

  useEffect(() => {
    if (needRefresh) {
      setShow(true);
    }
  }, [needRefresh]);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-4 flex items-center justify-between gap-4">
      <p className="text-sm">New version available!</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setShow(false);
            setNeedRefresh(false);
          }}
        >
          Later
        </Button>
        <Button
          size="sm"
          onClick={() => updateServiceWorker(true)}
        >
          Update
        </Button>
      </div>
    </div>
  );
}
