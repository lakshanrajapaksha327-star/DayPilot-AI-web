import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  Compass,
  ArrowRight,
  Info,
  Clock,
  ListTodo,
  RefreshCw,
  Plus,
  Trash2,
  BrainCircuit,
  Target,
  CheckCircle,
  HelpCircle,
  BookOpen,
  Calendar,
  AlertCircle,
  Eye,
  Sliders,
  FileUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { ChatMessage, GeneratedRoadmap, AIMemory } from '../../types/index.ts';
import { RoadmapPreviewModal } from '../modals/RoadmapPreviewModal.tsx';

interface AssistantViewProps {
  onOpenPlanModal: () => void;
  onOpenTaskModal: () => void;
  onOpenRoadmapModal?: () => void;
}

export const AssistantView: React.FC<AssistantViewProps> = ({
  onOpenPlanModal,
  onOpenTaskModal,
  onOpenRoadmapModal,
}) => {
  const { user, userProfile } = useAuth();
  const {
    plans,
    tasks,
    stats,
    memories,
    missedTasks,
    conflicts,
    addMemory,
    deleteMemory,
    clearMemories,
    approveGeneratedRoadmap,
  } = useData();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Load from session or initialize
    const saved = sessionStorage.getItem('daypilot_chat_messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return [
      {
        id: 'msg-welcome',
        sender: 'assistant',
        text: "Hello! I'm your DayPilot AI Study & Productivity Assistant powered by Gemini. I can understand your goals conversationally, generate comprehensive daily roadmaps (e.g. 'I want to learn photo editing for 30 days...'), explain today's lessons, and help you master challenging topics.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  // Active roadmap preview modal state
  const [previewRoadmap, setPreviewRoadmap] = useState<GeneratedRoadmap | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Memory tab/view state
  const [activeTab, setActiveTab] = useState<'chat' | 'memory'>('chat');
  const [newMemoryCategory, setNewMemoryCategory] = useState<AIMemory['category']>('preference');
  const [newMemoryText, setNewMemoryText] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionStorage.setItem('daypilot_chat_messages', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const activePlans = plans.filter((p) => p.status === 'active');
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter((t) => t.date === todayStr);

  const suggestedPrompts = [
    'I want to learn photo editing for 30 days. I am a beginner. I can study one hour every day at 7 PM.',
    'What should I study today?',
    'I am struggling with colour grading.',
    'How is my learning progress this week?',
    'Suggest practical assignments for today\'s scheduled lessons.',
  ];

  // Helper to compile actual context sent to server-side Gemini
  const compileUserContext = () => {
    return {
      userProfile: {
        displayName: user?.displayName || userProfile?.displayName || 'Pilot',
        preferredLanguage: userProfile?.preferredLanguage || 'English',
        preferredStudyTime: userProfile?.preferredStudyTime || 'evening',
        timeZone: userProfile?.timeZone || 'Asia/Colombo',
      },
      stats: {
        streakDays: stats.streakDays,
        totalStudyHours: stats.totalStudyHours,
        todayTasksCompleted: stats.todayTasksCompleted,
        todayTasksTotal: stats.todayTasksTotal,
      },
      todayTasks: todayTasks.map((t) => {
        const p = t.planId ? plans.find((pl) => pl.id === t.planId) : null;
        return {
          title: t.title,
          time: t.startTime,
          durationMinutes: t.durationMinutes,
          priority: t.priority,
          completed: t.completed,
          planTitle: p ? p.title : undefined,
        };
      }),
      missedTasksCount: missedTasks.length,
      missedTasks: missedTasks.slice(0, 5).map((m) => ({
        id: m.id,
        title: m.title,
        scheduledDate: m.date,
        planTitle: m.planId ? plans.find((pl) => pl.id === m.planId)?.title : undefined,
      })),
      conflictsCount: conflicts.length,
      activePlans: activePlans.map((p) => ({
        title: p.title,
        progress: p.progress,
        dailyStudyMinutes: p.dailyStudyMinutes,
        skillLevel: p.skillLevel,
      })),
      memories: memories.map((m) => ({
        category: m.category,
        text: m.text,
        topic: m.topic,
      })),
    };
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    setError(null);
    setLastFailedMessage(null);

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-10).map((m) => ({
        role: m.sender === 'assistant' ? 'assistant' : 'user',
        text: m.text,
      }));

      const userContext = compileUserContext();

      // 1. Call server-side chat endpoint
      const chatRes = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          userContext,
        }),
      });

      if (!chatRes.ok) {
        const errJson = await chatRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned ${chatRes.status}`);
      }

      const chatData = await chatRes.json();

      // If server extracted memory (e.g., struggle or preference), commit it to persistent memory
      if (chatData.extractedMemory) {
        await addMemory(
          chatData.extractedMemory.category,
          chatData.extractedMemory.text,
          chatData.extractedMemory.topic
        );
      }

      // If user requested a learning roadmap, trigger generation immediately
      if (chatData.roadmapIntent) {
        // Show interim status message
        const interimMsgId = `msg-ast-gen-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: interimMsgId,
            sender: 'assistant',
            text: `${chatData.reply}\n\n⏳ Generating your full structured ${chatData.extractedParams?.durationDays || 30}-day roadmap and daily lesson breakdown...`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        // Call server-side roadmap generation
        const roadmapRes = await fetch('/api/gemini/generate-roadmap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: text,
            params: chatData.extractedParams,
            userContext,
          }),
        });

        if (!roadmapRes.ok) {
          const errJson = await roadmapRes.json().catch(() => ({}));
          throw new Error(errJson.error || 'Failed to generate learning roadmap.');
        }

        const roadmapData = await roadmapRes.json();
        const generatedRoadmap: GeneratedRoadmap = roadmapData.roadmap;

        // Replace or append with structured Roadmap Preview Card
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== interimMsgId),
          {
            id: `msg-ast-${Date.now()}`,
            sender: 'assistant',
            text: `I've constructed a complete ${generatedRoadmap.durationDays}-day curriculum: **"${generatedRoadmap.title}"**.\n\nAll ${generatedRoadmap.lessons.length} daily lessons have been synthesized with specific objectives, practical assignments, and completion criteria. You can inspect each day, edit lessons, or approve the roadmap below:`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actionType: 'preview_roadmap',
            roadmapPreview: generatedRoadmap,
          },
        ]);
      } else {
        // Regular conversational reply
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-ast-${Date.now()}`,
            sender: 'assistant',
            text: chatData.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: unknown) {
      console.error('AI Assistant Error:', err);
      const errMsg = err instanceof Error ? err.message : 'An error occurred with Gemini assistant.';
      setError(errMsg);
      setLastFailedMessage(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'system',
          text: `⚠️ Request failed: ${errMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      handleSend(lastFailedMessage);
    }
  };

  const handleNewConversation = () => {
    setMessages([
      {
        id: `msg-welcome-${Date.now()}`,
        sender: 'assistant',
        text: "New conversation started. How can I assist with your learning and study goals today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    sessionStorage.removeItem('daypilot_chat_messages');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOpenPreview = (roadmap: GeneratedRoadmap) => {
    setPreviewRoadmap(roadmap);
    setIsPreviewOpen(true);
  };

  const handleApproveRoadmap = async (approvedRoadmap: GeneratedRoadmap) => {
    const planId = await approveGeneratedRoadmap(approvedRoadmap);
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-ast-approved-${Date.now()}`,
        sender: 'assistant',
        text: `🎉 Roadmap **"${approvedRoadmap.title}"** has been approved and saved to Cloud Firestore! All ${approvedRoadmap.lessons.length} daily lessons are now active in your Schedule Calendar and Task Manager.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionType: 'view_schedule',
      },
    ]);
  };

  const handleAddMemorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;
    await addMemory(newMemoryCategory, newMemoryText.trim());
    setNewMemoryText('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)] min-h-[620px]">
      {/* Left 3 Columns: Main Chat & Conversation View */}
      <div className="lg:col-span-3 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md overflow-hidden shadow-xl">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800/90 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Bot className="w-5 h-5" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-white">DayPilot AI Assistant</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  Gemini 3.8 Live
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Personal study strategist & memory store</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenRoadmapModal && (
              <button
                onClick={onOpenRoadmapModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all cursor-pointer shadow-xs"
                title="Import roadmap from ChatGPT, Claude, DeepSeek or web text"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Import Roadmap</span>
              </button>
            )}
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>
          </div>
        </div>

        {/* Error Alert with Retry button */}
        {error && (
          <div className="flex items-center justify-between px-6 py-2.5 bg-rose-500/10 border-b border-rose-500/30 text-rose-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            {lastFailedMessage && (
              <button
                onClick={handleRetry}
                className="font-bold underline hover:text-white cursor-pointer ml-3 shrink-0"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isSystem = msg.sender === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-rose-300 flex items-center justify-between gap-3">
                  <span>{msg.text}</span>
                  {lastFailedMessage && (
                    <button
                      onClick={handleRetry}
                      className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 font-semibold cursor-pointer shrink-0"
                    >
                      Retry
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-2xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xs'
                  }`}
                >
                  {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Bubble & Cards */}
                <div className="space-y-2.5 max-w-xl">
                  <div
                    className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-xs ${
                      isUser
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-tr-none'
                        : 'bg-slate-950/85 border border-slate-800 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Interactive Roadmap Preview Card inside chat */}
                  {msg.actionType === 'preview_roadmap' && msg.roadmapPreview && (
                    <div className="p-4 rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-blue-950/40 to-slate-950 p-4 shadow-lg">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Compass className="w-4 h-4 text-cyan-400" />
                          <h4 className="font-bold text-sm text-white">{msg.roadmapPreview.title}</h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {msg.roadmapPreview.durationDays} Days
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2 mb-3">
                        {msg.roadmapPreview.description}
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 mb-3 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <div>Daily Target: <strong className="text-white">{msg.roadmapPreview.dailyDurationMinutes}m</strong></div>
                        <div>Level: <strong className="text-white capitalize">{msg.roadmapPreview.skillLevel}</strong></div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleOpenPreview(msg.roadmapPreview!)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect & Edit All {msg.roadmapPreview.lessons.length} Lessons</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <span className="block text-[10px] text-slate-400 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 max-w-xl mr-auto">
              <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 rounded-tl-none text-xs text-slate-300 flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span>DayPilot AI is analyzing goals, schedule context and learning memory...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts carousel */}
        <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1.5">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Try asking or describing a goal:</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                className="shrink-0 text-left px-3 py-1 rounded-full text-xs border border-slate-800 bg-slate-900/90 hover:bg-slate-800 hover:border-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Message Input Box */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90">
          <div className="relative flex items-end gap-2 p-2 rounded-2xl border border-slate-700 bg-slate-900 focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500 transition-all">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your learning goal (e.g., 'I want to learn photo editing for 30 days...')..."
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none resize-none px-2 py-1 max-h-32"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400 px-1">
            <span>Press Enter to send, Shift + Enter for new line</span>
            <span>Real-time Gemini 3.8 server execution</span>
          </div>
        </div>
      </div>

      {/* Right 1 Column: Context & Personal AI Memory Panel */}
      <div className="hidden lg:flex flex-col gap-4 overflow-y-auto">
        {/* Toggle between Context and Memory */}
        <div className="flex p-1 rounded-xl bg-slate-950 border border-slate-800">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'chat' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Schedule Context
          </button>
          <button
            onClick={() => setActiveTab('memory')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'memory' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Memory ({memories.length})</span>
          </button>
        </div>

        {activeTab === 'chat' ? (
          <>
            {/* Today's Focus Schedule Context */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-white">Today's Focus Context</h3>
              </div>
              {todayTasks.length === 0 ? (
                <p className="text-xs text-slate-400">No scheduled tasks for today.</p>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map((t) => (
                    <div
                      key={t.id}
                      className={`p-2 rounded-lg border text-xs ${
                        t.completed
                          ? 'border-slate-800/60 bg-slate-950/40 text-slate-400'
                          : 'border-slate-800 bg-slate-950/80 text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="font-semibold truncate pr-1">{t.title}</span>
                        <span className="text-[10px] text-cyan-300 shrink-0">{t.startTime || `${t.durationMinutes}m`}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{t.category}</span>
                        <span className={`font-bold ${t.completed ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {t.completed ? 'Done' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Learning Roadmaps */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <Compass className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-white">Active Roadmaps</h3>
              </div>
              {activePlans.length === 0 ? (
                <p className="text-xs text-slate-400">No active learning roadmaps.</p>
              ) : (
                <div className="space-y-2.5">
                  {activePlans.map((p) => (
                    <div key={p.id} className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/70 text-xs">
                      <div className="flex items-center justify-between font-semibold text-white mb-1">
                        <span className="truncate pr-1">{p.title}</span>
                        <span className="text-cyan-400">{p.progress}%</span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden mb-1.5">
                        <div className="h-full bg-cyan-400" style={{ width: `${p.progress}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{p.dailyStudyMinutes} min/day</span>
                        <span className="capitalize">{p.skillLevel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Personal AI Memory Management View */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-white">Assistant Memory</h3>
                </div>
                {memories.length > 0 && (
                  <button
                    onClick={() => clearMemories()}
                    className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                DayPilot remembers your learning difficulties, schedule preferences, and active goals across sessions.
              </p>

              {/* Add Custom Memory Note */}
              <form onSubmit={handleAddMemorySubmit} className="space-y-2 mb-4 pb-3 border-b border-slate-800">
                <div className="flex gap-2">
                  <select
                    value={newMemoryCategory}
                    onChange={(e) => setNewMemoryCategory(e.target.value as AIMemory['category'])}
                    className="text-[10px] px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300"
                  >
                    <option value="preference">Preference</option>
                    <option value="difficulty">Difficulty</option>
                    <option value="goal">Goal</option>
                    <option value="note">Note</option>
                  </select>
                  <input
                    type="text"
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    placeholder="Add learning memory note..."
                    className="flex-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>

              {/* Memory Items List */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {memories.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No memories recorded yet.</p>
                ) : (
                  memories.map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/70 text-xs flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider text-cyan-300 border-cyan-500/30 bg-cyan-500/10">
                          {m.category}
                        </span>
                        <p className="text-slate-200 mt-1 text-[11px] leading-relaxed">{m.text}</p>
                      </div>
                      <button
                        onClick={() => deleteMemory(m.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer shrink-0"
                        title="Delete this memory"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Roadmap Inspection & Editing Modal */}
      <RoadmapPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        roadmap={previewRoadmap}
        onApprove={handleApproveRoadmap}
        onReject={() => {
          setPreviewRoadmap(null);
          setIsPreviewOpen(false);
        }}
      />
    </div>
  );
};
