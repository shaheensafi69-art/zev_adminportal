'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Smartphone,
  Send,
  Radio,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Power,
  ShieldCheck,
  Sparkles,
  Users,
  Eye,
} from 'lucide-react';
import { UserDeviceRecord, PushDeliveryRecord } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface PushNotificationsViewProps {
  onInspectUserById: (userId: string) => void;
}

interface PushKPIs {
  activeDevices: number;
  androidDevices: number;
  iosDevices: number;
  activePushSubs: number;
  sentTotal: number;
  failedTotal: number;
  totalNotifications: number;
  fcmConfigured: boolean;
}

export function PushNotificationsView({ onInspectUserById }: PushNotificationsViewProps) {
  const [activeTab, setActiveTab] = useState<'compose' | 'devices' | 'deliveries'>('compose');
  const [kpis, setKpis] = useState<PushKPIs | null>(null);
  const [devices, setDevices] = useState<UserDeviceRecord[]>([]);
  const [deliveries, setDeliveries] = useState<PushDeliveryRecord[]>([]);
  const [recentSystemNotifs, setRecentSystemNotifs] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Direct Push Composer
  const [mode, setMode] = useState<'single' | 'broadcast'>('single');
  const [targetUser, setTargetUser] = useState('');
  const [segment, setSegment] = useState<'active_devices' | 'verified' | 'all_profiles'>('active_devices');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [deepLink, setDeepLink] = useState('/notifications');
  const [sending, setSending] = useState(false);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 5000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notifications');
      const data = await res.json();
      if (data.success) {
        setKpis(data.kpis || null);
        setDevices(data.devices || []);
        setDeliveries(data.deliveries || []);
        setRecentSystemNotifs(data.recentSystemNotifications || []);
      } else {
        showFeedback(data.error || 'Failed to load push telemetry', 'error');
      }
    } catch {
      showFeedback('Network error loading push notifications telemetry', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/notifications');
        const data = await res.json();
        if (!cancelled && data.success) {
          setKpis(data.kpis || null);
          setDevices(data.devices || []);
          setDeliveries(data.deliveries || []);
          setRecentSystemNotifs(data.recentSystemNotifications || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showFeedback('Title and message body are required', 'error');
      return;
    }
    if (mode === 'single' && !targetUser.trim()) {
      showFeedback('Recipient username or UUID is required', 'error');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'single'
            ? { action: 'SEND_USER_PUSH', usernameOrId: targetUser.trim(), title, message, deepLink }
            : { action: 'BROADCAST_ANNOUNCEMENT', segment, title, message, deepLink }
        ),
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(data.message || 'Push dispatched', 'success');
        setTitle('');
        setMessage('');
        await fetchData();
      } else {
        showFeedback(data.error || 'Failed to dispatch notification', 'error');
      }
    } catch {
      showFeedback('Failed to dispatch notification', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleToggleDevice = async (deviceId: string, nextActive: boolean) => {
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_DEVICE_STATUS', deviceId, isActive: nextActive }),
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(data.message);
        setDevices((prev) => prev.map((d) => (d.id === deviceId ? { ...d, is_active: nextActive } : d)));
      } else {
        showFeedback(data.error || 'Device update failed', 'error');
      }
    } catch {
      showFeedback('Network error updating device', 'error');
    }
  };

  const q = search.trim().toLowerCase();
  const filteredDevices = devices.filter((d) =>
    !q ||
    `${d.username || ''} ${d.email || ''} ${d.device_name || ''} ${d.platform || ''} ${d.user_id}`
      .toLowerCase()
      .includes(q)
  );
  const filteredDeliveries = deliveries.filter((d) =>
    !q ||
    `${d.username || ''} ${d.email || ''} ${d.notification_type || ''} ${d.status} ${d.error_message || ''}`
      .toLowerCase()
      .includes(q)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl glass-panel">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <span>Push Notifications & FCM Devices</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                  kpis?.fcmConfigured
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'
                    : 'bg-amber-950/70 text-amber-300 border-amber-700/50'
                }`}
              >
                {kpis?.fcmConfigured ? 'FCM HTTP v1 Live' : 'Proxy Fallback'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Monitor registered `user_devices`, track `notification_deliveries`, and broadcast live FCM push alerts
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="glass-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
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
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl glass-card">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Active FCM Devices</span>
            <Smartphone className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">{kpis?.activeDevices ?? '—'}</div>
          <div className="text-[11px] text-cyan-400 mt-1 font-mono">
            {kpis?.androidDevices ?? 0} Android • {kpis?.iosDevices ?? 0} iOS
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Push Deliveries Sent</span>
            <Send className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-2">{kpis?.sentTotal ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {kpis?.failedTotal ?? 0} failed / stale tokens
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Push Subscriptions</span>
            <Radio className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">{kpis?.activePushSubs ?? 0}</div>
          <div className="text-[11px] text-indigo-400 mt-1 font-mono">Synced Legacy/Web Tokens</div>
        </div>

        <div className="p-4 rounded-2xl glass-card">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Total User Notifications</span>
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">{kpis?.totalNotifications ?? 0}</div>
          <div className="text-[11px] text-amber-400 mt-1 font-mono">In-App Inbox Rows</div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800/80 rounded-2xl w-full sm:w-auto">
          {(
            [
              { id: 'compose', label: 'Dispatch Push & Broadcast' },
              { id: 'devices', label: `Registered Devices (${devices.length})` },
              { id: 'deliveries', label: `Delivery Telemetry (${deliveries.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab !== 'compose' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user, device, platform..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-2xl glass-input text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* TAB 1: COMPOSE PUSH / BROADCAST */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleSendPush} className="lg:col-span-2 p-6 rounded-3xl glass-panel space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-cyan-400" />
                  <span>Push Notification Dispatcher (FCM + In-App)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Creates persistent notification inbox entries and immediately fires HTTP v1 FCM push to active devices
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    mode === 'single' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
                  }`}
                >
                  Single User
                </button>
                <button
                  type="button"
                  onClick={() => setMode('broadcast')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    mode === 'broadcast' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400'
                  }`}
                >
                  Broadcast
                </button>
              </div>
            </div>

            {mode === 'single' ? (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Recipient Username or UUID
                </label>
                <input
                  type="text"
                  placeholder="e.g. shaheen or 90a9fbf8-..."
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl glass-input text-xs text-white font-mono focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Audience Segment</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'active_devices', label: 'Active Push Devices', desc: 'Users with registered tokens', icon: Smartphone },
                    { id: 'verified', label: 'Verified Blue Badges', desc: 'Verified creators only', icon: Sparkles },
                    { id: 'all_profiles', label: 'All ZEV Accounts', desc: 'In-app + FCM broadcast', icon: Users },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const active = segment === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSegment(opt.id as typeof segment)}
                        className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                          active
                            ? 'bg-indigo-500/15 border-indigo-500/50 text-white'
                            : 'bg-white/[0.02] border-white/[0.08] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <Icon className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{opt.label}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Notification Title</label>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="e.g. ZEV App Update Live"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl glass-input text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Deep Link Route</label>
                <input
                  type="text"
                  placeholder="/notifications"
                  value={deepLink}
                  onChange={(e) => setDeepLink(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl glass-input text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Message Body</label>
              <textarea
                rows={4}
                maxLength={500}
                placeholder="Write a clear notification message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-input text-xs text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="glass-btn-primary px-6 py-3 rounded-2xl text-xs font-extrabold text-white flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Dispatching Notification...' : mode === 'single' ? 'Send Push Notification' : 'Send System Broadcast'}</span>
            </button>
          </form>

          {/* Recent System Notifications */}
          <div className="p-6 rounded-3xl glass-panel space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Recent System Alerts</span>
            </h3>
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {recentSystemNotifs.length === 0 ? (
                <div className="text-xs text-slate-500 py-8 text-center">No recent system alerts logged.</div>
              ) : (
                recentSystemNotifs.slice(0, 15).map((n) => (
                  <div key={String(n.id)} className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white truncate">{String(n.title || '')}</span>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[9px] font-mono uppercase">
                        {String(n.notification_type || 'system')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{String(n.message || '')}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                      <span>@{String(n.username || String(n.user_id || '').slice(0, 8))}</span>
                      <span>{n.created_at ? new Date(String(n.created_at)).toLocaleString() : ''}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REGISTERED DEVICES */}
      {activeTab === 'devices' && (
        <div className="rounded-3xl glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Platform & Device</th>
                  <th className="py-3 px-4">FCM Token</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Seen</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredDevices.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.03]">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onInspectUserById(d.user_id)}
                        className="text-left hover:text-cyan-300 cursor-pointer flex items-center gap-1.5 font-bold text-white"
                      >
                        <span>@{d.username || d.user_id.slice(0, 8)}</span>
                        {d.is_verified && <VerifiedBadge size="sm" />}
                      </button>
                      <div className="text-[10px] text-slate-400 font-mono">{d.email || d.user_id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-cyan-300 font-mono uppercase text-[10px] font-bold">
                        {d.platform}
                      </span>
                      <div className="text-[11px] text-slate-300 mt-1">
                        {d.device_name || d.device_id} {d.app_version ? `• v${d.app_version}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {d.fcm_token ? `${d.fcm_token.slice(0, 16)}...${d.fcm_token.slice(-8)}` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                          d.is_active
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {d.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : new Date(d.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => onInspectUserById(d.user_id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Dossier
                      </button>
                      <button
                        onClick={() => handleToggleDevice(d.id, !d.is_active)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                          d.is_active
                            ? 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/50'
                            : 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/50'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        {d.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DELIVERY TELEMETRY */}
      {activeTab === 'deliveries' && (
        <div className="rounded-3xl glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Targeted / Sent / Failed</th>
                  <th className="py-3 px-4">Error Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredDeliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-white/[0.03]">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {new Date(del.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onInspectUserById(del.user_id)}
                        className="font-bold text-cyan-300 hover:underline cursor-pointer"
                      >
                        @{del.username || del.user_id.slice(0, 8)}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{del.notification_type}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase border ${
                          del.status === 'sent'
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'
                            : 'bg-rose-950/70 text-rose-300 border-rose-700/50'
                        }`}
                      >
                        {del.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="text-slate-300">{del.tokens_targeted}</span> /{' '}
                      <span className="text-emerald-400 font-bold">{del.sent_count}</span> /{' '}
                      <span className="text-rose-400">{del.failed_count}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-rose-300 max-w-xs truncate">
                      {del.error_message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

