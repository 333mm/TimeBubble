import { CommentData, PlatformType } from '../../types';
import { CommentFetcher } from '../commentFetcher';
import { IPlatformAdapter, OnNewCommentCallback } from './platformAdapter';

export class YouTubeAdapter implements IPlatformAdapter {
  private commentFetcher: CommentFetcher;
  private onNewCommentsCallback: OnNewCommentCallback | null = null;
  private messageListener: ((e: MessageEvent) => void) | null = null;
  private isDestroyed = false;

  // 独自チャット非表示モード（Stealth Chat Hide Mode）および状態同期用
  private isStealthChatHidden = false;
  private isProgrammaticClick = false;
  private lastAutoExpandAttemptTime = 0;
  private lastTrackedVideoId = '';
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
    this.setStealthChatHidden(false);

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

    if (chatContainer.hasAttribute('collapsed') || chatContainer.classList.contains('collapsed')) {
      return false;
    }

    const nativeIframe = chatContainer.querySelector<HTMLIFrameElement>('iframe#chatframe, iframe');
    if (!nativeIframe) return false;
    const src = nativeIframe.getAttribute('src') || nativeIframe.src || '';
    if (!src || src === 'about:blank') return false;

    return true;
  }

  /**
   * 独自の非表示モード（Stealth Chat Hide Mode）の切り替え
   * YouTube純正の collapsed 化による通信切断を回避しつつ、見た目とレイアウト上は完全に折りたたむ
   */
  public setStealthChatHidden(hidden: boolean) {
    this.isStealthChatHidden = hidden;

    const chatContainer = this.getChatContainer();
    const chatWrapper = document.getElementById('chat-container');
    const panelsFullBleed = document.getElementById('panels-full-bleed-container');
    const watchFlexy = document.querySelector<HTMLElement>('ytd-watch-flexy');

    if (hidden) {
      chatContainer?.classList.add('yt-co-stealth-chat-hidden');
      chatWrapper?.classList.add('yt-co-stealth-container-hidden');
      panelsFullBleed?.classList.add('yt-co-stealth-container-hidden');
      watchFlexy?.classList.add('yt-co-stealth-flexy-chat-hidden');
      this.ensureRestoreChatBar();
    } else {
      document.querySelectorAll('.yt-co-stealth-chat-hidden').forEach((el) => {
        el.classList.remove('yt-co-stealth-chat-hidden');
      });
      document.querySelectorAll('.yt-co-stealth-container-hidden').forEach((el) => {
        el.classList.remove('yt-co-stealth-container-hidden');
      });
      document.querySelectorAll('.yt-co-stealth-flexy-chat-hidden').forEach((el) => {
        el.classList.remove('yt-co-stealth-flexy-chat-hidden');
      });
      this.removeRestoreChatBar();
    }
  }

  /**
   * 独自非表示モード中に「チャットを表示」復元ボタンバーを描画
   */
  private ensureRestoreChatBar() {
    let bar = document.getElementById('yt-co-restore-chat-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'yt-co-restore-chat-bar';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'yt-co-restore-chat-btn';
      btn.textContent = 'チャットを表示';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setStealthChatHidden(false);
        const chatContainer = this.getChatContainer();
        if (chatContainer && (chatContainer.hasAttribute('collapsed') || chatContainer.classList.contains('collapsed'))) {
          this.triggerNativeChatExpand();
        }
      });

      bar.appendChild(btn);
    }

    // 配置先の決定（通常時は #chat-container、シアターモード等で #chat-container が非表示域にある場合は #secondary-inner 先頭）
    const chatWrapper = document.getElementById('chat-container');
    const panelsFullBleed = document.getElementById('panels-full-bleed-container');
    const secondaryInner = document.getElementById('secondary-inner') || document.getElementById('secondary');
    const chatContainer = this.getChatContainer();

    let host: HTMLElement | null = null;
    if (chatWrapper && (!panelsFullBleed || !panelsFullBleed.contains(chatWrapper))) {
      host = chatWrapper;
    } else if (secondaryInner) {
      host = secondaryInner;
    } else if (chatContainer?.parentElement) {
      host = chatContainer.parentElement;
    }

    if (host && bar.parentElement !== host) {
      host.prepend(bar);
    }
  }

  private removeRestoreChatBar() {
    const bar = document.getElementById('yt-co-restore-chat-bar');
    if (bar && bar.parentElement) {
      bar.parentElement.removeChild(bar);
    }
  }

  /**
   * YouTube 純正のチャットが collapsed（折りたたみ切断）状態の場合にプログラム的に展開させ、
   * 正規の continuation トークン付き iframe#chatframe を接続させる
   */
  private triggerNativeChatExpand() {
    const now = Date.now();
    if (now - this.lastAutoExpandAttemptTime < 2000) return;
    this.lastAutoExpandAttemptTime = now;

    const expandBtn = document.querySelector<HTMLElement>(
      '#show-hide-button button, #show-hide-button ytd-toggle-button-renderer button, #show-hide-button ytd-button-renderer button, #show-hide-button tp-yt-paper-button, ytd-live-chat-frame[collapsed] #show-hide-button *'
    );
    if (expandBtn && typeof expandBtn.click === 'function') {
      this.isProgrammaticClick = true;
      try {
        expandBtn.click();
        console.log('[TimeBubble] Triggered native chat expansion for Stealth Chat Mode');
      } finally {
        this.isProgrammaticClick = false;
      }
    }
  }

  /**
   * チャット欄の開閉状態と同期し、閉じられている場合は独自非表示モード（Stealth Chat Hide Mode）で通信を維持
   */
  public syncLiveChatFrameState() {
    if (this.isDestroyed) return;

    const currentVid = this.getVideoId();
    if (currentVid && currentVid !== this.lastTrackedVideoId) {
      this.lastTrackedVideoId = currentVid;
      this.isStealthChatHidden = false;
      this.removeRestoreChatBar();
    }

    const isLive = this.isLiveStream();
    if (!isLive) {
      if (this.isStealthChatHidden) {
        this.setStealthChatHidden(false);
      }
      return;
    }

    // 拡張機能設定でライブチャット機能が無効化されている場合は干渉しない
    if (this.isLiveChatEnabledCallback && !this.isLiveChatEnabledCallback()) {
      return;
    }

    const chatContainer = this.getChatContainer();
    if (!chatContainer) return;

    const isNativelyCollapsed =
      chatContainer.hasAttribute('collapsed') || chatContainer.classList.contains('collapsed');

    if (isNativelyCollapsed) {
      // YouTube純正の折りたたみ状態（通信切断）を検知したら、即座に独自非表示モードを適用して画面上は隠したまま内部的に展開させる
      this.setStealthChatHidden(true);
      this.triggerNativeChatExpand();
    } else if (this.isStealthChatHidden) {
      // 独自非表示モード中は、DOM再構築やシアターモード切替が起きてもクラスと復元バーを維持する
      this.setStealthChatHidden(true);
    }
  }

  public cleanupBackgroundLiveChatFrame() {
    const existing = document.getElementById('timebubble-live-chat-frame');
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }
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
      this.chatStateObserver.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['collapsed', 'hidden', 'theater', 'fixed-panels'],
      });
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.syncInterval = window.setInterval(() => {
      this.syncLiveChatFrameState();
    }, 1000);

    this.fullscreenListener = () => {
      this.syncLiveChatFrameState();
    };
    document.addEventListener('fullscreenchange', this.fullscreenListener);

    // 親ページの「チャットを非表示」ボタンクリックをキャプチャフェーズでインターセプト
    this.clickListener = (e: MouseEvent) => {
      if (this.isProgrammaticClick) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 復元バー自体のクリックは素通り
      if (target.closest('#yt-co-restore-chat-bar')) return;

      const showHideBtn = target.closest('#show-hide-button');
      if (showHideBtn) {
        const liveEnabled = !this.isLiveChatEnabledCallback || this.isLiveChatEnabledCallback();
        const chatContainer = this.getChatContainer();

        if (liveEnabled && chatContainer) {
          const isNativelyCollapsed =
            chatContainer.hasAttribute('collapsed') || chatContainer.classList.contains('collapsed');

          if (!isNativelyCollapsed) {
            // チャットが展開されている状態で「チャットを非表示」が押された場合:
            // YouTube純正の collapsed 化（通信切断）を阻止し、独自の非表示モードへ切り替える
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.setStealthChatHidden(!this.isStealthChatHidden);
            return;
          } else {
            // 万一純正の「チャットを表示」ボタンが押された場合は、独自非表示を解除して展開させる
            this.setStealthChatHidden(false);
          }
        }
      }
    };
    document.addEventListener('click', this.clickListener, true);

    this.syncLiveChatFrameState();
  }

  /**
   * iframe#chatframe から postMessage で転送されてくるチャットおよびステルス非表示トグルを受信
   */
  private setupLiveChatMessageListener() {
    this.messageListener = (event: MessageEvent) => {
      if (this.isDestroyed || !event.data) return;

      if (event.data.type === 'TIMEBUBBLE_STEALTH_CHAT_TOGGLE') {
        const liveEnabled = !this.isLiveChatEnabledCallback || this.isLiveChatEnabledCallback();
        if (liveEnabled) {
          this.setStealthChatHidden(Boolean(event.data.hidden));
        }
        return;
      }

      if (event.data.type !== 'TIMEBUBBLE_LIVE_CHAT_MESSAGE') return;

      const comments: CommentData[] = event.data.comments;
      if (Array.isArray(comments) && comments.length > 0 && this.onNewCommentsCallback) {
        this.onNewCommentsCallback(comments);
      }
    };

    window.addEventListener('message', this.messageListener);
  }
}
