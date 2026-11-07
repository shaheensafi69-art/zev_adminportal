'use client';

import React from 'react';
import { Search, X, Sparkles, Ban, ShieldCheck, Mail, Users, Download, ShieldAlert } from 'lucide-react';
import { AdminUser } from '@/lib/types';

interface UserFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  totalFiltered: number;
  usersToExport?: AdminUser[];
}

export function UserFilters({
  search,
  onSearchChange,
  activeTab,
  onTabChange,
  totalFiltered,
  usersToExport = [],
}: UserFiltersProps) {
  const tabs = [
    { id: 'all', label: 'All Users', icon: Users },
    { id: 'verified', label: 'Blue Badge', icon: Sparkles, color: 'text-cyan-400' },
    { id: 'restricted', label: 'Restricted', icon: ShieldAlert, color: 'text-orange-400' },
    { id: 'unverified', label: 'Unverified', icon: ShieldCheck },
    { id: 'banned', label: 'Banned', icon: Ban, color: 'text-rose-400' },
    { id: 'unconfirmed', label: 'Unconfirmed Email', icon: Mail, color: 'text-amber-400' },
  ];

  const exportCSV = () => {
    if (!usersToExport || usersToExport.length === 0) return;
    const headers = ['UUID', 'Email', 'First Name', 'Last Name', 'Username', 'Phone', 'Country', 'Verified', 'Banned', 'Posts', 'Reels', 'Created At'];
    const rows = usersToExport.map((u) => [
      `"${u.id}"`,
      `"${u.email}"`,
      `"${u.first_name || ''}"`,
      `"${u.last_name || ''}"`,
      `"${u.username || ''}"`,
      `"${u.phone_number || ''}"`,
      `"${u.country || ''}"`,
      u.is_verified ? 'YES' : 'NO',
      u.is_banned ? 'YES' : 'NO',
      u.posts_count || 0,
      u.reels_count || 0,
      `"${u.created_at}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `zev_users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-panel rounded-3xl p-4 sm:p-5 mb-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        
        {/* Search input */}
        <div className="relative flex-1 max-w-lg">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search className="w-4 h-4 text-cyan-400/80" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, username, email, phone, or UUID..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl glass-input text-sm text-slate-100 placeholder-slate-400 focus:outline-none transition-all font-sans"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Export Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            title="Download CSV export"
            className="glass-btn inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-slate-200 text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>

      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/[0.06] overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 flex-nowrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer select-none ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20 backdrop-blur-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.color || (isActive ? 'text-cyan-400' : 'text-slate-500')}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 whitespace-nowrap hidden sm:block">
          Showing <span className="font-bold text-white font-mono">{totalFiltered}</span> users
        </div>
      </div>
    </div>
  );
}
