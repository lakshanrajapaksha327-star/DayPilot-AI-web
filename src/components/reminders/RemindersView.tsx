import React, { useState } from 'react';
import {
  Bell,
  BellRing,
  Smartphone,
  Laptop,
  Monitor,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Send,
  Volume2,
  VolumeX,
  Shield,
  Layers,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Reminder, DeviceRecord } from '../../types/index.ts';
import { formatAdvanceOffsetLabel } from '../../utils/reminderEngine.ts';
import { isWebPushSupported, getNotificationPermission } from '../../lib/fcm.ts';

export const RemindersView: React.FC = () => {
  const { userProfile } = useAuth();
  const {
    reminders,
    plans,
    tasks,
    devices,
    reminderSettings,
    enableWebPush,
    disableWebPush,
    removeDevice,
    sendTestPushNotification,
    createReminder,
    deleteReminder,
    toggleReminderCompleted,
    updateReminder,
    updateReminderSettings,
  } = useData();

  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'history' | 'devices' | 'settings'>('today');
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushSuccess, setPushSuccess] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // New quick reminder modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('19:00');
  const [newOffset, setNewOffset] = useState<number>(15);

  const browserSupportsPush = isWebPushSupported();
  const permissionState = getNotificationPermission();

  const todayStr = new Date().toISOString().split('T')[0];

  // Filter reminders
  const todayReminders = reminders.filter((r) => r.date === todayStr && !r.completed);
  const upcomingReminders = reminders.filter((r) => (r.date > todayStr || (r.date === todayStr && r.status === 'pending')) && !r.completed);
  const completedReminders = reminders.filter((r) => r.completed || r.status === 'sent');
  const missedReminders = reminders.filter((r) => !r.completed && r.date < todayStr);

  const handleTogglePush = async () => {
    setPushError(null);
    setPushSuccess(null);
    setIsEnablingPush(true);

    try {
      if (reminderSettings.webPushEnabled) {
        await disableWebPush();
        setPushSuccess('Web push notifications have been disabled on this device.');
      } else {
        const res = await enableWebPush();
        if (!res.success) {
          setPushError(res.error || 'Could not enable push notifications.');
        } else {
          setPushSuccess('Web push notifications enabled! This device will receive scheduled study alerts.');
        }
      }
    } catch (err: any) {
      setPushError(err.message || 'Failed to toggle notifications.');
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    setPushError(null);
    setPushSuccess(null);

    try {
      const res = await sendTestPushNotification(
        'DayPilot AI — Test Notification',
        `Study alert delivery verified for ${userProfile?.displayName || 'Pilot'}. Real-time reminders active.`
      );

      if (res.success) {
        setPushSuccess(`Test notification delivered to ${res.deliveredDevicesCount} registered device(s)! Check your system tray/lock screen.`);
      } else {
        setPushError(res.errors?.join(', ') || 'Failed to dispatch test notification.');
      }
    } catch (err: any) {
      setPushError(err.message || 'Error triggering test notification.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSnooze = async (reminder: Reminder, minutes: number) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    const newScheduledTime = now.toISOString();
    const newTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    await updateReminder(reminder.id, {
      scheduledTime: newScheduledTime,
      time: newTimeStr,
      status: 'pending',
      deliveryResult: `Snoozed for +${minutes} mins`,
    });
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // Calculate delivery time
    const [year, month, day] = newDate.split('-').map(Number);
    const [hour, minute] = newTime.split(':').map(Number);
    const dateObj = new Date(year, month - 1, day, hour, minute);
    if (newOffset > 0) {
      dateObj.setMinutes(dateObj.getMinutes() - newOffset);
    }

    await createReminder({
      title: newTitle.trim(),
      notificationTitle: 'Your learning time is here!',
      notificationMessage: newTitle.trim(),
      date: newDate,
      time: newTime,
      scheduledTime: dateObj.toISOString(),
      timeZone: userProfile?.timeZone || 'Asia/Colombo',
      status: 'pending',
      advanceOffsetMinutes: newOffset,
      completed: false,
      recurring: 'none',
    });

    setNewTitle('');
    setIsCreateModalOpen(false);
  };

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('android') || p.includes('ios')) return <Smartphone className="w-4 h-4 text-emerald-400" />;
    if (p.includes('mac') || p.includes('win')) return <Monitor className="w-4 h-4 text-cyan-400" />;
    return <Laptop className="w-4 h-4 text-purple-400" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <BellRing className="w-6 h-6 text-cyan-400" />
            <span>Push Notifications & Reminders</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real cross-device scheduled study alerts, background Web Push, and in-app dashboard
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSendTest}
            disabled={isSendingTest}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 transition-all cursor-pointer shadow-sm"
          >
            <Send className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isSendingTest ? 'Dispatching...' : 'Test Push Notification'}</span>
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Reminder</span>
          </button>
        </div>
      </div>

      {/* Push Status and Limitation Banner */}
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/30 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              reminderSettings.webPushEnabled
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">Cross-Device Push Delivery Status</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                  reminderSettings.webPushEnabled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}>
                  {reminderSettings.webPushEnabled ? 'Web Push Active' : 'In-App Only'}
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {devices.length} Registered Device{devices.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Background notifications are dispatched from our secure backend scheduling service to all your registered devices (Windows Chrome, Edge, Android Chrome). When the browser is closed, the FCM Service Worker handles background display.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleTogglePush}
              disabled={isEnablingPush || !browserSupportsPush}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                reminderSettings.webPushEnabled
                  ? 'bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
              }`}
            >
              {isEnablingPush ? 'Configuring...' : reminderSettings.webPushEnabled ? 'Disable Web Push' : 'Enable Web Push'}
            </button>
          </div>
        </div>

        {/* Feedback alerts */}
        {pushSuccess && (
          <div className="mt-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{pushSuccess}</span>
          </div>
        )}
        {pushError && (
          <div className="mt-3 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{pushError}</span>
          </div>
        )}

        {/* Browser Permission Explanatory note if blocked */}
        {permissionState === 'denied' && (
          <div className="mt-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Notification permission is currently blocked in your browser.</span>
              <p className="text-[11px] text-amber-100/90 mt-0.5">
                To receive background study reminders, click the padlock or settings icon in your browser address bar, set Notifications to "Allow", and reload. In-app alerts remain active when the app is open.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          { id: 'today', label: "Today's Reminders", count: todayReminders.length },
          { id: 'upcoming', label: 'Upcoming Queue', count: upcomingReminders.length },
          { id: 'history', label: 'Delivered & Completed', count: completedReminders.length },
          { id: 'devices', label: 'Registered Devices', count: devices.length },
          { id: 'settings', label: 'Reminder Settings', count: null },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: TODAY'S REMINDERS */}
      {activeTab === 'today' && (
        <div className="space-y-3">
          {todayReminders.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8">
              <CheckCircle2 className="w-12 h-12 text-cyan-400 mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-bold text-white">All caught up for today!</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No pending study alerts for today. New sessions scheduled via your Learning Roadmaps will appear here automatically.
              </p>
            </div>
          ) : (
            todayReminders.map((rem) => {
              const linkedTask = rem.taskId ? tasks.find((t) => t.id === rem.taskId) : null;
              const linkedPlan = rem.planId ? plans.find((p) => p.id === rem.planId) : null;

              return (
                <div
                  key={rem.id}
                  className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{rem.title}</span>
                        {linkedPlan && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-cyan-800/60 bg-cyan-950 text-cyan-300">
                            {linkedPlan.title}
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider bg-blue-500/10 text-cyan-300 border-blue-500/30">
                          {rem.status}
                        </span>
                      </div>
                      {rem.notificationMessage && (
                        <p className="text-xs text-slate-300 mt-1">{rem.notificationMessage}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                        <span className="text-cyan-300 font-semibold flex items-center gap-1">
                          <Bell className="w-3 h-3" />
                          {rem.time}
                        </span>
                        <span>•</span>
                        <span>{formatAdvanceOffsetLabel(rem.advanceOffsetMinutes || 0)}</span>
                        <span>•</span>
                        <span>{rem.timeZone || 'Asia/Colombo'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {/* Snooze options */}
                    <button
                      onClick={() => handleSnooze(rem, 5)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      title="Snooze 5 minutes"
                    >
                      +5m
                    </button>
                    <button
                      onClick={() => handleSnooze(rem, 15)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      title="Snooze 15 minutes"
                    >
                      +15m
                    </button>
                    <button
                      onClick={() => toggleReminderCompleted(rem.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Done</span>
                    </button>
                    <button
                      onClick={() => deleteReminder(rem.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                      title="Cancel reminder"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: UPCOMING QUEUE */}
      {activeTab === 'upcoming' && (
        <div className="space-y-3">
          {upcomingReminders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No upcoming scheduled reminders.
            </div>
          ) : (
            upcomingReminders.map((rem) => (
              <div
                key={rem.id}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 flex items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">{rem.title}</span>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{rem.date}</span>
                      <span>at {rem.time}</span>
                      <span>•</span>
                      <span>{formatAdvanceOffsetLabel(rem.advanceOffsetMinutes || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-700 text-slate-400 uppercase">
                    {rem.status}
                  </span>
                  <button
                    onClick={() => deleteReminder(rem.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                    title="Cancel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: DELIVERED & COMPLETED HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {completedReminders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No delivery history recorded yet.
            </div>
          ) : (
            completedReminders.map((rem) => (
              <div
                key={rem.id}
                className="p-3.5 rounded-xl border border-slate-800/70 bg-slate-950/40 opacity-80 flex items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-medium text-slate-300 line-through">{rem.title}</span>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      <span>Delivered for {rem.date} at {rem.time}</span>
                      {rem.deliveryResult && <span className="text-emerald-400/80"> • {rem.deliveryResult}</span>}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
                  {rem.status === 'sent' ? 'Pushed' : 'Completed'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: REGISTERED DEVICES */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-xs text-slate-300">
            <h4 className="font-bold text-white mb-1">Multi-Device Web Push Token Manager</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              DayPilot AI registers each of your supported devices (Windows Chrome, Windows Edge, Android Chrome, etc.) with Firebase Cloud Messaging. Devices are tied strictly to your authenticated account and are never exposed across users.
            </p>
          </div>

          <div className="space-y-3">
            {devices.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs rounded-xl border border-dashed border-slate-800 p-6">
                <Laptop className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p>No registered devices yet. Click "Enable Web Push" above to register this browser.</p>
              </div>
            ) : (
              devices.map((device) => (
                <div
                  key={device.id}
                  className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                      {getPlatformIcon(device.platform)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{device.deviceName}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-slate-800 text-slate-300">
                          {device.browser}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                        <span className="font-mono text-[10px] text-slate-500 truncate max-w-[200px]">
                          Token: {device.fcmToken.slice(0, 16)}...
                        </span>
                        <span>•</span>
                        <span>Registered: {new Date(device.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => removeDevice(device.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Device</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: REMINDER SETTINGS */}
      {activeTab === 'settings' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-6 max-w-2xl">
          <h3 className="font-bold text-base text-white border-b border-slate-800 pb-3">
            Cross-Device Reminder Preferences
          </h3>

          <div className="space-y-4 text-xs">
            {/* Advance notification offset */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-200 block">
                Advance Study Notification
              </label>
              <p className="text-[11px] text-slate-400">
                Choose how early DayPilot AI notifies you before a scheduled learning session begins.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[0, 5, 10, 15, 30].map((offset) => (
                  <button
                    key={offset}
                    onClick={() => updateReminderSettings({ advanceOffsetMinutes: offset })}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                      reminderSettings.advanceOffsetMinutes === offset
                        ? 'bg-blue-600/20 border-cyan-400 text-cyan-300 font-bold'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    {offset === 0 ? 'Exact Time' : `${offset}m Before`}
                  </button>
                ))}
              </div>
            </div>

            {/* In-app sound alert toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950">
              <div className="flex items-center gap-3">
                {reminderSettings.soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                <div>
                  <span className="font-semibold text-slate-200 block">Audible In-App Chime</span>
                  <span className="text-[11px] text-slate-400">Play pleasant subtle notification chime on desktop</span>
                </div>
              </div>
              <button
                onClick={() => updateReminderSettings({ soundEnabled: !reminderSettings.soundEnabled })}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  reminderSettings.soundEnabled ? 'bg-cyan-500' : 'bg-slate-800'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform ${
                  reminderSettings.soundEnabled ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Per-Plan Reminders Toggle */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="font-semibold text-slate-200 block">
                Enable Reminders per Active Learning Roadmap
              </label>
              {plans.length === 0 ? (
                <p className="text-[11px] text-slate-500">No active roadmaps found.</p>
              ) : (
                <div className="space-y-2">
                  {plans.map((p) => {
                    const isEnabled = reminderSettings.planRemindersEnabled[p.id] !== false;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-950"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color || '#06B6D4' }} />
                          <span className="font-medium text-slate-200">{p.title}</span>
                        </div>
                        <button
                          onClick={() => {
                            const next = { ...reminderSettings.planRemindersEnabled, [p.id]: !isEnabled };
                            updateReminderSettings({ planRemindersEnabled: next });
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold border cursor-pointer ${
                            isEnabled
                              ? 'bg-blue-600/20 border-cyan-500/40 text-cyan-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {isEnabled ? 'Enabled' : 'Muted'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Quick Reminder Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateReminder}
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl relative space-y-4"
          >
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Schedule Study Reminder</h3>
                <p className="text-xs text-slate-400">Dispatches real push alerts to all your devices</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Reminder Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Evening Python Revision & Practice"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Time</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Advance Warning</label>
              <select
                value={newOffset}
                onChange={(e) => setNewOffset(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value={0}>At scheduled start time</option>
                <option value={5}>5 minutes before</option>
                <option value={10}>10 minutes before</option>
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-md shadow-blue-500/20"
              >
                Schedule Alert
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
