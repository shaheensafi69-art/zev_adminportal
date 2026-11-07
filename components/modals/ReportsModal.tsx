'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, AlertTriangle, CheckCircle, ShieldAlert, Clock, Check, Eye, Trash2, Ban 
} from 'lucide-react';
import { VerifiedBadge } from '../VerifiedBadge';

export interface UserReportItem {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  details: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  reporter_first_name: string | null;
  reporter_last_name: string | null;
  reporter_username: string | null;
  reporter_avatar: string | null;
  reported_first_name: string | null;
  reported_last_name: string | null;
  reported_username: string | null;
  reported_email: string | null;
  reported_avatar: string | null;
  reported_is_verified: boolean;
}

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInspectUser?: (userId: string) => void;
  onBanUser?: (user: { id: string; email: string; is_banned: boolean; banned_until: string | null }) => void;
}

export function ReportsModal({ isOpen, onClose, onInspectUser, onBanUser }: ReportsModalProps) {
  const [reports, setReports] = useState<UserReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?status=${filter}`);
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReports();
    }
  }, [isOpen, filter]);

  const handleUpdateStatus = async (reportId: string, newStatus: 'resolved' | 'dismissed') => {
    setUpdatingId(reportId);
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
        );
      }
    } catch (err) {
      console.error('Failed to update report status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl max-h-[88vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Community Moderation & Reports</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
                  {reports.length} Total
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Review flagged accounts, abuse reports, and user safety alerts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-950/30 flex items-center gap-2 overflow-x-auto">
          {(['all', 'pending', 'resolved', 'dismissed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize cursor-pointer ${
                filter === tab
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
              <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Fetching moderation reports...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm bg-slate-950/40 rounded-2xl border border-slate-800">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-300">No moderation reports found</p>
              <p className="text-xs text-slate-500 mt-1">There are no reports matching the selected filter.</p>
            </div>
          ) : (
            reports.map((report) => {
              const reportedName = [report.reported_first_name, report.reported_last_name].filter(Boolean).join(' ') || report.reported_username || 'Unknown User';
              const reporterName = [report.reporter_first_name, report.reporter_last_name].filter(Boolean).join(' ') || report.reporter_username || 'Anonymous Reporter';

              return (
                <div
                  key={report.id}
                  className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col gap-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* Reported User Profile */}
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-white text-sm">
                        {report.reported_avatar ? (
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
                          @{report.reported_username || 'user'} • <span className="text-slate-400">{report.reported_email || 'No Email'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider ${
                        report.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : report.status === 'resolved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {report.status}
                      </span>
                      <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Report Reason & Details */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-rose-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Reason: {report.reason}</span>
                    </div>
                    {report.details && (
                      <p className="text-slate-300 font-mono text-[11px] leading-relaxed pl-6">
                        {report.details}
                      </p>
                    )}
                    <div className="text-[11px] text-slate-500 pl-6">
                      Flagged by: <span className="text-slate-400 font-semibold">{reporterName}</span> (@{report.reporter_username || 'reporter'})
                    </div>
                  </div>

                  {/* Actions for this report */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/50">
                    <div className="flex items-center gap-2">
                      {onInspectUser && (
                        <button
                          onClick={() => onInspectUser(report.reported_user_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-800/60 text-cyan-300 text-xs font-semibold transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View 0-100 Dossier</span>
                        </button>
                      )}

                      {onBanUser && (
                        <button
                          onClick={() => onBanUser({
                            id: report.reported_user_id,
                            email: report.reported_email || 'User',
                            is_banned: false,
                            banned_until: null,
                          })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/60 text-rose-300 text-xs font-semibold transition-all cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Ban User</span>
                        </button>
                      )}
                    </div>

                    {/* Status Toggle Actions */}
                    <div className="flex items-center gap-2">
                      {report.status !== 'resolved' && (
                        <button
                          onClick={() => handleUpdateStatus(report.id, 'resolved')}
                          disabled={updatingId === report.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 text-emerald-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Resolved</span>
                        </button>
                      )}

                      {report.status !== 'dismissed' && (
                        <button
                          onClick={() => handleUpdateStatus(report.id, 'dismissed')}
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

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

