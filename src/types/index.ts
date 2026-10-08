export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type OverlaySize = 'small' | 'medium' | 'large';
export type DisplayMode = 'card' | 'flow' | 'chatbox';
export type FlowSpeed = 'slow' | 'normal' | 'fast';
export type FlowDensity = 'low' | 'normal' | 'high';
export type PlatformType = 'youtube' | 'twitch' | 'unknown';
export type CommentSource = 'timestamp' | 'live_chat' | 'twitch_chat';

export interface OverlaySettings {
  enabled: boolean;
  displayMode: DisplayMode; // 'card' (カード表示) | 'flow' (流れるコメント) | 'chatbox' (ミニチャットログ)
  position: OverlayPosition;
  size: OverlaySize;
  displayDuration: number; // 秒数 (例: 6秒)
  maxStackCount: number; // 同時表示最大件数 (例: 3件)
  opacity: number; // 背景・枠線の不透明度 (0 - 100%)
  
  // 流れるコメント専用オプション
  flowSize: OverlaySize; // フロー表示サイズ ('small' | 'medium' | 'large')
  flowOpacity: number; // フロー背景不透明度 (0 - 100%)
  flowSpeed: FlowSpeed; // フロー速度 ('slow' | 'normal' | 'fast')
  flowDensity: FlowDensity; // 流量制限 ('low' | 'normal' | 'high')

  highlightPopular: boolean; // 人気コメントをハイライトするか
  popularThreshold: number; // 人気判定のいいね数しきい値 (例: 50)
  topTierThreshold: number; // 超人気判定のいいね数しきい値 (例: 300)
  language?: string; // UI表示言語 ('ja' | 'en' | 'es' | 'zh')
  flowMode: boolean; // 後方互換性用 (displayMode === 'flow' と連動)

  // Twitch 関連設定
  twitchEnabled: boolean;
  twitchChatMode: DisplayMode;
  twitchShowBadges: boolean;

  // YouTube Live 関連設定
  liveChatEnabled: boolean;
  liveChatMode: DisplayMode;
  showSuperChatOnly: boolean;

  // PiP (Picture-in-Picture) 設定
  pipEnabled: boolean;
  pipShowComments: boolean;
  pipCommentScale: number; // 0.5 - 1.5
}

export const DEFAULT_SETTINGS: OverlaySettings = {
  enabled: true,
  displayMode: 'card',
  position: 'top-right',
  size: 'medium',
  displayDuration: 6,
  maxStackCount: 3,
  opacity: 80,
  flowSize: 'medium',
  flowOpacity: 65,
  flowSpeed: 'normal',
  flowDensity: 'normal',
  highlightPopular: true,
  popularThreshold: 50,
  topTierThreshold: 300,
  language: 'ja',
  flowMode: false,

  twitchEnabled: true,
  twitchChatMode: 'flow',
  twitchShowBadges: true,

  liveChatEnabled: true,
  liveChatMode: 'flow',
  showSuperChatOnly: false,

  pipEnabled: true,
  pipShowComments: true,
  pipCommentScale: 1.0,
};


export interface TimestampOccurrence {
  seconds: number;
  formatted: string;
}

export interface ReplyData {
  id: string;
  authorName: string;
  authorAvatarUrl: string;
  authorChannelUrl?: string;
  rawText: string;
  likeCount: number;
  formattedLikeCount: string;
  publishedTimeText: string;
}

export interface ReplyFetchResult {
  replies: ReplyData[];
  errorCode?: string;
  debugMessage?: string;
}

export interface CommentData {
  id: string;
  authorName: string;
  authorAvatarUrl: string;
  authorChannelUrl?: string; // 投稿者のYouTubeチャンネルURL / TwitchチャンネルURL
  contentHtml: string;
  rawText: string;
  likeCount: number;
  formattedLikeCount: string;
  publishedTimeText: string;
  timestamps: TimestampOccurrence[];
  isDescription?: boolean; // 概要欄チャプターからの場合
  videoId?: string; // 所属動画ID / チャンネル名
  replyCount?: number; // 返信件数
  replyContinuationToken?: string; // 返信取得用トークン

  // プラットフォーム & リアルタイムチャット拡張
  platform?: PlatformType;
  source?: CommentSource;
  userColor?: string; // ユーザー名・アクセント色 (Twitch/YouTube)
  badges?: string[]; // バッジ名リスト (Moderator, Subscriber, VIP, Verified等)
  isSuperChat?: boolean; // スパチャ / Bits
  superChatAmount?: string; // 例: "￥1,000", "500 Bits"
  superChatColor?: string; // スパチャのヘッダー色
  receivedAt?: number; // チャット受信タイムスタンプ
}

export interface TimestampCommentTrigger {
  comment: CommentData;
  timestamp: TimestampOccurrence;
  id: string; // 一意識別子 (comment.id + seconds)
}

