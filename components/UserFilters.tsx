'use client';

import React from 'react';
import { Search, X, Filter, Sparkles, Ban, ShieldCheck, Mail, Users } from 'lucide-react';

interface UserFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedRole: string;
  onRoleChange: (role: string) => void;
  totalFiltered: number;
}

export function UserFilters({
  search,
  onSearchChange,
  activeTab,
  onTabChange,
  selectedRole,
  onRoleChange,
  totalFiltered,
}: UserFiltersProps) {
  const tabs = [
    { id: 'all', label: 'همه کاربران', icon: Users },
    { id: 'verified', label: 'تیک آبی رسمی', icon: Sparkles, color: 'text-cyan-400' },
    { id: 'unverified', label: 'بدون تیک آبی', icon: ShieldCheck },
    { id: 'banned', label: 'مسدود شده‌ها (Ban)', icon: Ban, color: 'text-rose-400' },
    { id: 'unconfirmed', label: 'ایمیل تایید نشده', icon: Mail, color: 'text-amber-400' },
  ];

  const roles = [
    { value: 'all', label: 'همه نقش‌ها' },
    { value: 'student', label: 'دانش‌آموز / کاربر عادی (Student)' },
    { value: 'teacher', label: 'مدرس / استاد (Teacher)' },
    { value: 'admin', label: 'مدیر (Admin)' },
    { value: 'super_admin', label: 'مدیر ارشد (Super Admin)' },
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 mb-6 backdrop-blur-xl">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="جستجو بر اساس نام، نام کاربری، ایمیل، شماره تلفن یا شناسه..."
            className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-sans"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Role select */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>فیلتر نقش:</span>
          </div>
          <select
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value)}
            className="py-2 px-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 cursor-pointer"
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-800/80 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 flex-nowrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer select-none ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.color || (isActive ? 'text-cyan-400' : 'text-slate-500')}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 whitespace-nowrap hidden sm:block">
          نمایش <span className="font-bold text-white">{totalFiltered}</span> نتیجه
        </div>
      </div>
    </div>
  );
}

