'use client';

import React from 'react';
import { 
  Sparkles, Check, Ban, Trash2, Eye, AlertCircle, ChevronLeft, ChevronRight, Edit3, Users, Film, ShieldAlert, Trophy 
} from 'lucide-react';
import { AdminUser } from '@/lib/types';
import { VerifiedBadge } from './VerifiedBadge';

interface UserTableProps {
  users: AdminUser[];
  isLoading: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (newPage: number) => void;
  onOpenDetails: (user: AdminUser) => void;
  onOpenEdit: (user: AdminUser) => void;
  onOpenBlueTick: (user: AdminUser) => void;
  onOpenBan: (user: AdminUser) => void;
  onOpenRestrict?: (user: AdminUser) => void;
  onOpenDelete: (user: AdminUser) => void;
  onQuickConfirmEmail: (userId: string) => Promise<void>;
}

export function UserTable({
  users,
  isLoading,
  pagination,
  onPageChange,
  onOpenDetails,
  onOpenEdit,
  onOpenBlueTick,
  onOpenBan,
  onOpenRestrict,
  onOpenDelete,
  onQuickConfirmEmail,
}: UserTableProps) {
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  const handleQuickConfirm = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    setConfirmingId(userId);
    try {
      await onQuickConfirmEmail(userId);
    } finally {
      setConfirmingId(null);
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl p-12 text-center backdrop-blur-xl">
        <div className="inline-block w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-sm font-bold text-white">Loading ZEV Users...</div>
        <div className="text-xs text-slate-400 mt-1">Connecting to dedicated Supabase database</div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl p-12 text-center backdrop-blur-xl">
        <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <div className="text-sm font-bold text-white">No users match your filter criteria</div>
        <div className="text-xs text-slate-400 mt-1">Try resetting the filters or modifying your search query</div>
      </div>
    );
  }

  return (
    <div className="w-full glass-panel rounded-3xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          
          {/* Table Header */}
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="py-4 px-4 sm:px-6">User & Username</th>
              <th className="py-4 px-4">Email & Verification</th>
              <th className="py-4 px-4 hidden md:table-cell">Phone & Country</th>
              <th className="py-4 px-3 text-center">Status</th>
              <th className="py-4 px-3 text-center hidden lg:table-cell">Followers / Following</th>
              <th className="py-4 px-3 text-center hidden xl:table-cell">Posts & Reels</th>
              <th className="py-4 px-4 hidden 2xl:table-cell">Joined Date</th>
              <th className="py-4 px-4 sm:px-6 text-center">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-white/[0.05] text-xs">
            {users.map((user) => {
              const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'ZEV User';

              return (
                <tr
                  key={user.id}
                  onClick={() => onOpenDetails(user)}
                  className="hover:bg-white/[0.035] transition-colors cursor-pointer group"
                >
                  
                  {/* User Avatar & Name */}
                  <td className="py-3.5 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-2xl bg-slate-800/80 border border-white/[0.1] overflow-hidden flex items-center justify-center font-bold text-slate-300 shrink-0 shadow-inner">
                        {user.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          (user.first_name?.[0] || user.email[0]).toUpperCase()
                        )}
                        {user.is_online && (
                          <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900 shadow-[0_0_6px_#10b981]" title="Online" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                          <span className="truncate max-w-[140px] sm:max-w-[180px]">{fullName}</span>
                          {user.is_verified && <VerifiedBadge size="sm" />}
                          {user.is_verified && user.verification_info?.plan_type && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase border ${
                              user.verification_info.plan_type === 'monthly' ? 'bg-blue-950/80 text-blue-300 border-blue-800/60' :
                              user.verification_info.plan_type === 'yearly' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60' :
                              user.verification_info.plan_type === 'lifetime_referral' ? 'bg-amber-950/80 text-amber-300 border-amber-800/60' :
                              'bg-purple-950/80 text-purple-300 border-purple-800/60'
                            }`}>
                              {user.verification_info.plan_type === 'monthly' ? '30D' :
                               user.verification_info.plan_type === 'yearly' ? '365D' :
                               user.verification_info.plan_type === 'lifetime_referral' ? '100★' : 'VIP'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-cyan-400 font-mono truncate">
                            @{user.username || 'no_username'}
                          </span>
                          {user.referral_count !== undefined && user.referral_count > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800" title={`${user.referral_count} invites through personal referral code`}>
                              <Trophy className="w-2.5 h-2.5 text-amber-400" />
                              <span className="text-amber-400 font-bold">{user.referral_count}</span>
                              <span>/100</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Email & Confirmed status */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-slate-200 text-xs truncate max-w-[190px]">
                        {user.email}
                      </span>
                      <div>
                        {user.email_confirmed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/50 shadow-sm">
                            <Check className="w-2.5 h-2.5" />
                            Confirmed
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/50">
                              Unconfirmed
                            </span>
                            <button
                              onClick={(e) => handleQuickConfirm(e, user.id)}
                              disabled={confirmingId === user.id}
                              className="text-[10px] px-2 py-0.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all cursor-pointer shadow-sm"
                              title="Instant Email Confirmation"
                            >
                              {confirmingId === user.id ? '...' : 'Confirm'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Phone & Country */}
                  <td className="py-3.5 px-4 hidden md:table-cell">
                    <div className="flex flex-col gap-0.5 text-slate-300">
                      <span className="font-mono text-[11px] text-slate-300">
                        {user.phone_number || 'N/A'}
                      </span>
                      <span className="text-[11px] text-slate-400 capitalize">
                        {user.country || 'Unknown'}
                      </span>
                    </div>
                  </td>

                  {/* Account Status (Active / Restricted / Banned) */}
                  <td className="py-3.5 px-3 text-center">
                    {user.is_banned ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/80 text-rose-400 border border-rose-800/60 shadow-sm shadow-rose-950">
                        <Ban className="w-3 h-3" />
                        Banned
                      </span>
                    ) : user.is_restricted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-950/80 text-orange-400 border border-orange-800/60 shadow-sm shadow-orange-950">
                        <ShieldAlert className="w-3 h-3" />
                        Restricted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/50 text-emerald-400 border border-emerald-800/40">
                        Active
                      </span>
                    )}
                  </td>

                  {/* Followers / Following */}
                  <td className="py-3.5 px-3 hidden lg:table-cell text-center">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] font-mono">
                      <Users className="w-3 h-3 text-sky-400" />
                      <span className="text-white font-bold">{user.followers_count || 0}</span>
                      <span className="text-slate-600">/</span>
                      <span className="text-slate-400">{user.following_count || 0}</span>
                    </div>
                  </td>

                  {/* Posts & Reels */}
                  <td className="py-3.5 px-3 hidden xl:table-cell text-center">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] font-mono">
                      <Film className="w-3 h-3 text-purple-400" />
                      <span className="text-cyan-400 font-bold">{user.posts_count || 0}</span>
                      <span className="text-slate-600">/</span>
                      <span className="text-purple-400 font-bold">{user.reels_count || 0}</span>
                    </div>
                  </td>

                  {/* Joined Date */}
                  <td className="py-3.5 px-4 hidden 2xl:table-cell text-slate-400 text-[11px] font-mono">
                    {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3.5 px-4 sm:px-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      
                      {/* Toggle Blue Tick */}
                      <button
                        onClick={() => onOpenBlueTick(user)}
                        className={`p-2 rounded-xl transition-all cursor-pointer border ${
                          user.is_verified
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-sm shadow-cyan-950'
                            : 'glass-btn text-slate-400 hover:text-cyan-300'
                        }`}
                        title={user.is_verified ? 'Revoke Blue Badge' : 'Grant Blue Badge'}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit User Button */}
                      <button
                        onClick={() => onOpenEdit(user)}
                        className="glass-btn p-2 rounded-xl text-slate-300 hover:text-white"
                        title="Edit User Profile"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* View Details / 0-100 Dossier */}
                      <button
                        onClick={() => onOpenDetails(user)}
                        className="p-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 hover:text-white border border-cyan-800/60 transition-all cursor-pointer shadow-sm"
                        title="Inspect 0 to 100 User Dossier"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Restrict / Policy Warning Button */}
                      {onOpenRestrict && (
                        <button
                          onClick={() => onOpenRestrict(user)}
                          className={`p-2 rounded-xl transition-all cursor-pointer border ${
                            user.is_restricted
                              ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-sm'
                              : 'glass-btn text-slate-400 hover:text-orange-400'
                          }`}
                          title="Policy Warning or Restrict Account"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Ban / Unban Modal */}
                      <button
                        onClick={() => onOpenBan(user)}
                        className={`p-2 rounded-xl transition-all cursor-pointer border ${
                          user.is_banned
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                            : 'glass-btn text-slate-400 hover:text-rose-400'
                        }`}
                        title={user.is_banned ? 'Lift Ban (Unban)' : 'Ban User Account'}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Modal */}
                      <button
                        onClick={() => onOpenDelete(user)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-600/80 text-rose-400 hover:text-white border border-rose-500/20 transition-all cursor-pointer"
                        title="Delete User Permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 px-6 border-t border-white/[0.06] bg-white/[0.02] text-xs">
        <div className="text-slate-400">
          Showing page <span className="font-bold text-white font-mono">{pagination.page}</span> of{' '}
          <span className="font-bold text-white font-mono">{pagination.totalPages || 1}</span> (Total{' '}
          <span className="font-bold text-cyan-400 font-mono">{pagination.total}</span> users)
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="glass-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1 font-mono">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-7 h-7 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    pagination.page === pageNum
                      ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-white shadow-lg shadow-cyan-950 font-bold'
                      : 'glass-btn text-slate-400 hover:text-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="glass-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
