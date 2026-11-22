'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Cloud, HardDrive, FileText, Image, Film, Music, File, Link2, 
  Folder, Trash2, Pin, Search, Filter, RefreshCw, ExternalLink, 
  CheckCircle2, AlertCircle, X, Users, Database
} from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface CloudDriveViewProps {
  onInspectUserById?: (userId: string) => void;
}

export function CloudDriveView({ onInspectUserById }: CloudDriveViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [topConsumers, setTopConsumers] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({
    totalItems: 0,
    totalBytes: 0,
    notesCount: 0,
    mediaCount: 0,
    mediaBytes: 0,
    docsCount: 0,
    docsBytes: 0,
    linksCount: 0,
    audioCount: 0,
    audioBytes: 0,
    totalFolders: 0,
    activeStorageUsers: 0,
  });

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const fetchCloudData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        category: selectedCategory,
        q: searchQuery.trim(),
      });

      const res = await fetch(`/api/admin/cloud?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        if (data.kpis) setKpis(data.kpis);
        setTopConsumers(data.topConsumers || []);
        setItems(data.items || []);
      }
    } catch (err: any) {
      console.error('Failed to load cloud drive data:', err);
      showToast('Error loading cloud storage data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchCloudData();
  }, [fetchCloudData]);

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Permanently delete this cloud storage item? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/admin/cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_item', id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Item deleted from cloud drive', 'success');
        fetchCloudData();
      } else {
        showToast(data.error || 'Failed to delete item', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'media':
        return <Image className="w-3.5 h-3.5 text-purple-400" />;
      case 'documents':
        return <File className="w-3.5 h-3.5 text-blue-400" />;
      case 'audio':
        return <Music className="w-3.5 h-3.5 text-emerald-400" />;
      case 'links':
        return <Link2 className="w-3.5 h-3.5 text-cyan-400" />;
      case 'notes':
      default:
        return <FileText className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-sm animate-fade-in ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' 
            : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
        }`}>
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-blue-400">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              ZEV Cloud Drive & Saved Storage
              <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300">
                Personal Cloud & Saved Messages
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitor user cloud storage consumption, saved messages, media backups, and manage storage quotas.
            </p>
          </div>
        </div>

        <button
          onClick={fetchCloudData}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 text-xs font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh Storage</span>
        </button>
      </div>

      {/* Storage KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-900 border border-blue-800/40">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Cloud Storage</span>
            <HardDrive className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {formatBytes(Number(kpis.totalBytes || 0))}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Across {kpis.activeStorageUsers || 0} active user vaults
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 border border-purple-800/40">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Stored Items</span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{kpis.totalItems || 0}</div>
          <div className="text-[11px] text-purple-300 mt-1">
            In {kpis.totalFolders || 0} Custom Folders
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-800/40">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Media & Documents</span>
            <Film className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {formatBytes(Number(kpis.mediaBytes || 0) + Number(kpis.docsBytes || 0))}
          </div>
          <div className="text-[11px] text-cyan-300 mt-1">
            {(kpis.mediaCount || 0) + (kpis.docsCount || 0)} files archived
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-800/40">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Notes, Audio & Links</span>
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {(kpis.notesCount || 0) + (kpis.linksCount || 0) + (kpis.audioCount || 0)}
          </div>
          <div className="text-[11px] text-emerald-300 mt-1">
            Saved snippets & audio notes
          </div>
        </div>
      </div>

      {/* Top Consumers & Category Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Consumers Card */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Top Cloud Storage Users
            </h3>
            <span className="text-[11px] text-slate-500">Vault Ranking</span>
          </div>

          {topConsumers.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No cloud data stored yet.</p>
          ) : (
            <div className="space-y-2.5">
              {topConsumers.slice(0, 5).map((user, idx) => (
                <div
                  key={user.user_id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-mono font-bold text-slate-500 w-4">
                      #{idx + 1}
                    </span>
                    <button
                      onClick={() => onInspectUserById?.(user.user_id)}
                      className="flex items-center space-x-2 text-left hover:text-cyan-400"
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-800 overflow-hidden flex-shrink-0">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1">
                          <span>@{user.username || 'user'}</span>
                          {user.is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {user.items_count} items • {user.folders_count || 0} folders
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="text-right font-mono text-xs font-bold text-cyan-300">
                    {formatBytes(Number(user.total_bytes))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown & File Type Cards */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            File Vault Distribution & Types
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 text-center">
              <Image className="w-5 h-5 mx-auto text-purple-400 mb-1" />
              <div className="text-xs font-bold text-white">{kpis.mediaCount || 0}</div>
              <div className="text-[10px] text-purple-300">Media</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(Number(kpis.mediaBytes || 0))}</div>
            </div>

            <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-800/40 text-center">
              <File className="w-5 h-5 mx-auto text-blue-400 mb-1" />
              <div className="text-xs font-bold text-white">{kpis.docsCount || 0}</div>
              <div className="text-[10px] text-blue-300">Documents</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(Number(kpis.docsBytes || 0))}</div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-center">
              <Music className="w-5 h-5 mx-auto text-emerald-400 mb-1" />
              <div className="text-xs font-bold text-white">{kpis.audioCount || 0}</div>
              <div className="text-[10px] text-emerald-300">Audio Memos</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(Number(kpis.audioBytes || 0))}</div>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-center">
              <FileText className="w-5 h-5 mx-auto text-amber-400 mb-1" />
              <div className="text-xs font-bold text-white">{kpis.notesCount || 0}</div>
              <div className="text-[10px] text-amber-300">Notes & Text</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Encrypted</div>
            </div>

            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-center col-span-2 md:col-span-1">
              <Link2 className="w-5 h-5 mx-auto text-cyan-400 mb-1" />
              <div className="text-xs font-bold text-white">{kpis.linksCount || 0}</div>
              <div className="text-[10px] text-cyan-300">Saved Links</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Bookmarks</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Folder className="w-4 h-4 text-indigo-400" />
              <span>Storage Encryption: <strong className="text-slate-200">AES-256 + Cloudflare R2 / Supabase Storage</strong></span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
              Active Storage Sync
            </span>
          </div>
        </div>
      </div>

      {/* Explorer / Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search file name, title or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-56 md:w-72"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700/60 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All File Vaults</option>
            <option value="media">Media (Images & Video)</option>
            <option value="documents">Documents</option>
            <option value="audio">Audio</option>
            <option value="notes">Notes</option>
            <option value="links">Links</option>
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Vault Index: <span className="text-white font-semibold">{items.length}</span> stored records
        </div>
      </div>

      {/* Items Table */}
      {items.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
          <Cloud className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-medium">No cloud storage items found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3.5">Item & Title</th>
                <th className="p-3.5">Owner User</th>
                <th className="p-3.5">Category & Folder</th>
                <th className="p-3.5">Size</th>
                <th className="p-3.5">Date Added</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  {/* Title & File Name */}
                  <td className="p-3.5">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-slate-800 border border-slate-700/60">
                        {getCategoryIcon(item.category)}
                      </div>
                      <div className="max-w-xs">
                        <div className="font-semibold text-white truncate flex items-center gap-1.5">
                          <span>{item.title || item.file_name || 'Untitled Entry'}</span>
                          {item.is_pinned && (
                            <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          )}
                        </div>
                        {item.content && (
                          <div className="text-[10px] text-slate-400 truncate max-w-sm">
                            {item.content}
                          </div>
                        )}
                        {item.file_name && item.title && (
                          <div className="text-[10px] font-mono text-slate-500 truncate">
                            {item.file_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Owner */}
                  <td className="p-3.5">
                    <button
                      onClick={() => item.user_id && onInspectUserById?.(item.user_id)}
                      className="flex items-center space-x-2 text-left hover:text-cyan-400"
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-800 overflow-hidden flex-shrink-0">
                        {item.avatar_url ? (
                          <img src={item.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <span className="font-medium text-slate-200 flex items-center gap-1">
                        @{item.username || 'user'}
                        {item.is_verified && <VerifiedBadge size="sm" />}
                      </span>
                    </button>
                  </td>

                  {/* Category & Folder */}
                  <td className="p-3.5">
                    <div className="space-y-0.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                        {item.category}
                      </span>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Folder className="w-2.5 h-2.5 text-indigo-400" />
                        <span>{item.folder_name || 'Root Drive'}</span>
                      </div>
                    </div>
                  </td>

                  {/* Size */}
                  <td className="p-3.5 font-mono text-slate-300">
                    {formatBytes(Number(item.file_size || 0))}
                  </td>

                  {/* Date */}
                  <td className="p-3.5 text-slate-400 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>

                  {/* Actions */}
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      {item.file_url && (
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900 border border-blue-800 text-blue-300"
                          title="Open / Download File"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300"
                        title="Delete Item"
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
      )}
    </div>
  );
}
