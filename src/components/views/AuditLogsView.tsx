'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, ShieldCheck, RefreshCw, CheckCircle, Search, Clock, ArrowRight 
} from 'lucide-react';
import { AdminAuditLog } from '@/lib/types';

export function AuditLogsView() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit?action=${encodeURIComponent(actionFilter)}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-950/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Immutable Security Audit Trail</h2>
            <p className="text-xs text-slate-400">
              Cryptographically verified timeline of all administrator operations, policy enforcement, and account modifications
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Action Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['', 'WARN_USER', 'RESTRICT_USER', 'UNRESTRICT_USER', 'BAN_USER', 'UNBAN_USER', 'TOGGLE_BLUE_TICK', 'DELETE_USER', 'DELETE_POST', 'DELETE_REEL'].map((act) => (
          <button
            key={act}
            onClick={() => setActionFilter(act)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
              actionFilter === act
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {act ? act : 'ALL ACTIONS'}
          </button>
        ))}
      </div>

      {/* Logs Timeline */}
      <div className="rounded-3xl bg-slate-950/60 border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading security audit trail...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-200">No audit events recorded for this filter</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {logs.map((log) => {
              const targetName = [log.target_user?.first_name, log.target_user?.last_name].filter(Boolean).join(' ') || log.target_user?.email || log.target_user_id || 'System';

              return (
                <div
                  key={log.id}
                  className="p-4 px-6 hover:bg-slate-900/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 sm:mt-0 font-mono text-[10px]">
                      LOG
                    </div>
                    <div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-white px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px]">
                          {log.action}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-300 font-semibold">{targetName}</span>
                      </div>
                      {log.details && (
                        <div className="text-[11px] text-slate-400 font-mono mt-1">
                          {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Executor: {log.admin_id || 'admin@zevapp.com'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
