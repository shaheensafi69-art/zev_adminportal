'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, MessageSquare, HelpCircle, Shield, Pin, CheckCircle2, 
  Trash2, Search, Filter, RefreshCw, ExternalLink, Globe, Lock,
  FileText, Film, Eye, Tag, AlertCircle, Plus, ChevronRight, X
} from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface CommunitiesViewProps {
  onInspectUserById?: (userId: string) => void;
}

export function CommunitiesView({ onInspectUserById }: CommunitiesViewProps) {
  const [activeTab, setActiveTab] = useState<'communities' | 'posts' | 'comments' | 'members'>('communities');
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<any>({
    totalCommunities: 0,
    totalMembers: 0,
    totalPosts: 0,
    solvedQuestions: 0,
    totalQuestions: 0,
    totalComments: 0,
    privateCommunities: 0,
  });

  const [communities, setCommunities] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPostType, setSelectedPostType] = useState('all');
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals & Details
  const [inspectCommunity, setInspectCommunity] = useState<any | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        tab: activeTab,
        q: searchQuery.trim(),
        category: selectedCategory,
        post_type: selectedPostType,
        community_id: selectedCommunityId,
      });

      const res = await fetch(`/api/admin/communities?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        if (data.kpis) setKpis(data.kpis);
        if (activeTab === 'communities') setCommunities(data.communities || []);
        if (activeTab === 'posts') setPosts(data.posts || []);
        if (activeTab === 'comments') setComments(data.comments || []);
        if (activeTab === 'members') setMembers(data.members || []);
      }
    } catch (err: any) {
      console.error('Failed to load communities data:', err);
      showToast('Error loading communities data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, searchQuery, selectedCategory, selectedPostType, selectedCommunityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Post Action
  const handlePostAction = async (action: string, payload: any) => {
    setActionInProgress(payload.id);
    try {
      const res = await fetch('/api/admin/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Action executed successfully', 'success');
        fetchData();
      } else {
        showToast(data.error || 'Failed to perform action', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionInProgress(null);
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

      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Communities & Groups Hub
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                  Facebook Groups & Reddit Q&A
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage all social groups, forums, question-solving threads, and moderate community member content.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 text-xs font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-800/40">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Communities</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-black text-white">{kpis.totalCommunities || 0}</div>
            <div className="text-[10px] text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-800/40">
              {kpis.privateCommunities || 0} Private
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Active interest forums</p>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-800/40">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Community Members</span>
            <Globe className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-black text-white">{kpis.totalMembers || 0}</div>
            <div className="text-[10px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-800/40">
              Active Users
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Total group memberships</p>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 border border-purple-800/40">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Community Posts</span>
            <FileText className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-black text-white">{kpis.totalPosts || 0}</div>
            <div className="text-[10px] text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-800/40">
              {kpis.totalComments || 0} Comments
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Feed posts, reels & questions</p>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-800/40">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Solved Q&A Questions</span>
            <HelpCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-black text-white">{kpis.solvedQuestions || 0}</div>
            <div className="text-[10px] text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
              {kpis.totalQuestions ? `${Math.round(((kpis.solvedQuestions || 0) / kpis.totalQuestions) * 100)}% Solved` : '0%'}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Community peer solutions</p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
          <button
            onClick={() => setActiveTab('communities')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'communities'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Communities Directory ({communities.length})
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'posts'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Posts Moderation ({posts.length})
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'comments'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Comments & Solutions
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'members'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Community Members
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search community or post..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 md:w-60"
            />
          </div>

          {activeTab === 'communities' && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Categories</option>
              <option value="education">Education</option>
              <option value="programming">Programming</option>
              <option value="trading">Trading</option>
              <option value="technology">Technology</option>
              <option value="design">Design</option>
              <option value="business">Business</option>
              <option value="general">General</option>
            </select>
          )}

          {activeTab === 'posts' && (
            <select
              value={selectedPostType}
              onChange={(e) => setSelectedPostType(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Types</option>
              <option value="post">Standard Posts</option>
              <option value="reel">Community Reels</option>
              <option value="question">Q&A Questions</option>
            </select>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'communities' && (
        <div className="space-y-4">
          {communities.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium">No communities found matching query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {communities.map((comm) => (
                <div
                  key={comm.id}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Cover or Gradient Banner */}
                    <div className="h-24 bg-gradient-to-r from-indigo-900/50 via-purple-900/50 to-slate-900 relative">
                      {comm.cover_url && (
                        <img 
                          src={comm.cover_url} 
                          alt={comm.name} 
                          className="w-full h-full object-cover opacity-60"
                        />
                      )}
                      <div className="absolute top-2.5 right-2.5 flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          comm.is_private 
                            ? 'bg-amber-950/80 border-amber-800 text-amber-300' 
                            : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                        }`}>
                          {comm.is_private ? <Lock className="w-2.5 h-2.5 inline mr-1" /> : <Globe className="w-2.5 h-2.5 inline mr-1" />}
                          {comm.is_private ? 'Private' : 'Public'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-900/80 border border-slate-700 text-slate-300 uppercase">
                          {comm.category}
                        </span>
                      </div>
                    </div>

                    {/* Community Header & Avatar */}
                    <div className="px-4 pt-0 pb-3 relative">
                      <div className="-mt-7 mb-2 flex items-end justify-between">
                        <div className="w-14 h-14 rounded-2xl border-2 border-slate-900 bg-slate-800 overflow-hidden shadow-lg flex items-center justify-center">
                          {comm.avatar_url ? (
                            <img src={comm.avatar_url} alt={comm.name} className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-6 h-6 text-indigo-400" />
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-white">{comm.members_count || 1} members</div>
                          <div className="text-[10px] text-slate-400">{comm.posts_count || 0} posts</div>
                        </div>
                      </div>

                      <h3 className="font-bold text-white text-base leading-tight">{comm.name}</h3>
                      <p className="text-xs text-indigo-400 font-mono mt-0.5">/{comm.slug}</p>
                      
                      <p className="text-xs text-slate-300 mt-2 line-clamp-2">
                        {comm.description || 'No description provided.'}
                      </p>

                      {/* Creator info */}
                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span>Created by:</span>
                        <button
                          onClick={() => comm.creator_id && onInspectUserById?.(comm.creator_id)}
                          className="flex items-center space-x-1.5 text-slate-200 hover:text-cyan-400 font-medium"
                        >
                          {comm.creator_avatar_url ? (
                            <img src={comm.creator_avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                          ) : null}
                          <span>@{comm.creator_username || 'creator'}</span>
                          {comm.creator_is_verified && <VerifiedBadge size="sm" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-3 bg-slate-950/60 border-t border-slate-800/60 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedCommunityId(comm.id);
                        setActiveTab('posts');
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium text-center transition-colors"
                    >
                      View Posts ({comm.posts_count || 0})
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCommunityId(comm.id);
                        setActiveTab('members');
                      }}
                      className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                    >
                      Members
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete community "${comm.name}"? This will delete all posts, comments, and member ties.`)) {
                          handlePostAction('delete_community', { id: comm.id });
                        }
                      }}
                      disabled={actionInProgress === comm.id}
                      className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 transition-colors"
                      title="Delete Community"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Posts Moderation Tab */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
              <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium">No community posts found matching filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start justify-between gap-4"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        post.post_type === 'question'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : post.post_type === 'reel'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                      }`}>
                        {post.post_type === 'question' && <HelpCircle className="w-3 h-3 inline mr-1" />}
                        {post.post_type === 'reel' && <Film className="w-3 h-3 inline mr-1" />}
                        {post.post_type === 'post' && <FileText className="w-3 h-3 inline mr-1" />}
                        {post.post_type}
                      </span>

                      {post.is_pinned && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                          <Pin className="w-2.5 h-2.5" /> Pinned
                        </span>
                      )}

                      {post.post_type === 'question' && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                          post.is_solved 
                            ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' 
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}>
                          {post.is_solved ? '✓ Solved' : 'Open Question'}
                        </span>
                      )}

                      <span className="text-xs text-indigo-400 font-medium">
                        in {post.community_name || 'Community'}
                      </span>
                    </div>

                    {post.title && (
                      <h4 className="text-sm font-bold text-white">{post.title}</h4>
                    )}

                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </p>

                    {/* Media attachments */}
                    {post.media_urls && post.media_urls.length > 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        {post.media_urls.map((url: string, idx: number) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-12 h-12 rounded-lg bg-slate-800 overflow-hidden border border-slate-700 hover:opacity-80 transition-opacity"
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Author & Stats bar */}
                    <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-400">
                      <button
                        onClick={() => post.user_id && onInspectUserById?.(post.user_id)}
                        className="flex items-center space-x-1.5 text-slate-300 hover:text-cyan-400"
                      >
                        {post.author_avatar_url ? (
                          <img src={post.author_avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                        ) : null}
                        <span>@{post.author_username || 'author'}</span>
                        {post.author_is_verified && <VerifiedBadge size="sm" />}
                      </button>

                      <span>•</span>
                      <span>{post.upvotes_count || 0} Upvotes</span>
                      <span>•</span>
                      <span>{post.comments_count || 0} Comments</span>
                      <span>•</span>
                      <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex md:flex-col items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => handlePostAction('toggle_pin_post', { id: post.id, is_pinned: !post.is_pinned })}
                      className={`p-2 rounded-xl border text-xs font-medium transition-colors ${
                        post.is_pinned
                          ? 'bg-amber-950/60 border-amber-700 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                      title={post.is_pinned ? 'Unpin Post' : 'Pin Post'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>

                    {post.post_type === 'question' && (
                      <button
                        onClick={() => handlePostAction('toggle_solve_question', { id: post.id, is_solved: !post.is_solved })}
                        className={`p-2 rounded-xl border text-xs font-medium transition-colors ${
                          post.is_solved
                            ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                        title={post.is_solved ? 'Reopen Question' : 'Mark as Solved'}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (confirm('Delete this community post permanently?')) {
                          handlePostAction('delete_post', { id: post.id });
                        }
                      }}
                      className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors"
                      title="Delete Post"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
              <MessageSquare className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium">No community comments found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => comment.user_id && onInspectUserById?.(comment.user_id)}
                        className="text-xs font-semibold text-white hover:text-cyan-400 flex items-center space-x-1"
                      >
                        <span>@{comment.author_username || 'commenter'}</span>
                        {comment.author_is_verified && <VerifiedBadge size="sm" />}
                      </button>

                      {comment.is_best_answer && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 border border-emerald-800 text-emerald-300">
                          ★ Best Answer
                        </span>
                      )}

                      <span className="text-[11px] text-slate-500">
                        on {comment.post_title || 'Post'} ({comment.community_name})
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {comment.content}
                    </p>

                    <div className="flex items-center space-x-3 text-[11px] text-slate-400 pt-1">
                      <span>{comment.upvotes_count || 0} Upvotes</span>
                      <span>•</span>
                      <span>{new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (confirm('Delete this comment permanently?')) {
                        handlePostAction('delete_comment', { id: comment.id });
                      }
                    }}
                    className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors"
                    title="Delete Comment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {members.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium">No community members found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Community</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Joined Date</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5">
                        <button
                          onClick={() => member.user_id && onInspectUserById?.(member.user_id)}
                          className="flex items-center space-x-2 text-left hover:text-cyan-400"
                        >
                          <div className="w-7 h-7 rounded-full bg-slate-800 overflow-hidden">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center space-x-1">
                              <span>@{member.username}</span>
                              {member.is_verified && <VerifiedBadge size="sm" />}
                            </div>
                            <div className="text-[10px] text-slate-400">{member.first_name} {member.last_name}</div>
                          </div>
                        </button>
                      </td>
                      <td className="p-3.5 font-medium text-indigo-300">
                        {member.community_name || 'Community'}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          member.role === 'admin'
                            ? 'bg-rose-950 border border-rose-800 text-rose-300'
                            : member.role === 'moderator'
                            ? 'bg-amber-950 border border-amber-800 text-amber-300'
                            : 'bg-slate-800 border border-slate-700 text-slate-300'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {new Date(member.joined_at).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {member.role !== 'admin' && (
                            <button
                              onClick={() => handlePostAction('update_member_role', { 
                                id: member.id, 
                                role: member.role === 'moderator' ? 'member' : 'moderator' 
                              })}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium"
                            >
                              {member.role === 'moderator' ? 'Demote to Member' : 'Promote to Mod'}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Remove @${member.username} from this community?`)) {
                                handlePostAction('remove_member', { id: member.id });
                              }
                            }}
                            className="p-1 rounded-lg bg-rose-950/50 hover:bg-rose-900 border border-rose-800/60 text-rose-300"
                            title="Remove Member"
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
      )}
    </div>
  );
}
