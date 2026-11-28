'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Copy,
  ExternalLink,
  DollarSign,
  Coins,
  ArrowDownLeft,
  AlertCircle,
  Building2,
  Smartphone,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface PayoutRequestRecord {
  id: string;
  user_id: string;
  amount_usd: number;
  coins_deducted: number;
  target_currency?: string;
  amount_target_currency?: number;
  payout_method: string;
  destination_account: string;
  payout_method_id?: string;
  account_details?: any;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  admin_notes?: string | null;
  created_at: string;
  processed_at?: string | null;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  earnings_usd?: number;
}

interface CreatorPayoutsViewProps {
  onInspectUserById?: (userId: string) => void;
}

export default function CreatorPayoutsView({ onInspectUserById }: CreatorPayoutsViewProps) {
  const [payouts, setPayouts] = useState<PayoutRequestRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load payouts from API
  const loadPayouts = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`/api/admin/coins?tab=payouts&status=${statusFilter}&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.payouts)) {
        setPayouts(data.payouts);
      }
    } catch (err) {
      console.error('Failed to load payouts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPayouts();
  }, [statusFilter]);

  // Periodic fast auto-refresh (every 5 seconds) for real-time responsiveness
  useEffect(() => {
    const timer = setInterval(() => {
      loadPayouts(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [statusFilter, searchQuery]);

  // Handle Approve / Paid
  const handleApprove = async (payout: PayoutRequestRecord) => {
    const note = prompt(`Confirm payment of $${Number(payout.amount_usd).toFixed(2)} USD (${payout.amount_target_currency || payout.amount_usd} ${payout.target_currency || 'USD'})?\nOptional transaction reference/receipt note:`, '');
    if (note === null) return;

    setActionLoading(payout.id);
    try {
      const res = await fetch('/api/admin/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_PAYOUT',
          payoutId: payout.id,
          status: 'completed',
          adminNotes: note.trim() || 'Paid & Settled by Admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadPayouts(true);
      } else {
        alert(data.error || 'Failed to approve payout');
      }
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Reject & Atomic Refund
  const handleReject = async (payout: PayoutRequestRecord) => {
    const note = prompt(`Reject payout request #${payout.id.slice(0, 8)}?\nCoins (${payout.coins_deducted} Coins / $${payout.amount_usd} USD) will be IMMEDIATELY refunded to @${payout.username || 'creator'}.\nEnter rejection reason:`, 'Invalid account details / destination');
    if (note === null) return;

    setActionLoading(payout.id);
    try {
      const res = await fetch('/api/admin/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_PAYOUT',
          payoutId: payout.id,
          status: 'rejected',
          adminNotes: note.trim() || 'Rejected by Admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadPayouts(true);
      } else {
        alert(data.error || 'Failed to reject payout');
      }
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered dataset
  const filteredPayouts = useMemo(() => {
    return payouts.filter((p) => {
      if (methodFilter !== 'all' && p.payout_method.toLowerCase() !== methodFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUser = p.username?.toLowerCase().includes(q) || false;
        const matchesName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase().includes(q);
        const matchesDest = p.destination_account?.toLowerCase().includes(q) || false;
        if (!matchesUser && !matchesName && !matchesDest) return false;
      }
      return true;
    });
  }, [payouts, methodFilter, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalRequests = payouts.length;
    const pendingList = payouts.filter((p) => p.status === 'pending' || p.status === 'processing');
    const completedList = payouts.filter((p) => p.status === 'completed');
    const pendingCount = pendingList.length;
    const pendingUsd = pendingList.reduce((acc, p) => acc + (Number(p.amount_usd) || 0), 0);
    const completedUsd = completedList.reduce((acc, p) => acc + (Number(p.amount_usd) || 0), 0);
    const totalCoins = payouts.reduce((acc, p) => acc + (Number(p.coins_deducted) || 0), 0);

    return { totalRequests, pendingCount, pendingUsd, completedUsd, totalCoins };
  }, [payouts]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Fast Controls */}
      <div className="p-6 rounded-3xl bg-[#091122]/95 border border-white/[0.08] backdrop-blur-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/10 border border-rose-500/30 text-rose-400">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">Creator Cashout &amp; Payouts Hub</h2>
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync (Sub-Second)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized gateway for reviewing, approving, and settling creator earnings across HesabPay, Crypto USDT, Bank Wire, and PayPal.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto">
          <button
            onClick={() => loadPayouts(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-slate-200 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span>{refreshing ? 'Syncing...' : 'Live Refresh'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Approval */}
        <div className="p-5 rounded-3xl bg-[#091122]/80 border border-rose-500/20 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-300">Pending Review</span>
            <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-400 font-mono">
              ${stats.pendingUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">
              {stats.pendingCount} request(s) awaiting payment
            </div>
          </div>
        </div>

        {/* Paid & Settled */}
        <div className="p-5 rounded-3xl bg-[#091122]/80 border border-emerald-500/20 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300">Total Settled (USD)</span>
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-400 font-mono">
              ${stats.completedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">
              Successfully paid to creators
            </div>
          </div>
        </div>

        {/* Total Coins Withdrawn */}
        <div className="p-5 rounded-3xl bg-[#091122]/80 border border-amber-500/20 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">Coins Cashed Out</span>
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-400 font-mono">
              {stats.totalCoins.toLocaleString()} 🪙
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">
              Cumulative converted creator coins
            </div>
          </div>
        </div>

        {/* Total Requests Count */}
        <div className="p-5 rounded-3xl bg-[#091122]/80 border border-cyan-500/20 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300">All Requests</span>
            <div className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-cyan-400 font-mono">
              {stats.totalRequests}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">
              Lifetime creator cashout intents
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-3xl bg-[#091122]/90 border border-white/[0.08] shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search creator, username, IBAN, wallet, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">All Methods</option>
            <option value="hesabpay">HesabPay (AFN)</option>
            <option value="crypto">Crypto USDT</option>
            <option value="bank">Bank Wire</option>
            <option value="paypal">PayPal</option>
          </select>

          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending' },
              { id: 'processing', label: 'Processing' },
              { id: 'completed', label: 'Paid' },
              { id: 'rejected', label: 'Rejected' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === st.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payouts Data Table */}
      <div className="overflow-x-auto rounded-3xl border border-white/[0.08] bg-[#091122]/90 shadow-2xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/[0.03] text-slate-400 font-bold border-b border-white/[0.06]">
            <tr>
              <th className="p-4 pl-6">Creator</th>
              <th className="p-4">Amount &amp; Coins</th>
              <th className="p-4">Payout Method</th>
              <th className="p-4">Destination Account</th>
              <th className="p-4">Status</th>
              <th className="p-4">Date</th>
              <th className="p-4 pr-6 text-right">Review Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-400 text-xs">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Loading cashout requests...</span>
                  </div>
                </td>
              </tr>
            ) : filteredPayouts.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-400 text-xs">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-slate-500 stroke-1" />
                    <span className="font-semibold text-slate-300">No payout requests found</span>
                    <span className="text-[11px] text-slate-500">Try adjusting your status or search filters</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredPayouts.map((p) => {
                const isPendingOrProcessing = p.status === 'pending' || p.status === 'processing';
                const isCompleted = p.status === 'completed';
                const isRejected = p.status === 'rejected';

                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Creator Profile */}
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        {p.avatar_url ? (
                          <img
                            src={p.avatar_url}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border border-white/[0.1]"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                            {(p.first_name?.[0] || p.username?.[0] || 'U').toUpperCase()}
                          </div>
                        )}
                        <div>
                          <button
                            onClick={() => onInspectUserById?.(p.user_id)}
                            className="font-bold text-white hover:text-cyan-300 transition-colors text-left block"
                          >
                            @{p.username || p.user_id.slice(0, 8)}
                          </button>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                            {`${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Creator'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Amount & Coins */}
                    <td className="p-4 font-mono">
                      <div className="font-black text-rose-400 text-sm">
                        {p.amount_target_currency && p.target_currency && p.target_currency !== 'USD' ? (
                          <span>
                            {Number(p.amount_target_currency).toFixed(2)} {p.target_currency}
                            <span className="text-[10px] text-slate-400 font-normal block">
                              ≈ ${Number(p.amount_usd).toFixed(2)} USD
                            </span>
                          </span>
                        ) : (
                          <span>${Number(p.amount_usd).toFixed(2)} USD</span>
                        )}
                      </div>
                      <div className="text-[10px] text-amber-400/90 font-bold flex items-center gap-1 mt-0.5">
                        🪙 {p.coins_deducted ? p.coins_deducted.toLocaleString() : Math.round(Number(p.amount_usd) * 70.71).toLocaleString()} Coins
                      </div>
                    </td>

                    {/* Payout Method */}
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider border ${
                          p.payout_method.toLowerCase() === 'hesabpay'
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : p.payout_method.toLowerCase() === 'crypto'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : p.payout_method.toLowerCase() === 'bank'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        }`}
                      >
                        {p.payout_method.toLowerCase() === 'hesabpay' ? (
                          <Smartphone className="w-3 h-3" />
                        ) : p.payout_method.toLowerCase() === 'bank' ? (
                          <Building2 className="w-3 h-3" />
                        ) : (
                          <Coins className="w-3 h-3" />
                        )}
                        {p.payout_method}
                      </span>
                    </td>

                    {/* Destination Account */}
                    <td className="p-4 font-mono text-slate-300 max-w-[210px]">
                      <div className="flex items-center gap-1.5">
                        <div className="truncate text-xs font-semibold" title={p.destination_account}>
                          {p.destination_account}
                        </div>
                        <button
                          onClick={() => copyToClipboard(p.destination_account, p.id)}
                          className="p-1 rounded hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
                          title="Copy destination"
                        >
                          {copiedId === p.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      {p.account_details && typeof p.account_details === 'object' && (
                        <div className="text-[10px] text-slate-400 font-sans truncate mt-0.5">
                          {p.account_details.network || p.account_details.bank_name || p.account_details.account_name || ''}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isCompleted
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : p.status === 'processing'
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            : isRejected
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isCompleted ? 'bg-emerald-400' : isRejected ? 'bg-rose-400' : 'bg-cyan-400 animate-pulse'
                        }`} />
                        {isCompleted ? 'Paid & Settled' : isRejected ? 'Cancelled / Refunded' : p.status === 'processing' ? 'Processing' : 'Pending Review'}
                      </span>
                      {p.admin_notes && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px] mt-1" title={p.admin_notes}>
                          Note: {p.admin_notes}
                        </div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="p-4 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString()}
                      <span className="text-[10px] text-slate-500 block">
                        {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td className="p-4 pr-6 text-right">
                      {isPendingOrProcessing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(p)}
                            disabled={actionLoading === p.id}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold text-emerald-300 transition-all active:scale-95 flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve &amp; Paid</span>
                          </button>
                          <button
                            onClick={() => handleReject(p)}
                            disabled={actionLoading === p.id}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-300 transition-all active:scale-95 flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Settled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-400 font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          Refunded
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
