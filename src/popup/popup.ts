import { DEFAULT_SETTINGS, DisplayMode, FlowDensity, FlowSpeed, OverlayPosition, OverlaySettings, OverlaySize } from '../types';
import { getSettings, saveSettings } from '../utils/storage';

type SupportedLang = 'ja' | 'en' | 'es' | 'zh';

interface I18nStrings {
  title: string;
  subtitle: string;
  tabTimestamp: string;
  tabLive: string;
  // タイムスタンプ
  tsEnableTitle: string;
  tsEnableDesc: string;
  tsModeLabel: string;
  modeCard: string;
  modeFlow: string;
  modeChatbox: string;
  position: string;
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  size: string;
  sizeSmall: string;
  sizeMedium: string;
  sizeLarge: string;
  duration: string;
  durationUnit: string;
  stack: string;
  stackUnit: string;
  opacity: string;
  flowSize: string;
  flowSpeed: string;
  flowOpacity: string;
  speedSlow: string;
  speedNormal: string;
  speedFast: string;
  highlightTitle: string;
  highlightDesc: string;
  tsAvatarsTitle: string;
  tsAvatarsDesc: string;
  tsPipTitle: string;
  tsPipDesc: string;
  tsPipLaunch: string;
  // ライブ
  liveYtTitle: string;
  liveYtDesc: string;
  liveTwitchTitle: string;
  liveTwitchDesc: string;
  liveModeLabel: string;
  density: string;
  densityLow: string;
  densityNormal: string;
  densityHigh: string;
  liveBadgesTitle: string;
  liveBadgesDesc: string;
  liveUserColorTitle: string;
  liveUserColorDesc: string;
  liveAvatarsTitle: string;
  liveAvatarsDesc: string;
  livePipTitle: string;
  livePipDesc: string;
  livePipLaunch: string;
  // 共通
  testBtn: string;
  savedText: string;
  savingText: string;
  testSending: string;
  testSuccess: string;
  testFallback: string;
  testCommentText: string;
  testAuthor: string;
  supportDev: string;
}

const I18N_DATA: Record<SupportedLang, I18nStrings> = {
  ja: {
    title: 'TimeBubble',
    subtitle: 'YouTube & Twitch コメントオーバーレイ',
    tabTimestamp: 'タイムスタンプ',
    tabLive: 'ライブ',
    tsEnableTitle: 'タイムスタンプコメント表示',
    tsEnableDesc: '再生位置に合わせてコメントを画面上に表示',
    tsModeLabel: '表示モード',
    modeCard: 'カード',
    modeFlow: '流れる',
    modeChatbox: 'ログ',
    position: '表示位置',
    topLeft: '左上',
    topRight: '右上',
    bottomLeft: '左下',
    bottomRight: '右下',
    size: '表示サイズ',
    sizeSmall: '小',
    sizeMedium: '中',
    sizeLarge: '大',
    duration: '表示時間',
    durationUnit: '秒',
    stack: '最大スタック件数',
    stackUnit: '件',
    opacity: '不透明度',
    flowSize: '文字サイズ',
    flowSpeed: '流れる速度',
    flowOpacity: '背景の不透明度',
    speedSlow: '遅い',
    speedNormal: '普通',
    speedFast: '速い',
    highlightTitle: '高評価コメントをハイライト',
    highlightDesc: 'いいね数に応じてグラデーションと光彩を適用',
    tsAvatarsTitle: 'ユーザーアイコンを表示',
    tsAvatarsDesc: 'コメントに投稿者のアバターを表示',
    tsPipTitle: 'PiP ウィンドウにコメントを表示',
    tsPipDesc: 'ピクチャインピクチャ再生中もコメントを合成描画',
    tsPipLaunch: '今すぐコメント付きPiPを開始',
    liveYtTitle: 'YouTube Live チャット表示',
    liveYtDesc: '生配信・アーカイブのリアルタイムチャットを動画上に流す',
    liveTwitchTitle: 'Twitch 配信チャット表示',
    liveTwitchDesc: 'Twitchのライブ配信・VODでチャットを動画上に流す',
    liveModeLabel: '表示モード',
    density: 'チャット流量密度 (負荷制御)',
    densityLow: '控えめ',
    densityNormal: '標準',
    densityHigh: 'すべて',
    liveBadgesTitle: 'バッジ表示',
    liveBadgesDesc: '公式・モデレーター・VIP・メンバー等のバッジを表示',
    liveUserColorTitle: 'ユーザーカラー表示',
    liveUserColorDesc: '投稿者のネームカラー・文字色の着色を表示',
    liveAvatarsTitle: 'ユーザーアイコンを表示',
    liveAvatarsDesc: 'チャットに投稿者のアバターを表示',
    livePipTitle: 'PiP ウィンドウにチャットを表示',
    livePipDesc: 'ピクチャインピクチャ再生中もチャットを合成描画',
    livePipLaunch: '今すぐチャット付きPiPを開始',
    testBtn: '現在の画面にテストコメントを表示',
    savedText: '設定は自動保存されます',
    savingText: '設定を保存しました',
    testSending: '送信中...',
    testSuccess: '現在の画面にテスト表示しました',
    testFallback: 'プレビューを表示しました',
    testCommentText: '01:23 ここが一番好きなシーン！何度見ても最高です✨',
    testAuthor: 'テスト視聴者',
    supportDev: '開発者をサポート',
  },
  en: {
    title: 'TimeBubble',
    subtitle: 'YouTube & Twitch Comment Overlay',
    tabTimestamp: 'Timestamps',
    tabLive: 'Live Streams',
    tsEnableTitle: 'Timestamp Comments',
    tsEnableDesc: 'Show comments synced with playback position',
    tsModeLabel: 'Display Mode',
    modeCard: 'Card',
    modeFlow: 'Flow',
    modeChatbox: 'Log',
    position: 'Position',
    topLeft: 'Top Left',
    topRight: 'Top Right',
    bottomLeft: 'Bottom Left',
    bottomRight: 'Bottom Right',
    size: 'Size',
    sizeSmall: 'Small',
    sizeMedium: 'Medium',
    sizeLarge: 'Large',
    duration: 'Duration',
    durationUnit: 's',
    stack: 'Max Stack',
    stackUnit: '',
    opacity: 'Opacity',
    flowSize: 'Font Size',
    flowSpeed: 'Speed',
    flowOpacity: 'Background Opacity',
    speedSlow: 'Slow',
    speedNormal: 'Normal',
    speedFast: 'Fast',
    highlightTitle: 'Highlight Top Comments',
    highlightDesc: 'Apply gradient and glow based on likes',
    tsAvatarsTitle: 'Show User Avatars',
    tsAvatarsDesc: 'Display user avatars in comments',
    tsPipTitle: 'Show Comments in PiP',
    tsPipDesc: 'Render comments inside Picture-in-Picture window',
    tsPipLaunch: 'Start PiP with Comments Now',
    liveYtTitle: 'YouTube Live Chat',
    liveYtDesc: 'Display live and replay stream chats over video',
    liveTwitchTitle: 'Twitch Chat',
    liveTwitchDesc: 'Display Twitch live and VOD chats over video',
    liveModeLabel: 'Display Mode',
    density: 'Chat Density (Traffic Control)',
    densityLow: 'Low',
    densityNormal: 'Normal',
    densityHigh: 'All',
    liveBadgesTitle: 'Show Badges',
    liveBadgesDesc: 'Display moderator, VIP, and member badges',
    liveUserColorTitle: 'Show User Colors',
    liveUserColorDesc: 'Color user names and chat text',
    liveAvatarsTitle: 'Show User Avatars',
    liveAvatarsDesc: 'Display user avatars in chat messages',
    livePipTitle: 'Show Chat in PiP',
    livePipDesc: 'Render live chat inside Picture-in-Picture window',
    livePipLaunch: 'Start PiP with Chat Now',
    testBtn: 'Show Test Comment on Screen',
    savedText: 'Settings are saved automatically',
    savingText: 'Settings saved',
    testSending: 'Sending...',
    testSuccess: 'Test comment displayed on screen',
    testFallback: 'Preview displayed',
    testCommentText: '01:23 Best scene ever! Absolutely love this part ✨',
    testAuthor: 'Viewer',
    supportDev: 'Support Developer',
  },
  es: {
    title: 'TimeBubble',
    subtitle: 'Comentarios de YouTube y Twitch',
    tabTimestamp: 'Marcas de tiempo',
    tabLive: 'En Vivo',
    tsEnableTitle: 'Comentarios con Marca',
    tsEnableDesc: 'Mostrar comentarios sincronizados con el video',
    tsModeLabel: 'Modo de visualización',
    modeCard: 'Tarjeta',
    modeFlow: 'Flujo',
    modeChatbox: 'Registro',
    position: 'Posición',
    topLeft: 'Arriba Izq.',
    topRight: 'Arriba Der.',
    bottomLeft: 'Abajo Izq.',
    bottomRight: 'Abajo Der.',
    size: 'Tamaño',
    sizeSmall: 'Pequeño',
    sizeMedium: 'Medio',
    sizeLarge: 'Grande',
    duration: 'Duración',
    durationUnit: 's',
    stack: 'Pila Máxima',
    stackUnit: '',
    opacity: 'Opacidad',
    flowSize: 'Tamaño de Letra',
    flowSpeed: 'Velocidad',
    flowOpacity: 'Opacidad del Fondo',
    speedSlow: 'Lento',
    speedNormal: 'Normal',
    speedFast: 'Rápido',
    highlightTitle: 'Destacar Populares',
    highlightDesc: 'Aplica brillo según los likes',
    tsAvatarsTitle: 'Mostrar avatares de usuario',
    tsAvatarsDesc: 'Mostrar fotos de perfil en comentarios',
    tsPipTitle: 'Mostrar en ventana PiP',
    tsPipDesc: 'Dibujar comentarios en Picture-in-Picture',
    tsPipLaunch: 'Iniciar PiP con Comentarios',
    liveYtTitle: 'Chat de YouTube Live',
    liveYtDesc: 'Mostrar chat en vivo sobre el reproductor',
    liveTwitchTitle: 'Chat de Twitch',
    liveTwitchDesc: 'Mostrar chat de transmisiones y VODs',
    liveModeLabel: 'Modo de visualización',
    density: 'Densidad del Chat',
    densityLow: 'Bajo',
    densityNormal: 'Normal',
    densityHigh: 'Todos',
    liveBadgesTitle: 'Mostrar insignias',
    liveBadgesDesc: 'Mostrar insignias de moderador, VIP y miembro',
    liveUserColorTitle: 'Mostrar colores de usuario',
    liveUserColorDesc: 'Colorear nombres de usuario y texto del chat',
    liveAvatarsTitle: 'Mostrar avatares de usuario',
    liveAvatarsDesc: 'Mostrar fotos de perfil en el chat',
    livePipTitle: 'Mostrar Chat en PiP',
    livePipDesc: 'Dibujar chat en Picture-in-Picture',
    livePipLaunch: 'Iniciar PiP con Chat',
    testBtn: 'Mostrar Comentario de Prueba',
    savedText: 'Los ajustes se guardan automáticamente',
    savingText: 'Ajustes guardados',
    testSending: 'Enviando...',
    testSuccess: 'Comentario de prueba mostrado',
    testFallback: 'Vista previa mostrada',
    testCommentText: '01:23 ¡La mejor escena de todas! Me encanta ✨',
    testAuthor: 'Espectador',
    supportDev: 'Apoyar al desarrollador',
  },
  zh: {
    title: 'TimeBubble',
    subtitle: 'YouTube & Twitch 弹幕/评论覆盖',
    tabTimestamp: '时间戳评论',
    tabLive: '直播弹幕',
    tsEnableTitle: '时间戳评论显示',
    tsEnableDesc: '根据播放进度在屏幕上同步显示精彩评论',
    tsModeLabel: '显示模式',
    modeCard: '卡片',
    modeFlow: '弹幕',
    modeChatbox: '日志',
    position: '显示位置',
    topLeft: '左上',
    topRight: '右上',
    bottomLeft: '左下',
    bottomRight: '右下',
    size: '显示尺寸',
    sizeSmall: '小',
    sizeMedium: '中',
    sizeLarge: '大',
    duration: '显示时长',
    durationUnit: '秒',
    stack: '最大叠加数量',
    stackUnit: '条',
    opacity: '不透明度',
    flowSize: '字体大小',
    flowSpeed: '滚动速度',
    flowOpacity: '背景不透明度',
    speedSlow: '慢速',
    speedNormal: '标准',
    speedFast: '快速',
    highlightTitle: '高赞评论高亮',
    highlightDesc: '根据点赞数应用渐变与光晕效果',
    tsAvatarsTitle: '显示用户头像',
    tsAvatarsDesc: '在评论中显示作者头像',
    tsPipTitle: '在画中画(PiP)窗口显示评论',
    tsPipDesc: '画中画播放时同步合成绘制评论',
    tsPipLaunch: '立即开启带评论的画中画',
    liveYtTitle: 'YouTube Live 聊天显示',
    liveYtDesc: '在视频上实时显示直播与回放聊天',
    liveTwitchTitle: 'Twitch 弹幕显示',
    liveTwitchDesc: '在视频上实时显示Twitch直播与录像聊天',
    liveModeLabel: '显示模式',
    density: '弹幕流量密度 (负载控制)',
    densityLow: '少量',
    densityNormal: '标准',
    densityHigh: '全部',
    liveBadgesTitle: '显示徽章',
    liveBadgesDesc: '显示房管、VIP、会员等徽章',
    liveUserColorTitle: '显示用户颜色',
    liveUserColorDesc: '显示发言者昵称与文字颜色',
    liveAvatarsTitle: '显示用户头像',
    liveAvatarsDesc: '在聊天弹幕中显示作者头像',
    livePipTitle: '在画中画(PiP)窗口显示弹幕',
    livePipDesc: '画中画播放时同步合成绘制聊天弹幕',
    livePipLaunch: '立即开启带弹幕的画中画',
    testBtn: '在当前屏幕显示测试评论',
    savedText: '设置已自动保存',
    savingText: '设置已保存',
    testSending: '发送中...',
    testSuccess: '已在屏幕显示测试评论',
    testFallback: '已显示预览',
    testCommentText: '01:23 这是最精彩的片段！百看不厌✨',
    testAuthor: '测试观众',
    supportDev: '支持开发者',
  },
};



document.addEventListener('DOMContentLoaded', async () => {
  const langSelect = document.getElementById('lang-select') as HTMLSelectElement | null;

  // ─── ナビゲーションタブ (2大カテゴリ: タイムスタンプ / ライブ) ───
  const tabTsBtn = document.getElementById('tab-ts-btn') as HTMLButtonElement | null;
  const tabLiveBtn = document.getElementById('tab-live-btn') as HTMLButtonElement | null;
  const tabTsPanel = document.getElementById('tab-timestamp-panel') as HTMLElement | null;
  const tabLivePanel = document.getElementById('tab-live-panel') as HTMLElement | null;

  let activeTab: 'timestamp' | 'live' = 'timestamp';

  tabTsBtn?.addEventListener('click', () => {
    activeTab = 'timestamp';
    tabTsBtn.classList.add('active');
    tabLiveBtn?.classList.remove('active');
    if (tabTsPanel) tabTsPanel.style.display = 'block';
    if (tabLivePanel) tabLivePanel.style.display = 'none';
  });

  tabLiveBtn?.addEventListener('click', () => {
    activeTab = 'live';
    tabLiveBtn.classList.add('active');
    tabTsBtn?.classList.remove('active');
    if (tabLivePanel) tabLivePanel.style.display = 'block';
    if (tabTsPanel) tabTsPanel.style.display = 'none';
  });

  // ─── タイムスタンプ用コントロール ───
  const tsEnabledToggle = document.getElementById('ts-enabled-toggle') as HTMLInputElement | null;
  const tsModeCardBtn = document.getElementById('ts-mode-card-btn') as HTMLButtonElement | null;
  const tsModeFlowBtn = document.getElementById('ts-mode-flow-btn') as HTMLButtonElement | null;
  const tsModeChatboxBtn = document.getElementById('ts-mode-chatbox-btn') as HTMLButtonElement | null;
  const tsCardOptions = document.getElementById('ts-card-options') as HTMLElement | null;
  const tsFlowOptions = document.getElementById('ts-flow-options') as HTMLElement | null;
  const tsChatboxOptions = document.getElementById('ts-chatbox-options') as HTMLElement | null;

  // タイムスタンプ: カード
  const tsPosButtons = document.querySelectorAll<HTMLButtonElement>('#ts-card-options .pos-btn');
  const tsSizeButtons = document.querySelectorAll<HTMLButtonElement>('#ts-size-group .size-btn');
  const tsSizeVal = document.getElementById('ts-size-val') as HTMLElement | null;
  const tsDurationSlider = document.getElementById('ts-duration-slider') as HTMLInputElement | null;
  const tsDurationVal = document.getElementById('ts-duration-val') as HTMLElement | null;
  const tsStackSlider = document.getElementById('ts-stack-slider') as HTMLInputElement | null;
  const tsStackVal = document.getElementById('ts-stack-val') as HTMLElement | null;
  const tsOpacitySlider = document.getElementById('ts-opacity-slider') as HTMLInputElement | null;
  const tsOpacityVal = document.getElementById('ts-opacity-val') as HTMLElement | null;

  // タイムスタンプ: フロー
  const tsFlowSizeButtons = document.querySelectorAll<HTMLButtonElement>('#ts-flow-size-group .flow-size-btn');
  const tsFlowSizeVal = document.getElementById('ts-flow-size-val') as HTMLElement | null;
  const tsFlowSpeedButtons = document.querySelectorAll<HTMLButtonElement>('#ts-flow-speed-group .speed-btn');
  const tsFlowSpeedVal = document.getElementById('ts-flow-speed-val') as HTMLElement | null;
  const tsFlowOpacitySlider = document.getElementById('ts-flow-opacity-slider') as HTMLInputElement | null;
  const tsFlowOpacityVal = document.getElementById('ts-flow-opacity-val') as HTMLElement | null;

  // タイムスタンプ: 共通 & PiP
  const tsHighlightToggle = document.getElementById('ts-highlight-toggle') as HTMLInputElement | null;
  const tsAvatarsToggle = document.getElementById('ts-avatars-toggle') as HTMLInputElement | null;
  const tsPipToggle = document.getElementById('ts-pip-toggle') as HTMLInputElement | null;
  const tsTriggerPipBtn = document.getElementById('ts-trigger-pip-btn') as HTMLButtonElement | null;

  // ─── ライブ用コントロール ───
  const ytLiveToggle = document.getElementById('yt-live-toggle') as HTMLInputElement | null;
  const twitchToggle = document.getElementById('twitch-toggle') as HTMLInputElement | null;
  const liveModeFlowBtn = document.getElementById('live-mode-flow-btn') as HTMLButtonElement | null;
  const liveModeChatboxBtn = document.getElementById('live-mode-chatbox-btn') as HTMLButtonElement | null;
  const liveModeCardBtn = document.getElementById('live-mode-card-btn') as HTMLButtonElement | null;
  const liveFlowOptions = document.getElementById('live-flow-options') as HTMLElement | null;
  const liveChatboxOptions = document.getElementById('live-chatbox-options') as HTMLElement | null;
  const liveCardOptions = document.getElementById('live-card-options') as HTMLElement | null;

  // ライブ: フロー
  const liveFlowSizeButtons = document.querySelectorAll<HTMLButtonElement>('#live-flow-size-group .live-flow-size-btn');
  const liveFlowSizeVal = document.getElementById('live-flow-size-val') as HTMLElement | null;
  const liveFlowSpeedButtons = document.querySelectorAll<HTMLButtonElement>('#live-flow-speed-group .speed-btn');
  const liveFlowSpeedVal = document.getElementById('live-flow-speed-val') as HTMLElement | null;
  const liveFlowOpacitySlider = document.getElementById('live-flow-opacity-slider') as HTMLInputElement | null;
  const liveFlowOpacityVal = document.getElementById('live-flow-opacity-val') as HTMLElement | null;
  const liveDensityButtons = document.querySelectorAll<HTMLButtonElement>('#live-density-group .density-btn');
  const liveDensityVal = document.getElementById('live-density-val') as HTMLElement | null;

  // ライブ: ログ
  const liveChatboxDensityButtons = document.querySelectorAll<HTMLButtonElement>('#live-chatbox-density-group .density-btn');
  const liveChatboxDensityVal = document.getElementById('live-chatbox-density-val') as HTMLElement | null;

  // ライブ: カード
  const liveSizeButtons = document.querySelectorAll<HTMLButtonElement>('#live-size-group .size-btn');
  const liveSizeVal = document.getElementById('live-size-val') as HTMLElement | null;
  const liveDurationSlider = document.getElementById('live-duration-slider') as HTMLInputElement | null;
  const liveDurationVal = document.getElementById('live-duration-val') as HTMLElement | null;
  const liveOpacitySlider = document.getElementById('live-opacity-slider') as HTMLInputElement | null;
  const liveOpacityVal = document.getElementById('live-opacity-val') as HTMLElement | null;

  // ライブ: 共通 & PiP
  const liveBadgesToggle = document.getElementById('live-badges-toggle') as HTMLInputElement | null;
  const liveUserColorToggle = document.getElementById('live-user-color-toggle') as HTMLInputElement | null;
  const liveAvatarsToggle = document.getElementById('live-avatars-toggle') as HTMLInputElement | null;
  const livePipToggle = document.getElementById('live-pip-toggle') as HTMLInputElement | null;
  const liveTriggerPipBtn = document.getElementById('live-trigger-pip-btn') as HTMLButtonElement | null;

  // ─── フッター & 共通 ───
  const testCommentBtn = document.getElementById('test-comment-btn') as HTMLButtonElement | null;
  const saveStatus = document.getElementById('save-status') as HTMLElement | null;

  // ロゴアイコンを chrome.runtime.getURL で正しく解決
  const logoImg = document.querySelector<HTMLImageElement>('.header-logo-img');
  if (logoImg && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    logoImg.src = chrome.runtime.getURL('icons/icon-48.png');
  }

  let currentSettings: OverlaySettings = { ...DEFAULT_SETTINGS };
  let currentLang: SupportedLang = 'ja';

  // 言語検出と適用
  function detectInitialLanguage(savedLang?: string): SupportedLang {
    if (savedLang && ['ja', 'en', 'es', 'zh'].includes(savedLang)) {
      return savedLang as SupportedLang;
    }
    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.startsWith('zh')) return 'zh';
    if (navLang.startsWith('es')) return 'es';
    if (navLang.startsWith('en')) return 'en';
    return 'ja';
  }

  function applyLanguage(lang: SupportedLang) {
    currentLang = lang;
    const t = I18N_DATA[lang] || I18N_DATA.ja;

    if (langSelect) langSelect.value = lang;

    const elSubtitle = document.getElementById('i18n-subtitle');
    if (elSubtitle) elSubtitle.textContent = t.subtitle;

    // タブ名
    const elTabTs = document.getElementById('i18n-tab-ts');
    if (elTabTs) elTabTs.textContent = t.tabTimestamp;
    const elTabLive = document.getElementById('i18n-tab-live');
    if (elTabLive) elTabLive.textContent = t.tabLive;

    // タイムスタンプ側 i18n
    const elTsEnableTitle = document.getElementById('i18n-ts-enable-title');
    if (elTsEnableTitle) elTsEnableTitle.textContent = t.tsEnableTitle;
    const elTsEnableDesc = document.getElementById('i18n-ts-enable-desc');
    if (elTsEnableDesc) elTsEnableDesc.textContent = t.tsEnableDesc;
    const elTsModeLabel = document.getElementById('i18n-ts-mode-label');
    if (elTsModeLabel) elTsModeLabel.textContent = t.tsModeLabel;
    const elTsModeCard = document.getElementById('i18n-ts-mode-card');
    if (elTsModeCard) elTsModeCard.textContent = t.modeCard;
    const elTsModeFlow = document.getElementById('i18n-ts-mode-flow');
    if (elTsModeFlow) elTsModeFlow.textContent = t.modeFlow;
    const elTsModeChatbox = document.getElementById('i18n-ts-mode-chatbox');
    if (elTsModeChatbox) elTsModeChatbox.textContent = t.modeChatbox;

    const elTsPosition = document.getElementById('i18n-ts-position');
    if (elTsPosition) elTsPosition.textContent = t.position;
    const elTsPosTl = document.getElementById('i18n-ts-pos-tl');
    if (elTsPosTl) elTsPosTl.textContent = t.topLeft;
    const elTsPosTr = document.getElementById('i18n-ts-pos-tr');
    if (elTsPosTr) elTsPosTr.textContent = t.topRight;
    const elTsPosBl = document.getElementById('i18n-ts-pos-bl');
    if (elTsPosBl) elTsPosBl.textContent = t.bottomLeft;
    const elTsPosBr = document.getElementById('i18n-ts-pos-br');
    if (elTsPosBr) elTsPosBr.textContent = t.bottomRight;

    const elTsSize = document.getElementById('i18n-ts-size');
    if (elTsSize) elTsSize.textContent = t.size;
    const elTsDuration = document.getElementById('i18n-ts-duration');
    if (elTsDuration) elTsDuration.textContent = t.duration;
    const elTsStack = document.getElementById('i18n-ts-stack');
    if (elTsStack) elTsStack.textContent = t.stack;
    const elTsOpacity = document.getElementById('i18n-ts-opacity');
    if (elTsOpacity) elTsOpacity.textContent = t.opacity;

    const elTsFlowSize = document.getElementById('i18n-ts-flow-size');
    if (elTsFlowSize) elTsFlowSize.textContent = t.flowSize;
    const elTsFlowSpeed = document.getElementById('i18n-ts-flow-speed');
    if (elTsFlowSpeed) elTsFlowSpeed.textContent = t.flowSpeed;
    const elTsFlowOpacity = document.getElementById('i18n-ts-flow-opacity');
    if (elTsFlowOpacity) elTsFlowOpacity.textContent = t.flowOpacity;

    const elTsHighlightTitle = document.getElementById('i18n-ts-highlight-title');
    if (elTsHighlightTitle) elTsHighlightTitle.textContent = t.highlightTitle;
    const elTsHighlightDesc = document.getElementById('i18n-ts-highlight-desc');
    if (elTsHighlightDesc) elTsHighlightDesc.textContent = t.highlightDesc;
    const elTsAvatarsTitle = document.getElementById('i18n-ts-avatars-title');
    if (elTsAvatarsTitle) elTsAvatarsTitle.textContent = t.tsAvatarsTitle;
    const elTsAvatarsDesc = document.getElementById('i18n-ts-avatars-desc');
    if (elTsAvatarsDesc) elTsAvatarsDesc.textContent = t.tsAvatarsDesc;

    const elTsPipTitle = document.getElementById('i18n-ts-pip-title');
    if (elTsPipTitle) elTsPipTitle.textContent = t.tsPipTitle;
    const elTsPipDesc = document.getElementById('i18n-ts-pip-desc');
    if (elTsPipDesc) elTsPipDesc.textContent = t.tsPipDesc;
    const elTsPipLaunch = document.getElementById('i18n-ts-pip-launch');
    if (elTsPipLaunch) elTsPipLaunch.textContent = t.tsPipLaunch;

    // ライブ側 i18n
    const elLiveYtTitle = document.getElementById('i18n-live-yt-title');
    if (elLiveYtTitle) elLiveYtTitle.textContent = t.liveYtTitle;
    const elLiveYtDesc = document.getElementById('i18n-live-yt-desc');
    if (elLiveYtDesc) elLiveYtDesc.textContent = t.liveYtDesc;
    const elLiveTwitchTitle = document.getElementById('i18n-live-twitch-title');
    if (elLiveTwitchTitle) elLiveTwitchTitle.textContent = t.liveTwitchTitle;
    const elLiveTwitchDesc = document.getElementById('i18n-live-twitch-desc');
    if (elLiveTwitchDesc) elLiveTwitchDesc.textContent = t.liveTwitchDesc;
    const elLiveModeLabel = document.getElementById('i18n-live-mode-label');
    if (elLiveModeLabel) elLiveModeLabel.textContent = t.liveModeLabel;
    const elLiveModeFlow = document.getElementById('i18n-live-mode-flow');
    if (elLiveModeFlow) elLiveModeFlow.textContent = t.modeFlow;
    const elLiveModeChatbox = document.getElementById('i18n-live-mode-chatbox');
    if (elLiveModeChatbox) elLiveModeChatbox.textContent = t.modeChatbox;
    const elLiveModeCard = document.getElementById('i18n-live-mode-card');
    if (elLiveModeCard) elLiveModeCard.textContent = t.modeCard;

    const elLiveFlowSize = document.getElementById('i18n-live-flow-size');
    if (elLiveFlowSize) elLiveFlowSize.textContent = t.flowSize;
    const elLiveFlowSpeed = document.getElementById('i18n-live-flow-speed');
    if (elLiveFlowSpeed) elLiveFlowSpeed.textContent = t.flowSpeed;
    const elLiveFlowOpacity = document.getElementById('i18n-live-flow-opacity');
    if (elLiveFlowOpacity) elLiveFlowOpacity.textContent = t.flowOpacity;
    const elLiveDensity = document.getElementById('i18n-live-density');
    if (elLiveDensity) elLiveDensity.textContent = t.density;

    const elLiveBadgesTitle = document.getElementById('i18n-live-badges-title');
    if (elLiveBadgesTitle) elLiveBadgesTitle.textContent = t.liveBadgesTitle;
    const elLiveBadgesDesc = document.getElementById('i18n-live-badges-desc');
    if (elLiveBadgesDesc) elLiveBadgesDesc.textContent = t.liveBadgesDesc;
    const elLiveUserColorTitle = document.getElementById('i18n-live-user-color-title');
    if (elLiveUserColorTitle) elLiveUserColorTitle.textContent = t.liveUserColorTitle;
    const elLiveUserColorDesc = document.getElementById('i18n-live-user-color-desc');
    if (elLiveUserColorDesc) elLiveUserColorDesc.textContent = t.liveUserColorDesc;
    const elLiveAvatarsTitle = document.getElementById('i18n-live-avatars-title');
    if (elLiveAvatarsTitle) elLiveAvatarsTitle.textContent = t.liveAvatarsTitle;
    const elLiveAvatarsDesc = document.getElementById('i18n-live-avatars-desc');
    if (elLiveAvatarsDesc) elLiveAvatarsDesc.textContent = t.liveAvatarsDesc;

    const elLivePipTitle = document.getElementById('i18n-live-pip-title');
    if (elLivePipTitle) elLivePipTitle.textContent = t.livePipTitle;
    const elLivePipDesc = document.getElementById('i18n-live-pip-desc');
    if (elLivePipDesc) elLivePipDesc.textContent = t.livePipDesc;
    const elLivePipLaunch = document.getElementById('i18n-live-pip-launch');
    if (elLivePipLaunch) elLivePipLaunch.textContent = t.livePipLaunch;

    // フッター & 共通
    const elTestBtn = document.getElementById('i18n-test-btn');
    if (elTestBtn) elTestBtn.textContent = t.testBtn;
    const elSupportDev = document.getElementById('i18n-support-dev');
    if (elSupportDev) elSupportDev.textContent = t.supportDev;
    const elSupportLink = document.getElementById('support-link');
    if (elSupportLink) elSupportLink.title = `${t.supportDev} (Ko-fi)`;
    if (saveStatus) saveStatus.textContent = t.savedText;

    // ボタンのテキスト更新 (小/中/大、遅い/普通/速い、控えめ/標準/すべて)
    document.querySelectorAll('.size-btn[data-size="small"]').forEach((btn) => { btn.textContent = t.sizeSmall; });
    document.querySelectorAll('.size-btn[data-size="medium"]').forEach((btn) => { btn.textContent = t.sizeMedium; });
    document.querySelectorAll('.size-btn[data-size="large"]').forEach((btn) => { btn.textContent = t.sizeLarge; });
    document.querySelectorAll('.speed-btn[data-speed="slow"]').forEach((btn) => { btn.textContent = t.speedSlow; });
    document.querySelectorAll('.speed-btn[data-speed="normal"]').forEach((btn) => { btn.textContent = t.speedNormal; });
    document.querySelectorAll('.speed-btn[data-speed="fast"]').forEach((btn) => { btn.textContent = t.speedFast; });
    document.querySelectorAll('.density-btn[data-density="low"]').forEach((btn) => { btn.textContent = t.densityLow; });
    document.querySelectorAll('.density-btn[data-density="normal"]').forEach((btn) => { btn.textContent = t.densityNormal; });
    document.querySelectorAll('.density-btn[data-density="high"]').forEach((btn) => { btn.textContent = t.densityHigh; });

    updateDynamicLabels();
  }

  function updateDynamicLabels() {
    const t = I18N_DATA[currentLang] || I18N_DATA.ja;

    // ─── タイムスタンプ動的ラベル ───
    const s = currentSettings.size || 'medium';
    if (tsSizeVal) {
      tsSizeVal.textContent = s === 'small' ? t.sizeSmall : s === 'large' ? t.sizeLarge : t.sizeMedium;
    }
    if (tsDurationVal) {
      tsDurationVal.textContent = `${currentSettings.displayDuration}${t.durationUnit}`;
    }
    if (tsStackVal) {
      tsStackVal.textContent = `${currentSettings.maxStackCount}${t.stackUnit}`;
    }
    if (tsOpacityVal) {
      tsOpacityVal.textContent = `${currentSettings.opacity}%`;
    }

    const fs = currentSettings.flowSize || 'medium';
    if (tsFlowSizeVal) {
      tsFlowSizeVal.textContent = fs === 'small' ? t.sizeSmall : fs === 'large' ? t.sizeLarge : t.sizeMedium;
    }
    const spd = currentSettings.flowSpeed || 'normal';
    if (tsFlowSpeedVal) {
      tsFlowSpeedVal.textContent = spd === 'slow' ? t.speedSlow : spd === 'fast' ? t.speedFast : t.speedNormal;
    }
    if (tsFlowOpacityVal) {
      tsFlowOpacityVal.textContent = `${currentSettings.flowOpacity ?? 30}%`;
    }

    // ─── ライブ動的ラベル ───
    const lfs = currentSettings.liveFlowSize || currentSettings.flowSize || 'medium';
    if (liveFlowSizeVal) {
      liveFlowSizeVal.textContent = lfs === 'small' ? t.sizeSmall : lfs === 'large' ? t.sizeLarge : t.sizeMedium;
    }
    const lspd = currentSettings.liveFlowSpeed || currentSettings.flowSpeed || 'normal';
    if (liveFlowSpeedVal) {
      liveFlowSpeedVal.textContent = lspd === 'slow' ? t.speedSlow : lspd === 'fast' ? t.speedFast : t.speedNormal;
    }
    if (liveFlowOpacityVal) {
      liveFlowOpacityVal.textContent = `${currentSettings.liveFlowOpacity ?? currentSettings.flowOpacity ?? 30}%`;
    }

    const ld = currentSettings.liveChatMaxDensity || currentSettings.flowDensity || 'normal';
    const ldText = ld === 'low' ? t.densityLow : ld === 'high' ? t.densityHigh : t.densityNormal;
    if (liveDensityVal) {
      liveDensityVal.textContent = ldText;
    }
    if (liveChatboxDensityVal) {
      liveChatboxDensityVal.textContent = ldText;
    }

    const ls = currentSettings.liveSize || currentSettings.size || 'medium';
    if (liveSizeVal) {
      liveSizeVal.textContent = ls === 'small' ? t.sizeSmall : ls === 'large' ? t.sizeLarge : t.sizeMedium;
    }
    if (liveDurationVal) {
      const dur = currentSettings.liveDisplayDuration ?? currentSettings.displayDuration ?? 6;
      liveDurationVal.textContent = `${dur}${t.durationUnit}`;
    }
    if (liveOpacityVal) {
      const op = currentSettings.liveOpacity ?? currentSettings.opacity ?? 30;
      liveOpacityVal.textContent = `${op}%`;
    }
  }

  function flashSaveStatus(text?: string, duration = 2500) {
    if (!saveStatus) return;
    const t = I18N_DATA[currentLang] || I18N_DATA.ja;
    saveStatus.textContent = text || t.savingText;
    setTimeout(() => {
      saveStatus.textContent = t.savedText;
    }, duration);
  }

  // タイムスタンプ表示モード切替
  function setTsMode(mode: DisplayMode) {
    currentSettings.displayMode = mode;
    currentSettings.flowMode = mode === 'flow';

    tsModeCardBtn?.classList.toggle('active', mode === 'card');
    tsModeFlowBtn?.classList.toggle('active', mode === 'flow');
    tsModeChatboxBtn?.classList.toggle('active', mode === 'chatbox');

    // 関係のないオプションを非表示、関係のあるオプションのみ表示
    if (tsCardOptions) tsCardOptions.style.display = mode === 'card' ? 'block' : 'none';
    if (tsFlowOptions) tsFlowOptions.style.display = mode === 'flow' ? 'block' : 'none';
    if (tsChatboxOptions) tsChatboxOptions.style.display = mode === 'chatbox' ? 'block' : 'none';

    updateDynamicLabels();
  }

  // ライブ表示モード切替
  function setLiveMode(mode: DisplayMode) {
    currentSettings.liveChatMode = mode;

    liveModeFlowBtn?.classList.toggle('active', mode === 'flow');
    liveModeChatboxBtn?.classList.toggle('active', mode === 'chatbox');
    liveModeCardBtn?.classList.toggle('active', mode === 'card');

    // 関係のないオプションを非表示、関係のあるオプションのみ表示
    if (liveFlowOptions) liveFlowOptions.style.display = mode === 'flow' ? 'block' : 'none';
    if (liveChatboxOptions) liveChatboxOptions.style.display = mode === 'chatbox' ? 'block' : 'none';
    if (liveCardOptions) liveCardOptions.style.display = mode === 'card' ? 'block' : 'none';

    updateDynamicLabels();
  }

  function applySettingsToUi(settings: OverlaySettings) {
    // ─── タイムスタンプ設定の反映 ───
    if (tsEnabledToggle) tsEnabledToggle.checked = settings.enabled;

    const tsMode: DisplayMode = settings.displayMode || (settings.flowMode ? 'flow' : 'card');
    setTsMode(tsMode);

    tsPosButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-pos') === settings.position);
    });

    const currentTsSize = settings.size || 'medium';
    tsSizeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-size') === currentTsSize);
    });

    if (tsDurationSlider) tsDurationSlider.value = settings.displayDuration.toString();
    if (tsStackSlider) tsStackSlider.value = settings.maxStackCount.toString();
    if (tsOpacitySlider) tsOpacitySlider.value = settings.opacity.toString();

    const currentTsFlowSize = settings.flowSize || 'medium';
    tsFlowSizeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-size') === currentTsFlowSize);
    });

    const currentTsFlowSpeed = settings.flowSpeed || 'normal';
    tsFlowSpeedButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-speed') === currentTsFlowSpeed);
    });

    const currentTsFlowOpacity = settings.flowOpacity ?? 30;
    if (tsFlowOpacitySlider) tsFlowOpacitySlider.value = currentTsFlowOpacity.toString();

    if (tsHighlightToggle) tsHighlightToggle.checked = settings.highlightPopular;
    if (tsAvatarsToggle) tsAvatarsToggle.checked = settings.showAvatars ?? true;
    if (tsPipToggle) tsPipToggle.checked = settings.pipEnabled ?? true;

    // ─── ライブ設定の反映 ───
    if (ytLiveToggle) ytLiveToggle.checked = settings.liveChatEnabled ?? true;
    if (twitchToggle) twitchToggle.checked = settings.twitchEnabled ?? true;

    const liveMode: DisplayMode = settings.liveChatMode || 'flow';
    setLiveMode(liveMode);

    const currentLiveFlowSize = settings.liveFlowSize || settings.flowSize || 'medium';
    liveFlowSizeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-size') === currentLiveFlowSize);
    });

    const currentLiveFlowSpeed = settings.liveFlowSpeed || settings.flowSpeed || 'normal';
    liveFlowSpeedButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-speed') === currentLiveFlowSpeed);
    });

    const currentLiveFlowOpacity = settings.liveFlowOpacity ?? settings.flowOpacity ?? 30;
    if (liveFlowOpacitySlider) liveFlowOpacitySlider.value = currentLiveFlowOpacity.toString();

    const currentLiveDensity = settings.liveChatMaxDensity || settings.flowDensity || 'normal';
    liveDensityButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-density') === currentLiveDensity);
    });
    liveChatboxDensityButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-density') === currentLiveDensity);
    });

    const currentLiveSize = settings.liveSize || settings.size || 'medium';
    liveSizeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-size') === currentLiveSize);
    });

    const currentLiveDuration = settings.liveDisplayDuration ?? settings.displayDuration ?? 6;
    if (liveDurationSlider) liveDurationSlider.value = currentLiveDuration.toString();

    const currentLiveOpacity = settings.liveOpacity ?? settings.opacity ?? 30;
    if (liveOpacitySlider) liveOpacitySlider.value = currentLiveOpacity.toString();

    if (liveBadgesToggle) liveBadgesToggle.checked = settings.liveShowBadges ?? settings.showBadges ?? true;
    if (liveUserColorToggle) liveUserColorToggle.checked = settings.liveShowUserColor ?? true;
    if (liveAvatarsToggle) liveAvatarsToggle.checked = settings.liveShowAvatars ?? settings.showLiveAvatars ?? true;
    if (livePipToggle) livePipToggle.checked = settings.livePipEnabled ?? settings.pipEnabled ?? true;

    updateDynamicLabels();
  }

  // 1. 設定ロード
  try {
    currentSettings = await getSettings();
    if (!currentSettings.displayMode) {
      currentSettings.displayMode = currentSettings.flowMode ? 'flow' : 'card';
    }
    currentLang = detectInitialLanguage(currentSettings.language);
    applyLanguage(currentLang);
    applySettingsToUi(currentSettings);
  } catch (err) {
    console.error('Failed to load settings', err);
  }

  async function updateSettings(partial: Partial<OverlaySettings>) {
    Object.assign(currentSettings, partial);
    const updated = await saveSettings(partial);

    // 開かれている全タブに設定変更を通知（storage.onChangedでも自動同期される）
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({}, (tabs) => {
        tabs?.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_SETTINGS', settings: updated }, () => {
              if (chrome.runtime.lastError) { /* ignore */ }
            });
          }
        });
      });
    }

    flashSaveStatus();
  }

  async function updateSetting<K extends keyof OverlaySettings>(key: K, value: OverlaySettings[K]) {
    await updateSettings({ [key]: value } as Partial<OverlaySettings>);
  }

  /**
   * 現在アクティブなタブを取得
   */
  async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs) return null;

    const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (t1) => {
        if (t1 && t1.length > 0) {
          resolve(t1);
        } else {
          chrome.tabs.query({ active: true, lastFocusedWindow: true }, (t2) => {
            resolve(t2 || []);
          });
        }
      });
    });

    return tabs && tabs.length > 0 ? tabs[0] : null;
  }

  /**
   * 現在のアクティブタブにテスト吹き出しを確実に表示する
   */
  async function sendTestCommentToActiveTab(testKind: 'timestamp' | 'live'): Promise<boolean> {
    const tab = await getActiveTab();
    if (!tab || !tab.id) return false;

    const url = tab.url || '';
    const isInjectable = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://');
    if (!isInjectable) {
      return false;
    }

    const tabId = tab.id;

    // 1. Content Script へのメッセージ送信を試行
    const msgSuccess = await new Promise<boolean>((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'SHOW_TEST_COMMENT', settings: currentSettings, testKind }, (response) => {
        const lastErr = chrome.runtime.lastError;
        if (!lastErr && response?.success) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });

    if (msgSuccess) {
      return true;
    }

    // 2. メッセージ未応答（YouTube/Twitch以外のページ、またはContent Script未起動のタブ）：直接注入
    if (chrome.scripting && chrome.scripting.executeScript) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: injectBrowserTestOverlay,
          args: [currentSettings, currentLang, testKind],
        });
        return true;
      } catch (err) {
        console.warn('[Popup] Direct browser test injection failed:', err);
      }
    }

    return false;
  }

  /**
   * ブラウザのWebページ側で直接実行される自律型テスト吹き出し注入関数
   */
  function injectBrowserTestOverlay(settings: any, lang: string, testKind: 'timestamp' | 'live') {
    const CONTAINER_ID = 'timebubble-browser-test-container';
    const STYLE_ID = 'timebubble-browser-test-style';

    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      styleEl.textContent = `
        #${CONTAINER_ID} {
          position: fixed !important;
          z-index: 2147483647 !important;
          display: flex !important;
          flex-direction: column !important;
          pointer-events: none !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 320px !important;
          max-width: 90vw !important;
        }
        #${CONTAINER_ID}.pos-top-right { top: 20px !important; right: 20px !important; bottom: auto !important; left: auto !important; }
        #${CONTAINER_ID}.pos-top-left { top: 20px !important; left: 20px !important; bottom: auto !important; right: auto !important; }
        #${CONTAINER_ID}.pos-bottom-right { bottom: 20px !important; right: 20px !important; top: auto !important; left: auto !important; }
        #${CONTAINER_ID}.pos-bottom-left { bottom: 20px !important; left: 20px !important; top: auto !important; right: auto !important; }
        #${CONTAINER_ID}.size-small { width: 260px !important; }
        #${CONTAINER_ID}.size-medium { width: 320px !important; }
        #${CONTAINER_ID}.size-large { width: 380px !important; }

        .tb-test-card {
          display: flex !important;
          flex-direction: column !important;
          gap: 6px !important;
          padding: 10px 14px !important;
          margin-bottom: 10px !important;
          border-radius: 12px !important;
          background: rgba(18, 24, 38, var(--tb-bg-op, 0.8)) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border: 1px solid rgba(255, 255, 255, var(--tb-border-op, 0.18)) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45) !important;
          color: #f8fafc !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 13px !important;
          line-height: 1.4 !important;
          pointer-events: auto !important;
          box-sizing: border-box !important;
          animation: tbCardEnter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
          transition: transform 0.25s ease, opacity 0.35s ease !important;
        }
        .tb-test-card.is-popular {
          border-color: rgba(168, 85, 247, calc(var(--tb-border-op, 0.18) * 2.5)) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 0 16px rgba(168, 85, 247, 0.3) !important;
        }
        .tb-test-card.is-toptier {
          border-color: rgba(245, 158, 11, calc(var(--tb-border-op, 0.18) * 3)) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 0 20px rgba(245, 158, 11, 0.35) !important;
        }
        .tb-test-card.is-superchat {
          border-color: rgba(245, 158, 11, 0.7) !important;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(18, 24, 38, 0.9)) !important;
        }
        .tb-test-card.size-small { padding: 8px 10px !important; font-size: 11.5px !important; border-radius: 9px !important; margin-bottom: 7px !important; }
        .tb-test-card.size-large { padding: 12px 16px !important; font-size: 14.5px !important; border-radius: 14px !important; margin-bottom: 12px !important; }
        .tb-test-card.is-exiting { opacity: 0 !important; transform: scale(0.92) translateY(-10px) !important; }
        @keyframes tbCardEnter {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .tb-test-hdr { display: flex !important; align-items: center !important; gap: 8px !important; }
        .tb-test-avatar {
          width: 24px !important;
          height: 24px !important;
          border-radius: 50% !important;
          background: linear-gradient(135deg, #6366f1, #a855f7) !important;
          color: #ffffff !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          flex-shrink: 0 !important;
        }
        .tb-test-name { font-weight: 600 !important; font-size: 12px !important; color: #e2e8f0 !important; }
        .tb-test-badge-icon {
          display: inline-flex !important;
          align-items: center !important;
          padding: 1px 5px !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          border-radius: 4px !important;
          background: rgba(168, 85, 247, 0.25) !important;
          color: #c084fc !important;
        }
        .tb-test-badge-mod { background: rgba(34, 197, 94, 0.25) !important; color: #4ade80 !important; }
        .tb-test-likes {
          margin-left: auto !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 4px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #f43f5e !important;
          background: rgba(244, 63, 94, 0.12) !important;
          padding: 1px 6px !important;
          border-radius: 10px !important;
        }
        .tb-test-body { color: #f8fafc !important; word-break: break-word !important; }
        .tb-test-badge {
          display: inline-flex !important;
          align-items: center !important;
          gap: 3px !important;
          color: #818cf8 !important;
          background: rgba(99, 102, 241, 0.18) !important;
          border: 1px solid rgba(99, 102, 241, 0.3) !important;
          padding: 1px 6px !important;
          border-radius: 5px !important;
          font-weight: 600 !important;
          font-size: 11px !important;
          margin-right: 5px !important;
        }
      `;
      (document.head || document.documentElement).appendChild(styleEl);
    }

    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      document.body.appendChild(container);
    }

    const pos = settings.position || 'top-right';
    const isLive = testKind === 'live';
    const size = isLive ? (settings.liveSize || settings.size || 'medium') : (settings.size || 'medium');
    container.className = `pos-${pos} size-${size}`;

    const op = isLive ? (typeof settings.liveOpacity === 'number' ? settings.liveOpacity : 30) : (typeof settings.opacity === 'number' ? settings.opacity : 30);
    const bgOp = Math.max(0, Math.min(1, op / 100));
    container.style.setProperty('--tb-bg-op', bgOp.toString());
    container.style.setProperty('--tb-border-op', (bgOp * 0.22).toString());

    // サンプルデータ
    const tsSamplesByLang: Record<string, { text: string; time: string; author: string }[]> = {
      ja: [
        { text: '01:23 ここが一番好きなシーン！何度見ても最高です✨', time: '01:23', author: '視聴者A' },
        { text: 'この演出鳥肌立った…神回すぎる！🔥 02:45', time: '02:45', author: '視聴者B' },
        { text: '03:10 音響とBGMの入り方が完璧👏 何度でもリピートできる', time: '03:10', author: '視聴者C' },
      ],
      en: [
        { text: '01:23 Best scene ever! Absolutely love this part ✨', time: '01:23', author: 'Viewer A' },
        { text: 'Chills all over… this episode is legendary! 🔥 02:45', time: '02:45', author: 'Viewer B' },
        { text: '03:10 The soundtrack here is absolute perfection 👏', time: '03:10', author: 'Viewer C' },
      ],
      es: [
        { text: '01:23 ¡La mejor escena de todas! Me encanta ✨', time: '01:23', author: 'Espectador A' },
        { text: 'Piel de gallina con esta escena… ¡Increíble! 🔥 02:45', time: '02:45', author: 'Espectador B' },
        { text: '03:10 La música en este momento es perfecta 👏', time: '03:10', author: 'Espectador C' },
      ],
      zh: [
        { text: '01:23 这是最精彩的片段！百看不厌✨', time: '01:23', author: '观众A' },
        { text: '起鸡皮疙瘩了…这集真的封神！🔥 02:45', time: '02:45', author: '观众B' },
        { text: '03:10 这里的配乐和音效太完美了👏', time: '03:10', author: '观众C' },
      ],
    };

    const liveSamplesByLang: Record<string, { text: string; badge: string; author: string; isMod?: boolean; isSuper?: boolean }[]> = {
      ja: [
        { text: 'キターーーー！！配信待機してました！🎉', badge: 'VIP', author: 'ライブファンA' },
        { text: 'スパチャ ¥1,000 ナイス配信！応援してます🔥', badge: 'SUPER', author: 'サポーターB', isSuper: true },
        { text: '荒らしは即座に対処します。楽しく見ましょう！', badge: 'MOD', author: 'モデレーターC', isMod: true },
      ],
      en: [
        { text: 'LETS GOOOOO! Hyped for this stream! 🎉', badge: 'VIP', author: 'LiveFan A' },
        { text: 'Super Chat $10.00 Keep up the awesome work! 🔥', badge: 'SUPER', author: 'Supporter B', isSuper: true },
        { text: 'Please keep chat friendly, enjoy the stream!', badge: 'MOD', author: 'Moderator C', isMod: true },
      ],
      es: [
        { text: '¡Vamooos! ¡Esperando el directo! 🎉', badge: 'VIP', author: 'Fan A' },
        { text: 'Super Chat €10 ¡Excelente transmisión! 🔥', badge: 'SUPER', author: 'Donador B', isSuper: true },
        { text: 'Respeten las reglas del chat, ¡a disfrutar!', badge: 'MOD', author: 'Moderador C', isMod: true },
      ],
      zh: [
        { text: '来啦来啦！等好久了！🎉', badge: 'VIP', author: '直播观众A' },
        { text: '醒目留言 ¥100 主播加油！支持你🔥', badge: 'SUPER', author: '粉丝B', isSuper: true },
        { text: '请大家遵守弹幕礼仪，文明观看！', badge: 'MOD', author: '房管C', isMod: true },
      ],
    };

    const sampleList = isLive ? (liveSamplesByLang[lang] || liveSamplesByLang.ja) : (tsSamplesByLang[lang] || tsSamplesByLang.ja);
    const count = isLive ? 2 : Math.max(1, Math.min(settings.maxStackCount || 3, sampleList.length));
    const duration = isLive ? (settings.liveDisplayDuration || 6) : (settings.displayDuration || 6);

    while (container.children.length >= count) {
      container.removeChild(container.children[0]);
    }

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const item: any = sampleList[i % sampleList.length];
        const card = document.createElement('div');
        card.className = `tb-test-card size-${size}`;

        if (!isLive && settings.highlightPopular) {
          if (i === 1) card.classList.add('is-popular');
        } else if (isLive && item.isSuper) {
          card.classList.add('is-superchat');
        }

        const hdr = document.createElement('div');
        hdr.className = 'tb-test-hdr';

        const showAvatar = isLive ? (settings.liveShowAvatars ?? true) : (settings.showAvatars ?? true);
        if (showAvatar) {
          const avatar = document.createElement('div');
          avatar.className = 'tb-test-avatar';
          avatar.textContent = item.author.charAt(0);
          hdr.appendChild(avatar);
        }

        const name = document.createElement('span');
        name.className = 'tb-test-name';
        const showUserColor = isLive ? (settings.liveShowUserColor ?? true) : false;
        if (showUserColor && item.color) {
          name.style.color = item.color;
        }
        name.textContent = item.author;
        hdr.appendChild(name);

        const showBadges = isLive ? (settings.liveShowBadges ?? true) : false;
        if (isLive && showBadges && item.badge) {
          const badgeIcon = document.createElement('span');
          badgeIcon.className = `tb-test-badge-icon ${item.isMod ? 'tb-test-badge-mod' : ''}`;
          badgeIcon.textContent = item.badge;
          hdr.appendChild(badgeIcon);
        }

        if (!isLive) {
          const likesBadge = document.createElement('span');
          likesBadge.className = 'tb-test-likes';
          likesBadge.textContent = `♥ ${[420, 1500, 85][i % 3]}`;
          hdr.appendChild(likesBadge);
        }

        const body = document.createElement('div');
        body.className = 'tb-test-body';
        if (!isLive && item.time) {
          const badge = document.createElement('span');
          badge.className = 'tb-test-badge';
          badge.textContent = `▶ ${item.time}`;
          body.appendChild(badge);
          body.appendChild(document.createTextNode(item.text.replace(item.time, '').trim()));
        } else {
          body.textContent = item.text;
        }

        card.appendChild(hdr);
        card.appendChild(body);
        container?.appendChild(card);

        setTimeout(() => {
          card.classList.add('is-exiting');
          setTimeout(() => {
            card.remove();
            if (container && container.children.length === 0) {
              container.remove();
            }
          }, 360);
        }, duration * 1000);
      }, i * 240);
    }
  }

  // ─── タイムスタンプ イベントリスナー ───
  tsEnabledToggle?.addEventListener('change', () => {
    updateSetting('enabled', tsEnabledToggle.checked);
  });

  tsModeCardBtn?.addEventListener('click', async () => {
    setTsMode('card');
    await updateSettings({ displayMode: 'card', flowMode: false });
  });

  tsModeFlowBtn?.addEventListener('click', async () => {
    setTsMode('flow');
    await updateSettings({ displayMode: 'flow', flowMode: true });
  });

  tsModeChatboxBtn?.addEventListener('click', async () => {
    setTsMode('chatbox');
    await updateSettings({ displayMode: 'chatbox', flowMode: false });
  });

  tsPosButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const pos = btn.getAttribute('data-pos') as OverlayPosition | null;
      if (!pos) return;
      tsPosButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      updateSetting('position', pos);
    });
  });

  tsSizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = btn.getAttribute('data-size') as OverlaySize | null;
      if (!s) return;
      tsSizeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.size = s;
      updateDynamicLabels();
      updateSetting('size', s);
    });
  });

  tsDurationSlider?.addEventListener('input', () => {
    const val = parseInt(tsDurationSlider.value, 10);
    currentSettings.displayDuration = val;
    updateDynamicLabels();
  });
  tsDurationSlider?.addEventListener('change', () => {
    const val = parseInt(tsDurationSlider.value, 10);
    updateSetting('displayDuration', val);
  });

  tsStackSlider?.addEventListener('input', () => {
    const val = parseInt(tsStackSlider.value, 10);
    currentSettings.maxStackCount = val;
    updateDynamicLabels();
  });
  tsStackSlider?.addEventListener('change', () => {
    const val = parseInt(tsStackSlider.value, 10);
    updateSetting('maxStackCount', val);
  });

  tsOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(tsOpacitySlider.value, 10);
    currentSettings.opacity = val;
    if (tsOpacityVal) tsOpacityVal.textContent = `${val}%`;
  });
  tsOpacitySlider?.addEventListener('change', () => {
    const val = parseInt(tsOpacitySlider.value, 10);
    updateSetting('opacity', val);
  });

  tsFlowSizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = btn.getAttribute('data-size') as OverlaySize | null;
      if (!s) return;
      tsFlowSizeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.flowSize = s;
      updateDynamicLabels();
      updateSetting('flowSize', s);
    });
  });

  tsFlowSpeedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const spd = btn.getAttribute('data-speed') as FlowSpeed | null;
      if (!spd) return;
      tsFlowSpeedButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.flowSpeed = spd;
      updateDynamicLabels();
      updateSetting('flowSpeed', spd);
    });
  });

  tsFlowOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(tsFlowOpacitySlider.value, 10);
    currentSettings.flowOpacity = val;
    if (tsFlowOpacityVal) tsFlowOpacityVal.textContent = `${val}%`;
  });
  tsFlowOpacitySlider?.addEventListener('change', () => {
    const val = parseInt(tsFlowOpacitySlider.value, 10);
    updateSetting('flowOpacity', val);
  });

  tsHighlightToggle?.addEventListener('change', () => {
    updateSetting('highlightPopular', tsHighlightToggle.checked);
  });

  tsAvatarsToggle?.addEventListener('change', () => {
    updateSetting('showAvatars', tsAvatarsToggle.checked);
  });

  tsPipToggle?.addEventListener('change', () => {
    updateSetting('pipEnabled', tsPipToggle.checked);
  });

  tsTriggerPipBtn?.addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PIP' }, () => {
        if (chrome.runtime.lastError) { /* ignore */ }
      });
      flashSaveStatus(currentLang === 'ja' ? 'PiPを起動しました' : 'PiP launched');
    }
  });

  // ─── ライブ イベントリスナー ───
  ytLiveToggle?.addEventListener('change', () => {
    updateSetting('liveChatEnabled', ytLiveToggle.checked);
  });

  twitchToggle?.addEventListener('change', () => {
    updateSetting('twitchEnabled', twitchToggle.checked);
  });

  liveModeFlowBtn?.addEventListener('click', async () => {
    setLiveMode('flow');
    await updateSetting('liveChatMode', 'flow');
  });

  liveModeChatboxBtn?.addEventListener('click', async () => {
    setLiveMode('chatbox');
    await updateSetting('liveChatMode', 'chatbox');
  });

  liveModeCardBtn?.addEventListener('click', async () => {
    setLiveMode('card');
    await updateSetting('liveChatMode', 'card');
  });

  liveFlowSizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = btn.getAttribute('data-size') as OverlaySize | null;
      if (!s) return;
      liveFlowSizeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.liveFlowSize = s;
      updateDynamicLabels();
      updateSetting('liveFlowSize', s);
    });
  });

  liveFlowSpeedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const spd = btn.getAttribute('data-speed') as FlowSpeed | null;
      if (!spd) return;
      liveFlowSpeedButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.liveFlowSpeed = spd;
      updateDynamicLabels();
      updateSetting('liveFlowSpeed', spd);
    });
  });

  liveFlowOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(liveFlowOpacitySlider.value, 10);
    currentSettings.liveFlowOpacity = val;
    if (liveFlowOpacityVal) liveFlowOpacityVal.textContent = `${val}%`;
  });
  liveFlowOpacitySlider?.addEventListener('change', () => {
    const val = parseInt(liveFlowOpacitySlider.value, 10);
    updateSetting('liveFlowOpacity', val);
  });

  const handleDensityChange = (d: FlowDensity) => {
    liveDensityButtons.forEach((b) => b.classList.toggle('active', b.getAttribute('data-density') === d));
    liveChatboxDensityButtons.forEach((b) => b.classList.toggle('active', b.getAttribute('data-density') === d));
    currentSettings.liveChatMaxDensity = d;
    currentSettings.flowDensity = d;
    updateDynamicLabels();
    updateSettings({ liveChatMaxDensity: d, flowDensity: d });
  };

  liveDensityButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = btn.getAttribute('data-density') as FlowDensity | null;
      if (d) handleDensityChange(d);
    });
  });

  liveChatboxDensityButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = btn.getAttribute('data-density') as FlowDensity | null;
      if (d) handleDensityChange(d);
    });
  });

  liveSizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = btn.getAttribute('data-size') as OverlaySize | null;
      if (!s) return;
      liveSizeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.liveSize = s;
      updateDynamicLabels();
      updateSetting('liveSize', s);
    });
  });

  liveDurationSlider?.addEventListener('input', () => {
    const val = parseInt(liveDurationSlider.value, 10);
    currentSettings.liveDisplayDuration = val;
    updateDynamicLabels();
  });
  liveDurationSlider?.addEventListener('change', () => {
    const val = parseInt(liveDurationSlider.value, 10);
    updateSetting('liveDisplayDuration', val);
  });

  liveOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(liveOpacitySlider.value, 10);
    currentSettings.liveOpacity = val;
    if (liveOpacityVal) liveOpacityVal.textContent = `${val}%`;
  });
  liveOpacitySlider?.addEventListener('change', () => {
    const val = parseInt(liveOpacitySlider.value, 10);
    updateSetting('liveOpacity', val);
  });

  liveBadgesToggle?.addEventListener('change', () => {
    const val = liveBadgesToggle.checked;
    currentSettings.liveShowBadges = val;
    currentSettings.showBadges = val;
    currentSettings.twitchShowBadges = val;
    updateSettings({ liveShowBadges: val, showBadges: val, twitchShowBadges: val });
  });

  liveUserColorToggle?.addEventListener('change', () => {
    const val = liveUserColorToggle.checked;
    currentSettings.liveShowUserColor = val;
    updateSettings({ liveShowUserColor: val });
  });

  liveAvatarsToggle?.addEventListener('change', () => {
    const val = liveAvatarsToggle.checked;
    currentSettings.liveShowAvatars = val;
    currentSettings.showLiveAvatars = val;
    updateSettings({ liveShowAvatars: val, showLiveAvatars: val });
  });

  livePipToggle?.addEventListener('change', () => {
    updateSetting('livePipEnabled', livePipToggle.checked);
  });

  liveTriggerPipBtn?.addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PIP' }, () => {
        if (chrome.runtime.lastError) { /* ignore */ }
      });
      flashSaveStatus(currentLang === 'ja' ? 'PiPを起動しました' : 'PiP launched');
    }
  });

  // 言語選択セレクター
  langSelect?.addEventListener('change', () => {
    const selected = langSelect.value as SupportedLang;
    applyLanguage(selected);
    updateSetting('language', selected);
  });

  // テスト吹き出し表示ボタン
  testCommentBtn?.addEventListener('click', async () => {
    const t = I18N_DATA[currentLang] || I18N_DATA.ja;
    flashSaveStatus(t.testSending, 1500);

    const ok = await sendTestCommentToActiveTab(activeTab);
    if (ok) {
      flashSaveStatus(t.testSuccess, 3000);
    } else {
      flashSaveStatus(t.testSuccess, 3000);
    }
  });
});
