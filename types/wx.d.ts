/**
 * 微信小游戏 API 最小类型声明。
 * TODO: 接入正式 @types 或微信开发者工具生成的声明后，可收敛本文件。
 */

interface WxStorageSuccessResult {
  data: unknown;
  errMsg: string;
}

interface WxStorageFailResult {
  errMsg: string;
}

interface WxGetStorageOptions {
  key: string;
  success?: (res: WxStorageSuccessResult) => void;
  fail?: (res: WxStorageFailResult) => void;
  complete?: () => void;
}

interface WxSetStorageOptions {
  key: string;
  data: unknown;
  success?: (res: { errMsg: string }) => void;
  fail?: (res: WxStorageFailResult) => void;
  complete?: () => void;
}

interface WxRemoveStorageOptions {
  key: string;
  success?: (res: { errMsg: string }) => void;
  fail?: (res: WxStorageFailResult) => void;
  complete?: () => void;
}

interface WxClearStorageOptions {
  success?: (res: { errMsg: string }) => void;
  fail?: (res: WxStorageFailResult) => void;
  complete?: () => void;
}

interface WxSystemInfo {
  brand: string;
  model: string;
  pixelRatio: number;
  screenWidth: number;
  screenHeight: number;
  windowWidth: number;
  windowHeight: number;
  language: string;
  version: string;
  system: string;
  platform: string;
  SDKVersion: string;
  statusBarHeight?: number;
  /** 设备性能等级；开发者工具常为 -1 / 0 */
  benchmarkLevel?: number;
  safeArea?: {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
}

interface WxMenuButtonRect {
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface WxRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  header?: Record<string, string>;
  timeout?: number;
  success?: (res: { data: unknown; statusCode: number; header: Record<string, string> }) => void;
  fail?: (res: { errMsg: string }) => void;
  complete?: () => void;
}

interface WxPageManager {
  load: (options: { openlink: string }) => Promise<unknown> | unknown;
  show: (options?: { openlink?: string }) => Promise<unknown> | unknown;
  destroy?: () => void;
  on?: (
    event: 'ready' | 'show' | 'destroy' | 'error',
    cb: (res?: { isRecommended?: boolean; errCode?: number; errMsg?: string }) => void,
  ) => void;
  off?: (
    event: 'ready' | 'show' | 'destroy' | 'error',
    cb?: (res?: { isRecommended?: boolean; errCode?: number; errMsg?: string }) => void,
  ) => void;
}

interface WxRewardedVideoAd {
  load: () => Promise<void>;
  show: () => Promise<void>;
  destroy: () => void;
  onLoad: (cb: () => void) => void;
  offLoad: (cb?: () => void) => void;
  onError: (cb: (err: { errMsg: string; errCode?: number }) => void) => void;
  offError: (cb?: (err: { errMsg: string; errCode?: number }) => void) => void;
  onClose: (cb: (res?: { isEnded?: boolean }) => void) => void;
  offClose: (cb?: (res?: { isEnded?: boolean }) => void) => void;
}

interface WxInterstitialAd {
  load: () => Promise<void>;
  show: () => Promise<void>;
  destroy: () => void;
  onLoad: (cb: () => void) => void;
  offLoad: (cb?: () => void) => void;
  onError: (cb: (err: { errMsg: string }) => void) => void;
  offError: (cb?: (err: { errMsg: string }) => void) => void;
  onClose: (cb: () => void) => void;
  offClose: (cb?: () => void) => void;
}

interface WxCustomAdStyle {
  left: number;
  top: number;
  width?: number;
  fixed?: boolean;
}

interface WxCreateCustomAdOptions {
  adUnitId: string;
  adIntervals?: number;
  style: WxCustomAdStyle;
}

interface WxCustomAd {
  show: () => Promise<void>;
  hide: () => Promise<void> | void;
  destroy: () => void;
  onLoad: (cb: () => void) => void;
  offLoad: (cb?: () => void) => void;
  onError: (cb: (err: { errMsg: string; errCode?: number }) => void) => void;
  offError: (cb?: (err: { errMsg: string; errCode?: number }) => void) => void;
  onHide?: (cb: () => void) => void;
  offHide?: (cb?: () => void) => void;
  onClose?: (cb: () => void) => void;
  offClose?: (cb?: () => void) => void;
  isShow?: () => boolean;
}

interface WxInnerAudioContext {
  src: string;
  autoplay: boolean;
  loop: boolean;
  volume: number;
  /** 是否遵循系统静音开关（微信） */
  obeyMuteSwitch?: boolean;
  startTime?: number;
  paused?: boolean;
  play: () => void;
  pause: () => void;
  stop: () => void;
  destroy: () => void;
  seek?: (position: number) => void;
  onCanplay?: (cb: () => void) => void;
  offCanplay?: (cb?: () => void) => void;
  onEnded: (cb: () => void) => void;
  offEnded: (cb?: () => void) => void;
  onError: (cb: (err: { errMsg: string }) => void) => void;
  offError: (cb?: (err: { errMsg: string }) => void) => void;
}

interface WxWebAudioContext {
  resume?: () => Promise<void> | void;
}

interface WxInnerAudioOption {
  mixWithOther?: boolean;
  obeyMuteSwitch?: boolean;
  speakerOn?: boolean;
  success?: () => void;
  fail?: (err: { errMsg: string }) => void;
}

interface WxCloudCollection {
  where: (query: Record<string, unknown>) => WxCloudCollection;
  limit: (n: number) => WxCloudCollection;
  get: () => Promise<{ data: Array<Record<string, unknown> & { _id: string }> }>;
  add: (options: { data: Record<string, unknown> }) => Promise<{ _id: string }>;
  doc: (id: string) => {
    set: (options: { data: Record<string, unknown> }) => Promise<unknown>;
    update?: (options: { data: Record<string, unknown> }) => Promise<unknown>;
    get?: () => Promise<{ data?: Record<string, unknown> }>;
    create?: (options: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

interface WxCloudDatabase {
  collection: (name: string) => WxCloudCollection;
  createCollection?: (name: string) => Promise<unknown>;
  command?: {
    max?: (n: number) => unknown;
    inc?: (n: number) => unknown;
  };
}

interface WxCloud {
  DYNAMIC_CURRENT_ENV?: string;
  init: (options?: { env?: string; traceUser?: boolean }) => void;
  database: (options?: { env?: string }) => WxCloudDatabase;
  callFunction?: (options: {
    name: string;
    data?: Record<string, unknown>;
  }) => Promise<{ result?: unknown }>;
}

interface Wx {
  getStorage: (options: WxGetStorageOptions) => void;
  setStorage: (options: WxSetStorageOptions) => void;
  removeStorage: (options: WxRemoveStorageOptions) => void;
  clearStorage: (options?: WxClearStorageOptions) => void;
  getStorageSync: (key: string) => unknown;
  setStorageSync: (key: string, data: unknown) => void;
  removeStorageSync: (key: string) => void;
  clearStorageSync: () => void;
  getSystemInfoSync: () => WxSystemInfo;
  /** 拆分接口，避免 getSystemInfo 触发 deviceOrientation / jsbridge not ready */
  getWindowInfo?: () => {
    pixelRatio: number;
    screenWidth: number;
    screenHeight: number;
    windowWidth: number;
    windowHeight: number;
    statusBarHeight?: number;
    safeArea?: WxSystemInfo['safeArea'];
  };
  getDeviceInfo?: () => {
    brand: string;
    model: string;
    system: string;
    platform: string;
    benchmarkLevel?: number;
  };
  getAppBaseInfo?: () => {
    language?: string;
    version?: string;
    SDKVersion?: string;
  };
  nextTick?: (cb: () => void) => void;
  getAccountInfoSync?: () => {
    miniProgram?: { envVersion?: 'develop' | 'trial' | 'release' };
  };
  getLaunchOptionsSync?: () => {
    query?: Record<string, string>;
    scene?: number;
  };
  getEnterOptionsSync?: () => {
    query?: Record<string, string>;
    scene?: number;
  };
  getMenuButtonBoundingClientRect?: () => WxMenuButtonRect;
  request: (options: WxRequestOptions) => void;
  createRewardedVideoAd: (options: { adUnitId: string }) => WxRewardedVideoAd;
  createInterstitialAd: (options: { adUnitId: string }) => WxInterstitialAd;
  createCustomAd?: (options: WxCreateCustomAdOptions) => WxCustomAd;
  createInnerAudioContext: (options?: {
    useWebAudioImplement?: boolean;
  }) => WxInnerAudioContext;
  createWebAudioContext?: () => WxWebAudioContext;
  setInnerAudioOption?: (options: WxInnerAudioOption) => void;
  onShow: (cb: (res?: { query?: Record<string, string> }) => void) => void;
  onHide: (cb: () => void) => void;
  offShow: (cb?: () => void) => void;
  offHide: (cb?: () => void) => void;
  onAudioInterruptionBegin?: (cb: () => void) => void;
  offAudioInterruptionBegin?: (cb?: () => void) => void;
  onAudioInterruptionEnd?: (cb: () => void) => void;
  offAudioInterruptionEnd?: (cb?: () => void) => void;
  loadSubpackage: (options: {
    name: string;
    success?: () => void;
    fail?: (err: { errMsg: string }) => void;
    complete?: () => void;
  }) => void;
  reportEvent?: (eventId: string, data?: Record<string, unknown>) => void;
  createCanvas: () => WxCanvas;
  createImage: () => WxImage;
  vibrateShort?: (options?: { type?: 'heavy' | 'medium' | 'light' }) => void;
  showShareMenu?: (options: {
    withShareTicket?: boolean;
    menus?: Array<'shareAppMessage' | 'shareTimeline'>;
    success?: () => void;
    fail?: (err: { errMsg: string }) => void;
  }) => void;
  hideShareMenu?: (options?: {
    menus?: Array<'shareAppMessage' | 'shareTimeline'>;
  }) => void;
  onShareAppMessage?: (
    cb: () => {
      title?: string;
      imageUrl?: string;
      imageUrlId?: string;
      query?: string;
    },
  ) => void;
  offShareAppMessage?: (cb?: () => void) => void;
  onShareTimeline?: (
    cb: () => {
      title?: string;
      imageUrl?: string;
      imageUrlId?: string;
      query?: string;
    },
  ) => void;
  offShareTimeline?: (cb?: () => void) => void;
  shareAppMessage?: (options: {
    title?: string;
    imageUrl?: string;
    imageUrlId?: string;
    query?: string;
    success?: () => void;
    fail?: (err: { errMsg: string }) => void;
  }) => void;
  cloud?: WxCloud;
  /** 海报分享：会话 / 朋友圈 / 保存；部分环境会出现「发表到公众号」 */
  showShareImageMenu?: (options: {
    path: string;
    needShowEntrance?: boolean;
    entrancePath?: string;
    success?: () => void;
    fail?: (err: { errMsg: string }) => void;
    complete?: (res?: { errMsg: string }) => void;
  }) => void;
  /** 拉起公众号贴图发表页（小程序能力；小游戏环境可能不可用） */
  shareToOfficialAccount?: (options: {
    title: string;
    content?: string;
    tags?: string[];
    images?: string[];
    recommendPath?: string;
    recommendTitle?: string;
    success?: (res: { status?: string; postUrl?: string; errMsg: string }) => void;
    fail?: (err: { errMsg: string }) => void;
    complete?: (res: { errMsg: string }) => void;
  }) => void;
  /** 打开游戏圈指定页 / 官方推荐组件（基础库 ≥ 3.6.7） */
  createPageManager?: () => WxPageManager;
  createGameClubButton?: (options: {
    type: 'text' | 'image';
    text?: string;
    image?: string;
    icon?: string;
    openlink?: string;
    hasRedDot?: boolean;
    style: {
      left: number;
      top: number;
      width: number;
      height: number;
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      borderRadius?: number;
      color?: string;
      textAlign?: 'left' | 'center' | 'right';
      fontSize?: number;
      lineHeight?: number;
    };
  }) => {
    show?: () => void;
    hide?: () => void;
    destroy?: () => void;
    onTap?: (listener: () => void) => void;
    offTap?: (listener?: () => void) => void;
    style?: {
      left: number;
      top: number;
      width: number;
      height: number;
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      borderRadius?: number;
      color?: string;
      textAlign?: 'left' | 'center' | 'right';
      fontSize?: number;
      lineHeight?: number;
    };
  };
  showToast?: (options: {
    title: string;
    icon?: 'none' | 'success' | 'error';
    duration?: number;
  }) => void;
  hideToast?: () => void;
  setPreferredFramesPerSecond?: (fps: number) => void;
  onTouchStart: (cb: (e: WxTouchEvent) => void) => void;
  onTouchMove: (cb: (e: WxTouchEvent) => void) => void;
  onTouchEnd: (cb: (e: WxTouchEvent) => void) => void;
  onTouchCancel: (cb: (e: WxTouchEvent) => void) => void;
  offTouchStart: (cb?: (e: WxTouchEvent) => void) => void;
  offTouchMove: (cb?: (e: WxTouchEvent) => void) => void;
  offTouchEnd: (cb?: (e: WxTouchEvent) => void) => void;
  offTouchCancel: (cb?: (e: WxTouchEvent) => void) => void;
}

interface WxCanvas {
  width: number;
  height: number;
  getContext: (type: '2d') => WxCanvasRenderingContext2D;
  createImage?: () => WxImage;
  requestAnimationFrame?: (callback: (time: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
  toTempFilePath?: (options: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    destWidth?: number;
    destHeight?: number;
    fileType?: 'jpg' | 'png';
    quality?: number;
    success?: (res: { tempFilePath: string }) => void;
    fail?: (err: { errMsg: string }) => void;
  }) => void;
}

interface WxImage {
  src: string;
  width: number;
  height: number;
  onload: (() => void) | null;
  onerror: ((err?: unknown) => void) | null;
}

interface WxCanvasRenderingContext2D {
  fillStyle: string | CanvasGradient;
  strokeStyle: string | CanvasGradient;
  lineWidth: number;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  globalAlpha: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeRect: (x: number, y: number, w: number, h: number) => void;
  clearRect: (x: number, y: number, w: number, h: number) => void;
  fillText: (text: string, x: number, y: number) => void;
  strokeText: (text: string, x: number, y: number) => void;
  measureText: (text: string) => { width: number };
  rect: (x: number, y: number, w: number, h: number) => void;
  drawImage: (
    image: WxImage,
    a: number,
    b: number,
    c?: number,
    d?: number,
    e?: number,
    f?: number,
    g?: number,
    h?: number,
  ) => void;
  beginPath: () => void;
  arc: (x: number, y: number, r: number, start: number, end: number) => void;
  ellipse?: (
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
  ) => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  arcTo: (x1: number, y1: number, x2: number, y2: number, radius: number) => void;
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void;
  fill: () => void;
  stroke: () => void;
  clip: () => void;
  save: () => void;
  restore: () => void;
  scale: (x: number, y: number) => void;
  setTransform?: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) => void;
  translate: (x: number, y: number) => void;
  rotate: (angle: number) => void;
  closePath: () => void;
  createLinearGradient: (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) => CanvasGradient;
  createRadialGradient: (
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ) => CanvasGradient;
  roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
}

interface CanvasGradient {
  addColorStop: (offset: number, color: string) => void;
}

type CanvasTextAlign = 'left' | 'right' | 'center' | 'start' | 'end';
type CanvasLineCap = 'butt' | 'round' | 'square';
type CanvasLineJoin = 'bevel' | 'round' | 'miter';
type CanvasTextBaseline =
  | 'top'
  | 'hanging'
  | 'middle'
  | 'alphabetic'
  | 'ideographic'
  | 'bottom';

interface WxTouch {
  identifier: number;
  clientX: number;
  clientY: number;
  /** 相对 Canvas 左上角（小游戏更准） */
  x?: number;
  y?: number;
  pageX?: number;
  pageY?: number;
}

interface WxTouchEvent {
  touches: WxTouch[];
  changedTouches: WxTouch[];
  timeStamp: number;
}

declare const wx: Wx;

interface Console {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
}

declare const console: Console;

declare function requestAnimationFrame(callback: (time: number) => void): number;
declare function cancelAnimationFrame(handle: number): void;
declare function setTimeout(handler: () => void, timeout?: number): number;
declare function clearTimeout(handle: number): void;
