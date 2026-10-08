import { getSettings, onSettingsChange } from '../utils/storage';
import { CommentFetcher } from './commentFetcher';
import { OverlayUi } from './overlayUi';
import { PlayerSync } from './playerSync';
import { IPlatformAdapter } from './adapters/platformAdapter';
import { YouTubeAdapter } from './adapters/youtubeAdapter';
import { TwitchAdapter } from './adapters/twitchAdapter';
import { LiveChatForwarder } from './adapters/liveChatForwarder';
import { PipController } from './pip/pipController';

// ─── 0. YouTube LiveChat iframe 内の自動起動判定 ───
if (LiveChatForwarder.isLiveChatFrame()) {
  LiveChatForwarder.start();
} else {
  // ─── メインウィンドウでの TimeBubble アプリ起動 ───
  class TimeBubbleApp {
    private overlayUi = new OverlayUi();
    private commentFetcher = new CommentFetcher();
    private playerSync = new PlayerSync(this.overlayUi);
    private pipController = PipController.getInstance();
    private currentAdapter: IPlatformAdapter | null = null;
    private currentTargetId: string | null = null;
    private checkInterval: number | null = null;
    private isInitialized = false;

    public async start() {
      console.log('[TimeBubble] Content script starting on:', window.location.href);

      // 1. 設定読み込み
      try {
        const settings = await getSettings();
        this.overlayUi.init(settings);
      } catch (err) {
        console.warn('[TimeBubble] Error loading settings:', err);
      }

      // 2. 設定変更リスナー
      onSettingsChange((newSettings) => {
        this.overlayUi.updateSettings(newSettings);
      });

      // 3. PiP トグル連携
      this.overlayUi.setOnPipToggleCallback(async () => {
        const video = this.currentAdapter?.getVideoElement();
        if (video) {
          await this.pipController.togglePiP(video, this.overlayUi);
        }
      });

      // 4. プラットフォームアダプタの選定
      this.initAdapter();

      // 5. テストトリガー監視
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if ((area === 'local' || area === 'sync') && changes._test_trigger) {
            this.ensurePlayerAndShowTest();
          }
        });
      }

      window.addEventListener('YT_OVERLAY_TEST', () => {
        this.ensurePlayerAndShowTest();
      });

      // 6. ポップアップからの直接メッセージ
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
          if (message.type === 'UPDATE_SETTINGS') {
            this.overlayUi.updateSettings(message.settings);
            sendResponse({ success: true });
          } else if (message.type === 'SHOW_TEST_COMMENT') {
            if (message.settings) {
              this.overlayUi.updateSettings(message.settings);
            }
            this.ensurePlayerAndShowTest(message.testKind);
            sendResponse({ success: true });
          } else if (message.type === 'TOGGLE_PIP') {
            const video = this.currentAdapter?.getVideoElement();
            if (video) {
              this.pipController.togglePiP(video, this.overlayUi);
              sendResponse({ success: true, active: this.pipController.isPipActive() });
            }
          }
          return true;
        });
      }

      // 7. ページ遷移イベントの監視
      window.addEventListener('yt-navigate-finish', () => this.handlePageTransition());
      window.addEventListener('popstate', () => this.handlePageTransition());

      // 初回初期化
      this.handlePageTransition();

      // DOM変更監視 (プレイヤー遅延出現の追従)
      const targetNode = document.body || document.documentElement;
      if (targetNode) {
        const pageObserver = new MutationObserver(() => {
          if (!this.isInitialized && this.currentAdapter) {
            const video = this.currentAdapter.getVideoElement();
            const player = this.currentAdapter.getPlayerContainer();
            if (player && video) {
              this.setupPlayer(player, video);
            }
          }
        });
        pageObserver.observe(targetNode, { childList: true, subtree: true });
      }
    }

    private initAdapter() {
      if (this.currentAdapter) {
        this.currentAdapter.destroy();
        this.currentAdapter = null;
      }

      const host = window.location.hostname;
      if (host.includes('twitch.tv')) {
        console.log('[TimeBubble] Initializing TwitchAdapter');
        this.currentAdapter = new TwitchAdapter();
      } else {
        console.log('[TimeBubble] Initializing YouTubeAdapter');
        this.currentAdapter = new YouTubeAdapter(this.commentFetcher);
      }

      this.currentAdapter.init();

      // 新規コメント・チャット受信コールバック
      this.currentAdapter.setOnNewComments((comments) => {
        this.playerSync.addComments(comments);
      });
    }

    private ensurePlayerAndShowTest(testKind?: 'timestamp' | 'live') {
      if (!this.currentAdapter) this.initAdapter();
      const video = this.currentAdapter?.getVideoElement();
      const player = this.currentAdapter?.getPlayerContainer();
      if (player && video && !this.isInitialized) {
        this.setupPlayer(player, video);
      }
      this.overlayUi.showTestComment(testKind);
    }

    private handlePageTransition() {
      if (!this.currentAdapter) this.initAdapter();
      const targetId = this.currentAdapter?.getTargetId();

      if (targetId && targetId === this.currentTargetId && this.isInitialized) {
        return;
      }

      this.currentTargetId = targetId || 'current_video';
      this.playerSync.setVideoId(this.currentTargetId);
      this.commentFetcher.setVideoId(this.currentTargetId);
      this.cleanup();
      this.initVideoPage();
    }

    private initVideoPage() {
      this.isInitialized = false;
      let attempts = 0;
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }

      this.checkInterval = window.setInterval(() => {
        attempts++;
        if (!this.currentAdapter) this.initAdapter();
        const videoEl = this.currentAdapter?.getVideoElement();
        const playerEl = this.currentAdapter?.getPlayerContainer();

        if (playerEl && videoEl) {
          if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
          }
          this.setupPlayer(playerEl, videoEl);
        } else if (attempts > 80) {
          if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
          }
        }
      }, 250);
    }

    private setupPlayer(playerEl: HTMLElement, videoEl: HTMLVideoElement) {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      if (this.isInitialized) return;
      this.isInitialized = true;
      console.log('[TimeBubble] Setting up overlay on video player');

      this.playerSync.setVideoId(this.currentTargetId || '');
      this.commentFetcher.setVideoId(this.currentTargetId || '');

      // 返信フェッチコールバックを OverlayUi に接続
      this.overlayUi.setFetchRepliesCallback((comment) => this.commentFetcher.fetchRepliesAsync(comment));

      // オーバーレイUIのマウント
      this.overlayUi.mount(playerEl);

      // コントロールバーボタンのマウント (YouTube / Twitch)
      const controlsBar = this.currentAdapter?.getControlsBar();
      if (controlsBar) {
        this.overlayUi.mountPlayerControlsBar(controlsBar);
      }

      // 動画同期エンジンのアタッチ
      this.playerSync.attach(videoEl);

      // YouTube の場合は VOD コメント・チャプターフェッチャーの開始
      if (this.currentAdapter?.getPlatform() === 'youtube') {
        this.commentFetcher.start();
      }
    }

    public cleanup() {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      this.isInitialized = false;
      this.playerSync.detach();
      if (this.currentAdapter?.getPlatform() === 'youtube') {
        this.commentFetcher.stop();
      }
      this.overlayUi.clearAll();
    }
  }

  // 過去バージョンで付与されてしまった可能性のあるDOMスタイルを即座に修復
  function restoreCommentsDom() {
    try {
      const targets = document.querySelectorAll<HTMLElement>(
        'ytd-comments, #comments, ytd-continuation-item-renderer, #continuations'
      );
      targets.forEach((el) => {
        el.style.removeProperty('position');
        el.style.removeProperty('top');
        el.style.removeProperty('left');
        el.style.removeProperty('opacity');
        el.style.removeProperty('pointer-events');
        el.style.removeProperty('z-index');
      });
    } catch {
      // ignore
    }
  }
  restoreCommentsDom();

  const WIN_KEY = '__TIMEBUBBLE_APP__';
  const previousApp = (window as unknown as Record<string, unknown>)[WIN_KEY] as TimeBubbleApp | undefined;
  if (previousApp && typeof previousApp.cleanup === 'function') {
    try {
      previousApp.cleanup();
    } catch {
      // ignore
    }
  }

  const app = new TimeBubbleApp();
  (window as unknown as Record<string, unknown>)[WIN_KEY] = app;
  app.start();
}
