'use client';

import React from 'react';
import { 
  LayoutDashboard, Users, ShieldAlert, AlertTriangle, 
  Film, Sparkles, Database, FileText, ChevronLeft, ChevronRight,
  LogOut, Globe, CheckCircle2, ShieldCheck, PanelLeftClose, PanelLeftOpen,
  CreditCard, Share2, HelpCircle
} from 'lucide-react';
import { DashboardStats } from '@/lib/types';

export type NavView = 
  | 'dashboard' 
  | 'users' 
  | 'restrictions' 
  | 'reports' 
  | 'content' 
  | 'verifications' 
  | 'subscriptions'
  | 'referrals'
  | 'support'
  | 'database' 
  | 'audit';

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  stats: DashboardStats | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
  adminName?: string;
}

export function Sidebar({
  currentView,
  onSelectView,
  stats,
  collapsed,
  onToggleCollapse,
  onLogout,
  adminName = 'Lead Admin',
}: SidebarProps) {
  const navItems = [
    {
      group: 'MAIN CONSOLE',
      items: [
        {
          id: 'dashboard' as NavView,
          label: 'Overview & KPIs',
          icon: LayoutDashboard,
          badge: null,
          badgeColor: '',
        },
        {
          id: 'users' as NavView,
          label: 'User Directory',
          icon: Users,
          badge: stats?.totalUsers || null,
          badgeColor: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
        },
      ],
    },
    {
      group: 'MODERATION & TRUST',
      items: [
        {
          id: 'restrictions' as NavView,
          label: 'Restricted & Warnings',
          icon: ShieldAlert,
          badge: stats?.restrictedUsers ? `${stats.restrictedUsers}` : null,
          badgeColor: 'bg-orange-950/80 text-orange-300 border-orange-800/60',
        },
        {
          id: 'reports' as NavView,
          label: 'Flagged Reports',
          icon: AlertTriangle,
          badge: stats?.pendingReports ? `${stats.pendingReports}` : null,
          badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
        },
        {
          id: 'content' as NavView,
          label: 'Content Moderation',
          icon: Film,
          badge: stats ? `${(stats.totalPosts || 0) + (stats.totalReels || 0)}` : null,
          badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
        },
        {
          id: 'verifications' as NavView,
          label: 'Verification Center',
          icon: Sparkles,
          badge: stats?.verifiedUsers ? `${stats.verifiedUsers}` : null,
          badgeColor: 'bg-blue-950/80 text-blue-300 border-blue-800/60',
        },
      ],
    },
    {
      group: 'MONETIZATION & GROWTH',
      items: [
        {
          id: 'subscriptions' as NavView,
          label: 'VIP & Subscriptions',
          icon: CreditCard,
          badge: 'ZEV Blue',
          badgeColor: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60',
        },
        {
          id: 'referrals' as NavView,
          label: 'Referral Ecosystem',
          icon: Share2,
          badge: 'Viral',
          badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
        },
      ],
    },
    {
      group: 'SUPPORT & CARE',
      items: [
        {
          id: 'support' as NavView,
          label: 'Support Tickets',
          icon: HelpCircle,
          badge: null,
          badgeColor: '',
        },
      ],
    },
    {
      group: 'INFRASTRUCTURE',
      items: [
        {
          id: 'database' as NavView,
          label: 'Database Explorer',
          icon: Database,
          badge: '0-100',
          badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
        },
        {
          id: 'audit' as NavView,
          label: 'Audit Trail Logs',
          icon: FileText,
          badge: null,
          badgeColor: '',
        },
      ],
    },
  ];

  return (
    <aside
      className={`h-screen sticky top-0 bg-[#070b14]/75 backdrop-blur-2xl border-r border-white/[0.08] flex flex-col justify-between transition-all duration-300 z-30 select-none shadow-[4px_0_24px_rgba(0,0,0,0.4)] ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-col">
        {/* Top brand header */}
        <div className={`border-b border-white/[0.08] transition-all flex items-center ${
          collapsed 
            ? 'h-20 flex-col justify-center gap-1.5 px-2 py-2' 
            : 'h-16 justify-between px-4'
        }`}>
          {collapsed ? (
            // Collapsed layout: centered logo with mini toggle
            <div className="flex flex-col items-center gap-1">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-cyan-500/25 ring-1 ring-white/20">
                <span>Z</span>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-[#070b14] animate-pulse" />
              </div>
              <button
                onClick={onToggleCollapse}
                className="p-1 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                title="Expand Sidebar"
              >
                <PanelLeftOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            // Expanded layout
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-cyan-500/25 ring-1 ring-white/20">
                  <span>Z</span>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#070b14] animate-pulse" />
                </div>

                <div className="min-w-0">
                  <div className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5 truncate">
                    <span>ZEV</span>
                    <span className="text-[10px] font-mono text-cyan-300 font-bold px-1.5 py-0.2 rounded-md bg-cyan-950/80 border border-cyan-800/60 shadow-sm shadow-cyan-950/50">
                      Console
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 truncate">
                    <Globe className="w-2.5 h-2.5 text-cyan-500 shrink-0" />
                    <span className="truncate">adminportal.zevapp.com</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onToggleCollapse}
                className="w-7 h-7 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center border border-white/[0.08] transition-all cursor-pointer shrink-0 shadow-sm"
                title="Collapse Sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Database Live Status Indicator (Expanded Only) */}
        {!collapsed && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md flex items-center justify-between text-[11px] shadow-inner">
            <span className="text-slate-400 flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              PostgreSQL
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono text-[10px]">
              <CheckCircle2 className="w-3 h-3" />
              Live Connected
            </span>
          </div>
        )}

        {/* Navigation Items */}
        <div className="px-2.5 py-4 space-y-5 overflow-y-auto max-h-[calc(100vh-210px)] scrollbar-none">
          {navItems.map((group) => (
            <div key={group.group}>
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  {group.group}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;

                  return (
                    <div key={item.id} className="relative group">
                      <button
                        onClick={() => onSelectView(item.id)}
                        className={`w-full flex items-center transition-all cursor-pointer relative ${
                          collapsed 
                            ? 'w-12 h-12 mx-auto justify-center rounded-2xl' 
                            : 'px-3 py-2.5 rounded-2xl gap-3 text-xs'
                        } ${
                          isActive
                            ? 'bg-gradient-to-r from-cyan-500/15 via-cyan-500/10 to-transparent text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-950/30 font-bold backdrop-blur-md'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
                        }`}
                      >
                        {/* Glowing left edge for active item */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-cyan-400 to-sky-500 rounded-r-full shadow-[0_0_12px_#06b6d4]" />
                        )}

                        <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                          isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : 'text-slate-400 group-hover:text-slate-200'
                        }`} />

                        {!collapsed && (
                          <div className="flex-1 flex items-center justify-between min-w-0">
                            <span className="truncate">{item.label}</span>
                            {item.badge && (
                              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-mono border truncate font-bold shadow-sm ${item.badgeColor}`}>
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                      </button>

                      {/* Tooltip for Collapsed Mode */}
                      {collapsed && (
                        <div className="pointer-events-none absolute left-16 top-1/2 -translate-y-1/2 z-50 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-white/[0.12] shadow-2xl backdrop-blur-xl text-xs font-bold text-white whitespace-nowrap opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 flex items-center gap-2">
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-mono border ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Profile & Sign Out */}
      <div className="p-3 border-t border-white/[0.08] bg-[#070b14]/90 backdrop-blur-xl">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2.5 min-w-0 pl-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-white/[0.1] flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{adminName}</div>
                <div className="text-[10px] font-mono text-cyan-400 truncate">Super Admin</div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm hover:shadow-rose-950"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative group flex justify-center">
            <button
              onClick={onLogout}
              className="w-11 h-11 rounded-2xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:shadow-rose-950"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <div className="pointer-events-none absolute left-16 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-rose-300 whitespace-nowrap opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all">
              Sign Out
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
