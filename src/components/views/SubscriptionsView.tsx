'use client';

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Sparkles, CheckCircle, RefreshCw, Eye, ShieldCheck, 
  XCircle, Clock, Phone, DollarSign, Calendar, AlertCircle, Check
} from 'lucide-react';
import { VerifiedBadge } from '../VerifiedBadge';

interface SubscriptionOrder {
  id: string;
  user_id: string;
  plan_type: string;
  plan_price: string;
  status: string;
  contact_phone?: string;
  notes?: string;
  starts_at?: string;
  expires_at?: string;
  created_at: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar_url?: string;
  is_verified?: boolean;
  referral_code?: string;
  referral_count?: number;
}

export function SubscriptionsView({ onInspectUserById }: { onInspectUserById: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'all'>('pending');
  const [subscriptions, setSubscriptions] = useState<SubscriptionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions?status=${activeTab}`);
      const data = await res.json();
      if (data.success) {
        setSubscriptions(data.subscriptions || []);
      }
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [activeTab]);

  const handleAction = async (sub: SubscriptionOrder, action: 'APPROVE_SUBSCRIPTION' | 'REJECT_SUBSCRIPTION') => {
    setActionLoadingId(sub.id);
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          subscriptionId: sub.id,
          userId: sub.user_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSubscriptions();
      }
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filtered = subscriptions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.first_name || '').toLowerCase().includes(q) ||
      (s.last_name || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.contact_phone || '').toLowerCase().includes(q) ||
      (s.plan_type || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-950/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">ZEV Blue Monetization & Subscriptions</h2>
            <p className="text-xs text-slate-400">
              Review and approve incoming verification plan orders (Yearly, Monthly, Lifetime VIP)
            </p>
          </div>
        </div>

        <button
          onClick={fetchSubscriptions}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800 max-w-md">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'active'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>Active Paid</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>All History</span>
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name, phone, handle..."
          className="px-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64"
        />
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Loading subscription orders...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center text-slate-400 text-sm bg-slate-950/40 rounded-3xl border border-slate-800">
          <CheckCircle className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-80" />
          <p className="font-semibold text-slate-200">
            {activeTab === 'pending' ? 'No pending orders waiting for approval' : 'No subscription orders found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((sub) => {
            const name = [sub.first_name, sub.last_name].filter(Boolean).join(' ') || sub.username || 'User';
            const isPending = sub.status === 'pending';
            const isActive = sub.status === 'active';

            return (
              <div
                key={sub.id}
                className="p-5 rounded-3xl bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top user row */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-sm shrink-0 overflow-hidden">
                        {sub.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sub.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm flex items-center gap-1.5 truncate">
                          <span className="truncate">{name}</span>
                          {sub.is_verified && <VerifiedBadge size="md" />}
                        </div>
                        <div className="text-xs text-cyan-400 font-mono truncate">
                          @{sub.username || 'user'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black text-white font-mono">{sub.plan_price}</div>
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border ${
                        isActive
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                          : isPending
                          ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {sub.status}
                      </span>
                    </div>
                  </div>

                  {/* Plan details box */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Selected Plan:</span>
                      <span className="font-extrabold text-cyan-300">{sub.plan_type}</span>
                    </div>

                    {sub.contact_phone && (
                      <div className="flex items-center gap-2 text-emerald-400 font-mono pt-1">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{sub.contact_phone}</span>
                      </div>
                    )}

                    {sub.notes && (
                      <div className="text-slate-300 text-[11px] pt-1 border-t border-slate-800/80">
                        &ldquo;{sub.notes}&rdquo;
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>Order Placed:</span>
                      <span>{new Date(sub.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onInspectUserById(sub.user_id)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Inspect User Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {isPending ? (
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <button
                        onClick={() => handleAction(sub, 'REJECT_SUBSCRIPTION')}
                        disabled={actionLoadingId === sub.id}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        Reject
                      </button>

                      <button
                        onClick={() => handleAction(sub, 'APPROVE_SUBSCRIPTION')}
                        disabled={actionLoadingId === sub.id}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve & Verify</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500">
                      {isActive ? 'Verified Active Subscription' : 'Status: ' + sub.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

