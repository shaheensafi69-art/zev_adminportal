'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Phone, Video, PhoneCall, PhoneMissed, PhoneOff, Clock,
  Users, RefreshCw, Search, Filter, ShieldAlert, CheckCircle2,
  AlertCircle, X, ExternalLink, Copy, Radio, ArrowRight, UserCheck
} from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface CallsMonitorViewProps {
  onInspectUserById?: (userId: string) => void;
}

export function CallsMonitorView({ onInspectUserById }: CallsMonitorViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({
    totalCalls: 0,
    voiceCalls: 0,
    videoCalls: 0,
    groupCalls: 0,
    completedCalls: 0,
    missedCalls: 0,
    rejectedCalls: 0,
    activeCalls: 0,
    totalDurationSeconds: 0,
    avgDurationSeconds: 0,
  });

  // Filters
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Participants Drawer
  const [activeSessionParticipants, setActiveSessionParticipants] = useState<{ session: any; participants: any[] } | null>(null);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const fetchCalls = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        type: selectedType,
        status: selectedStatus,
        is_group: selectedGroup,
        q: searchQuery.trim(),
      });

      const res = await fetch(`/api/admin/calls?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        if (data.kpis) setKpis(data.kpis);
        setSessions(data.sessions || []);
      }
    } catch (err: any) {
      console.error('Failed to load call sessions:', err);
      showToast('Error loading call logs', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, selectedStatus, selectedGroup, searchQuery]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const handleEndSession = async (id: string) => {
    if (!confirm('Force-terminate this Agora RTC session for all participants?')) return;
    try {
      const res = await fetch('/api/admin/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end_session', id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Call session terminated successfully', 'success');
        fetchCalls();
      } else {
        showToast(data.error || 'Failed to terminate call', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteCall = async (id: string) => {
    if (!confirm('Delete this call log record permanently?')) return;
    try {
      const res = await fetch('/api/admin/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_call_log', id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Call record deleted', 'success');
        fetchCalls();
      } else {
        showToast(data.error || 'Failed to delete record', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleInspectParticipants = async (session: any) => {
    setIsLoadingParticipants(true);
    setActiveSessionParticipants({ session, participants: [] });
    try {
      const res = await fetch(`/api/admin/calls?session_id=${session.id}`);
      const data = await res.json();
      if (data.success) {
        setActiveSessionParticipants({ session, participants: data.participants || [] });
      }
    } catch (err: any) {
      showToast('Failed to load participants', 'error');
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const formatDuration = (totalSec: number) => {
    if (!totalSec || totalSec <= 0) return '00:00';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Agora channel copied to clipboard', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-sm animate-fade-in ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' 
            : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
        }`}>
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400">
            <PhoneCall className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Voice & Video RTC Monitor
              <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300">
                Agora RTC & Live Group Calling
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Live WebRTC traffic, voice/video sessions audit, call completion metrics, and channel moderation.
            </p>
          </div>
        </div>

        <button
          onClick={fetchCalls}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 text-xs font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh Calls</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-800/40">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Calls</span>
            <PhoneCall className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{kpis.totalCalls || 0}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
            <span className="text-cyan-300 font-medium">{kpis.voiceCalls || 0} Voice</span>
            <span>•</span>
            <span className="text-purple-300 font-medium">{kpis.videoCalls || 0} Video</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-800/40">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Completed Calls</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{kpis.completedCalls || 0}</div>
          <div className="text-[11px] text-emerald-300 mt-1">
            {kpis.totalCalls ? `${Math.round(((kpis.completedCalls || 0) / kpis.totalCalls) * 100)}% Success Rate` : '0%'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-800/40">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Missed / Cancelled</span>
            <PhoneMissed className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{kpis.missedCalls || 0}</div>
          <div className="text-[11px] text-amber-300 mt-1">
            {kpis.rejectedCalls || 0} Declined by User
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-800/40">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total RTC Airtime</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {formatDuration(Number(kpis.totalDurationSeconds || 0))}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Avg: {formatDuration(Number(kpis.avgDurationSeconds || 0))}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 border border-rose-800/40 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Live Calls</span>
            <Radio className={`w-4 h-4 ${kpis.activeCalls > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2 text-2xl font-black text-white flex items-center gap-2">
            <span>{kpis.activeCalls || 0}</span>
            {kpis.activeCalls > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {kpis.groupCalls || 0} Group Sessions
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search caller, callee or channel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-56 md:w-72"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700/60 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Types</option>
            <option value="voice">Audio Calls Only</option>
            <option value="video">Video Calls Only</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700/60 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Statuses</option>
            <option value="ended">Completed / Ended</option>
            <option value="missed">Missed</option>
            <option value="rejected">Rejected</option>
            <option value="ringing">Ringing</option>
            <option value="accepted">Accepted / Ongoing</option>
          </select>

          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700/60 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Party Modes</option>
            <option value="false">1-on-1 Direct</option>
            <option value="true">Group Calls</option>
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Showing <span className="text-white font-semibold">{sessions.length}</span> calls
        </div>
      </div>

      {/* Call Sessions Table */}
      {sessions.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
          <Phone className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-medium">No RTC call sessions found matching filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3.5">Caller</th>
                <th className="p-3.5 text-center">Flow</th>
                <th className="p-3.5">Callee / Target</th>
                <th className="p-3.5">Type & Channel</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Duration</th>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sessions.map((call) => (
                <tr key={call.id} className="hover:bg-slate-800/30 transition-colors">
                  {/* Caller */}
                  <td className="p-3.5">
                    <button
                      onClick={() => call.caller_id && onInspectUserById?.(call.caller_id)}
                      className="flex items-center space-x-2 text-left hover:text-cyan-400"
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-800 overflow-hidden flex-shrink-0">
                        {call.caller_avatar_url ? (
                          <img src={call.caller_avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div>
                        <div className="font-semibold text-white flex items-center space-x-1">
                          <span>@{call.caller_username || 'caller'}</span>
                          {call.caller_is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        <div className="text-[10px] text-slate-400">{call.caller_first_name} {call.caller_last_name}</div>
                      </div>
                    </button>
                  </td>

                  {/* Flow Arrow */}
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center text-slate-500">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </td>

                  {/* Callee */}
                  <td className="p-3.5">
                    {call.is_group ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-purple-900/60 border border-purple-700/60 flex items-center justify-center text-purple-300">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="font-semibold text-purple-300">Group Room</span>
                          <div className="text-[10px] text-slate-400">
                            {call.participants_count || 1} Participants
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => call.callee_id && onInspectUserById?.(call.callee_id)}
                        className="flex items-center space-x-2 text-left hover:text-cyan-400"
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-800 overflow-hidden flex-shrink-0">
                          {call.callee_avatar_url ? (
                            <img src={call.callee_avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center space-x-1">
                            <span>@{call.callee_username || 'callee'}</span>
                            {call.callee_is_verified && <VerifiedBadge size="sm" />}
                          </div>
                          <div className="text-[10px] text-slate-400">{call.callee_first_name} {call.callee_last_name}</div>
                        </div>
                      </button>
                    )}
                  </td>

                  {/* Type & Channel */}
                  <td className="p-3.5">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 ${
                          call.call_type === 'video'
                            ? 'bg-purple-950 border border-purple-800 text-purple-300'
                            : 'bg-cyan-950 border border-cyan-800 text-cyan-300'
                        }`}>
                          {call.call_type === 'video' ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                          {call.call_type}
                        </span>
                        {call.is_group && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-950 border border-indigo-800 text-indigo-300">
                            Group
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 text-[10px] font-mono text-slate-500">
                        <span className="truncate max-w-[120px]">{call.agora_channel}</span>
                        <button
                          onClick={() => copyToClipboard(call.agora_channel)}
                          className="hover:text-cyan-400 transition-colors"
                          title="Copy Agora Channel"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      call.status === 'ended' && call.duration_seconds > 0
                        ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                        : call.status === 'missed'
                        ? 'bg-amber-950/80 border-amber-800 text-amber-300'
                        : call.status === 'rejected'
                        ? 'bg-rose-950/80 border-rose-800 text-rose-300'
                        : call.status === 'ringing'
                        ? 'bg-cyan-950/80 border-cyan-800 text-cyan-300 animate-pulse'
                        : call.status === 'accepted'
                        ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300 animate-pulse'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}>
                      {call.status}
                      {call.end_reason ? ` (${call.end_reason})` : ''}
                    </span>
                  </td>

                  {/* Duration */}
                  <td className="p-3.5">
                    <span className={`font-mono font-semibold ${
                      call.duration_seconds > 0 ? 'text-white' : 'text-slate-500'
                    }`}>
                      {formatDuration(call.duration_seconds)}
                    </span>
                  </td>

                  {/* Timestamp */}
                  <td className="p-3.5 text-slate-400 whitespace-nowrap">
                    <div>{new Date(call.created_at).toLocaleDateString()}</div>
                    <div className="text-[10px] text-slate-500">{new Date(call.created_at).toLocaleTimeString()}</div>
                  </td>

                  {/* Actions */}
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      {call.is_group && (
                        <button
                          onClick={() => handleInspectParticipants(call)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                          title="Inspect Participants"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {(call.status === 'ringing' || call.status === 'accepted') && (
                        <button
                          onClick={() => handleEndSession(call.id)}
                          className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300"
                          title="Force End Call"
                        >
                          <PhoneOff className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteCall(call.id)}
                        className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-rose-950 hover:text-rose-300 text-slate-400 border border-slate-700/60"
                        title="Delete Call Log"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Participants Drawer Modal */}
      {activeSessionParticipants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  Group Call Participants
                </h3>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Channel: {activeSessionParticipants.session.agora_channel}
                </p>
              </div>
              <button
                onClick={() => setActiveSessionParticipants(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto space-y-2">
              {isLoadingParticipants ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading participants...</div>
              ) : activeSessionParticipants.participants.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No participants recorded in this session.</div>
              ) : (
                activeSessionParticipants.participants.map((part) => (
                  <div
                    key={part.id}
                    className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden">
                        {part.avatar_url ? (
                          <img src={part.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1">
                          <span>@{part.username}</span>
                          {part.is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Joined: {part.joined_at ? new Date(part.joined_at).toLocaleTimeString() : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        part.role === 'host' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {part.role || 'member'}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {part.status || 'joined'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-right">
              <button
                onClick={() => setActiveSessionParticipants(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
