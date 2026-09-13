export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type OverlaySize = 'small' | 'medium' | 'large';

export interface OverlaySettings {
  enabled: boolean;
  position: OverlayPosition;
  size: OverlaySize;
  displayDuration: number; // 秒数 (例: 6秒)
  maxStackCount: number; // 同時表示最大件数 (例: 3件)
  opacity: number; // 背景・枠線の不透明度 (0 - 100%)
  highlightPopular: boolean; // 人気コメントをハイライトするか
  popularThreshold: number; // 人気判定のいいね数しきい値 (例: 50)
  topTierThreshold: number; // 超人気判定のいいね数しきい値 (例: 300)
  language?: string; // UI表示言語 ('ja' | 'en' | 'es' | 'zh')
}

export const DEFAULT_SETTINGS: OverlaySettings = {
  enabled: true,
  position: 'top-right',
  size: 'medium',
  displayDuration: 6,
  maxStackCount: 3,
  opacity: 80,
  highlightPopular: true,
  popularThreshold: 50,
  topTierThreshold: 300,
  language: 'ja',
};

export interface TimestampOccurrence {
  seconds: number;
  formatted: string;
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
}

export interface TimestampCommentTrigger {
  comment: CommentData;
  timestamp: TimestampOccurrence;
  id: string; // 一意識別子 (comment.id + seconds)
}
