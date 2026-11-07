'use client';

import React from 'react';
import { Users, CheckCircle, AlertTriangle, Ban, Radio, Film } from 'lucide-react';
import { DashboardStats } from '@/lib/types';

interface StatsCardsProps {
  stats: DashboardStats | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isLoading: boolean;
}

export function StatsCards({ stats, activeTab, onTabChange, isLoading }: StatsCardsProps) {
  const cards = [
    {
      id: 'all',
      title: 'کل کاربران',
      value: stats?.totalUsers ?? '...',
      icon: Users,
      gradient: 'from-blue-500/20 via-sky-500/10 to-transparent',
      borderColor: 'border-blue-500/30',
      textColor: 'text-blue-400',
      description: 'مجموع کاربران دیتابیس ZEV',
    },
    {
      id: 'verified',
      title: 'دارای تیک آبی (تایید شده)',
      value: stats?.verifiedUsers ?? '...',
      icon: CheckCircle,
      gradient: 'from-cyan-500/20 via-teal-500/10 to-transparent',
      borderColor: 'border-cyan-500/30',
      textColor: 'text-cyan-400',
      description: 'نشان اصالت و رسمیت فعال',
    },
    {
      id: 'unconfirmed',
      title: 'ایمیل تایید نشده',
      value: stats?.unconfirmedUsers ?? '...',
      icon: AlertTriangle,
      gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-400',
      description: 'در انتظار تایید ایمیل (کانفورم)',
    },
    {
      id: 'banned',
      title: 'حساب‌های مسدود (بند شده)',
      value: stats?.bannedUsers ?? '...',
      icon: Ban,
      gradient: 'from-rose-500/20 via-red-500/10 to-transparent',
      borderColor: 'border-rose-500/30',
      textColor: 'text-rose-400',
      description: 'دسترسی محدود یا تعلیق‌شده',
    },
    {
      id: 'online',
      title: 'کاربران آنلاین',
      value: stats?.onlineUsers ?? '...',
      icon: Radio,
      gradient: 'from-emerald-500/20 via-green-500/10 to-transparent',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-400',
      description: 'فعالیت در ساعات اخیر',
    },
    {
      id: 'content',
      title: 'پست‌ها و ریلز ZEV',
      value: `${stats ? (stats.totalPosts + stats.totalReels) : '...'}`,
      icon: Film,
      gradient: 'from-purple-500/20 via-indigo-500/10 to-transparent',
      borderColor: 'border-purple-500/30',
      textColor: 'text-purple-400',
      description: `${stats?.totalPosts || 0} پست / ${stats?.totalReels || 0} ریلز`,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 my-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeTab === card.id;

        return (
          <button
            key={card.id}
            onClick={() => {
              if (card.id !== 'content' && card.id !== 'online') {
                onTabChange(card.id);
              }
            }}
            disabled={card.id === 'content' || card.id === 'online'}
            className={`relative text-right p-4 rounded-2xl transition-all duration-200 border cursor-pointer select-none overflow-hidden group ${
              isActive
                ? `bg-slate-900/90 ${card.borderColor} ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-950/50`
                : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            {/* Ambient background glow */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-40 group-hover:opacity-70 transition-opacity`}
            />

            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                  {card.title}
                </span>
                <div className={`p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 ${card.textColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-black tracking-tight text-white flex items-baseline gap-1">
                  {isLoading ? (
                    <span className="inline-block w-8 h-6 bg-slate-800 animate-pulse rounded" />
                  ) : (
                    card.value
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                  {card.description}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
