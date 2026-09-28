export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type OverlaySize = 'small' | 'medium' | 'large';
export type DisplayMode = 'card' | 'flow';
export type FlowSpeed = 'slow' | 'normal' | 'fast';

export interface OverlaySettings {
  enabled: boolean;
  displayMode: DisplayMode; // 'card' (カード表示) | 'flow' (流れるコメント)
  position: OverlayPosition;
  size: OverlaySize;
  displayDuration: number; // 秒数 (例: 6秒)
  maxStackCount: number; // 同時表示最大件数 (例: 3件)
  opacity: number; // 背景・枠線の不透明度 (0 - 100%)
  
  // 流れるコメント専用オプション
  flowSize: OverlaySize; // フロー表示サイズ ('small' | 'medium' | 'large')
  flowOpacity: number; // フロー背景不透明度 (0 - 100%)
  flowSpeed: FlowSpeed; // フロー速度 ('slow' | 'normal' | 'fast')

  highlightPopular: boolean; // 人気コメントをハイライトするか
  popularThreshold: number; // 人気判定のいいね数しきい値 (例: 50)
  topTierThreshold: number; // 超人気判定のいいね数しきい値 (例: 300)
  language?: string; // UI表示言語 ('ja' | 'en' | 'es' | 'zh')
  flowMode: boolean; // 後方互換性用 (displayMode === 'flow' と連動)
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
  highlightPopular: true,
  popularThreshold: 50,
  topTierThreshold: 300,
  language: 'ja',
  flowMode: false,
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
  authorChannelUrl?: string; // 投稿者のYouTubeチャンネルURL
  contentHtml: string;
  rawText: string;
  likeCount: number;
  formattedLikeCount: string;
  publishedTimeText: string;
  timestamps: TimestampOccurrence[];
  isDescription?: boolean; // 概要欄チャプターからの場合
  videoId?: string; // 所属動画ID
  replyCount?: number; // 返信件数
  replyContinuationToken?: string; // 返信取得用トークン
}

export interface TimestampCommentTrigger {
  comment: CommentData;
  timestamp: TimestampOccurrence;
  id: string; // 一意識別子 (comment.id + seconds)
}

