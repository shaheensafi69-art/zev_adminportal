'use client';

import React, { useState, useEffect } from 'react';
import { 
  Share2, Trophy, Sparkles, Users, RefreshCw, Eye, 
  ArrowRight, CheckCircle2, TrendingUp, Search, Award
} from 'lucide-react';
import { VerifiedBadge } from '../VerifiedBadge';

interface LeaderboardUser {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  referral_code?: string;
  referral_count: number;
  is_verified?: boolean;
  created_at: string;
}

interface ReferralStreamItem {
  id: string;
  referral_code: string;
  status: string;
  created_at: string;
  referrer_id: string;
  referee_id: string;
  referrer_username?: string;
  referrer_first_name?: string;
  referrer_last_name?: string;
  referrer_avatar_url?: string;
  referee_username?: string;
  referee_first_name?: string;
  referee_last_name?: string;
  referee_avatar_url?: string;
}

export function ReferralsView({ onInspectUserById }: { onInspectUserById: (id: string) => void }) {
  const [totalReferrals, setTotalReferrals] = useState<number>(0);
  const [eligibleEarners, setEligibleEarners] = useState<LeaderboardUser[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [recentReferrals, setRecentReferrals] = useState<ReferralStreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'stream' | 'milestones'>('leaderboard');
  const [search, setSearch] = useState('');

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/referrals');
      const data = await res.json();
      if (data.success) {
        setTotalReferrals(data.totalReferrals || 0);
        setEligibleEarners(data.eligibleEarners || []);
        setLeaderboard(data.leaderboard || []);
        setRecentReferrals(data.recentReferrals || []);
      }
    } catch (err) {
      console.error('Failed to load referral data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, []);

  const filteredLeaderboard = leaderboard.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.first_name || '').toLowerCase().includes(q) ||
      (u.last_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.referral_code || '').toLowerCase().includes(q)
    );
  });

  const filteredStream = recentReferrals.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.referrer_username || '').toLowerCase().includes(q) ||
      (r.referrer_first_name || '').toLowerCase().includes(q) ||
      (r.referee_username || '').toLowerCase().includes(q) ||
      (r.referee_first_name || '').toLowerCase().includes(q) ||
      (r.referral_code || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-950/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Referral Ecosystem & Network Growth
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Viral Growth
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Track peer invitations, viral leaderboard rankings, and 100-referral milestone achievers
            </p>
          </div>
        </div>

        <button
          onClick={fetchReferralData}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-2 transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Referrals */}
        <div className="p-5 rounded-3xl bg-slate-950/40 border border-slate-800/80 backdrop-blur-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Total Network Invites</div>
            <div className="text-3xl font-black text-white mt-1 flex items-baseline gap-2">
              {totalReferrals}
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> +Viral
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Total accepted peer registrations</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Milestone Earners (>= 100) */}
        <div className="p-5 rounded-3xl bg-slate-950/40 border border-slate-800/80 backdrop-blur-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">100-Milestone VIPs</div>
            <div className="text-3xl font-black text-amber-300 mt-1 flex items-baseline gap-2">
              {eligibleEarners.length}
              <span className="text-xs text-amber-400 font-mono">Free Blue</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Users qualified for lifetime free verification</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        {/* Top Referrers */}
        <div className="p-5 rounded-3xl bg-slate-950/40 border border-slate-800/80 backdrop-blur-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Active Referrers</div>
            <div className="text-3xl font-black text-cyan-300 mt-1">
              {leaderboard.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Users actively sharing referral links</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Trophy className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/60 border border-slate-800">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'leaderboard'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Leaderboard ({leaderboard.length})
          </button>
          <button
            onClick={() => setActiveTab('stream')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'stream'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            Live Stream ({recentReferrals.length})
          </button>
          <button
            onClick={() => setActiveTab('milestones')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'milestones'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            100+ Club ({eligibleEarners.length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users or codes..."
            className="pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="rounded-3xl bg-slate-950/40 border border-slate-800/80 overflow-hidden backdrop-blur-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
            <span className="text-xs">Loading referral metrics from database...</span>
          </div>
        ) : activeTab === 'leaderboard' ? (
          /* LEADERBOARD VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/30 text-slate-400 font-mono text-[11px] uppercase">
                  <th className="py-3.5 px-4 w-12 text-center">Rank</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4 font-mono">Referral Code</th>
                  <th className="py-3.5 px-4">Invited Users</th>
                  <th className="py-3.5 px-4">Milestone Progress</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredLeaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No referral records found
                    </td>
                  </tr>
                ) : (
                  filteredLeaderboard.map((user, idx) => {
                    const percent = Math.min(100, Math.round((user.referral_count / 100) * 100));
                    const isMilestoneHit = user.referral_count >= 100;

                    return (
                      <tr key={user.id} className="hover:bg-slate-900/40 transition">
                        <td className="py-3 px-4 text-center">
                          {idx === 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                              🥇
                            </span>
                          ) : idx === 1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-400/20 text-slate-200 font-bold border border-slate-400/40">
                              🥈
                            </span>
                          ) : idx === 2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-700/20 text-amber-600 font-bold border border-amber-700/40">
                              🥉
                            </span>
                          ) : (
                            <span className="font-mono text-slate-400 font-bold">#{idx + 1}</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-bold text-white text-xs uppercase">
                                  {(user.first_name || user.username || 'U')[0]}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-white flex items-center gap-1.5 truncate">
                                <span>{user.first_name ? `${user.first_name} ${user.last_name || ''}` : user.username || 'Anonymous'}</span>
                                {user.is_verified && <VerifiedBadge size="sm" />}
                              </div>
                              <div className="text-slate-400 text-[11px] truncate">
                                @{user.username || 'user'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 font-bold select-all">
                            {user.referral_code || 'N/A'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-base text-white">
                            {user.referral_count}
                          </span>
                          <span className="text-slate-400 text-xs ml-1">friends</span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="w-44 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className={isMilestoneHit ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                                {user.referral_count} / 100
                              </span>
                              <span className={isMilestoneHit ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                                {percent}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full transition-all rounded-full ${
                                  isMilestoneHit
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                                    : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            {isMilestoneHit && (
                              <div className="text-[10px] text-amber-300 font-semibold flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> Lifetime Blue Eligible
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onInspectUserById(user.id)}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition text-xs font-medium cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            Inspect Profile
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'stream' ? (
          /* LIVE REFERRAL STREAM */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/30 text-slate-400 font-mono text-[11px] uppercase">
                  <th className="py-3.5 px-4">Referrer (Invited by)</th>
                  <th className="py-3.5 px-4 text-center"></th>
                  <th className="py-3.5 px-4">Referee (Joined user)</th>
                  <th className="py-3.5 px-4 font-mono">Code Used</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Joined At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredStream.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No referral invite stream found
                    </td>
                  </tr>
                ) : (
                  filteredStream.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                            {item.referrer_avatar_url ? (
                              <img src={item.referrer_avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-bold text-white text-[10px]">
                                {(item.referrer_username || 'R')[0]}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white">
                              {item.referrer_first_name || item.referrer_username || 'User'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              @{item.referrer_username || 'user'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center text-slate-500">
                        <ArrowRight className="w-4 h-4 mx-auto text-cyan-400" />
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                            {item.referee_avatar_url ? (
                              <img src={item.referee_avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-bold text-white text-[10px]">
                                {(item.referee_username || 'J')[0]}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white">
                              {item.referee_first_name || item.referee_username || 'New Member'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              @{item.referee_username || 'member'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-cyan-400 font-bold">
                        {item.referral_code}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Completed
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right text-slate-400 font-mono text-[11px]">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* 100+ CLUB / MILESTONE ACHIEVERS */
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {eligibleEarners.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500">
                  No users have reached the 100 referrals milestone yet.
                </div>
              ) : (
                eligibleEarners.map((user) => (
                  <div
                    key={user.id}
                    className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-950 border border-amber-500/30 flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 overflow-hidden flex items-center justify-center">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-amber-300 text-lg">
                              {(user.first_name || user.username || 'U')[0]}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {user.first_name ? `${user.first_name} ${user.last_name || ''}` : user.username}
                            <VerifiedBadge size="sm" />
                          </div>
                          <div className="text-xs text-slate-400">@{user.username}</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> VIP EARNER
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Referral Count</div>
                        <div className="text-xl font-black text-amber-300">{user.referral_count} Friends</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Invite Code</div>
                        <div className="text-xs font-mono font-bold text-cyan-300">{user.referral_code}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => onInspectUserById(user.id)}
                      className="w-full py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect User & Grants
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
