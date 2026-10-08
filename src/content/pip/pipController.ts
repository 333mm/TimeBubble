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
   * ブラウザ標準PiPが起動された場合にDocument PiPへシームレスに誘導・切り替えるリスナーを設置
   */
  public setupNativePipListener(video: HTMLVideoElement, overlayUi: OverlayUi) {
    video.addEventListener('enterpictureinpicture', async () => {
      // 拡張機能自身の canvas ピクチャーインピクチャーの場合は何もしない
      if (this.pipVideoEl === video) return;
      if (this.isPipActive()) return;

      console.log('[TimeBubble:PiP] Standard native PiP detected. Upgrading to interactive comment-enabled PiP...');
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        }
        await this.enterPiP(video, overlayUi);
      } catch (e) {
        console.warn('[TimeBubble:PiP] Auto-upgrade from standard PiP failed:', e);
      }
    });
  }

  /**
   * PiP 開始
   */
  public async enterPiP(video: HTMLVideoElement, overlayUi: OverlayUi): Promise<boolean> {
    let success = false;
    if (this.isDocumentPipSupported()) {
      success = await this.enterDocumentPiP(video, overlayUi);
    } else {
      success = await this.enterCanvasPiP(video, overlayUi);
    }
    overlayUi.updateQuickActions();
    return success;
  }

  private originalPlayerElement: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

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
      // Flexbox による中央揃えの副作用を排除し、通常プレイヤーと同様の position: relative ブロックに設計
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
      console.warn('[TimeBubble:PiP] Document PiP failed, falling back to Canvas PiP:', err);
      return await this.enterCanvasPiP(video, overlayUi);
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
    const doc = _overlayUi.getContainerElement()?.ownerDocument || document;

    // 1. 流れるコメントの描画 (.yt-co-flow-comment)
    const flowElements = doc.querySelectorAll<HTMLElement>('.yt-co-flow-comment');
    if (flowElements.length > 0) {
      ctx.save();
      const fontSize = Math.max(14, Math.round(h * 0.055));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = 'top';

      flowElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const parentRect = el.parentElement?.getBoundingClientRect();
        if (parentRect && parentRect.width > 0 && parentRect.height > 0) {
          const relX = ((rect.left - parentRect.left) / parentRect.width) * w;
          const relY = ((rect.top - parentRect.top) / parentRect.height) * h;
          const textEl = el.querySelector('.yt-co-flow-text');
          const text = textEl?.textContent || el.textContent || '';

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

    // 2. カードコメントの描画 (.yt-co-bubble)
    const cards = doc.querySelectorAll<HTMLElement>('.yt-co-bubble');
    if (cards.length > 0) {
      ctx.save();
      const cardHeight = Math.round(h * 0.22);
      const cardWidth = Math.round(w * 0.42);
      let cardY = 16;

      cards.forEach((card) => {
        const text = card.querySelector('.yt-co-content')?.textContent || '';
        const author = card.querySelector('.yt-co-author')?.textContent || '';
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
        ctx.fillStyle = '#818cf8';
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
        const author = item.querySelector('.yt-co-chatbox-author')?.textContent || '';
        const text = item.querySelector('.yt-co-chatbox-text')?.textContent || '';
        const chatX = w - chatWidth - 16;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(chatX, currentY, chatWidth, itemHeight);

        ctx.fillStyle = '#c7d2fe';
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
