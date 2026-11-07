'use client';

import React, { useState } from 'react';
import { 
  X, Check, Copy, Calendar, MapPin, 
  Film, MessageSquare, Mail, Phone, 
  Clock, Sparkles, Ban, Trash2, Edit3 
} from 'lucide-react';
import { AdminUser } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface UserDetailModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenEdit: (user: AdminUser) => void;
  onOpenBlueTick: (user: AdminUser) => void;
  onOpenBan: (user: AdminUser) => void;
  onOpenDelete: (user: AdminUser) => void;
  onConfirmEmail: (userId: string) => Promise<void>;
}

export function UserDetailModal({
  user,
  isOpen,
  onClose,
  onOpenEdit,
  onOpenBlueTick,
  onOpenBan,
  onOpenDelete,
  onConfirmEmail,
}: UserDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmEmailLoading, setConfirmEmailLoading] = useState(false);

  if (!isOpen || !user) return null;

  const copyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmEmail = async () => {
    setConfirmEmailLoading(true);
    try {
      await onConfirmEmail(user.id);
    } finally {
      setConfirmEmailLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-left">
        
        {/* Top Header with Close */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">ZEV User Dossier</span>
            {user.is_verified && <VerifiedBadge size="sm" />}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Profile Card Header */}
          <div className="relative p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800/80">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              
              <div className="relative w-20 h-20 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center text-2xl font-bold text-slate-300 shadow-xl shrink-0">
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  (user.first_name?.[0] || user.email[0]).toUpperCase()
                )}
                {user.is_online && (
                  <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900" title="Online" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-white">
                    {user.first_name || ''} {user.last_name || 'ZEV User'}
                  </h2>
                  {user.is_verified && <VerifiedBadge size="md" />}
                  {user.is_banned && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/60 font-bold">
                      Account Suspended
                    </span>
                  )}
                </div>

                <div className="text-sm text-cyan-400 font-mono mt-0.5">
                  @{user.username || 'no_username'}
                </div>

                {user.father_name && (
                  <div className="text-xs text-slate-400 mt-1">
                    Father Name: <span className="text-slate-300">{user.father_name}</span>
                  </div>
                )}

                {user.bio && (
                  <p className="text-xs text-slate-300 mt-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 leading-relaxed">
                    {user.bio}
                  </p>
                )}
              </div>

            </div>

            {/* User ID Pill */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-mono">
                <span className="text-slate-500">UUID:</span> {user.id}
              </span>
              <button
                onClick={copyId}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy UUID'}</span>
              </button>
            </div>
          </div>

          {/* Activity Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center">
              <div className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                Discussion Posts
              </div>
              <div className="text-2xl font-black text-white mt-1 font-mono">
                {user.posts_count || 0}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center">
              <div className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-purple-400" />
                Video Reels
              </div>
              <div className="text-2xl font-black text-white mt-1 font-mono">
                {user.reels_count || 0}
              </div>
            </div>
          </div>

          {/* Detailed Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Contact info */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Contact & Authentication
              </h4>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  Email:
                </span>
                <span className="font-mono text-slate-200">{user.email}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Email Status:</span>
                {user.email_confirmed ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
                    <Check className="w-3 h-3" />
                    Confirmed
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-800/40">
                      Unconfirmed
                    </span>
                    <button
                      onClick={handleConfirmEmail}
                      disabled={confirmEmailLoading}
                      className="text-[11px] px-2 py-0.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all cursor-pointer"
                    >
                      {confirmEmailLoading ? '...' : 'Confirm'}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  Phone Number:
                </span>
                <span className="font-mono text-slate-200">{user.phone_number || 'N/A'}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  Country:
                </span>
                <span className="text-slate-200 capitalize">{user.country || 'Unknown'}</span>
              </div>
            </div>

            {/* Timestamps */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Registration & Status
              </h4>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Joined Date:
                </span>
                <span className="text-slate-300 font-mono text-[11px]">
                  {new Date(user.created_at).toLocaleString('en-US')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Last Seen:
                </span>
                <span className="text-slate-300 font-mono text-[11px]">
                  {user.last_seen ? new Date(user.last_seen).toLocaleString('en-US') : 'N/A'}
                </span>
              </div>

              {user.is_banned && (
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300">
                  <span className="font-bold">Banned Until:</span>{' '}
                  <span className="font-mono">
                    {user.banned_until ? new Date(user.banned_until).toLocaleString('en-US') : 'Permanent'}
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* Blue Tick Verification Details Card */}
          {user.verification_info && (
            <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 space-y-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Active Verification Dossier
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                <div>
                  <span className="text-slate-400">Badge Label:</span>{' '}
                  <span className="text-white font-medium">{user.verification_info.badge_label || 'Verified'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Granted On:</span>{' '}
                  <span className="text-slate-200 font-mono text-[11px]">
                    {user.verification_info.verified_at ? new Date(user.verification_info.verified_at).toLocaleDateString('en-US') : '-'}
                  </span>
                </div>
                <div className="sm:col-span-3">
                  <span className="text-slate-400">Reason:</span>{' '}
                  <span className="text-slate-300">{user.verification_info.verification_reason || 'Official Accreditation'}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Action Toolbar at Bottom */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            
            {/* Toggle Blue Tick Button */}
            <button
              onClick={() => {
                onClose();
                onOpenBlueTick(user);
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${
                user.is_verified
                  ? 'bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-900/50'
                  : 'bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white shadow-cyan-950'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{user.is_verified ? 'Revoke Blue Badge' : 'Grant Blue Badge'}</span>
            </button>

            {/* Edit User Button */}
            <button
              onClick={() => {
                onClose();
                onOpenEdit(user);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Edit Details</span>
            </button>

            {/* Ban / Unban Button */}
            <button
              onClick={() => {
                onClose();
                onOpenBan(user);
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                user.is_banned
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{user.is_banned ? 'Lift Ban (Unban)' : 'Ban User'}</span>
            </button>

          </div>

          <div className="flex items-center gap-2">
            {/* Delete User Button */}
            <button
              onClick={() => {
                onClose();
                onOpenDelete(user);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-white bg-slate-900 hover:bg-rose-600 border border-rose-900/40 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete User</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
