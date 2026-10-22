import { CommentData, PlatformType } from '../../types';
import { CommentFetcher } from '../commentFetcher';
import { IPlatformAdapter, OnNewCommentCallback } from './platformAdapter';

export class YouTubeAdapter implements IPlatformAdapter {
  private commentFetcher: CommentFetcher;
  private onNewCommentsCallback: OnNewCommentCallback | null = null;
  private messageListener: ((e: MessageEvent) => void) | null = null;
  private isDestroyed = false;

  // バックグラウンドチャット取得用 iframe および状態監視
  private backgroundChatIframe: HTMLIFrameElement | null = null;
  private backgroundChatVideoId = '';
  private chatStateObserver: MutationObserver | null = null;
  private syncInterval: number | null = null;
  private fullscreenListener: (() => void) | null = null;
  private isLiveChatEnabledCallback: (() => boolean) | null = null;
  private knownLiveVideoIds = new Set<string>();

  constructor(commentFetcher: CommentFetcher) {
    this.commentFetcher = commentFetcher;
  }

  public getPlatform(): PlatformType {
    return 'youtube';
  }

  public init() {
    this.isDestroyed = false;
    this.setupLiveChatMessageListener();
    this.setupChatStateObserver();
  }

  public destroy() {
    this.isDestroyed = true;
    this.cleanupBackgroundLiveChatFrame();

    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
    if (this.chatStateObserver) {
      this.chatStateObserver.disconnect();
      this.chatStateObserver = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.fullscreenListener) {
      document.removeEventListener('fullscreenchange', this.fullscreenListener);
      this.fullscreenListener = null;
    }
  }

  public setIsLiveChatEnabledCallback(callback: () => boolean) {
    this.isLiveChatEnabledCallback = callback;
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
    return this.getVideoId();
  }

  public getVideoId(): string {
    const id = this.commentFetcher.getVideoId();
    if (id) return id;
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('v') || url.pathname.match(/\/live\/([a-zA-Z0-9_-]+)/)?.[1] || '';
    } catch {
      return '';
    }
  }

  public isLiveStream(): boolean {
    const vid = this.getVideoId();
    if (vid && this.knownLiveVideoIds.has(vid)) return true;

    if (typeof location !== 'undefined' && location.pathname.startsWith('/live/')) {
      if (vid) this.knownLiveVideoIds.add(vid);
      return true;
    }
    const liveBadge = document.querySelector('.ytp-live, .ytp-live-badge');
    if (liveBadge) {
      if (vid) this.knownLiveVideoIds.add(vid);
      return true;
    }
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    if (watchFlexy?.hasAttribute('is-live')) {
      if (vid) this.knownLiveVideoIds.add(vid);
      return true;
    }
    if (document.querySelector('ytd-live-chat-frame, ytd-watch-flexy #chat, #chatframe, #show-hide-button')) {
      if (vid) this.knownLiveVideoIds.add(vid);
      return true;
    }
    const video = this.getVideoElement();
    if (video && video.duration === Infinity) {
      if (vid) this.knownLiveVideoIds.add(vid);
      return true;
    }
    return false;
  }

  private getChatContainer(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      'ytd-live-chat-frame#chat, ytd-watch-flexy #chat, ytd-live-chat-frame'
    );
  }

  /**
   * YouTube標準のチャット枠（#chatframe）が現在画面上に開いてアクティブに動作しているか判定
   */
  public isNativeChatActive(): boolean {
    const chatContainer = this.getChatContainer();
    if (!chatContainer) return false;

    if (
      chatContainer.hasAttribute('collapsed') ||
      chatContainer.hasAttribute('hidden') ||
      chatContainer.classList.contains('collapsed')
    ) {
      return false;
    }

    const style = window.getComputedStyle(chatContainer);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    const nativeIframe = chatContainer.querySelector<HTMLIFrameElement>('iframe#chatframe, iframe');
    if (!nativeIframe) return false;
    const src = nativeIframe.getAttribute('src') || nativeIframe.src || '';
    if (!src || src === 'about:blank') return false;

    const iframeStyle = window.getComputedStyle(nativeIframe);
    if (iframeStyle.display === 'none' || iframeStyle.visibility === 'hidden') {
      return false;
    }

    // チャットが閉じられている・隠れている場合は iframe の描画サイズが 0 になる
    const iframeRect = nativeIframe.getBoundingClientRect();
    if (iframeRect.width < 50 || iframeRect.height < 50) {
      return false;
    }

    // 全画面表示中にネイティブチャットが全画面要素の外にある場合は非表示扱い
    const fsElement = document.fullscreenElement;
    if (fsElement && !fsElement.contains(nativeIframe)) {
      return false;
    }

    return true;
  }

  /**
   * チャット欄の開閉状態と同期し、閉じられている場合のみページレイアウトに影響しない
   * バックグラウンドポップアウト iframe（?is_popout=1&v=...）でチャット取得を維持する
   */
  public syncLiveChatFrameState() {
    if (this.isDestroyed) return;

    // 拡張機能設定でライブチャット機能が無効化されている場合はバックグラウンド iframe を破棄
    if (this.isLiveChatEnabledCallback && !this.isLiveChatEnabledCallback()) {
      this.cleanupBackgroundLiveChatFrame();
      return;
    }

    const isLive = this.isLiveStream();
    if (!isLive) {
      this.cleanupBackgroundLiveChatFrame();
      return;
    }

    if (this.isNativeChatActive()) {
      // ネイティブチャットが開いている場合は重複取得を防ぐためバックグラウンド iframe を破棄
      this.cleanupBackgroundLiveChatFrame();
    } else {
      // ネイティブチャットが閉じられている（collapsed / 非表示）場合はバックグラウンド iframe を起動
      this.ensureBackgroundLiveChatFrame();
    }
  }

  private ensureBackgroundLiveChatFrame() {
    const videoId = this.getVideoId();
    if (!videoId) return;

    const hostParent = (document.fullscreenElement as HTMLElement) || document.body;
    if (!hostParent) return;

    if (
      this.backgroundChatIframe &&
      document.contains(this.backgroundChatIframe) &&
      this.backgroundChatVideoId === videoId
    ) {
      if (this.backgroundChatIframe.parentElement !== hostParent) {
        hostParent.appendChild(this.backgroundChatIframe);
      }
      return;
    }

    this.cleanupBackgroundLiveChatFrame();

    const watchFlexy = document.querySelector('ytd-watch-flexy');
    const video = this.getVideoElement();
    const isRealtimeLive =
      watchFlexy?.hasAttribute('is-live') ||
      (video && video.duration === Infinity) ||
      Boolean(document.querySelector('.ytp-live-badge[disabled], .ytp-live'));

    const nativeChatframe = document.querySelector<HTMLIFrameElement>(
      'ytd-live-chat-frame iframe#chatframe, iframe#chatframe'
    );
    const nativeSrc = nativeChatframe?.getAttribute('src') || nativeChatframe?.src || '';
    const isReplay = !isRealtimeLive && nativeSrc.includes('live_chat_replay');

    // is_popout=1 を付与することで continuation トークン不要で新規セッションを確立
    const cleanUrl = isReplay
      ? `https://www.youtube.com/live_chat_replay?is_popout=1&v=${encodeURIComponent(videoId)}`
      : `https://www.youtube.com/live_chat?is_popout=1&v=${encodeURIComponent(videoId)}`;

    const iframe = document.createElement('iframe');
    iframe.id = 'timebubble-live-chat-frame';
    iframe.src = cleanUrl;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    // ページレイアウトに一切影響せず、かつブラウザの画面外スロットリングを回避するビューポート内極小透過配置
    iframe.style.cssText = [
      'position: fixed !important',
      'bottom: 0px !important',
      'right: 0px !important',
      'width: 320px !important',
      'height: 360px !important',
      'opacity: 0.001 !important',
      'pointer-events: none !important',
      'z-index: -99999 !important',
      'border: none !important',
      'margin: 0 !important',
      'padding: 0 !important',
    ].join('; ');

    hostParent.appendChild(iframe);
    this.backgroundChatIframe = iframe;
    this.backgroundChatVideoId = videoId;
  }

  public cleanupBackgroundLiveChatFrame() {
    if (this.backgroundChatIframe) {
      if (this.backgroundChatIframe.parentElement) {
        this.backgroundChatIframe.parentElement.removeChild(this.backgroundChatIframe);
      }
      this.backgroundChatIframe = null;
    }
    const existing = document.getElementById('timebubble-live-chat-frame');
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }
    this.backgroundChatVideoId = '';
  }

  /**
   * チャット欄の開閉状態や属性変化を監視（YouTube 純正の DOM / CSS には一切干渉しない）
   */
  private setupChatStateObserver() {
    if (this.chatStateObserver) {
      this.chatStateObserver.disconnect();
    }

    this.chatStateObserver = new MutationObserver(() => {
      this.syncLiveChatFrameState();
    });

    const targetNode = document.body || document.documentElement;
    if (targetNode) {
      this.chatStateObserver.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['collapsed', 'hidden', 'src', 'style', 'class', 'is-live'],
      });
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.syncInterval = window.setInterval(() => {
      this.syncLiveChatFrameState();
    }, 1500);

    this.fullscreenListener = () => {
      this.syncLiveChatFrameState();
    };
    document.addEventListener('fullscreenchange', this.fullscreenListener);

    this.syncLiveChatFrameState();
  }

  /**
   * iframe（ネイティブ #chatframe またはバックグラウンド #timebubble-live-chat-frame）から
   * postMessage で転送されてくるライブチャットを受信
   */
  private setupLiveChatMessageListener() {
    this.messageListener = (event: MessageEvent) => {
      if (this.isDestroyed || !event.data) return;
      if (event.data.type !== 'TIMEBUBBLE_LIVE_CHAT_MESSAGE') return;

      const comments: CommentData[] = event.data.comments;
      if (Array.isArray(comments) && comments.length > 0 && this.onNewCommentsCallback) {
        this.onNewCommentsCallback(comments);
      }
    };

    window.addEventListener('message', this.messageListener);
  }
}
