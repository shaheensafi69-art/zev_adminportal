'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Play,
  Trash2,
  Database,
  MessageSquare,
  Hash,
  Users,
  ShieldCheck,
  Sparkles,
  Layers,
} from 'lucide-react';
import { MediaDeletionQueueItem, SchemaMigrationRecord } from '@/lib/types';

interface SystemHealthResponse {
  migrations: SchemaMigrationRecord[];
  mediaQueue: MediaDeletionQueueItem[];
  ecosystemCounts: {
    conversations: number;
    directMessages: number;
    messageRequests: number;
    userNotes: number;
    userHighlights: number;
    userFollows: number;
    followRequests: number;
    closeFriends: number;
    userBlocks: number;
    userMutes: number;
    postMedia: number;
    hashtags: number;
    trendingTopics: number;
    searchHistory: number;
    callSessions?: number;
  };
  environmentHealth: {
    hasSupabaseServiceRole: boolean;
    hasFirebaseServiceAccount: boolean;
    hasR2Credentials: boolean;
    hasZevWebUrl: boolean;
    hasAgoraCredentials?: boolean;
  };
}

export function SystemHealthView() {
  const [data, setData] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [lastRpcResult, setLastRpcResult] = useState<unknown>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 5000);
  };

  const fetchSystem = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system');
      const json = await res.json();
      if (json.success) {
        setData({
          migrations: json.migrations || [],
          mediaQueue: json.mediaQueue || [],
          ecosystemCounts: json.ecosystemCounts,
          environmentHealth: json.environmentHealth,
        });
      } else {
        showFeedback(json.error || 'Failed to load system telemetry', 'error');
      }
    } catch {
      showFeedback('Network error loading system health', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/system');
        const json = await res.json();
        if (!cancelled && json.success) {
          setData({
            migrations: json.migrations || [],
            mediaQueue: json.mediaQueue || [],
            ecosystemCounts: json.ecosystemCounts,
            environmentHealth: json.environmentHealth,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const triggerAction = async (
    action: 'RECONCILE_COUNTERS' | 'EXPIRE_STALE_SUBSCRIPTIONS' | 'UPDATE_MEDIA_QUEUE',
    extra?: { queueId?: string; status?: string }
  ) => {
    setRunningAction(extra?.queueId ? `${action}:${extra.queueId}` : action);
    try {
      const res = await fetch('/api/admin/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.result !== undefined) {
          setLastRpcResult(json.result);
        }
        showFeedback(json.message || 'Maintenance job completed');
        await fetchSystem();
      } else {
        showFeedback(json.error || 'Maintenance action failed', 'error');
      }
    } catch {
      showFeedback('Network error running system action', 'error');
    } finally {
      setRunningAction(null);
    }
  };

  const envItems = data
    ? [
        { label: 'Supabase Service Role Key', ok: data.environmentHealth.hasSupabaseServiceRole },
        { label: 'Firebase Admin Service Account (FCM v1)', ok: data.environmentHealth.hasFirebaseServiceAccount },
        { label: 'Cloudflare R2 Storage Credentials', ok: data.environmentHealth.hasR2Credentials },
        { label: 'ZEV Web Push / Proxy URL', ok: data.environmentHealth.hasZevWebUrl },
        { label: 'Agora RTC Credentials (Voice, Video & Live)', ok: Boolean(data.environmentHealth.hasAgoraCredentials) },
      ]
    : [];

  const eco = data?.ecosystemCounts;
  const telemetryCards = eco
    ? [
        { label: 'Chat Conversations', value: eco.conversations, icon: MessageSquare, accent: 'text-cyan-400' },
        { label: 'Direct Messages', value: eco.directMessages, icon: MessageSquare, accent: 'text-sky-400' },
        { label: 'Voice & Video Calls', value: eco.callSessions ?? 0, icon: Sparkles, accent: 'text-violet-400' },
        { label: 'Message Requests', value: eco.messageRequests, icon: ShieldCheck, accent: 'text-amber-400' },
        { label: 'User Notes (24h)', value: eco.userNotes, icon: Sparkles, accent: 'text-indigo-400' },
        { label: 'Story Highlights', value: eco.userHighlights, icon: Layers, accent: 'text-purple-400' },
        { label: 'Post Carousel Media', value: eco.postMedia, icon: Layers, accent: 'text-emerald-400' },
        { label: 'User Follows Graph', value: eco.userFollows, icon: Users, accent: 'text-cyan-400' },
        { label: 'Follow Requests', value: eco.followRequests, icon: Users, accent: 'text-amber-400' },
        { label: 'Close Friends', value: eco.closeFriends, icon: Users, accent: 'text-emerald-400' },
        { label: 'User Blocks', value: eco.userBlocks, icon: ShieldCheck, accent: 'text-rose-400' },
        { label: 'User Mutes', value: eco.userMutes, icon: ShieldCheck, accent: 'text-orange-400' },
        { label: 'Hashtags & Topics', value: eco.hashtags + eco.trendingTopics, icon: Hash, accent: 'text-indigo-400' },
      ]
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl glass-panel">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">System Health, Migrations & Maintenance</h2>
            <p className="text-xs text-slate-400">
              Inspect SQL migrations (`001`–`014`), process `media_deletion_queue`, run PostgreSQL RPC maintenance, and audit platform graph tables
            </p>
          </div>
        </div>

        <button
          onClick={fetchSystem}
          disabled={loading}
          className="glass-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh System</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
              : 'bg-rose-950/60 border-rose-700/60 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Environment Readiness & One-Click Maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl glass-panel space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Runtime Credentials & Service Readiness</span>
          </h3>
          <div className="space-y-2.5">
            {envItems.map((item) => (
              <div
                key={item.label}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs"
              >
                <span className="text-slate-200 font-medium">{item.label}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                    item.ok
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'
                      : 'bg-amber-950/70 text-amber-300 border-amber-700/50'
                  }`}
                >
                  {item.ok ? 'Configured' : 'Missing'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-3xl glass-panel space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>One-Click PostgreSQL Maintenance RPCs</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => triggerAction('RECONCILE_COUNTERS')}
              disabled={runningAction !== null}
              className="p-4 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-left transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center justify-between text-xs font-extrabold text-cyan-300">
                <span>Reconcile All Counters</span>
                <Play className="w-4 h-4" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Runs `public.reconcile_all_counters()` across posts, reels, profiles, stories & hashtags
              </p>
            </button>

            <button
              onClick={() => triggerAction('EXPIRE_STALE_SUBSCRIPTIONS')}
              disabled={runningAction !== null}
              className="p-4 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-left transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center justify-between text-xs font-extrabold text-indigo-300">
                <span>Sweep Expired Badges</span>
                <Play className="w-4 h-4" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Runs `public.expire_stale_subscriptions()` while preserving lifetime referral badges
              </p>
            </button>
          </div>

          {lastRpcResult !== null && (
            <div className="p-3 rounded-2xl bg-black/70 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
              <div className="text-slate-400 mb-1">Last RPC Result:</div>
              <pre>{JSON.stringify(lastRpcResult, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Social & Chat Ecosystem Telemetry Grid */}
      <div className="p-6 rounded-3xl glass-panel space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>ZEV Social, Chat & Graph Telemetry</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {telemetryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="p-3.5 rounded-2xl glass-card">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate">{card.label}</span>
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${card.accent}`} />
                </div>
                <div className="text-xl font-black text-white font-mono mt-1.5">{card.value}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Media Deletion Queue & Schema Migrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* R2 Media Deletion Queue */}
        <div className="rounded-3xl glass-panel overflow-hidden flex flex-col">
          <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-amber-400" />
                <span>R2 Media Deletion Queue</span>
              </h3>
              <p className="text-[11px] text-slate-400">Queued object keys scheduled for storage cleanup</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-mono">
              {data?.mediaQueue.length ?? 0} rows
            </span>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">R2 Key / Reason</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {!data?.mediaQueue.length ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-slate-500">
                      Media deletion queue is empty.
                    </td>
                  </tr>
                ) : (
                  data.mediaQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.03]">
                      <td className="py-2.5 px-4 max-w-xs">
                        <div className="font-mono text-[11px] text-white truncate">{item.r2_key}</div>
                        <div className="text-[10px] text-slate-400">
                          {item.reason} • {item.attempts} attempts
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border uppercase ${
                            item.status === 'completed'
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'
                              : item.status === 'failed'
                              ? 'bg-rose-950/70 text-rose-300 border-rose-700/50'
                              : 'bg-amber-950/70 text-amber-300 border-amber-700/50'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {item.status !== 'pending' && (
                          <button
                            onClick={() => triggerAction('UPDATE_MEDIA_QUEUE', { queueId: item.id, status: 'pending' })}
                            disabled={runningAction !== null}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold cursor-pointer"
                          >
                            Retry
                          </button>
                        )}
                        {item.status !== 'completed' && (
                          <button
                            onClick={() =>
                              triggerAction('UPDATE_MEDIA_QUEUE', { queueId: item.id, status: 'completed' })
                            }
                            disabled={runningAction !== null}
                            className="px-2 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 text-[10px] font-bold cursor-pointer"
                          >
                            Done
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Applied Schema Migrations */}
        <div className="rounded-3xl glass-panel overflow-hidden flex flex-col">
          <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Applied SQL Schema Migrations</span>
              </h3>
              <p className="text-[11px] text-slate-400">Live records from `public.schema_migrations`</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-700/50 text-emerald-300 text-[11px] font-mono font-bold">
              {data?.migrations.length ?? 0} applied
            </span>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Version</th>
                  <th className="py-2.5 px-4">Migration Name</th>
                  <th className="py-2.5 px-4">Applied At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {!data?.migrations.length ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-slate-500">
                      No schema_migrations rows found.
                    </td>
                  </tr>
                ) : (
                  data.migrations.map((m) => (
                    <tr key={m.version} className="hover:bg-white/[0.03]">
                      <td className="py-2.5 px-4 font-mono font-bold text-cyan-300">{m.version}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-200">{m.name}</td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                        {new Date(m.applied_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

