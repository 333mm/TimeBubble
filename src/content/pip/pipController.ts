import { OverlayUi } from '../overlayUi';

export class PipController {
  private static instance: PipController | null = null;
  private pipWindow: Window | null = null;
  private isNativePipActive = false;
  private originalVideoParent: HTMLElement | null = null;
  private originalVideoNextSibling: Node | null = null;
  private originalPlayerElement: HTMLElement | null = null;
  private placeholderEl: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  public static getInstance(): PipController {
    if (!this.instance) {
      this.instance = new PipController();
    }
    return this.instance;
  }

  /**
   * ブラウザが Document Picture-in-Picture API をサポートしているか
   */
  public isDocumentPipSupported(): boolean {
    return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  }

  /**
   * PiP が現在アクティブかどうか
   */
  public isPipActive(): boolean {
    return !!this.pipWindow || this.isNativePipActive;
  }

  /**
   * PiP の開始/終了を切り替え
   */
  public async togglePiP(video: HTMLVideoElement, overlayUi: OverlayUi): Promise<boolean> {
    let result = false;
    if (this.isPipActive()) {
      await this.exitPiP(video);
      result = false;
    } else {
      result = await this.enterPiP(video, overlayUi);
    }
    overlayUi.updateQuickActions();
    return result;
  }

  /**
   * PiP 開始（Document PiP / インタラクティブ形式）
   */
  public async enterPiP(video: HTMLVideoElement, overlayUi: OverlayUi): Promise<boolean> {
    let success = false;
    if (this.isDocumentPipSupported()) {
      success = await this.enterDocumentPiP(video, overlayUi);
    } else if (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function') {
      try {
        await video.requestPictureInPicture();
        this.isNativePipActive = true;
        video.addEventListener(
          'leavepictureinpicture',
          () => {
            this.isNativePipActive = false;
            overlayUi.updateQuickActions();
          },
          { once: true }
        );
        success = true;
      } catch (err) {
        console.warn('[TimeBubble:PiP] Standard video PiP fallback failed:', err);
      }
    }
    overlayUi.updateQuickActions();
    return success;
  }

  /**
   * Document Picture-in-Picture (フルインタラクティブ形式)
   */
  private async enterDocumentPiP(video: HTMLVideoElement, overlayUi: OverlayUi): Promise<boolean> {
    try {
      const width = Math.min(Math.max(video.videoWidth || 800, 480), 1280);
      const height = Math.min(Math.max(video.videoHeight || 450, 270), 720);

      const docPip = (window as any).documentPictureInPicture;
      const pipWin: Window = await docPip.requestWindow({
        width,
        height,
      });

      this.pipWindow = pipWin;

      // 1. TimeBubble 全体スタイルの注入 (overlay.css)
      const baseStyle = pipWin.document.createElement('style');
      baseStyle.id = 'yt-comment-overlay-styles';
      baseStyle.textContent = overlayUi.getCssRaw();
      pipWin.document.head.appendChild(baseStyle);

      // 2. 親ドキュメントの既存スタイルシートの同期コピー
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
        try {
          if (el.id !== 'yt-comment-overlay-styles') {
            pipWin.document.head.appendChild(el.cloneNode(true));
          }
        } catch {
          // ignore
        }
      });

      // 3. PiP ウィンドウ固有のリセット & オーバーレイスタイル
      const pipStyle = pipWin.document.createElement('style');
      pipStyle.textContent = `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: #000 !important;
          overflow: hidden !important;
          user-select: none !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        }
        .pip-player-wrapper {
          position: relative !important;
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          background: #000 !important;
          overflow: hidden !important;
        }
        .pip-player-wrapper video {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
          z-index: 1 !important;
        }
        #yt-comment-overlay-container {
          position: absolute !important;
          z-index: 2147483647 !important;
          pointer-events: none !important;
        }
        #yt-comment-overlay-container * {
          pointer-events: auto !important;
        }
        .yt-co-flow-comment {
          position: absolute !important;
          z-index: 2147483640 !important;
          white-space: nowrap !important;
        }
        .yt-co-chatbox-container {
          position: absolute !important;
          bottom: 10px !important;
          right: 10px !important;
          z-index: 2147483647 !important;
          max-width: 80% !important;
        }
      `;
      pipWin.document.head.appendChild(pipStyle);

      // 4. 元の位置とプレイヤー要素を退避
      this.originalVideoParent = video.parentElement;
      this.originalVideoNextSibling = video.nextSibling;
      this.originalPlayerElement = overlayUi.getPlayerElement() || video.parentElement;

      // 5. 元ページにプレースホルダーを挿入
      this.placeholderEl = document.createElement('div');
      this.placeholderEl.style.width = '100%';
      this.placeholderEl.style.height = '100%';
      this.placeholderEl.style.display = 'flex';
      this.placeholderEl.style.flexDirection = 'column';
      this.placeholderEl.style.alignItems = 'center';
      this.placeholderEl.style.justifyContent = 'center';
      this.placeholderEl.style.background = '#0a0a0f';
      this.placeholderEl.style.color = '#fff';
      this.placeholderEl.style.fontFamily = 'system-ui, sans-serif';

      const box = document.createElement('div');
      box.style.padding = '16px';
      box.style.textAlign = 'center';
      box.style.background = 'rgba(255,255,255,0.05)';
      box.style.borderRadius = '12px';
      box.style.backdropFilter = 'blur(10px)';
      box.style.border = '1px solid rgba(255,255,255,0.1)';

      const icon = document.createElement('div');
      icon.style.fontSize = '24px';
      icon.style.marginBottom = '8px';
      icon.textContent = '📺';
      box.appendChild(icon);

      const title = document.createElement('div');
      title.style.fontWeight = '600';
      title.style.fontSize = '14px';
      title.textContent = 'TimeBubble PiP 再生中';
      box.appendChild(title);

      const desc = document.createElement('div');
      desc.style.fontSize = '12px';
      desc.style.opacity = '0.7';
      desc.style.marginTop = '4px';
      desc.textContent = 'ミニウィンドウでコメント付き再生しています';
      box.appendChild(desc);

      this.placeholderEl.appendChild(box);

      if (this.originalVideoParent) {
        this.originalVideoParent.insertBefore(this.placeholderEl, this.originalVideoNextSibling);
      }

      // 6. PiP DOM を構築して動画を配置
      const wrapper = pipWin.document.createElement('div');
      wrapper.className = 'pip-player-wrapper';
      wrapper.appendChild(video);
      pipWin.document.body.appendChild(wrapper);

      // 7. オーバーレイUIを PiP のプレイヤーラッパーに再マウント！
      overlayUi.mount(wrapper);

      // 8. 動画再生の確実な継続
      if (!video.paused) {
        video.play().catch(() => {});
      }

      // 9. ウィンドウリサイズの追従（ResizeObserver）
      this.resizeObserver = new ResizeObserver(() => {
        if (overlayUi.getPlayerElement() === wrapper) {
          overlayUi.applySettingsToContainer();
        }
      });
      this.resizeObserver.observe(wrapper);

      // 10. 終了イベントリスナー（pagehide & unload）
      const onExit = () => {
        this.restoreFromDocumentPiP(video, overlayUi);
      };
      pipWin.addEventListener('pagehide', onExit);
      pipWin.addEventListener('unload', onExit);

      console.log('[TimeBubble:PiP] Document PiP started successfully');
      return true;
    } catch (err) {
      console.warn('[TimeBubble:PiP] Document PiP failed:', err);
      return false;
    }
  }

  private restoreFromDocumentPiP(video: HTMLVideoElement, overlayUi: OverlayUi) {
    if (!this.pipWindow && !this.originalVideoParent) return;
    this.pipWindow = null;

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.placeholderEl && this.placeholderEl.parentElement) {
      this.placeholderEl.remove();
      this.placeholderEl = null;
    }

    if (this.originalVideoParent) {
      this.originalVideoParent.insertBefore(video, this.originalVideoNextSibling);
      this.originalVideoParent = null;
      this.originalVideoNextSibling = null;
    }

    // 元のプレイヤー要素にオーバーレイUIを復帰マウント
    if (this.originalPlayerElement) {
      overlayUi.mount(this.originalPlayerElement);
      this.originalPlayerElement = null;
    }

    if (!video.paused) {
      video.play().catch(() => {});
    }

    overlayUi.updateQuickActions();
    console.log('[TimeBubble:PiP] Document PiP restored to main window');
  }

  /**
   * PiP 終了
   */
  public async exitPiP(_video: HTMLVideoElement): Promise<void> {
    if (this.pipWindow) {
      this.pipWindow.close();
      this.pipWindow = null;
    }
    if (this.isNativePipActive) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture().catch(() => {});
      }
      this.isNativePipActive = false;
    }
  }
}
