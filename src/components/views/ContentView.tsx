'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Film,
  MessageSquare,
  Heart,
  Eye,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle,
  ExternalLink,
  Play,
  Hash,
  Flame,
  Plus,
  MapPin,
  Clock,
  Images,
  Repeat2,
  Bookmark,
} from 'lucide-react';
import { PlatformPost, PlatformReel, PlatformStory, PlatformHashtag, TrendingTopicItem } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface ContentViewProps {
  onInspectUserById: (userId: string) => void;
}

export function ContentView({ onInspectUserById }: ContentViewProps) {
  const [activeType, setActiveType] = useState<'posts' | 'reels' | 'stories' | 'hashtags'>('posts');
  const [items, setItems] = useState<(PlatformPost | PlatformReel | PlatformStory)[]>([]);
  const [hashtags, setHashtags] = useState<PlatformHashtag[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renderedAtMs, setRenderedAtMs] = useState<number>(() => Date.now());

  // Add trending topic form
  const [topicInput, setTopicInput] = useState('');
  const [topicCategory, setTopicCategory] = useState('general');
  const [topicScore, setTopicScore] = useState('100');
  const [savingTopic, setSavingTopic] = useState(false);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content?type=${activeType}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) {
        setRenderedAtMs(Date.now());
        if (activeType === 'hashtags') {
          setHashtags(data.hashtags || []);
          setTrendingTopics(data.trendingTopics || []);
          setItems([]);
        } else {
          setItems(data.items || []);
        }
      }
    } catch (err) {
      console.error('Failed to load content:', err);
    } finally {
      setLoading(false);
    }
  }, [activeType, search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/content?type=${activeType}&search=${encodeURIComponent(search)}`);
        const data = await res.json();
        if (!cancelled && data.success) {
          setRenderedAtMs(Date.now());
          if (activeType === 'hashtags') {
            setHashtags(data.hashtags || []);
            setTrendingTopics(data.trendingTopics || []);
            setItems([]);
          } else {
            setItems(data.items || []);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: string, kind?: 'post' | 'reel' | 'story' | 'trending') => {
    const deleteKind =
      kind ||
      (activeType === 'reels' ? 'reel' : activeType === 'stories' ? 'story' : activeType === 'hashtags' ? 'trending' : 'post');
    if (!confirm(`Permanently remove this ${deleteKind} from ZEV?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/content?type=${deleteKind}&id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        if (deleteKind === 'trending') {
          setTrendingTopics((prev) => prev.filter((t) => t.id !== id));
        } else {
          setItems((prev) => prev.filter((item) => item.id !== id));
        }
      }
    } catch (err) {
      console.error('Failed to delete content:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddTrendingTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) return;
    setSavingTopic(true);
    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_TRENDING_TOPIC',
          topic: topicInput.trim(),
          category: topicCategory.trim() || 'general',
          score: Number(topicScore) || 100,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTopicInput('');
        await fetchContent();
      }
    } finally {
      setSavingTopic(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl glass-panel">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Platform Content Moderation</h2>
            <p className="text-xs text-slate-400">
              Moderate discussion posts (carousels, drafts, schedules), video reels, 24h user stories, and trending hashtags
            </p>
          </div>
        </div>

        <button
          onClick={fetchContent}
          disabled={loading}
          className="glass-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Type Switcher & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800/80 rounded-2xl overflow-x-auto">
          <button
            onClick={() => setActiveType('posts')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
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
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeType === 'reels'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Video Reels</span>
          </button>
          <button
            onClick={() => setActiveType('stories')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeType === 'stories'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>User Stories</span>
          </button>
          <button
            onClick={() => setActiveType('hashtags')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeType === 'hashtags'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Hashtags & Trending</span>
          </button>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${activeType}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchContent()}
            className="w-full pl-9 pr-4 py-2 rounded-2xl glass-input text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Loading platform content...</span>
        </div>
      ) : activeType === 'hashtags' ? (
        /* TAB 4: HASHTAGS & TRENDING TOPICS */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Curated Trending Topics ({trendingTopics.length})</span>
              </h3>
            </div>

            <form onSubmit={handleAddTrendingTopic} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="#topic"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                className="sm:col-span-2 px-3 py-2 rounded-xl glass-input text-xs text-white focus:outline-none"
              />
              <input
                type="text"
                placeholder="Category"
                value={topicCategory}
                onChange={(e) => setTopicCategory(e.target.value)}
                className="px-3 py-2 rounded-xl glass-input text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingTopic}
                className="glass-btn-primary px-3 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{savingTopic ? '...' : 'Pin Topic'}</span>
              </button>
            </form>

            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Priority Score:</span>
              <input
                type="number"
                value={topicScore}
                onChange={(e) => setTopicScore(e.target.value)}
                className="w-20 px-2 py-1 rounded-lg glass-input text-xs text-white font-mono"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {trendingTopics.length === 0 ? (
                <div className="text-xs text-slate-500 py-8 text-center">No trending topics pinned yet.</div>
              ) : (
                trendingTopics.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>#{t.topic}</span>
                        <span className="px-2 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-800/50 text-[10px] font-mono">
                          {t.category}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Score {t.score} • {t.posts_count} posts • {t.reels_count} reels
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(t.id, 'trending')}
                      disabled={deletingId === t.id}
                      className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-6 rounded-3xl glass-panel space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Hash className="w-4 h-4 text-emerald-400" />
              <span>Platform Hashtag Index ({hashtags.length})</span>
            </h3>
            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Hashtag</th>
                    <th className="py-2.5 px-3">Posts</th>
                    <th className="py-2.5 px-3">Reels</th>
                    <th className="py-2.5 px-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {hashtags.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        No hashtags indexed yet.
                      </td>
                    </tr>
                  ) : (
                    hashtags.map((h) => (
                      <tr key={h.id} className="hover:bg-white/[0.03]">
                        <td className="py-2.5 px-3 font-bold text-cyan-300">#{h.tag}</td>
                        <td className="py-2.5 px-3 font-mono text-white">{h.posts_count}</td>
                        <td className="py-2.5 px-3 font-mono text-purple-300">{h.reels_count}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                          {new Date(h.updated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="p-16 text-center text-slate-400 text-sm bg-slate-950/40 rounded-3xl border border-slate-800">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
          <p className="font-semibold text-slate-200">No content items found</p>
        </div>
      ) : activeType === 'stories' ? (
        /* TAB 3: USER STORIES */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(items as PlatformStory[]).map((story) => {
            const authorName =
              [story.author_first_name, story.author_last_name].filter(Boolean).join(' ') ||
              story.author_username ||
              'User';
            const isExpired = new Date(story.expires_at).getTime() < renderedAtMs;
            return (
              <div
                key={story.id}
                className="p-4 rounded-3xl glass-card flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <button
                      onClick={() => onInspectUserById(story.user_id)}
                      className="flex items-center gap-2 text-left cursor-pointer hover:opacity-80"
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center font-bold text-white text-xs shrink-0">
                        {story.author_avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={story.author_avatar} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          authorName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white flex items-center gap-1 truncate">
                          <span className="truncate">{authorName}</span>
                          {story.author_is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        <div className="text-[10px] text-cyan-400 font-mono">@{story.author_username || 'user'}</div>
                      </div>
                    </button>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase font-bold border ${
                        isExpired
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'
                      }`}
                    >
                      {isExpired ? 'Expired' : 'Active 24h'}
                    </span>
                  </div>

                  <div className="relative rounded-2xl overflow-hidden aspect-[9/12] bg-black/70 border border-slate-800 mb-2">
                    {story.media_type === 'video' ? (
                      <video src={story.media_url} className="w-full h-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={story.media_url} alt="story media" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 text-[10px] font-mono text-cyan-300 uppercase">
                      {story.visibility} • {story.duration_seconds}s
                    </div>
                  </div>

                  {story.caption && <p className="text-xs text-slate-300 line-clamp-2">{story.caption}</p>}
                </div>

                <div className="pt-2.5 border-t border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-cyan-400" /> {story.views_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-400" /> {story.likes_count}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={story.media_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => handleDelete(story.id, 'story')}
                      disabled={deletingId === story.id}
                      className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TAB 1 & 2: POSTS & REELS */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((rawItem) => {
            const item = rawItem as PlatformPost | PlatformReel;
            const authorName =
              [item.author_first_name, item.author_last_name].filter(Boolean).join(' ') ||
              item.author_username ||
              'User';
            const isReel = activeType === 'reels';
            const reel = item as PlatformReel;
            const post = item as PlatformPost;
            const primaryImage = post.media_items?.[0]?.media_url || post.image_url;

            return (
              <div
                key={item.id}
                className="p-5 rounded-3xl glass-card flex flex-col justify-between space-y-4 group"
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
                          // eslint-disable-next-line @next/next/no-img-element
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
                        <div className="text-[10px] text-cyan-400 font-mono">@{item.author_username || 'user'}</div>
                      </div>
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Phase 9 Post Badges */}
                  {!isReel && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {post.is_draft && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-700/50 text-[9px] font-mono uppercase font-bold">
                          Draft
                        </span>
                      )}
                      {post.scheduled_at && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-950/70 text-indigo-300 border border-indigo-700/50 text-[9px] font-mono inline-flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Scheduled {new Date(post.scheduled_at).toLocaleDateString()}
                        </span>
                      )}
                      {post.visibility && post.visibility !== 'public' && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-mono uppercase">
                          {post.visibility}
                        </span>
                      )}
                      {(post.media_items?.length || 0) > 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-950/70 text-cyan-300 border border-cyan-700/50 text-[9px] font-mono inline-flex items-center gap-1">
                          <Images className="w-2.5 h-2.5" />
                          {post.media_items!.length} Carousel Items
                        </span>
                      )}
                      {post.location && (
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-300 border border-white/[0.08] text-[9px] inline-flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-rose-400" />
                          {post.location}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Title / Description */}
                  {item.title && <div className="font-bold text-white text-sm mb-1 line-clamp-1">{item.title}</div>}

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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={reel.thumbnail_url} alt="thumbnail" className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 font-mono text-[10px] text-white">
                        {reel.duration_seconds ? `${reel.duration_seconds}s` : 'Video'}
                      </div>
                    </div>
                  )}

                  {!isReel && primaryImage && (
                    <div className="mt-3 rounded-2xl overflow-hidden aspect-video bg-black/60 border border-slate-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={primaryImage} alt="post media" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Engagement Metrics & Remove Button */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    {(isReel || (post.views_count ?? 0) > 0) && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        {isReel ? reel.views_count || 0 : post.views_count || 0}
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
                    {!isReel && (post.reposts_count ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Repeat2 className="w-3.5 h-3.5 text-emerald-400" />
                        {post.reposts_count}
                      </span>
                    )}
                    {!isReel && (post.bookmarks_count ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                        {post.bookmarks_count}
                      </span>
                    )}
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
                      onClick={() => handleDelete(item.id, isReel ? 'reel' : 'post')}
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
