'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, CheckCircle, Search, RefreshCw, Eye, ShieldCheck, UserCheck, XCircle, Clock, Check, Phone
} from 'lucide-react';
import { AdminUser } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface VerificationsViewProps {
  onInspectUser: (user: AdminUser) => void;
  onOpenBlueTick: (user: AdminUser) => void;
}

export function VerificationsView({ onInspectUser, onOpenBlueTick }: VerificationsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'verified' | 'pending'>('verified');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const tabParam = activeSubTab === 'verified' ? 'verified' : 'pending_verification';
      const res = await fetch(`/api/admin/users?tab=${tabParam}&limit=100`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load users for verifications view:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [activeSubTab]);

  const handleApprove = async (user: AdminUser) => {
    setActionLoadingId(user.id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_VERIFICATION',
          userId: user.id,
          payload: {
            isVerified: true,
            badgeLabel: 'Verified Creator',
            reason: user.verification_info?.verification_reason || 'Approved ZEV Blue Request',
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (user: AdminUser) => {
    setActionLoadingId(user.id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_VERIFICATION',
          userId: user.id,
          payload: {
            isVerified: false,
            reason: 'Verification request rejected',
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.first_name || '').toLowerCase().includes(q) ||
      (u.last_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone_number || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-950/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">ZEV Official Verification Center</h2>
            <p className="text-xs text-slate-400">
              Manage verified blue badges, accreditation requests, and 100-referral milestones
            </p>
          </div>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Sub Tabs: Verified vs Pending */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800 max-w-md">
        <button
          onClick={() => setActiveSubTab('verified')}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'verified'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Active Blue Badges</span>
        </button>

        <button
          onClick={() => setActiveSubTab('pending')}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'pending'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Requests</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={activeSubTab === 'verified' ? "Search verified creators..." : "Search pending requests..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <span className="text-xs font-mono text-cyan-400 font-semibold hidden sm:inline-block">
          {filtered.length} {activeSubTab === 'verified' ? 'Active Verified' : 'Pending Review'}
        </span>
      </div>

      {/* Grid of Accounts */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Loading {activeSubTab === 'verified' ? 'verified accounts' : 'verification requests'}...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center text-slate-400 text-sm bg-slate-950/40 rounded-3xl border border-slate-800">
          <CheckCircle className="w-8 h-8 text-blue-400 mx-auto mb-2 opacity-80" />
          <p className="font-semibold text-slate-200">
            {activeSubTab === 'verified' ? 'No verified users found' : 'No pending verification requests at this moment'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((u) => {
            const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
            const reason = u.verification_info?.verification_reason || 'Official Accreditation';
            const label = u.verification_info?.badge_label || (activeSubTab === 'verified' ? 'Verified Creator' : 'Pending Request');

            return (
              <div
                key={u.id}
                className="p-5 rounded-3xl bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-sm shrink-0 overflow-hidden">
                        {u.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm flex items-center gap-1.5 truncate">
                          <span className="truncate">{name}</span>
                          {u.is_verified && <VerifiedBadge size="md" />}
                        </div>
                        <div className="text-xs text-cyan-400 font-mono truncate">
                          @{u.username || 'user'}
                        </div>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border uppercase shrink-0 ${
                      activeSubTab === 'verified'
                        ? 'bg-blue-950/80 text-blue-300 border-blue-800/60'
                        : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                    }`}>
                      {label}
                    </span>
                  </div>

                  {/* Details box */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs space-y-1.5">
                    <div className="text-[11px] text-slate-400 font-semibold">
                      {activeSubTab === 'verified' ? 'Accreditation Reason:' : 'Request Details & Order:'}
                    </div>
                    <div className="text-slate-200 text-xs leading-relaxed break-words">{reason}</div>

                    {u.phone_number && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono pt-1">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{u.phone_number}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>{u.posts_count || 0} Posts</span>
                    <span>{u.reels_count || 0} Reels</span>
                    <span>{u.followers_count || 0} Followers</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onInspectUser(u)}
                    className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Dossier</span>
                  </button>

                  {activeSubTab === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(u)}
                        disabled={actionLoadingId === u.id}
                        className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-900/40"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleReject(u)}
                        disabled={actionLoadingId === u.id}
                        className="py-2 px-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onOpenBlueTick(u)}
                      className="py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Manage or Revoke Badge"
                    >
                      <span>Manage</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
