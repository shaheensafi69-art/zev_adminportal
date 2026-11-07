'use client';

import React from 'react';
import { 
  LayoutDashboard, Users, ShieldAlert, AlertTriangle, 
  Film, Sparkles, Database, FileText, ChevronLeft, ChevronRight,
  LogOut, Globe, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { DashboardStats } from '@/lib/types';

export type NavView = 
  | 'dashboard' 
  | 'users' 
  | 'restrictions' 
  | 'reports' 
  | 'content' 
  | 'verifications' 
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
          badge: stats?.restrictedUsers ? `${stats.restrictedUsers} active` : null,
          badgeColor: 'bg-orange-950/80 text-orange-300 border-orange-800/60',
        },
        {
          id: 'reports' as NavView,
          label: 'Flagged Reports',
          icon: AlertTriangle,
          badge: stats?.pendingReports ? `${stats.pendingReports} pending` : null,
          badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
        },
        {
          id: 'content' as NavView,
          label: 'Content Moderation',
          icon: Film,
          badge: stats ? `${(stats.totalPosts || 0) + (stats.totalReels || 0)} items` : null,
          badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
        },
        {
          id: 'verifications' as NavView,
          label: 'Verification Center',
          icon: Sparkles,
          badge: stats?.verifiedUsers ? `${stats.verifiedUsers} verified` : null,
          badgeColor: 'bg-blue-950/80 text-blue-300 border-blue-800/60',
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
      className={`h-screen sticky top-0 bg-[#06080d] border-r border-slate-800/80 flex flex-col justify-between transition-all duration-300 z-30 select-none ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="h-16 border-b border-slate-800/80 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Logo */}
            <div className="relative w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-md shadow-cyan-500/20 ring-1 ring-white/20">
              <span>Z</span>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#06080d] animate-pulse" />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <div className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5 truncate">
                  <span>ZEV</span>
                  <span className="text-[11px] font-mono text-cyan-400 font-semibold px-1.5 py-0.2 rounded bg-cyan-950/70 border border-cyan-800/50">
                    Console
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 truncate">
                  <Globe className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                  <span className="truncate">adminportal.zevapp.com</span>
                </div>
              </div>
            )}
          </div>

          {/* Collapse Toggle Button */}
          <button
            onClick={onToggleCollapse}
            className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-slate-800 transition-colors cursor-pointer shrink-0"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Database Live Status Indicator */}
        {!collapsed && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              PostgreSQL
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Live Connected
            </span>
          </div>
        )}

        {/* Navigation Groups */}
        <div className="px-3 py-4 space-y-5 overflow-y-auto max-h-[calc(100vh-220px)]">
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
                    <button
                      key={item.id}
                      onClick={() => onSelectView(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-950/70 to-slate-900 text-cyan-300 border border-cyan-800/60 shadow-lg shadow-cyan-950/40'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                      } ${collapsed ? 'justify-center px-0' : ''}`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`} />

                      {!collapsed && (
                        <div className="flex-1 flex items-center justify-between min-w-0">
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-mono border truncate ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom User Profile & Sign Out */}
      <div className="p-3 border-t border-slate-800/80 bg-[#07090f]">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{adminName}</div>
                <div className="text-[10px] font-mono text-cyan-400 truncate">Super Administrator</div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogout}
            className="w-full py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
