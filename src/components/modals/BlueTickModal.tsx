'use client';

import React, { useState } from 'react';
import { X, Sparkles, Check, ShieldAlert } from 'lucide-react';
import { AdminUser } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface BlueTickModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string, isVerified: boolean, badgeLabel: string, reason: string) => Promise<void>;
}

export function BlueTickModal({ user, isOpen, onClose, onConfirm }: BlueTickModalProps) {
  const [badgeLabel, setBadgeLabel] = useState('Verified Official');
  const [reason, setReason] = useState('تایید اصالت هویت توسط مدیریت ZEV');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user) return null;

  const isCurrentlyVerified = user.is_verified;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(user.id, !isCurrentlyVerified, badgeLabel, reason);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const presetLabels = [
    'Verified Official',
    'ZEV VIP Creator',
    'Official Instructor',
    'Celebrity / Influencer',
    'Partner Account',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl shadow-cyan-950/50">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {isCurrentlyVerified ? 'لغو نشان تیک آبی ZEV' : 'اعطای نشان تیک آبی ZEV'}
              <VerifiedBadge size="sm" />
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              مدیریت نشان اصالت و تایید رسمی برای کاربر{' '}
              <span className="text-cyan-300 font-medium">@{user.username || user.email}</span>
            </p>
          </div>
        </div>

        {/* User preview card */}
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
            <div className="flex items-center gap-1.5 font-bold text-sm text-white">
              <span className="truncate">{user.first_name || ''} {user.last_name || 'کاربر ZEV'}</span>
              {isCurrentlyVerified && <VerifiedBadge size="sm" />}
            </div>
            <div className="text-xs text-slate-400 truncate">{user.email}</div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-slate-800 text-slate-300">
            {user.role}
          </span>
        </div>

        {isCurrentlyVerified ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs leading-relaxed">
              <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                آیا از غیرفعال کردن نشان تیک آبی این کاربر اطمینان دارید؟ با تایید این اقدام، نشان تیک آبی از پروفایل این کاربر در اپلیکیشن ZEV حذف شده و رکورد تایید لغو خواهد شد.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'در حال لغو...' : 'غیرفعال‌سازی تیک آبی'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                عنوان نشان رسمی (Badge Label)
              </label>
              <input
                type="text"
                value={badgeLabel}
                onChange={(e) => setBadgeLabel(e.target.value)}
                placeholder="مثال: Verified Official یا VIP Creator"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                required
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {presetLabels.map((lbl) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => setBadgeLabel(lbl)}
                    className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                دلیل تایید و ثبت در پرونده کاربر
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="دلیل احراز هویت یا اعطای نشان تیک آبی..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                required
              />
            </div>

            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/30 text-[11px] text-cyan-300 leading-relaxed flex items-center gap-2">
              <Check className="w-4 h-4 text-cyan-400 shrink-0" />
              پس از تایید، اعلان تبریک رسمی در اپلیکیشن ZEV برای این کاربر ارسال خواهد شد.
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 shadow-lg shadow-cyan-950 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'در حال ثبت...' : 'اعطای رسمی تیک آبی ⭐'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
