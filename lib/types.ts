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
  verification_info?: UserVerificationDetail | null;
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
