'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavView } from '@/components/Sidebar';
import { DashboardView } from '@/components/views/DashboardView';
import { RestrictionsView } from '@/components/views/RestrictionsView';
import { ContentView } from '@/components/views/ContentView';
import { VerificationsView } from '@/components/views/VerificationsView';
import { SubscriptionsView } from '@/components/views/SubscriptionsView';
import { ReferralsView } from '@/components/views/ReferralsView';
import { AdsMonetizationView } from '@/components/views/AdsMonetizationView';
import { SupportTicketsView } from '@/components/views/SupportTicketsView';
import { DatabaseView } from '@/components/views/DatabaseView';
import { AuditLogsView } from '@/components/views/AuditLogsView';
import { ReportsView } from '@/components/views/ReportsView';
import { AppealsView } from '@/components/views/AppealsView';
import { PushNotificationsView } from '@/components/views/PushNotificationsView';
import { LiveStreamsView } from '@/components/views/LiveStreamsView';
import { SecuritySessionsView } from '@/components/views/SecuritySessionsView';
import { SystemHealthView } from '@/components/views/SystemHealthView';
import { UserFilters } from '@/components/UserFilters';
import { UserTable } from '@/components/UserTable';
import { LoginView } from '@/components/LoginView';
import { BlueTickModal } from '@/components/modals/BlueTickModal';
import { BanModal } from '@/components/modals/BanModal';
import { RestrictModal } from '@/components/modals/RestrictModal';
import { DeleteModal } from '@/components/modals/DeleteModal';
import { EditUserModal } from '@/components/modals/EditUserModal';
import { UserDetailModal } from '@/components/modals/UserDetailModal';
import { AdminUser, DashboardStats } from '@/lib/types';
import { 
  CheckCircle2, AlertTriangle, RefreshCw, ShieldAlert
} from 'lucide-react';

export default function AdminPage() {
  // Navigation & UI state
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Data states
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  // Filter states for User Directory
  const [search, setSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('all');

  // Modal states
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isBlueTickOpen, setIsBlueTickOpen] = useState(false);
  const [isBanOpen, setIsBanOpen] = useState(false);
  const [isRestrictOpen, setIsRestrictOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Notification Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Check auth status
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth');
      const data = await res.json();
      setIsAuthenticated(Boolean(data.authenticated));
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  // Fetch users list
  const fetchUsers = useCallback(async (pageToLoad = pagination.page) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageToLoad.toString(),
        limit: pagination.limit.toString(),
        tab: activeTab,
        search: search.trim(),
      });

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setUsers(data.users || []);
        setPagination((prev) => ({
          ...prev,
          page: data.pagination.page,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      showToast('Failed to fetch users from server', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, search, pagination.limit, pagination.page]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchUsers();
    }
  }, [isAuthenticated, fetchStats, fetchUsers]);

  const handleRefresh = async () => {
    await Promise.all([fetchStats(), fetchUsers()]);
    showToast('Platform metrics and live records refreshed');
  };

  // User Actions with Instant State & Direct DB Persistence
  const handleToggleBlueTick = async (
    userId: string, 
    isVerified: boolean, 
    badgeLabel?: string, 
    reason?: string,
    planType?: string,
    customDays?: number | null
  ) => {
    // Instant UI reflection
    const now = new Date();
    let calculatedExpiresAt: string | null = null;
    if (isVerified) {
      if (planType === 'monthly') {
        calculatedExpiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
      } else if (planType === 'yearly') {
        calculatedExpiresAt = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString();
      } else if (planType === 'custom' && customDays) {
        calculatedExpiresAt = new Date(now.getTime() + customDays * 24 * 3600 * 1000).toISOString();
      }
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              is_verified: isVerified,
              verification_info: isVerified
                ? {
                    id: u.verification_info?.id || `uv-${Date.now()}`,
                    user_id: userId,
                    badge_type: 'blue_tick',
                    status: 'verified',
                    is_active: true,
                    plan_type: planType || 'lifetime',
                    badge_label: badgeLabel || 'Verified Official',
                    verification_reason: reason || 'Official Accreditation',
                    verified_at: now.toISOString(),
                    expires_at: calculatedExpiresAt,
                    created_at: now.toISOString(),
                  }
                : null,
            }
          : u
      )
    );
    setSelectedUser((prev) =>
      prev && prev.id === userId
        ? {
            ...prev,
            is_verified: isVerified,
            verification_info: isVerified
              ? {
                  id: prev.verification_info?.id || `uv-${Date.now()}`,
                  user_id: userId,
                  badge_type: 'blue_tick',
                  status: 'verified',
                  is_active: true,
                  plan_type: planType || 'lifetime',
                  badge_label: badgeLabel || 'Verified Official',
                  verification_reason: reason || 'Official Accreditation',
                  verified_at: now.toISOString(),
                  expires_at: calculatedExpiresAt,
                  created_at: now.toISOString(),
                }
              : null,
          }
        : prev
    );

    const res = await fetch('/api/admin/verifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: isVerified ? 'GRANT_SUBSCRIPTION' : 'REVOKE_SUBSCRIPTION',
        userId,
        payload: { isVerified, badgeLabel, reason, planType, customDays },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      await fetchUsers();
      throw new Error(data.error || 'Failed to update verification status');
    }

    showToast(isVerified ? `Official Blue Badge activated (${planType || 'lifetime'})` : 'Blue Badge revoked');
    await Promise.all([fetchStats(), fetchUsers()]);
  };

  const handleQuickConfirmEmail = async (userId: string) => {
    // Instant UI reflection
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, email_confirmed: true } : u)));
    setSelectedUser((prev) => (prev && prev.id === userId ? { ...prev, email_confirmed: true } : prev));

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CONFIRM_EMAIL',
        userId,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      await fetchUsers();
      throw new Error(data.error || 'Failed to confirm email');
    }

    showToast('User email confirmed in database');
    await fetchUsers();
  };

  // Disciplinary Warnings & Restrictions
  const handleWarnUser = async (userId: string, payload: { reason: string; details: string; warningLevel: number }) => {
    // Instant UI reflection
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, warning_count: (u.warning_count || 0) + 1 } : u
      )
    );

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'WARN_USER',
        userId,
        payload,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      await fetchUsers();
      throw new Error(data.error || 'Failed to issue policy warning');
    }

    showToast(`Official Policy Warning #${payload.warningLevel} dispatched`);
    await Promise.all([fetchStats(), fetchUsers()]);
  };

  const handleRestrictUser = async (userId: string, payload: { reason: string; durationHours: number | null; details: string }) => {
    // Instant UI reflection
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, is_restricted: true, restriction_reason: payload.reason } : u
      )
    );
    setSelectedUser((prev) =>
      prev && prev.id === userId
        ? { ...prev, is_restricted: true, restriction_reason: payload.reason }
        : prev
    );

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RESTRICT_USER',
        userId,
        payload,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      await fetchUsers();
      throw new Error(data.error || 'Failed to restrict account');
    }

    showToast('User account placed under policy restriction');
    await Promise.all([fetchStats(), fetchUsers()]);
  };

  const handleUnrestrictUser = async (userId: string) => {
    // Instant UI reflection
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, is_restricted: false, restriction_reason: null } : u
      )
    );
    setSelectedUser((prev) =>
      prev && prev.id === userId
        ? { ...prev, is_restricted: false, restriction_reason: null }
        : prev
    );

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UNRESTRICT_USER',
        userId,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      await fetchUsers();
      throw new Error(data.error || 'Failed to lift restriction');
    }

    showToast('Account restriction lifted successfully');
    await Promise.all([fetchStats(), fetchUsers()]);
  };

  const handleBanUser = async (userId: string, durationHours: number, reason: string) => {
    // Instant UI reflection
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: true } : u)));
    setSelectedUser((prev) => (prev && prev.id === userId ? { ...prev, is_banned: true } : prev));

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'BAN_USER',
        userId,
        payload: { durationHours, reason },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      await fetchUsers();
      throw new Error(data.error || 'Failed to ban user');
    }

    showToast('User account suspended and banned');
    await Promise.all([fetchStats(), fetchUsers()]);
  };

  const handleUnbanUser = async (userId: string) => {
    // Instant UI reflection
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_banned: false, banned_until: null } : u))
    );
    setSelectedUser((prev) =>
      prev && prev.id === userId ? { ...prev, is_banned: false, banned_until: null } : prev
    );

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UNBAN_USER',
        userId,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      await fetchUsers();
      throw new Error(data.error || 'Failed to lift suspension');
    }

    showToast('User suspension has been lifted');
    await Promise.all([fetchStats(), fetchUsers()]);
  };

  const handleDeleteUser = async (userId: string) => {
    // Instant UI reflection
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setSelectedUser((prev) => (prev && prev.id === userId ? null : prev));
    setIsDetailOpen(false);

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'DELETE_USER',
        userId,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      await fetchUsers();
      throw new Error(data.error || 'Failed to delete user');
    }

    showToast('User and associated records permanently deleted');
    await Promise.all([fetchStats(), fetchUsers(1)]);
  };

  const handleEditProfile = async (
    userId: string,
    payload: {
      firstName: string;
      lastName: string;
      username: string;
      bio?: string;
      phoneNumber?: string;
      country?: string;
    }
  ) => {
    // Instant UI reflection
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              first_name: payload.firstName,
              last_name: payload.lastName,
              username: payload.username,
              bio: payload.bio !== undefined ? payload.bio : u.bio,
              phone_number: payload.phoneNumber !== undefined ? payload.phoneNumber : u.phone_number,
              country: payload.country !== undefined ? payload.country : u.country,
            }
          : u
      )
    );
    setSelectedUser((prev) =>
      prev && prev.id === userId
        ? {
            ...prev,
            first_name: payload.firstName,
            last_name: payload.lastName,
            username: payload.username,
            bio: payload.bio !== undefined ? payload.bio : prev.bio,
            phone_number: payload.phoneNumber !== undefined ? payload.phoneNumber : prev.phone_number,
            country: payload.country !== undefined ? payload.country : prev.country,
          }
        : prev
    );

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPDATE_PROFILE',
        userId,
        payload,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      await fetchUsers();
      throw new Error(data.error || 'Failed to update profile');
    }

    showToast('Profile information updated successfully');
    await fetchUsers();
  };

  const handleInspectUserById = async (userId: string) => {
    const existing = users.find((u) => u.id === userId);
    if (existing) {
      setSelectedUser(existing);
      setIsDetailOpen(true);
    } else {
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (data.success && data.users && data.users.length > 0) {
          setSelectedUser(data.users[0]);
          setIsDetailOpen(true);
        }
      } catch (err) {
        console.error('Failed to load user for inspection:', err);
      }
    }
  };

  const handleBanTarget = (target: { id: string; email: string }) => {
    setSelectedUser({
      id: target.id,
      email: target.email,
      email_confirmed: true,
      email_confirmed_at: null,
      first_name: null,
      last_name: null,
      username: null,
      avatar_url: null,
      bio: null,
      is_online: false,
      created_at: new Date().toISOString(),
      is_banned: false,
      banned_until: null,
      is_restricted: false,
      restricted_until: null,
      restriction_reason: null,
      warning_count: 0,
      last_warning_at: null,
      last_warning_reason: null,
      is_verified: false,
      phone_number: null,
      country: null,
      last_seen: null,
      posts_count: 0,
      reels_count: 0,
      followers_count: 0,
      following_count: 0,
      stories_count: 0,
    });
    setIsBanOpen(true);
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setIsAuthenticated(false);
  };

  // Loading initial authentication state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06080d]">
        <div className="w-10 h-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If not logged in, render Login View
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const getViewTitle = () => {
    switch (currentView) {
      case 'dashboard': return 'Overview & Analytics';
      case 'users': return 'User Management & 0-100 Dossier';
      case 'restrictions': return 'Disciplinary & Policy Warnings';
      case 'reports': return 'Community Moderation Reports';
      case 'appeals': return 'Standing & Restriction Appeals';
      case 'content': return 'Content Feed Moderation';
      case 'verifications': return 'Official Blue Badges';
      case 'subscriptions': return 'VIP & Blue Subscriptions';
      case 'referrals': return 'Referral Ecosystem & Rewards';
      case 'ads': return 'ZEV Ads & Monetization Engine';
      case 'support': return 'Support & User Care';
      case 'notifications': return 'Push Notifications & FCM Devices';
      case 'live': return 'ZEV Live Rooms & Presence';
      case 'security': return 'Security, Sessions & Deletions';
      case 'system': return 'System Health, Migrations & RPCs';
      case 'database': return '0-100 PostgreSQL Explorer';
      case 'audit': return 'Security Audit Trail';
      default: return 'Admin Console';
    }
  };

  return (
    <div className="min-h-screen flex bg-[#050811] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-x-hidden">
      
      {/* Ambient Clearmorphic Radial Glows */}
      <div className="fixed top-0 left-0 w-[550px] h-[550px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none -translate-x-1/3 -translate-y-1/3 z-0" />
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none translate-x-1/4 translate-y-1/4 z-0" />
      <div className="fixed inset-0 bg-grid-cyber pointer-events-none opacity-40 z-0" />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl glass-panel border border-white/[0.15] shadow-2xl text-xs font-bold animate-in slide-in-from-bottom duration-300">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="text-white">{toast.message}</span>
        </div>
      )}

      {/* Left Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        stats={stats}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onLogout={handleLogout}
      />

      {/* Right Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen relative z-10">
        
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 h-16 border-b border-white/[0.08] bg-[#070b14]/75 backdrop-blur-2xl px-6 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4] animate-pulse shrink-0" />
            <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight truncate flex items-center gap-2">
              <span className="text-slate-400 font-mono text-xs font-normal">Console /</span>
              <span>{getViewTitle()}</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick alert badge if restricted, reports, appeals, or deletions exist */}
            {stats && (stats.restrictedUsers > 0 || stats.pendingReports > 0 || (stats.pendingPostReports || 0) > 0 || (stats.pendingAppeals || 0) > 0 || (stats.pendingDeletions || 0) > 0) && (
              <button
                onClick={() =>
                  setCurrentView(
                    (stats.pendingAppeals || 0) > 0
                      ? 'appeals'
                      : (stats.pendingPostReports || 0) > 0 || stats.pendingReports > 0
                      ? 'reports'
                      : (stats.pendingDeletions || 0) > 0
                      ? 'security'
                      : 'restrictions'
                  )
                }
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-950/70 border border-orange-500/40 text-orange-300 text-xs font-bold transition-all hover:bg-orange-900/60 cursor-pointer shadow-lg shadow-orange-950/40"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                <span>
                  {stats.restrictedUsers} Restricted • {(stats.pendingReports || 0) + (stats.pendingPostReports || 0)} Reports • {stats.pendingAppeals || 0} Appeals
                </span>
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="glass-btn px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh all metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* View Content Container */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1">
          {currentView === 'dashboard' && (
            <DashboardView
              stats={stats}
              recentUsers={users}
              onNavigate={setCurrentView}
              onInspectUser={(u) => {
                setSelectedUser(u);
                setIsDetailOpen(true);
              }}
            />
          )}

          {currentView === 'users' && (
            <div className="space-y-4">
              <UserFilters
                search={search}
                onSearchChange={setSearch}
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setActiveTab(tab);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                totalFiltered={pagination.total}
                usersToExport={users}
              />

              <UserTable
                users={users}
                isLoading={isLoading}
                pagination={pagination}
                onPageChange={(page) => fetchUsers(page)}
                onOpenDetails={(u) => {
                  setSelectedUser(u);
                  setIsDetailOpen(true);
                }}
                onOpenEdit={(u) => {
                  setSelectedUser(u);
                  setIsEditOpen(true);
                }}
                onOpenBlueTick={(u) => {
                  setSelectedUser(u);
                  setIsBlueTickOpen(true);
                }}
                onOpenBan={(u) => {
                  setSelectedUser(u);
                  setIsBanOpen(true);
                }}
                onOpenRestrict={(u) => {
                  setSelectedUser(u);
                  setIsRestrictOpen(true);
                }}
                onOpenDelete={(u) => {
                  setSelectedUser(u);
                  setIsDeleteOpen(true);
                }}
                onQuickConfirmEmail={handleQuickConfirmEmail}
              />
            </div>
          )}

          {currentView === 'restrictions' && (
            <RestrictionsView
              onInspectUserById={handleInspectUserById}
              onBanUser={handleBanTarget}
              onOpenRestrictModal={(u) => {
                setSelectedUser(u);
                setIsRestrictOpen(true);
              }}
            />
          )}

          {currentView === 'reports' && (
            <ReportsView
              onInspectUserById={handleInspectUserById}
              onBanUser={handleBanTarget}
            />
          )}

          {currentView === 'appeals' && (
            <AppealsView
              onInspectUserById={handleInspectUserById}
              onAppealUpdated={async () => {
                await Promise.all([fetchStats(), fetchUsers()]);
              }}
            />
          )}

          {currentView === 'content' && (
            <ContentView
              onInspectUserById={handleInspectUserById}
            />
          )}

          {currentView === 'verifications' && (
            <VerificationsView
              onInspectUser={(u) => {
                setSelectedUser(u);
                setIsDetailOpen(true);
              }}
              onOpenBlueTick={(u) => {
                setSelectedUser(u);
                setIsBlueTickOpen(true);
              }}
            />
          )}

          {currentView === 'subscriptions' && (
            <SubscriptionsView
              onInspectUserById={handleInspectUserById}
            />
          )}

          {currentView === 'referrals' && (
            <ReferralsView
              onInspectUserById={handleInspectUserById}
            />
          )}

          {currentView === 'ads' && (
            <AdsMonetizationView
              onInspectUserById={handleInspectUserById}
            />
          )}

          {currentView === 'support' && (
            <SupportTicketsView
              onInspectUserById={handleInspectUserById}
            />
          )}

          {currentView === 'notifications' && (
            <PushNotificationsView
              onInspectUserById={handleInspectUserById}
            />
          )}

          {currentView === 'live' && (
            <LiveStreamsView
              onInspectUserById={handleInspectUserById}
            />
          )}

          {currentView === 'security' && (
            <SecuritySessionsView
              onInspectUserById={handleInspectUserById}
            />
          )}

          {currentView === 'system' && (
            <SystemHealthView />
          )}

          {currentView === 'database' && (
            <DatabaseView />
          )}

          {currentView === 'audit' && (
            <AuditLogsView />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <UserDetailModal
        user={selectedUser}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onOpenEdit={(u) => {
          setSelectedUser(u);
          setIsEditOpen(true);
        }}
        onOpenBlueTick={(u) => {
          setSelectedUser(u);
          setIsBlueTickOpen(true);
        }}
        onOpenBan={(u) => {
          setSelectedUser(u);
          setIsBanOpen(true);
        }}
        onOpenRestrict={(u) => {
          setSelectedUser(u);
          setIsRestrictOpen(true);
        }}
        onOpenDelete={(u) => {
          setSelectedUser(u);
          setIsDeleteOpen(true);
        }}
        onConfirmEmail={handleQuickConfirmEmail}
      />

      <EditUserModal
        user={selectedUser}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onConfirmEdit={handleEditProfile}
      />

      <BlueTickModal
        user={selectedUser}
        isOpen={isBlueTickOpen}
        onClose={() => setIsBlueTickOpen(false)}
        onConfirm={handleToggleBlueTick}
      />

      <BanModal
        user={selectedUser}
        isOpen={isBanOpen}
        onClose={() => setIsBanOpen(false)}
        onConfirmBan={handleBanUser}
        onConfirmUnban={handleUnbanUser}
      />

      {/* Disciplinary Policy & Restriction Modal */}
      <RestrictModal
        user={selectedUser}
        isOpen={isRestrictOpen}
        onClose={() => setIsRestrictOpen(false)}
        onConfirmWarn={handleWarnUser}
        onConfirmRestrict={handleRestrictUser}
        onConfirmUnrestrict={handleUnrestrictUser}
      />

      <DeleteModal
        user={selectedUser}
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirmDelete={handleDeleteUser}
      />

    </div>
  );
}
