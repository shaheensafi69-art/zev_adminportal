'use client';

import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, MessageSquare, CheckCircle, Clock, AlertTriangle, 
  RefreshCw, Search, Eye, Phone, Mail, User, ShieldAlert, Check
} from 'lucide-react';
import { VerifiedBadge } from '../VerifiedBadge';

interface SupportTicket {
  id: string;
  user_id?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  profile_email?: string;
  category: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export function SupportTicketsView({ onInspectUserById }: { onInspectUserById: (id: string) => void }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [search, setSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/support?status=${activeTab}`);
      const data = await res.json();
      if (data.success) {
        setTickets(data.tickets || []);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [activeTab]);

  const handleUpdateStatus = async (ticketId: string, status: string, notes?: string) => {
    setActionLoadingId(ticketId);
    try {
      const res = await fetch('/api/admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          status,
          adminNotes: notes !== undefined ? notes : adminNoteInput,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket((prev) => prev ? { ...prev, status: status as any, admin_notes: notes ?? adminNoteInput } : null);
        }
      }
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filtered = tickets.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (t.subject || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.username || '').toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q) ||
      (t.phone || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q)
    );
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'medium':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
      default:
        return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
      case 'closed':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      default:
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-950/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Help & Support Tickets
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Customer Care
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Manage incoming support inquiries, account issues, and subscription assistance
            </p>
          </div>
        </div>

        <button
          onClick={fetchTickets}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-2 transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/60 border border-slate-800">
          {(['all', 'open', 'in_progress', 'resolved'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium capitalize transition cursor-pointer ${
                activeTab === tab
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, subject, email..."
            className="pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Tickets List */}
      <div className="rounded-3xl bg-slate-950/40 border border-slate-800/80 overflow-hidden backdrop-blur-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
            <span className="text-xs">Loading support tickets...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No support tickets found in this view.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filtered.map((ticket) => {
              const isLoading = actionLoadingId === ticket.id;
              return (
                <div key={ticket.id} className="p-5 hover:bg-slate-900/40 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left: User & Ticket details */}
                  <div className="space-y-2 min-w-0 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold border ${getStatusBadge(ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase border ${getPriorityBadge(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300">
                        {ticket.category}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(ticket.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">{ticket.subject}</h3>
                      <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap line-clamp-3">
                        {ticket.description}
                      </p>
                    </div>

                    {/* Requester Profile bar */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{ticket.first_name ? `${ticket.first_name} ${ticket.last_name || ''}` : ticket.username || 'Anonymous'}</span>
                        {ticket.username && <span className="text-slate-400 font-normal">(@{ticket.username})</span>}
                      </div>
                      {(ticket.email || ticket.profile_email) && (
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{ticket.email || ticket.profile_email}</span>
                        </div>
                      )}
                      {ticket.phone && (
                        <div className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{ticket.phone}</span>
                        </div>
                      )}
                    </div>

                    {ticket.admin_notes && (
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 mt-2">
                        <span className="font-bold text-cyan-400 font-mono">Admin Note: </span>
                        {ticket.admin_notes}
                      </div>
                    )}
                  </div>

                  {/* Right: Quick Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {ticket.user_id && (
                      <button
                        onClick={() => onInspectUserById(ticket.user_id!)}
                        className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" /> Inspect
                      </button>
                    )}

                    {ticket.status !== 'in_progress' && ticket.status !== 'resolved' && (
                      <button
                        onClick={() => handleUpdateStatus(ticket.id, 'in_progress')}
                        disabled={isLoading}
                        className="px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-xs text-blue-300 font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" /> Start
                      </button>
                    )}

                    {ticket.status !== 'resolved' && (
                      <button
                        onClick={() => handleUpdateStatus(ticket.id, 'resolved')}
                        disabled={isLoading}
                        className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs text-emerald-300 font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Resolve
                      </button>
                    )}

                    {ticket.status === 'resolved' && (
                      <button
                        onClick={() => handleUpdateStatus(ticket.id, 'closed')}
                        disabled={isLoading}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-400 font-medium transition cursor-pointer"
                      >
                        Close
                      </button>
                    )}
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
