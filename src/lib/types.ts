export interface UserVerificationDetail {
  id: string;
  user_id: string;
  badge_type: string;
  status: string;
  is_active: boolean;
  plan_type?: 'monthly' | 'yearly' | 'lifetime' | 'lifetime_referral' | 'custom' | string | null;
  verification_reason?: string | null;
  badge_label?: string | null;
  verified_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  email_confirmed: boolean;
  email_confirmed_at: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  phone_number: string | null;
  country: string | null;
  avatar_url: string | null;
  is_verified: boolean; // Blue badge
  is_online: boolean;
  is_banned: boolean;
  banned_until: string | null;
  is_restricted: boolean; // Policy restriction
  restricted_until: string | null;
  restriction_reason: string | null;
  warning_count: number;
  last_warning_at: string | null;
  last_warning_reason: string | null;
  bio: string | null;
  created_at: string;
  last_seen: string | null;
  posts_count: number;
  reels_count: number;
  followers_count: number;
  following_count: number;
  stories_count: number;
  referral_code?: string | null;
  referred_by?: string | null;
  referral_count?: number;
  lifetime_blue_eligible?: boolean;
  verification_info?: UserVerificationDetail | null;
}

export interface VerificationKPIs {
  totalVerified: number;
  monthlyCount: number;
  yearlyCount: number;
  lifetimeCount: number;
  referralLegendsCount: number;
  expiredCount: number;
  totalReferrals: number;
}

export interface VerificationRecord {
  id: string;
  user_id: string;
  badge_type: string;
  status: string;
  is_active: boolean;
  plan_type: 'monthly' | 'yearly' | 'lifetime' | 'lifetime_referral' | 'custom' | string;
  badge_label: string;
  verification_reason: string;
  verified_at: string;
  expires_at: string | null;
  days_remaining: number | null;
  is_expired: boolean;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  referral_count: number;
  lifetime_blue_eligible: boolean;
}

export interface ReferralLeader {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string;
  email: string;
  avatar_url: string | null;
  referral_code: string;
  referral_count: number;
  progress_percentage: number;
  is_eligible_for_lifetime: boolean;
  is_currently_verified: boolean;
  badge_plan: string | null;
}

export interface UserRestrictionRecord {
  id: string;
  user_id: string;
  type: string;
  warning_level: number;
  reason: string;
  details?: string | null;
  duration_hours?: number | null;
  expires_at?: string | null;
  status: 'active' | 'lifted' | 'expired';
  created_by: string;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
  current_warning_count?: number;
  is_restricted?: boolean;
  restricted_until?: string | null;
  user?: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    email: string | null;
    avatar_url: string | null;
    is_verified?: boolean;
  };
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_user_id?: string | null;
  target_resource_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
  target_user?: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    email: string | null;
  };
}

export interface PlatformPost {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  image_url: string | null;
  post_type?: string | null;
  visibility?: string | null;
  location?: string | null;
  is_draft?: boolean;
  scheduled_at?: string | null;
  published_at?: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  bookmarks_count?: number;
  views_count?: number;
  collaborator_ids?: string[] | null;
  tagged_user_ids?: string[] | null;
  media_items?: Array<{
    id: string;
    media_type: string;
    media_url: string;
    thumbnail_url?: string | null;
    sort_order: number;
  }>;
  author_first_name: string | null;
  author_last_name: string | null;
  author_username: string | null;
  author_avatar: string | null;
  author_is_verified: boolean;
}

export interface PlatformStory {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  duration_seconds: number;
  visibility: string;
  views_count: number;
  likes_count: number;
  replies_count: number;
  expires_at: string;
  created_at: string;
  author_first_name: string | null;
  author_last_name: string | null;
  author_username: string | null;
  author_avatar: string | null;
  author_is_verified: boolean;
}

export interface PlatformHashtag {
  id: string;
  tag: string;
  posts_count: number;
  reels_count: number;
  created_at: string;
  updated_at: string;
}

export interface TrendingTopicItem {
  id: string;
  topic: string;
  category: string;
  score: number;
  posts_count: number;
  reels_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformReel {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  duration_seconds: number | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  is_published: boolean;
  created_at: string;
  author_first_name: string | null;
  author_last_name: string | null;
  author_username: string | null;
  author_avatar: string | null;
  author_is_verified: boolean;
}

export interface DatabaseTableMeta {
  table_name: string;
  row_count: number;
  columns_count: number;
  size_estimate: string;
}

export interface UserPost {
  id: string;
  title: string | null;
  content: string | null;
  image_url: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
}

export interface UserReel {
  id: string;
  title: string | null;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  duration_seconds: number | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  is_published: boolean;
  created_at: string;
}

export interface UserFollowItem {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface UserStory {
  id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  duration_seconds: number;
  expires_at: string;
  created_at: string;
}

export interface UserDeviceRecord {
  id: string;
  user_id: string;
  device_id: string;
  fcm_token: string | null;
  platform: string;
  device_name: string | null;
  app_version: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  token_updated_at: string | null;
  created_at: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
}

export interface UserSessionRecord {
  id: string;
  user_id: string;
  device_id: string | null;
  platform: string | null;
  device_name: string | null;
  app_version: string | null;
  ip_address: string | null;
  user_agent: string | null;
  is_active: boolean;
  started_at: string;
  last_active_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export interface UserSecurityLogRecord {
  id: string;
  user_id: string;
  event_type: string;
  status: string;
  ip_address: string | null;
  device_id: string | null;
  platform: string | null;
  user_agent: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface AccountDeletionRecord {
  id: string;
  user_id: string;
  reason: string | null;
  action_type: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  created_at: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface UserFullActivity {
  posts: UserPost[];
  reels: UserReel[];
  followers: UserFollowItem[];
  following: UserFollowItem[];
  stories: UserStory[];
  devices?: UserDeviceRecord[];
  sessions?: UserSessionRecord[];
  securityLogs?: UserSecurityLogRecord[];
  notificationPreferences?: Record<string, unknown> | null;
  privacySettings?: Record<string, unknown> | null;
  links?: Array<{ id: string; title: string; url: string; sort_order: number }>;
  deletions?: AccountDeletionRecord[];
  blocksCount?: number;
  mutesCount?: number;
  highlightsCount?: number;
  rawProfile: Record<string, unknown>;
}

export interface DashboardStats {
  totalUsers: number;
  verifiedUsers: number;
  restrictedUsers: number;
  unconfirmedUsers: number;
  bannedUsers: number;
  totalPosts: number;
  totalReels: number;
  onlineUsers: number;
  pendingReports: number;
  activeWarnings: number;
  pendingAppeals?: number;
  pendingPostReports?: number;
  activeDevices?: number;
  activeLiveStreams?: number;
  pendingCampaigns?: number;
  pendingAdvertisers?: number;
  pendingSupportTickets?: number;
  pendingDeletions?: number;
  activeSessions?: number;
  totalStories?: number;
  queuedMediaDeletions?: number;
  pushSentTotal?: number;
  pushFailedTotal?: number;
  totalConversations?: number;
  trendingHashtagsCount?: number;
  dbMode?: string;
}

export interface PostReportItem {
  id: string;
  reporter_id: string;
  target_type: 'post' | 'reel' | 'comment' | 'story' | 'message' | string;
  target_id: string;
  reported_user_id: string | null;
  reason: string;
  details: string | null;
  status: 'pending' | 'resolved' | 'dismissed' | string;
  created_at: string;
  updated_at?: string | null;
  reporter_first_name?: string | null;
  reporter_last_name?: string | null;
  reporter_username?: string | null;
  reporter_avatar?: string | null;
  reported_first_name?: string | null;
  reported_last_name?: string | null;
  reported_username?: string | null;
  reported_email?: string | null;
  reported_avatar?: string | null;
  reported_is_verified?: boolean;
  target_preview?: string | null;
  target_media_url?: string | null;
}

export interface PushDeliveryRecord {
  id: string;
  user_id: string;
  notification_type: string;
  status: string;
  tokens_targeted: number;
  sent_count: number;
  failed_count: number;
  error_message: string | null;
  created_at: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface AdminLiveStream {
  id: string;
  host_id: string;
  title: string;
  category: string | null;
  thumbnail_url: string | null;
  status: 'live' | 'ended' | string;
  viewer_count: number;
  peak_viewer_count: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  host_username?: string | null;
  host_first_name?: string | null;
  host_last_name?: string | null;
  host_avatar?: string | null;
  host_is_verified?: boolean;
  comments_count?: number;
  reactions_count?: number;
}

export interface MediaDeletionQueueItem {
  id: string;
  user_id: string | null;
  r2_key: string;
  media_url: string | null;
  reason: string;
  status: 'pending' | 'completed' | 'failed' | string;
  attempts: number;
  last_error: string | null;
  next_retry_at: string;
  created_at: string;
  updated_at: string;
}

export interface SchemaMigrationRecord {
  version: string;
  name: string;
  checksum?: string | null;
  applied_at: string;
}

export interface AppealRecord {
  id: string;
  user_id: string;
  restriction_id?: string | null;
  reason: string;
  explanation: string;
  evidence_urls: string[];
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | string;
  admin_response?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
  is_banned?: boolean;
  banned_until?: string | null;
  ban_reason?: string | null;
  is_restricted?: boolean;
  restricted_until?: string | null;
  restriction_reason?: string | null;
  account_status?: string | null;
  warning_count?: number;
  restriction_type?: string | null;
  restriction_warning_level?: number | null;
  linked_restriction_reason?: string | null;
  linked_restriction_details?: string | null;
  linked_restriction_expires_at?: string | null;
  linked_restriction_status?: string | null;
}

export interface AdminAdsKPIs {
  totalAdvertisers: number;
  pendingAdvertisers: number;
  activeCampaigns: number;
  pendingCampaigns: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalAdRevenue: number;
  ctrPercent: number;
  fraudFlaggedEvents: number;
}

export interface AdminAdvertiser {
  id: string;
  user_id: string;
  business_name: string;
  website_url?: string | null;
  contact_email?: string | null;
  status: 'pending' | 'approved' | 'suspended' | string;
  balance: number;
  currency: string;
  created_at: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
  campaigns_count?: number;
  total_spent?: number;
}

export interface AdminAdCampaign {
  id: string;
  advertiser_id: string;
  source_post_id?: string | null;
  owner_user_id?: string | null;
  business_name?: string | null;
  advertiser_status?: string | null;
  advertiser_balance?: number;
  owner_username?: string | null;
  name: string;
  objective: string;
  placement: string;
  pricing_model: string;
  bid_amount: number;
  daily_budget: number;
  total_budget: number;
  spent_amount: number;
  spent_today?: number;
  daily_frequency_cap?: number;
  min_cooldown_seconds?: number;
  impressions_count: number;
  clicks_count: number;
  conversions_count: number;
  status: string;
  rejection_reason?: string | null;
  approved_at?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  creative_id?: string | null;
  creative_title?: string | null;
  creative_body?: string | null;
  creative_media_url?: string | null;
  creative_media_type?: string | null;
  creative_cta_label?: string | null;
  creative_destination_url?: string | null;
  creative_status?: string | null;
  target_countries?: string[] | null;
  target_languages?: string[] | null;
  target_interests?: string[] | null;
  target_min_age?: number | null;
  target_max_age?: number | null;
  target_gender?: string | null;
}

export interface AdminAdInvoice {
  id: string;
  advertiser_id: string;
  campaign_id?: string | null;
  owner_user_id?: string | null;
  business_name?: string | null;
  campaign_name?: string | null;
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'draft' | 'issued' | 'paid' | 'void' | string;
  created_at: string;
}
