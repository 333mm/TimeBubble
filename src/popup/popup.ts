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
  liveUserColorTitle: string;
  liveUserColorDesc: string;
  liveAvatarsTitle: string;
  liveAvatarsDesc: string;
  livePipTitle: string;
  livePipDesc: string;
  // 共通
  savedText: string;
  savingText: string;
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
    liveYtTitle: 'YouTube Live チャット表示',
    liveYtDesc: '生配信・アーカイブのリアルタイムチャットを動画上に流す',
    liveTwitchTitle: 'Twitch 配信チャット表示',
    liveTwitchDesc: 'Twitchのライブ配信・VODでチャットを動画上に流す',
    liveModeLabel: '表示モード',
    density: 'チャット流量密度 (負荷制御)',
    densityLow: '控えめ',
    densityNormal: '標準',
    densityHigh: 'すべて',
    liveUserColorTitle: 'ユーザーカラー表示',
    liveUserColorDesc: '投稿者のネームカラー・文字色の着色を表示',
    liveAvatarsTitle: 'ユーザーアイコンを表示',
    liveAvatarsDesc: 'チャットに投稿者のアバターを表示',
    livePipTitle: 'PiP ウィンドウにチャットを表示',
    livePipDesc: 'ピクチャインピクチャ再生中もチャットを合成描画',
    savedText: '設定は自動保存されます',
    savingText: '設定を保存しました',
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
    liveYtTitle: 'YouTube Live Chat',
    liveYtDesc: 'Display live and replay stream chats over video',
    liveTwitchTitle: 'Twitch Chat',
    liveTwitchDesc: 'Display Twitch live and VOD chats over video',
    liveModeLabel: 'Display Mode',
    density: 'Chat Density (Traffic Control)',
    densityLow: 'Low',
    densityNormal: 'Normal',
    densityHigh: 'All',
    liveUserColorTitle: 'Show User Colors',
    liveUserColorDesc: 'Color user names and chat text',
    liveAvatarsTitle: 'Show User Avatars',
    liveAvatarsDesc: 'Display user avatars in chat messages',
    livePipTitle: 'Show Chat in PiP',
    livePipDesc: 'Render live chat inside Picture-in-Picture window',
    savedText: 'Settings are saved automatically',
    savingText: 'Settings saved',
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
    liveYtTitle: 'Chat de YouTube Live',
    liveYtDesc: 'Mostrar chat en vivo sobre el reproductor',
    liveTwitchTitle: 'Chat de Twitch',
    liveTwitchDesc: 'Mostrar chat de transmisiones y VODs',
    liveModeLabel: 'Modo de visualización',
    density: 'Densidad del Chat',
    densityLow: 'Bajo',
    densityNormal: 'Normal',
    densityHigh: 'Todos',
    liveUserColorTitle: 'Mostrar colores de usuario',
    liveUserColorDesc: 'Colorear nombres de usuario y texto del chat',
    liveAvatarsTitle: 'Mostrar avatares de usuario',
    liveAvatarsDesc: 'Mostrar fotos de perfil en el chat',
    livePipTitle: 'Mostrar Chat en PiP',
    livePipDesc: 'Dibujar chat en Picture-in-Picture',
    savedText: 'Los ajustes se guardan automáticamente',
    savingText: 'Ajustes guardados',
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
    liveYtTitle: 'YouTube Live 聊天显示',
    liveYtDesc: '在视频上实时显示直播与回放聊天',
    liveTwitchTitle: 'Twitch 弹幕显示',
    liveTwitchDesc: '在视频上实时显示Twitch直播与录像聊天',
    liveModeLabel: '显示模式',
    density: '弹幕流量密度 (负载控制)',
    densityLow: '少量',
    densityNormal: '标准',
    densityHigh: '全部',
    liveUserColorTitle: '显示用户颜色',
    liveUserColorDesc: '显示发言者昵称与文字颜色',
    liveAvatarsTitle: '显示用户头像',
    liveAvatarsDesc: '在聊天弹幕中显示作者头像',
    livePipTitle: '在画中画(PiP)窗口显示弹幕',
    livePipDesc: '画中画播放时同步合成绘制聊天弹幕',
    savedText: '设置已自动保存',
    savingText: '设置已保存',
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

  tabTsBtn?.addEventListener('click', () => {
    tabTsBtn.classList.add('active');
    tabLiveBtn?.classList.remove('active');
    if (tabTsPanel) tabTsPanel.style.display = 'block';
    if (tabLivePanel) tabLivePanel.style.display = 'none';
  });

  tabLiveBtn?.addEventListener('click', () => {
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
  const liveUserColorToggle = document.getElementById('live-user-color-toggle') as HTMLInputElement | null;
  const liveAvatarsToggle = document.getElementById('live-avatars-toggle') as HTMLInputElement | null;
  const livePipToggle = document.getElementById('live-pip-toggle') as HTMLInputElement | null;

  // ─── フッター & 共通 ───
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

    // フッター & 共通
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
    if (tsAvatarsToggle) tsAvatarsToggle.checked = settings.showAvatars ?? false;
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

    if (liveUserColorToggle) liveUserColorToggle.checked = settings.liveShowUserColor ?? false;
    if (liveAvatarsToggle) liveAvatarsToggle.checked = settings.liveShowAvatars ?? settings.showLiveAvatars ?? false;
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

  // 言語選択セレクター
  langSelect?.addEventListener('change', () => {
    const selected = langSelect.value as SupportedLang;
    applyLanguage(selected);
    updateSetting('language', selected);
  });
});
