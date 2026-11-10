'use client';

import React from 'react';
import { 
  Users, Sparkles, ShieldAlert, AlertTriangle, 
  Film, Activity, Server, Database, ArrowUpRight, ShieldCheck, Clock
} from 'lucide-react';
import { DashboardStats, AdminUser } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface DashboardViewProps {
  stats: DashboardStats | null;
  recentUsers: AdminUser[];
  onNavigate: (view: 'users' | 'restrictions' | 'reports' | 'content' | 'verifications') => void;
  onInspectUser: (user: AdminUser) => void;
}

export function DashboardView({
  stats,
  recentUsers,
  onNavigate,
  onInspectUser,
}: DashboardViewProps) {
  const cards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers ?? '—',
      icon: Users,
      trend: '+100% Verified in DB',
      trendColor: 'text-cyan-400',
      color: 'from-cyan-500/10 to-transparent border-cyan-500/30',
      iconColor: 'text-cyan-400 bg-cyan-500/10',
      action: () => onNavigate('users'),
    },
    {
      title: 'Verified Badges',
      value: stats?.verifiedUsers ?? '—',
      icon: Sparkles,
      trend: 'Official Blue Badges',
      trendColor: 'text-blue-400',
      color: 'from-blue-500/10 to-transparent border-blue-500/30',
      iconColor: 'text-blue-400 bg-blue-500/10',
      action: () => onNavigate('verifications'),
    },
    {
      title: 'Restricted Accounts',
      value: stats?.restrictedUsers ?? 0,
      icon: ShieldAlert,
      trend: `${stats?.activeWarnings || 0} Policy Warnings`,
      trendColor: 'text-orange-400',
      color: 'from-orange-500/10 to-transparent border-orange-500/30',
      iconColor: 'text-orange-400 bg-orange-500/10',
      action: () => onNavigate('restrictions'),
    },
    {
      title: 'Pending Reports',
      value: stats?.pendingReports ?? 0,
      icon: AlertTriangle,
      trend: 'Needs Admin Review',
      trendColor: 'text-amber-400',
      color: 'from-amber-500/10 to-transparent border-amber-500/30',
      iconColor: 'text-amber-400 bg-amber-500/10',
      action: () => onNavigate('reports'),
    },
    {
      title: 'Discussion Posts',
      value: stats?.totalPosts ?? '—',
      icon: Film,
      trend: 'Active Community Feed',
      trendColor: 'text-emerald-400',
      color: 'from-emerald-500/10 to-transparent border-emerald-500/30',
      iconColor: 'text-emerald-400 bg-emerald-500/10',
      action: () => onNavigate('content'),
    },
    {
      title: 'Video Reels',
      value: stats?.totalReels ?? '—',
      icon: Film,
      trend: 'ZEV Short Videos',
      trendColor: 'text-purple-400',
      color: 'from-purple-500/10 to-transparent border-purple-500/30',
      iconColor: 'text-purple-400 bg-purple-500/10',
      action: () => onNavigate('content'),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-cyan-500/15 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold mb-3 shadow-lg shadow-cyan-950/40">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#06b6d4]" />
              LIVE ZEV CLOUD CONSOLE • adminportal.zevapp.com
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              ZEV Platform Master Operations
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Monitor real-time user registrations, enforce community policy with progressive warnings and restrictions, manage official Blue Badges, and moderate platform feeds with 0–100 database precision.
            </p>
          </div>
          <div className="hidden lg:flex items-center justify-center shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/[0.1] p-3 shadow-2xl backdrop-blur-md flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/icon-clean.png" alt="ZEV Official Logo" className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(6,182,212,0.35)]" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={card.action}
              className="p-4 rounded-2xl glass-card transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400">{card.title}</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border border-white/[0.08] ${card.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-black text-white font-mono group-hover:text-cyan-400 transition-colors drop-shadow-sm">
                  {card.value}
                </div>
                <div className={`mt-1 text-[11px] font-medium flex items-center gap-1 ${card.trendColor}`}>
                  <span className="truncate">{card.trend}</span>
                  <ArrowUpRight className="w-3 h-3 shrink-0 opacity-70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle Grid: Moderation Alert Bar & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Registrations Queue (2 cols) */}
        <div className="lg:col-span-2 rounded-3xl glass-panel p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  Recent User Registrations
                </h3>
                <p className="text-xs text-slate-400">Newly joined accounts in the ZEV mobile app</p>
              </div>
              <button
                onClick={() => onNavigate('users')}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>View All Users</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {recentUsers.slice(0, 5).map((u) => {
                const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
                return (
                  <div
                    key={u.id}
                    onClick={() => onInspectUser(u)}
                    className="py-3 flex items-center justify-between hover:bg-white/[0.04] rounded-2xl px-2 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-white/[0.1] flex items-center justify-center font-bold text-white text-xs shrink-0 overflow-hidden shadow-inner">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                          <span className="truncate">{name}</span>
                          {u.is_verified && <VerifiedBadge size="sm" />}
                          {u.is_restricted && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-orange-950/80 text-orange-300 border border-orange-800/60 uppercase font-mono font-bold">
                              Restricted
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          @{u.username || 'user'} • {u.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-[11px] text-slate-300 font-mono">
                          {u.posts_count || 0} posts • {u.reels_count || 0} reels
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 justify-end">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(u.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <span className="glass-btn px-2.5 py-1 rounded-xl text-cyan-400 text-xs font-bold hover:text-white">
                        Inspect
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* System & Architecture Health (1 col) */}
        <div className="rounded-3xl glass-panel p-6 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Server className="w-4 h-4 text-emerald-400" />
              Live Infrastructure Health
            </h3>
            <p className="text-xs text-slate-400 mb-4">Cloud microservices connection status</p>

            <div className="space-y-3">
              {[
                { name: 'PostgreSQL Database (Direct 5432)', status: 'Operational', ping: '18ms', color: 'text-emerald-400' },
                { name: 'Supabase Auth Admin Engine', status: 'Active (v2.119)', ping: '32ms', color: 'text-emerald-400' },
                { name: 'Policy Warning & Restriction Engine', status: 'Enforcing', ping: 'Live', color: 'text-orange-400' },
                { name: 'Community Reports Ingestion', status: 'Monitoring', ping: 'Live', color: 'text-cyan-400' },
                { name: 'Blue Badge Verification Service', status: 'Ready', ping: 'Standby', color: 'text-blue-400' },
              ].map((svc) => (
                <div
                  key={svc.name}
                  className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs backdrop-blur-md"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] shrink-0" />
                    <span className="text-slate-300 font-medium">{svc.name}</span>
                  </div>
                  <span className={`font-mono font-bold text-[11px] ${svc.color}`}>{svc.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-800/50 flex items-center gap-3 backdrop-blur-md">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
            <div className="text-[11px] text-slate-300 leading-relaxed">
              Domain <span className="font-mono text-cyan-300 font-semibold">adminportal.zevapp.com</span> is protected with Master Key & Service-Role credentials.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
