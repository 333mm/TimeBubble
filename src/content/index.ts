import { getSettings, onSettingsChange } from '../utils/storage';
import { CommentFetcher } from './commentFetcher';
import { OverlayUi } from './overlayUi';
import { PlayerSync } from './playerSync';

class YtCommentOverlayApp {
  private overlayUi = new OverlayUi();
  private commentFetcher = new CommentFetcher();
  private playerSync = new PlayerSync(this.overlayUi);
  private currentVideoId: string | null = null;
  private checkInterval: number | null = null;
  private isInitialized = false;

  public async start() {
    console.log('[YT-Comment-Overlay] Content script starting on:', window.location.href);

    // 1. 設定読み込み
    try {
      const settings = await getSettings();
      this.overlayUi.init(settings);
    } catch (err) {
      console.warn('[YT-Comment-Overlay] Error loading settings:', err);
    }

    // 2. 設定変更リスナー (storage.onChanged)
    onSettingsChange((newSettings) => {
      this.overlayUi.updateSettings(newSettings);
    });

    // 3. ストレージ経由のテストトリガー監視
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if ((area === 'local' || area === 'sync') && changes._test_trigger) {
          console.log('[YT-Comment-Overlay] Test trigger received from storage');
          this.ensurePlayerAndShowTest();
        }
      });
    }

    // 4. カスタムDOMイベント経由のテストトリガー監視
    window.addEventListener('YT_OVERLAY_TEST', () => {
      console.log('[YT-Comment-Overlay] Test trigger received from DOM event');
      this.ensurePlayerAndShowTest();
    });

    // 5. ポップアップからの直接メッセージ受信
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        console.log('[YT-Comment-Overlay] Message received:', message);
        if (message.type === 'UPDATE_SETTINGS') {
          this.overlayUi.updateSettings(message.settings);
          sendResponse({ success: true });
        } else if (message.type === 'SHOW_TEST_COMMENT') {
          if (message.settings) {
            this.overlayUi.updateSettings(message.settings);
          }
          this.ensurePlayerAndShowTest();
          sendResponse({ success: true });
        }
        return true;
      });
    }

    // 6. YouTube ページ遷移イベントの監視
    window.addEventListener('yt-navigate-finish', () => this.handlePageTransition());
    window.addEventListener('popstate', () => this.handlePageTransition());

    // 7. 新規コメント到着時のコールバック
    this.commentFetcher.setOnNewCommentsCallback((newComments) => {
      this.playerSync.addComments(newComments);
    });

    // 初回初期化
    this.handlePageTransition();

    // DOM変更を監視してプレイヤーが現れた場合にも追従
    const targetNode = document.body || document.documentElement;
    if (targetNode) {
      const pageObserver = new MutationObserver(() => {
        if (!this.isInitialized) {
          const video = document.querySelector<HTMLVideoElement>('video');
          const player = this.findPlayerElement(video);
          if (player && video) {
            this.setupPlayer(player, video);
          }
        }
      });
      pageObserver.observe(targetNode, { childList: true, subtree: true });
    }
  }

  private ensurePlayerAndShowTest() {
    const video = document.querySelector<HTMLVideoElement>('video');
    const player = this.findPlayerElement(video);
    if (player && video && !this.isInitialized) {
      this.setupPlayer(player, video);
    }
    this.overlayUi.showTestComment();
  }

  private handlePageTransition() {
    const videoId = this.getVideoIdFromUrl();

    if (videoId && videoId === this.currentVideoId && this.isInitialized) {
      return;
    }

    this.currentVideoId = videoId || 'current_video';
    this.playerSync.setVideoId(this.currentVideoId);
    this.commentFetcher.setVideoId(this.currentVideoId);
    this.cleanup();
    this.initVideoPage();
  }

  private getVideoIdFromUrl(): string | null {
    try {
      const url = new URL(window.location.href);
      const v = url.searchParams.get('v');
      if (v) return v;

      const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      if (shortsMatch) return shortsMatch[1];

      const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]+)/);
      if (embedMatch) return embedMatch[1];
    } catch {
      // ignore
    }
    return null;
  }

  private findPlayerElement(video: HTMLVideoElement | null): HTMLElement | null {
    if (video) {
      const moviePlayer = video.closest<HTMLElement>('#movie_player, .html5-video-player');
      if (moviePlayer) return moviePlayer;
      if (video.parentElement) return video.parentElement;
    }
    return document.querySelector<HTMLElement>('#movie_player, .html5-video-player, #player-container, #player');
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
      const videoEl = document.querySelector<HTMLVideoElement>('video');
      const playerEl = this.findPlayerElement(videoEl);

      // 両方が揃ったら初期化
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
    console.log('[YT-Comment-Overlay] Setting up overlay on video player');

    this.playerSync.setVideoId(this.currentVideoId || '');
    this.commentFetcher.setVideoId(this.currentVideoId || '');

    // オーバーレイUIのマウント
    this.overlayUi.mount(playerEl);

    // 動画同期エンジンのアタッチ
    this.playerSync.attach(videoEl);

    // コメント・チャプターフェッチャーの開始
    this.commentFetcher.start();
  }

  public cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isInitialized = false;
    this.playerSync.detach();
    this.commentFetcher.stop();
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

// 起動 (安全なホットリプレイスメント: 過去インスタンスがあれば破棄し、最新スクリプトを確実に起動)
const WIN_KEY = '__YT_COMMENT_OVERLAY_APP__';

const previousApp = (window as unknown as Record<string, unknown>)[WIN_KEY] as YtCommentOverlayApp | undefined;
if (previousApp && typeof previousApp.cleanup === 'function') {
  try {
    console.log('[YT-Comment-Overlay] Cleaning up previous app instance...');
    previousApp.cleanup();
  } catch {
    // ignore
  }
}

const app = new YtCommentOverlayApp();
(window as unknown as Record<string, unknown>)[WIN_KEY] = app;
app.start();
