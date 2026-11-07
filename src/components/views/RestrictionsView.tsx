'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, AlertTriangle, FileWarning, CheckCircle, 
  Clock, Eye, Ban, Search, ShieldCheck, RefreshCw 
} from 'lucide-react';
import { UserRestrictionRecord, AdminUser } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface RestrictionsViewProps {
  onInspectUserById: (userId: string) => void;
  onBanUser: (target: { id: string; email: string }) => void;
  onOpenRestrictModal: (user: AdminUser) => void;
}

export function RestrictionsView({
  onInspectUserById,
  onBanUser,
  onOpenRestrictModal,
}: RestrictionsViewProps) {
  const [restrictions, setRestrictions] = useState<UserRestrictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'lifted'>('active');
  const [search, setSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchRestrictions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/restrictions?status=${filter}`);
      const data = await res.json();
      if (data.success) {
        setRestrictions(data.restrictions || []);
      }
    } catch (err) {
      console.error('Failed to load restrictions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestrictions();
  }, [filter]);

  const handleLift = async (userId: string, recordId: string) => {
    setActionLoadingId(recordId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UNRESTRICT_USER', userId }),
      });
      const data = await res.json();
      if (data.success) {
        setRestrictions((prev) =>
          prev.map((r) => (r.id === recordId ? { ...r, status: 'lifted' } : r))
        );
      }
    } catch (err) {
      console.error('Failed to lift restriction:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredList = restrictions.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const email = r.email || r.user?.email || '';
    const username = r.username || r.user?.username || '';
    const firstName = r.first_name || r.user?.first_name || '';
    return (
      email.toLowerCase().includes(q) ||
      username.toLowerCase().includes(q) ||
      firstName.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl glass-panel">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Disciplinary Queue & Restricted Accounts</h2>
              <p className="text-xs text-slate-400">
                Progressive policy enforcement: Warning strikes, account restrictions, and suspension escalation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRestrictions}
            disabled={loading}
            className="glass-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.06] backdrop-blur-md rounded-2xl w-full sm:w-auto">
          {(['active', 'all', 'lifted'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                filter === t
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-md backdrop-blur-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t} Records
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by user or violation reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-2xl glass-input text-xs text-white placeholder-slate-400 focus:outline-none transition-all font-sans"
          />
        </div>
      </div>

      {/* Disciplinary Table */}
      <div className="overflow-hidden rounded-3xl glass-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.02] text-slate-400 font-mono uppercase text-[11px] border-b border-white/[0.08]">
              <tr>
                <th className="py-3.5 px-6">User Account</th>
                <th className="py-3.5 px-4">Action Type</th>
                <th className="py-3.5 px-4">Violation Reason & Evidence</th>
                <th className="py-3.5 px-4">Status & Duration</th>
                <th className="py-3.5 px-4">Enforced At</th>
                <th className="py-3.5 px-6 text-center">Enforcement Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading disciplinary records...</span>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-slate-200">No active restrictions or warnings</p>
                    <p className="text-xs text-slate-500 mt-1">Platform community guidelines are currently in good standing.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const name = [item.first_name || item.user?.first_name, item.last_name || item.user?.last_name].filter(Boolean).join(' ') || item.email || item.user?.email || 'User';
                  const email = item.email || item.user?.email || '';
                  const username = item.username || item.user?.username || 'user';
                  const avatar = item.avatar_url || item.user?.avatar_url;
                  const isVerified = Boolean(item.is_verified ?? item.user?.is_verified);
                  const isWarning = item.type === 'WARNING';
                  const isActive = item.status === 'active';

                  return (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                      {/* User Column */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs shrink-0 overflow-hidden">
                            {avatar ? (
                              <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                              name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{name}</span>
                              {isVerified && <VerifiedBadge size="sm" />}
                            </div>
                            <div className="text-[11px] text-cyan-400 font-mono">
                              @{username} • {email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action Type */}
                      <td className="py-4 px-4">
                        {isWarning ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <FileWarning className="w-3.5 h-3.5" />
                            <span>Warning (Strike #{item.warning_level})</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Restricted Account</span>
                          </div>
                        )}
                      </td>

                      {/* Violation & Evidence */}
                      <td className="py-4 px-4 max-w-xs">
                        <div className="font-semibold text-slate-200 text-xs">
                          {item.reason}
                        </div>
                        {item.details && (
                          <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                            {item.details}
                          </div>
                        )}
                      </td>

                      {/* Status & Duration */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider w-fit ${
                            isActive
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {item.status}
                          </span>
                          {item.expires_at ? (
                            <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Until {new Date(item.expires_at).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">
                              Indefinite / Permanent
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="py-4 px-4 font-mono text-[11px] text-slate-400">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onInspectUserById(item.user_id)}
                            className="glass-btn p-2 rounded-xl text-slate-300 hover:text-white cursor-pointer"
                            title="Inspect 0-100 Dossier"
                          >
                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          </button>

                          {isActive && !isWarning && (
                            <button
                              onClick={() => handleLift(item.user_id, item.id)}
                              disabled={actionLoadingId === item.id}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                              title="Lift restriction on this account"
                            >
                              Lift
                            </button>
                          )}

                          <button
                            onClick={() => onBanUser({ id: item.user_id, email: item.user?.email || 'User' })}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-colors cursor-pointer shadow-sm"
                            title="Escalate to Full Ban"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
