'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Coins,
  DollarSign,
  TrendingUp,
  CreditCard,
  Gift,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  User,
  Sparkles,
  Percent,
  Wallet,
  ArrowRight,
  AlertCircle,
  Building2,
  ExternalLink,
} from 'lucide-react';
import {
  CoinPackage,
  CoinPurchaseOrder,
  GiftTransactionRecord,
  PayoutRequestRecord,
  CoinEconomySummary,
} from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

export function CoinsEconomyView({
  onInspectUserById,
}: {
  onInspectUserById: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'packages' | 'purchases' | 'gifts' | 'payouts' | 'adjust'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data States
  const [summary, setSummary] = useState<CoinEconomySummary | null>(null);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [purchases, setPurchases] = useState<CoinPurchaseOrder[]>([]);
  const [gifts, setGifts] = useState<GiftTransactionRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequestRecord[]>([]);

  // Filter States
  const [purchaseGateway, setPurchaseGateway] = useState<string>('all');
  const [purchaseStatus, setPurchaseStatus] = useState<string>('all');
  const [purchaseSearch, setPurchaseSearch] = useState<string>('');
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<string>('all');

  // Modals
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CoinPackage | null>(null);
  const [pkgForm, setPkgForm] = useState({
    id: '',
    coins: 700,
    usd_price: 9.49,
    discount_percent: 10,
    badge: '',
    is_popular: false,
    is_active: true,
    sort_order: 1,
  });

  // Manual Adjust States
  const [adjustUserSearch, setAdjustUserSearch] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
  const [selectedAdjustUser, setSelectedAdjustUser] = useState<any | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(100);
  const [adjustMode, setAdjustMode] = useState<'credit' | 'debit'>('credit');
  const [adjustReason, setAdjustReason] = useState('Admin grant / promotion');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState('');

  // Payout Action State
  const [payoutActionLoading, setPayoutActionLoading] = useState<string | null>(null);

  // Fetch Data by Tab
  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      if (activeTab === 'overview') {
        const res = await fetch('/api/admin/coins?tab=summary');
        const data = await res.json();
        if (data.success) {
          setSummary(data.summary);
        }
      } else if (activeTab === 'packages') {
        const res = await fetch('/api/admin/coins?tab=packages');
        const data = await res.json();
        if (data.success) {
          setPackages(data.packages || []);
        }
      } else if (activeTab === 'purchases') {
        const queryParams = new URLSearchParams({
          tab: 'purchases',
          gateway: purchaseGateway,
          status: purchaseStatus,
          q: purchaseSearch,
        });
        const res = await fetch(`/api/admin/coins?${queryParams.toString()}`);
        const data = await res.json();
        if (data.success) {
          setPurchases(data.purchases || []);
        }
      } else if (activeTab === 'gifts') {
        const res = await fetch('/api/admin/coins?tab=gifts');
        const data = await res.json();
        if (data.success) {
          setGifts(data.gifts || []);
        }
      } else if (activeTab === 'payouts') {
        const res = await fetch(`/api/admin/coins?tab=payouts&status=${payoutStatusFilter}`);
        const data = await res.json();
        if (data.success) {
          setPayouts(data.payouts || []);
        }
      }
    } catch (err) {
      console.error('Failed to load coins data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, purchaseGateway, purchaseStatus, payoutStatusFilter]);

  // Debounced search for purchases
  useEffect(() => {
    if (activeTab !== 'purchases') return;
    const t = setTimeout(() => {
      loadData(true);
    }, 350);
    return () => clearTimeout(t);
  }, [purchaseSearch]);

  // User search for manual adjust
  useEffect(() => {
    if (!adjustUserSearch.trim()) {
      setSearchedUsers([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/coins?tab=user_search&q=${encodeURIComponent(adjustUserSearch.trim())}`);
        const data = await res.json();
        if (data.success) {
          setSearchedUsers(data.users || []);
        }
      } catch (err) {
        console.error(err);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [adjustUserSearch]);

  // Handle Package Save
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!editingPackage;
      const res = await fetch('/api/admin/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isEdit ? 'UPDATE_PACKAGE' : 'CREATE_PACKAGE',
          ...pkgForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsPackageModalOpen(false);
        setEditingPackage(null);
        loadData(true);
      } else {
        alert(data.error || 'Failed to save package');
      }
    } catch (err: any) {
      alert(err.message || 'Error');
    }
  };

  // Handle Package Delete
  const handleDeletePackage = async (id: string) => {
    if (!confirm(`Are you sure you want to delete package "${id}"?`)) return;
    try {
      const res = await fetch('/api/admin/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_PACKAGE', id }),
      });
      const data = await res.json();
      if (data.success) {
        loadData(true);
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Manual Adjust Submit
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdjustUser) return;
    setAdjustLoading(true);
    setAdjustSuccessMsg('');
    try {
      const res = await fetch('/api/admin/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADJUST_COINS',
          userId: selectedAdjustUser.id,
          amount: adjustAmount,
          mode: adjustMode,
          reason: adjustReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAdjustSuccessMsg(data.message);
        setSelectedAdjustUser((prev: any) => ({
          ...prev,
          coins_balance: data.newBalance !== undefined ? data.newBalance : (prev.coins_balance + (adjustMode === 'credit' ? adjustAmount : -adjustAmount)),
        }));
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdjustLoading(false);
    }
  };

  // Handle Payout Status Update
  const handleUpdatePayout = async (payoutId: string, status: string) => {
    const notes = prompt(`Optional admin notes for marking ${status}:`, '');
    if (notes === null) return;
    setPayoutActionLoading(payoutId);
    try {
      const res = await fetch('/api/admin/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_PAYOUT',
          payoutId,
          status,
          adminNotes: notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadData(true);
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPayoutActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-[#091122]/90 border border-white/[0.08] backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-cyan-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">ZEV Coins &amp; Financial Accounting Hub</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                40/60 Economy
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live ledger, packages management, Stripe/NOWPayments/PayPal gateway orders, and creator cashouts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <a
            href="https://pay.zevapp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
          >
            <span>Live Portal (pay.zevapp.com)</span>
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
          </a>

          <button
            onClick={() => loadData(false)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-bold text-cyan-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:shadow-cyan-950 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/[0.06]">
        {[
          { id: 'overview', label: '📊 Financial Overview & KPIs', icon: TrendingUp },
          { id: 'packages', label: '📦 Coin Packages', icon: Coins },
          { id: 'purchases', label: '🧾 Purchase Orders (Stripe/Crypto/PayPal)', icon: CreditCard },
          { id: 'gifts', label: '🎁 Live Gifts (40/60 Cut)', icon: Gift },
          { id: 'payouts', label: '💸 Creator Cashouts', icon: Wallet },
          { id: 'adjust', label: '⚖️ Manual Adjustment', icon: ShieldCheck },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & KPIS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* 6 Key Financial Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Coins in Circulation */}
                <div className="p-5 rounded-3xl bg-[#091122]/80 border border-white/[0.08] backdrop-blur-xl relative overflow-hidden shadow-xl">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Coins in Circulation</span>
                    <Coins className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-400 mt-2 font-mono">
                    {Number(summary?.totalCoinsCirculating || 0).toLocaleString()} 🪙
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Sum of all user wallet balances ready to spend in live rooms.
                  </div>
                </div>

                {/* 2. Gross Web Deposit Revenue */}
                <div className="p-5 rounded-3xl bg-[#091122]/80 border border-white/[0.08] backdrop-blur-xl relative overflow-hidden shadow-xl">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Gross Web Top-up Revenue</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
                    ${Number(summary?.grossRevenueUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Total paid via Stripe, NOWPayments &amp; PayPal.
                  </div>
                </div>

                {/* 3. Total Purchased Coins */}
                <div className="p-5 rounded-3xl bg-[#091122]/80 border border-white/[0.08] backdrop-blur-xl relative overflow-hidden shadow-xl">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Total Coins Purchased</span>
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-black text-cyan-400 mt-2 font-mono">
                    {Number(summary?.totalCoinsPurchased || 0).toLocaleString()} 🪙
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    All-time virtual coins sold across packages.
                  </div>
                </div>

                {/* 4. Platform Net Profit (60%) */}
                <div className="p-5 rounded-3xl bg-[#091122]/80 border border-white/[0.08] backdrop-blur-xl relative overflow-hidden shadow-xl">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Platform Retained Profit (60%)</span>
                    <Building2 className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-2xl font-black text-sky-400 mt-2 font-mono">
                    ${Number(summary?.platformEarningsUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    ZEV 60% fee from all live gift interactions.
                  </div>
                </div>

                {/* 5. Creator Earnings Pool (40%) */}
                <div className="p-5 rounded-3xl bg-[#091122]/80 border border-white/[0.08] backdrop-blur-xl relative overflow-hidden shadow-xl">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Creator Withdrawable Pool (40%)</span>
                    <Gift className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-black text-purple-400 mt-2 font-mono">
                    ${Number(summary?.creatorEarningsUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    40% cash value credited to live stream hosts.
                  </div>
                </div>

                {/* 6. Pending Cashouts */}
                <div className="p-5 rounded-3xl bg-[#091122]/80 border border-white/[0.08] backdrop-blur-xl relative overflow-hidden shadow-xl">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Pending Creator Cashouts</span>
                    <Wallet className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-black text-rose-400 mt-2 font-mono">
                    ${Number(summary?.pendingPayoutsUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {summary?.pendingPayoutsCount || 0} payout request(s) awaiting approval.
                  </div>
                </div>
              </div>

              {/* 40/60 Economic Model Visual Explanation Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-cyan-950/30 via-slate-900/60 to-purple-950/30 border border-white/[0.08] backdrop-blur-xl shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold">
                    ⚖️
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">ZEV Live Stream Economy Architecture (TikTok 40/60 Model)</h3>
                    <p className="text-xs text-slate-400">Strictly enforced mathematical split on every virtual gift sent during live rooms.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>1. User Buys Coins</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5">
                      User pays <strong>$0.99</strong> for <strong>70 Coins</strong> on <code>pay.zevapp.com</code>. 100% credited to user&apos;s coin balance instantly.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/20">
                    <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <span>2. Creator Cut (40%)</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5">
                      When the 70 Coins are sent as gifts in a live stream, the host receives <strong>$0.40 USD</strong> (40%) in their withdrawable creator balance.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-500/20">
                    <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                      <span>3. Platform Profit (60%)</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5">
                      The system retains <strong>$0.60 USD</strong> (60%) as pure platform profit and operational revenue.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: PACKAGES MANAGER */}
      {activeTab === 'packages' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white">Live Coin Packages Catalog</h3>
              <p className="text-xs text-slate-400">Packages configured here are served directly to users on pay.zevapp.com</p>
            </div>

            <button
              onClick={() => {
                setEditingPackage(null);
                setPkgForm({
                  id: `tier_${Date.now().toString().slice(-4)}`,
                  coins: 1000,
                  usd_price: 12.99,
                  discount_percent: 10,
                  badge: '',
                  is_popular: false,
                  is_active: true,
                  sort_order: packages.length + 1,
                });
                setIsPackageModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-xs font-black text-[#050811] flex items-center gap-1.5 shadow-lg shadow-cyan-950 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Package</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/[0.08] bg-[#091122]/90 shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-slate-400 font-bold border-b border-white/[0.06]">
                <tr>
                  <th className="p-3.5 pl-5">Order</th>
                  <th className="p-3.5">Package ID</th>
                  <th className="p-3.5">Coins</th>
                  <th className="p-3.5">USD Price</th>
                  <th className="p-3.5">Discount</th>
                  <th className="p-3.5">Badge</th>
                  <th className="p-3.5">Popular</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 pl-5 font-mono text-slate-400 font-bold">{pkg.sort_order}</td>
                    <td className="p-3.5 font-mono text-cyan-300 font-semibold">{pkg.id}</td>
                    <td className="p-3.5">
                      <span className="font-extrabold text-amber-400 flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5" />
                        {pkg.coins.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-3.5 font-black text-white font-mono">${Number(pkg.usd_price).toFixed(2)}</td>
                    <td className="p-3.5">
                      {pkg.discount_percent > 0 ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          {pkg.discount_percent}% OFF
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono">—</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {pkg.badge ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 uppercase">
                          {pkg.badge}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {pkg.is_popular ? (
                        <span className="text-amber-400 font-bold">★ Yes</span>
                      ) : (
                        <span className="text-slate-500">No</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        pkg.is_active
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}>
                        {pkg.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingPackage(pkg);
                            setPkgForm({
                              id: pkg.id,
                              coins: pkg.coins,
                              usd_price: Number(pkg.usd_price),
                              discount_percent: pkg.discount_percent || 0,
                              badge: pkg.badge || '',
                              is_popular: pkg.is_popular,
                              is_active: pkg.is_active,
                              sort_order: pkg.sort_order,
                            });
                            setIsPackageModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all"
                          title="Edit Package"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeletePackage(pkg.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-all"
                          title="Delete Package"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PURCHASES & GATEWAYS */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
                placeholder="Search by order ID, username, or buyer..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={purchaseGateway}
                onChange={(e) => setPurchaseGateway(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-slate-200 focus:outline-none"
              >
                <option value="all">All Gateways</option>
                <option value="stripe">Stripe (Card)</option>
                <option value="nowpayments">NOWPayments (Crypto)</option>
                <option value="paypal">PayPal</option>
                <option value="ADMIN_CREDIT">Admin Grants</option>
              </select>

              <select
                value={purchaseStatus}
                onChange={(e) => setPurchaseStatus(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-slate-200 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/[0.08] bg-[#091122]/90 shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-slate-400 font-bold border-b border-white/[0.06]">
                <tr>
                  <th className="p-3.5 pl-5">Recipient User</th>
                  <th className="p-3.5">Coins</th>
                  <th className="p-3.5">Amount (USD)</th>
                  <th className="p-3.5">Gateway</th>
                  <th className="p-3.5">Order ID</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                      No purchase orders found matching the filter.
                    </td>
                  </tr>
                ) : (
                  purchases.map((ord) => (
                    <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 pl-5">
                        <button
                          onClick={() => onInspectUserById(ord.user_id)}
                          className="flex items-center gap-2.5 text-left group"
                        >
                          <div className="w-7 h-7 rounded-full bg-slate-800 overflow-hidden shrink-0 border border-white/[0.08]">
                            {ord.avatar_url ? (
                              <Image src={ord.avatar_url} alt="" width={28} height={28} className="object-cover w-full h-full" unoptimized />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                                {(ord.username || 'U')[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                              @{ord.username || ord.user_id.slice(0, 8)}
                            </div>
                            {ord.buyer_username && (
                              <div className="text-[10px] text-slate-400">Gifted by @{ord.buyer_username}</div>
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="p-3.5 font-black text-amber-400 font-mono">
                        +{ord.coins_amount.toLocaleString()} 🪙
                      </td>
                      <td className="p-3.5 font-black text-emerald-400 font-mono">
                        ${Number(ord.usd_amount).toFixed(2)}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase ${
                          ord.payment_gateway === 'stripe'
                            ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                            : ord.payment_gateway === 'nowpayments'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : ord.payment_gateway === 'paypal'
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {ord.payment_gateway}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-400 text-[11px] truncate max-w-[140px]" title={ord.order_id}>
                        {ord.order_id}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ord.payment_status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}>
                          {ord.payment_status}
                        </span>
                      </td>
                      <td className="p-3.5 pr-5 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                        {new Date(ord.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: GIFTS & 40/60 ACCOUNTING */}
      {activeTab === 'gifts' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-black text-white">Live Stream Virtual Gifts Accounting</h3>
            <p className="text-xs text-slate-400">Detailed breakdown of creator 40% payouts and platform 60% revenue for every gift.</p>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/[0.08] bg-[#091122]/90 shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-slate-400 font-bold border-b border-white/[0.06]">
                <tr>
                  <th className="p-3.5 pl-5">Gift</th>
                  <th className="p-3.5">Sender</th>
                  <th className="p-3.5">Host (Creator)</th>
                  <th className="p-3.5">Coins</th>
                  <th className="p-3.5">Gross (USD)</th>
                  <th className="p-3.5">Creator 40%</th>
                  <th className="p-3.5">Platform 60%</th>
                  <th className="p-3.5 pr-5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {gifts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                      No live gift transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  gifts.map((g) => (
                    <tr key={g.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 pl-5 font-bold text-white flex items-center gap-1.5">
                        <span className="text-base">{g.gift_emoji || '🎁'}</span>
                        <span>{g.gift_name}</span>
                      </td>
                      <td className="p-3.5">
                        <button onClick={() => onInspectUserById(g.sender_id)} className="font-semibold text-slate-300 hover:text-cyan-300">
                          @{g.sender_username || g.sender_id.slice(0, 8)}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <button onClick={() => onInspectUserById(g.receiver_id)} className="font-semibold text-cyan-400 hover:underline">
                          @{g.receiver_username || g.receiver_id.slice(0, 8)}
                        </button>
                      </td>
                      <td className="p-3.5 font-bold text-amber-400 font-mono">
                        {g.coins_amount} 🪙
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        ${Number(g.gross_usd).toFixed(3)}
                      </td>
                      <td className="p-3.5 font-black text-purple-400 font-mono bg-purple-950/20 rounded-md">
                        +${Number(g.creator_usd).toFixed(3)}
                      </td>
                      <td className="p-3.5 font-black text-sky-400 font-mono bg-sky-950/20 rounded-md">
                        +${Number(g.platform_usd).toFixed(3)}
                      </td>
                      <td className="p-3.5 pr-5 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                        {new Date(g.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: CREATOR PAYOUTS */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white">Creator Withdrawal &amp; Payout Requests</h3>
              <p className="text-xs text-slate-400">Manage creator cashouts earned from live virtual gifts.</p>
            </div>

            <select
              value={payoutStatusFilter}
              onChange={(e) => setPayoutStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-slate-200 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed / Paid</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/[0.08] bg-[#091122]/90 shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-slate-400 font-bold border-b border-white/[0.06]">
                <tr>
                  <th className="p-3.5 pl-5">Creator</th>
                  <th className="p-3.5">Amount (USD)</th>
                  <th className="p-3.5">Payout Method</th>
                  <th className="p-3.5">Destination Account</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Requested At</th>
                  <th className="p-3.5 pr-5 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                      No payout requests found.
                    </td>
                  </tr>
                ) : (
                  payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 pl-5">
                        <button
                          onClick={() => onInspectUserById(p.user_id)}
                          className="font-bold text-white hover:text-cyan-300"
                        >
                          @{p.username || p.user_id.slice(0, 8)}
                        </button>
                      </td>
                      <td className="p-3.5 font-black text-rose-400 font-mono text-sm">
                        ${Number(p.amount_usd).toFixed(2)}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {p.payout_method}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300 select-all">
                        {p.destination_account}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : p.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : p.status === 'processing'
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        {p.status === 'pending' || p.status === 'processing' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleUpdatePayout(p.id, 'completed')}
                              disabled={payoutActionLoading === p.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 transition-all"
                            >
                              Approve &amp; Paid
                            </button>
                            <button
                              onClick={() => handleUpdatePayout(p.id, 'rejected')}
                              disabled={payoutActionLoading === p.id}
                              className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[11px] font-bold text-rose-300 transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: MANUAL ADJUSTMENT */}
      {activeTab === 'adjust' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="p-6 rounded-3xl bg-[#091122]/90 border border-white/[0.08] backdrop-blur-xl shadow-2xl">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Admin Coin Grant &amp; Balance Adjustment</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Safely credit or debit virtual coins to any user account with automatic audit logging.
            </p>

            <div className="mt-5 space-y-4">
              {/* Search User */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1.5">
                  1. Find Target User
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={adjustUserSearch}
                    onChange={(e) => setAdjustUserSearch(e.target.value)}
                    placeholder="Search by @username, name, or ID..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {searchedUsers.length > 0 && !selectedAdjustUser && (
                  <div className="mt-2 rounded-2xl border border-white/[0.08] bg-[#0b1329] p-2 space-y-1 max-h-48 overflow-y-auto">
                    {searchedUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedAdjustUser(u);
                          setSearchedUsers([]);
                        }}
                        className="w-full p-2 rounded-xl hover:bg-white/[0.05] flex items-center justify-between text-left text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-slate-800 overflow-hidden">
                            {u.avatar_url ? <Image src={u.avatar_url} alt="" width={24} height={24} unoptimized /> : null}
                          </div>
                          <div>
                            <span className="font-bold text-white">@{u.username}</span>
                            <span className="text-slate-400 ml-2">({u.first_name} {u.last_name})</span>
                          </div>
                        </div>
                        <div className="text-amber-400 font-bold font-mono">
                          {Number(u.coins_balance || 0).toLocaleString()} 🪙
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected User Card */}
              {selectedAdjustUser && (
                <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-cyan-400/40">
                      {selectedAdjustUser.avatar_url ? (
                        <Image src={selectedAdjustUser.avatar_url} alt="" width={40} height={40} unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-cyan-300">
                          {selectedAdjustUser.username[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-black text-white flex items-center gap-1.5">
                        <span>@{selectedAdjustUser.username}</span>
                        {selectedAdjustUser.is_verified && <VerifiedBadge />}
                      </div>
                      <div className="text-xs text-amber-400 font-mono font-bold mt-0.5">
                        Current Coins: {Number(selectedAdjustUser.coins_balance || 0).toLocaleString()} 🪙
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedAdjustUser(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Adjustment Form */}
              {selectedAdjustUser && (
                <form onSubmit={handleAdjustSubmit} className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">Mode</label>
                      <select
                        value={adjustMode}
                        onChange={(e) => setAdjustMode(e.target.value as any)}
                        className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none"
                      >
                        <option value="credit">➕ Credit (Add Coins)</option>
                        <option value="debit">➖ Debit (Deduct Coins)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">Coin Amount</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-amber-300 font-mono font-bold focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">Reason / Admin Note</label>
                    <input
                      type="text"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g. Promotional grant, Compensation, Bug bounty"
                      className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none"
                      required
                    />
                  </div>

                  {adjustSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{adjustSuccessMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={adjustLoading}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-xs font-black text-[#050811] shadow-xl shadow-cyan-950 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {adjustLoading ? 'Executing Adjustment...' : `Confirm & ${adjustMode === 'credit' ? 'Grant' : 'Deduct'} ${adjustAmount.toLocaleString()} Coins`}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PACKAGE MODAL */}
      {isPackageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#091122] border border-white/[0.12] shadow-2xl relative space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{editingPackage ? 'Edit Coin Package' : 'Create New Coin Package'}</span>
            </h3>

            <form onSubmit={handleSavePackage} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Package ID</label>
                <input
                  type="text"
                  value={pkgForm.id}
                  disabled={!!editingPackage}
                  onChange={(e) => setPkgForm({ ...pkgForm, id: e.target.value })}
                  placeholder="e.g. tier_5000"
                  className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-mono focus:outline-none disabled:opacity-50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Coins Amount</label>
                  <input
                    type="number"
                    min="1"
                    value={pkgForm.coins}
                    onChange={(e) => setPkgForm({ ...pkgForm, coins: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-amber-300 font-mono font-bold focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">USD Price ($)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={pkgForm.usd_price}
                    onChange={(e) => setPkgForm({ ...pkgForm, usd_price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-emerald-300 font-mono font-bold focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={pkgForm.discount_percent}
                    onChange={(e) => setPkgForm({ ...pkgForm, discount_percent: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={pkgForm.sort_order}
                    onChange={(e) => setPkgForm({ ...pkgForm, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Badge (Optional)</label>
                <input
                  type="text"
                  value={pkgForm.badge}
                  onChange={(e) => setPkgForm({ ...pkgForm, badge: e.target.value })}
                  placeholder="e.g. MOST POPULAR, CREATOR CHOICE, VIP STREAMER"
                  className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pkgForm.is_popular}
                    onChange={(e) => setPkgForm({ ...pkgForm, is_popular: e.target.checked })}
                    className="rounded bg-white/[0.04] border-white/[0.2] text-cyan-500"
                  />
                  <span className="text-slate-300 font-semibold">Mark as Popular</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pkgForm.is_active}
                    onChange={(e) => setPkgForm({ ...pkgForm, is_active: e.target.checked })}
                    className="rounded bg-white/[0.04] border-white/[0.2] text-cyan-500"
                  />
                  <span className="text-slate-300 font-semibold">Active &amp; Visible</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPackageModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 text-[#050811] font-black shadow-lg shadow-cyan-950"
                >
                  {editingPackage ? 'Save Changes' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
