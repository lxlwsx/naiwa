/**
 * 奶娃桌宠 —— 内容数据（动作 / 表情 / 菜单 / 内置应用）。
 *
 * 纯数据、无副作用、不依赖 DSH 或 Electron：DSH 浏览器半侧、桌面 Electron 壳
 * 和 Node 单测共用这一份内容表，避免三套数据各自漂移。
 *
 * 每个可见文案都写 `{ zh, en }`，适配层自己决定用哪一语言（DSH 走 locale 服务，
 * 桌面壳体走系统 locale）。`bubble` 是气泡文案的 key，由 core 交给适配层翻译。
 */

/** 可自动触发 / 可手动点播的动作。effect 由适配层映射成 CSS 动画。 */
export const ACTIONS = {
  eat: {
    id: 'eat',
    label: { zh: '吃什么', en: 'Eat' },
    bubble: 'bubble.action.eat',
    duration: 2400,
    effect: 'nod',
    hearts: false,
    auto: true,
  },
  idle: {
    id: 'idle',
    label: { zh: '待机', en: 'Idle' },
    bubble: '',
    duration: 0,
    effect: 'none',
    hearts: false,
    auto: false,
  },
  'small-move': {
    id: 'small-move',
    label: { zh: '小动作', en: 'Little move' },
    bubble: 'bubble.action.small-move',
    duration: 1800,
    effect: 'wiggle',
    hearts: false,
    auto: true,
  },
  drink: {
    id: 'drink',
    label: { zh: '喝什么', en: 'Drink' },
    bubble: 'bubble.action.drink',
    duration: 2200,
    effect: 'nod',
    hearts: false,
    auto: true,
  },
  'sweet-talk': {
    id: 'sweet-talk',
    label: { zh: '小情话', en: 'Sweet talk' },
    bubble: 'bubble.action.sweet-talk',
    duration: 2600,
    effect: 'sway',
    hearts: true,
    auto: true,
  },
};

/** 菜单 / 随机动作用的动作顺序（不含 idle）。 */
export const ACTION_ORDER = ['eat', 'small-move', 'drink', 'sweet-talk'];

/** 表情是叠加层：不占用状态机，到点自动消失。 */
export const EXPRESSIONS = {
  tsundere: {
    id: 'tsundere',
    label: { zh: '傲娇', en: 'Tsundere' },
    bubble: 'bubble.expression.tsundere',
    face: 'front-closed',
    effect: 'shake',
    duration: 2200,
  },
  shy: {
    id: 'shy',
    label: { zh: '害羞', en: 'Shy' },
    bubble: 'bubble.expression.shy',
    face: 'front-closed',
    effect: 'blush',
    duration: 2400,
  },
  enjoy: {
    id: 'enjoy',
    label: { zh: '享受', en: 'Enjoy' },
    bubble: 'bubble.expression.enjoy',
    face: 'front-closed',
    effect: 'sway',
    duration: 2600,
  },
  blush: {
    id: 'blush',
    label: { zh: '脸红', en: 'Blush' },
    bubble: 'bubble.expression.blush',
    face: 'front',
    effect: 'blush',
    duration: 2600,
  },
  cute: {
    id: 'cute',
    label: { zh: '卖萌', en: 'Cute' },
    bubble: 'bubble.expression.cute',
    face: 'front',
    effect: 'bounce',
    duration: 2600,
    scale: 1.06,
  },
};

/** 显示位置四态：DSH 内 / 桌面窗 / 两者都 / 两者都不。 */
export const POSITION_MODES = [
  { id: 'app', label: { zh: '仅应用内', en: 'In app only' } },
  { id: 'desktop', label: { zh: '仅桌面', en: 'Desktop only' } },
  { id: 'both', label: { zh: '两者都显示', en: 'Both' } },
  { id: 'none', label: { zh: '都不显示', en: 'Hidden' } },
];

/**
 * 内置应用：只放固定 ID + 固定目标，宿主侧只按 ID 查表，绝不执行用户传入的命令。
 * url 类型用系统默认浏览器打开，exec 类型只能来自用户自己写的配置文件。
 */
export const BUILTIN_APPS = [
  {
    id: 'deepseek-web',
    label: { zh: 'DeepSeek 网页端', en: 'DeepSeek Web' },
    type: 'url',
    target: 'https://chat.deepseek.com',
  },
  {
    id: 'dsh-local',
    label: { zh: 'DeepSeek Harness', en: 'DeepSeek Harness' },
    type: 'url',
    target: 'http://127.0.0.1:62987',
  },
];

/** 菜单数据：两个形态共用，点击行为由各自的适配层解释。 */
export const MENU = [
  { id: 'actions', kind: 'actions', label: { zh: '动作', en: 'Actions' } },
  { id: 'outfits', kind: 'outfits', label: { zh: '服饰', en: 'Outfits' } },
  { id: 'expressions', kind: 'expressions', label: { zh: '表情', en: 'Expressions' } },
  { id: 'apps', kind: 'apps', label: { zh: '打开应用', en: 'Open app' } },
  { id: 'position', kind: 'position', label: { zh: '显示位置', en: 'Display' } },
  { id: 'settings', kind: 'settings', label: { zh: '桌宠设置', en: 'Pet settings' } },
  { id: 'quit', kind: 'quit', label: { zh: '退出', en: 'Quit' } },
];

/**
 * 气泡文案表：core 只发 key，适配层各自翻译。
 * DSH 半侧把它们注册进 locale 字典；桌面壳直接按系统语言挑 zh/en。
 */
export const BUBBLE_TEXT = {
  'bubble.greet': { zh: '奶娃来啦～', en: 'Naiwa is here!' },
  'bubble.idle.1': { zh: '摸鱼中…', en: 'Slacking off…' },
  'bubble.idle.2': { zh: '今天也要加油鸭', en: 'You can do it today!' },
  'bubble.idle.3': { zh: '抱抱我嘛', en: 'Hug me?' },
  'bubble.idle.4': { zh: '肚子有点饿了', en: 'A little hungry…' },
  'bubble.idle.5': { zh: '我就在这儿陪你', en: 'I am right here with you' },
  'bubble.click.1': { zh: '呀！被摸头了～', en: 'Ah! Head pats!' },
  'bubble.click.2': { zh: '嘿嘿，好痒', en: 'Hehe, that tickles' },
  'bubble.click.3': { zh: '再摸一下嘛', en: 'One more pat?' },
  'bubble.walk': { zh: '我出去溜达一圈', en: 'Off for a little walk' },
  'bubble.drag': { zh: '放我下来啦～', en: 'Put me down~' },
  'bubble.drop': { zh: '哎哟喂～', en: 'Oof!' },
  'bubble.action.eat': { zh: '好好吃～', en: 'Yummy~' },
  'bubble.action.small-move': { zh: '伸个懒腰～', en: 'Big stretch~' },
  'bubble.action.drink': { zh: '咕嘟咕嘟', en: 'Glug glug' },
  'bubble.action.sweet-talk': { zh: '最喜欢你啦', en: 'I like you the most' },
  'bubble.expression.tsundere': { zh: '哼，才不是呢', en: 'Hmph, no I am not' },
  'bubble.expression.shy': { zh: '别、别看我啦', en: 'D-don’t look at me' },
  'bubble.expression.enjoy': { zh: '好舒服呀', en: 'So comfy' },
  'bubble.expression.blush': { zh: '脸好烫…', en: 'My face is hot…' },
  'bubble.expression.cute': { zh: '快夸我！', en: 'Praise me!' },
};

/** 待机碎碎念的文案 key（翻译在 locale 字典里）。 */
export const IDLE_BUBBLES = ['bubble.idle.1', 'bubble.idle.2', 'bubble.idle.3', 'bubble.idle.4', 'bubble.idle.5'];

/** 点击时随机挑一句回应。 */
export const CLICK_BUBBLES = ['bubble.click.1', 'bubble.click.2', 'bubble.click.3'];

export const WALK_BUBBLE = 'bubble.walk';
export const DRAG_BUBBLE = 'bubble.drag';
export const DROP_BUBBLE = 'bubble.drop';
export const GREET_BUBBLE = 'bubble.greet';

/** 点击时随机挑一个“有表现”的动作；idle 不参与随机。 */
export function randomActionId(random) {
  const roll = (typeof random === 'function' ? random : Math.random)();
  return ACTION_ORDER[Math.min(ACTION_ORDER.length - 1, Math.floor(roll * ACTION_ORDER.length))];
}

/**
 * 取一个带语言的文案，兼容 `{zh,en}`、字符串和 undefined。
 * @param {{zh?: string, en?: string}|string|undefined} label
 * @param {'zh'|'en'} lang
 */
export function labelOf(label, lang) {
  if (!label) return '';
  if (typeof label === 'string') return label;
  return label[lang] ?? label.zh ?? label.en ?? '';
}
