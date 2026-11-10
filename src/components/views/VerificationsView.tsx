'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, CheckCircle, Search, RefreshCw, Eye, ShieldCheck,
  Clock, Check, Phone, Calendar, Trophy, AlertTriangle,
  Copy, Sliders, ArrowUpRight, Flame, Crown, ShieldAlert,
  UserCheck, XCircle
} from 'lucide-react';
import { AdminUser, VerificationKPIs, VerificationRecord, ReferralLeader } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface VerificationsViewProps {
  onInspectUser: (user: AdminUser) => void;
  onOpenBlueTick: (user: AdminUser) => void;
}

type TabType = 'all' | 'monthly' | 'yearly' | 'lifetime' | 'referrals' | 'expired';

export function VerificationsView({ onInspectUser, onOpenBlueTick }: VerificationsViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [kpis, setKpis] = useState<VerificationKPIs | null>(null);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [referralLeaderboard, setReferralLeaderboard] = useState<ReferralLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/verifications?tab=${activeTab}`);
      const data = await res.json();
      if (data.success) {
        setKpis(data.kpis);
        setVerifications(data.verifications || []);
        setReferralLeaderboard(data.referralLeaderboard || []);
      } else {
        showToast(data.error || 'Failed to fetch verification data', 'error');
      }
    } catch (err) {
      console.error('Failed to load verification center:', err);
      showToast('Network error loading verification data', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Automated Expiration Sweep
  const handleSyncExpired = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYNC_EXPIRED' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Expired subscriptions synchronized', 'success');
        fetchData();
      } else {
        showToast(data.error || 'Sync failed', 'error');
      }
    } catch (err) {
      console.error('Failed to sync expired:', err);
      showToast('Failed to trigger expiration sweep', 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  // Instant Revoke
  const handleRevoke = async (record: VerificationRecord) => {
    const confirmRevoke = window.confirm(
      `Are you sure you want to revoke the Blue Badge for @${record.username || record.email}?`
    );
    if (!confirmRevoke) return;

    setActionLoadingId(record.user_id);
    try {
      const res = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REVOKE_SUBSCRIPTION',
          userId: record.user_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Revoked blue badge for @${record.username || 'user'}`, 'info');
        fetchData();
      } else {
        showToast(data.error || 'Revocation failed', 'error');
      }
    } catch (err) {
      console.error('Revocation error:', err);
      showToast('Error revoking subscription', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Grant Lifetime to Referral Legend
  const handleGrantReferralLifetime = async (leader: ReferralLeader) => {
    setActionLoadingId(leader.user_id);
    try {
      const res = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GRANT_SUBSCRIPTION',
          userId: leader.user_id,
          payload: {
            isVerified: true,
            planType: 'lifetime_referral',
            badgeLabel: '100-Referrals Legend',
            reason: `Qualified with ${leader.referral_count} invites through personal referral code @${leader.referral_code}`,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`⭐ Lifetime Blue Badge granted to @${leader.username}!`, 'success');
        fetchData();
      } else {
        showToast(data.error || 'Grant failed', 'error');
      }
    } catch (err) {
      console.error('Grant referral lifetime error:', err);
      showToast('Error granting badge', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Manual Referral Count Adjustment
  const handleAdjustReferralCount = async (leader: ReferralLeader) => {
    const input = window.prompt(
      `Adjust total referrals for @${leader.username} (Current: ${leader.referral_count}):`,
      leader.referral_count.toString()
    );
    if (input === null) return;
    const newCount = parseInt(input, 10);
    if (isNaN(newCount) || newCount < 0) {
      alert('Please enter a valid positive number');
      return;
    }

    setActionLoadingId(leader.user_id);
    try {
      const res = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_REFERRAL_COUNT',
          userId: leader.user_id,
          payload: { referralCount: newCount },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Referral count updated for @${leader.username}`, 'success');
        fetchData();
      } else {
        showToast(data.error || 'Update failed', 'error');
      }
    } catch (err) {
      console.error('Update referral error:', err);
      showToast('Failed to adjust count', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filtered verifications list
  const filteredVerifications = verifications.filter((v) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (v.first_name || '').toLowerCase().includes(q) ||
      (v.last_name || '').toLowerCase().includes(q) ||
      (v.username || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.phone_number || '').toLowerCase().includes(q) ||
      (v.plan_type || '').toLowerCase().includes(q)
    );
  });

  // Filtered referral leaders list
  const filteredLeaders = referralLeaderboard.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (l.first_name || '').toLowerCase().includes(q) ||
      (l.last_name || '').toLowerCase().includes(q) ||
      (l.username || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.referral_code || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xl transition-all ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60 shadow-emerald-950/50'
            : toastMessage.type === 'info'
            ? 'bg-cyan-950/90 text-cyan-300 border-cyan-700/60 shadow-cyan-950/50'
            : 'bg-rose-950/90 text-rose-300 border-rose-700/60 shadow-rose-950/50'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-4 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-950/70 border border-slate-800 backdrop-blur-md shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/40">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                ZEV Verification & Referral Command
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 uppercase">
                Enterprise 2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Dual-system badge management: Monthly, Annual, Lifetime, and 100-Referral milestones with automated expiration sweeps
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
          {/* Sync Expired Button */}
          <button
            onClick={handleSyncExpired}
            disabled={syncLoading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-950/70 to-amber-950/70 hover:from-rose-900/80 hover:to-amber-900/80 border border-rose-800/60 text-xs font-bold text-rose-300 flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-950/30"
            title="Scan database and revoke subscriptions whose expiration date has passed"
          >
            <ShieldAlert className={`w-4 h-4 text-rose-400 ${syncLoading ? 'animate-spin' : ''}`} />
            <span>{syncLoading ? 'Sweeping Database...' : 'Sync & Revoke Expired'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Total Active Badges */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold">Active Badges</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">
            {kpis?.totalVerified ?? '-'}
          </div>
          <div className="text-[10px] text-cyan-400/80 mt-1">Live Verified Users</div>
        </div>

        {/* Monthly Subscribers */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold">Monthly (30D)</span>
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400 mt-2 font-mono">
            {kpis?.monthlyCount ?? '-'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Recurring 30-Day</div>
        </div>

        {/* Yearly Subscribers */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold">Annual (365D)</span>
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
            {kpis?.yearlyCount ?? '-'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Annual Tier</div>
        </div>

        {/* Lifetime Direct Badges */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold">Lifetime VIP</span>
            <Crown className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400 mt-2 font-mono">
            {kpis?.lifetimeCount ?? '-'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">No Expiration</div>
        </div>

        {/* 100-Referrals Legend Badges */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold">100+ Invites</span>
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2 font-mono">
            {kpis?.referralLegendsCount ?? '-'}
          </div>
          <div className="text-[10px] text-amber-400/80 mt-1">Referral Legends</div>
        </div>

        {/* Expired Badges */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold">Expired</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2 font-mono">
            {kpis?.expiredCount ?? '-'}
          </div>
          <div className="text-[10px] text-rose-400/80 mt-1">Auto Revoked</div>
        </div>

      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-950/90 rounded-2xl border border-slate-800 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Active Badges ({kpis?.totalVerified ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('referrals')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'referrals'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>100-Referrals Tracker ({referralLeaderboard.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'monthly'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Monthly ({kpis?.monthlyCount ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('yearly')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'yearly'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Annual ({kpis?.yearlyCount ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('lifetime')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'lifetime'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Lifetime ({kpis?.lifetimeCount ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('expired')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'expired'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Expired ({kpis?.expiredCount ?? 0})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search username, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

      </div>

      {/* Loading State */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-sm bg-slate-950/40 rounded-3xl border border-slate-800">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Synchronizing verification and subscription data...</span>
        </div>
      ) : activeTab === 'referrals' ? (
        /* ══════════════════════════════════════════════════════════════
           TAB 2: 100-REFERRALS TRACKER & LEADERBOARD
           ══════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-white">Rule: 100 Real Referrals = Permanent Lifetime Blue Badge</span>
                <p className="text-amber-300/80 text-[11px] mt-0.5">
                  Users who invite 100 active members unlock permanent lifetime blue tick eligibility with no monthly or annual fees.
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono font-bold text-white text-sm">{kpis?.totalReferrals || 0}</span>
              <span className="text-[11px] text-slate-400 block">Total Invites Tracked</span>
            </div>
          </div>

          {filteredLeaders.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-sm bg-slate-950/40 rounded-3xl border border-slate-800">
              <CheckCircle className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-200">No referral records match your query</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredLeaders.map((leader, idx) => {
                const fullName = [leader.first_name, leader.last_name].filter(Boolean).join(' ') || leader.email || leader.username || 'ZEV User';
                const isEligible = leader.is_eligible_for_lifetime;
                const percentage = Math.min(100, leader.progress_percentage || 0);

                return (
                  <div
                    key={leader.user_id}
                    className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 ${
                      isEligible 
                        ? 'bg-gradient-to-br from-amber-950/30 via-slate-950/80 to-slate-950 border-amber-600/40 shadow-lg shadow-amber-950/20' 
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700/80'
                    }`}
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-sm shrink-0 overflow-hidden">
                              {leader.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={leader.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                              ) : (
                                fullName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-black text-amber-400 flex items-center justify-center font-mono">
                              #{idx + 1}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="font-bold text-white text-sm flex items-center gap-1.5 truncate">
                              <span className="truncate">{fullName}</span>
                              {leader.is_currently_verified && <VerifiedBadge size="sm" />}
                            </div>
                            <div className="text-xs text-cyan-400 font-mono truncate">
                              @{leader.username}
                            </div>
                          </div>
                        </div>

                        {/* Status Chip */}
                        {isEligible ? (
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/50 uppercase flex items-center gap-1 shrink-0">
                            <Flame className="w-3 h-3 text-amber-400" />
                            100 Milestone!
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-800 uppercase shrink-0 font-mono">
                            {100 - leader.referral_count} to Lifetime
                          </span>
                        )}
                      </div>

                      {/* Referral Code Box */}
                      <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">Referral Code:</span>
                          <button
                            onClick={() => copyToClipboard(leader.referral_code)}
                            className="font-mono text-cyan-400 font-bold hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
                            title="Click to copy code"
                          >
                            <span>@{leader.referral_code}</span>
                            {copiedCode === leader.referral_code ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-500" />
                            )}
                          </button>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-300 font-bold">{leader.referral_count} / 100 Invited</span>
                            <span className={isEligible ? 'text-amber-400 font-black' : 'text-cyan-400 font-bold'}>
                              {percentage}%
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                isEligible 
                                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 shadow-[0_0_10px_#f59e0b]' 
                                  : 'bg-gradient-to-r from-cyan-500 to-blue-600'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Verification Status */}
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Current Badge:</span>
                        {leader.is_currently_verified ? (
                          <span className="font-bold text-cyan-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {leader.badge_plan === 'lifetime_referral' 
                              ? '100-Referrals Lifetime' 
                              : leader.badge_plan ? `${leader.badge_plan} Plan` : 'Active Verified'}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Not Verified Yet</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleAdjustReferralCount(leader)}
                          disabled={actionLoadingId === leader.user_id}
                          className="py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Manually adjust total referrals for this user"
                        >
                          <Sliders className="w-3 h-3 text-cyan-400" />
                          <span>Adjust</span>
                        </button>
                      </div>

                      {isEligible && !leader.is_currently_verified ? (
                        <button
                          onClick={() => handleGrantReferralLifetime(leader)}
                          disabled={actionLoadingId === leader.user_id}
                          className="py-1.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-900/40"
                        >
                          <Crown className="w-3.5 h-3.5" />
                          <span>Grant Lifetime Badge</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onOpenBlueTick({
                            id: leader.user_id,
                            email: leader.email,
                            email_confirmed: true,
                            email_confirmed_at: null,
                            first_name: leader.first_name,
                            last_name: leader.last_name,
                            username: leader.username,
                            phone_number: null,
                            country: null,
                            avatar_url: leader.avatar_url,
                            is_verified: leader.is_currently_verified,
                            is_online: false,
                            is_banned: false,
                            banned_until: null,
                            is_restricted: false,
                            restricted_until: null,
                            restriction_reason: null,
                            warning_count: 0,
                            last_warning_at: null,
                            last_warning_reason: null,
                            bio: null,
                            created_at: new Date().toISOString(),
                            last_seen: null,
                            posts_count: 0,
                            reels_count: 0,
                            followers_count: 0,
                            following_count: 0,
                            stories_count: 0,
                            referral_code: leader.referral_code,
                            referral_count: leader.referral_count,
                            lifetime_blue_eligible: leader.is_eligible_for_lifetime,
                          })}
                          className="py-1.5 px-3 rounded-xl bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/60 text-blue-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Manage Badge</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════
           TAB 1, 3, 4, 5, 6: VERIFICATIONS & SUBSCRIPTION CARDS
           ══════════════════════════════════════════════════════════════ */
        <div>
          {filteredVerifications.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-sm bg-slate-950/40 rounded-3xl border border-slate-800">
              <CheckCircle className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-200">
                {activeTab === 'expired' 
                  ? 'No expired subscriptions found in database' 
                  : 'No verified accounts match the selected filter'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredVerifications.map((v) => {
                const fullName = [v.first_name, v.last_name].filter(Boolean).join(' ') || v.email || v.username || 'ZEV User';
                const isLifetime = v.plan_type === 'lifetime' || v.plan_type === 'lifetime_referral';
                const isExpired = v.is_expired;
                const daysLeft = v.days_remaining;

                // Color badge for plan
                const planBadgeConfig = 
                  v.plan_type === 'monthly' ? { bg: 'bg-blue-950/80 text-blue-300 border-blue-800/60', label: 'Monthly (30D)' } :
                  v.plan_type === 'yearly' ? { bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60', label: 'Annual (365D)' } :
                  v.plan_type === 'lifetime_referral' ? { bg: 'bg-amber-950/80 text-amber-300 border-amber-800/60', label: '100-Invites Legend' } :
                  v.plan_type === 'lifetime' ? { bg: 'bg-purple-950/80 text-purple-300 border-purple-800/60', label: 'Lifetime VIP' } :
                  { bg: 'bg-slate-900 text-slate-300 border-slate-700', label: v.plan_type };

                return (
                  <div
                    key={v.id}
                    className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 ${
                      isExpired 
                        ? 'bg-rose-950/10 border-rose-900/40' 
                        : isLifetime 
                        ? 'bg-gradient-to-br from-purple-950/20 via-slate-950/80 to-slate-950 border-purple-800/40' 
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700/80'
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-sm shrink-0 overflow-hidden shadow-inner">
                            {v.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={v.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                              fullName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white text-sm flex items-center gap-1.5 truncate">
                              <span className="truncate">{fullName}</span>
                              {!isExpired && <VerifiedBadge size="sm" />}
                            </div>
                            <div className="text-xs text-cyan-400 font-mono truncate">
                              @{v.username || 'user'}
                            </div>
                          </div>
                        </div>

                        {/* Plan Tag */}
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border uppercase shrink-0 ${planBadgeConfig.bg}`}>
                          {planBadgeConfig.label}
                        </span>
                      </div>

                      {/* Expiration Details Box */}
                      <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Status & Expiration:</span>
                          {isExpired ? (
                            <span className="text-rose-400 font-black flex items-center gap-1 font-mono">
                              <XCircle className="w-3.5 h-3.5" />
                              Expired & Revoked
                            </span>
                          ) : isLifetime ? (
                            <span className="text-purple-300 font-black flex items-center gap-1 font-mono">
                              <Crown className="w-3.5 h-3.5 text-purple-400" />
                              Permanent (Never Expires)
                            </span>
                          ) : daysLeft !== null ? (
                            <span className={`font-mono font-bold flex items-center gap-1 ${
                              daysLeft <= 3 ? 'text-rose-400' : daysLeft <= 10 ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              <Clock className="w-3.5 h-3.5" />
                              {daysLeft} days remaining
                            </span>
                          ) : null}
                        </div>

                        {v.expires_at && (
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>Expiration Date:</span>
                            <span className="text-slate-200">
                              {new Date(v.expires_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        )}

                        {v.verification_reason && (
                          <div className="pt-1.5 border-t border-slate-800/80 text-[11px] text-slate-300 line-clamp-2">
                            <span className="text-slate-500">Note: </span>
                            {v.verification_reason}
                          </div>
                        )}
                      </div>

                      {/* Referral Milestone Pill */}
                      <div className="mt-3 flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/60">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-amber-400" />
                          Referrals:
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-white font-bold">{v.referral_count || 0} / 100</span>
                          {v.lifetime_blue_eligible && (
                            <span className="text-[10px] text-amber-400 font-bold">⭐ Legend</span>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                      <button
                        onClick={() => onInspectUser({
                          id: v.user_id,
                          email: v.email || '',
                          email_confirmed: true,
                          email_confirmed_at: null,
                          first_name: v.first_name,
                          last_name: v.last_name,
                          username: v.username,
                          phone_number: v.phone_number,
                          country: null,
                          avatar_url: v.avatar_url,
                          is_verified: !isExpired,
                          is_online: false,
                          is_banned: false,
                          banned_until: null,
                          is_restricted: false,
                          restricted_until: null,
                          restriction_reason: null,
                          warning_count: 0,
                          last_warning_at: null,
                          last_warning_reason: null,
                          bio: null,
                          created_at: v.verified_at || new Date().toISOString(),
                          last_seen: null,
                          posts_count: 0,
                          reels_count: 0,
                          followers_count: 0,
                          following_count: 0,
                          stories_count: 0,
                          referral_count: v.referral_count,
                          lifetime_blue_eligible: v.lifetime_blue_eligible,
                        })}
                        className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Dossier</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenBlueTick({
                            id: v.user_id,
                            email: v.email || '',
                            email_confirmed: true,
                            email_confirmed_at: null,
                            first_name: v.first_name,
                            last_name: v.last_name,
                            username: v.username,
                            phone_number: v.phone_number,
                            country: null,
                            avatar_url: v.avatar_url,
                            is_verified: !isExpired,
                            is_online: false,
                            is_banned: false,
                            banned_until: null,
                            is_restricted: false,
                            restricted_until: null,
                            restriction_reason: null,
                            warning_count: 0,
                            last_warning_at: null,
                            last_warning_reason: null,
                            bio: null,
                            created_at: v.verified_at || new Date().toISOString(),
                            last_seen: null,
                            posts_count: 0,
                            reels_count: 0,
                            followers_count: 0,
                            following_count: 0,
                            stories_count: 0,
                            referral_count: v.referral_count,
                            lifetime_blue_eligible: v.lifetime_blue_eligible,
                          })}
                          className="py-2 px-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isExpired ? 'Reactivate' : 'Change Tier'}</span>
                        </button>

                        {!isExpired && (
                          <button
                            onClick={() => handleRevoke(v)}
                            disabled={actionLoadingId === v.user_id}
                            className="py-2 px-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Instant Revocation"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
