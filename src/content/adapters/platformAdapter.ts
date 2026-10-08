import { CommentData, PlatformType } from '../../types';

export type OnNewCommentCallback = (comments: CommentData[]) => void;

export interface IPlatformAdapter {
  /** プラットフォーム識別子 */
  getPlatform(): PlatformType;

  /** アダプタの初期化 (DOM監視やリスナー登録) */
  init(): void;

  /** アダプタの破棄 */
  destroy(): void;

  /** 現在の対象動画/配信の <video> 要素を取得 */
  getVideoElement(): HTMLVideoElement | null;

  /** オーバーレイを挿入すべきプレイヤーコンテナ要素を取得 */
  getPlayerContainer(): HTMLElement | null;

  /** 現在の動画/配信の一意識別子 (videoId, channelNameなど) */
  getTargetId(): string;

  /** 生配信またはプレミア公開中かどうか */
  isLiveStream(): boolean;

  /** 新規コメント/チャット到着時のコールバックを設定 */
  setOnNewComments(callback: OnNewCommentCallback): void;

  /** プレイヤーのコントロールバー要素を取得 (TimeBubbleボタン配置用) */
  getControlsBar(): HTMLElement | null;
}
