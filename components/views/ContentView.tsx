'use client';

import React, { useState, useEffect } from 'react';
import { 
  Film, MessageSquare, Heart, Eye, Trash2, Search, 
  RefreshCw, CheckCircle, ExternalLink 
} from 'lucide-react';
import { PlatformPost, PlatformReel } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface ContentViewProps {
  onInspectUserById: (userId: string) => void;
}

export function ContentView({ onInspectUserById }: ContentViewProps) {
  const [activeType, setActiveType] = useState<'posts' | 'reels'>('posts');
  const [items, setItems] = useState<(PlatformPost | PlatformReel)[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content?type=${activeType}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to load content:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, [activeType]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this content from the platform?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/content?type=${activeType === 'posts' ? 'post' : 'reel'}&id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete content:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-950/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Platform Content Moderation</h2>
            <p className="text-xs text-slate-400">
              Inspect, review, and moderate discussion posts and short video reels across ZEV
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchContent}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Feed</span>
          </button>
        </div>
      </div>

      {/* Type Switcher & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800/80 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setActiveType('posts')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeType === 'posts'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Discussion Posts</span>
          </button>
          <button
            onClick={() => setActiveType('reels')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeType === 'reels'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Video Reels</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${activeType}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchContent()}
            className="w-full pl-9 pr-4 py-2 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Loading platform content...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="p-16 text-center text-slate-400 text-sm bg-slate-950/40 rounded-3xl border border-slate-800">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
          <p className="font-semibold text-slate-200">No content items found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => {
            const authorName = [item.author_first_name, item.author_last_name].filter(Boolean).join(' ') || item.author_username || 'User';
            const isReel = activeType === 'reels';
            const reel = item as PlatformReel;
            const post = item as PlatformPost;

            return (
              <div
                key={item.id}
                className="p-5 rounded-3xl bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  {/* Author Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div 
                      onClick={() => onInspectUserById(item.user_id)}
                      className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs shrink-0 overflow-hidden">
                        {item.author_avatar ? (
                          <img src={item.author_avatar} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          authorName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs flex items-center gap-1">
                          <span>{authorName}</span>
                          {item.author_is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        <div className="text-[10px] text-cyan-400 font-mono">
                          @{item.author_username || 'user'}
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Title / Description */}
                  {item.title && (
                    <div className="font-bold text-white text-sm mb-1 line-clamp-1">
                      {item.title}
                    </div>
                  )}

                  {isReel ? (
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {reel.description || 'No description provided'}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                      {post.content || 'No text content'}
                    </p>
                  )}

                  {/* Visual Media Preview */}
                  {isReel && reel.thumbnail_url && (
                    <div className="mt-3 relative rounded-2xl overflow-hidden aspect-video bg-black/60 border border-slate-800">
                      <img src={reel.thumbnail_url} alt="thumbnail" className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 font-mono text-[10px] text-white">
                        {reel.duration_seconds ? `${reel.duration_seconds}s` : 'Video'}
                      </div>
                    </div>
                  )}

                  {!isReel && post.image_url && (
                    <div className="mt-3 rounded-2xl overflow-hidden aspect-video bg-black/60 border border-slate-800">
                      <img src={post.image_url} alt="post media" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Engagement Metrics & Remove Button */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    {isReel && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        {reel.views_count || 0}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-300">
                      <Heart className="w-3.5 h-3.5 text-rose-400" />
                      {item.likes_count || 0}
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                      {item.comments_count || 0}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isReel && reel.video_url && (
                      <a
                        href={reel.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Open Video URL"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 transition-colors cursor-pointer disabled:opacity-50"
                      title="Delete Content (Moderation)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
