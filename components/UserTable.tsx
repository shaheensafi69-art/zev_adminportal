'use client';

import React from 'react';
import { 
  Sparkles, Check, Ban, Trash2, Eye, ShieldCheck, Mail, AlertCircle, ChevronLeft, ChevronRight 
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
  onOpenBlueTick: (user: AdminUser) => void;
  onOpenBan: (user: AdminUser) => void;
  onOpenDelete: (user: AdminUser) => void;
  onQuickConfirmEmail: (userId: string) => Promise<void>;
}

export function UserTable({
  users,
  isLoading,
  pagination,
  onPageChange,
  onOpenDetails,
  onOpenBlueTick,
  onOpenBan,
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/60';
      case 'admin':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
      case 'teacher':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/60';
      default:
        return 'bg-slate-800/80 text-slate-300 border-slate-700/60';
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl p-12 text-center backdrop-blur-xl">
        <div className="inline-block w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-sm font-bold text-white">در حال بارگذاری کاربران ZEV...</div>
        <div className="text-xs text-slate-400 mt-1">ارتباط با دیتابیس Supabase برقرار است</div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl p-12 text-center backdrop-blur-xl">
        <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <div className="text-sm font-bold text-white">هیچ کاربری با این مشخصات یافت نشد</div>
        <div className="text-xs text-slate-400 mt-1">لطفاً فیلترها یا عبارت جستجو را تغییر دهید</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          
          {/* Table Header */}
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="py-4 px-4 sm:px-6">کاربر و نام کاربری</th>
              <th className="py-4 px-4">ایمیل و وضعیت تایید</th>
              <th className="py-4 px-4 hidden md:table-cell">تماس و موقعیت</th>
              <th className="py-4 px-3 text-center">نقش</th>
              <th className="py-4 px-3 text-center">وضعیت حساب</th>
              <th className="py-4 px-4 hidden lg:table-cell text-center">کیف پول / امتیاز</th>
              <th className="py-4 px-4 hidden xl:table-cell">تاریخ عضویت</th>
              <th className="py-4 px-4 sm:px-6 text-center">عملیات مدیریت</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {users.map((user) => {
              const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'کاربر ZEV';

              return (
                <tr
                  key={user.id}
                  onClick={() => onOpenDetails(user)}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                >
                  
                  {/* User Avatar & Name */}
                  <td className="py-3.5 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 overflow-hidden flex items-center justify-center font-bold text-slate-300 shrink-0">
                        {user.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          (user.first_name?.[0] || user.email[0]).toUpperCase()
                        )}
                        {user.is_online && (
                          <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                          <span className="truncate max-w-[140px] sm:max-w-[180px]">{fullName}</span>
                          {user.is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        <div className="text-[11px] text-cyan-400 font-mono truncate">
                          @{user.username || 'بدون_نام_کاربری'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Email & Confirmed status */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-slate-200 text-xs truncate max-w-[180px]">
                        {user.email}
                      </span>
                      <div>
                        {user.email_confirmed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/40">
                            <Check className="w-2.5 h-2.5" />
                            تایید شده (Confirmed)
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-800/40">
                              تایید نشده
                            </span>
                            <button
                              onClick={(e) => handleQuickConfirm(e, user.id)}
                              disabled={confirmingId === user.id}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all cursor-pointer"
                              title="کانفورم کردن فوری ایمیل"
                            >
                              {confirmingId === user.id ? '...' : 'تایید کن'}
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
                        {user.phone_number || 'بدون شماره'}
                      </span>
                      <span className="text-[11px] text-slate-400 capitalize">
                        {user.country || 'نامشخص'}
                      </span>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="py-3.5 px-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${getRoleBadge(user.role)}`}>
                      {user.role}
                    </span>
                  </td>

                  {/* Account Status (Active / Banned) */}
                  <td className="py-3.5 px-3 text-center">
                    {user.is_banned ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/80 text-rose-400 border border-rose-800/60 shadow-sm shadow-rose-950">
                        <Ban className="w-3 h-3" />
                        مسدود (Banned)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/30">
                        فعال
                      </span>
                    )}
                  </td>

                  {/* Wallet / Score */}
                  <td className="py-3.5 px-4 hidden lg:table-cell text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-mono font-bold text-amber-300 text-xs">
                        ${Number(user.wallet_balance || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {user.total_score || 0} امتیاز
                      </span>
                    </div>
                  </td>

                  {/* Joined Date */}
                  <td className="py-3.5 px-4 hidden xl:table-cell text-slate-400 text-[11px] font-mono">
                    {new Date(user.created_at).toLocaleDateString('fa-IR')}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3.5 px-4 sm:px-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      
                      {/* Toggle Blue Tick (تک ابی) */}
                      <button
                        onClick={() => onOpenBlueTick(user)}
                        className={`p-2 rounded-xl transition-all cursor-pointer border ${
                          user.is_verified
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-sm shadow-cyan-950'
                            : 'bg-slate-800/80 hover:bg-cyan-950/60 text-slate-400 hover:text-cyan-300 border-slate-700/60'
                        }`}
                        title={user.is_verified ? 'لغو تیک آبی' : 'اعطای نشان تیک آبی'}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>

                      {/* View Details Modal */}
                      <button
                        onClick={() => onOpenDetails(user)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
                        title="بررسی کامل پرونده کاربر"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Ban / Unban Modal */}
                      <button
                        onClick={() => onOpenBan(user)}
                        className={`p-2 rounded-xl transition-all cursor-pointer border ${
                          user.is_banned
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                            : 'bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border-slate-700/60'
                        }`}
                        title={user.is_banned ? 'رفع مسدودیت (Unban)' : 'مسدود کردن کاربر (بند زدن)'}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Modal */}
                      <button
                        onClick={() => onOpenDelete(user)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
                        title="حذف کاربر (دلیت)"
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 px-6 border-t border-slate-800 bg-slate-950/70 text-xs">
        <div className="text-slate-400">
          نمایش صفحه <span className="font-bold text-white">{pagination.page}</span> از{' '}
          <span className="font-bold text-white">{pagination.totalPages || 1}</span> (مجموعاً{' '}
          <span className="font-bold text-cyan-400">{pagination.total}</span> کاربر)
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            <span>قبلی</span>
          </button>

          <div className="flex items-center gap-1 font-mono">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    pagination.page === pageNum
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-950'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
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
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <span>بعدی</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

