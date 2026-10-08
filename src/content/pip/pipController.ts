import { OverlayUi } from '../overlayUi';

export class PipController {
  private static instance: PipController | null = null;
  private pipWindow: Window | null = null;
  private isCanvasPipActive = false;
  private canvasEl: HTMLCanvasElement | null = null;
  private pipVideoEl: HTMLVideoElement | null = null;
  private animFrameId: number | null = null;
  private originalVideoParent: HTMLElement | null = null;
  private originalVideoNextSibling: Node | null = null;
  private originalOverlayParent: HTMLElement | null = null;
  private originalOverlayNextSibling: Node | null = null;
  private placeholderEl: HTMLElement | null = null;

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
    return !!this.pipWindow || this.isCanvasPipActive;
  }

  /**
   * PiP の開始/終了を切り替え
   */
  public async togglePiP(video: HTMLVideoElement, overlayUi: OverlayUi): Promise<boolean> {
    if (this.isPipActive()) {
      await this.exitPiP(video);
      return false;
    } else {
      return await this.enterPiP(video, overlayUi);
    }
  }

  /**
   * PiP 開始
   */
  public async enterPiP(video: HTMLVideoElement, overlayUi: OverlayUi): Promise<boolean> {
    if (this.isDocumentPipSupported()) {
      return await this.enterDocumentPiP(video, overlayUi);
    } else {
      return await this.enterCanvasPiP(video, overlayUi);
    }
  }

  /**
   * 1. Document Picture-in-Picture (Chrome, Edge 向け最高画質・フルインタラクティブ)
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

      // 1. スタイルシートの同期コピー
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
        try {
          pipWin.document.head.appendChild(el.cloneNode(true));
        } catch {
          // ignore
        }
      });

      // 2. PiP ウィンドウ固有のリセットスタイル
      const pipStyle = pipWin.document.createElement('style');
      pipStyle.textContent = `
        body {
          margin: 0;
          padding: 0;
          background: #000;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100vw;
          height: 100vh;
        }
        .pip-player-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
        }
        .pip-player-wrapper video {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .yt-comment-overlay-container {
          position: absolute !important;
          inset: 0 !important;
          pointer-events: none !important;
          z-index: 9999 !important;
        }
        .yt-comment-overlay-container * {
          pointer-events: auto !important;
        }
      `;
      pipWin.document.head.appendChild(pipStyle);

      // 3. 元の位置を記録
      this.originalVideoParent = video.parentElement;
      this.originalVideoNextSibling = video.nextSibling;

      const overlayContainer = overlayUi.getContainerElement();
      if (overlayContainer) {
        this.originalOverlayParent = overlayContainer.parentElement;
        this.originalOverlayNextSibling = overlayContainer.nextSibling;
      }

      // 4. 元ページにプレースホルダーを挿入
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

      // 5. PiP DOM を構築
      const wrapper = pipWin.document.createElement('div');
      wrapper.className = 'pip-player-wrapper';
      wrapper.appendChild(video);
      if (overlayContainer) {
        wrapper.appendChild(overlayContainer);
      }
      pipWin.document.body.appendChild(wrapper);

      // 6. 終了イベントリスナー
      pipWin.addEventListener('pagehide', () => {
        this.restoreFromDocumentPiP(video, overlayUi);
      });

      console.log('[TimeBubble:PiP] Document PiP started successfully');
      return true;
    } catch (err) {
      console.warn('[TimeBubble:PiP] Document PiP failed, falling back to Canvas PiP:', err);
      return await this.enterCanvasPiP(video, overlayUi);
    }
  }

  private restoreFromDocumentPiP(video: HTMLVideoElement, overlayUi: OverlayUi) {
    if (this.placeholderEl && this.placeholderEl.parentElement) {
      this.placeholderEl.remove();
      this.placeholderEl = null;
    }

    if (this.originalVideoParent) {
      this.originalVideoParent.insertBefore(video, this.originalVideoNextSibling);
      this.originalVideoParent = null;
      this.originalVideoNextSibling = null;
    }

    const overlayContainer = overlayUi.getContainerElement();
    if (overlayContainer && this.originalOverlayParent) {
      this.originalOverlayParent.insertBefore(overlayContainer, this.originalOverlayNextSibling);
      this.originalOverlayParent = null;
      this.originalOverlayNextSibling = null;
    }

    this.pipWindow = null;
    console.log('[TimeBubble:PiP] Document PiP restored to main window');
  }

  /**
   * 2. Canvas 合成 PiP (Firefox / フォールバック用)
   */
  private async enterCanvasPiP(video: HTMLVideoElement, overlayUi: OverlayUi): Promise<boolean> {
    try {
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 360;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      this.canvasEl = canvas;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      // レンダリングループ
      const render = () => {
        if (!this.isCanvasPipActive || !this.canvasEl) return;
        try {
          ctx.drawImage(video, 0, 0, width, height);

          // コメントのCanvas描画（アクティブカードまたは流れるコメント）
          this.drawCommentsOnCanvas(ctx, width, height, overlayUi);
        } catch {
          // ignore cross-origin error
        }
        this.animFrameId = requestAnimationFrame(render);
      };

      this.isCanvasPipActive = true;
      render();

      // captureStream から video を作成
      const stream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : null;
      if (!stream) {
        // captureStream未対応
        this.isCanvasPipActive = false;
        return false;
      }

      const pipVideo = document.createElement('video');
      pipVideo.srcObject = stream;
      pipVideo.muted = true;
      pipVideo.style.position = 'fixed';
      pipVideo.style.top = '-9999px';
      pipVideo.style.left = '-9999px';
      pipVideo.style.opacity = '0';
      document.body.appendChild(pipVideo);
      this.pipVideoEl = pipVideo;

      await pipVideo.play();
      await pipVideo.requestPictureInPicture();

      pipVideo.addEventListener('leavepictureinpicture', () => {
        this.stopCanvasPip();
      });

      console.log('[TimeBubble:PiP] Canvas PiP started successfully');
      return true;
    } catch (err) {
      console.warn('[TimeBubble:PiP] Canvas PiP failed:', err);
      this.stopCanvasPip();
      return false;
    }
  }

  private stopCanvasPip() {
    this.isCanvasPipActive = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.pipVideoEl) {
      this.pipVideoEl.remove();
      this.pipVideoEl = null;
    }
    this.canvasEl = null;
  }

  private drawCommentsOnCanvas(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    _overlayUi: OverlayUi
  ) {
    // 流れるコメントの描画 (DOM要素の位置をサンプリング)
    const flowElements = document.querySelectorAll<HTMLElement>('.yt-comment-flow-item');
    if (flowElements.length > 0) {
      ctx.save();
      ctx.font = `bold ${Math.round(h * 0.05)}px sans-serif`;
      ctx.textBaseline = 'top';

      flowElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const parentRect = el.parentElement?.getBoundingClientRect();
        if (parentRect) {
          const relX = (rect.left - parentRect.left) / parentRect.width * w;
          const relY = (rect.top - parentRect.top) / parentRect.height * h;
          const text = el.textContent || '';

          // テキスト縁取り (黒)
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 4;
          ctx.strokeText(text, relX, relY);

          // テキスト本体 (白)
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, relX, relY);
        }
      });
      ctx.restore();
    }

    // カードコメントの描画
    const cards = document.querySelectorAll<HTMLElement>('.yt-comment-card');
    if (cards.length > 0) {
      ctx.save();
      const cardHeight = Math.round(h * 0.2);
      const cardWidth = Math.round(w * 0.4);
      let cardY = 20;

      cards.forEach((card) => {
        const text = card.querySelector('.yt-comment-card-body')?.textContent || '';
        const author = card.querySelector('.yt-comment-card-author')?.textContent || '';
        const cardX = w - cardWidth - 20;

        // 半透明背景
        ctx.fillStyle = 'rgba(20, 20, 30, 0.75)';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 10);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 投稿者名
        ctx.fillStyle = '#67e8f9';
        ctx.font = `bold ${Math.round(h * 0.03)}px sans-serif`;
        ctx.fillText(author, cardX + 12, cardY + 22);

        // 本文
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(h * 0.028)}px sans-serif`;
        ctx.fillText(text.slice(0, 30), cardX + 12, cardY + 48);

        cardY += cardHeight + 10;
      });
      ctx.restore();
    }
  }

  /**
   * PiP 終了
   */
  public async exitPiP(_video: HTMLVideoElement): Promise<void> {
    if (this.pipWindow) {
      this.pipWindow.close();
      this.pipWindow = null;
    }
    if (this.isCanvasPipActive) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      this.stopCanvasPip();
    }
  }
}
