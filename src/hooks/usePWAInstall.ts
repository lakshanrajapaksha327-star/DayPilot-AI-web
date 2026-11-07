import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isWindows: boolean;
  isMac: boolean;
  isDesktop: boolean;
  platformName: string;
  browserName: string;
  appVersion: string;
  install: () => Promise<boolean>;
}

export const APP_VERSION = 'v1.5.0-pwa';

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [platformName, setPlatformName] = useState('Desktop Browser');
  const [browserName, setBrowserName] = useState('Browser');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone mode (already installed as PWA)
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsInstalled(isStandalone);
    };

    checkStandalone();

    const mediaMatcher = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };

    if (mediaMatcher.addEventListener) {
      mediaMatcher.addEventListener('change', handleMediaChange);
    } else {
      mediaMatcher.addListener(handleMediaChange);
    }

    // Detect Platform & Browser
    const ua = navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(ua);
    const isWin = /windows/.test(ua);
    const isMacOS = /macintosh|mac os x/.test(ua) && !isIOSDevice;

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsWindows(isWin);
    setIsMac(isMacOS);

    let pName = 'Unknown Platform';
    if (isWin) pName = 'Windows';
    else if (isMacOS) pName = 'macOS';
    else if (isAndroidDevice) pName = 'Android';
    else if (isIOSDevice) pName = 'iOS (Apple)';
    else if (/linux/.test(ua)) pName = 'Linux';
    setPlatformName(pName);

    let bName = 'Browser';
    if (/edg\//.test(ua)) bName = 'Microsoft Edge';
    else if (/chrome|crios/.test(ua)) bName = 'Google Chrome';
    else if (/firefox|fxios/.test(ua)) bName = 'Mozilla Firefox';
    else if (/safari/.test(ua) && !/chrome/.test(ua)) bName = 'Apple Safari';
    else if (/opr\//.test(ua)) bName = 'Opera';
    setBrowserName(bName);

    // Capture browser install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaMatcher.removeEventListener) {
        mediaMatcher.removeEventListener('change', handleMediaChange);
      } else {
        mediaMatcher.removeListener(handleMediaChange);
      }
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('PWA install prompt error:', err);
      return false;
    }
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isWindows,
    isMac,
    isDesktop: !isIOS && !isAndroid,
    platformName,
    browserName,
    appVersion: APP_VERSION,
    install,
  };
}
