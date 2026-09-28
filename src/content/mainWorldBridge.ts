/**
 * YouTube Main World (Page Context) Bridge
 * ページのメモリ上の window.ytcfg や Polymer コンポーネントに直接アクセスし、
 * Content Script (Isolated World) に DOM 要素経由でデータを渡すスクリプト。
 *
 * Chrome MV3 では CustomEvent.detail が MAIN → ISOLATED world 間で null になるため、
 * hidden DOM 要素の textContent に JSON 文字列を書き込み、Content Script 側で
 * MutationObserver / polling で読み取る方式を採用。
 */

(function () {
  const DATA_EL_ID = 'yt-co-bridge-data';
  const API_EL_ID = 'yt-co-bridge-api';
  const REPLY_REQ_EL_ID = 'yt-co-bridge-reply-req';
  const REPLY_RES_EL_ID = 'yt-co-bridge-reply-res';

  let currentFetchAbortController: AbortController | null = null;
  let isFetchingInMainWorld = false;
  let lastSuccessfulVideoId = '';
  const commentTokenCache = new Map<string, string>(); // commentId -> continuationToken
  const cachedResponses: any[] = [];

  function getOrCreateEl(id: string): HTMLElement {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.display = 'none';
      (document.documentElement || document.body).appendChild(el);
    }
    return el;
  }

  /** DOM 要素に JSON を書き込んで Content Script に通知 */
  function writeToEl(id: string, data: unknown) {
    try {
      const el = getOrCreateEl(id);
      el.textContent = JSON.stringify(data);
      el.setAttribute('data-seq', String(Date.now()));
    } catch {
      // ignore serialization errors
    }
  }

  function getVideoIdFromUrl(): string {
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

  function extractVideoId(data: any): string | null {
    if (!data || typeof data !== 'object') return null;
    if (typeof data.currentVideoEndpoint?.watchEndpoint?.videoId === 'string') {
      return data.currentVideoEndpoint.watchEndpoint.videoId;
    }
    if (typeof data.endpoint?.watchEndpoint?.videoId === 'string') {
      return data.endpoint.watchEndpoint.videoId;
    }
    if (typeof data.playerOverlays?.playerOverlayRenderer?.videoId === 'string') {
      return data.playerOverlays.playerOverlayRenderer.videoId;
    }
    if (typeof data.videoDetails?.videoId === 'string') {
      return data.videoDetails.videoId;
    }
    return null;
  }

  function getInnertubeConfig() {
    try {
      const win = window as any;
      const ytcfg = win.ytcfg;

      let apiKey = '';
      let clientVersion = '';
      let clientName = 'WEB';
      let visitorData = '';

      if (ytcfg && typeof ytcfg.get === 'function') {
        apiKey = ytcfg.get('INNERTUBE_API_KEY') || '';
        clientVersion = ytcfg.get('INNERTUBE_CLIENT_VERSION') || '';
        const context = ytcfg.get('INNERTUBE_CONTEXT');
        if (context?.client?.clientName) {
          clientName = context.client.clientName;
        }
        if (context?.client?.visitorData) {
          visitorData = context.client.visitorData;
        } else {
          visitorData = ytcfg.get('VISITOR_DATA') || '';
        }
      }

      const currentVideoId = getVideoIdFromUrl();
      let initialData: any = null;

      // 1. ytd-watch-flexy
      const watchFlexy = document.querySelector('ytd-watch-flexy') as any;
      if (watchFlexy) {
        const flexyVid = watchFlexy.videoId || watchFlexy.getAttribute?.('video-id');
        if (!flexyVid || !currentVideoId || flexyVid === currentVideoId) {
          initialData = watchFlexy.response || watchFlexy.__data?.response || watchFlexy.data;
        }
      }

      // 2. ytd-watch-grid
      if (!initialData) {
        const watchGrid = document.querySelector('ytd-watch-grid') as any;
        if (watchGrid) {
          const gridVid = watchGrid.videoId || watchGrid.getAttribute?.('video-id');
          if (!gridVid || !currentVideoId || gridVid === currentVideoId) {
            initialData = watchGrid.response || watchGrid.__data?.response || watchGrid.data;
          }
        }
      }

      // 3. ytd-app
      if (!initialData) {
        const ytdApp = document.querySelector('ytd-app') as any;
        if (ytdApp) {
          const appResponse = ytdApp.data?.response || ytdApp.__data?.response || ytdApp.response;
          if (appResponse) {
            const dataVid = extractVideoId(appResponse);
            if (!dataVid || !currentVideoId || dataVid === currentVideoId) {
              initialData = appResponse;
            }
          }
        }
      }

      // 4. window.ytInitialData
      if (!initialData && win.ytInitialData) {
        const dataVid = extractVideoId(win.ytInitialData);
        if (!dataVid || !currentVideoId || dataVid === currentVideoId) {
          initialData = win.ytInitialData;
        }
      }

      return { apiKey, clientVersion, clientName, visitorData, initialData, videoId: currentVideoId };
    } catch {
      return null;
    }
  }

  // ─── Continuation Token 探索 ─────────────────────────

  function findCommentContinuationToken(data: any): string | null {
    if (!data || typeof data !== 'object') return null;
    let foundToken: string | null = null;

    // 1. engagementPanels
    if (Array.isArray(data.engagementPanels)) {
      for (const panel of data.engagementPanels) {
        const r = panel?.engagementPanelSectionListRenderer;
        const id = r?.panelIdentifier || r?.targetId || '';
        if (typeof id === 'string' && id.includes('comment')) {
          const t = extractTokenFromSectionList(r?.content?.sectionListRenderer);
          if (t) return t;
        }
      }
    }

    // 2. twoColumnWatchNextResults
    const contents = data.contents?.twoColumnWatchNextResults?.results?.results?.contents;
    if (Array.isArray(contents)) {
      for (const section of contents) {
        const is = section?.itemSectionRenderer;
        const sid = is?.sectionIdentifier || is?.targetId || '';
        if (typeof sid === 'string' && sid.includes('comment')) {
          const t = extractTokenFromItemSection(is);
          if (t) return t;
        }
      }
    }

    // 3. 再帰探索
    const walk = (node: any, inComment: boolean, depth: number) => {
      if (!node || typeof node !== 'object' || foundToken || depth > 20) return;
      const isCtx =
        inComment ||
        node.sectionIdentifier === 'comment-item-section' ||
        node.targetId === 'comments-section' ||
        node.targetId === 'engagement-panel-comments-section' ||
        node.panelIdentifier === 'engagement-panel-comments-section' ||
        'commentsHeaderRenderer' in node ||
        'commentThreadRenderer' in node ||
        'comments-header-renderer' in node;

      const cmd = node.continuationEndpoint?.continuationCommand || node.continuationCommand;
      if (cmd?.token && typeof cmd.token === 'string' && isCtx) {
        foundToken = cmd.token;
        return;
      }
      const nextCont = node.nextContinuationData?.continuation || node.reloadContinuationData?.continuation;
      if (typeof nextCont === 'string' && isCtx) {
        foundToken = nextCont;
        return;
      }

      for (const key of Object.keys(node)) {
        if (key === 'secondaryResults' || key === 'relatedVideos' || key === 'watchNextEndScreenRenderer') continue;
        walk(node[key], isCtx, depth + 1);
      }
    };
    walk(data, false, 0);
    return foundToken;
  }

  function extractTokenFromSectionList(sl: any): string | null {
    if (!sl || !Array.isArray(sl.contents)) return null;
    for (const s of sl.contents) {
      const t = extractTokenFromItemSection(s?.itemSectionRenderer);
      if (t) return t;
    }
    return null;
  }

  function extractTokenFromItemSection(is: any): string | null {
    if (!is || typeof is !== 'object') return null;

    // 1. continuations 配下 (YouTube初期状態の最頻出パターン)
    if (Array.isArray(is.continuations)) {
      for (const cont of is.continuations) {
        const token =
          cont?.nextContinuationData?.continuation ||
          cont?.reloadContinuationData?.continuation ||
          cont?.continuationEndpoint?.continuationCommand?.token ||
          cont?.continuationCommand?.token;
        if (typeof token === 'string' && token.length > 20) return token;
      }
    }

    // 2. contents 配下の continuationItemRenderer
    if (Array.isArray(is.contents)) {
      for (const item of is.contents) {
        const ci = item?.continuationItemRenderer;
        const token =
          ci?.continuationEndpoint?.continuationCommand?.token ||
          ci?.continuationCommand?.token ||
          ci?.nextContinuationData?.continuation ||
          ci?.button?.buttonRenderer?.command?.continuationCommand?.token;
        if (typeof token === 'string' && token.length > 20) return token;
      }
    }
    return null;
  }

  // ─── InnerTube API フェッチ ─────────────────────────

  async function fetchCommentsInMainWorld(
    apiKey: string,
    clientVersion: string,
    clientName: string,
    visitorData: string,
    initialToken: string | null,
    targetVideoId: string
  ) {
    if (isFetchingInMainWorld || lastSuccessfulVideoId === targetVideoId) return;

    if (currentFetchAbortController) {
      currentFetchAbortController.abort();
    }
    currentFetchAbortController = new AbortController();
    const signal = currentFetchAbortController.signal;
    isFetchingInMainWorld = true;

    let token: string | null = initialToken;
    let page = 0;
    const MAX_PAGES = 15;

    const url = `/youtubei/v1/next?key=${encodeURIComponent(apiKey)}&prettyPrint=false`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': clientVersion || '2.20240101.00.00',
    };
    if (visitorData) {
      headers['X-Goog-Visitor-Id'] = visitorData;
    }

    try {
      // トークンがまだない場合、videoId を使って初期 watchNext を叩きトークンを取得する
      if (!token && targetVideoId) {
        try {
          const initPayload = {
            context: {
              client: {
                hl: navigator.language || 'ja',
                gl: 'JP',
                clientName: clientName || 'WEB',
                clientVersion: clientVersion || '2.20240101.00.00',
                visitorData: visitorData || undefined,
              },
            },
            videoId: targetVideoId,
          };
          const initRes = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(initPayload),
            credentials: 'same-origin',
            signal,
          });
          if (initRes.ok && !signal.aborted && getVideoIdFromUrl() === targetVideoId) {
            const initJson = await initRes.json();
            cachedResponses.push(initJson);
            if (cachedResponses.length > 25) cachedResponses.shift();
            extractAllCommentTokens(initJson);
            writeToEl(API_EL_ID, { data: initJson, videoId: targetVideoId, page: 0 });
            token = findCommentContinuationToken(initJson);
          }
        } catch {
          // ignore
        }
      }

      while (token && page < MAX_PAGES && !signal.aborted) {
        if (getVideoIdFromUrl() !== targetVideoId) break;
        page++;

        try {
          const payload = {
            context: {
              client: {
                hl: navigator.language || 'ja',
                gl: 'JP',
                clientName: clientName || 'WEB',
                clientVersion: clientVersion || '2.20240101.00.00',
                visitorData: visitorData || undefined,
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

          if (!res.ok || signal.aborted || getVideoIdFromUrl() !== targetVideoId) break;

          const json = await res.json();
          if (signal.aborted || getVideoIdFromUrl() !== targetVideoId) break;

          cachedResponses.push(json);
          if (cachedResponses.length > 25) cachedResponses.shift();
          extractAllCommentTokens(json);

          // DOM 要素に API レスポンスを書き込み — Content Script が読み取る
          writeToEl(API_EL_ID, { data: json, videoId: targetVideoId, page });
          lastSuccessfulVideoId = targetVideoId;

          token = findNextContinuationToken(json);
          if (token && page < MAX_PAGES && !signal.aborted) {
            await new Promise((r) => setTimeout(r, 150));
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') break;
          break;
        }
      }
    } finally {
      isFetchingInMainWorld = false;
    }
  }

  function findNextContinuationToken(json: any): string | null {
    if (!json || typeof json !== 'object') return null;

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

      // 返信（replies）ブロックは絶対に探索しない
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

  // ─── DOM コメントトリガー ─────────────────────────

  function triggerDomCommentsLoad() {
    try {
      const targets = document.querySelectorAll(
        'ytd-comments ytd-continuation-item-renderer, ytd-continuation-item-renderer, ytd-comments#comments'
      );
      const fakeEntry = [{ isIntersecting: true, intersectionRatio: 1.0 }];

      targets.forEach((el: any) => {
        if (typeof el.onIntersection === 'function') el.onIntersection(fakeEntry);
        if (typeof el.handleIntersection_ === 'function') el.handleIntersection_(fakeEntry);
        if (typeof el.fetchContinuation === 'function') el.fetchContinuation();
        if (typeof el.fire === 'function') el.fire('yt-load-continuation');
      });

      // ボタン要素があればクリック
      const btn = document.querySelector<HTMLElement>(
        'ytd-comments ytd-continuation-item-renderer button, #comments ytd-continuation-item-renderer button'
      );
      if (btn && typeof btn.click === 'function') {
        btn.click();
      }
    } catch {
      // ignore
    }
  }

  // ─── broadcastData: メインエントリポイント ─────────────────────────

  function broadcastData(forceData?: unknown) {
    const config = getInnertubeConfig();
    if (!config) return;

    if (forceData) {
      const currentVideoId = config.videoId;
      const dataVid = extractVideoId(forceData);
      if (!dataVid || !currentVideoId || dataVid === currentVideoId) {
        config.initialData = forceData;
      }
    }

    // 1. Content Script へ基本設定（APIキー等）を DOM 要素に書き込み
    writeToEl(DATA_EL_ID, {
      apiKey: config.apiKey,
      clientVersion: config.clientVersion,
      clientName: config.clientName,
      visitorData: config.visitorData,
      videoId: config.videoId,
    });

    // 2. DOM コンポーネントへの安全なトリガー
    triggerDomCommentsLoad();

    if (config.initialData) {
      cachedResponses.push(config.initialData);
      if (cachedResponses.length > 25) cachedResponses.shift();
      extractAllCommentTokens(config.initialData);
    }

    // 3. Main World 自前で InnerTube API フェッチ開始 (トークンがあれば直接、無ければ videoId から解決)
    if (config.apiKey && config.videoId) {
      const token = findCommentContinuationToken(config.initialData);
      fetchCommentsInMainWorld(
        config.apiKey,
        config.clientVersion,
        config.clientName,
        config.visitorData,
        token,
        config.videoId
      );
    }
  }

  // ─── Main World での返信取得ハンドラ ─────────────────────────

  function findTokenInReplies(repliesObj: any): string | null {
    if (!repliesObj || typeof repliesObj !== 'object') return null;
    let foundToken: string | null = null;
    const walk = (node: any) => {
      if (foundToken || !node || typeof node !== 'object') return;
      if (typeof node.token === 'string' && node.token.length > 10) {
        foundToken = node.token;
        return;
      }
      if (typeof node.continuation === 'string' && node.continuation.length > 10) {
        foundToken = node.continuation;
        return;
      }
      for (const k of Object.keys(node)) {
        walk(node[k]);
        if (foundToken) return;
      }
    };
    walk(repliesObj);
    return foundToken;
  }

  function extractCommentIdFromThread(ctr: any): string {
    if (!ctr || typeof ctr !== 'object') return '';
    const targetId = ctr.replies?.commentRepliesRenderer?.targetId || ctr.targetId;
    if (typeof targetId === 'string' && targetId.includes('comment-replies-item-')) {
      return targetId.replace(/^comment-replies-item-/, '').trim();
    }
    const cvm = ctr.commentViewModel?.commentViewModel || ctr.commentViewModel || ctr.comment?.commentViewModel;
    if (cvm?.commentId) return String(cvm.commentId).trim();
    const cr = ctr.comment?.commentRenderer || ctr.commentRenderer;
    if (cr?.commentId) return String(cr.commentId).trim();
    if (ctr.commentId) return String(ctr.commentId).trim();
    return '';
  }

  function extractAllCommentTokens(json: any) {
    if (!json || typeof json !== 'object') return;
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;

      // 1. commentThreadRenderer
      if ('commentThreadRenderer' in node) {
        const ctr = node.commentThreadRenderer;
        const cId = extractCommentIdFromThread(ctr);

        const repliesObj = ctr?.replies?.commentRepliesRenderer || ctr?.replies;
        const token = findTokenInReplies(repliesObj) || findTokenInReplies(ctr) || '';

        if (cId && token) {
          commentTokenCache.set(cId, token);
        }
      }

      // 2. commentViewModel
      if ('commentViewModel' in node) {
        const cvm = node.commentViewModel;
        const cId = cvm?.commentId ? String(cvm.commentId) : '';
        if (cId && !commentTokenCache.has(cId)) {
          const t = findTokenInReplies(cvm);
          if (t) commentTokenCache.set(cId, t);
        }
      }

      // 3. commentEntityPayload
      if ('commentEntityPayload' in node) {
        const cep = node.commentEntityPayload;
        const cId = cep?.properties?.commentId || cep?.commentId ? String(cep.properties?.commentId || cep.commentId) : '';
        if (cId && !commentTokenCache.has(cId)) {
          const t = findTokenInReplies(cep);
          if (t) commentTokenCache.set(cId, t);
        }
      }

      for (const k of Object.keys(node)) {
        if (k === 'secondaryResults' || k === 'relatedVideos' || k === 'watchNextEndScreenRenderer') continue;
        walk(node[k]);
      }
    };
    walk(json);
  }

  function parseLikeCountText(text: string): number {
    if (!text) return 0;
    const clean = text.replace(/,/g, '').trim();
    const manMatch = clean.match(/^([\d.]+)\s*万$/);
    if (manMatch) return Math.round(parseFloat(manMatch[1]) * 10000);
    const kMatch = clean.match(/^([\d.]+)\s*K$/i);
    if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
    const mMatch = clean.match(/^([\d.]+)\s*M$/i);
    if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1000000);
    const num = parseInt(clean, 10);
    return isNaN(num) ? 0 : num;
  }

  function extractAvatarUrl(el: Element): string {
    const img = el.querySelector<HTMLImageElement>(
      'yt-avatar-shape img, #author-thumbnail img, yt-img-shadow img, #avatar img, .yt-spec-avatar-shape__image, img.yt-core-image'
    );
    if (img) {
      const src = img.currentSrc || img.src || img.getAttribute('src');
      if (src && src.startsWith('http')) return src;
    }
    const allImgs = el.querySelectorAll('img');
    for (const i of Array.from(allImgs)) {
      const s = i.currentSrc || i.src || i.getAttribute('src');
      if (s && (s.includes('ggpht.com') || s.includes('googleusercontent.com') || s.includes('ytimg.com'))) {
        return s;
      }
    }
    return '';
  }

  function extractRepliesFromThreadDom(threadEl: Element, parentCommentId?: string, parentRawText?: string): any[] {
    const replies: any[] = [];
    try {
      const repliesContainer = threadEl.querySelector('#replies, ytd-comment-replies-renderer');
      if (!repliesContainer) return replies;

      const replyItems = repliesContainer.querySelectorAll(
        'ytd-comment-view-model, ytd-comment-renderer, #expander-contents ytd-comment-view-model, #expander-contents ytd-comment-renderer'
      );

      for (const item of Array.from(replyItems)) {
        const itemId = item.getAttribute('comment-id') || item.getAttribute('data-comment-id') || '';
        if (itemId && parentCommentId && itemId === parentCommentId) continue;

        const contentEl = item.querySelector('#content-text, yt-attributed-string#content-text, .yt-core-attributed-string');
        const rawText = contentEl?.textContent?.trim() || '';
        if (!rawText) continue;
        if (parentRawText && rawText === parentRawText.trim()) continue;

        const authorEl = item.querySelector('#author-text span, #author-text, #header-author span');
        const authorName = authorEl?.textContent?.trim() || 'ユーザー';

        const authorAvatarUrl = extractAvatarUrl(item);

        const authorAnchor = item.querySelector<HTMLAnchorElement>(
          'a#author-text, #author-text a, a#author-thumbnail, #author-thumbnail a, a.yt-simple-endpoint[href*="/@"], a.yt-simple-endpoint[href*="/channel/"]'
        );
        let authorChannelUrl = '';
        const anchorHref = authorAnchor?.getAttribute('href') || '';
        if (anchorHref) {
          authorChannelUrl = anchorHref.startsWith('http') ? anchorHref : `https://www.youtube.com${anchorHref}`;
        }

        const likeEl = item.querySelector('#vote-count-middle, #vote-count-left, .yt-spec-button-shape-next__button-text-content');
        const likeText = likeEl?.textContent?.trim() || '0';
        const likeCount = parseLikeCountText(likeText);

        const timeEl = item.querySelector('#published-time-text a, #published-time-text');
        const publishedTimeText = timeEl?.textContent?.trim() || '';

        const replyId = itemId || `dom_reply_${authorName}_${rawText.slice(0, 10)}`;

        replies.push({
          id: replyId,
          authorName,
          authorAvatarUrl,
          authorChannelUrl,
          rawText,
          likeCount,
          formattedLikeCount: likeText || '0',
          publishedTimeText,
        });
      }
    } catch {
      // ignore
    }
    return replies;
  }

  function parseRepliesFromJson(json: any, parentCommentId?: string, parentRawText?: string): any[] {
    const replies: any[] = [];
    const seenIds = new Set<string>();
    if (!json || typeof json !== 'object') return replies;

    const isParent = (r: any): boolean => {
      if (!r) return true;
      if (parentCommentId && r.id === parentCommentId) return true;
      if (parentRawText && r.rawText && r.rawText.trim() === parentRawText.trim()) return true;
      return false;
    };

    const parseReplyViewModel = (cvm: any): any | null => {
      try {
        if (!cvm || typeof cvm !== 'object') return null;
        let rawText = '';
        const contentTextObj = cvm.contentText;
        if (typeof contentTextObj?.content === 'string') rawText = contentTextObj.content;
        else if (Array.isArray(contentTextObj?.runs)) rawText = contentTextObj.runs.map((r: any) => r.text || '').join('');
        else if (typeof cvm.content?.content === 'string') rawText = cvm.content.content;
        else if (typeof cvm.properties?.content?.content === 'string') rawText = cvm.properties.content.content;
        if (!rawText) return null;

        let authorName = 'ユーザー';
        const authorTextObj = cvm.authorText;
        if (typeof authorTextObj?.content === 'string') authorName = authorTextObj.content;
        else if (typeof cvm.authorName === 'string') authorName = cvm.authorName;

        let authorAvatarUrl = '';
        const avatarSources = cvm.avatar?.image?.sources;
        if (Array.isArray(avatarSources) && avatarSources.length > 0) {
          authorAvatarUrl = avatarSources[avatarSources.length - 1].url;
        }

        let authorChannelUrl = '';
        const be = cvm.authorEndpoint?.browseEndpoint || cvm.authorChannelCommand?.browseEndpoint;
        if (be?.canonicalBaseUrl) authorChannelUrl = `https://www.youtube.com${be.canonicalBaseUrl}`;
        else if (be?.browseId) authorChannelUrl = `https://www.youtube.com/channel/${be.browseId}`;
        else if (typeof cvm.authorChannelId === 'string') authorChannelUrl = `https://www.youtube.com/channel/${cvm.authorChannelId}`;
        else if (authorName.startsWith('@')) authorChannelUrl = `https://www.youtube.com/${authorName}`;

        const likeText = String(cvm.likeCount || cvm.voteCount || cvm.toolbar?.likeCount || '0');
        const likeCount = parseLikeCountText(likeText);
        const publishedTimeText = typeof cvm.publishedTimeText?.content === 'string' ? cvm.publishedTimeText.content : '';
        const id = String(cvm.commentId || `reply_${authorName}_${Date.now()}`);

        return { id, authorName, authorAvatarUrl, authorChannelUrl, rawText, likeCount, formattedLikeCount: likeText, publishedTimeText };
      } catch {
        return null;
      }
    };

    const parseReplyEntityPayload = (cep: any): any | null => {
      try {
        if (!cep || typeof cep !== 'object') return null;
        let rawText = '';
        const propContent = cep.properties?.content;
        if (typeof propContent?.content === 'string') rawText = propContent.content;
        else if (Array.isArray(propContent?.runs)) rawText = propContent.runs.map((r: any) => r.text || '').join('');
        else if (typeof cep.content?.content === 'string') rawText = cep.content.content;
        if (!rawText) return null;

        const authorName = cep.author?.displayName || cep.author?.channelTitle || 'ユーザー';
        let authorAvatarUrl = cep.author?.avatarThumbnailUrl || '';
        if (!authorAvatarUrl && Array.isArray(cep.author?.avatar?.image?.sources)) {
          const srcs = cep.author.avatar.image.sources;
          authorAvatarUrl = srcs[srcs.length - 1]?.url || '';
        }

        let authorChannelUrl = '';
        const be = cep.author?.channelCommand?.innertubeCommand?.browseEndpoint ||
          cep.author?.command?.innertubeCommand?.browseEndpoint;
        if (be?.canonicalBaseUrl) authorChannelUrl = `https://www.youtube.com${be.canonicalBaseUrl}`;
        else if (be?.browseId) authorChannelUrl = `https://www.youtube.com/channel/${be.browseId}`;
        else if (typeof cep.author?.channelId === 'string') authorChannelUrl = `https://www.youtube.com/channel/${cep.author.channelId}`;

        const likeText = String(cep.toolbar?.likeCountNotliked || cep.toolbar?.likeCount || '0');
        const likeCount = parseLikeCountText(likeText);
        const publishedTimeText = typeof cep.properties?.publishedTime === 'string' ? cep.properties.publishedTime : '';
        const id = String(cep.properties?.commentId || cep.commentId || `reply_${authorName}_${Date.now()}`);

        return { id, authorName, authorAvatarUrl, authorChannelUrl, rawText, likeCount, formattedLikeCount: likeText, publishedTimeText };
      } catch {
        return null;
      }
    };

    const parseReplyRenderer = (cr: any): any | null => {
      try {
        const rawText = cr.contentText?.runs?.map((r: any) => r.text).join('') || '';
        if (!rawText) return null;
        const authorName = cr.authorText?.simpleText || 'ユーザー';
        const thumbs = cr.authorThumbnail?.thumbnails;
        const authorAvatarUrl = thumbs && thumbs.length > 0 ? thumbs[thumbs.length - 1].url : '';
        const be = cr.authorEndpoint?.browseEndpoint;
        let authorChannelUrl = '';
        if (be?.canonicalBaseUrl) authorChannelUrl = `https://www.youtube.com${be.canonicalBaseUrl}`;
        else if (be?.browseId) authorChannelUrl = `https://www.youtube.com/channel/${be.browseId}`;
        const likeCount = Number(cr.likeCount || 0);
        const formattedLikeCount = cr.voteCount?.simpleText || String(likeCount);
        const publishedTimeText = cr.publishedTimeText?.runs?.map((r: any) => r.text).join('') || '';
        const id = String(cr.commentId || `reply_${authorName}_${Date.now()}`);
        return { id, authorName, authorAvatarUrl, authorChannelUrl, rawText, likeCount, formattedLikeCount, publishedTimeText };
      } catch {
        return null;
      }
    };

    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if ('commentViewModel' in node) {
        const r = parseReplyViewModel(node.commentViewModel);
        if (r && !isParent(r) && !seenIds.has(r.id)) {
          seenIds.add(r.id);
          replies.push(r);
        }
      }
      if ('commentEntityPayload' in node) {
        const r = parseReplyEntityPayload(node.commentEntityPayload);
        if (r && !isParent(r) && !seenIds.has(r.id)) {
          seenIds.add(r.id);
          replies.push(r);
        }
      }
      if ('commentRenderer' in node) {
        const r = parseReplyRenderer(node.commentRenderer);
        if (r && !isParent(r) && !seenIds.has(r.id)) {
          seenIds.add(r.id);
          replies.push(r);
        }
      }
      for (const k of Object.keys(node)) {
        if (k === 'secondaryResults' || k === 'relatedVideos' || k === 'watchNextEndScreenRenderer') continue;
        walk(node[k]);
      }
    };

    walk(json);
    return replies;
  }

  function findReplyTokenForCommentInJson(json: any, commentId: string): string | null {
    if (!json || typeof json !== 'object') return null;
    let foundToken: string | null = null;

    const walk = (node: any) => {
      if (foundToken || !node || typeof node !== 'object') return;

      if ('commentThreadRenderer' in node) {
        const ctr = node.commentThreadRenderer;
        const cId = extractCommentIdFromThread(ctr);

        if (!commentId || (cId && (cId === commentId || commentId.includes(cId) || cId.includes(commentId)))) {
          const t = findTokenInReplies(ctr.replies) || findTokenInReplies(ctr);
          if (t) {
            foundToken = t;
            return;
          }
        }
      }

      for (const k of Object.keys(node)) {
        if (k === 'secondaryResults' || k === 'relatedVideos' || k === 'watchNextEndScreenRenderer') continue;
        walk(node[k]);
        if (foundToken) return;
      }
    };

    walk(json);
    return foundToken;
  }

  function findAnyReplyToken(json: any): string | null {
    if (!json || typeof json !== 'object') return null;
    let foundToken: string | null = null;

    const walk = (node: any) => {
      if (foundToken || !node || typeof node !== 'object') return;

      if ('commentRepliesRenderer' in node || 'replies' in node) {
        const target = node.commentRepliesRenderer || node.replies;
        const t = findTokenInReplies(target);
        if (t) {
          foundToken = t;
          return;
        }
      }

      // continuationCommand 直下
      if (node.continuationCommand && typeof node.continuationCommand.token === 'string' && node.continuationCommand.token.length > 20) {
        foundToken = node.continuationCommand.token;
        return;
      }

      for (const k of Object.keys(node)) {
        if (k === 'secondaryResults' || k === 'relatedVideos' || k === 'watchNextEndScreenRenderer') continue;
        walk(node[k]);
        if (foundToken) return;
      }
    };

    walk(json);
    return foundToken;
  }

  async function fetchRepliesViaLinkedComment(
    config: any,
    videoId: string,
    commentId: string,
    rawText?: string,
    debugLog?: string[]
  ): Promise<any[]> {
    try {
      const url = `/youtubei/v1/next?key=${encodeURIComponent(config.apiKey)}&prettyPrint=false`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': config.clientVersion || '2.20240101.00.00',
      };
      if (config.visitorData) headers['X-Goog-Visitor-Id'] = config.visitorData;

      const payload = {
        context: {
          client: {
            hl: navigator.language || 'ja',
            gl: 'JP',
            clientName: config.clientName || 'WEB',
            clientVersion: config.clientVersion || '2.20240101.00.00',
            visitorData: config.visitorData || undefined,
          },
        },
        videoId: videoId || getVideoIdFromUrl(),
        linkedCommentId: commentId,
      };

      debugLog?.push('linkedCommentId API要求送信');
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });

      if (!res.ok) {
        debugLog?.push(`linkedCommentId HTTPエラー ${res.status}`);
        return [];
      }

      const json = await res.json();
      extractAllCommentTokens(json);

      // 1. レスポンス内にすでに返信アイテムが存在するかチェック
      const directReplies = parseRepliesFromJson(json, commentId, rawText);
      if (directReplies.length > 0) {
        debugLog?.push(`linkedCommentId直接応答から返信検出 (${directReplies.length}件)`);
        return directReplies;
      }

      // 2. 返信が直接入っていない場合: 返信展開用 Continuation Token を探索
      let replyToken: string | null | undefined = commentTokenCache.get(commentId);
      if (!replyToken) {
        replyToken = findReplyTokenForCommentInJson(json, commentId);
      }
      if (!replyToken) {
        replyToken = findAnyReplyToken(json);
      }

      if (replyToken) {
        debugLog?.push(`linkedCommentId応答から返信トークン検出 -> 2ndフェッチ実行`);
        const replyPayload = {
          context: payload.context,
          continuation: replyToken,
        };

        const replyRes = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(replyPayload),
          credentials: 'same-origin',
        });

        if (replyRes.ok) {
          const replyJson = await replyRes.json();
          const nestedReplies = parseRepliesFromJson(replyJson, commentId, rawText);
          if (nestedReplies.length > 0) {
            debugLog?.push(`返信Continuationより返信取得成功 (${nestedReplies.length}件)`);
            return nestedReplies;
          } else {
            debugLog?.push('返信Continuation応答200だが返信0件');
          }
        } else {
          debugLog?.push(`返信Continuation HTTPエラー ${replyRes.status}`);
        }
      } else {
        debugLog?.push('linkedCommentId応答内に返信Token未検出');
      }
    } catch (err: any) {
      debugLog?.push(`linkedCommentId例外: ${err?.message || err}`);
    }
    return [];
  }

  async function handleFetchRepliesInMainWorld() {
    let debugLog: string[] = [];
    let errCode = 'E-101:NO_REPLIES_FOUND';

    try {
      const reqEl = document.getElementById(REPLY_REQ_EL_ID);
      if (!reqEl || !reqEl.textContent) return;
      const req = JSON.parse(reqEl.textContent);
      const { reqId, commentId, rawText } = req;
      let token = req.token;
      const videoId = req.videoId || getVideoIdFromUrl();

      debugLog.push(`開始 (ID:${commentId ? commentId.slice(0, 15) : 'なし'}, Token:${token ? '有' : '無'})`);

      // 1. トークンがなければメモリ内キャッシュから探索
      if (!token && commentId) {
        token = commentTokenCache.get(commentId);
        if (token) debugLog.push('トークンキャッシュから解決');
      }

      // それでもなければ、保持している全レスポンスと initialData からトークンを再探索
      if (!token && commentId) {
        for (const resp of cachedResponses) {
          extractAllCommentTokens(resp);
          token = commentTokenCache.get(commentId);
          if (token) break;
        }
        if (!token) {
          const config = getInnertubeConfig();
          if (config?.initialData) {
            extractAllCommentTokens(config.initialData);
            token = commentTokenCache.get(commentId);
          }
        }
        if (token) debugLog.push('全レスポンス探索からトークン解決');
      }

      // 2. DOM上の該当スレッド要素を探索
      let threadEl: any = null;
      if (commentId) {
        threadEl = document.querySelector(
          `ytd-comment-thread-renderer[data-yt-overlay-comment-id="${commentId}"], [data-yt-overlay-comment-id="${commentId}"], [comment-id="${commentId}"]`
        );
        if (threadEl && threadEl.tagName !== 'YTD-COMMENT-THREAD-RENDERER') {
          threadEl = threadEl.closest('ytd-comment-thread-renderer') || threadEl;
        }
      }

      if (!threadEl && rawText) {
        const clean = rawText.trim().replace(/\s+/g, ' ');
        if (clean.length >= 4) {
          const prefix = clean.slice(0, 25);
          const all = document.querySelectorAll('ytd-comment-thread-renderer');
          for (const t of Array.from(all)) {
            const c = (t.querySelector('#content-text, .yt-core-attributed-string')?.textContent || '').trim().replace(/\s+/g, ' ');
            if (c.includes(prefix) || prefix.includes(c.slice(0, 25))) {
              threadEl = t;
              break;
            }
          }
        }
      }

      if (threadEl) {
        debugLog.push('DOMスレッド検出');
        // すでにDOM上に返信が展開されている場合は即座に抽出
        const domReplies = extractRepliesFromThreadDom(threadEl, commentId, rawText);
        if (domReplies.length > 0) {
          debugLog.push(`DOM展開済み返信取得 (${domReplies.length}件)`);
          writeToEl(REPLY_RES_EL_ID, { reqId, replies: domReplies, errCode: 'OK', debug: debugLog.join(' > ') });
          window.dispatchEvent(new CustomEvent('YT_COMMENT_OVERLAY_REPLIES_READY'));
          return;
        }
        // スレッド内部データからトークン探索
        if (!token) {
          const data = threadEl.data || threadEl.__data;
          if (data) {
            token = findTokenInReplies(data);
            if (token) debugLog.push('スレッド内部データからToken検出');
          }
        }
      } else {
        debugLog.push('DOMスレッド未検出');
      }

      const config = getInnertubeConfig();

      // 3. トークンがある場合は InnerTube API をフェッチ
      if (token && config?.apiKey) {
        debugLog.push('InnerTube APIフェッチ試行');
        try {
          const url = `/youtubei/v1/next?key=${encodeURIComponent(config.apiKey)}&prettyPrint=false`;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-YouTube-Client-Name': '1',
            'X-YouTube-Client-Version': config.clientVersion || '2.20240101.00.00',
          };
          if (config.visitorData) headers['X-Goog-Visitor-Id'] = config.visitorData;

          const payload = {
            context: {
              client: {
                hl: navigator.language || 'ja',
                gl: 'JP',
                clientName: config.clientName || 'WEB',
                clientVersion: config.clientVersion || '2.20240101.00.00',
                visitorData: config.visitorData || undefined,
              },
            },
            continuation: token,
          };

          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            credentials: 'same-origin',
          });

          if (res.ok) {
            const json = await res.json();
            const replies = parseRepliesFromJson(json, commentId, rawText);
            if (replies.length > 0) {
              debugLog.push(`APIより返信パース成功 (${replies.length}件)`);
              writeToEl(REPLY_RES_EL_ID, { reqId, replies, errCode: 'OK', debug: debugLog.join(' > ') });
              window.dispatchEvent(new CustomEvent('YT_COMMENT_OVERLAY_REPLIES_READY'));
              return;
            } else {
              debugLog.push('API応答は正常だが返信0件');
            }
          } else {
            debugLog.push(`APIエラー HTTP ${res.status}`);
          }
        } catch (fetchErr: any) {
          debugLog.push(`API例外: ${fetchErr?.message || fetchErr}`);
        }
      }

      // 4. トークンが無い、またはトークン取得で返信0件の場合: linkedCommentId による API 直接フェッチ！
      if (commentId && config?.apiKey) {
        debugLog.push('linkedCommentId APIフェッチ試行');
        const linkedReplies = await fetchRepliesViaLinkedComment(config, videoId, commentId, rawText, debugLog);
        if (linkedReplies && linkedReplies.length > 0) {
          debugLog.push(`linkedCommentIdより返信取得成功 (${linkedReplies.length}件)`);
          writeToEl(REPLY_RES_EL_ID, { reqId, replies: linkedReplies, errCode: 'OK', debug: debugLog.join(' > ') });
          window.dispatchEvent(new CustomEvent('YT_COMMENT_OVERLAY_REPLIES_READY'));
          return;
        }
        debugLog.push('linkedCommentId返信0件');
      }

      // 5. APIで取得できなかった場合は、DOM上の返信ボタンを MAIN ワールドからクリック！
      if (!threadEl) {
        debugLog.push('DOMコメント初期化トリガー実行');
        triggerDomCommentsLoad();
        await new Promise((r) => setTimeout(r, 300));
        if (commentId) {
          threadEl = document.querySelector(
            `ytd-comment-thread-renderer[data-yt-overlay-comment-id="${commentId}"], [data-yt-overlay-comment-id="${commentId}"], [comment-id="${commentId}"]`
          );
          if (threadEl && threadEl.tagName !== 'YTD-COMMENT-THREAD-RENDERER') {
            threadEl = threadEl.closest('ytd-comment-thread-renderer') || threadEl;
          }
        }
        if (threadEl) debugLog.push('初期化後にDOMスレッド検出');
      }

      if (threadEl) {
        const repliesContainer = threadEl.querySelector('#replies, ytd-comment-replies-renderer');
        if (repliesContainer) {
          const btn = repliesContainer.querySelector(
            'ytd-button-renderer button, button#button, tp-yt-paper-button, .yt-spec-button-shape-next, ytd-button-renderer'
          ) as HTMLElement;
          if (btn) {
            debugLog.push('DOM返信ボタンクリック');
            const actualBtn = (btn.querySelector('button') || btn) as HTMLElement;
            actualBtn.click();
            for (let i = 0; i < 22; i++) {
              await new Promise((r) => setTimeout(r, 150));
              const replies = extractRepliesFromThreadDom(threadEl, commentId, rawText);
              if (replies.length > 0) {
                debugLog.push(`DOM展開ポーリング成功 (${replies.length}件)`);
                writeToEl(REPLY_RES_EL_ID, { reqId, replies, errCode: 'OK', debug: debugLog.join(' > ') });
                window.dispatchEvent(new CustomEvent('YT_COMMENT_OVERLAY_REPLIES_READY'));
                return;
              }
            }
            errCode = 'E-207:DOM_POLL_TIMEOUT';
            debugLog.push('DOM返信展開ポーリング待機タイムアウト');
          } else {
            errCode = 'E-206:DOM_BTN_NOT_FOUND';
            debugLog.push('DOM返信展開ボタンなし');
          }
        } else {
          errCode = 'E-206:REPLIES_CONTAINER_NOT_FOUND';
          debugLog.push('#repliesコンテナなし');
        }
      } else {
        errCode = 'E-203:NO_TOKEN_NO_DOM';
        debugLog.push('トークンなし & linkedComment返信なし & DOMスレッド未描画');
      }

      writeToEl(REPLY_RES_EL_ID, { reqId, replies: [], errCode, debug: debugLog.join(' > ') });
      window.dispatchEvent(new CustomEvent('YT_COMMENT_OVERLAY_REPLIES_READY'));
    } catch (e: any) {
      debugLog.push(`致命的例外: ${e?.message || e}`);
      writeToEl(REPLY_RES_EL_ID, { replies: [], errCode: 'E-301:BRIDGE_EXCEPTION', debug: debugLog.join(' > ') });
      window.dispatchEvent(new CustomEvent('YT_COMMENT_OVERLAY_REPLIES_READY'));
    }
  }

  // ─── イベントリスナー ─────────────────────────

  // Content Script からの返信フェッチリクエスト
  window.addEventListener('YT_COMMENT_OVERLAY_FETCH_REPLIES', () => {
    handleFetchRepliesInMainWorld();
  });

  // Content Script からのリクエスト
  window.addEventListener('YT_COMMENT_OVERLAY_REQUEST_MAIN_DATA', () => {
    broadcastData();
  });

  // YouTube SPA 遷移完了
  window.addEventListener('yt-navigate-finish', (e: any) => {
    lastSuccessfulVideoId = '';
    isFetchingInMainWorld = false;
    const navResponse = e?.detail?.response;
    if (navResponse) {
      broadcastData(navResponse);
    } else {
      setTimeout(broadcastData, 100);
      setTimeout(broadcastData, 600);
      setTimeout(broadcastData, 1500);
    }
  });

  // YouTube 初期データ更新完了
  window.addEventListener('yt-page-data-updated', () => {
    setTimeout(broadcastData, 200);
  });

  // 初期実行
  broadcastData();
  setTimeout(broadcastData, 400);
  setTimeout(broadcastData, 1200);
  setTimeout(broadcastData, 2500);
  setTimeout(broadcastData, 5000);
})();
