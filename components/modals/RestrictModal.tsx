'use client';

import React, { useState } from 'react';
import { 
  X, AlertTriangle, ShieldAlert, CheckCircle, Clock, FileWarning, ArrowRight 
} from 'lucide-react';
import { AdminUser } from '@/lib/types';

interface RestrictModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmWarn: (userId: string, payload: { reason: string; details: string; warningLevel: number }) => Promise<void>;
  onConfirmRestrict: (userId: string, payload: { reason: string; durationHours: number | null; details: string }) => Promise<void>;
  onConfirmUnrestrict: (userId: string) => Promise<void>;
}

const VIOLATION_PRESETS = [
  'Hate Speech & Harassment',
  'Spam or Automated Bot Activity',
  'Inappropriate or Explicit Media',
  'Impersonation or False Identity',
  'Harassment & Bullying in Comments',
  'Community Policy Violation',
];

export function RestrictModal({
  user,
  isOpen,
  onClose,
  onConfirmWarn,
  onConfirmRestrict,
  onConfirmUnrestrict,
}: RestrictModalProps) {
  const [mode, setMode] = useState<'restrict' | 'warn'>('restrict');
  const [selectedReason, setSelectedReason] = useState<string>(VIOLATION_PRESETS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [durationHours, setDurationHours] = useState<number | null>(72); // default 3 days
  const [details, setDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const currentStrikes = user.warning_count || 0;
  const isAlreadyRestricted = user.is_restricted;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const finalReason = customReason.trim() ? customReason.trim() : selectedReason;

    try {
      if (mode === 'warn') {
        const nextLevel = currentStrikes + 1;
        await onConfirmWarn(user.id, {
          reason: finalReason,
          details,
          warningLevel: nextLevel,
        });
      } else {
        await onConfirmRestrict(user.id, {
          reason: finalReason,
          durationHours,
          details,
        });
      }
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLift = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirmUnrestrict(user.id);
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to lift restriction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isAlreadyRestricted 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
                : 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Policy Enforcement & Restrictions
              </h3>
              <p className="text-xs text-slate-400">
                Issue progressive warnings or restrict user account permissions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Snapshot */}
        <div className="p-4 px-6 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
              {(user.first_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unnamed User'}
              </div>
              <div className="text-[11px] text-cyan-400 font-mono">
                @{user.username || 'user'} • {user.email}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl text-[11px] font-mono font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
              {currentStrikes} Strike{currentStrikes === 1 ? '' : 's'}
            </span>
            {isAlreadyRestricted && (
              <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800/60 uppercase">
                Restricted
              </span>
            )}
          </div>
        </div>

        {/* If Already Restricted Banner */}
        {isAlreadyRestricted && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-amber-950/30 border border-amber-800/60 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                This account is currently restricted
              </div>
              <div className="text-[11px] text-slate-300 mt-1 font-mono">
                Reason: {user.restriction_reason || 'Policy Violation'}
              </div>
            </div>
            <button
              onClick={handleLift}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Lift Restriction
            </button>
          </div>
        )}

        {/* Tab Switcher: Restrict vs Warn */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('restrict')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'restrict'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50 shadow-lg'
                : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700/50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Restrict Account</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('warn')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'warn'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-lg'
                : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700/50'
            }`}
          >
            <FileWarning className="w-3.5 h-3.5" />
            <span>Issue Policy Warning</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Reason presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Violation Reason
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {VIOLATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setSelectedReason(preset);
                    setCustomReason('');
                  }}
                  className={`text-left text-[11px] px-3 py-2 rounded-xl transition-all border cursor-pointer ${
                    selectedReason === preset && !customReason
                      ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/80 font-bold'
                      : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Or write custom violation reason..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="mt-2 w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* If mode is Restrict: Duration selection */}
          {mode === 'restrict' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Restriction Duration
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '24 Hours', hours: 24 },
                  { label: '3 Days', hours: 72 },
                  { label: '7 Days', hours: 168 },
                  { label: '14 Days', hours: 336 },
                  { label: '30 Days', hours: 720 },
                  { label: 'Indefinite', hours: null },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setDurationHours(item.hours)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      durationHours === item.hours
                        ? 'bg-orange-600/30 text-orange-300 border-orange-500/80'
                        : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Internal notes / Details */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Admin Evidence & Notes <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Internal notes, context, or flagged link reference..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Automatic User Notice Alert */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              An official in-app policy notice will be automatically delivered to the user notifying them of this action.
            </span>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                mode === 'restrict'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-lg shadow-orange-900/30'
                  : 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 shadow-lg shadow-amber-900/30'
              }`}
            >
              <span>{mode === 'restrict' ? 'Apply Restriction' : `Issue Warning #${currentStrikes + 1}`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
