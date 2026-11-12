'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Check,
  Eye,
  Ban,
  RefreshCw,
  Trash2,
  FileWarning,
  UserCheck,
} from 'lucide-react';
import { UserReportItem } from '../modals/ReportsModal';
import { PostReportItem } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface ReportsViewProps {
  onInspectUserById: (userId: string) => void;
  onBanUser: (target: { id: string; email: string }) => void;
}

export function ReportsView({ onInspectUserById, onBanUser }: ReportsViewProps) {
  const [sourceTab, setSourceTab] = useState<'post_reports' | 'user_reports'>('post_reports');
  const [userReports, setUserReports] = useState<UserReportItem[]>([]);
  const [postReports, setPostReports] = useState<PostReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all' | 'resolved' | 'dismissed'>('pending');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?status=${filter}`);
      const data = await res.json();
      if (data.success) {
        setUserReports(data.reports || []);
        setPostReports(data.postReports || []);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/reports?status=${filter}`);
        const data = await res.json();
        if (!cancelled && data.success) {
          setUserReports(data.reports || []);
          setPostReports(data.postReports || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const handleUpdateStatus = async (
    reportId: string,
    newStatus: 'resolved' | 'dismissed',
    reportSource: 'user_reports' | 'post_reports',
    deleteTarget?: { targetType: string; targetId: string }
  ) => {
    if (
      deleteTarget &&
      !confirm(`Soft-delete flagged ${deleteTarget.targetType} content AND mark report resolved?`)
    ) {
      return;
    }

    setUpdatingId(reportId);
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          status: newStatus,
          reportSource,
          deleteTarget: Boolean(deleteTarget),
          targetType: deleteTarget?.targetType,
          targetId: deleteTarget?.targetId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (reportSource === 'post_reports') {
          setPostReports((prev) =>
            prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
          );
        } else {
          setUserReports((prev) =>
            prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
          );
        }
      }
    } catch (err) {
      console.error('Failed to update report status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl glass-panel">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Community Moderation & Content Reports</h2>
            <p className="text-xs text-slate-400">
              Moderate flagged posts, reels, stories, comments, chat messages (`post_reports`) and reported accounts (`user_reports`)
            </p>
          </div>
        </div>

        <button
          onClick={fetchReports}
          disabled={loading}
          className="glass-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Reports</span>
        </button>
      </div>

      {/* Queue Switcher & Filter Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800/80 rounded-2xl w-fit">
          <button
            onClick={() => setSourceTab('post_reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              sourceTab === 'post_reports'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileWarning className="w-3.5 h-3.5" />
            <span>Content & Chat Reports ({postReports.length})</span>
          </button>
          <button
            onClick={() => setSourceTab('user_reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              sourceTab === 'user_reports'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Account Reports ({userReports.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(['pending', 'all', 'resolved', 'dismissed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all capitalize cursor-pointer ${
                filter === tab
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading moderation reports...</span>
          </div>
        ) : sourceTab === 'post_reports' ? (
          postReports.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-sm glass-panel rounded-3xl">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-200">No content or chat reports for this filter</p>
              <p className="text-xs text-slate-500 mt-1">All flagged posts, reels, stories & messages are cleared.</p>
            </div>
          ) : (
            postReports.map((report) => {
              const reportedName =
                [report.reported_first_name, report.reported_last_name].filter(Boolean).join(' ') ||
                report.reported_username ||
                'Content Author';
              const reporterName =
                [report.reporter_first_name, report.reporter_last_name].filter(Boolean).join(' ') ||
                report.reporter_username ||
                'Reporter';

              return (
                <div
                  key={report.id}
                  className="p-6 rounded-3xl glass-card flex flex-col gap-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-white text-sm">
                        {report.reported_avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={report.reported_avatar} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          reportedName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-bold text-white text-sm">
                          <span>{reportedName}</span>
                          {report.reported_is_verified && <VerifiedBadge size="sm" />}
                          <span className="px-2 py-0.5 rounded-lg bg-cyan-950/70 text-cyan-300 border border-cyan-800/50 text-[10px] font-mono uppercase">
                            {report.target_type}
                          </span>
                        </div>
                        <div className="text-xs text-cyan-400 font-mono">
                          @{report.reported_username || 'user'} • Target ID: {report.target_id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider ${
                          report.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : report.status === 'resolved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {report.status}
                      </span>
                      <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Violation + Flagged Content Preview */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold text-rose-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Reason: {report.reason}</span>
                      </div>
                      {report.details && (
                        <p className="text-slate-300 font-mono text-[11px] leading-relaxed pl-6">
                          &quot;{report.details}&quot;
                        </p>
                      )}
                      <div className="text-[11px] text-slate-500 pl-6">
                        Reported by: <span className="text-slate-300 font-semibold">{reporterName}</span> (@
                        {report.reporter_username || 'reporter'})
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/50 border border-white/[0.08] text-xs flex items-center gap-3">
                      {report.target_media_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={report.target_media_url}
                          alt="flagged target"
                          className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono text-slate-400 uppercase mb-1">
                          Flagged {report.target_type} preview
                        </div>
                        <p className="text-slate-200 line-clamp-3">
                          {report.target_preview || 'Content already deleted or text unavailable'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.08]">
                    <div className="flex flex-wrap items-center gap-2">
                      {report.reported_user_id && (
                        <>
                          <button
                            onClick={() => onInspectUserById(report.reported_user_id!)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/60 text-cyan-300 text-xs font-semibold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View 0-100 Dossier</span>
                          </button>
                          <button
                            onClick={() =>
                              onBanUser({
                                id: report.reported_user_id!,
                                email: report.reported_email || report.reported_username || 'User',
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-xs font-semibold cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Ban Author</span>
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {report.status !== 'resolved' && (
                        <button
                          onClick={() =>
                            handleUpdateStatus(report.id, 'resolved', 'post_reports', {
                              targetType: report.target_type,
                              targetId: report.target_id,
                            })
                          }
                          disabled={updatingId === report.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Content & Resolve</span>
                        </button>
                      )}
                      {report.status !== 'resolved' && (
                        <button
                          onClick={() => handleUpdateStatus(report.id, 'resolved', 'post_reports')}
                          disabled={updatingId === report.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Resolved</span>
                        </button>
                      )}
                      {report.status !== 'dismissed' && (
                        <button
                          onClick={() => handleUpdateStatus(report.id, 'dismissed', 'post_reports')}
                          disabled={updatingId === report.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          <span>Dismiss</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : userReports.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-sm glass-panel rounded-3xl">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-200">No account reports found for this filter</p>
            <p className="text-xs text-slate-500 mt-1">All flagged user activity is cleared.</p>
          </div>
        ) : (
          userReports.map((report) => {
            const reportedName =
              [report.reported_first_name, report.reported_last_name].filter(Boolean).join(' ') ||
              report.reported_username ||
              'Unknown User';
            const reporterName =
              [report.reporter_first_name, report.reporter_last_name].filter(Boolean).join(' ') ||
              report.reporter_username ||
              'Anonymous Reporter';

            return (
              <div key={report.id} className="p-6 rounded-3xl glass-card flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-white text-sm">
                      {report.reported_avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={report.reported_avatar} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        reportedName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                        <span>{reportedName}</span>
                        {report.reported_is_verified && <VerifiedBadge size="sm" />}
                      </div>
                      <div className="text-xs text-cyan-400 font-mono">
                        @{report.reported_username || 'user'} •{' '}
                        <span className="text-slate-400">{report.reported_email || 'No Email'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider ${
                        report.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : report.status === 'resolved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {report.status}
                    </span>
                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Reported Violation: {report.reason}</span>
                  </div>
                  {report.details && (
                    <p className="text-slate-300 font-mono text-[11px] leading-relaxed pl-6">
                      &quot;{report.details}&quot;
                    </p>
                  )}
                  <div className="text-[11px] text-slate-500 pl-6">
                    Submitted by: <span className="text-slate-400 font-semibold">{reporterName}</span> (@
                    {report.reporter_username || 'reporter'})
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onInspectUserById(report.reported_user_id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/60 text-cyan-300 text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View 0-100 Dossier</span>
                    </button>

                    <button
                      onClick={() => onBanUser({ id: report.reported_user_id, email: report.reported_email || 'User' })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Ban Account</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {report.status !== 'resolved' && (
                      <button
                        onClick={() => handleUpdateStatus(report.id, 'resolved', 'user_reports')}
                        disabled={updatingId === report.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Resolved</span>
                      </button>
                    )}

                    {report.status !== 'dismissed' && (
                      <button
                        onClick={() => handleUpdateStatus(report.id, 'dismissed', 'user_reports')}
                        disabled={updatingId === report.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                      >
                        <span>Dismiss</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
