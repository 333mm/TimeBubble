import { CommentData, EmoteItem, MessageToken, PlatformType } from '../../types';
import { CommentFetcher } from '../commentFetcher';
import { IPlatformAdapter, OnNewCommentCallback } from './platformAdapter';

export class YouTubeAdapter implements IPlatformAdapter {
  private commentFetcher: CommentFetcher;
  private onNewCommentsCallback: OnNewCommentCallback | null = null;
  private onLiveStateConfirmedCallback: (() => void) | null = null;
  private messageListener: ((e: MessageEvent) => void) | null = null;
  private isDestroyed = false;

  // 独自チャット非表示モード（Stealth Chat Hide Mode）および状態同期用
  private isStealthChatHidden = false;
  private hadFixedPanelsBeforeStealth = false;
  private lastTheaterModeState = false;
  private lastOtherPanelExpandedState = false;
  private isProgrammaticClick = false;
  private lastAutoExpandAttemptTime = 0;
  private lastTrackedVideoId = '';
  private chatStateObserver: MutationObserver | null = null;
  private syncInterval: number | null = null;
  private fullscreenListener: (() => void) | null = null;
  private clickListener: ((e: MouseEvent) => void) | null = null;
  private isLiveChatEnabledCallback: (() => boolean) | null = null;
  private knownLiveVideoIds = new Set<string>();
  private nonLiveVideoIds = new Set<string>();

  // InnerTube get_live_chat 直接ポーリング（バックアップエンジン）
  private pollingVideoId = '';
  private isPollingActive = false;
  private pollingAbortController: AbortController | null = null;
  private pacingTimers: number[] = [];

  // 重複排除キャッシュ
  private seenLiveCommentIds = new Set<string>();
  private recentCommentSignatures = new Map<string, number>();
  private hasEmittedAnyForCurrentVideo = false;

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

  public setOnLiveStateConfirmedCallback(callback: () => void) {
    this.onLiveStateConfirmedCallback = callback;
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
    const mainVideo = document.querySelector<HTMLVideoElement>('video.html5-main-video');
    if (mainVideo && mainVideo.src) return mainVideo;

    const flexyVideo = document.querySelector<HTMLVideoElement>('ytd-watch-flexy video');
    if (flexyVideo) return flexyVideo;

    return document.querySelector<HTMLVideoElement>('video');
  }

  public getPlayerContainer(): HTMLElement | null {
    const moviePlayer =
      document.getElementById('movie_player') ||
      document.querySelector<HTMLElement>('.html5-video-player');
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
      return (
        url.searchParams.get('v') ||
        url.pathname.match(/\/live\/([a-zA-Z0-9_-]+)/)?.[1] ||
        ''
      );
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
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    if (watchFlexy?.hasAttribute('is-live')) {
      if (vid) this.knownLiveVideoIds.add(vid);
      return true;
    }
    if (document.querySelector('.html5-video-player.ytp-live')) {
      if (vid) this.knownLiveVideoIds.add(vid);
      return true;
    }
    if (
      document.querySelector(
        'ytd-live-chat-frame:not([hidden]), ytd-watch-flexy #chat:not([hidden]), #chatframe, #show-hide-button'
      )
    ) {
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
   * YouTube純正の collapsed 化による通信切断を回避しつつ、ページレイアウトを一切崩さずに折りたたむ
   */
  public setStealthChatHidden(hidden: boolean) {
    const wasHidden = this.isStealthChatHidden;
    this.isStealthChatHidden = hidden;

    const chatContainer = this.getChatContainer();
    const chatWrapper = document.getElementById('chat-container');
    const panelsFullBleed = document.getElementById('panels-full-bleed-container');
    const watchFlexy = document.querySelector<HTMLElement>('ytd-watch-flexy, ytd-watch-grid');
    let fixedPanelsChanged = false;

    const isTheaterOrFullBleed = Boolean(
      watchFlexy?.hasAttribute('theater') || watchFlexy?.hasAttribute('full-bleed-player')
    );
    const theaterStateChanged = isTheaterOrFullBleed !== this.lastTheaterModeState;
    this.lastTheaterModeState = isTheaterOrFullBleed;

    // 他のエンゲージメントパネル（概要欄・チャプター・文字起こし・プレイリスト等）が開いているか判定
    const hasOtherExpandedPanel = Boolean(
      watchFlexy?.hasAttribute('engagement-panel-expanded') ||
        watchFlexy?.hasAttribute('playlist-panel-expanded') ||
        panelsFullBleed?.querySelector(
          'ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]:not([target-id*="chat"])'
        )
    );
    const otherPanelStateChanged = hasOtherExpandedPanel !== this.lastOtherPanelExpandedState;
    this.lastOtherPanelExpandedState = hasOtherExpandedPanel;

    if (hidden) {
      chatContainer?.classList.add('yt-co-stealth-chat-hidden');
      chatWrapper?.classList.add('yt-co-stealth-container-hidden');

      if (!hasOtherExpandedPanel) {
        panelsFullBleed?.classList.add('yt-co-stealth-container-hidden');
        watchFlexy?.classList.add('yt-co-stealth-flexy-chat-hidden');
        if (watchFlexy?.hasAttribute('fixed-panels')) {
          this.hadFixedPanelsBeforeStealth = true;
          watchFlexy.removeAttribute('fixed-panels');
          fixedPanelsChanged = true;
        }
      } else {
        panelsFullBleed?.classList.remove('yt-co-stealth-container-hidden');
        watchFlexy?.classList.remove('yt-co-stealth-flexy-chat-hidden');
      }

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

      if (this.hadFixedPanelsBeforeStealth && watchFlexy) {
        if (isTheaterOrFullBleed && !watchFlexy.hasAttribute('fixed-panels')) {
          watchFlexy.setAttribute('fixed-panels', '');
          fixedPanelsChanged = true;
        }
        this.hadFixedPanelsBeforeStealth = false;
      }

      this.removeRestoreChatBar();
    }

    if (
      wasHidden !== hidden ||
      fixedPanelsChanged ||
      (hidden && (theaterStateChanged || otherPanelStateChanged))
    ) {
      this.notifyYouTubePlayerResize();
    }
  }

  /**
   * チャット開閉に伴うプレイヤー領域の幅変化を YouTube の HTML5 プレイヤーへ通知し、
   * <video class="html5-main-video"> のインライン width/height/left を即座に再計算させる
   */
  private notifyYouTubePlayerResize() {
    try {
      const dispatchResize = () => {
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new CustomEvent('YT_COMMENT_OVERLAY_FORCE_PLAYER_RESIZE'));
      };
      dispatchResize();
      window.setTimeout(() => {
        if (!this.isDestroyed) dispatchResize();
      }, 60);
      window.setTimeout(() => {
        if (!this.isDestroyed) dispatchResize();
      }, 220);
    } catch {
      // ignore
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
        if (
          chatContainer &&
          (chatContainer.hasAttribute('collapsed') || chatContainer.classList.contains('collapsed'))
        ) {
          this.triggerNativeChatExpand();
        }
      });

      bar.appendChild(btn);
    }

    const chatWrapper = document.getElementById('chat-container');
    const panelsFullBleed = document.getElementById('panels-full-bleed-container');
    const columnsEl = document.getElementById('columns');
    const secondaryInner =
      document.getElementById('secondary-inner') || document.getElementById('secondary');
    const chatContainer = this.getChatContainer();
    const watchFlexy = document.querySelector<HTMLElement>('ytd-watch-flexy, ytd-watch-grid');
    const isTheaterOrFullBleed = Boolean(
      watchFlexy?.hasAttribute('theater') || watchFlexy?.hasAttribute('full-bleed-player')
    );

    // シアターモード時は YouTube が #chat-container を #columns 直下や #panels-full-bleed-container 内に移動させるため、
    // 復元バーは #secondary-inner の先頭（YouTube 純正のシアター折りたたみ時と同じ位置）に配置する
    const isChatInTheaterSlot = Boolean(
      chatWrapper &&
        ((panelsFullBleed && panelsFullBleed.contains(chatWrapper)) ||
          chatWrapper.parentElement === columnsEl ||
          isTheaterOrFullBleed)
    );

    let host: HTMLElement | null = null;
    if (chatWrapper && !isChatInTheaterSlot) {
      host = chatWrapper;
    } else if (secondaryInner) {
      host = secondaryInner;
    } else if (chatWrapper) {
      host = chatWrapper;
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
   * チャット欄の開閉状態と同期し、閉じられている場合は独自非表示モード（Stealth Chat Hide Mode）
   * および InnerTube API ポーリングで通信を維持
   */
  public syncLiveChatFrameState() {
    if (this.isDestroyed) return;

    const currentVid = this.getVideoId();
    if (currentVid && currentVid !== this.lastTrackedVideoId) {
      this.lastTrackedVideoId = currentVid;
      this.isStealthChatHidden = false;
      this.hadFixedPanelsBeforeStealth = false;
      this.removeRestoreChatBar();
      this.resetLiveDeduplicationCache();
      this.stopLiveChatApiPolling();
    }

    const isLive = this.isLiveStream();
    if (!isLive) {
      if (this.isStealthChatHidden) {
        this.setStealthChatHidden(false);
      }
      this.stopLiveChatApiPolling();
      return;
    }

    // 拡張機能設定でライブチャット機能が無効化されている場合は干渉しない
    if (this.isLiveChatEnabledCallback && !this.isLiveChatEnabledCallback()) {
      this.stopLiveChatApiPolling();
      return;
    }

    const chatContainer = this.getChatContainer();
    if (chatContainer) {
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

    if (currentVid && !this.nonLiveVideoIds.has(currentVid)) {
      this.ensureLiveChatApiPolling(currentVid);
    }
  }

  public cleanupBackgroundLiveChatFrame() {
    this.stopLiveChatApiPolling();
    const existing = document.getElementById('timebubble-live-chat-frame');
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }
  }

  private resetLiveDeduplicationCache() {
    this.seenLiveCommentIds.clear();
    this.recentCommentSignatures.clear();
    this.hasEmittedAnyForCurrentVideo = false;
    this.clearPacingTimers();
  }

  private clearPacingTimers() {
    for (const timer of this.pacingTimers) {
      window.clearTimeout(timer);
    }
    this.pacingTimers = [];
  }

  private stopLiveChatApiPolling() {
    this.isPollingActive = false;
    this.pollingVideoId = '';
    if (this.pollingAbortController) {
      this.pollingAbortController.abort();
      this.pollingAbortController = null;
    }
    this.clearPacingTimers();
  }

  private ensureLiveChatApiPolling(videoId: string) {
    if (
      this.isPollingActive &&
      this.pollingVideoId === videoId &&
      this.pollingAbortController &&
      !this.pollingAbortController.signal.aborted
    ) {
      return;
    }

    this.stopLiveChatApiPolling();
    this.pollingVideoId = videoId;
    this.isPollingActive = true;
    this.pollingAbortController = new AbortController();
    const signal = this.pollingAbortController.signal;

    void this.runLiveChatPollingLoopAsync(videoId, signal);
  }

  private async runLiveChatPollingLoopAsync(videoId: string, signal: AbortSignal): Promise<void> {
    try {
      const creds = await this.resolveInnertubeCredentialsAsync(videoId, signal);
      if (!creds || signal.aborted || this.isDestroyed) {
        this.isPollingActive = false;
        return;
      }

      const { apiKey, clientVersion } = creds;
      const bootstrap = await this.bootstrapLiveChatContinuationAsync(
        videoId,
        apiKey,
        clientVersion,
        signal
      );

      if (signal.aborted || this.isDestroyed || this.getVideoId() !== videoId) {
        this.isPollingActive = false;
        return;
      }

      if (!bootstrap) {
        if (!this.isLiveStream()) {
          this.nonLiveVideoIds.add(videoId);
        }
        this.isPollingActive = false;
        return;
      }

      this.knownLiveVideoIds.add(videoId);
      this.nonLiveVideoIds.delete(videoId);
      this.onLiveStateConfirmedCallback?.();

      let token: string | null = bootstrap.continuation;
      let isInitialReloadBatch = bootstrap.isReloadToken;
      let switchedToAllChat = bootstrap.isAllChat;
      let useSameOriginAuth = bootstrap.useSameOriginAuth;
      let consecutiveErrors = 0;

      while (token && !signal.aborted && !this.isDestroyed && this.getVideoId() === videoId) {
        if (this.isLiveChatEnabledCallback && !this.isLiveChatEnabledCallback()) {
          break;
        }

        let pollDelayMs = 1800;

        try {
          const chatUrl = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${encodeURIComponent(
            apiKey
          )}&prettyPrint=false`;

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-YouTube-Client-Name': '1',
            'X-YouTube-Client-Version': clientVersion,
          };

          if (useSameOriginAuth) {
            const sapisidHeader = await this.buildSapisidHashHeaderAsync();
            if (sapisidHeader) {
              headers['Authorization'] = sapisidHeader;
              headers['X-Origin'] = window.location.origin;
              headers['X-Goog-AuthUser'] = '0';
            }
          }

          const res = await fetch(chatUrl, {
            method: 'POST',
            headers,
            credentials: useSameOriginAuth ? 'same-origin' : 'omit',
            body: JSON.stringify({
              context: {
                client: {
                  hl: navigator.language || 'ja',
                  gl: 'JP',
                  clientName: 'WEB',
                  clientVersion,
                },
              },
              continuation: token,
            }),
            signal,
          });

          if (!res.ok) {
            if (!useSameOriginAuth && (res.status === 401 || res.status === 403)) {
              useSameOriginAuth = true;
              continue;
            }
            throw new Error(`HTTP ${res.status}`);
          }

          const json = await res.json();
          if (signal.aborted || this.isDestroyed || this.getVideoId() !== videoId) break;

          const lcc =
            json?.continuationContents?.liveChatContinuation ||
            json?.contents?.liveChatRenderer;

          if (!lcc) {
            throw new Error('Missing liveChatContinuation');
          }

          consecutiveErrors = 0;

          if (!switchedToAllChat) {
            const allChatToken = this.extractAllChatContinuationFromHeader(lcc?.header);
            if (allChatToken && allChatToken.length > 80) {
              const initialActions = Array.isArray(lcc.actions) ? lcc.actions : [];
              for (const act of initialActions) {
                const parsed = this.parseLiveChatAction(act, videoId);
                if (parsed) this.markCommentAsSeen(parsed);
              }
              token = allChatToken;
              switchedToAllChat = true;
              isInitialReloadBatch = true;
              continue;
            }
            switchedToAllChat = true;
          }

          const actions = Array.isArray(lcc.actions) ? lcc.actions : [];
          const parsedBatch: CommentData[] = [];
          for (const act of actions) {
            const parsed = this.parseLiveChatAction(act, videoId);
            if (parsed) {
              parsedBatch.push(parsed);
            }
          }

          if (isInitialReloadBatch) {
            const previewCount = !this.hasEmittedAnyForCurrentVideo ? 2 : 0;
            const archiveCutoff = Math.max(0, parsedBatch.length - previewCount);
            for (let i = 0; i < archiveCutoff; i++) {
              this.markCommentAsSeen(parsedBatch[i]);
            }
            const recentPreview = parsedBatch.slice(archiveCutoff);
            if (recentPreview.length > 0) {
              this.emitDeduplicatedLiveComments(recentPreview);
            }
            isInitialReloadBatch = false;
          } else if (parsedBatch.length > 0) {
            const unseen = parsedBatch.filter((c) => !this.isDuplicateLiveComment(c));
            if (unseen.length > 0) {
              this.schedulePacedComments(unseen, videoId);
            }
          }

          const nextCont = this.extractNextContinuation(lcc.continuations);
          if (nextCont) {
            token = nextCont.token;
            pollDelayMs = nextCont.delayMs;
          } else {
            const refreshed = await this.bootstrapLiveChatContinuationAsync(
              videoId,
              apiKey,
              clientVersion,
              signal
            );
            token = refreshed?.continuation || null;
            isInitialReloadBatch = true;
            pollDelayMs = 2500;
          }
        } catch (err: any) {
          if (err?.name === 'AbortError' || signal.aborted) break;
          consecutiveErrors++;
          pollDelayMs = Math.min(5000, 2000 * consecutiveErrors);
          if (consecutiveErrors >= 3) {
            const refreshed = await this.bootstrapLiveChatContinuationAsync(
              videoId,
              apiKey,
              clientVersion,
              signal
            );
            if (refreshed?.continuation) {
              token = refreshed.continuation;
              isInitialReloadBatch = true;
              consecutiveErrors = 0;
            }
          }
        }

        await this.sleepWithAbortAsync(pollDelayMs, signal);
      }
    } finally {
      if (this.pollingVideoId === videoId) {
        this.isPollingActive = false;
      }
    }
  }

  private schedulePacedComments(comments: CommentData[], videoId: string) {
    if (comments.length === 0) return;
    if (comments.length === 1) {
      this.emitDeduplicatedLiveComments(comments);
      return;
    }

    const stepMs = Math.min(250, Math.max(35, Math.floor(1650 / comments.length)));
    comments.forEach((comment, index) => {
      if (index === 0) {
        this.emitDeduplicatedLiveComments([comment]);
        return;
      }
      const timerId = window.setTimeout(() => {
        const idx = this.pacingTimers.indexOf(timerId);
        if (idx !== -1) this.pacingTimers.splice(idx, 1);
        if (this.isDestroyed || this.getVideoId() !== videoId) return;
        if (this.isLiveChatEnabledCallback && !this.isLiveChatEnabledCallback()) return;
        this.emitDeduplicatedLiveComments([comment]);
      }, index * stepMs);
      this.pacingTimers.push(timerId);
    });
  }

  private isDuplicateLiveComment(comment: CommentData): boolean {
    if (comment.id && this.seenLiveCommentIds.has(comment.id)) {
      return true;
    }
    const sig = `${comment.authorName}:::${comment.rawText}`;
    const lastSeen = this.recentCommentSignatures.get(sig);
    if (lastSeen && Date.now() - lastSeen < 12000) {
      return true;
    }
    return false;
  }

  private markCommentAsSeen(comment: CommentData) {
    const now = Date.now();
    if (comment.id) {
      this.seenLiveCommentIds.add(comment.id);
      if (this.seenLiveCommentIds.size > 4000) {
        const first = this.seenLiveCommentIds.values().next().value;
        if (first) this.seenLiveCommentIds.delete(first);
      }
    }
    const sig = `${comment.authorName}:::${comment.rawText}`;
    this.recentCommentSignatures.set(sig, now);
    if (this.recentCommentSignatures.size > 1000) {
      const cutoff = now - 15000;
      for (const [k, t] of this.recentCommentSignatures.entries()) {
        if (t < cutoff) this.recentCommentSignatures.delete(k);
      }
    }
  }

  private emitDeduplicatedLiveComments(comments: CommentData[]) {
    if (this.isDestroyed || !this.onNewCommentsCallback) return;
    if (this.isLiveChatEnabledCallback && !this.isLiveChatEnabledCallback()) return;

    const fresh: CommentData[] = [];
    for (const c of comments) {
      if (!this.isDuplicateLiveComment(c)) {
        this.markCommentAsSeen(c);
        fresh.push(c);
      }
    }

    if (fresh.length > 0) {
      this.hasEmittedAnyForCurrentVideo = true;
      this.onNewCommentsCallback(fresh);
    }
  }

  private async resolveInnertubeCredentialsAsync(
    videoId: string,
    signal: AbortSignal
  ): Promise<{ apiKey: string; clientVersion: string } | null> {
    const fromFetcher = this.commentFetcher.getInnertubeCredentials();
    if (fromFetcher?.apiKey) {
      return {
        apiKey: fromFetcher.apiKey,
        clientVersion: fromFetcher.clientVersion || '2.20261020.05.00',
      };
    }

    const scripts = document.querySelectorAll('script');
    for (const s of Array.from(scripts)) {
      const txt = s.textContent || '';
      if (txt.includes('INNERTUBE_API_KEY')) {
        const keyMatch = txt.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
        const verMatch = txt.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/);
        if (keyMatch?.[1]) {
          return {
            apiKey: keyMatch[1],
            clientVersion: verMatch?.[1] || '2.20261020.05.00',
          };
        }
      }
    }

    try {
      const res = await fetch(
        `https://www.youtube.com/live_chat?is_popout=1&v=${encodeURIComponent(videoId)}`,
        { credentials: 'omit', signal }
      );
      if (res.ok) {
        const html = await res.text();
        const keyMatch = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
        const verMatch = html.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/);
        if (keyMatch?.[1]) {
          return {
            apiKey: keyMatch[1],
            clientVersion: verMatch?.[1] || '2.20261020.05.00',
          };
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  private async bootstrapLiveChatContinuationAsync(
    videoId: string,
    apiKey: string,
    clientVersion: string,
    signal: AbortSignal
  ): Promise<{
    continuation: string;
    isReloadToken: boolean;
    isAllChat: boolean;
    useSameOriginAuth: boolean;
  } | null> {
    for (const useSameOriginAuth of [false, true]) {
      try {
        const nextUrl = `https://www.youtube.com/youtubei/v1/next?key=${encodeURIComponent(
          apiKey
        )}&prettyPrint=false`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-YouTube-Client-Name': '1',
          'X-YouTube-Client-Version': clientVersion,
        };

        if (useSameOriginAuth) {
          const sapisidHeader = await this.buildSapisidHashHeaderAsync();
          if (sapisidHeader) {
            headers['Authorization'] = sapisidHeader;
            headers['X-Origin'] = window.location.origin;
            headers['X-Goog-AuthUser'] = '0';
          }
        }

        const res = await fetch(nextUrl, {
          method: 'POST',
          headers,
          credentials: useSameOriginAuth ? 'same-origin' : 'omit',
          body: JSON.stringify({
            context: {
              client: {
                hl: navigator.language || 'ja',
                gl: 'JP',
                clientName: 'WEB',
                clientVersion,
              },
            },
            videoId,
          }),
          signal,
        });

        if (res.ok) {
          const nextJson = await res.json();
          const lcr = this.findLiveChatRenderer(nextJson);
          if (lcr) {
            const isReplay = Boolean(lcr.isReplay);
            const isLiveViewCount = this.checkIsLiveViewCount(nextJson);
            if (isReplay && !isLiveViewCount && !this.isLiveStream()) {
              return null;
            }

            const cont = this.extractNextContinuation(lcr.continuations);
            if (cont?.token) {
              return {
                continuation: cont.token,
                isReloadToken: true,
                isAllChat: false,
                useSameOriginAuth,
              };
            }
          } else if (!useSameOriginAuth && !this.isLiveStream()) {
            return null;
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal.aborted) return null;
      }
    }

    for (const useSameOriginAuth of [false, true]) {
      try {
        const popRes = await fetch(
          `https://www.youtube.com/live_chat?is_popout=1&v=${encodeURIComponent(videoId)}`,
          {
            credentials: useSameOriginAuth ? 'same-origin' : 'omit',
            signal,
          }
        );
        if (!popRes.ok) continue;
        const html = await popRes.text();
        const match =
          html.match(/window\["ytInitialData"\]\s*=\s*(\{.+?\});\s*<\/script>/s) ||
          html.match(/var ytInitialData\s*=\s*(\{.+?\});<\/script>/s);
        if (!match?.[1]) continue;

        const popData = JSON.parse(match[1]);
        const popLcr = this.findLiveChatRenderer(popData);
        if (!popLcr) continue;

        if (Array.isArray(popLcr.actions)) {
          for (const act of popLcr.actions) {
            const parsed = this.parseLiveChatAction(act, videoId);
            if (parsed) this.markCommentAsSeen(parsed);
          }
        }

        const allChatToken = this.extractAllChatContinuationFromHeader(popLcr.header);
        if (allChatToken && allChatToken.length > 80) {
          return {
            continuation: allChatToken,
            isReloadToken: true,
            isAllChat: true,
            useSameOriginAuth,
          };
        }

        const cont = this.extractNextContinuation(popLcr.continuations);
        if (cont?.token) {
          return {
            continuation: cont.token,
            isReloadToken: false,
            isAllChat: false,
            useSameOriginAuth,
          };
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal.aborted) return null;
      }
    }

    return null;
  }

  private findLiveChatRenderer(data: any): any | null {
    if (!data || typeof data !== 'object') return null;

    const direct =
      data?.contents?.twoColumnWatchNextResults?.conversationBar?.liveChatRenderer ||
      data?.contents?.liveChatRenderer ||
      data?.continuationContents?.liveChatContinuation;
    if (direct && typeof direct === 'object') return direct;

    let found: any = null;
    const walk = (node: any, depth: number) => {
      if (!node || typeof node !== 'object' || found || depth > 8) return;
      if (node.liveChatRenderer && typeof node.liveChatRenderer === 'object') {
        found = node.liveChatRenderer;
        return;
      }
      for (const k of Object.keys(node)) {
        if (k === 'secondaryResults' || k === 'relatedVideos' || k === 'playerOverlays') continue;
        walk(node[k], depth + 1);
        if (found) return;
      }
    };
    walk(data, 0);
    return found;
  }

  private checkIsLiveViewCount(nextJson: any): boolean {
    try {
      const contents =
        nextJson?.contents?.twoColumnWatchNextResults?.results?.results?.contents;
      if (Array.isArray(contents)) {
        for (const c of contents) {
          if (c?.videoPrimaryInfoRenderer?.viewCount?.videoViewCountRenderer?.isLive === true) {
            return true;
          }
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  private extractAllChatContinuationFromHeader(header: any): string | null {
    const items =
      header?.liveChatHeaderRenderer?.viewSelector?.sortFilterSubMenuRenderer?.subMenuItems;
    if (!Array.isArray(items) || items.length < 2) return null;
    const allChatItem = items[1];
    const token =
      allChatItem?.continuation?.reloadContinuationData?.continuation ||
      allChatItem?.continuation?.timedContinuationData?.continuation ||
      allChatItem?.continuation?.invalidationContinuationData?.continuation;
    return typeof token === 'string' ? token : null;
  }

  private extractNextContinuation(
    continuations: any
  ): { token: string; delayMs: number } | null {
    if (!Array.isArray(continuations)) return null;
    for (const c of continuations) {
      if (c?.invalidationContinuationData?.continuation) {
        return {
          token: c.invalidationContinuationData.continuation,
          delayMs: 1800,
        };
      }
      if (c?.timedContinuationData?.continuation) {
        const timeout = Number(c.timedContinuationData.timeoutMs) || 1800;
        return {
          token: c.timedContinuationData.continuation,
          delayMs: Math.min(Math.max(timeout, 1200), 2500),
        };
      }
      if (c?.reloadContinuationData?.continuation) {
        return {
          token: c.reloadContinuationData.continuation,
          delayMs: 1800,
        };
      }
    }
    return null;
  }

  private async buildSapisidHashHeaderAsync(): Promise<string | null> {
    try {
      const cookieStr = document.cookie || '';
      const match =
        cookieStr.match(/(?:^|;\s*)__Secure-3PAPISID=([^;]+)/) ||
        cookieStr.match(/(?:^|;\s*)SAPISID=([^;]+)/) ||
        cookieStr.match(/(?:^|;\s*)__Secure-1PAPISID=([^;]+)/);
      if (!match?.[1] || !crypto?.subtle) return null;

      const sapisid = match[1];
      const origin = window.location.origin || 'https://www.youtube.com';
      const timestamp = Math.floor(Date.now() / 1000);
      const input = `${timestamp} ${sapisid} ${origin}`;
      const encoded = new TextEncoder().encode(input);
      const hashBuffer = await crypto.subtle.digest('SHA-1', encoded);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `SAPISIDHASH ${timestamp}_${hashHex}`;
    } catch {
      return null;
    }
  }

  private sleepWithAbortAsync(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const timer = window.setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        window.clearTimeout(timer);
        resolve();
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private argbToHex(argb: unknown): string | undefined {
    if (typeof argb !== 'number') return undefined;
    return '#' + (argb & 0xffffff).toString(16).padStart(6, '0');
  }

  private parseRunsToTokensAndEmotes(runs: any): {
    rawText: string;
    tokens: MessageToken[];
    emotes: EmoteItem[];
  } {
    const tokens: MessageToken[] = [];
    const emotes: EmoteItem[] = [];
    let rawText = '';

    if (!Array.isArray(runs)) return { rawText, tokens, emotes };

    for (const run of runs) {
      if (typeof run?.text === 'string' && run.text) {
        rawText += run.text;
        tokens.push({ type: 'text', text: run.text });
      } else if (run?.emoji) {
        const emoji = run.emoji;
        const thumbs = emoji.image?.thumbnails;
        const url =
          Array.isArray(thumbs) && thumbs.length > 0
            ? thumbs[thumbs.length - 1]?.url || ''
            : '';
        const alt =
          emoji.shortcuts?.[0] ||
          emoji.image?.accessibility?.accessibilityData?.label ||
          emoji.emojiId ||
          ':emoji:';
        if (url) {
          const start = rawText.length;
          rawText += alt;
          const end = rawText.length - 1;
          emotes.push({ name: alt, url, startIndex: start, endIndex: end });
          tokens.push({ type: 'emote', url, alt, text: alt });
        } else {
          rawText += alt;
          tokens.push({ type: 'text', text: alt });
        }
      }
    }

    return { rawText, tokens, emotes };
  }

  private parseLiveChatAction(action: any, videoId: string): CommentData | null {
    try {
      const item =
        action?.addChatItemAction?.item ||
        action?.addLiveChatTickerItemAction?.item?.liveChatTickerSponsorItemRenderer
          ?.showItemEndpoint?.showLiveChatItemEndpoint?.renderer ||
        action?.addLiveChatTickerItemAction?.item?.liveChatTickerPaidMessageItemRenderer
          ?.showItemEndpoint?.showLiveChatItemEndpoint?.renderer;
      if (!item || typeof item !== 'object') return null;

      const textRenderer = item.liveChatTextMessageRenderer;
      const paidRenderer = item.liveChatPaidMessageRenderer;
      const memberRenderer = item.liveChatMembershipItemRenderer;
      const stickerRenderer = item.liveChatPaidStickerRenderer;

      const renderer = textRenderer || paidRenderer || memberRenderer || stickerRenderer;
      if (!renderer) return null;

      const id =
        renderer.id ||
        action?.addChatItemAction?.clientId ||
        `yt_live_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const authorName =
        renderer.authorName?.simpleText ||
        renderer.authorName?.runs?.map((r: any) => r.text).join('') ||
        'ユーザー';

      const photoThumbs = renderer.authorPhoto?.thumbnails;
      const authorAvatarUrl =
        Array.isArray(photoThumbs) && photoThumbs.length > 0
          ? photoThumbs[photoThumbs.length - 1]?.url || ''
          : '';

      let { rawText, tokens, emotes } = this.parseRunsToTokensAndEmotes(renderer.message?.runs);

      let isSuperChat = false;
      let superChatAmount: string | undefined;
      let superChatColor: string | undefined;

      if (paidRenderer) {
        isSuperChat = true;
        superChatAmount =
          paidRenderer.purchaseAmountText?.simpleText ||
          paidRenderer.purchaseAmountText?.runs?.map((r: any) => r.text).join('') ||
          'Super Chat';
        superChatColor =
          this.argbToHex(paidRenderer.headerBackgroundColor) ||
          this.argbToHex(paidRenderer.bodyBackgroundColor) ||
          '#ff8f00';
      } else if (memberRenderer) {
        isSuperChat = true;
        superChatAmount =
          memberRenderer.headerPrimaryText?.runs?.map((r: any) => r.text).join('') ||
          memberRenderer.headerSubtext?.simpleText ||
          memberRenderer.headerSubtext?.runs?.map((r: any) => r.text).join('') ||
          'メンバーシップ';
        superChatColor = '#0f9d58';
        if (!rawText) {
          const subRuns =
            memberRenderer.headerSubtext?.runs || memberRenderer.headerPrimaryText?.runs;
          if (subRuns) {
            const subParsed = this.parseRunsToTokensAndEmotes(subRuns);
            rawText = subParsed.rawText;
            tokens = subParsed.tokens;
            emotes = subParsed.emotes;
          } else {
            rawText = memberRenderer.headerSubtext?.simpleText || 'メンバーへようこそ！';
            tokens = [{ type: 'text', text: rawText }];
          }
        }
      } else if (stickerRenderer) {
        isSuperChat = true;
        superChatAmount =
          stickerRenderer.purchaseAmountText?.simpleText ||
          stickerRenderer.purchaseAmountText?.runs?.map((r: any) => r.text).join('') ||
          'Super Sticker';
        superChatColor = this.argbToHex(stickerRenderer.backgroundColor) || '#ff8f00';
        const stickerThumbs = stickerRenderer.sticker?.thumbnails;
        const stickerUrl =
          Array.isArray(stickerThumbs) && stickerThumbs.length > 0
            ? stickerThumbs[stickerThumbs.length - 1]?.url || ''
            : '';
        const stickerAlt =
          stickerRenderer.sticker?.accessibility?.accessibilityData?.label || 'Super Sticker';
        rawText = stickerAlt;
        if (stickerUrl) {
          emotes = [
            { name: stickerAlt, url: stickerUrl, startIndex: 0, endIndex: stickerAlt.length - 1 },
          ];
          tokens = [{ type: 'emote', url: stickerUrl, alt: stickerAlt, text: stickerAlt }];
        } else {
          tokens = [{ type: 'text', text: stickerAlt }];
        }
      }

      if (!rawText && !isSuperChat) return null;

      const badges: string[] = [];
      let userColor = '';
      if (Array.isArray(renderer.authorBadges)) {
        for (const b of renderer.authorBadges) {
          const br = b?.liveChatAuthorBadgeRenderer;
          if (!br) continue;
          const cThumbs = br.customThumbnail?.thumbnails;
          const customUrl =
            Array.isArray(cThumbs) && cThumbs.length > 0
              ? cThumbs[cThumbs.length - 1]?.url || ''
              : '';
          const iconType = (br.icon?.iconType || '').toUpperCase();
          const tooltip = br.tooltip || br.accessibility?.accessibilityData?.label || '';

          if (customUrl && customUrl.startsWith('http')) {
            badges.push(customUrl);
            if (!userColor) userColor = '#2ba640';
          } else if (
            iconType === 'MODERATOR' ||
            tooltip.includes('モデレーター') ||
            tooltip.includes('Moderator')
          ) {
            badges.push('moderator');
            userColor = '#5e84f1';
          } else if (
            iconType === 'OWNER' ||
            tooltip.includes('オーナー') ||
            tooltip.includes('Owner')
          ) {
            badges.push('broadcaster');
            userColor = '#ffd600';
          } else if (
            iconType === 'VERIFIED' ||
            tooltip.includes('確認済み') ||
            tooltip.includes('Verified')
          ) {
            badges.push('verified');
          } else if (tooltip.includes('メンバー') || tooltip.includes('Member')) {
            badges.push('subscriber');
            if (!userColor) userColor = '#2ba640';
          }
        }
      }

      return {
        id,
        authorName,
        authorAvatarUrl,
        contentHtml: rawText.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        rawText,
        likeCount: isSuperChat ? 100 : 0,
        formattedLikeCount: isSuperChat ? superChatAmount || '' : '',
        publishedTimeText: '今',
        timestamps: [{ seconds: 0, formatted: 'Live' }],
        videoId,
        platform: 'youtube',
        sourcePlatform: 'youtube',
        source: 'live_chat',
        userColor: userColor || undefined,
        badges: badges.length > 0 ? badges : undefined,
        emotes: emotes.length > 0 ? emotes : undefined,
        tokens: tokens.length > 0 ? tokens : undefined,
        isSuperChat,
        superChatAmount,
        superChatColor,
      };
    } catch {
      return null;
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
        attributeFilter: [
          'collapsed',
          'hidden',
          'theater',
          'full-bleed-player',
          'fixed-panels',
          'panels-beside-player',
          'squeezeback',
          'engagement-panel-expanded',
          'playlist-panel-expanded',
          'visibility',
        ],
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
      if (Array.isArray(comments) && comments.length > 0) {
        const currentVid = this.getVideoId();
        if (currentVid) {
          this.knownLiveVideoIds.add(currentVid);
        }
        this.emitDeduplicatedLiveComments(comments);
      }
    };

    window.addEventListener('message', this.messageListener);
  }
}
