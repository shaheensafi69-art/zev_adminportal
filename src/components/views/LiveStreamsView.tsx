'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Users,
  MessageCircle,
  RefreshCw,
  Square,
  Eye,
  Heart,
  Clock,
  CheckCircle2,
  X,
  Phone,
  Video,
} from 'lucide-react';
import { AdminLiveStream } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface AdminCallSession {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: 'voice' | 'video';
  status: string;
  agora_channel: string;
  duration_seconds?: number;
  created_at: string;
  caller_username?: string | null;
  callee_username?: string | null;
}

interface LiveStreamsViewProps {
  onInspectUserById: (userId: string) => void;
}

export function LiveStreamsView({ onInspectUserById }: LiveStreamsViewProps) {
  const [streams, setStreams] = useState<AdminLiveStream[]>([]);
  const [calls, setCalls] = useState<AdminCallSession[]>([]);
  const [tab, setTab] = useState<'live' | 'calls'>('live');
  const [kpis, setKpis] = useState<{
    liveNow: number;
    totalStreams: number;
    activeViewers: number;
    peakViewersMax: number;
    activeCalls?: number;
    totalCalls?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<AdminLiveStream | null>(null);
  const [streamDetail, setStreamDetail] = useState<{
    comments: Array<Record<string, unknown>>;
    viewers: Array<Record<string, unknown>>;
    reactionsCount: number;
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchStreams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/live');
      const data = await res.json();
      if (data.success) {
        setStreams(data.streams || []);
        setCalls(data.calls || []);
        setKpis(data.kpis || null);
      }
    } catch (err) {
      console.error('Failed to load live streams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/live');
        const data = await res.json();
        if (!cancelled && data.success) {
          setStreams(data.streams || []);
          setCalls(data.calls || []);
          setKpis(data.kpis || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inspectStream = async (stream: AdminLiveStream) => {
    setSelectedStream(stream);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/live?streamId=${stream.id}`);
      const data = await res.json();
      if (data.success) {
        setStreamDetail({
          comments: data.comments || [],
          viewers: data.viewers || [],
          reactionsCount: data.reactionsCount || 0,
        });
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleForceEnd = async (stream: AdminLiveStream) => {
    if (!confirm(`End live room "${stream.title}" hosted by @${stream.host_username || 'host'}?`)) return;
    setEndingId(stream.id);
    try {
      const res = await fetch('/api/admin/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'END_STREAM',
          streamId: stream.id,
          hostId: stream.host_id,
          reason: 'Live stream ended by ZEV Moderation Team.',
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchStreams();
      }
    } finally {
      setEndingId(null);
    }
  };

  const handleForceEndCall = async (call: AdminCallSession) => {
    if (!confirm(`End call between @${call.caller_username || 'caller'} and @${call.callee_username || 'callee'}?`)) return;
    setEndingId(call.id);
    try {
      const res = await fetch('/api/admin/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'END_CALL',
          callId: call.id,
          reason: 'Call terminated by ZEV Moderation Team.',
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchStreams();
      }
    } finally {
      setEndingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl glass-panel">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">ZEV Live Chat & Presence Rooms</h2>
            <p className="text-xs text-slate-400">
              Monitor active `live_streams`, real-time viewer presence (`live_viewers`), live comments, and emergency stop controls
            </p>
          </div>
        </div>

        <button
          onClick={fetchStreams}
          disabled={loading}
          className="glass-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Live Rooms</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl glass-card">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Live Now</span>
            <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono mt-2">{kpis?.liveNow ?? 0}</div>
        </div>
        <div className="p-4 rounded-2xl glass-card">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Active Viewers</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">{kpis?.activeViewers ?? 0}</div>
        </div>
        <div className="p-4 rounded-2xl glass-card">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Peak Concurrency</span>
            <Eye className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-2">{kpis?.peakViewersMax ?? 0}</div>
        </div>
        <div className="p-4 rounded-2xl glass-card">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Voice & Video Calls</span>
            <Phone className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            {kpis?.totalCalls ?? 0}
            {(kpis?.activeCalls ?? 0) > 0 && (
              <span className="ml-2 text-xs text-emerald-400">({kpis?.activeCalls} active)</span>
            )}
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs: Live Rooms vs Voice/Video Calls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab('live')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
            tab === 'live'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'glass-btn text-slate-400 hover:text-white'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Live Rooms ({streams.length})</span>
        </button>
        <button
          onClick={() => setTab('calls')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
            tab === 'calls'
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
              : 'glass-btn text-slate-400 hover:text-white'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Voice & Video Calls ({calls.length})</span>
        </button>
      </div>

      {/* Streams or Calls List */}
      {tab === 'calls' ? (
        loading ? (
          <div className="p-16 text-center text-slate-400 text-xs">Loading call sessions...</div>
        ) : calls.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs glass-panel rounded-3xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
            No voice or video calls logged yet. Agora RTC call signaling is ready.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {calls.map((c) => {
              const isActive = c.status === 'ringing' || c.status === 'accepted';
              return (
                <div key={c.id} className="p-5 rounded-3xl glass-card flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                      {c.call_type === 'video' ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                      <span className="uppercase">{c.call_type} CALL</span>
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black font-mono uppercase border ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-200 space-y-1">
                    <div>
                      <span className="text-slate-400">Caller: </span>
                      <button onClick={() => onInspectUserById(c.caller_id)} className="text-cyan-300 font-bold hover:underline cursor-pointer">
                        @{c.caller_username || 'caller'}
                      </button>
                    </div>
                    <div>
                      <span className="text-slate-400">Callee: </span>
                      <button onClick={() => onInspectUserById(c.callee_id)} className="text-sky-300 font-bold hover:underline cursor-pointer">
                        @{c.callee_username || 'callee'}
                      </button>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 pt-1">
                      Channel: {c.agora_channel}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>{c.duration_seconds ? `${c.duration_seconds}s` : new Date(c.created_at).toLocaleString()}</span>
                    {isActive && (
                      <button
                        onClick={() => handleForceEndCall(c)}
                        disabled={endingId === c.id}
                        className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Square className="w-3 h-3" />
                        End Call
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : loading ? (
        <div className="p-16 text-center text-slate-400 text-xs">
          <div className="w-7 h-7 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading ZEV live rooms...
        </div>
      ) : streams.length === 0 ? (
        <div className="p-16 text-center text-slate-400 text-xs glass-panel rounded-3xl">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
          No live rooms recorded yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {streams.map((s) => {
            const isLive = s.status === 'live';
            const hostName =
              [s.host_first_name, s.host_last_name].filter(Boolean).join(' ') ||
              s.host_username ||
              'Host';
            return (
              <div key={s.id} className="p-5 rounded-3xl glass-card flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <button
                      onClick={() => onInspectUserById(s.host_id)}
                      className="flex items-center gap-2.5 text-left cursor-pointer hover:opacity-80"
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center font-bold text-white text-xs">
                        {s.host_avatar ? (
                          <img src={s.host_avatar} alt="host" className="w-full h-full object-cover" />
                        ) : (
                          hostName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1">
                          <span>{hostName}</span>
                          {s.host_is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        <div className="text-[10px] text-cyan-400 font-mono">@{s.host_username || 'host'}</div>
                      </div>
                    </button>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black font-mono uppercase border ${
                        isLive
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {isLive ? '● LIVE' : s.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-white text-sm line-clamp-1">{s.title}</h4>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 font-mono">
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-cyan-300">
                      {s.category || 'general'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {s.started_at ? new Date(s.started_at).toLocaleString() : new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 font-mono text-[11px] text-slate-300">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      {s.viewer_count} (peak {s.peak_viewer_count})
                    </span>
                    {s.comments_count !== undefined && (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5 text-sky-400" />
                        {s.comments_count}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => inspectStream(s)}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold cursor-pointer"
                    >
                      Inspect
                    </button>
                    {isLive && (
                      <button
                        onClick={() => handleForceEnd(s)}
                        disabled={endingId === s.id}
                        className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Square className="w-3 h-3" />
                        End
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stream Detail Modal */}
      {selectedStream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-3xl max-h-[85vh] glass-panel rounded-3xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">{selectedStream.title}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Room ID: {selectedStream.id} • Host @{selectedStream.host_username || 'host'}
                </p>
              </div>
              <button
                onClick={() => setSelectedStream(null)}
                className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {loadingDetail ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading room chat & viewers...</div>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
                    <span className="px-3 py-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                      Viewers logged: {streamDetail?.viewers.length || 0}
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-400" /> Reactions: {streamDetail?.reactionsCount || 0}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Recent Room Chat</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {(streamDetail?.comments || []).length === 0 ? (
                        <div className="text-xs text-slate-500">No chat messages in this stream.</div>
                      ) : (
                        streamDetail?.comments.map((c) => (
                          <div key={String(c.id)} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs flex justify-between gap-2">
                            <div>
                              <span className="font-bold text-cyan-300">@{String(c.username || 'user')}: </span>
                              <span className="text-slate-200">{String(c.comment_text || '')}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">
                              {new Date(String(c.created_at)).toLocaleTimeString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

