import { CommentData, TimestampOccurrence } from '../types';
import { extractTimestamps } from './timestampParser';

export class CommentFetcher {
  private commentsMap = new Map<string, CommentData>();
  private observer: MutationObserver | null = null;
  private onNewCommentsCallback: ((comments: CommentData[]) => void) | null = null;
  private isScanning = false;
  private scanInterval: number | null = null;
  private isFetchingApi = false;
  private apiAbortController: AbortController | null = null;

  // Main World Bridge から受信したデータ
  private bridgeApiKey = '';
  private bridgeClientVersion = '';
  private bridgeClientName = 'WEB';
  private bridgeVisitorData = '';
  private bridgeInitialData: unknown = null;
  private currentVideoId = '';
  private commentFingerprints = new Map<string, string>(); // fingerprint -> commentId

  constructor() {
    this.initMainWorldBridgeListener();
  }

  private getCommentFingerprint(comment: CommentData): string {
    const cleanText = comment.rawText
      .replace(/(?:(?:\d{1,2}:)?[0-5]?\d:[0-5]\d)/g, '')
      .replace(/[^\p{L}\p{N}]/gu, '')
      .toLowerCase()
      .slice(0, 60);
    const tsKey = comment.timestamps.map((t) => t.seconds).sort((a, b) => a - b).join(',');
    const cleanAuthor = comment.authorName.replace(/[@\s]/g, '').toLowerCase();

    if (cleanText.length <= 3) {
      return `${cleanAuthor}_${cleanText}_${tsKey}`;
    }
    return `${cleanText}_${tsKey}`;
  }

  private registerComment(commentData: CommentData, newItems: CommentData[]) {
    if (!commentData || commentData.timestamps.length === 0) return;

    // 1. ID による重複チェック
    if (this.commentsMap.has(commentData.id)) {
      const existing = this.commentsMap.get(commentData.id)!;
      this.mergeCommentData(existing, commentData);
      return;
    }

    // 2. 指紋（正規化テキスト + タイムスタンプ秒数）による重複チェック
    const fingerprint = this.getCommentFingerprint(commentData);
    const existingId = this.commentFingerprints.get(fingerprint);
    if (existingId && this.commentsMap.has(existingId)) {
      const existing = this.commentsMap.get(existingId)!;
      this.mergeCommentData(existing, commentData);
      // DOM由来の仮IDから、APIの正式IDが後から判明した場合はキーを更新
      if (existing.id.startsWith('comment_') && !commentData.id.startsWith('comment_')) {
        this.commentsMap.delete(existingId);
        existing.id = commentData.id;
        this.commentsMap.set(commentData.id, existing);
        this.commentFingerprints.set(fingerprint, commentData.id);
      }
      return;
    }

    // 新規コメントとして登録
    this.commentsMap.set(commentData.id, commentData);
    this.commentFingerprints.set(fingerprint, commentData.id);
    newItems.push(commentData);
  }

  private mergeCommentData(existing: CommentData, incoming: CommentData) {
    let updated = false;
    if (!existing.authorAvatarUrl && incoming.authorAvatarUrl) {
      existing.authorAvatarUrl = incoming.authorAvatarUrl;
      updated = true;
    } else if (
      incoming.authorAvatarUrl.includes('ggpht.com') &&
      !existing.authorAvatarUrl.includes('ggpht.com')
    ) {
      existing.authorAvatarUrl = incoming.authorAvatarUrl;
      updated = true;
    }
    if (!existing.authorChannelUrl && incoming.authorChannelUrl) {
      existing.authorChannelUrl = incoming.authorChannelUrl;
      updated = true;
    }
    if (incoming.likeCount > existing.likeCount) {
      existing.likeCount = incoming.likeCount;
      existing.formattedLikeCount = incoming.formattedLikeCount;
      updated = true;
    }
    if (updated) {
      this.commentsMap.set(existing.id, { ...existing });
    }
  }

  public setVideoId(videoId: string) {
    if (this.currentVideoId === videoId) return;
    this.currentVideoId = videoId;
    this.stop();
  }

  public getVideoId(): string {
    if (this.currentVideoId) return this.currentVideoId;
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
    return '';
  }

  private extractVideoIdFromInitialData(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const obj = data as Record<string, any>;
    if (typeof obj.currentVideoEndpoint?.watchEndpoint?.videoId === 'string') {
      return obj.currentVideoEndpoint.watchEndpoint.videoId;
    }
    if (typeof obj.endpoint?.watchEndpoint?.videoId === 'string') {
      return obj.endpoint.watchEndpoint.videoId;
    }
    if (typeof obj.playerOverlays?.playerOverlayRenderer?.videoId === 'string') {
      return obj.playerOverlays.playerOverlayRenderer.videoId;
    }
    if (typeof obj.videoDetails?.videoId === 'string') {
      return obj.videoDetails.videoId;
    }
    // ルート近傍の明示的なプロパティのみをチェック（レコメンド動画の誤認識を防ぐ）
    const contents = obj.contents?.twoColumnWatchNextResults?.results?.results?.contents;
    if (Array.isArray(contents)) {
      for (const section of contents) {
        const primaryInfo = section?.videoPrimaryInfoRenderer;
        const primaryVid = primaryInfo?.currentVideoEndpoint?.watchEndpoint?.videoId;
        if (typeof primaryVid === 'string') return primaryVid;
      }
    }
    return null;
  }

  private initMainWorldBridgeListener() {
    const DATA_EL_ID = 'yt-co-bridge-data';
    const API_EL_ID = 'yt-co-bridge-api';
    let lastDataSeq = '';
    let lastApiSeq = '';

    /** DOM 要素から JSON を安全に読み取る */
    const readEl = (id: string): unknown | null => {
      try {
        const el = document.getElementById(id);
        if (!el || !el.textContent) return null;
        return JSON.parse(el.textContent);
      } catch {
        return null;
      }
    };

    /** Bridge データ要素の更新を処理 */
    const processBridgeData = () => {
      const el = document.getElementById(DATA_EL_ID);
      if (!el) return;
      const seq = el.getAttribute('data-seq') || '';
      if (seq === lastDataSeq) return;
      lastDataSeq = seq;

      const detail = readEl(DATA_EL_ID) as {
        apiKey?: string;
        clientVersion?: string;
        clientName?: string;
        visitorData?: string;
        initialData?: unknown;
        videoId?: string;
      } | null;
      if (!detail) return;

      const activeVideoId = this.getVideoId();
      if (detail.videoId && activeVideoId && detail.videoId !== activeVideoId) return;

      if (detail.apiKey) this.bridgeApiKey = detail.apiKey;
      if (detail.clientVersion) this.bridgeClientVersion = detail.clientVersion;
      if (detail.clientName) this.bridgeClientName = detail.clientName;
      if (detail.visitorData) this.bridgeVisitorData = detail.visitorData;
      if (detail.initialData) {
        const dataVid = this.extractVideoIdFromInitialData(detail.initialData);
        if (dataVid && activeVideoId && dataVid !== activeVideoId) return;
        this.bridgeInitialData = detail.initialData;
        this.parseInitialDataJson(detail.initialData);
        if (!this.isFetchingApi) {
          this.fetchCommentsViaApi();
        }
      }
    };

    /** Bridge API レスポンス要素の更新を処理 */
    const processApiResponse = () => {
      const el = document.getElementById(API_EL_ID);
      if (!el) return;
      const seq = el.getAttribute('data-seq') || '';
      if (seq === lastApiSeq) return;
      lastApiSeq = seq;

      const detail = readEl(API_EL_ID) as {
        data?: unknown;
        videoId?: string;
        page?: number;
      } | null;
      if (!detail || !detail.data) return;

      const activeVideoId = this.getVideoId();
      if (detail.videoId && activeVideoId && detail.videoId !== activeVideoId) return;

      this.parseInitialDataJson(detail.data);
    };

    // MutationObserver で Bridge DOM 要素の変更を監視
    const observeBridgeEls = () => {
      const observer = new MutationObserver(() => {
        processBridgeData();
        processApiResponse();
      });

      // documentElement を広く監視（Bridge 要素が後から追加される場合に対応）
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['data-seq'],
      });

      // 既に存在する要素を即時チェック
      processBridgeData();
      processApiResponse();
    };

    try {
      observeBridgeEls();

      // Main World へデータを要求（CustomEvent は detail 不要なので引き続き使用可能）
      window.dispatchEvent(new CustomEvent('YT_COMMENT_OVERLAY_REQUEST_MAIN_DATA'));

      // スクリプトタグ注入フォールバック
      this.injectMainWorldBridgeFallback();

      // 定期ポーリング（MutationObserver の漏れを補完）
      const pollInterval = setInterval(() => {
        processBridgeData();
        processApiResponse();
      }, 500);

      // 30 秒後にポーリング停止
      setTimeout(() => clearInterval(pollInterval), 30000);
    } catch {
      // ignore
    }
  }

  private injectMainWorldBridgeFallback() {
    try {
      if (document.getElementById('yt-comment-overlay-main-bridge')) return;
      const getUrl = chrome?.runtime?.getURL || (window as any).browser?.runtime?.getURL;
      const scriptUrl = getUrl ? getUrl('content/mainWorldBridge.js') : null;
      if (scriptUrl) {
        const script = document.createElement('script');
        script.id = 'yt-comment-overlay-main-bridge';
        script.src = scriptUrl;
        (document.head || document.documentElement).appendChild(script);
      }
    } catch {
      // ignore
    }
  }

  public setOnNewCommentsCallback(cb: (comments: CommentData[]) => void) {
    this.onNewCommentsCallback = cb;
  }

  public start() {
    this.stop();
    // YouTube本来のコメント欄の表示を確実に復元・保証
    this.restoreCommentsContainerStyle();

    // 0. Main World Bridge へデータを即座に再要求（stop()で initialData がクリアされたため）
    window.dispatchEvent(new CustomEvent('YT_COMMENT_OVERLAY_REQUEST_MAIN_DATA'));

    // 1. 概要欄からチャプター/タイムスタンプを即座に抽出（最速・確実）
    this.scanDescriptionTimestamps();
    // 2. DOMコメントスキャン（すでにページに存在する場合）
    this.scanDomComments();
    // 3. ページ初期データスキャン（HTML内 & Bridge）
    this.extractFromPageInitialData();
    // 4. 安全なコメント遅延読み込みトリガー（DOMスタイル変更なし）
    this.triggerCommentsLazyLoad();
    // 5. スクロール不要化：InnerTube API によるコメント直接プリロード
    this.fetchCommentsViaApi();
    // 6. MutationObserver開始
    this.observeComments();

    // 7. Bridge からのデータ到着を待ってリトライ（Bridge は非同期で応答するため）
    setTimeout(() => {
      if (this.commentsMap.size === 0 && !this.isFetchingApi) {
        window.dispatchEvent(new CustomEvent('YT_COMMENT_OVERLAY_REQUEST_MAIN_DATA'));
        this.extractFromPageInitialData();
        this.fetchCommentsViaApi();
      }
    }, 800);

    setTimeout(() => {
      if (this.commentsMap.size === 0 && !this.isFetchingApi) {
        window.dispatchEvent(new CustomEvent('YT_COMMENT_OVERLAY_REQUEST_MAIN_DATA'));
        this.fetchCommentsViaApi();
      }
    }, 2000);

    // 8. 定期ポーリングで遅延ロード・APIロード・アバター画像を確実にキャッチ
    let count = 0;
    this.scanInterval = window.setInterval(() => {
      count++;
      this.scanDescriptionTimestamps();
      this.scanDomComments();

      // 初期数秒間はAPIフェッチと安全なトリガーを試行
      if (count <= 8) {
        this.triggerCommentsLazyLoad();
        if (!this.isFetchingApi && this.commentsMap.size === 0) {
          window.dispatchEvent(new CustomEvent('YT_COMMENT_OVERLAY_REQUEST_MAIN_DATA'));
          this.fetchCommentsViaApi();
        }
      }

      if (count > 15) {
        if (this.scanInterval) {
          clearInterval(this.scanInterval);
          this.scanInterval = null;
        }
      }
    }, 1000);
  }

  public stop() {
    this.restoreCommentsContainerStyle();
    if (this.apiAbortController) {
      this.apiAbortController.abort();
      this.apiAbortController = null;
    }
    this.isFetchingApi = false;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.commentsMap.clear();
    this.commentFingerprints.clear();
    // bridgeInitialData は動画固有のため破棄するが、
    // bridgeApiKey / bridgeClientVersion / bridgeClientName / bridgeVisitorData は
    // YouTube セッション全体で共有される認証情報なので保持する
    this.bridgeInitialData = null;
  }

  public getAllComments(): CommentData[] {
    return Array.from(this.commentsMap.values());
  }

  public getCommentsWithTimestamps(): { comment: CommentData; timestamp: TimestampOccurrence }[] {
    const results: { comment: CommentData; timestamp: TimestampOccurrence }[] = [];
    for (const comment of this.commentsMap.values()) {
      for (const ts of comment.timestamps) {
        results.push({ comment, timestamp: ts });
      }
    }
    return results;
  }

  /**
   * 動画概要欄（Description）内のタイムスタンプ・チャプターを自動抽出
   */
  public scanDescriptionTimestamps() {
    const activeVideoId = this.getVideoId();

    // DOMがまだ新動画に切り替わっていない場合はスキップ
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    const flexyVideoId = watchFlexy?.getAttribute('video-id');
    if (flexyVideoId && activeVideoId && flexyVideoId !== activeVideoId) {
      return;
    }

    const descEl = document.querySelector(
      '#description, ytd-expandable-video-description-body-renderer, #description-inline-expander, .ytd-video-secondary-info-renderer'
    );
    if (!descEl) return;

    // 概要欄内の動画リンクを検査。別動画のIDが含まれていればDOMがまだ遷移前
    const watchLinks = descEl.querySelectorAll<HTMLAnchorElement>('a[href*="watch?v="]');
    for (const link of Array.from(watchLinks)) {
      const href = link.getAttribute('href') || '';
      const m = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (m && m[1] && activeVideoId && m[1] !== activeVideoId) {
        return;
      }
    }

    const rawText = descEl.textContent || '';
    const timestamps = extractTimestamps(rawText);
    if (timestamps.length === 0) return;

    // チャンネル名・投稿者情報・チャンネルURL
    const channelEl = document.querySelector<HTMLAnchorElement>('ytd-channel-name a, #channel-name a, #owner #text a, ytd-video-owner-renderer #channel-name a');
    const channelName = channelEl?.textContent?.trim() || '動画投稿者';
    const channelHref = channelEl?.getAttribute('href') || '';
    const authorChannelUrl = channelHref
      ? (channelHref.startsWith('http') ? channelHref : `https://www.youtube.com${channelHref}`)
      : '';

    // チャンネルアイコンの探索 (複数セレクタ + currentSrc)
    const avatarUrl = this.findChannelAvatarUrl();

    // 概要欄のテキストを行ごとに分割し、各タイムスタンプに対応する行を見どころとして抽出
    const lines = rawText.split('\n');
    const newItems: CommentData[] = [];

    for (const ts of timestamps) {
      const matchLine = lines.find((l) => l.includes(ts.formatted));
      let title = matchLine ? matchLine.replace(ts.formatted, '').trim() : '';
      title = title.replace(/^[-:：・\s]+/, '').trim();
      if (!title) {
        title = `チャプター ${ts.formatted}`;
      }

      const itemId = `desc_chapter_${activeVideoId}_${ts.seconds}`;
      const item: CommentData = {
        id: itemId,
        authorName: channelName,
        authorAvatarUrl: avatarUrl,
        authorChannelUrl,
        contentHtml: title,
        rawText: title,
        likeCount: 999, // 投稿者公式チャプターとしてハイライト
        formattedLikeCount: '公式',
        publishedTimeText: '',
        timestamps: [ts],
        isDescription: true,
        videoId: activeVideoId,
      };
      this.registerComment(item, newItems);
    }

    if (newItems.length > 0 && this.onNewCommentsCallback) {
      this.onNewCommentsCallback(newItems);
    }
  }

  private findChannelAvatarUrl(): string {
    const selectors = [
      '#owner yt-avatar-shape img',
      'ytd-video-owner-renderer yt-avatar-shape img',
      '#owner #avatar img',
      'yt-img-shadow#avatar img',
      '#channel-header-container img',
      'ytd-video-owner-renderer img',
      '#upload-info img',
    ];

    for (const sel of selectors) {
      const img = document.querySelector<HTMLImageElement>(sel);
      const url = this.getBestImgUrl(img);
      if (url) return url;
    }

    return '';
  }

  /**
   * DOMのMutationObserverで遅延読み込みされるコメントを継続監視
   */
  private observeComments() {
    const commentsContainer = document.querySelector('ytd-comments#comments') || document.body;
    this.observer = new MutationObserver(() => {
      if (this.isScanning) return;
      this.isScanning = true;
      requestIdleCallback(
        () => {
          this.scanDomComments();
          this.scanDescriptionTimestamps();
          this.isScanning = false;
        },
        { timeout: 1000 }
      );
    });

    this.observer.observe(commentsContainer, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * DOM上の ytd-comment-thread-renderer / ytd-comment-view-model からコメント情報を抽出
   */
  public scanDomComments() {
    const activeVideoId = this.getVideoId();

    // DOMがまだ新動画に切り替わっていない場合はスキップ
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    const flexyVideoId = watchFlexy?.getAttribute('video-id');
    if (flexyVideoId && activeVideoId && flexyVideoId !== activeVideoId) {
      return;
    }

    const commentElements = document.querySelectorAll(
      'ytd-comment-thread-renderer, ytd-comment-view-model'
    );
    const newItems: CommentData[] = [];

    commentElements.forEach((el) => {
      try {
        const commentData = this.parseCommentElement(el, activeVideoId);
        if (commentData && commentData.timestamps.length > 0) {
          this.registerComment(commentData, newItems);
        }
      } catch (err) {
        // スキップ
      }
    });

    if (newItems.length > 0 && this.onNewCommentsCallback) {
      this.onNewCommentsCallback(newItems);
    }
  }

  /**
   * HTMLImageElementから有効な画像URLを抽出
   */
  private getBestImgUrl(img: HTMLImageElement | null): string {
    if (!img) return '';
    // 優先順位: currentSrc (ブラウザが実際にロードしたURL) -> src -> getAttribute('src') -> data-thumb
    const candidates = [
      img.currentSrc,
      img.src,
      img.getAttribute('src'),
      img.getAttribute('data-thumb'),
    ];

    for (const c of candidates) {
      if (c && typeof c === 'string' && !c.startsWith('data:') && c.startsWith('http')) {
        return c;
      }
    }
    return '';
  }

  /**
   * コメント要素からアバター画像を多角的に探索・抽出
   */
  private extractAvatarFromCommentElement(el: Element): string {
    // 1. Polymer/Angularの内部コンポーネントデータプロパティから探索
    try {
      const anyEl = el as unknown as Record<string, unknown>;
      // el.data や el.__data
      const dataObj = (anyEl.data || anyEl.__data) as Record<string, unknown> | undefined;
      if (dataObj) {
        // commentRenderer.authorThumbnail.thumbnails
        const cr = (dataObj.commentRenderer || (dataObj.comment as Record<string, unknown>)?.commentRenderer) as Record<string, unknown> | undefined;
        const authorThumbnail = (cr?.authorThumbnail || dataObj.authorThumbnail || dataObj.avatar) as Record<string, unknown> | undefined;
        const thumbnails = (authorThumbnail?.thumbnails || (authorThumbnail?.image as Record<string, unknown>)?.sources) as { url: string }[] | undefined;
        if (Array.isArray(thumbnails) && thumbnails.length > 0) {
          const url = thumbnails[thumbnails.length - 1].url;
          if (url && url.startsWith('http')) return url;
        }
      }
    } catch {
      // ignore
    }

    // 2. DOM要素セレクタから探索
    const selectors = [
      'yt-avatar-shape img',
      '#author-thumbnail img',
      'yt-img-shadow#author-thumbnail img',
      'yt-img-shadow img',
      '#avatar img',
      '.yt-spec-avatar-shape__image',
      'img[alt*="avatar"]',
      'img.yt-core-image',
    ];

    for (const sel of selectors) {
      const img = el.querySelector<HTMLImageElement>(sel);
      const url = this.getBestImgUrl(img);
      if (url) return url;
    }

    // 3. 要素内の全 <img> をスキャンし、ggpht.com または googleusercontent.com を含むものを探す
    const allImgs = el.querySelectorAll('img');
    for (const img of Array.from(allImgs)) {
      const url = this.getBestImgUrl(img);
      if (url && (url.includes('ggpht.com') || url.includes('googleusercontent.com') || url.includes('ytimg.com'))) {
        return url;
      }
    }

    return '';
  }

  private parseCommentElement(el: Element, activeVideoId?: string): CommentData | null {
    const activeVid = activeVideoId || this.getVideoId();

    // コメント内のリンク（タイムスタンプリンクやパーマリンク）を検査。別動画のIDが含まれていれば除外
    const links = el.querySelectorAll<HTMLAnchorElement>('a[href*="watch?v="], a[href*="&t="], a[href*="?t="]');
    for (const a of Array.from(links)) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (m && m[1] && activeVid && m[1] !== activeVid) {
        return null;
      }
    }

    const contentEl = el.querySelector('#content-text, .yt-core-attributed-string');
    if (!contentEl) return null;

    const rawText = contentEl.textContent || '';
    const contentHtml = rawText;
    const timestamps = extractTimestamps(rawText);
    if (timestamps.length === 0) return null;

    let commentId = el.getAttribute('comment-id') || el.getAttribute('data-comment-id') || el.getAttribute('id') || '';
    if (!commentId || commentId === 'comment' || commentId.startsWith('comment-')) {
      const viewModel = el.querySelector('ytd-comment-view-model') || el.closest('ytd-comment-view-model');
      if (viewModel) {
        commentId = viewModel.getAttribute('comment-id') || viewModel.getAttribute('data-comment-id') || '';
      }
    }
    if (!commentId || commentId === 'comment') {
      const anyEl = el as unknown as Record<string, unknown>;
      const d = (anyEl.data || anyEl.__data) as Record<string, unknown> | undefined;
      const cr = (d?.commentRenderer || (d?.comment as Record<string, unknown>)?.commentRenderer) as Record<string, unknown> | undefined;
      if (typeof cr?.commentId === 'string') {
        commentId = cr.commentId;
      } else if (typeof d?.commentId === 'string') {
        commentId = d.commentId;
      }
    }
    if (!commentId || commentId === 'comment') {
      const linkEl = el.querySelector('a#published-time-text, a.yt-simple-endpoint');
      if (linkEl) {
        const href = linkEl.getAttribute('href') || '';
        const m = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (m && m[1] && activeVid && m[1] !== activeVid) {
          return null;
        }
        const lcMatch = href.match(/lc=([a-zA-Z0-9_-]+)/);
        if (lcMatch) commentId = lcMatch[1];
      }
    }
    if (!commentId || commentId === 'comment') {
      const authorText = el.querySelector('#author-text')?.textContent?.trim() || '';
      commentId = `comment_${authorText}_${timestamps[0].seconds}_${rawText.slice(0, 15).replace(/\s+/g, '')}`;
    }

    const authorEl = el.querySelector('#author-text span, #author-text');
    const authorName = authorEl?.textContent?.trim() || 'ユーザー';

    // チャンネルURLの抽出 (リンクタグ または ハンドル名から)
    const authorAnchor = el.querySelector<HTMLAnchorElement>(
      'a#author-text, #author-text a, a#author-thumbnail, #author-thumbnail a, a.yt-simple-endpoint[href*="/@"], a.yt-simple-endpoint[href*="/channel/"]'
    );
    let authorChannelUrl = '';
    const anchorHref = authorAnchor?.getAttribute('href') || '';
    if (anchorHref) {
      authorChannelUrl = anchorHref.startsWith('http') ? anchorHref : `https://www.youtube.com${anchorHref}`;
    } else if (authorName.startsWith('@')) {
      authorChannelUrl = `https://www.youtube.com/${authorName}`;
    }

    // アバター画像の抽出 (徹底強化)
    const authorAvatarUrl = this.extractAvatarFromCommentElement(el);

    const likeEl = el.querySelector('#vote-count-middle, #vote-count-left, .yt-spec-button-shape-next__button-text-content');
    const likeText = likeEl?.textContent?.trim() || '0';
    const likeCount = this.parseLikeCount(likeText);

    const timeEl = el.querySelector('#published-time-text a, #published-time-text');
    const publishedTimeText = timeEl?.textContent?.trim() || '';

    el.setAttribute('data-yt-overlay-comment-id', commentId);

    return {
      id: commentId,
      authorName,
      authorAvatarUrl,
      authorChannelUrl,
      contentHtml,
      rawText,
      likeCount,
      formattedLikeCount: likeText || '0',
      publishedTimeText,
      timestamps,
      videoId: activeVid,
    };
  }

  private parseLikeCount(text: string): number {
    if (!text || text === '') return 0;
    const clean = text.replace(/,/g, '').trim();

    const manMatch = clean.match(/^([\d.]+)\s*万$/);
    if (manMatch) {
      return Math.round(parseFloat(manMatch[1]) * 10000);
    }

    const kMatch = clean.match(/^([\d.]+)\s*K$/i);
    if (kMatch) {
      return Math.round(parseFloat(kMatch[1]) * 1000);
    }
    const mMatch = clean.match(/^([\d.]+)\s*M$/i);
    if (mMatch) {
      return Math.round(parseFloat(mMatch[1]) * 1000000);
    }

    const num = parseInt(clean, 10);
    return isNaN(num) ? 0 : num;
  }

  private extractFromPageInitialData() {
    try {
      const data = this.getInitialData();
      if (data) {
        const activeVideoId = this.getVideoId();
        const dataVid = this.extractVideoIdFromInitialData(data);
        // HTMLスクリプト内のytInitialDataはSPA遷移時に更新されないため、
        // 異なる動画IDの場合は確実に破棄する
        if (dataVid && activeVideoId && dataVid !== activeVideoId) {
          return;
        }
        this.parseInitialDataJson(data);
      }
    } catch {
      // ignore
    }
  }

  private getInitialData(): unknown | null {
    try {
      const currentVideoId = this.getVideoId();
      const win = (window as any).wrappedJSObject || (window as any);

      // 1. Firefox (wrappedJSObject): ytd-watch-flexy コンポーネント直接参照
      const watchFlexy = (document.querySelector('ytd-watch-flexy') as any)?.wrappedJSObject || (document.querySelector('ytd-watch-flexy') as any);
      if (watchFlexy) {
        const flexyVid = watchFlexy.videoId || watchFlexy.getAttribute?.('video-id');
        if (!flexyVid || !currentVideoId || flexyVid === currentVideoId) {
          const resp = watchFlexy.response || watchFlexy.__data?.response || watchFlexy.data;
          if (resp) return resp;
        }
      }

      // 2. Firefox (wrappedJSObject): ytd-watch-grid (YouTube新UI / グリッド)
      const watchGrid = (document.querySelector('ytd-watch-grid') as any)?.wrappedJSObject || (document.querySelector('ytd-watch-grid') as any);
      if (watchGrid) {
        const gridVid = watchGrid.videoId || watchGrid.getAttribute?.('video-id');
        if (!gridVid || !currentVideoId || gridVid === currentVideoId) {
          const resp = watchGrid.response || watchGrid.__data?.response || watchGrid.data;
          if (resp) return resp;
        }
      }

      // 3. Firefox (wrappedJSObject): win.ytInitialData 直接参照
      if (win.ytInitialData) {
        const dataVid = this.extractVideoIdFromInitialData(win.ytInitialData);
        if (!dataVid || !currentVideoId || dataVid === currentVideoId) {
          return win.ytInitialData;
        }
      }

      // 4. HTML スクリプトタグからのパース（フォールバック）
      const scripts = document.querySelectorAll('script');
      for (const script of Array.from(scripts)) {
        const content = script.textContent || '';
        const tokenIdx = content.indexOf('ytInitialData');
        if (tokenIdx !== -1) {
          const eqIdx = content.indexOf('=', tokenIdx);
          if (eqIdx !== -1) {
            const braceIdx = content.indexOf('{', eqIdx);
            if (braceIdx !== -1) {
              let depth = 0;
              let inString = false;
              let escape = false;
              let endIdx = -1;

              for (let i = braceIdx; i < content.length; i++) {
                const char = content[i];
                if (escape) {
                  escape = false;
                  continue;
                }
                if (char === '\\') {
                  escape = true;
                  continue;
                }
                if (char === '"') {
                  inString = !inString;
                  continue;
                }
                if (!inString) {
                  if (char === '{') {
                    depth++;
                  } else if (char === '}') {
                    depth--;
                    if (depth === 0) {
                      endIdx = i;
                      break;
                    }
                  }
                }
              }

              if (endIdx !== -1) {
                const jsonStr = content.slice(braceIdx, endIdx + 1);
                return JSON.parse(jsonStr);
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * YouTube本体のコメント欄のDOMスタイルを正常な状態に復元・保証する
   */
  public restoreCommentsContainerStyle() {
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

  /**
   * YouTube本体のDOMスタイルを一切破壊せずに、安全にコメント読み込みを促す
   */
  public triggerCommentsLazyLoad() {
    try {
      this.restoreCommentsContainerStyle();

      const commentsContainer = document.querySelector<HTMLElement>('ytd-comments#comments, #comments');
      if (!commentsContainer) return;

      const loadedItems = commentsContainer.querySelectorAll('ytd-comment-thread-renderer, ytd-comment-view-model');
      if (loadedItems.length >= 8) {
        return;
      }

      // クリック可能なトリガーボタンや Polymer メソッドがあれば安全に実行
      const rawCont = commentsContainer.querySelector<HTMLElement>(
        'ytd-continuation-item-renderer, #continuations ytd-continuation-item-renderer'
      );
      if (rawCont) {
        const continuationEl = (rawCont as any).wrappedJSObject || rawCont;
        if (typeof continuationEl.onIntersection === 'function') continuationEl.onIntersection();
        if (typeof continuationEl.handleIntersection_ === 'function') continuationEl.handleIntersection_();
        if (typeof continuationEl.fetchContinuation === 'function') continuationEl.fetchContinuation();
        if (typeof continuationEl.fire === 'function') continuationEl.fire('yt-load-continuation');

        const btn = rawCont.querySelector<HTMLElement>('button, #button, tp-yt-paper-button, yt-button-shape');
        if (btn && typeof btn.click === 'function') {
          btn.click();
        }
      }

      // DOMスタイルは一切変更せず、スクロールイベントを多層的にディスパッチ
      window.dispatchEvent(new Event('scroll'));
      document.dispatchEvent(new Event('scroll'));
      document.documentElement.dispatchEvent(new Event('scroll'));
      if (document.body) {
        document.body.dispatchEvent(new Event('scroll'));
      }
    } catch {
      // ignore
    }
  }

  /**
   * スクリプトタグまたは Firefox wrappedJSObject から InnerTube API キーとクライアントバージョンを抽出
   */
  private extractInnertubeConfig(): { apiKey: string; clientVersion: string; visitorData?: string } | null {
    try {
      // 1. Firefox (wrappedJSObject) または直接アクセス
      const win = (window as any).wrappedJSObject || (window as any);
      const ytcfg = win.ytcfg;
      if (ytcfg && typeof ytcfg.get === 'function') {
        const apiKey = ytcfg.get('INNERTUBE_API_KEY');
        const clientVersion = ytcfg.get('INNERTUBE_CLIENT_VERSION');
        const context = ytcfg.get('INNERTUBE_CONTEXT');
        const visitorData = context?.client?.visitorData || ytcfg.get('VISITOR_DATA') || '';
        if (apiKey) {
          return {
            apiKey,
            clientVersion: clientVersion || '2.20240101.00.00',
            visitorData: visitorData || undefined,
          };
        }
      }

      // 2. スクリプトタグからの抽出 (フォールバック)
      const scripts = document.querySelectorAll('script');
      for (const script of Array.from(scripts)) {
        const text = script.textContent || '';
        if (text.includes('INNERTUBE_API_KEY')) {
          const keyMatch = text.match(/"INNERTUBE_API_KEY":\s*"([^"]+)"/);
          const verMatch = text.match(/"INNERTUBE_CLIENT_VERSION":\s*"([^"]+)"/);
          const visMatch = text.match(/"VISITOR_DATA":\s*"([^"]+)"/);
          if (keyMatch && keyMatch[1]) {
            return {
              apiKey: keyMatch[1],
              clientVersion: verMatch ? verMatch[1] : '2.20240101.00.00',
              visitorData: visMatch ? visMatch[1] : undefined,
            };
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * ytInitialData または DOM からコメントセクション用の Continuation Token を探索
   */
  private findInitialCommentContinuationToken(initialData: unknown): string | null {
    if (!initialData || typeof initialData !== 'object') {
      return this.findContinuationFromDom();
    }

    const data = initialData as Record<string, any>;

    // 1. engagementPanels の探索 (新UI / パネルレイアウト)
    if (Array.isArray(data.engagementPanels)) {
      for (const panel of data.engagementPanels) {
        const panelRenderer = panel?.engagementPanelSectionListRenderer;
        const panelId = panelRenderer?.panelIdentifier || panelRenderer?.targetId || '';
        if (typeof panelId === 'string' && panelId.includes('comment')) {
          const token = this.extractTokenFromSectionList(panelRenderer?.content?.sectionListRenderer);
          if (token) return token;
        }
      }
    }

    // 2. twoColumnWatchNextResults の探索 (通常デスクトップレイアウト)
    const contents = data.contents?.twoColumnWatchNextResults?.results?.results?.contents;
    if (Array.isArray(contents)) {
      for (const section of contents) {
        const itemSection = section?.itemSectionRenderer;
        const secId = itemSection?.sectionIdentifier || itemSection?.targetId || '';
        if (typeof secId === 'string' && secId.includes('comment')) {
          const token = this.extractTokenFromItemSection(itemSection);
          if (token) return token;
        }
      }
    }

    // 3. 再帰探索 (コメントコンテキスト優先)
    let candidateToken: string | null = null;
    const walkForToken = (node: unknown, inCommentContext: boolean, depth = 0) => {
      if (!node || typeof node !== 'object' || candidateToken || depth > 20) return;
      const obj = node as Record<string, unknown>;

      const isComments =
        inCommentContext ||
        obj.sectionIdentifier === 'comment-item-section' ||
        obj.targetId === 'comments-section' ||
        obj.targetId === 'engagement-panel-comments-section' ||
        obj.panelIdentifier === 'engagement-panel-comments-section' ||
        'commentsHeaderRenderer' in obj ||
        'comments-header-renderer' in obj;

      const endpoint = obj.continuationEndpoint as Record<string, unknown> | undefined;
      const cmd = (endpoint?.continuationCommand || obj.continuationCommand) as Record<string, unknown> | undefined;
      if (cmd?.token && typeof cmd.token === 'string') {
        if (isComments) {
          candidateToken = cmd.token;
          return;
        }
      }

      const nextCont = obj.nextContinuationData as Record<string, unknown> | undefined;
      if (nextCont?.continuation && typeof nextCont.continuation === 'string') {
        if (isComments) {
          candidateToken = nextCont.continuation;
          return;
        }
      }

      for (const key of Object.keys(obj)) {
        if (key === 'secondaryResults' || key === 'relatedVideos' || key === 'watchNextEndScreenRenderer') continue;
        walkForToken(obj[key], isComments, depth + 1);
      }
    };

    walkForToken(initialData, false);
    if (candidateToken) return candidateToken;

    // 4. DOM からのフォールバック取得
    return this.findContinuationFromDom();
  }

  private extractTokenFromSectionList(sectionList: any): string | null {
    if (!sectionList || !Array.isArray(sectionList.contents)) return null;
    for (const section of sectionList.contents) {
      const itemSection = section?.itemSectionRenderer;
      const token = this.extractTokenFromItemSection(itemSection);
      if (token) return token;
    }
    return null;
  }

  private extractTokenFromItemSection(itemSection: any): string | null {
    if (!itemSection || typeof itemSection !== 'object') return null;

    // 1. continuations 配下 (YouTube初期状態の最頻出パターン)
    if (Array.isArray(itemSection.continuations)) {
      for (const cont of itemSection.continuations) {
        const token =
          cont?.nextContinuationData?.continuation ||
          cont?.reloadContinuationData?.continuation ||
          cont?.continuationEndpoint?.continuationCommand?.token ||
          cont?.continuationCommand?.token;
        if (typeof token === 'string' && token.length > 20) return token;
      }
    }

    // 2. contents 配下の continuationItemRenderer
    if (Array.isArray(itemSection.contents)) {
      for (const item of itemSection.contents) {
        const contItem = item?.continuationItemRenderer;
        const token =
          contItem?.continuationEndpoint?.continuationCommand?.token ||
          contItem?.continuationCommand?.token ||
          contItem?.nextContinuationData?.continuation ||
          contItem?.button?.buttonRenderer?.command?.continuationCommand?.token;
        if (typeof token === 'string' && token.length > 20) {
          return token;
        }
      }
    }
    return null;
  }

  private findContinuationFromDom(): string | null {
    try {
      const rawEl = document.querySelector(
        'ytd-comments ytd-continuation-item-renderer, ytd-continuation-item-renderer'
      ) as any;
      if (rawEl) {
        const contEl = rawEl.wrappedJSObject || rawEl;
        const token =
          contEl.data?.continuationEndpoint?.continuationCommand?.token ||
          contEl.__data?.continuationEndpoint?.continuationCommand?.token ||
          contEl.data?.continuationCommand?.token ||
          contEl.__data?.data?.continuationEndpoint?.continuationCommand?.token;
        if (typeof token === 'string' && token.length > 20) {
          return token;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * APIレスポンスから次ページ読み込み用 Continuation Token を探索 (返信内トークンを除外)
   */
  private findNextContinuationToken(responseJson: unknown): string | null {
    if (!responseJson || typeof responseJson !== 'object') return null;
    const json = responseJson as any;

    // 1. 最優先: appendContinuationItemsAction / reloadContinuationItemsCommand の末尾要素
    const endpoints = json.onResponseReceivedEndpoints || json.onResponseReceivedActions;
    if (Array.isArray(endpoints)) {
      for (const ep of endpoints) {
        const action = ep.appendContinuationItemsAction || ep.reloadContinuationItemsCommand;
        const items = action?.continuationItems;
        if (Array.isArray(items) && items.length > 0) {
          for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            const ci = item?.continuationItemRenderer;
            if (ci) {
              const cmd = ci.continuationEndpoint?.continuationCommand || ci.continuationCommand;
              if (cmd?.token && typeof cmd.token === 'string') return cmd.token;
              const nc = ci.nextContinuationData?.continuation || ci.reloadContinuationData?.continuation;
              if (typeof nc === 'string') return nc;
            }
          }
        }
      }
    }

    // 2. 汎用再帰（replies や commentRepliesRenderer は除外して親コメントのみ探索）
    const search = (node: any): string | null => {
      if (!node || typeof node !== 'object') return null;

      if ('commentRepliesRenderer' in node || 'replies' in node) {
        return null;
      }

      if (Array.isArray(node.continuationItems)) {
        for (let i = node.continuationItems.length - 1; i >= 0; i--) {
          const ci = node.continuationItems[i]?.continuationItemRenderer;
          if (ci) {
            const cmd = ci.continuationEndpoint?.continuationCommand || ci.continuationCommand;
            if (cmd?.token && typeof cmd.token === 'string') return cmd.token;
          }
        }
      }

      for (const key of Object.keys(node)) {
        if (key === 'replies' || key === 'commentRepliesRenderer' || key === 'secondaryResults') continue;
        const found = search(node[key]);
        if (found) return found;
      }
      return null;
    };

    return search(json);
  }

  /**
   * ユーザーが下へスクロールしなくても初期状態からコメントを自動取得（InnerTube API 直接フェッチ）
   */
  public async fetchCommentsViaApi(): Promise<void> {
    if (this.isFetchingApi) return;
    this.isFetchingApi = true;

    try {
      // 1. API キーの解決 (Main World Bridge 優先 -> HTMLスクリプトフォールバック)
      let apiKey = this.bridgeApiKey;
      let clientVersion = this.bridgeClientVersion;

      if (!apiKey) {
        const config = this.extractInnertubeConfig();
        if (config) {
          apiKey = config.apiKey;
          clientVersion = config.clientVersion;
          if (config.visitorData && !this.bridgeVisitorData) {
            this.bridgeVisitorData = config.visitorData;
          }
        }
      }

      if (!apiKey) {
        this.isFetchingApi = false;
        return;
      }

      // 2. initialData の解決 (Main World Bridge 優先 -> HTMLスクリプトフォールバック)
      const activeVideoId = this.getVideoId();
      let initialData = this.bridgeInitialData;
      if (initialData) {
        const bridgeVid = this.extractVideoIdFromInitialData(initialData);
        if (activeVideoId && bridgeVid && bridgeVid !== activeVideoId) {
          initialData = null;
          this.bridgeInitialData = null;
        }
      }
      if (!initialData) {
        const pageData = this.getInitialData();
        if (pageData) {
          const pageVid = this.extractVideoIdFromInitialData(pageData);
          if (!pageVid || !activeVideoId || pageVid === activeVideoId) {
            initialData = pageData;
          }
        }
      }

      let token = initialData ? this.findInitialCommentContinuationToken(initialData) : null;

      this.apiAbortController = new AbortController();
      const signal = this.apiAbortController.signal;

      const url = `https://www.youtube.com/youtubei/v1/next?key=${encodeURIComponent(apiKey)}&prettyPrint=false`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': '1', // 1 = WEB
        'X-YouTube-Client-Version': clientVersion || '2.20240101.00.00',
      };
      if (this.bridgeVisitorData) {
        headers['X-Goog-Visitor-Id'] = this.bridgeVisitorData;
      }

      // トークンが無い場合、videoId を使って初期 watchNext を叩きトークンを取得
      if (!token && activeVideoId) {
        try {
          const initPayload = {
            context: {
              client: {
                hl: navigator.language || 'ja',
                gl: 'JP',
                clientName: this.bridgeClientName || 'WEB',
                clientVersion: clientVersion || '2.20240101.00.00',
                visitorData: this.bridgeVisitorData || undefined,
              },
            },
            videoId: activeVideoId,
          };
          const initRes = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(initPayload),
            credentials: 'same-origin',
            signal,
          });
          if (initRes.ok && !signal.aborted && (!this.getVideoId() || this.getVideoId() === activeVideoId)) {
            const initJson = await initRes.json();
            this.parseInitialDataJson(initJson);
            token = this.findInitialCommentContinuationToken(initJson);
          }
        } catch {
          // ignore
        }
      }

      if (!token) {
        this.isFetchingApi = false;
        return;
      }

      const MAX_PAGES = 15;
      let pageCount = 0;
      const targetVideoId = activeVideoId;

      while (token && pageCount < MAX_PAGES && !signal.aborted) {
        if (signal.aborted || (this.getVideoId() && this.getVideoId() !== targetVideoId)) {
          break;
        }
        pageCount++;

        const payload = {
          context: {
            client: {
              hl: navigator.language || 'ja',
              gl: 'JP',
              clientName: this.bridgeClientName || 'WEB',
              clientVersion: clientVersion || '2.20240101.00.00',
              visitorData: this.bridgeVisitorData || undefined,
            },
          },
          continuation: token,
        };

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          credentials: 'same-origin',
          signal,
        });

        if (!res.ok || signal.aborted || (this.getVideoId() && this.getVideoId() !== targetVideoId)) break;

        const data = await res.json();
        if (signal.aborted || (this.getVideoId() && this.getVideoId() !== targetVideoId)) break;

        // コメントを抽出・登録
        this.parseInitialDataJson(data);

        // 次ページのトークンを取得
        token = this.findNextContinuationToken(data);

        if (token && pageCount < MAX_PAGES && !signal.aborted && (!this.getVideoId() || this.getVideoId() === targetVideoId)) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
    } catch {
      // ネットワーク切断やabort時は安全に終了
    } finally {
      this.isFetchingApi = false;
    }
  }

  private parseInitialDataJson(data: unknown) {
    if (!data || typeof data !== 'object') return;
    const newItems: CommentData[] = [];

    // 1. YouTube 最新仕様: frameworkUpdates / entityBatchUpdate (Entity Store) の直接走査
    const frameworkUpdates = (data as any).frameworkUpdates;
    const mutations = frameworkUpdates?.entityBatchUpdate?.mutations;
    if (Array.isArray(mutations)) {
      for (const mutation of mutations) {
        const payload = mutation?.payload;
        if (payload?.commentEntityPayload) {
          const commentData = this.parseCommentEntityPayload(payload.commentEntityPayload);
          if (commentData && commentData.timestamps.length > 0) {
            this.registerComment(commentData, newItems);
          }
        }
      }
    }

    // 2. 汎用再帰走査 (commentEntityPayload, commentRenderer, commentViewModel を包括)
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;

      if ('commentEntityPayload' in node) {
        const cep = (node as Record<string, unknown>).commentEntityPayload as Record<string, any>;
        const commentData = this.parseCommentEntityPayload(cep);
        if (commentData && commentData.timestamps.length > 0) {
          this.registerComment(commentData, newItems);
        }
      }

      if ('commentRenderer' in node) {
        const cr = (node as Record<string, unknown>).commentRenderer as Record<string, unknown>;
        const commentData = this.parseCommentRendererJson(cr);
        if (commentData && commentData.timestamps.length > 0) {
          this.registerComment(commentData, newItems);
        }
      }

      if ('commentViewModel' in node) {
        const cvm = (node as Record<string, unknown>).commentViewModel as Record<string, unknown>;
        const commentData = this.parseCommentViewModelJson(cvm);
        if (commentData && commentData.timestamps.length > 0) {
          this.registerComment(commentData, newItems);
        }
      }

      for (const key of Object.keys(node)) {
        walk((node as Record<string, unknown>)[key]);
      }
    };

    try {
      walk(data);
      if (newItems.length > 0 && this.onNewCommentsCallback) {
        this.onNewCommentsCallback(newItems);
      }
    } catch {
      // ignore
    }
  }

  private parseCommentEntityPayload(cep: Record<string, any>): CommentData | null {
    try {
      if (!cep || typeof cep !== 'object') return null;

      // 1. 本文テキストの抽出 (最新仕様: properties.content.content)
      let rawText = '';
      const propContent = cep.properties?.content;
      if (typeof propContent?.content === 'string') {
        rawText = propContent.content;
      } else if (typeof propContent === 'string') {
        rawText = propContent;
      } else if (Array.isArray(propContent?.runs)) {
        rawText = propContent.runs.map((r: any) => r.text || '').join('');
      } else if (typeof cep.content?.content === 'string') {
        rawText = cep.content.content;
      } else if (Array.isArray(cep.content?.runs)) {
        rawText = cep.content.runs.map((r: any) => r.text || '').join('');
      }

      if (!rawText) return null;

      // 2. タイムスタンプ抽出
      const timestamps = extractTimestamps(rawText);
      if (timestamps.length === 0) return null;

      // 3. 投稿者名
      let authorName = 'ユーザー';
      if (typeof cep.author?.displayName === 'string') {
        authorName = cep.author.displayName;
      } else if (typeof cep.author?.channelTitle === 'string') {
        authorName = cep.author.channelTitle;
      }

      // 4. アバター画像
      let authorAvatarUrl = '';
      if (typeof cep.author?.avatarThumbnailUrl === 'string') {
        authorAvatarUrl = cep.author.avatarThumbnailUrl;
      } else if (Array.isArray(cep.author?.avatar?.image?.sources) && cep.author.avatar.image.sources.length > 0) {
        const sources = cep.author.avatar.image.sources;
        authorAvatarUrl = sources[sources.length - 1].url || '';
      }

      // 4.5. チャンネルURL
      let authorChannelUrl = '';
      const browseEndpoint =
        cep.author?.channelCommand?.innertubeCommand?.browseEndpoint ||
        cep.author?.command?.innertubeCommand?.browseEndpoint ||
        cep.author?.navigationEndpoint?.browseEndpoint;
      if (browseEndpoint?.canonicalBaseUrl) {
        authorChannelUrl = `https://www.youtube.com${browseEndpoint.canonicalBaseUrl}`;
      } else if (browseEndpoint?.browseId) {
        authorChannelUrl = `https://www.youtube.com/channel/${browseEndpoint.browseId}`;
      } else if (typeof cep.author?.channelId === 'string') {
        authorChannelUrl = `https://www.youtube.com/channel/${cep.author.channelId}`;
      } else if (authorName.startsWith('@')) {
        authorChannelUrl = `https://www.youtube.com/${authorName}`;
      }

      // 5. いいね数
      const likeText = String(
        cep.toolbar?.likeCountNotliked ||
        cep.toolbar?.likeCount ||
        cep.toolbar?.voteCount ||
        '0'
      );
      const likeCount = this.parseLikeCount(likeText);

      // 6. 投稿時刻
      const publishedTimeText =
        typeof cep.properties?.publishedTime === 'string'
          ? cep.properties.publishedTime
          : '';

      // 7. コメントID
      const commentId = String(
        cep.properties?.commentId ||
        cep.commentId ||
        `cep_${authorName}_${timestamps[0].seconds}`
      );

      const activeVid = this.getVideoId();

      return {
        id: commentId,
        authorName,
        authorAvatarUrl,
        authorChannelUrl,
        contentHtml: rawText.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        rawText,
        likeCount,
        formattedLikeCount: likeText !== '0' ? likeText : '0',
        publishedTimeText,
        timestamps,
        videoId: activeVid,
      };
    } catch {
      return null;
    }
  }

  private parseCommentViewModelJson(cvm: Record<string, unknown>): CommentData | null {
    try {
      const commentId = String(cvm.commentId || '');

      let rawText = '';
      const contentTextObj = cvm.contentText as Record<string, unknown> | undefined;
      if (typeof contentTextObj?.content === 'string') {
        rawText = contentTextObj.content;
      } else if (Array.isArray(contentTextObj?.runs)) {
        rawText = (contentTextObj.runs as { text: string }[]).map((r) => r.text).join('');
      } else if (typeof (cvm as any).content?.content === 'string') {
        rawText = (cvm as any).content.content;
      } else if (typeof (cvm as any).properties?.content?.content === 'string') {
        rawText = (cvm as any).properties.content.content;
      }
      if (!rawText) return null;

      const timestamps = extractTimestamps(rawText);
      if (timestamps.length === 0) return null;

      let authorName = 'ユーザー';
      const authorTextObj = cvm.authorText as Record<string, unknown> | undefined;
      if (typeof authorTextObj?.content === 'string') {
        authorName = authorTextObj.content;
      } else if (typeof cvm.authorName === 'string') {
        authorName = cvm.authorName;
      }

      let authorAvatarUrl = '';
      const avatarObj = cvm.avatar as Record<string, unknown> | undefined;
      const avatarSources = (avatarObj?.image as Record<string, unknown>)?.sources as { url: string }[] | undefined;
      if (Array.isArray(avatarSources) && avatarSources.length > 0) {
        authorAvatarUrl = avatarSources[avatarSources.length - 1].url;
      }

      let authorChannelUrl = '';
      const authorEndpoint = (cvm.authorEndpoint || (cvm as any).authorChannelCommand) as Record<string, any> | undefined;
      const browseEndpoint = authorEndpoint?.browseEndpoint;
      if (browseEndpoint?.canonicalBaseUrl) {
        authorChannelUrl = `https://www.youtube.com${browseEndpoint.canonicalBaseUrl}`;
      } else if (browseEndpoint?.browseId) {
        authorChannelUrl = `https://www.youtube.com/channel/${browseEndpoint.browseId}`;
      } else if (typeof (cvm as any).authorChannelId === 'string') {
        authorChannelUrl = `https://www.youtube.com/channel/${(cvm as any).authorChannelId}`;
      } else if (authorName.startsWith('@')) {
        authorChannelUrl = `https://www.youtube.com/${authorName}`;
      }

      const likeText = String(cvm.likeCount || cvm.voteCount || '0');
      const likeCount = this.parseLikeCount(likeText);

      const publishedTimeObj = cvm.publishedTimeText as Record<string, unknown> | undefined;
      const publishedTimeText = typeof publishedTimeObj?.content === 'string' ? publishedTimeObj.content : '';

      return {
        id: commentId || `cvm_${authorName}_${timestamps[0].seconds}`,
        authorName,
        authorAvatarUrl,
        authorChannelUrl,
        contentHtml: rawText.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        rawText,
        likeCount,
        formattedLikeCount: likeText,
        publishedTimeText,
        timestamps,
        videoId: this.getVideoId(),
      };
    } catch {
      return null;
    }
  }

  private parseCommentRendererJson(cr: Record<string, unknown>): CommentData | null {
    try {
      const commentId = String(cr.commentId || '');
      const contentTextObj = cr.contentText as { runs?: { text: string }[] } | undefined;
      const rawText = contentTextObj?.runs?.map((r) => r.text).join('') || '';
      const timestamps = extractTimestamps(rawText);
      if (timestamps.length === 0) return null;

      const authorTextObj = cr.authorText as { simpleText?: string } | undefined;
      const authorName = authorTextObj?.simpleText || 'ユーザー';

      const authorThumbnails = (cr.authorThumbnail as { thumbnails?: { url: string }[] })?.thumbnails;
      const authorAvatarUrl =
        authorThumbnails && authorThumbnails.length > 0
          ? authorThumbnails[authorThumbnails.length - 1].url
          : '';

      let authorChannelUrl = '';
      const authorEndpoint = cr.authorEndpoint as Record<string, any> | undefined;
      const browseEndpoint = authorEndpoint?.browseEndpoint;
      if (browseEndpoint?.canonicalBaseUrl) {
        authorChannelUrl = `https://www.youtube.com${browseEndpoint.canonicalBaseUrl}`;
      } else if (browseEndpoint?.browseId) {
        authorChannelUrl = `https://www.youtube.com/channel/${browseEndpoint.browseId}`;
      } else if (authorName.startsWith('@')) {
        authorChannelUrl = `https://www.youtube.com/${authorName}`;
      }

      const likeCount = Number(cr.likeCount || 0);
      const voteCount = cr.voteCount as { simpleText?: string } | undefined;
      const formattedLikeCount = voteCount?.simpleText || String(likeCount);

      const publishedTimeObj = cr.publishedTimeText as { runs?: { text: string }[] } | undefined;
      const publishedTimeText = publishedTimeObj?.runs?.map((r) => r.text).join('') || '';

      return {
        id: commentId || `comment_${authorName}_${timestamps[0].seconds}`,
        authorName,
        authorAvatarUrl,
        authorChannelUrl,
        contentHtml: rawText.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        rawText,
        likeCount,
        formattedLikeCount,
        publishedTimeText,
        timestamps,
        videoId: this.getVideoId(),
      };
    } catch {
      return null;
    }
  }
}
