'use client';

import React, { useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { AdminUser } from '@/lib/types';

interface DeleteModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (userId: string) => Promise<void>;
}

export function DeleteModal({ user, isOpen, onClose, onConfirmDelete }: DeleteModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user) return null;

  const isConfirmed = confirmText.trim().toUpperCase() === 'DELETE';

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;

    setLoading(true);
    try {
      await onConfirmDelete(user.id);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-rose-900/50 rounded-3xl p-6 shadow-2xl shadow-rose-950/60">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-rose-950 border border-rose-800/80 text-rose-400">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Permanently Delete User Account
            </h3>
            <p className="text-xs text-rose-400 font-semibold mt-0.5">
              Warning: This action is irreversible!
            </p>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 mb-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300">
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-full" />
              ) : (
                (user.first_name?.[0] || user.email[0]).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-white truncate">
                {user.first_name || ''} {user.last_name || 'ZEV User'}
              </div>
              <div className="text-xs text-slate-400 truncate">{user.email}</div>
            </div>
          </div>
          <div className="text-[11px] font-mono text-slate-500 truncate">
            UUID: {user.id}
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300 mb-5 leading-relaxed">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div>
            Deleting this user will permanently erase their Supabase Auth credentials, profile details, active verification badges, wallet balance, and platform records.
          </div>
        </div>

        <form onSubmit={handleDelete} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Type <span className="font-mono text-rose-400 font-bold">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-rose-900/60 text-center font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isConfirmed || loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-rose-950 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              {loading ? 'Deleting...' : 'Permanently Delete'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
