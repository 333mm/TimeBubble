import { CommentData, PlatformType } from '../../types';
import { CommentFetcher } from '../commentFetcher';
import { IPlatformAdapter, OnNewCommentCallback } from './platformAdapter';

export class YouTubeAdapter implements IPlatformAdapter {
  private commentFetcher: CommentFetcher;
  private onNewCommentsCallback: OnNewCommentCallback | null = null;
  private messageListener: ((e: MessageEvent) => void) | null = null;
  private isDestroyed = false;

  constructor(commentFetcher: CommentFetcher) {
    this.commentFetcher = commentFetcher;
  }

  public getPlatform(): PlatformType {
    return 'youtube';
  }

  public init() {
    this.isDestroyed = false;
    this.setupLiveChatMessageListener();
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
  }

  public setOnNewComments(callback: OnNewCommentCallback) {
    this.onNewCommentsCallback = callback;
    // 既存の VOD コメントフェッチャーからの通知も接続
    this.commentFetcher.setOnNewCommentsCallback((comments) => {
      if (!this.isDestroyed && this.onNewCommentsCallback) {
        this.onNewCommentsCallback(comments);
      }
    });
  }

  public getVideoElement(): HTMLVideoElement | null {
    // 優先順位: 表示されているhtml5-main-video -> watch-flexy内のvideo -> 汎用video
    const mainVideo = document.querySelector<HTMLVideoElement>('video.html5-main-video');
    if (mainVideo && mainVideo.src) return mainVideo;

    const flexyVideo = document.querySelector<HTMLVideoElement>('ytd-watch-flexy video');
    if (flexyVideo) return flexyVideo;

    return document.querySelector<HTMLVideoElement>('video');
  }

  public getPlayerContainer(): HTMLElement | null {
    const moviePlayer = document.getElementById('movie_player') || document.querySelector<HTMLElement>('.html5-video-player');
    if (moviePlayer) return moviePlayer;
    const video = this.getVideoElement();
    return video ? (video.parentElement as HTMLElement) : null;
  }

  public getControlsBar(): HTMLElement | null {
    const rightControls = document.querySelector<HTMLElement>('.ytp-right-controls');
    if (rightControls) return rightControls;
    return document.querySelector<HTMLElement>('.ytp-chrome-controls');
  }

  public getTargetId(): string {
    return this.commentFetcher.getVideoId();
  }

  public isLiveStream(): boolean {
    const liveBadge = document.querySelector('.ytp-live, .ytp-live-badge');
    if (liveBadge) return true;
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    if (watchFlexy?.hasAttribute('is-live')) return true;
    return false;
  }

  /**
   * iframe#chatframe から postMessage で転送されてくるチャットを受信
   */
  private setupLiveChatMessageListener() {
    this.messageListener = (event: MessageEvent) => {
      if (this.isDestroyed) return;
      if (!event.data || event.data.type !== 'TIMEBUBBLE_LIVE_CHAT_MESSAGE') return;

      const comments: CommentData[] = event.data.comments;
      if (Array.isArray(comments) && comments.length > 0 && this.onNewCommentsCallback) {
        this.onNewCommentsCallback(comments);
      }
    };

    window.addEventListener('message', this.messageListener);
  }
}
