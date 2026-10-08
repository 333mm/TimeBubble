import { OverlayUi } from '../overlayUi';

export class PipController {
  private static instance: PipController | null = null;
  private isCanvasPipActive = false;
  private canvasEl: HTMLCanvasElement | null = null;
  private pipVideoEl: HTMLVideoElement | null = null;
  private animFrameId: number | null = null;

  public static getInstance(): PipController {
    if (!this.instance) {
      this.instance = new PipController();
    }
    return this.instance;
  }

  /**
   * PiP が現在アクティブかどうか
   */
  public isPipActive(): boolean {
    return this.isCanvasPipActive;
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
   * ネイティブ PiP 開始 (Canvas 合成: タイトルバーなし・アスペクト比完全固定)
   */
  public async enterPiP(video: HTMLVideoElement, overlayUi: OverlayUi): Promise<boolean> {
    const success = await this.enterCanvasPiP(video, overlayUi);
    overlayUi.updateQuickActions();
    return success;
  }

  /**
   * Canvas 合成 PiP (タイトルバーなし・比率固定のネイティブ PiP)
   */
  private async enterCanvasPiP(video: HTMLVideoElement, overlayUi: OverlayUi): Promise<boolean> {
    try {
      let width = video.videoWidth || 1280;
      let height = video.videoHeight || 720;
      // テキストを高精細に描画するため、アスペクト比を維持しつつ十分なキャンバス解像度を確保
      if (width < 1280 && video.videoHeight && video.videoWidth) {
        const scale = 1280 / width;
        width = 1280;
        height = Math.round(video.videoHeight * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      this.canvasEl = canvas;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return false;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

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
      pipVideo.playsInline = true;
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
    const doc = _overlayUi.getContainerElement()?.ownerDocument || document;

    // 1. 流れるコメントの描画 (.yt-co-flow-comment)
    const flowElements = doc.querySelectorAll<HTMLElement>('.yt-co-flow-comment');
    if (flowElements.length > 0) {
      ctx.save();
      const fontSize = Math.max(16, Math.round(h * 0.052));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = 'top';

      flowElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const parentRect = el.parentElement?.getBoundingClientRect();
        if (parentRect && parentRect.width > 0 && parentRect.height > 0) {
          const relX = ((rect.left - parentRect.left) / parentRect.width) * w;
          const relY = ((rect.top - parentRect.top) / parentRect.height) * h;
          const textEl = el.querySelector<HTMLElement>('.yt-co-flow-text');
          const text = textEl?.textContent || el.textContent || '';
          const textColor = textEl?.style?.color || '#ffffff';

          // テキスト縁取り (黒)
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.16));
          ctx.strokeText(text, relX, relY);

          // テキスト本体 (ユーザーカラーまたは白)
          ctx.fillStyle = textColor;
          ctx.fillText(text, relX, relY);
        }
      });
      ctx.restore();
    }

    // 2. カードコメントの描画 (.yt-co-bubble)
    const cards = doc.querySelectorAll<HTMLElement>('.yt-co-bubble');
    if (cards.length > 0) {
      ctx.save();
      const cardHeight = Math.round(h * 0.22);
      const cardWidth = Math.round(w * 0.42);
      let cardY = 16;

      cards.forEach((card) => {
        const text = card.querySelector('.yt-co-content')?.textContent || '';
        const authorEl = card.querySelector<HTMLElement>('.yt-co-author');
        const author = authorEl?.textContent || '';
        const authorColor = authorEl?.style?.color || '#818cf8';
        const cardX = w - cardWidth - 16;

        // 半透明背景
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 10);
        } else {
          ctx.rect(cardX, cardY, cardWidth, cardHeight);
        }
        ctx.fill();

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 投稿者名
        ctx.fillStyle = authorColor;
        ctx.font = `bold ${Math.max(12, Math.round(h * 0.035))}px sans-serif`;
        ctx.fillText(author, cardX + 12, cardY + 22);

        // 本文
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(11, Math.round(h * 0.032))}px sans-serif`;
        ctx.fillText(text.slice(0, 32), cardX + 12, cardY + 46);

        cardY += cardHeight + 10;
      });
      ctx.restore();
    }

    // 3. チャットボックスの描画 (.yt-co-chatbox-item)
    const chatItems = doc.querySelectorAll<HTMLElement>('.yt-co-chatbox-item');
    if (chatItems.length > 0) {
      ctx.save();
      const chatWidth = Math.round(w * 0.45);
      const itemHeight = Math.max(22, Math.round(h * 0.055));
      let currentY = h - 20 - chatItems.length * itemHeight;

      chatItems.forEach((item) => {
        const authorEl = item.querySelector<HTMLElement>('.yt-co-chatbox-author');
        const textEl = item.querySelector<HTMLElement>('.yt-co-chatbox-text');
        const author = authorEl?.textContent || '';
        const text = textEl?.textContent || '';
        const authorColor = authorEl?.style?.color || '#c7d2fe';
        const chatX = w - chatWidth - 16;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(chatX, currentY, chatWidth, itemHeight);

        ctx.fillStyle = authorColor;
        ctx.font = `bold ${Math.max(11, Math.round(h * 0.03))}px sans-serif`;
        ctx.fillText(author, chatX + 6, currentY + 16);

        const authorWidth = ctx.measureText(author).width;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(11, Math.round(h * 0.03))}px sans-serif`;
        ctx.fillText(text.slice(0, 28), chatX + 8 + authorWidth, currentY + 16);

        currentY += itemHeight;
      });
      ctx.restore();
    }
  }

  /**
   * PiP 終了
   */
  public async exitPiP(_video: HTMLVideoElement): Promise<void> {
    if (this.isCanvasPipActive) {
      if (document.pictureInPictureElement) {
        try {
          await document.exitPictureInPicture();
        } catch { /* ignore */ }
      }
      this.stopCanvasPip();
    }
  }
}
