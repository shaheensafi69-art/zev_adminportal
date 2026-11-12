'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  CheckCircle,
  Clock,
  Eye,
  RefreshCw,
  ShieldAlert,
  Ban,
  Search,
  ExternalLink,
  Image as ImageIcon,
  X,
  Check,
  XCircle,
  FileWarning,
} from 'lucide-react';
import { AppealRecord } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface AppealsViewProps {
  onInspectUserById: (userId: string) => void;
  onAppealUpdated?: () => Promise<void> | void;
}

type AppealFilter = 'pending' | 'under_review' | 'approved' | 'rejected' | 'all';

export function AppealsView({ onInspectUserById, onAppealUpdated }: AppealsViewProps) {
  const [appeals, setAppeals] = useState<AppealRecord[]>([]);
  const [counts, setCounts] = useState<Record<AppealFilter, number>>({
    pending: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    all: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AppealFilter>('pending');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/appeals?status=${filter}`);
      const data = await res.json();
      if (data.success) {
        setAppeals(data.appeals || []);
        if (data.counts) {
          setCounts((prev) => ({ ...prev, ...data.counts }));
        }
      } else {
        setActionError(data.error || 'Failed to load appeals');
      }
    } catch (err) {
      console.error('Failed to load appeals:', err);
      setActionError('Network error while loading appeals');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  const handleAction = async (
    appealId: string,
    action: 'UNDER_REVIEW' | 'APPROVE' | 'REJECT'
  ) => {
    setUpdatingId(appealId);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appealId,
          action,
          adminResponse: responses[appealId] || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error || 'Failed to update appeal status');
        return;
      }
      await fetchAppeals();
      if (onAppealUpdated) {
        await onAppealUpdated();
      }
    } catch (err) {
      console.error('Appeal action failed:', err);
      setActionError('Failed to submit decision');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Lightbox Modal for Evidence Images */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="relative max-w-4xl w-full rounded-3xl glass-panel border border-white/[0.12] p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-cyan-300 font-semibold truncate">
                Appeal Supporting Evidence
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open Original</span>
                </a>
                <button
                  onClick={() => setLightboxUrl(null)}
                  className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Appeal evidence"
              className="w-full max-h-[75vh] object-contain rounded-2xl bg-slate-950/80"
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl glass-panel border border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">
              Account Standing & Restriction Appeals
            </h2>
            <p className="text-xs text-slate-400">
              Review user-submitted ban & restriction appeals, inspect evidence, and restore standing in real time
            </p>
          </div>
        </div>

        <button
          onClick={fetchAppeals}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'pending', label: 'Pending' },
            { key: 'under_review', label: 'Under Review' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
            { key: 'all', label: 'All Appeals' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              filter === tab.key
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-white/[0.06] text-slate-300">
              {counts[tab.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 font-semibold">
          {actionError}
        </div>
      )}

      {/* Appeals List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading standing appeals...</span>
          </div>
        ) : appeals.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-sm bg-slate-950/40 rounded-3xl border border-slate-800">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-200">No appeals found in this queue</p>
            <p className="text-xs text-slate-500 mt-1">
              User restriction and suspension appeals submitted in the mobile app will appear here.
            </p>
          </div>
        ) : (
          appeals.map((appeal) => {
            const fullName =
              [appeal.first_name, appeal.last_name].filter(Boolean).join(' ') ||
              appeal.username ||
              'Unknown User';
            const evidenceUrls = Array.isArray(appeal.evidence_urls)
              ? appeal.evidence_urls.filter(Boolean)
              : [];
            const isBusy = updatingId === appeal.id;

            return (
              <div
                key={appeal.id}
                className="p-6 rounded-3xl bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col gap-4"
              >
                {/* Top User Row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-white text-sm">
                      {appeal.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={appeal.avatar_url}
                          alt={fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 font-bold text-white text-sm">
                        <span>{fullName}</span>
                        {appeal.is_verified && <VerifiedBadge size="sm" />}
                        {appeal.is_banned && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-700/60 inline-flex items-center gap-1">
                            <Ban className="w-2.5 h-2.5" /> BANNED
                          </span>
                        )}
                        {appeal.is_restricted && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-orange-950/80 text-orange-300 border border-orange-700/60 inline-flex items-center gap-1">
                            <ShieldAlert className="w-2.5 h-2.5" /> RESTRICTED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-cyan-400 font-mono">
                        @{appeal.username || 'user'} •{' '}
                        <span className="text-slate-400">{appeal.email || 'No Email'}</span> •{' '}
                        <span className="text-slate-500">
                          {appeal.warning_count || 0} warning(s)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider border ${
                        appeal.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : appeal.status === 'under_review'
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                          : appeal.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {appeal.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(appeal.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Appeal Reason & User Explanation */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-xs space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-cyan-300">
                    <FileWarning className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Appeal Reason: {appeal.reason}</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed whitespace-pre-wrap pl-6">
                    {appeal.explanation}
                  </p>

                  {(appeal.linked_restriction_reason ||
                    appeal.ban_reason ||
                    appeal.restriction_reason) && (
                    <div className="mt-2 ml-6 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                      <div className="font-mono font-bold text-orange-300 uppercase">
                        Original Standing Enforcement (
                        {appeal.restriction_type || (appeal.is_banned ? 'SUSPENSION' : 'RESTRICTION')}
                        )
                      </div>
                      <div>
                        Reason:{' '}
                        <span className="text-slate-200">
                          {appeal.linked_restriction_reason ||
                            appeal.ban_reason ||
                            appeal.restriction_reason}
                        </span>
                      </div>
                      {appeal.linked_restriction_details && (
                        <div>Details: {appeal.linked_restriction_details}</div>
                      )}
                      {appeal.linked_restriction_expires_at && (
                        <div>
                          Expires:{' '}
                          {new Date(appeal.linked_restriction_expires_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Evidence Gallery */}
                {evidenceUrls.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Attached Evidence ({evidenceUrls.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {evidenceUrls.map((url, idx) => (
                        <button
                          key={`${appeal.id}-ev-${idx}`}
                          type="button"
                          onClick={() => setLightboxUrl(url)}
                          className="group relative w-24 h-24 rounded-2xl overflow-hidden border border-white/[0.1] bg-slate-900 cursor-pointer hover:border-cyan-400/60 transition-all"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Evidence ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing Review Info or Admin Response Composer */}
                <div className="space-y-2">
                  {appeal.admin_response && (
                    <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-100">
                      <span className="font-mono text-[10px] uppercase text-cyan-400 font-bold block mb-1">
                        Admin Response
                        {appeal.reviewed_by ? ` • by ${appeal.reviewed_by}` : ''}
                      </span>
                      {appeal.admin_response}
                    </div>
                  )}

                  {appeal.status !== 'approved' && appeal.status !== 'rejected' && (
                    <textarea
                      rows={2}
                      value={responses[appeal.id] ?? ''}
                      onChange={(e) =>
                        setResponses((prev) => ({ ...prev, [appeal.id]: e.target.value }))
                      }
                      placeholder="Optional response note to send to the user in their notification..."
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 focus:border-cyan-500/50 focus:outline-none text-xs text-slate-100 placeholder:text-slate-500 resize-none"
                    />
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => onInspectUserById(appeal.user_id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/60 text-cyan-300 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View 0-100 Dossier</span>
                  </button>

                  {appeal.status !== 'approved' && appeal.status !== 'rejected' && (
                    <div className="flex flex-wrap items-center gap-2">
                      {appeal.status !== 'under_review' && (
                        <button
                          onClick={() => handleAction(appeal.id, 'UNDER_REVIEW')}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Mark Under Review</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleAction(appeal.id, 'APPROVE')}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve &amp; Lift Standing</span>
                      </button>

                      <button
                        onClick={() => handleAction(appeal.id, 'REJECT')}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject Appeal</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
