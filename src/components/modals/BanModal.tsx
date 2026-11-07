'use client';

import React, { useState } from 'react';
import { X, Ban, ShieldCheck, AlertCircle } from 'lucide-react';
import { AdminUser } from '@/lib/types';

interface BanModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBan: (userId: string, durationHours: number, reason: string) => Promise<void>;
  onConfirmUnban: (userId: string) => Promise<void>;
}

export function BanModal({ user, isOpen, onClose, onConfirmBan, onConfirmUnban }: BanModalProps) {
  const [durationHours, setDurationHours] = useState(168); // 7 days default
  const [reason, setReason] = useState('Violation of ZEV Community Guidelines and Terms of Service');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user) return null;

  const isBanned = user.is_banned;

  const handleBanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirmBan(user.id, durationHours, reason);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnbanSubmit = async () => {
    setLoading(true);
    try {
      await onConfirmUnban(user.id);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const durations = [
    { label: '24 Hours', hours: 24 },
    { label: '3 Days', hours: 72 },
    { label: '7 Days (1 Week)', hours: 168 },
    { label: '30 Days (1 Month)', hours: 720 },
    { label: 'Permanent', hours: 876000 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl shadow-rose-950/40">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800/60 text-rose-400">
            <Ban className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {isBanned ? 'Manage & Lift Account Suspension' : 'Suspend User Account (Ban)'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Target User: <span className="text-rose-300 font-medium">{user.email}</span>
            </p>
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 mb-6">
          <div className="relative w-11 h-11 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-slate-300 font-bold">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              (user.first_name?.[0] || user.email[0]).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-white truncate">
              {user.first_name || ''} {user.last_name || 'ZEV User'}
            </div>
            <div className="text-xs text-slate-400 truncate">@{user.username || 'no_username'}</div>
          </div>
          {isBanned && (
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-rose-950/80 text-rose-400 border border-rose-800/60">
              Currently Banned
            </span>
          )}
        </div>

        {isBanned ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-200 leading-relaxed">
              <div className="font-bold mb-1 flex items-center gap-1.5 text-rose-400">
                <AlertCircle className="w-4 h-4" />
                Active Suspension Status:
              </div>
              This user is currently banned from accessing ZEV until{' '}
              <span className="font-mono text-white font-bold">
                {user.banned_until ? new Date(user.banned_until).toLocaleString('en-US') : 'Indefinite / Permanent'}
              </span>.
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnbanSubmit}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950 transition-all cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                {loading ? 'Processing...' : 'Lift Ban (Unban Account)'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleBanSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Suspension Duration
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {durations.map((d) => (
                  <button
                    key={d.hours}
                    type="button"
                    onClick={() => setDurationHours(d.hours)}
                    className={`p-2.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                      durationHours === d.hours
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 ring-2 ring-rose-500/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Reason for Ban (Recorded in Audit Logs)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Specify violation or reason for restricting user..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950 transition-all cursor-pointer disabled:opacity-50"
              >
                <Ban className="w-4 h-4" />
                {loading ? 'Applying Ban...' : 'Confirm & Ban User'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
