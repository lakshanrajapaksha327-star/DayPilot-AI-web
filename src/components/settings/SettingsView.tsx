import React, { useState } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Laptop,
  Bell,
  Clock,
  Globe,
  User,
  Shield,
  Download,
  Trash2,
  LogIn,
  LogOut,
  CheckCircle,
  CheckCircle2,
  Database,
  Sparkles,
  Smartphone,
  Monitor,
  HardDrive,
  AlertCircle,
  RefreshCw,
  Share2,
  PlusSquare,
  ArrowDownToLine,
  Wifi,
  WifiOff,
  Info,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { usePWAInstall } from '../../hooks/usePWAInstall.ts';
import { ThemePreference, StudyTimePreference } from '../../types/index.ts';

export const SettingsView: React.FC = () => {
  const {
    user,
    userProfile,
    preferences,
    isGuestMode,
    signInWithGoogle,
    signOutUser,
    updatePreferencesInDb,
    updateUserProfileInDb,
  } = useAuth();
  const {
    tasks,
    plans,
    reminders,
    resetCompletedTasks,
    isOnline,
    pendingSyncCount,
    syncPendingChanges,
    clearOfflineCache,
  } = useData();

  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isWindows,
    isMac,
    platformName,
    browserName,
    appVersion,
    install,
  } = usePWAInstall();

  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Local state for profile edits
  const [displayName, setDisplayName] = useState(
    userProfile?.displayName || user?.displayName || ''
  );
  const [preferredLanguage, setPreferredLanguage] = useState(
    userProfile?.preferredLanguage || 'English'
  );
  const [preferredStudyTime, setPreferredStudyTime] = useState<StudyTimePreference>(
    userProfile?.preferredStudyTime || 'evening'
  );
  const [timeZone, setTimeZone] = useState(
    userProfile?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );

  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const showSavedNotice = (text: string) => {
    setSavedNotice(text);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfileInDb({
      displayName: displayName.trim(),
      preferredLanguage,
      preferredStudyTime,
      timeZone,
    });
    showSavedNotice('Profile & time preferences successfully updated.');
  };

  const handleThemeChange = async (theme: ThemePreference) => {
    await updatePreferencesInDb({ theme });
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
    showSavedNotice(`Theme set to ${theme}.`);
  };

  const handleExportData = () => {
    const backupData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user?.uid || 'guest',
        email: user?.email || 'guest@daypilot.ai',
        displayName: userProfile?.displayName,
      },
      plans,
      tasks,
      reminders,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DayPilot_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSavedNotice('Backup downloaded successfully.');
  };

  const handleResetCompleted = async () => {
    const count = tasks.filter((t) => t.completed).length;
    if (count === 0) {
      alert('No completed tasks to reset.');
      return;
    }
    if (window.confirm(`Are you sure you want to clear ${count} completed task(s)?`)) {
      await resetCompletedTasks();
      showSavedNotice('Completed tasks cleared from schedule.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-cyan-400" />
          <span>Application Settings</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Customize themes, study preferences, time zones, notifications, and cloud backups
        </p>
      </div>

      {savedNotice && (
        <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Account & Profile Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-12 h-12 rounded-full border-2 border-cyan-400 object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-lg font-bold text-blue-300">
                {userProfile?.displayName?.charAt(0) || user?.email?.charAt(0) || 'P'}
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-white">
                {user ? user.displayName : isGuestMode ? 'Guest Pilot' : 'Not Connected'}
              </h2>
              <p className="text-xs text-slate-400">{user?.email || (isGuestMode ? 'guest-mode@daypilot.local' : 'Sign in with Google to sync')}</p>
            </div>
          </div>

          <div>
            {user ? (
              <button
                onClick={() => signOutUser()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-300 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                onClick={() => signInWithGoogle()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-md shadow-blue-500/20"
              >
                <LogIn className="w-4 h-4" />
                <span>Connect Google Account</span>
              </button>
            )}
          </div>
        </div>

        {/* Profile Details Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Display Name</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name or alias"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>Preferred Language</span>
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="English">English</option>
                <option value="Spanish">Español</option>
                <option value="French">Français</option>
                <option value="German">Deutsch</option>
                <option value="Japanese">日本語</option>
                <option value="Sinhala">සිංහල (Sinhala)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Preferred Study Time</span>
              </label>
              <select
                value={preferredStudyTime}
                onChange={(e) => setPreferredStudyTime(e.target.value as StudyTimePreference)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="morning">Morning (06:00 - 10:00)</option>
                <option value="afternoon">Afternoon (12:00 - 16:00)</option>
                <option value="evening">Evening (17:00 - 21:00)</option>
                <option value="night">Night (21:00 - 01:00)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>Time Zone</span>
              </label>
              <input
                type="text"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-sm"
            >
              Update Profile Settings
            </button>
          </div>
        </form>
      </div>

      {/* Theme Settings */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-6 shadow-xl">
        <h3 className="font-bold text-sm text-white mb-1">Theme & Visual Experience</h3>
        <p className="text-xs text-slate-400 mb-4">
          Choose between Dark navy mode (recommended for high focus) and clean light mode
        </p>

        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button
            onClick={() => handleThemeChange('dark')}
            className={`p-3.5 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-semibold transition-all cursor-pointer ${
              preferences?.theme !== 'light'
                ? 'bg-blue-600/20 border-cyan-400 text-cyan-300 shadow-md ring-1 ring-cyan-500'
                : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:text-white'
            }`}
          >
            <Moon className="w-4 h-4 text-cyan-400" />
            <span>Dark Navy</span>
          </button>

          <button
            onClick={() => handleThemeChange('light')}
            className={`p-3.5 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-semibold transition-all cursor-pointer ${
              preferences?.theme === 'light'
                ? 'bg-blue-600 text-white shadow-md'
                : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:text-white'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-300" />
            <span>Light Slate</span>
          </button>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-6 shadow-xl space-y-4">
        <div>
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-400" />
            <span>Reminder & Alert Preferences</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Control how DayPilot alerts you before study blocks</p>
        </div>

        <div className="space-y-3 pt-2">
          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/50 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-white">Study Session Reminders</div>
              <div className="text-[11px] text-slate-400">Receive alert cues before scheduled task start times</div>
            </div>
            <input
              type="checkbox"
              checked={preferences?.notificationsEnabled ?? true}
              onChange={(e) => updatePreferencesInDb({ notificationsEnabled: e.target.checked })}
              className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/50 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-white">Daily Morning Digest</div>
              <div className="text-[11px] text-slate-400">Summary notification of today focus priorities</div>
            </div>
            <input
              type="checkbox"
              checked={preferences?.dailyDigest ?? true}
              onChange={(e) => updatePreferencesInDb({ dailyDigest: e.target.checked })}
              className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/50 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-white">Streak Warning Alerts</div>
              <div className="text-[11px] text-slate-400">Evening nudge if your daily learning goal is pending</div>
            </div>
            <input
              type="checkbox"
              checked={preferences?.streakWarnings ?? true}
              onChange={(e) => updatePreferencesInDb({ streakWarnings: e.target.checked })}
              className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Progressive Web Application (PWA) & Installation */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-600 p-0.5 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 shrink-0">
              <img src="/icons/icon.svg" alt="DayPilot AI Icon" className="w-8 h-8 rounded-lg" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Progressive Web App (PWA) & Installation</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {appVersion}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Install DayPilot AI on desktop or mobile for standalone offline execution
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {isInstalled ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Installed (Standalone)</span>
              </span>
            ) : isInstallable ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 animate-pulse">
                <ArrowDownToLine className="w-3.5 h-3.5 text-cyan-400" />
                <span>Ready to Install</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                <Monitor className="w-3.5 h-3.5 text-slate-400" />
                <span>Browser Mode</span>
              </span>
            )}
          </div>
        </div>

        {/* Identity & Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/50">
            <div className="text-[11px] text-slate-400 font-medium">Application Identity</div>
            <div className="text-xs font-semibold text-white mt-1">DayPilot AI</div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">Short Name: DayPilot</div>
          </div>

          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/50">
            <div className="text-[11px] text-slate-400 font-medium">Device & Platform</div>
            <div className="text-xs font-semibold text-white mt-1 flex items-center gap-1.5 truncate">
              {isAndroid || isIOS ? (
                <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              ) : (
                <Laptop className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              )}
              <span className="truncate">{platformName}</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">Browser: {browserName}</div>
          </div>

          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/50">
            <div className="text-[11px] text-slate-400 font-medium">Display Mode</div>
            <div className="text-xs font-semibold text-white mt-1">
              {isInstalled ? 'Standalone Window' : 'Browser Tab'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Scope: / (Full Screen)</div>
          </div>

          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/50">
            <div className="text-[11px] text-slate-400 font-medium">Network & Sync Status</div>
            <div className="text-xs font-semibold mt-1 flex items-center gap-1.5">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">Online & Synced</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300 font-semibold">Offline Mode</span>
                </>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {pendingSyncCount > 0 ? `${pendingSyncCount} action(s) pending sync` : 'All changes synced'}
            </div>
          </div>
        </div>

        {/* Installation Action Banner */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-white">
              {isInstalled
                ? 'DayPilot AI is running as a Progressive Web Application'
                : isInstallable
                ? `Install DayPilot AI for ${platformName}`
                : isIOS
                ? 'Add DayPilot AI to your iOS Home Screen'
                : 'PWA Installation Support'}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-xl">
              {isInstalled
                ? 'The application is running in dedicated standalone mode without browser toolbars. It functions smoothly offline with local cached roadmaps, lessons, and tasks.'
                : isInstallable
                ? 'One-click install adds DayPilot AI to your desktop or mobile app launcher, enables instant offline startup, and gives a clean standalone experience.'
                : isIOS
                ? 'iOS Safari supports full PWA installation via the "Add to Home Screen" action in the Share menu.'
                : 'DayPilot AI is compliant with Web App Manifest and Service Worker standards. You can install it directly from your browser address bar or menu.'}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {isInstallable && (
              <button
                onClick={install}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-blue-500/25 cursor-pointer active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Install Application</span>
              </button>
            )}

            {isIOS && (
              <button
                onClick={() => setShowIOSGuide(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>View iOS Instructions</span>
              </button>
            )}

            {isInstalled && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Installed</span>
              </div>
            )}
          </div>
        </div>

        {/* Step-by-Step Instructions for Unsupported or Manual Browsers */}
        {!isInstalled && (
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Manual Browser Installation Instructions</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-white mb-1">Windows Chrome / Edge</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Look for the <strong>Install</strong> icon in the right side of the URL address bar, or click <strong>Settings (⋮) &gt; Apps &gt; Install DayPilot AI</strong>.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-white mb-1">Android Chrome</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tap the three-dot menu <strong>(⋮)</strong> in Chrome and tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-white mb-1">Apple Safari (iOS)</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tap the <strong>Share</strong> button in the bottom Safari bar, scroll down and tap <strong>Add to Home Screen</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Offline Cache & Synchronisation Controls */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <span>Offline Storage & Cache Management</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Plans, lessons, and tasks are securely cached in local storage for instant offline viewing
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={async () => {
                  setIsManualSyncing(true);
                  const result = await syncPendingChanges();
                  setIsManualSyncing(false);
                  if (result.syncedCount > 0) {
                    showSavedNotice(`Synchronised ${result.syncedCount} offline change(s) to Cloud Firestore.`);
                  } else {
                    showSavedNotice('All changes are already in sync with Cloud Firestore.');
                  }
                }}
                disabled={isManualSyncing || !isOnline || pendingSyncCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isManualSyncing ? 'animate-spin' : ''}`} />
                <span>Sync Pending ({pendingSyncCount})</span>
              </button>

              <button
                onClick={() => {
                  if (confirm('Clear local offline cache? Your cloud data will remain safe in Firestore.')) {
                    clearOfflineCache();
                    showSavedNotice('Local offline cache cleared.');
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Clear Cache
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800">
              <div className="text-cyan-400 font-bold text-sm">{plans.length}</div>
              <div className="text-[10px] text-slate-400">Cached Roadmaps</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800">
              <div className="text-cyan-400 font-bold text-sm">{tasks.length}</div>
              <div className="text-[10px] text-slate-400">Cached Tasks</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800">
              <div className="text-cyan-400 font-bold text-sm">{reminders.length}</div>
              <div className="text-[10px] text-slate-400">Cached Reminders</div>
            </div>
          </div>
        </div>
      </div>

      {/* iOS Installation Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Install on iPhone / iPad</h3>
                  <p className="text-[11px] text-slate-400">Safari Home Screen Installation</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
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
                  Tap the <strong>Share</strong> button in Safari's bottom toolbar.
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
                  Tap <strong>Add</strong>. DayPilot AI will launch in full standalone mode with offline support.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Data Management & Export */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-6 shadow-xl space-y-4">
        <div>
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Data Management & Backup</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Export all personal plans, schedules and metrics</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Export Data as JSON</span>
          </button>

          <button
            onClick={handleResetCompleted}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Completed Tasks</span>
          </button>
        </div>
      </div>

      {/* Privacy & Cloud Architecture Note */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 text-xs text-slate-400 flex items-start gap-3">
        <Shield className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">Privacy & Security Fortress: </span>
          All data is isolated under your authenticated Firebase UID (`users/{'{userId}'}/*`). Hardened Cloud Firestore security rules strictly prevent cross-user document access.
        </div>
      </div>
    </div>
  );
};
