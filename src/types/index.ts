// =============================================================================
// Task 2.1 — Core user and auth types
// =============================================================================

export type UserRole = 'creator' | 'brand';

export type VerificationStatus = 'unverified' | 'pending' | 'verified';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  passwordHash: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
  emailVerified: boolean;
  createdAt: string;           // ISO 8601
  failedLoginAttempts: number;
  lockedUntil: string | null;  // ISO 8601 or null
}

// =============================================================================
// Task 2.2 — Creator and portfolio types
// =============================================================================

export type ContentCategory =
  | 'beauty'
  | 'fitness'
  | 'tech'
  | 'food'
  | 'travel'
  | 'gaming'
  | 'lifestyle'
  | 'finance'
  | 'education'
  | 'fashion';

export interface SocialAccount {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin';
  handle: string;
  followerCount: number;
  connected: boolean;
}

export interface PortfolioMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;  // computed: (likes + comments + shares) / views
}

export interface PortfolioItem {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  category: ContentCategory;
  mediaUrl: string;
  fileSizeBytes: number;
  campaignId: string | null;  // linked campaign if from collaboration
  metrics: PortfolioMetrics;
  createdAt: string;          // ISO 8601
}

export interface AudienceDemographics {
  ageGroups: Record<string, number>;  // e.g. { '18-24': 0.45, '25-34': 0.35 }
  topCountries: string[];
  genderSplit: { male: number; female: number; other: number };
}

export interface CreatorInsights {
  audienceDemographics: AudienceDemographics;
  primaryCategories: ContentCategory[];
  averageEngagementRate: number;
  collaborationCount: number;
  successRate: number;  // completed collaborations / total applications
}

export interface CollaborationRecord {
  campaignId: string;
  brandId: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  startDate: string | null;
  endDate: string | null;
}

export interface Creator {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  contentCategories: ContentCategory[];
  socialAccounts: SocialAccount[];
  trustScore: number;                // 0–100
  trustScorePartialData: boolean;
  portfolio: PortfolioItem[];
  collaborationHistory: CollaborationRecord[];
  insights: CreatorInsights;
  verificationStatus: VerificationStatus;
  location?: string;
  platforms?: string[];
  contentStyle?: string[];
  targetAudience?: string[];
  collabTypes?: string[];
  uniqueValue?: string;
  onboardingCompleted?: boolean;
  onboardingStep?: number;
}

// =============================================================================
// Task 2.3 — Brand and campaign types
// =============================================================================

export interface Brand {
  id: string;
  userId: string;
  companyName: string;
  logoUrl: string;
  industry: string;
  description: string;
  brandScore: number;                // 0–100
  brandScorePartialData: boolean;
  isNewToPlatform: boolean;          // fewer than 3 completed collaborations
  completedCollaborations: number;
  averageCreatorRating: number;
  averageResponseTimeHours: number;
  campaigns: string[];               // Campaign IDs
  verificationStatus: VerificationStatus;
}

export type CompensationType = 'paid' | 'gifted' | 'commission' | 'revenue_share';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'removed';

export interface Campaign {
  id: string;
  brandId: string;
  title: string;
  description: string;
  requirements: string;
  contentCategories: ContentCategory[];
  compensationType: CompensationType;
  compensationAmount: number | null;
  deadline: string;                  // ISO 8601
  status: CampaignStatus;
  publishedAt: string | null;
  applicantCount: number;
}

// =============================================================================
// Task 2.4 — Application, feed, notification, and score types
// =============================================================================

export type ApplicationStatus = 'pending' | 'shortlisted' | 'accepted' | 'rejected' | 'approved' | 'declined' | 'waitlisted';

export interface Application {
  id: string;
  campaignId: string;
  creatorId: string;
  aiPitch: string;
  editedPitch: string;               // creator may override AI pitch
  selectedPortfolioItems: string[];  // PortfolioItem IDs (up to 3)
  status: ApplicationStatus;
  collaborationMatchScore: number;
  submittedAt: string;               // ISO 8601
  reviewedAt: string | null;
}

export type PostType =
  | 'campaign'
  | 'portfolio_update'
  | 'campaign_result'
  | 'case_study'
  | 'creative_concept'
  | 'content_showcase';

export interface FeedPost {
  id: string;
  type: PostType;
  authorId: string;                  // creatorId or brandId
  authorRole: UserRole;
  campaignId: string | null;         // set when type === 'campaign'
  title: string;
  body: string;
  category: ContentCategory;
  collaborationMatchScore: number | null;
  aiRecommendationTag: string | null;
  publishedAt: string;               // ISO 8601
  removed: boolean;
  imageFilename?: string;            // optional: filename under src/assets (e.g. 'image1.png')
}

export interface FeedFilters {
  category: ContentCategory | null;
  compensationType: CompensationType | null;
  deadlineBefore: string | null;
}

export type NotificationType =
  | 'trust_score_change'
  | 'application_approved'
  | 'application_declined'
  | 'application_received'
  | 'brand_score_change'
  | 'verification_update'
  | 'post_removed'
  | 'account_locked';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;  // ISO 8601
}

export interface ScoreAuditLog {
  id: string;
  subjectId: string;           // creatorId or brandId
  subjectType: 'creator' | 'brand';
  timestamp: string;           // ISO 8601
  inputs: Record<string, number>;
  weights: Record<string, number>;
  resultingScore: number;
}

export interface CreatorScoreInputs {
  audienceAuthenticity: number;              // 0–1
  commentQualityScore: number;               // 0–1
  followerGrowthPattern: number;             // 0–1 (consistent = 1, spike/drop = 0)
  engagementConsistency: number;             // 0–1
  brandCollaborationSuccessRate: number;     // 0–1
}

export interface BrandScoreInputs {
  paymentReliability: number;                // 0–1
  creatorReviewScore: number;                // 0–1 (normalised average)
  campaignSuccessRate: number;               // 0–1
  communicationQualityScore: number;         // 0–1
  averageResponseSpeed: number;              // 0–1 (faster = closer to 1)
}

export interface MatchScoreInputs {
  creatorCategories: ContentCategory[];
  campaignCategories: ContentCategory[];
  creatorTrustScore: number;                 // 0–100
  campaignMinTrustScore: number;             // 0–100 (brand's stated requirement)
  audienceAgeGroups: Record<string, number>;
  campaignTargetAgeGroups: string[];
  creatorContentQuality?: number;
  campaignMinContentQuality?: number;
}

export interface PortfolioTemplateSection {
  heading: string;
  placeholder: string;
  required: boolean;
}

export interface PortfolioTemplate {
  id: string;
  variantIndex: number;                      // 1, 2, or 3
  title: string;
  suggestedCategories: ContentCategory[];
  sections: PortfolioTemplateSection[];
  isGeneric: boolean;                        // true when generated without social data
}
