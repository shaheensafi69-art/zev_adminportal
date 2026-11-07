'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Check, Copy, Calendar, MapPin, 
  Film, MessageSquare, Mail, Phone, 
  Clock, Sparkles, Ban, Trash2, Edit3, Users, 
  Database, ExternalLink, Heart, MessageCircle, Play, Eye
} from 'lucide-react';
import { AdminUser, UserFullActivity } from '@/lib/types';
import { VerifiedBadge } from '../VerifiedBadge';

interface UserDetailModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenEdit: (user: AdminUser) => void;
  onOpenBlueTick: (user: AdminUser) => void;
  onOpenBan: (user: AdminUser) => void;
  onOpenDelete: (user: AdminUser) => void;
  onConfirmEmail: (userId: string) => Promise<void>;
}

export function UserDetailModal({
  user,
  isOpen,
  onClose,
  onOpenEdit,
  onOpenBlueTick,
  onOpenBan,
  onOpenDelete,
  onConfirmEmail,
}: UserDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'reels' | 'followers' | 'following' | 'stories' | 'raw'>('overview');
  const [activity, setActivity] = useState<UserFullActivity | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [copied, setCopied] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [confirmEmailLoading, setConfirmEmailLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setActiveTab('overview');
      setLoadingActivity(true);
      fetch(`/api/admin/users/activity?userId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setActivity(data.activity);
          }
        })
        .catch((err) => console.error('Failed to load user activity:', err))
        .finally(() => setLoadingActivity(false));
    } else {
      setActivity(null);
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const copyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyJson = () => {
    if (!activity?.rawProfile) return;
    navigator.clipboard.writeText(JSON.stringify(activity.rawProfile, null, 2));
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  };

  const handleConfirmEmail = async () => {
    setConfirmEmailLoading(true);
    try {
      await onConfirmEmail(user.id);
    } finally {
      setConfirmEmailLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'posts', label: `Posts (${activity?.posts?.length ?? user.posts_count ?? 0})`, icon: MessageSquare },
    { id: 'reels', label: `Reels (${activity?.reels?.length ?? user.reels_count ?? 0})`, icon: Film },
    { id: 'followers', label: `Followers (${activity?.followers?.length ?? user.followers_count ?? 0})`, icon: Users },
    { id: 'following', label: `Following (${activity?.following?.length ?? user.following_count ?? 0})`, icon: Users },
    { id: 'stories', label: `Stories (${activity?.stories?.length ?? user.stories_count ?? 0})`, icon: Play },
    { id: 'raw', label: 'Raw Database (0-100)', icon: Database },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-left">
        
        {/* Top Header with User summary and Close */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center font-bold text-white text-sm">
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                (user.first_name?.[0] || user.email[0]).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">
                  {user.first_name || ''} {user.last_name || 'ZEV User'}
                </span>
                {user.is_verified && <VerifiedBadge size="sm" />}
                {user.is_banned && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/60 font-bold">
                    Banned
                  </span>
                )}
              </div>
              <div className="text-xs text-cyan-400 font-mono">
                @{user.username || 'no_username'} • <span className="text-slate-400">{user.email}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-2 px-6 border-b border-slate-800/80 bg-slate-950/40 overflow-x-auto text-xs font-semibold">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Profile Card Header */}
              <div className="relative p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800/80">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="relative w-20 h-20 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center text-2xl font-bold text-slate-300 shadow-xl shrink-0">
                    {user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      (user.first_name?.[0] || user.email[0]).toUpperCase()
                    )}
                    {user.is_online && (
                      <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900" title="Online" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-black text-white">
                        {user.first_name || ''} {user.last_name || 'ZEV User'}
                      </h2>
                      {user.is_verified && <VerifiedBadge size="md" />}
                      {user.is_banned && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/60 font-bold">
                          Account Suspended
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-cyan-400 font-mono mt-0.5">
                      @{user.username || 'no_username'}
                    </div>

                    {user.bio && (
                      <p className="text-xs text-slate-300 mt-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 leading-relaxed">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* User ID Pill */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-mono">
                    <span className="text-slate-500">UUID:</span> {user.id}
                  </span>
                  <button
                    onClick={copyId}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy UUID'}</span>
                  </button>
                </div>
              </div>

              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => setActiveTab('posts')}
                  className="p-3.5 rounded-2xl bg-slate-950/60 hover:bg-slate-950/90 border border-slate-800/80 text-center transition-all cursor-pointer group"
                >
                  <div className="text-xs text-slate-400 group-hover:text-cyan-300 flex items-center justify-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                    Posts
                  </div>
                  <div className="text-2xl font-black text-white mt-1 font-mono">
                    {user.posts_count || 0}
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('reels')}
                  className="p-3.5 rounded-2xl bg-slate-950/60 hover:bg-slate-950/90 border border-slate-800/80 text-center transition-all cursor-pointer group"
                >
                  <div className="text-xs text-slate-400 group-hover:text-purple-300 flex items-center justify-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-purple-400" />
                    Reels
                  </div>
                  <div className="text-2xl font-black text-white mt-1 font-mono">
                    {user.reels_count || 0}
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('followers')}
                  className="p-3.5 rounded-2xl bg-slate-950/60 hover:bg-slate-950/90 border border-slate-800/80 text-center transition-all cursor-pointer group"
                >
                  <div className="text-xs text-slate-400 group-hover:text-sky-300 flex items-center justify-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    Followers
                  </div>
                  <div className="text-2xl font-black text-white mt-1 font-mono">
                    {user.followers_count || 0}
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('following')}
                  className="p-3.5 rounded-2xl bg-slate-950/60 hover:bg-slate-950/90 border border-slate-800/80 text-center transition-all cursor-pointer group"
                >
                  <div className="text-xs text-slate-400 group-hover:text-emerald-300 flex items-center justify-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    Following
                  </div>
                  <div className="text-2xl font-black text-white mt-1 font-mono">
                    {user.following_count || 0}
                  </div>
                </button>
              </div>

              {/* Detailed Contact and Account Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Contact info */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Contact & Authentication
                  </h4>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      Email:
                    </span>
                    <span className="font-mono text-slate-200">{user.email}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Email Status:</span>
                    {user.email_confirmed ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
                        <Check className="w-3 h-3" />
                        Confirmed
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-800/40">
                          Unconfirmed
                        </span>
                        <button
                          onClick={handleConfirmEmail}
                          disabled={confirmEmailLoading}
                          className="text-[11px] px-2 py-0.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all cursor-pointer"
                        >
                          {confirmEmailLoading ? '...' : 'Confirm'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      Phone:
                    </span>
                    <span className="font-mono text-slate-200">{user.phone_number || 'N/A'}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      Country:
                    </span>
                    <span className="text-slate-200 capitalize">{user.country || 'Unknown'}</span>
                  </div>
                </div>

                {/* Timestamps & Suspension */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Timestamps & Status
                  </h4>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Registered:
                    </span>
                    <span className="text-slate-300 font-mono text-[11px]">
                      {new Date(user.created_at).toLocaleString('en-US')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Last Active:
                    </span>
                    <span className="text-slate-300 font-mono text-[11px]">
                      {user.last_seen ? new Date(user.last_seen).toLocaleString('en-US') : 'N/A'}
                    </span>
                  </div>

                  {user.is_banned && (
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300">
                      <span className="font-bold">Banned Until:</span>{' '}
                      <span className="font-mono">
                        {user.banned_until ? new Date(user.banned_until).toLocaleString('en-US') : 'Permanent'}
                      </span>
                    </div>
                  )}
                </div>

              </div>

              {/* Blue Tick Details */}
              {user.verification_info && (
                <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Official Verification Dossier
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-slate-400">Badge Title:</span>{' '}
                      <span className="text-white font-medium">{user.verification_info.badge_label || 'Verified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Verified At:</span>{' '}
                      <span className="text-slate-200 font-mono text-[11px]">
                        {user.verification_info.verified_at ? new Date(user.verification_info.verified_at).toLocaleDateString('en-US') : '-'}
                      </span>
                    </div>
                    <div className="sm:col-span-3">
                      <span className="text-slate-400">Reason:</span>{' '}
                      <span className="text-slate-300">{user.verification_info.verification_reason || 'Official Accreditation'}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: POSTS */}
          {activeTab === 'posts' && (
            <div className="space-y-4">
              {loadingActivity ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <div className="inline-block w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <div>Loading user posts from database...</div>
                </div>
              ) : activity?.posts && activity.posts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activity.posts.map((post) => (
                    <div key={post.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                      <div>
                        {post.image_url && (
                          <div className="relative w-full h-44 rounded-xl overflow-hidden mb-3 border border-slate-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={post.image_url} alt="post" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <h4 className="font-bold text-white text-sm mb-1 line-clamp-1">{post.title || 'Untitled Post'}</h4>
                        <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed whitespace-pre-line">{post.content}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-rose-400 font-mono">
                            <Heart className="w-3.5 h-3.5" /> {post.likes_count}
                          </span>
                          <span className="flex items-center gap-1 text-sky-400 font-mono">
                            <MessageCircle className="w-3.5 h-3.5" /> {post.comments_count}
                          </span>
                        </div>
                        <span className="font-mono text-[11px]">{new Date(post.created_at).toLocaleDateString('en-US')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
                  No discussion posts published by this user.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REELS */}
          {activeTab === 'reels' && (
            <div className="space-y-4">
              {loadingActivity ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <div className="inline-block w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <div>Loading user reels from database...</div>
                </div>
              ) : activity?.reels && activity.reels.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {activity.reels.map((reel) => (
                    <div key={reel.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="relative w-full h-40 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden mb-3 flex items-center justify-center">
                          {reel.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={reel.thumbnail_url} alt="reel thumbnail" className="w-full h-full object-cover" />
                          ) : (
                            <Play className="w-8 h-8 text-cyan-400/80" />
                          )}
                          {reel.duration_seconds && (
                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 text-[10px] font-mono text-white">
                              {reel.duration_seconds}s
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-sm mb-1 line-clamp-1">{reel.title || 'Untitled Reel'}</h4>
                        {reel.description && (
                          <p className="text-xs text-slate-400 line-clamp-2">{reel.description}</p>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                          <span>{reel.views_count} views</span>
                          <span>•</span>
                          <span>{reel.likes_count} likes</span>
                        </div>
                        <a
                          href={reel.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
                        >
                          <span>Video</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
                  No video reels uploaded by this user.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FOLLOWERS */}
          {activeTab === 'followers' && (
            <div className="space-y-4">
              {loadingActivity ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <div className="inline-block w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <div>Loading followers...</div>
                </div>
              ) : activity?.followers && activity.followers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activity.followers.map((item) => (
                    <div key={item.id} className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-white text-xs overflow-hidden shrink-0">
                        {item.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          (item.first_name?.[0] || item.email?.[0] || 'U').toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-xs font-bold text-white truncate">
                          <span className="truncate">{item.first_name || ''} {item.last_name || 'ZEV User'}</span>
                          {item.is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        <div className="text-[11px] text-cyan-400 font-mono truncate">@{item.username || 'user'}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{new Date(item.created_at).toLocaleDateString('en-US')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
                  This user currently has 0 followers.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: FOLLOWING */}
          {activeTab === 'following' && (
            <div className="space-y-4">
              {loadingActivity ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <div className="inline-block w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <div>Loading following accounts...</div>
                </div>
              ) : activity?.following && activity.following.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activity.following.map((item) => (
                    <div key={item.id} className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-white text-xs overflow-hidden shrink-0">
                        {item.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          (item.first_name?.[0] || item.email?.[0] || 'U').toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-xs font-bold text-white truncate">
                          <span className="truncate">{item.first_name || ''} {item.last_name || 'ZEV User'}</span>
                          {item.is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        <div className="text-[11px] text-cyan-400 font-mono truncate">@{item.username || 'user'}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{new Date(item.created_at).toLocaleDateString('en-US')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
                  This user is not following any accounts yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 6: STORIES */}
          {activeTab === 'stories' && (
            <div className="space-y-4">
              {loadingActivity ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <div className="inline-block w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <div>Loading user stories...</div>
                </div>
              ) : activity?.stories && activity.stories.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activity.stories.map((story) => (
                    <div key={story.id} className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                      <div className="text-xs font-mono text-cyan-400 mb-2 flex items-center justify-between">
                        <span className="capitalize">{story.media_type} Story</span>
                        <span>{story.duration_seconds}s</span>
                      </div>
                      {story.caption && (
                        <p className="text-xs text-slate-300 mb-2">{story.caption}</p>
                      )}
                      <div className="pt-2 border-t border-slate-800 text-[11px] flex items-center justify-between text-slate-400">
                        <span>Created: {new Date(story.created_at).toLocaleDateString('en-US')}</span>
                        <a
                          href={story.media_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
                  No active or past stories found for this user.
                </div>
              )}
            </div>
          )}

          {/* TAB 7: RAW DATABASE RECORD (0 TO 100) */}
          {activeTab === 'raw' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  Complete PostgreSQL Database Record (0 to 100)
                </span>
                <button
                  onClick={copyJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                >
                  {jsonCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{jsonCopied ? 'Copied JSON' : 'Copy Full JSON'}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-black/90 border border-slate-800 overflow-x-auto font-mono text-xs text-emerald-400">
                <pre>{JSON.stringify(activity?.rawProfile || user, null, 2)}</pre>
              </div>
            </div>
          )}

        </div>

        {/* Action Toolbar at Bottom */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            
            {/* Toggle Blue Tick Button */}
            <button
              onClick={() => {
                onClose();
                onOpenBlueTick(user);
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${
                user.is_verified
                  ? 'bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-900/50'
                  : 'bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white shadow-cyan-950'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{user.is_verified ? 'Revoke Blue Badge' : 'Grant Blue Badge'}</span>
            </button>

            {/* Edit User Button */}
            <button
              onClick={() => {
                onClose();
                onOpenEdit(user);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Edit Profile</span>
            </button>

            {/* Ban / Unban Button */}
            <button
              onClick={() => {
                onClose();
                onOpenBan(user);
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                user.is_banned
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{user.is_banned ? 'Lift Ban (Unban)' : 'Ban User'}</span>
            </button>

          </div>

          <div className="flex items-center gap-2">
            {/* Delete User Button */}
            <button
              onClick={() => {
                onClose();
                onOpenDelete(user);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-white bg-slate-900 hover:bg-rose-600 border border-rose-900/40 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete User</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
