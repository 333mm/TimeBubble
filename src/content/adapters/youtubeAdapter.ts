import { CommentData, PlatformType } from '../../types';
import { CommentFetcher } from '../commentFetcher';
import { IPlatformAdapter, OnNewCommentCallback } from './platformAdapter';

export class YouTubeAdapter implements IPlatformAdapter {
  private commentFetcher: CommentFetcher;
  private onNewCommentsCallback: OnNewCommentCallback | null = null;
  private messageListener: ((e: MessageEvent) => void) | null = null;
  private isDestroyed = false;

  // バックグラウンド・ライブチャット取得用
  private backgroundChatFrame: HTMLIFrameElement | null = null;
  private chatStateObserver: MutationObserver | null = null;
  private syncInterval: number | null = null;
  private fullscreenListener: (() => void) | null = null;
  private clickListener: ((e: MouseEvent) => void) | null = null;
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
    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener, true);
      this.clickListener = null;
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

  /**
   * YouTube標準のチャット枠（#chatframe）が現在画面上に開いてアクティブに動作しているか判定
   */
  public isNativeChatActive(): boolean {
    const chatContainer = document.querySelector<HTMLElement>(
      'ytd-live-chat-frame#chat, ytd-watch-flexy #chat, ytd-live-chat-frame'
    );
    if (!chatContainer) return false;

    // 「チャットを非表示」による折りたたみ状態の判定
    if (chatContainer.hasAttribute('collapsed') || chatContainer.classList.contains('collapsed')) {
      return false;
    }

    if (chatContainer.hidden || chatContainer.style.display === 'none') {
      return false;
    }

    // 要素またはその親・先祖が display: none や visibility: hidden になっているか
    if (chatContainer.offsetParent === null && !document.fullscreenElement) {
      return false;
    }
    const containerStyle = window.getComputedStyle(chatContainer);
    if (containerStyle.display === 'none' || containerStyle.visibility === 'hidden') {
      return false;
    }

    const rect = chatContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    // 全画面時: 全画面用チャットパネルが開いているか確認
    if (document.fullscreenElement) {
      const fsChat = document.querySelector<HTMLElement>(
        '.ytp-fullscreen #chat, ytd-watch-flexy[fullscreen] #chat, .ytp-chrome-bottom .ytp-chat, .ytp-fullscreen-overlay'
      );
      if (!fsChat || fsChat.offsetWidth === 0 || fsChat.offsetHeight === 0) {
        return false;
      }
    }

    // ネイティブのiframeが存在し非表示でないか
    const nativeIframe = chatContainer.querySelector<HTMLIFrameElement>('iframe#chatframe, iframe');
    if (!nativeIframe) return false;
    if (!nativeIframe.src || nativeIframe.src === 'about:blank') return false;
    if (nativeIframe.style.display === 'none' || nativeIframe.hidden) return false;
    const iframeStyle = window.getComputedStyle(nativeIframe);
    if (iframeStyle.display === 'none' || iframeStyle.visibility === 'hidden') return false;

    return true;
  }

  /**
   * チャット欄の開閉状態と同期し、閉じられている場合はバックグラウンドでチャットiframeを維持
   */
  public syncLiveChatFrameState() {
    if (this.isDestroyed) return;

    const isLive = this.isLiveStream();
    if (!isLive) {
      this.cleanupBackgroundLiveChatFrame();
      return;
    }

    // 拡張機能設定でライブチャット機能が無効化されている場合は通信停止
    if (this.isLiveChatEnabledCallback && !this.isLiveChatEnabledCallback()) {
      this.cleanupBackgroundLiveChatFrame();
      return;
    }

    const nativeActive = this.isNativeChatActive();
    if (nativeActive) {
      // ネイティブのチャット枠が開いている場合は重複を避けるためバックグラウンドiframeを破棄
      this.cleanupBackgroundLiveChatFrame();
    } else {
      // ネイティブのチャット枠が閉じられている場合はバックグラウンドiframeを起動して取得を継続
      this.ensureBackgroundLiveChatFrame();
    }
  }

  /**
   * チャット枠が閉じられている際にバックグラウンドで不可視のチャットiframeを起動
   */
  private ensureBackgroundLiveChatFrame() {
    const videoId = this.getVideoId();
    if (!videoId) return;

    let iframe = document.getElementById('timebubble-live-chat-frame') as HTMLIFrameElement | null;
    if (iframe) {
      if (iframe.getAttribute('data-video-id') === videoId && iframe.parentElement) {
        return; // 既に現在の配信向けに正常動作中
      }
      iframe.remove();
      iframe = null;
    }

    iframe = document.createElement('iframe');
    iframe.id = 'timebubble-live-chat-frame';
    iframe.setAttribute('data-video-id', videoId);
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;

    // ネイティブiframeのURLからアーカイブ（チャットリプレイ）かリアルタイム配信かを判別
    const nativeChatframe = document.querySelector<HTMLIFrameElement>('#chatframe');
    const nativeSrc = nativeChatframe?.getAttribute('src') || nativeChatframe?.src || '';
    const isReplay = nativeSrc.includes('/live_chat_replay') || window.location.pathname.includes('/live_chat_replay');

    // 消費済みの古い continuation トークン付き URL は使わず、常に最新セッションを開始するクリーンなURLを生成
    const cleanUrl = isReplay
      ? `https://www.youtube.com/live_chat_replay?v=${encodeURIComponent(videoId)}`
      : `https://www.youtube.com/live_chat?v=${encodeURIComponent(videoId)}`;

    iframe.src = cleanUrl;

    // top: -9999px 等の画面外に配置すると、ブラウザのバックグラウンドスロットリングや
    // YouTubeのIntersectionObserverによってチャット項目のDOM更新が完全に停止してしまう。
    // そのため、ビューポート内（bottom: 0, right: 0）に配置しつつ最背面・極小透明・クリック透過にして
    // ユーザーには一切見えず、かつブラウザとYouTubeからは通常通りアクティブと認識させる。
    iframe.style.setProperty('position', 'fixed', 'important');
    iframe.style.setProperty('bottom', '0px', 'important');
    iframe.style.setProperty('right', '0px', 'important');
    iframe.style.setProperty('width', '320px', 'important');
    iframe.style.setProperty('height', '320px', 'important');
    iframe.style.setProperty('opacity', '0.001', 'important');
    iframe.style.setProperty('pointer-events', 'none', 'important');
    iframe.style.setProperty('z-index', '-99999', 'important');
    iframe.style.setProperty('border', 'none', 'important');

    (document.body || document.documentElement).appendChild(iframe);
    this.backgroundChatFrame = iframe;
    console.log('[TimeBubble] Background live chat frame mounted for closed chat:', videoId, cleanUrl);
  }

  public cleanupBackgroundLiveChatFrame() {
    if (this.backgroundChatFrame && this.backgroundChatFrame.parentElement) {
      this.backgroundChatFrame.parentElement.removeChild(this.backgroundChatFrame);
    }
    const existing = document.getElementById('timebubble-live-chat-frame');
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }
    this.backgroundChatFrame = null;
  }

  /**
   * チャット欄の開閉ボタン（「チャットを非表示」「チャットを表示」等）や属性変化を監視
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
      // 属性制限を外して全般的な構造変化・クラス変化を検知
      this.chatStateObserver.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
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

    // チャット開閉ボタンのクリックを即時検知
    this.clickListener = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.(
          '#show-hide-button, ytd-toggle-button-renderer, button[aria-label*="チャット"], button[aria-label*="Chat"], #chat, ytd-live-chat-frame'
        )
      ) {
        setTimeout(() => this.syncLiveChatFrameState(), 50);
        setTimeout(() => this.syncLiveChatFrameState(), 350);
        setTimeout(() => this.syncLiveChatFrameState(), 1000);
      }
    };
    document.addEventListener('click', this.clickListener, true);

    this.syncLiveChatFrameState();
  }

  /**
   * iframe#chatframe またはバックグラウンドiframeから postMessage で転送されてくるチャットを受信
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
