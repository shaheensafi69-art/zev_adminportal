'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { StatsCards } from '@/components/StatsCards';
import { UserFilters } from '@/components/UserFilters';
import { UserTable } from '@/components/UserTable';
import { LoginView } from '@/components/LoginView';
import { BlueTickModal } from '@/components/modals/BlueTickModal';
import { BanModal } from '@/components/modals/BanModal';
import { DeleteModal } from '@/components/modals/DeleteModal';
import { EditUserModal } from '@/components/modals/EditUserModal';
import { UserDetailModal } from '@/components/modals/UserDetailModal';
import { AdminUser, DashboardStats } from '@/lib/types';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export default function AdminPage() {
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

  // Filter states
  const [search, setSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // Modal states
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isBlueTickOpen, setIsBlueTickOpen] = useState(false);
  const [isBanOpen, setIsBanOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Notification Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
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
        role: selectedRole,
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
      } else {
        showToast(data.error || 'Failed to fetch users', 'error');
      }
    } catch (err: unknown) {
      const error = err as Error;
      showToast(error.message || 'Server connection error', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, selectedRole, search, pagination.limit, pagination.page]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchUsers(1);
    }
  }, [isAuthenticated, activeTab, selectedRole, search, fetchStats, fetchUsers]);

  // Refresh both
  const handleRefresh = async () => {
    await Promise.all([fetchStats(), fetchUsers(pagination.page)]);
    showToast('Data refreshed successfully');
  };

  // User Actions
  const handleToggleBlueTick = async (userId: string, isVerified: boolean, badgeLabel: string, reason: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'TOGGLE_BLUE_TICK',
        userId,
        payload: { isVerified, badgeLabel, reason },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update blue badge');
    }

    showToast(data.message || 'Blue badge status updated');
    await Promise.all([fetchStats(), fetchUsers()]);
  };

  const handleQuickConfirmEmail = async (userId: string) => {
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
      throw new Error(data.error || 'Failed to confirm email');
    }

    showToast('User email confirmed successfully');
    await Promise.all([fetchStats(), fetchUsers()]);
  };

  const handleBanUser = async (userId: string, durationHours: number, reason: string) => {
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
      throw new Error(data.error || 'Failed to ban user');
    }

    showToast('User account has been suspended (Banned)');
    await Promise.all([fetchStats(), fetchUsers()]);
  };

  const handleUnbanUser = async (userId: string) => {
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
      throw new Error(data.error || 'Failed to lift ban');
    }

    showToast('User account restriction lifted (Unbanned)');
    await Promise.all([fetchStats(), fetchUsers()]);
  };

  const handleDeleteUser = async (userId: string) => {
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
      throw new Error(data.error || 'Failed to delete user');
    }

    showToast('User and associated records permanently deleted');
    await Promise.all([fetchStats(), fetchUsers(1)]);
  };

  const handleChangeRole = async (userId: string, role: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPDATE_ROLE',
        userId,
        payload: { role },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update user role');
    }

    showToast(data.message || 'User role updated');
    await fetchUsers();
  };

  const handleEditProfile = async (
    userId: string,
    payload: {
      firstName: string;
      lastName: string;
      username: string;
      walletBalance: number;
      totalScore: number;
    }
  ) => {
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
      throw new Error(data.error || 'Failed to update profile');
    }

    showToast('Profile information updated successfully');
    await fetchUsers();
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setIsAuthenticated(false);
  };

  // Loading initial authentication state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080b11]">
        <div className="w-9 h-9 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If not logged in, render Login View
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#080b11] text-slate-100">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-xs font-bold animate-in slide-in-from-bottom duration-300">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="text-white">{toast.message}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        onRefresh={handleRefresh}
        isLoading={isLoading}
        onLogout={handleLogout}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* KPI Metrics */}
        <StatsCards
          stats={stats}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          isLoading={isLoading && !stats}
        />

        {/* Filter Toolbar */}
        <UserFilters
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          selectedRole={selectedRole}
          onRoleChange={(role) => {
            setSelectedRole(role);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          totalFiltered={pagination.total}
          usersToExport={users}
        />

        {/* User Data Table */}
        <UserTable
          users={users}
          isLoading={isLoading}
          pagination={pagination}
          onPageChange={(newPage) => {
            setPagination((p) => ({ ...p, page: newPage }));
            fetchUsers(newPage);
          }}
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
          onOpenDelete={(u) => {
            setSelectedUser(u);
            setIsDeleteOpen(true);
          }}
          onQuickConfirmEmail={handleQuickConfirmEmail}
        />

      </main>

      {/* Modals */}
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
        onOpenDelete={(u) => {
          setSelectedUser(u);
          setIsDeleteOpen(true);
        }}
        onConfirmEmail={handleQuickConfirmEmail}
        onChangeRole={handleChangeRole}
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

      <DeleteModal
        user={selectedUser}
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirmDelete={handleDeleteUser}
      />

    </div>
  );
}
