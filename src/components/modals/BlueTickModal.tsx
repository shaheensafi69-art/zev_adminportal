'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, Check, ShieldAlert, Calendar, Users, 
  Clock, Award, Gift, ArrowRight, RefreshCw, Zap
} from 'lucide-react';
import { AdminUser } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface BlueTickModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    userId: string,
    isVerified: boolean,
    badgeLabel: string,
    reason: string,
    planType: string,
    customDays?: number | null
  ) => Promise<void>;
}

export function BlueTickModal({ user, isOpen, onClose, onConfirm }: BlueTickModalProps) {
  const [planType, setPlanType] = useState<'monthly' | 'yearly' | 'lifetime' | 'lifetime_referral' | 'custom'>('monthly');
  const [customDays, setCustomDays] = useState<number>(60);
  const [badgeLabel, setBadgeLabel] = useState('Verified Official');
  const [reason, setReason] = useState('Official ZEV Blue Tick Accreditation');
  const [loading, setLoading] = useState(false);
  const [referralCount, setReferralCount] = useState<number>(0);
  const [updatingReferral, setUpdatingReferral] = useState(false);
  const [referralFeedback, setReferralFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const activePlan = (user.verification_info?.plan_type as any) || (user.lifetime_blue_eligible ? 'lifetime_referral' : 'monthly');
      setPlanType(activePlan);
      setBadgeLabel(user.verification_info?.badge_label || (user.is_verified ? 'Verified Official' : 'Verified Creator'));
      setReason(user.verification_info?.verification_reason || 'Official Accreditation by ZEV Admin Team');
      setReferralCount(user.referral_count || 0);
      setReferralFeedback(null);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const isCurrentlyVerified = user.is_verified;
  const progressPercent = Math.min(100, Math.round((referralCount / 100) * 100));
  const hasReached100 = referralCount >= 100;

  // Calculate projected expiration date preview
  const getExpiryPreview = () => {
    const now = new Date();
    if (planType === 'monthly') {
      const d = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
      return `Expires in 30 days (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;
    }
    if (planType === 'yearly') {
      const d = new Date(now.getTime() + 365 * 24 * 3600 * 1000);
      return `Expires in 365 days (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;
    }
    if (planType === 'custom') {
      const d = new Date(now.getTime() + (customDays || 30) * 24 * 3600 * 1000);
      return `Expires in ${customDays} days (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;
    }
    if (planType === 'lifetime_referral') {
      return 'Permanent Lifetime Badge (100 Referrals Milestone) — Never Expires ∞';
    }
    return 'Permanent Lifetime Badge — Never Expires ∞';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(
        user.id,
        true,
        badgeLabel,
        reason,
        planType,
        planType === 'custom' ? customDays : null
      );
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    setLoading(true);
    try {
      await onConfirm(user.id, false, badgeLabel, reason, planType);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReferralCount = async () => {
    setUpdatingReferral(true);
    try {
      const res = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_REFERRAL_COUNT',
          userId: user.id,
          payload: { referralCount },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReferralFeedback(data.message);
        if (data.is_eligible) {
          setPlanType('lifetime_referral');
          setBadgeLabel('100-Referrals Legend 🏆');
        }
      }
    } catch (err) {
      console.error('Failed to update referral count:', err);
    } finally {
      setUpdatingReferral(false);
    }
  };

  const presetLabels = [
    'Verified Official',
    'ZEV Monthly VIP',
    'ZEV Annual VIP',
    'Lifetime Legend ⭐',
    '100-Referral Champion 🏆',
    'Official Instructor',
    'Celebrity / VIP',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-xl glass-panel rounded-3xl p-6 sm:p-7 shadow-2xl border border-white/[0.12] my-8 max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-white glass-btn transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-600/30 to-sky-500/20 border border-cyan-500/40 text-cyan-400 shadow-inner">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <span>ZEV Blue Badge Subscription Manager</span>
              <VerifiedBadge size="sm" />
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Control subscription plans (Monthly, Annual, Lifetime) & 100-Referral Milestones
            </p>
          </div>
        </div>

        {/* User preview card with current badge status */}
        <div className="p-4 rounded-2xl glass-card flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 rounded-2xl bg-slate-800 border border-white/[0.1] overflow-hidden flex items-center justify-center text-slate-300 font-bold shrink-0 shadow-inner">
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                (user.first_name?.[0] || user.email[0]).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-bold text-sm text-white truncate">
                <span className="truncate">{user.first_name || ''} {user.last_name || 'ZEV User'}</span>
                {isCurrentlyVerified && <VerifiedBadge size="sm" />}
              </div>
              <div className="text-xs text-cyan-400 font-mono truncate">
                @{user.username || 'user'} • {user.email}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className={`inline-block px-2.5 py-1 rounded-xl text-[11px] font-bold border uppercase ${
              isCurrentlyVerified
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {isCurrentlyVerified ? 'Active Blue Tick' : 'No Active Badge'}
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            REFERRALS MONITORING & 100-INVITE PROGRESS BAR
        ══════════════════════════════════════════════════════════ */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-cyan-950/30 border border-cyan-500/30 mb-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Referral Lifetime Milestone
              </span>
            </div>
            <div className="text-xs font-mono text-slate-300">
              Code: <span className="font-bold text-cyan-300">@{user.username || 'user'}</span>
            </div>
          </div>

          {/* Progress bar container */}
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400 font-mono">
                Invited Friends: <span className="text-white font-bold">{referralCount}</span> / 100
              </span>
              <span className={`font-mono font-bold ${hasReached100 ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {progressPercent}%
              </span>
            </div>

            <div className="w-full h-3 bg-slate-950/80 rounded-full border border-white/[0.08] overflow-hidden p-0.5 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  hasReached100
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_12px_#10b981]'
                    : 'bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Milestone Award Banner */}
          {hasReached100 ? (
            <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold">
                100 Real Users Milestone Completed! Eligible for permanent Lifetime Blue Badge!
              </span>
            </div>
          ) : (
            <div className="mt-2.5 text-[11px] text-slate-400 flex items-center justify-between">
              <span>{100 - referralCount} more real invitations needed for free Lifetime Blue Tick.</span>
              <button
                type="button"
                onClick={() => {
                  setReferralCount(100);
                  setPlanType('lifetime_referral');
                  setBadgeLabel('100-Referrals Legend 🏆');
                }}
                className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer text-[10px]"
              >
                Set to 100 (Max)
              </button>
            </div>
          )}

          {/* Admin Referral Count Adjustment Toolbar */}
          <div className="mt-3 pt-3 border-t border-white/[0.08] flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">Admin Referral Count:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={referralCount}
                onChange={(e) => setReferralCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-16 px-2 py-1 rounded-lg glass-input text-xs font-mono text-center text-white"
              />
              <button
                type="button"
                onClick={handleSaveReferralCount}
                disabled={updatingReferral}
                className="px-2.5 py-1 rounded-lg glass-btn text-[11px] font-bold text-cyan-400 hover:text-white cursor-pointer"
              >
                {updatingReferral ? 'Saving...' : 'Save Count'}
              </button>
            </div>
          </div>

          {referralFeedback && (
            <div className="mt-2 text-[10px] text-emerald-400 font-mono text-right">
              {referralFeedback}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════
            SUBSCRIPTION PLAN SELECTOR (MONTHLY, YEARLY, LIFETIME)
        ══════════════════════════════════════════════════════════ */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-2">
              Select Blue Badge Tier / Duration:
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'monthly', label: 'Monthly', desc: '30 Days', icon: Clock, color: 'text-sky-400' },
                { id: 'yearly', label: 'Annual', desc: '365 Days', icon: Calendar, color: 'text-indigo-400' },
                { id: 'lifetime', label: 'Lifetime', desc: 'Permanent ∞', icon: Zap, color: 'text-cyan-400' },
                { id: 'lifetime_referral', label: '100 Invites', desc: 'Milestone 🏆', icon: Gift, color: 'text-amber-400' },
              ].map((p) => {
                const Icon = p.icon;
                const isSelected = planType === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPlanType(p.id as any);
                      if (p.id === 'monthly') setBadgeLabel('ZEV Monthly VIP');
                      else if (p.id === 'yearly') setBadgeLabel('ZEV Annual VIP');
                      else if (p.id === 'lifetime_referral') setBadgeLabel('100-Referrals Legend 🏆');
                      else setBadgeLabel('Verified Official');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-950 ring-1 ring-cyan-400/50'
                        : 'glass-card text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon className={`w-4 h-4 ${p.color}`} />
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{p.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Expiration date preview indicator */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-2 text-xs font-mono text-cyan-300">
            <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="truncate">{getExpiryPreview()}</span>
          </div>

          {/* Badge Label Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Badge Label / Accreditation Title:
            </label>
            <input
              type="text"
              value={badgeLabel}
              onChange={(e) => setBadgeLabel(e.target.value)}
              placeholder="e.g. Verified Official or ZEV VIP Creator"
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-sm text-white focus:outline-none"
              required
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {presetLabels.map((lbl) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setBadgeLabel(lbl)}
                  className="text-[11px] px-2.5 py-1 rounded-xl glass-btn text-slate-300 hover:text-white cursor-pointer"
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Verification Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Verification Reason & Audit Notes:
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Reason for granting accreditation or subscription..."
              className="w-full px-3.5 py-2 rounded-xl glass-input text-xs text-white focus:outline-none"
              required
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
            {isCurrentlyVerified ? (
              <button
                type="button"
                onClick={handleRevoke}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Revoke Blue Badge'}
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl glass-btn text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="glass-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>{isCurrentlyVerified ? 'Update Subscription' : 'Activate Blue Badge ⭐'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
