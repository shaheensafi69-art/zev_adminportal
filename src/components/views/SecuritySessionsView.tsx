'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Laptop,
  KeyRound,
  Activity,
  UserX,
  RefreshCw,
  Search,
  LogOut,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
} from 'lucide-react';
import { UserSessionRecord, UserSecurityLogRecord, AccountDeletionRecord } from '@/lib/types';

interface SecuritySessionsViewProps {
  onInspectUserById: (userId: string) => void;
}

interface TrustedDeviceRecord {
  id: string;
  user_id: string;
  device_id?: string | null;
  device_name?: string | null;
  platform?: string | null;
  is_trusted: boolean;
  last_authenticated_at?: string | null;
  created_at: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface SecurityKPIs {
  activeSessions: number;
  trustedDevices: number;
  securityEvents: number;
  pendingDeletions: number;
}

export function SecuritySessionsView({ onInspectUserById }: SecuritySessionsViewProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'logs' | 'trusted' | 'deletions'>('sessions');
  const [kpis, setKpis] = useState<SecurityKPIs | null>(null);
  const [sessions, setSessions] = useState<UserSessionRecord[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDeviceRecord[]>([]);
  const [securityLogs, setSecurityLogs] = useState<UserSecurityLogRecord[]>([]);
  const [deletions, setDeletions] = useState<AccountDeletionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 5000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security');
      const data = await res.json();
      if (data.success) {
        setKpis(data.kpis || null);
        setSessions(data.sessions || []);
        setTrustedDevices(data.trustedDevices || []);
        setSecurityLogs(data.securityLogs || []);
        setDeletions(data.deletions || []);
      } else {
        showFeedback(data.error || 'Failed to load security telemetry', 'error');
      }
    } catch {
      showFeedback('Network error loading security & sessions data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/security');
        const data = await res.json();
        if (!cancelled && data.success) {
          setKpis(data.kpis || null);
          setSessions(data.sessions || []);
          setTrustedDevices(data.trustedDevices || []);
          setSecurityLogs(data.securityLogs || []);
          setDeletions(data.deletions || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    setBusyId(sessionId);
    try {
      const res = await fetch('/api/admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVOKE_SESSION', sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(data.message || 'Session terminated');
        await fetchData();
      } else {
        showFeedback(data.error || 'Failed to terminate session', 'error');
      }
    } catch {
      showFeedback('Network error revoking session', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeAllUserSessions = async (userId: string, username?: string | null) => {
    if (!confirm(`Force sign-out ALL active sessions for @${username || userId.slice(0, 8)}?`)) return;
    setBusyId(userId);
    try {
      const res = await fetch('/api/admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVOKE_ALL_USER_SESSIONS', userId }),
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(data.message || 'All active user sessions signed out');
        await fetchData();
      } else {
        showFeedback(data.error || 'Failed to sign out user sessions', 'error');
      }
    } catch {
      showFeedback('Network error signing out user sessions', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateDeletion = async (deletionId: string, status: 'completed' | 'cancelled') => {
    if (!confirm(`Mark this account deletion request as "${status}"?`)) return;
    setBusyId(deletionId);
    try {
      const res = await fetch('/api/admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_DELETION_STATUS', deletionId, status }),
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(data.message || `Deletion request marked ${status}`);
        await fetchData();
      } else {
        showFeedback(data.error || 'Failed to update deletion status', 'error');
      }
    } catch {
      showFeedback('Network error updating deletion status', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const q = search.trim().toLowerCase();
  const filteredSessions = sessions.filter(
    (s) =>
      !q ||
      `${s.username || ''} ${s.email || ''} ${s.device_name || ''} ${s.platform || ''} ${s.ip_address || ''}`
        .toLowerCase()
        .includes(q)
  );
  const filteredLogs = securityLogs.filter(
    (l) =>
      !q ||
      `${l.username || ''} ${l.email || ''} ${l.event_type} ${l.status} ${l.ip_address || ''} ${l.platform || ''}`
        .toLowerCase()
        .includes(q)
  );
  const filteredTrusted = trustedDevices.filter(
    (d) =>
      !q ||
      `${d.username || ''} ${d.email || ''} ${d.device_name || ''} ${d.platform || ''} ${d.device_id || ''}`
        .toLowerCase()
        .includes(q)
  );
  const filteredDeletions = deletions.filter(
    (d) =>
      !q ||
      `${d.username || ''} ${d.email || ''} ${d.reason || ''} ${d.action_type} ${d.status}`
        .toLowerCase()
        .includes(q)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl glass-panel">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Security, Sessions & Account Lifecycle</h2>
            <p className="text-xs text-slate-400">
              Monitor live `user_sessions`, trusted devices, security audit events, and account deletion requests
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="glass-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Security</span>
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

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl glass-card">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Active Sessions</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-2">{kpis?.activeSessions ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">{sessions.length} recent logged</div>
        </div>

        <div className="p-4 rounded-2xl glass-card">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Trusted Devices</span>
            <KeyRound className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">{kpis?.trustedDevices ?? 0}</div>
          <div className="text-[11px] text-cyan-400 mt-1 font-mono">Verified hardware bindings</div>
        </div>

        <div className="p-4 rounded-2xl glass-card">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Security Events</span>
            <Laptop className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">{kpis?.securityEvents ?? 0}</div>
          <div className="text-[11px] text-indigo-400 mt-1 font-mono">Auth & device logs</div>
        </div>

        <div className="p-4 rounded-2xl glass-card">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Pending Deletions</span>
            <UserX className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono mt-2">{kpis?.pendingDeletions ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">{deletions.length} total requests</div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800/80 rounded-2xl overflow-x-auto">
          {(
            [
              { id: 'sessions', label: `Active & Recent Sessions (${sessions.length})` },
              { id: 'logs', label: `Security Event Logs (${securityLogs.length})` },
              { id: 'trusted', label: `Trusted Devices (${trustedDevices.length})` },
              { id: 'deletions', label: `Account Deletions (${deletions.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter user, IP, event, device..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-2xl glass-input text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* TAB 1: SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="rounded-3xl glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Device & Platform</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Started / Last Active</th>
                  <th className="py-3 px-4 text-right">Session Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No sessions matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onInspectUserById(s.user_id)}
                          className="font-bold text-white hover:text-cyan-300 cursor-pointer"
                        >
                          @{s.username || s.user_id.slice(0, 8)}
                        </button>
                        <div className="text-[10px] font-mono text-slate-400">{s.email || s.user_id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-semibold">{s.device_name || s.device_id || 'Unknown Device'}</div>
                        <div className="text-[10px] font-mono text-cyan-400 uppercase">
                          {s.platform || 'unknown'} {s.app_version ? `• v${s.app_version}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300">{s.ip_address || '—'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                            s.is_active
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {s.is_active ? 'Active' : 'Ended'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {new Date(s.last_active_at || s.started_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => onInspectUserById(s.user_id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> Dossier
                        </button>
                        {s.is_active && (
                          <>
                            <button
                              onClick={() => handleRevokeSession(s.id)}
                              disabled={busyId === s.id}
                              className="px-2.5 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-700/50 text-amber-300 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                            >
                              Revoke
                            </button>
                            <button
                              onClick={() => handleRevokeAllUserSessions(s.user_id, s.username)}
                              disabled={busyId === s.user_id}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-700/50 text-rose-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              <LogOut className="w-3 h-3" /> Force Sign-Out All
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY EVENT LOGS */}
      {activeTab === 'logs' && (
        <div className="rounded-3xl glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Platform / IP</th>
                  <th className="py-3 px-4">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No security logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onInspectUserById(log.user_id)}
                          className="font-bold text-cyan-300 hover:underline cursor-pointer"
                        >
                          @{log.username || log.user_id.slice(0, 8)}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white">{log.event_type}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase border ${
                            log.status === 'success'
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'
                              : 'bg-rose-950/70 text-rose-300 border-rose-700/50'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                        {log.platform || '—'} {log.ip_address ? `• ${log.ip_address}` : ''}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 max-w-xs truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TRUSTED DEVICES */}
      {activeTab === 'trusted' && (
        <div className="rounded-3xl glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Device Name / ID</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Trust State</th>
                  <th className="py-3 px-4">Last Authenticated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredTrusted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No trusted devices logged.
                    </td>
                  </tr>
                ) : (
                  filteredTrusted.map((td) => (
                    <tr key={td.id} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onInspectUserById(td.user_id)}
                          className="font-bold text-cyan-300 hover:underline cursor-pointer"
                        >
                          @{td.username || td.user_id.slice(0, 8)}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        <div className="font-semibold">{td.device_name || 'Trusted Device'}</div>
                        <div className="text-[10px] font-mono text-slate-400">{td.device_id || td.id}</div>
                      </td>
                      <td className="py-3 px-4 font-mono uppercase text-cyan-300">{td.platform || '—'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                            td.is_trusted
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {td.is_trusted ? 'Trusted' : 'Revoked'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {new Date(td.last_authenticated_at || td.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ACCOUNT DELETIONS */}
      {activeTab === 'deletions' && (
        <div className="rounded-3xl glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Action Type</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Requested At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredDeletions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No account deletion or deactivation requests recorded.
                    </td>
                  </tr>
                ) : (
                  filteredDeletions.map((del) => (
                    <tr key={del.id} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onInspectUserById(del.user_id)}
                          className="font-bold text-cyan-300 hover:underline cursor-pointer"
                        >
                          @{del.username || del.user_id.slice(0, 8)}
                        </button>
                        <div className="text-[10px] font-mono text-slate-400">{del.email || del.user_id}</div>
                      </td>
                      <td className="py-3 px-4 font-mono uppercase text-amber-300 font-bold">{del.action_type}</td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs truncate">{del.reason || '—'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase border ${
                            del.status === 'completed'
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'
                              : del.status === 'cancelled'
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-rose-950/70 text-rose-300 border-rose-700/50'
                          }`}
                        >
                          {del.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {new Date(del.requested_at || del.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {del.status !== 'completed' && (
                          <button
                            onClick={() => handleUpdateDeletion(del.id, 'completed')}
                            disabled={busyId === del.id}
                            className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            Mark Completed
                          </button>
                        )}
                        {del.status !== 'cancelled' && (
                          <button
                            onClick={() => handleUpdateDeletion(del.id, 'cancelled')}
                            disabled={busyId === del.id}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                          >
                            Cancel
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
      )}
    </div>
  );
}

