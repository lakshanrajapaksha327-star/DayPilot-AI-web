import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.ts';
import { useData } from '../../context/DataContext.tsx';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { pendingSyncCount, syncPendingChanges } = useData();
  const [justReconnected, setJustReconnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isOnline) {
      // Trigger momentary green banner on reconnection
      setJustReconnected(true);
      const timer = setTimeout(() => setJustReconnected(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncPendingChanges();
    setIsSyncing(false);
  };

  // Reconnected banner
  if (isOnline && justReconnected && pendingSyncCount === 0) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed bottom-20 md:bottom-5 left-4 z-40 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-300"
      >
        <Wifi className="w-4 h-4 text-emerald-400" />
        <span>Back Online — Cloud Firestore connected</span>
      </aside>
    );
  }

  // Offline banner
  if (!isOnline) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed bottom-20 md:bottom-5 left-4 z-40 flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs font-medium shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-300 max-w-md"
      >
        <div className="relative flex items-center justify-center">
          <WifiOff className="w-4 h-4 text-amber-400" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-white">Offline Mode</div>
          <div className="text-[11px] text-amber-300/90">
            {pendingSyncCount > 0
              ? `${pendingSyncCount} draft change(s) queued for sync.`
              : 'Using cached application shell and local data.'}
          </div>
        </div>
        {pendingSyncCount > 0 && isOnline && (
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        )}
      </aside>
    );
  }

  return null;
};
