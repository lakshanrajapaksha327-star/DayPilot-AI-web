import React, { useState } from 'react';
import { Download, CheckCircle2, Share2, PlusSquare, X, Smartphone, Laptop } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isWindows, platformName, browserName, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running in standalone mode, suppress standard install button
  if (isInstalled) {
    if (variant === 'full') {
      return (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>DayPilot AI Installed & Running in Standalone Mode</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    await install();
    setIsInstalling(false);
  };

  // Supported Chromium / Edge / Android install prompt flow
  if (isInstallable) {
    return (
      <button
        onClick={handleInstallClick}
        disabled={isInstalling}
        title={`Install DayPilot AI on ${platformName}`}
        className={`flex items-center gap-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer ${
          variant === 'full' ? 'px-4 py-2.5 w-full justify-center text-sm' : 'px-3 py-1.5'
        } ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow (WebKit beforeinstallprompt is not supported)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSModal(true)}
          className={`flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors cursor-pointer ${
            variant === 'full' ? 'px-4 py-2.5 w-full justify-center text-sm' : 'px-3 py-1.5'
          } ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
          <span>Install on iOS</span>
        </button>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-white">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Install DayPilot on iPhone / iPad</h3>
                    <p className="text-[11px] text-slate-400">Add to your Home Screen for standalone use</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Step 1: </span>
                    Tap the <strong>Share</strong> icon in the Safari bottom toolbar.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Step 2: </span>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Step 3: </span>
                    Tap <strong>Add</strong> in the top right corner. The app will launch in full standalone mode!
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
