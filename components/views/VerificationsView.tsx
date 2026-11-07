'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, CheckCircle, Search, RefreshCw, Eye, ShieldCheck, UserCheck, XCircle 
} from 'lucide-react';
import { AdminUser } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface VerificationsViewProps {
  onInspectUser: (user: AdminUser) => void;
  onOpenBlueTick: (user: AdminUser) => void;
}

export function VerificationsView({ onInspectUser, onOpenBlueTick }: VerificationsViewProps) {
  const [verifiedUsers, setVerifiedUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchVerified = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users?tab=verified&limit=100');
      const data = await res.json();
      if (data.success) {
        setVerifiedUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load verified users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerified();
  }, []);

  const filtered = verifiedUsers.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.first_name || '').toLowerCase().includes(q) ||
      (u.last_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
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
              Manage verified blue badges, accreditation records, and public trust indicators
            </p>
          </div>
        </div>

        <button
          onClick={fetchVerified}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search verified creators, influencers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <span className="text-xs font-mono text-cyan-400 font-semibold hidden sm:inline-block">
          {filtered.length} Officially Verified
        </span>
      </div>

      {/* Grid of Verified Accounts */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Loading verified accounts...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center text-slate-400 text-sm bg-slate-950/40 rounded-3xl border border-slate-800">
          <CheckCircle className="w-8 h-8 text-blue-400 mx-auto mb-2 opacity-80" />
          <p className="font-semibold text-slate-200">No verified users found matching search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((u) => {
            const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
            const reason = u.verification_info?.verification_reason || 'Official Accreditation';
            const label = u.verification_info?.badge_label || 'Verified Creator';

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
                          <img src={u.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm flex items-center gap-1.5 truncate">
                          <span className="truncate">{name}</span>
                          <VerifiedBadge size="md" />
                        </div>
                        <div className="text-xs text-cyan-400 font-mono truncate">
                          @{u.username || 'user'}
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800/60 uppercase shrink-0">
                      {label}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs space-y-1">
                    <div className="text-[11px] text-slate-400 font-semibold">Accreditation Reason:</div>
                    <div className="text-slate-200 text-xs italic">{reason}</div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>{u.posts_count || 0} Posts</span>
                    <span>{u.reels_count || 0} Reels</span>
                    <span>{u.followers_count || 0} Followers</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onInspectUser(u)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>0-100 Dossier</span>
                  </button>

                  <button
                    onClick={() => onOpenBlueTick(u)}
                    className="py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Manage or Revoke Badge"
                  >
                    <span>Manage</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
