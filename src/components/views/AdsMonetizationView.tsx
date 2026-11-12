'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, RefreshCw, CheckCircle2, XCircle, PauseCircle, PlayCircle,
  DollarSign, Eye, MousePointerClick, ShieldAlert, TrendingUp, Wallet,
  FileText, ExternalLink, Search, Ban, Check, Sparkles, Target, X, Rocket,
  AlertTriangle
} from 'lucide-react';
import {
  AdminAdsKPIs,
  AdminAdvertiser,
  AdminAdCampaign,
  AdminAdInvoice,
} from '@/lib/types';

interface AdsMonetizationViewProps {
  onInspectUserById: (id: string) => void;
}

type AdsTab = 'pending' | 'campaigns' | 'advertisers' | 'invoices';

export function AdsMonetizationView({ onInspectUserById }: AdsMonetizationViewProps) {
  const [activeTab, setActiveTab] = useState<AdsTab>('pending');
  const [kpis, setKpis] = useState<AdminAdsKPIs | null>(null);
  const [campaigns, setCampaigns] = useState<AdminAdCampaign[]>([]);
  const [advertisers, setAdvertisers] = useState<AdminAdvertiser[]>([]);
  const [invoices, setInvoices] = useState<AdminAdInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Reject Campaign modal state
  const [rejectTarget, setRejectTarget] = useState<AdminAdCampaign | null>(null);
  const [rejectReason, setRejectReason] = useState('Does not meet ZEV Advertising Policy guidelines.');

  // Top-up Wallet modal state
  const [topUpTarget, setTopUpTarget] = useState<AdminAdvertiser | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('50');

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4500);
  };

  const fetchAdsData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ads');
      const data = await res.json();
      if (data.success) {
        setKpis(data.kpis || null);
        setCampaigns(data.campaigns || []);
        setAdvertisers(data.advertisers || []);
        setInvoices(data.invoices || []);
      } else {
        showFeedback(data.error || 'Failed to load ads telemetry', 'error');
      }
    } catch (err) {
      console.error('Error loading ads dashboard:', err);
      showFeedback('Network error loading ads manager', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdsData();
  }, [fetchAdsData]);

  const executeAction = async (
    action: string,
    targetId: string,
    payload: Record<string, unknown> = {},
    successText?: string
  ) => {
    setActionLoadingId(targetId);
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetId, payload }),
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(successText || data.message || 'Action completed', 'success');
        await fetchAdsData();
      } else {
        showFeedback(data.error || 'Action failed', 'error');
      }
    } catch (err) {
      console.error('Ads action failed:', err);
      showFeedback('Failed to communicate with admin ads API', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const q = search.trim().toLowerCase();

  const pendingCampaigns = campaigns.filter(
    (c) => c.status === 'pending_review' || c.creative_status === 'pending_review'
  );

  const visibleCampaigns = (activeTab === 'pending' ? pendingCampaigns : campaigns).filter((c) => {
    if (!q) return true;
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.business_name || '').toLowerCase().includes(q) ||
      (c.owner_username || '').toLowerCase().includes(q) ||
      (c.creative_title || '').toLowerCase().includes(q) ||
      (c.placement || '').toLowerCase().includes(q) ||
      (c.status || '').toLowerCase().includes(q)
    );
  });

  const visibleAdvertisers = advertisers.filter((a) => {
    if (!q) return true;
    return (
      (a.business_name || '').toLowerCase().includes(q) ||
      (a.username || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.contact_email || '').toLowerCase().includes(q) ||
      (a.status || '').toLowerCase().includes(q)
    );
  });

  const visibleInvoices = invoices.filter((inv) => {
    if (!q) return true;
    return (
      (inv.invoice_number || '').toLowerCase().includes(q) ||
      (inv.business_name || '').toLowerCase().includes(q) ||
      (inv.campaign_name || '').toLowerCase().includes(q) ||
      (inv.status || '').toLowerCase().includes(q)
    );
  });

  const statusPill = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'approved' || s === 'paid') {
      return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
    }
    if (s === 'pending_review' || s === 'pending' || s === 'issued') {
      return 'bg-amber-950/80 text-amber-300 border-amber-700/60';
    }
    if (s === 'paused' || s === 'draft') {
      return 'bg-slate-800/90 text-slate-300 border-slate-700';
    }
    if (s === 'completed') {
      return 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60';
    }
    return 'bg-rose-950/80 text-rose-300 border-rose-700/60';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xl ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60'
              : 'bg-rose-950/90 text-rose-300 border-rose-700/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="glass-panel rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/25 to-indigo-500/25 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-950/40">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                ZEV Ads &amp; Monetization Engine
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 uppercase">
                CPM / CPC / CPA
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Review advertiser accounts, approve/reject Feed/Story/Reel/Explore campaigns, top up ad wallets, and monitor anti-fraud telemetry
            </p>
          </div>
        </div>

        <button
          onClick={fetchAdsData}
          disabled={loading}
          className="glass-btn px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-2 cursor-pointer self-start lg:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Active Ads</span>
            <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-300 mt-2 font-mono">{kpis?.activeCampaigns ?? '-'}</div>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Pending Review</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-300 mt-2 font-mono">{kpis?.pendingCampaigns ?? '-'}</div>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Impressions</span>
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-white mt-2 font-mono">
            {(kpis?.totalImpressions ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Clicks</span>
            <MousePointerClick className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-black text-sky-300 mt-2 font-mono">
            {(kpis?.totalClicks ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>CTR %</span>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-black text-indigo-300 mt-2 font-mono">{kpis?.ctrPercent ?? 0}%</div>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Conversions</span>
            <Target className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-black text-purple-300 mt-2 font-mono">
            {(kpis?.totalConversions ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Ad Revenue</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-300 mt-2 font-mono">
            ${Number(kpis?.totalAdRevenue ?? 0).toFixed(2)}
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Fraud Flagged</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-black text-rose-300 mt-2 font-mono">{kpis?.fraudFlaggedEvents ?? 0}</div>
        </div>
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1.5 glass-panel rounded-2xl overflow-x-auto text-xs">
          {[
            { id: 'pending' as AdsTab, label: `Pending Review (${pendingCampaigns.length})` },
            { id: 'campaigns' as AdsTab, label: `All Campaigns (${campaigns.length})` },
            { id: 'advertisers' as AdsTab, label: `Advertisers (${advertisers.length})` },
            { id: 'invoices' as AdsTab, label: `Invoices (${invoices.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaign, brand, @user, invoice..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl glass-input text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Content Body */}
      {loading ? (
        <div className="glass-panel p-16 rounded-3xl text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>Loading campaigns, advertisers, and billing invoices...</span>
        </div>
      ) : activeTab === 'advertisers' ? (
        visibleAdvertisers.length === 0 ? (
          <div className="glass-panel p-16 rounded-3xl text-center text-slate-400 text-sm">
            No advertisers found matching your filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleAdvertisers.map((adv) => (
              <div key={adv.id} className="glass-card p-5 rounded-3xl flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-white truncate">{adv.business_name}</h3>
                      {adv.user_id && (
                        <button
                          onClick={() => onInspectUserById(adv.user_id)}
                          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer truncate block"
                        >
                          @{adv.username || 'owner'} • Inspect Profile
                        </button>
                      )}
                      {adv.contact_email && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{adv.contact_email}</div>
                      )}
                    </div>

                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border uppercase ${statusPill(adv.status)}`}>
                      {adv.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-900/60 border border-white/[0.06] text-center">
                    <div>
                      <div className="text-[10px] text-slate-400">Wallet</div>
                      <div className="text-xs font-black text-emerald-300 font-mono">
                        ${Number(adv.balance || 0).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Campaigns</div>
                      <div className="text-xs font-black text-white font-mono">{adv.campaigns_count ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Total Spent</div>
                      <div className="text-xs font-black text-cyan-300 font-mono">
                        ${Number(adv.total_spent || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setTopUpTarget(adv);
                      setTopUpAmount('50');
                    }}
                    disabled={actionLoadingId === adv.id}
                    className="glass-btn px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Top-Up Wallet</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {adv.status !== 'approved' && (
                      <button
                        onClick={() =>
                          executeAction('APPROVE_ADVERTISER', adv.id, {}, `Advertiser "${adv.business_name}" approved`)
                        }
                        disabled={actionLoadingId === adv.id}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    )}
                    {adv.status !== 'suspended' && (
                      <button
                        onClick={() =>
                          executeAction('SUSPEND_ADVERTISER', adv.id, {}, `Advertiser "${adv.business_name}" suspended`)
                        }
                        disabled={actionLoadingId === adv.id}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Suspend</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'invoices' ? (
        visibleInvoices.length === 0 ? (
          <div className="glass-panel p-16 rounded-3xl text-center text-slate-400 text-sm">
            No advertising invoices generated yet.
          </div>
        ) : (
          <div className="glass-panel rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/70 border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Advertiser</th>
                    <th className="py-3.5 px-4">Campaign</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Issued Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {visibleInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02]">
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-300">{inv.invoice_number}</td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {inv.owner_user_id ? (
                          <button
                            onClick={() => onInspectUserById(inv.owner_user_id!)}
                            className="hover:text-cyan-300 cursor-pointer"
                          >
                            {inv.business_name || 'Advertiser'}
                          </button>
                        ) : (
                          inv.business_name || 'Advertiser'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{inv.campaign_name || 'Account Billing'}</td>
                      <td className="py-3.5 px-4 font-mono font-black text-emerald-300">
                        ${Number(inv.amount || 0).toFixed(2)} {inv.currency || 'USD'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border uppercase ${statusPill(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {inv.status !== 'paid' && inv.status !== 'void' && (
                            <button
                              onClick={() =>
                                executeAction('MARK_INVOICE_PAID', inv.id, {}, `Invoice ${inv.invoice_number} marked Paid`)
                              }
                              disabled={actionLoadingId === inv.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                            >
                              Mark Paid
                            </button>
                          )}
                          {inv.status !== 'void' && (
                            <button
                              onClick={() =>
                                executeAction('VOID_INVOICE', inv.id, {}, `Invoice ${inv.invoice_number} voided`)
                              }
                              disabled={actionLoadingId === inv.id}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-bold cursor-pointer"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : visibleCampaigns.length === 0 ? (
        <div className="glass-panel p-16 rounded-3xl text-center text-slate-400 text-sm">
          <FileText className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-80" />
          <p className="font-semibold text-slate-200">
            {activeTab === 'pending'
              ? 'All campaigns reviewed! Zero campaigns awaiting approval.'
              : 'No campaigns match your query.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleCampaigns.map((c) => {
            const budget = Number(c.total_budget || 0);
            const spent = Number(c.spent_amount || 0);
            const advBalance = Number(c.advertiser_balance ?? 0);
            const spendPct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            const ctr = c.impressions_count > 0 ? ((c.clicks_count / c.impressions_count) * 100).toFixed(2) : '0.00';

            return (
              <div key={c.id} className="glass-card p-5 rounded-3xl flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  {/* Top Title + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-white truncate">{c.name}</h3>
                        {c.source_post_id && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-sky-500/15 text-sky-300 border border-sky-500/35 inline-flex items-center gap-1">
                            <Rocket className="w-3 h-3" />
                            <span>Boosted Post</span>
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase bg-cyan-950/70 text-cyan-300 border border-cyan-800/60">
                          {c.placement}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase bg-indigo-950/70 text-indigo-300 border border-indigo-800/60">
                          {c.pricing_model.toUpperCase()} @ ${Number(c.bid_amount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span>Brand: <strong className="text-slate-200">{c.business_name || 'Advertiser'}</strong></span>
                        <span className={`font-mono text-[11px] font-bold ${advBalance > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                          Wallet: ${advBalance.toFixed(2)}
                        </span>
                        {c.owner_user_id && (
                          <button
                            onClick={() => onInspectUserById(c.owner_user_id!)}
                            className="font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer"
                          >
                            @{c.owner_username || 'owner'}
                          </button>
                        )}
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border uppercase shrink-0 ${statusPill(c.status)}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Creative Preview */}
                  {(c.creative_title || c.creative_media_url) && (
                    <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/[0.06] flex gap-3 items-start">
                      {c.creative_media_url && (
                        <div className="w-20 h-20 rounded-xl bg-slate-950 border border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center">
                          {c.creative_media_type === 'video' ? (
                            <video src={c.creative_media_url} className="w-full h-full object-cover" muted />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.creative_media_url} alt={c.creative_title || c.name} className="w-full h-full object-cover" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-xs font-bold text-white truncate">
                          {c.creative_title || 'Untitled Creative'}
                        </div>
                        {c.creative_body && (
                          <p className="text-[11px] text-slate-300 line-clamp-2">{c.creative_body}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          {c.creative_cta_label && (
                            <span className="px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                              CTA: {c.creative_cta_label}
                            </span>
                          )}
                          {c.creative_destination_url && (
                            <a
                              href={c.creative_destination_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-mono text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 truncate max-w-[220px]"
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate">{c.creative_destination_url}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Targeting Summary + Budget Progress */}
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/[0.06] space-y-2.5 text-xs">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400">Impressions</div>
                        <div className="font-mono font-bold text-white">{c.impressions_count.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Clicks</div>
                        <div className="font-mono font-bold text-sky-300">{c.clicks_count.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">CTR</div>
                        <div className="font-mono font-bold text-indigo-300">{ctr}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Conv.</div>
                        <div className="font-mono font-bold text-emerald-300">{c.conversions_count}</div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">
                          Spent <strong className="text-white">${spent.toFixed(2)}</strong> / ${budget.toFixed(2)} (Daily cap: ${Number(c.daily_budget || 0).toFixed(2)})
                        </span>
                        <span className="text-cyan-300 font-bold">{spendPct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 rounded-full"
                          style={{ width: `${spendPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-400 pt-1">
                      <span>Freq Cap: {c.daily_frequency_cap ?? 3}/day</span>
                      <span>•</span>
                      <span>Age: {c.target_min_age ?? 13}-{c.target_max_age ?? 99}</span>
                      <span>•</span>
                      <span>Gender: {c.target_gender || 'all'}</span>
                      {c.target_countries && c.target_countries.length > 0 && (
                        <>
                          <span>•</span>
                          <span>Countries: {c.target_countries.join(', ')}</span>
                        </>
                      )}
                      {c.target_interests && c.target_interests.length > 0 && (
                        <>
                          <span>•</span>
                          <span>Interests: {c.target_interests.join(', ')}</span>
                        </>
                      )}
                    </div>

                    {c.rejection_reason && (
                      <div className="p-2 rounded-xl bg-rose-950/50 border border-rose-800/50 text-[11px] text-rose-300">
                        Rejection Note: {c.rejection_reason}
                      </div>
                    )}

                    {advBalance <= 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Wallet balance is $0.00 — top-up required before live delivery starts.</span>
                        </div>
                        <button
                          onClick={() => {
                            const advObj = advertisers.find((a) => a.id === c.advertiser_id) || {
                              id: c.advertiser_id,
                              user_id: c.owner_user_id || '',
                              business_name: c.business_name || 'Advertiser',
                              status: c.advertiser_status || 'pending',
                              balance: advBalance,
                              currency: 'USD',
                              created_at: c.created_at,
                            };
                            setTopUpTarget(advObj);
                            setTopUpAmount('50');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-bold shrink-0 cursor-pointer"
                        >
                          Top-Up Wallet
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-end gap-2">
                  {(c.status === 'pending_review' || c.status === 'rejected') && (
                    <button
                      onClick={() =>
                        executeAction('APPROVE_CAMPAIGN', c.id, {}, `Campaign "${c.name}" approved and live!`)
                      }
                      disabled={actionLoadingId === c.id}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve &amp; Go Live</span>
                    </button>
                  )}

                  {(c.status === 'pending_review' || c.status === 'active') && (
                    <button
                      onClick={() => {
                        setRejectTarget(c);
                        setRejectReason('Does not meet ZEV Advertising Policy guidelines.');
                      }}
                      disabled={actionLoadingId === c.id}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  )}

                  {c.status === 'active' && (
                    <button
                      onClick={() => executeAction('PAUSE_CAMPAIGN', c.id, {}, `Campaign "${c.name}" paused`)}
                      disabled={actionLoadingId === c.id}
                      className="glass-btn px-3.5 py-2 rounded-xl text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <PauseCircle className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                  )}

                  {c.status === 'paused' && (
                    <button
                      onClick={() => executeAction('RESUME_CAMPAIGN', c.id, {}, `Campaign "${c.name}" resumed`)}
                      disabled={actionLoadingId === c.id}
                      className="glass-btn px-3.5 py-2 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="glass-panel rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">Reject Ad Campaign</h3>
              <button onClick={() => setRejectTarget(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Provide a clear policy reason for rejecting <strong>{rejectTarget.name}</strong>. The advertiser will be notified.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs text-white focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setRejectTarget(null)} className="glass-btn px-4 py-2 rounded-xl text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button
                onClick={async () => {
                  const target = rejectTarget;
                  setRejectTarget(null);
                  await executeAction(
                    'REJECT_CAMPAIGN',
                    target.id,
                    { reason: rejectReason },
                    `Campaign "${target.name}" rejected`
                  );
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top-Up Advertiser Balance Modal */}
      {topUpTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="glass-panel rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">Credit Ad Wallet</h3>
              <button onClick={() => setTopUpTarget(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Add prepaid ad credit to <strong>{topUpTarget.business_name}</strong> (Current: $
              {Number(topUpTarget.balance || 0).toFixed(2)}).
            </p>
            <input
              type="number"
              min="1"
              step="0.01"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-sm font-mono text-white focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setTopUpTarget(null)} className="glass-btn px-4 py-2 rounded-xl text-xs text-slate-300 cursor-pointer">
                Cancel
              </button>
              <button
                onClick={async () => {
                  const amt = Math.max(1, parseFloat(topUpAmount) || 0);
                  const target = topUpTarget;
                  setTopUpTarget(null);
                  await executeAction(
                    'TOP_UP_BALANCE',
                    target.id,
                    { amount: amt },
                    `Added $${amt.toFixed(2)} to "${target.business_name}"`
                  );
                }}
                className="glass-btn-primary px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
              >
                Credit Wallet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
