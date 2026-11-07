export interface UserVerificationDetail {
  id: string;
  user_id: string;
  badge_type: string;
  status: string;
  is_active: boolean;
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
  bio: string | null;
  created_at: string;
  last_seen: string | null;
  posts_count: number;
  reels_count: number;
  followers_count: number;
  following_count: number;
  stories_count: number;
  verification_info?: UserVerificationDetail | null;
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

export interface UserFullActivity {
  posts: UserPost[];
  reels: UserReel[];
  followers: UserFollowItem[];
  following: UserFollowItem[];
  stories: UserStory[];
  rawProfile: Record<string, unknown>;
}

export interface DashboardStats {
  totalUsers: number;
  verifiedUsers: number;
  unconfirmedUsers: number;
  bannedUsers: number;
  totalPosts: number;
  totalReels: number;
  onlineUsers: number;
}
