/**
 * DSH 浏览器半侧 —— 源码模板。
 *
 * 这个文件不是运行产物：scripts/build-client.mjs 会把下面两个占位注释替换成
 * content.js / pet-core.js（去掉 ESM export 后的函数体），再写到 naiwa-pet/client.js。
 * 直接改 client.js 会在下次 build 时被覆盖，也会被 tests/client-contract 判红。
 *
 * 契约（v0.2 起不变）：
 *   - 仍然通过 window.__ModuleLoader__.load({ id: 'dsh-naiwa-pet', factory })
 *   - 仍然向 shell.overlay 注册唯一一个 id 为 'naiwa-pet' 的占位
 *   - 素材仍然走宿主 /dsh-naiwa-pet-7341/assets/ 前缀路由
 */
window.__ModuleLoader__.load({
  id: 'dsh-naiwa-pet',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useRef, useState } = React;

    /* @embed:content */

    /* @embed:core */

    const NS = 'naiwa.pet';
    const ROUTE = '/dsh-naiwa-pet-7341';
    const ASSET_BASE = ROUTE + '/assets/';
    const POS_KEY = 'dsh-naiwa-pet:pos:v1';
    const SETTINGS_ORDER = 40;

    const ZH = {
      lang: 'zh',
      greet: '奶娃来啦～',
      'bubble.greet': '奶娃来啦～',
      'bubble.idle.1': '摸鱼中…',
      'bubble.idle.2': '今天也要加油鸭',
      'bubble.idle.3': '抱抱我嘛',
      'bubble.idle.4': '肚子有点饿了',
      'bubble.idle.5': '我就在这儿陪你',
      'bubble.click.1': '呀！被摸头了～',
      'bubble.click.2': '嘿嘿，好痒',
      'bubble.click.3': '再摸一下嘛',
      'bubble.walk': '我出去溜达一圈',
      'bubble.drag': '放我下来啦～',
      'bubble.drop': '哎哟喂～',
      'bubble.action.eat': '好好吃～',
      'bubble.action.small-move': '伸个懒腰～',
      'bubble.action.drink': '咕嘟咕嘟',
      'bubble.action.sweet-talk': '最喜欢你啦',
      'bubble.expression.tsundere': '哼，才不是呢',
      'bubble.expression.shy': '别、别看我啦',
      'bubble.expression.enjoy': '好舒服呀',
      'bubble.expression.blush': '脸好烫…',
      'bubble.expression.cute': '快夸我！',
      'menu.actions': '动作',
      'menu.outfits': '服饰',
      'menu.expressions': '表情',
      'menu.apps': '打开应用',
      'menu.position': '显示位置',
      'menu.settings': '桌宠设置',
      'menu.quit': '退出',
      'menu.action.eat': '吃什么',
      'menu.action.idle': '待机',
      'menu.action.small-move': '小动作',
      'menu.action.drink': '喝什么',
      'menu.action.sweet-talk': '小情话',
      'menu.expression.tsundere': '傲娇',
      'menu.expression.shy': '害羞',
      'menu.expression.enjoy': '享受',
      'menu.expression.blush': '脸红',
      'menu.expression.cute': '卖萌',
      'menu.position.app': '仅应用内',
      'menu.position.desktop': '仅桌面',
      'menu.position.both': '两者都显示',
      'menu.position.none': '都不显示',
      'menu.app.deepseek-web': 'DeepSeek 网页端',
      'menu.app.dsh-local': 'DeepSeek Harness',
      'menu.submenu': '▸',
      'panel.title': '桌宠设置',
      'panel.size': '桌宠大小（px）',
      'panel.mode': '显示位置',
      'panel.outfit': '当前服饰',
      'panel.interval': '自动动作间隔（毫秒，如 2800-6400）',
      'panel.apps': '自定义应用（JSON，改配置文件或在这里编辑）',
      'panel.configPath': '配置文件',
      'panel.desktop': '桌面形态',
      'panel.desktopRunning': '运行中',
      'panel.desktopStopped': '未启动',
      'panel.desktopMissing': '未找到 Electron',
      'panel.save': '保存',
      'panel.saved': '已保存',
      'panel.close': '关闭',
      'panel.reset': '恢复默认',
      'panel.invalidApps': '自定义应用 JSON 不合法，未保存',
      'panel.saveFailed': '保存失败，请检查 DSH 宿主日志',
      'panel.launchFailed': '打开应用失败',
      'settings.title': '桌宠',
      'settings.lead': '奶娃可以待在 DSH 页面里，也可以放进桌面透明小窗。',
      'settings.outfitMissing': '素材未提供时会自动回退到原色帧（不影响使用）。',
      'settings.openDesktop': '启动桌面形态',
      'settings.closeDesktop': '关闭桌面形态',
    };
    const EN = {
      lang: 'en',
      greet: 'Naiwa is here!',
      'bubble.greet': 'Naiwa is here!',
      'bubble.idle.1': 'Slacking off…',
      'bubble.idle.2': 'You can do it today!',
      'bubble.idle.3': 'Hug me?',
      'bubble.idle.4': 'A little hungry…',
      'bubble.idle.5': 'I am right here with you',
      'bubble.click.1': 'Ah! Head pats!',
      'bubble.click.2': 'Hehe, that tickles',
      'bubble.click.3': 'One more pat?',
      'bubble.walk': 'Off for a little walk',
      'bubble.drag': 'Put me down~',
      'bubble.drop': 'Oof!',
      'bubble.action.eat': 'Yummy~',
      'bubble.action.small-move': 'Big stretch~',
      'bubble.action.drink': 'Glug glug',
      'bubble.action.sweet-talk': 'I like you the most',
      'bubble.expression.tsundere': 'Hmph, no I am not',
      'bubble.expression.shy': 'D-don’t look at me',
      'bubble.expression.enjoy': 'So comfy',
      'bubble.expression.blush': 'My face is hot…',
      'bubble.expression.cute': 'Praise me!',
      'menu.actions': 'Actions',
      'menu.outfits': 'Outfits',
      'menu.expressions': 'Expressions',
      'menu.apps': 'Open app',
      'menu.position': 'Display',
      'menu.settings': 'Pet settings',
      'menu.quit': 'Quit',
      'menu.action.eat': 'Eat',
      'menu.action.idle': 'Idle',
      'menu.action.small-move': 'Little move',
      'menu.action.drink': 'Drink',
      'menu.action.sweet-talk': 'Sweet talk',
      'menu.expression.tsundere': 'Tsundere',
      'menu.expression.shy': 'Shy',
      'menu.expression.enjoy': 'Enjoy',
      'menu.expression.blush': 'Blush',
      'menu.expression.cute': 'Cute',
      'menu.position.app': 'In app only',
      'menu.position.desktop': 'Desktop only',
      'menu.position.both': 'Both',
      'menu.position.none': 'Hidden',
      'menu.app.deepseek-web': 'DeepSeek Web',
      'menu.app.dsh-local': 'DeepSeek Harness',
      'menu.submenu': '▸',
      'panel.title': 'Pet settings',
      'panel.size': 'Pet size (px)',
      'panel.mode': 'Display',
      'panel.outfit': 'Outfit',
      'panel.interval': 'Auto action interval (ms, e.g. 2800-6400)',
      'panel.apps': 'Custom apps (JSON)',
      'panel.configPath': 'Config file',
      'panel.desktop': 'Desktop mode',
      'panel.desktopRunning': 'running',
      'panel.desktopStopped': 'stopped',
      'panel.desktopMissing': 'Electron not found',
      'panel.save': 'Save',
      'panel.saved': 'Saved',
      'panel.close': 'Close',
      'panel.reset': 'Reset',
      'panel.invalidApps': 'Custom apps JSON is invalid; nothing saved',
      'panel.saveFailed': 'Save failed; check the host log',
      'panel.launchFailed': 'Could not open the app',
      'settings.title': 'Pet',
      'settings.lead': 'Naiwa can live inside the DSH page or float in a desktop window.',
      'settings.outfitMissing': 'Missing outfit frames fall back to the base art; nothing breaks.',
      'settings.openDesktop': 'Start desktop window',
      'settings.closeDesktop': 'Stop desktop window',
    };

    for (const [key, text] of Object.entries(BUBBLE_TEXT)) {
      ZH[key] = text.zh;
      EN[key] = text.en;
    }

    const BASE_FRAMES = {
      front: ASSET_BASE + 'naiwa-front.png',
      'front-closed': ASSET_BASE + 'naiwa-front-closed.png',
      side: ASSET_BASE + 'naiwa-side.png',
    };

    const MENU_CSS = `
.naiwa-menu{position:fixed;z-index:2147483002;min-width:168px;max-height:70vh;overflow:visible;padding:6px;border-radius:12px;background:rgba(255,252,246,.985);color:#3d2f16;box-shadow:0 14px 38px rgba(40,28,6,.28);font:500 13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:auto}
.naiwa-menu-item{position:relative}
.naiwa-menu-button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.naiwa-menu-button:hover,.naiwa-menu-button:focus-visible{background:rgba(243,196,84,.28);outline:none}
.naiwa-menu-arrow{opacity:.5;font-size:10px}
.naiwa-submenu{display:none;position:absolute;left:100%;top:-6px;min-width:160px;padding:6px;border-radius:12px;background:rgba(255,252,246,.99);box-shadow:0 14px 38px rgba(40,28,6,.24);pointer-events:auto}
.naiwa-menu-item:hover>.naiwa-submenu,.naiwa-menu-item:focus-within>.naiwa-submenu{display:block}
.naiwa-menu-sep{height:1px;margin:5px 8px;background:rgba(80,60,20,.14)}
.naiwa-panel{position:fixed;z-index:2147483003;width:min(340px,calc(100vw - 32px));max-height:calc(100vh - 64px);overflow:auto;padding:14px;border-radius:14px;background:rgba(255,252,246,.99);color:#3d2f16;box-shadow:0 18px 48px rgba(40,28,6,.3);font:500 13px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:auto}
.naiwa-panel h3{margin:0 0 10px;font-size:15px}
.naiwa-field{display:grid;gap:4px;margin-bottom:10px}
.naiwa-field>span{font-size:12px;opacity:.78}
.naiwa-field input[type="number"],.naiwa-field input[type="text"],.naiwa-field textarea,.naiwa-field select{width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid rgba(90,70,30,.24);border-radius:8px;background:#fffdf7;color:inherit;font:inherit}
.naiwa-field textarea{min-height:88px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px}
.naiwa-row{display:flex;flex-wrap:wrap;gap:6px}
.naiwa-chip{padding:5px 10px;border:1px solid rgba(90,70,30,.22);border-radius:999px;background:#fffdf7;color:inherit;font:inherit;cursor:pointer}
.naiwa-chip.is-active{border-color:rgba(210,150,30,.9);background:rgba(243,196,84,.34)}
.naiwa-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
.naiwa-actions button{padding:6px 14px;border:0;border-radius:9px;background:rgba(243,196,84,.9);color:#3d2f16;font:inherit;cursor:pointer}
.naiwa-hint{font-size:11.5px;opacity:.66;word-break:break-all}
.naiwa-settings-page{display:grid;gap:14px;max-width:620px;color:inherit;font:inherit}
.naiwa-settings-page h3{margin:0;font-size:15px}
.naiwa-settings-page p{margin:0;opacity:.75;font-size:12.5px}
.naiwa-settings-card{display:grid;gap:10px;padding:14px;border:1px solid rgba(120,100,60,.18);border-radius:12px}
`;

    const rand = (min, max) => min + Math.random() * (max - min);

    function labelText(label, lang) {
      if (!label) return '';
      if (typeof label === 'string') return label;
      return label[lang] ?? label.zh ?? label.en ?? '';
    }

    function loadSavedPosition() {
      try {
        const raw = window.localStorage.getItem(POS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return { x: parsed.x, y: parsed.y };
      } catch {
        /* 隐私模式下读不到就算了 */
      }
      return null;
    }

    function persistPosition(position) {
      try {
        window.localStorage.setItem(POS_KEY, JSON.stringify(position));
      } catch {
        /* 存不了就算了 */
      }
    }

    async function apiFetch(path, options) {
      const response = await fetch(ROUTE + path, options);
      if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + path);
      return response.json();
    }

    function loadConfig() {
      return apiFetch('/config', { cache: 'no-store' });
    }

    function saveConfig(patch) {
      return apiFetch('/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Naiwa-Pet': '1' },
        body: JSON.stringify(patch),
      });
    }

    function launchApp(id) {
      return apiFetch('/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Naiwa-Pet': '1' },
        body: JSON.stringify({ id }),
      });
    }

    function pingHost(part) {
      return fetch(ROUTE + '/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Naiwa-Pet': '1' },
        body: JSON.stringify({ part }),
      }).catch(() => {});
    }

    function loadOutfitIndex() {
      return apiFetch('/assets/outfits/index.json', { cache: 'no-cache' });
    }

    function probeImage(url) {
      return new Promise((resolve) => {
        const image = new Image();
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };
        const timer = setTimeout(() => finish(false), 1500);
        image.onload = () => {
          clearTimeout(timer);
          finish(image.naturalWidth > 0 && image.naturalHeight > 0);
        };
        image.onerror = () => {
          clearTimeout(timer);
          finish(false);
        };
        image.src = url;
      });
    }

    const frameCache = new Map();

    async function resolveOutfitFrames(outfit) {
      if (!outfit || !outfit.dir) return { ...BASE_FRAMES, ratioSource: BASE_FRAMES.front };
      const key = outfit.dir;
      if (frameCache.has(key)) return frameCache.get(key);
      const pending = (async () => {
        const frames = { ...BASE_FRAMES };
        let metaFrames = null;
        try {
          const meta = await apiFetch('/assets/outfits/' + outfit.dir + '/meta.json', { cache: 'no-cache' });
          if (Array.isArray(meta?.frames) && meta.frames.length > 0) metaFrames = new Set(meta.frames);
        } catch {
          metaFrames = null;
        }
        for (const name of FRAME_NAMES) {
          if (metaFrames && !metaFrames.has(name)) continue;
          const url = ASSET_BASE + 'outfits/' + outfit.dir + '/' + name + '.png';
          if (await probeImage(url)) frames[name] = url;
        }
        return { ...frames };
      })();
      frameCache.set(key, pending);
      return pending;
    }

    function useHostConfig() {
      const [snapshot, setSnapshot] = useState(null);
      const [error, setError] = useState('');
      const apply = useCallback((next) => {
        if (next && next.config) setSnapshot(next);
      }, []);
      useEffect(() => {
        let alive = true;
        let timer = 0;
        const refresh = () => {
          loadConfig()
            .then((next) => {
              if (!alive) return;
              setSnapshot(next);
              setError('');
            })
            .catch((err) => {
              if (alive) setError(String(err && err.message ? err.message : err));
            })
            .finally(() => {
              if (alive) timer = setTimeout(refresh, 2500);
            });
        };
        refresh();
        return () => {
          alive = false;
          clearTimeout(timer);
        };
      }, []);
      const save = useCallback(
        async (patch) => {
          const next = await saveConfig(patch);
          apply(next);
          return next;
        },
        [apply],
      );
      return { snapshot, save, error };
    }

    function BurstLayer(props) {
      const { bursts } = props;
      return h(
        'div',
        { className: 'naiwa-fx' },
        bursts.map((item) =>
          h(
            'div',
            { key: item.id, className: 'naiwa-fx' },
            item.parts.map((part, index) =>
              h(
                'span',
                {
                  key: index,
                  className: item.kind === 'hearts' ? 'naiwa-heart' : 'naiwa-dust',
                  style: {
                    left: part.left,
                    top: item.kind === 'hearts' ? part.top : undefined,
                    fontSize: part.size + 'px',
                    '--dx': part.dx,
                    animationDelay: part.delay + 'ms',
                  },
                },
                part.glyph,
              ),
            ),
          ),
        ),
      );
    }

    function SettingsForm(props) {
      const { t, snapshot, save, page } = props;
      const config = snapshot?.config ?? null;
      const outfits = props.outfits ?? [];
      const [draft, setDraft] = useState(null);
      const [status, setStatus] = useState('');
      const [appsText, setAppsText] = useState('');
      const [appsDirty, setAppsDirty] = useState(false);
      const [sizeDraft, setSizeDraft] = useState(config?.petSize ?? 168);
      const [customAppsError, setCustomAppsError] = useState('');

      useEffect(() => {
        if (!config) return;
        if (!draft) setDraft({ ...config });
        setSizeDraft(config.petSize);
      }, [config, draft]);

      useEffect(() => {
        if (config && !appsDirty) setAppsText(JSON.stringify(config.customApps ?? [], null, 2));
      }, [config, appsDirty]);

      if (!config || !draft) return null;

      const commit = async (patch) => {
        try {
          const next = await save(patch);
          setDraft({ ...next.config });
          setStatus(t('panel.saved'));
          setTimeout(() => setStatus(''), 1600);
        } catch (err) {
          console.warn('[dsh-naiwa-pet] save failed: ' + String(err));
          setStatus(t('panel.saveFailed'));
        }
      };

      const update = (key, value) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
        setStatus('');
      };

      const applyApps = () => {
        let parsed;
        try {
          parsed = JSON.parse(appsText || '[]');
        } catch {
          setCustomAppsError(t('panel.invalidApps'));
          return;
        }
        if (!Array.isArray(parsed)) {
          setCustomAppsError(t('panel.invalidApps'));
          return;
        }
        setCustomAppsError('');
        setAppsDirty(false);
        commit({ customApps: parsed });
      };

      const chooseOutfit = (id) => {
        update('activeOutfit', id);
        commit({ activeOutfit: id });
      };

      const body = [
        h(
          'div',
          { key: 'size', className: 'naiwa-field' },
          h('span', null, t('panel.size')),
          h('input', {
            type: 'range',
            min: 80,
            max: 360,
            step: 4,
            value: sizeDraft,
            onChange: (event) => {
              const value = Number(event.target.value);
              setSizeDraft(value);
              update('petSize', value);
            },
            onPointerUp: () => commit({ petSize: sizeDraft }),
            onKeyUp: () => commit({ petSize: sizeDraft }),
          }),
          h('span', { className: 'naiwa-hint' }, String(sizeDraft) + ' px'),
        ),
        h(
          'div',
          { key: 'mode', className: 'naiwa-field' },
          h('span', null, t('panel.mode')),
          h(
            'div',
            { className: 'naiwa-row' },
            POSITION_MODES.map((mode) =>
              h(
                'button',
                {
                  key: mode.id,
                  type: 'button',
                  className: 'naiwa-chip' + (draft.displayMode === mode.id ? ' is-active' : ''),
                  onClick: () => {
                    update('displayMode', mode.id);
                    commit({ displayMode: mode.id });
                  },
                },
                t('menu.position.' + mode.id),
              ),
            ),
          ),
        ),
        h(
          'div',
          { key: 'outfit', className: 'naiwa-field' },
          h('span', null, t('panel.outfit')),
          h(
            'select',
            { value: draft.activeOutfit, onChange: (event) => chooseOutfit(event.target.value) },
            outfits.map((outfit) =>
              h('option', { key: outfit.id, value: outfit.id }, labelText(outfit.name, t('lang'))),
            ),
          ),
          h('span', { className: 'naiwa-hint' }, t('settings.outfitMissing')),
        ),
        h(
          'div',
          { key: 'interval', className: 'naiwa-field' },
          h('span', null, t('panel.interval')),
          h('input', {
            type: 'text',
            value: String(draft.autoActionInterval ?? ''),
            onChange: (event) => update('autoActionInterval', event.target.value),
            onBlur: () => commit({ autoActionInterval: draft.autoActionInterval }),
          }),
        ),
        h(
          'div',
          { key: 'apps', className: 'naiwa-field' },
          h('span', null, t('panel.apps')),
          h('textarea', {
            value: appsText,
            onChange: (event) => {
              setAppsText(event.target.value);
              setAppsDirty(true);
            },
          }),
          customAppsError ? h('span', { className: 'naiwa-hint' }, customAppsError) : null,
        ),
        h(
          'div',
          { key: 'meta', className: 'naiwa-field' },
          h('span', null, t('panel.desktop')),
          h(
            'span',
            { className: 'naiwa-hint' },
            snapshot?.desktop?.running
              ? t('panel.desktopRunning')
              : snapshot?.desktop?.electron
                ? t('panel.desktopStopped')
                : t('panel.desktopMissing'),
          ),
          h('span', { className: 'naiwa-hint' }, t('panel.configPath') + ': ' + (snapshot?.configPath ?? '')),
        ),
      ];

      if (page) {
        return h(
          'div',
          { className: 'naiwa-settings-page' },
          h('h3', null, t('panel.title')),
          h('p', null, t('settings.lead')),
          h('div', { className: 'naiwa-settings-card' }, body),
          h(
            'div',
            { className: 'naiwa-actions' },
            appsDirty ? h('button', { type: 'button', onClick: applyApps }, t('panel.save')) : null,
            status ? h('span', { className: 'naiwa-hint' }, status) : null,
          ),
        );
      }

      return h(
        'div',
        { className: 'naiwa-panel', style: { right: '20px', bottom: '20px', left: 'auto', top: 'auto' } },
        h('h3', null, t('panel.title')),
        body,
        h(
          'div',
          { className: 'naiwa-actions' },
          appsDirty ? h('button', { type: 'button', onClick: applyApps }, t('panel.save')) : null,
          h('button', { type: 'button', onClick: props.onClose }, t('panel.close')),
        ),
      );
    }

    function NaiwaPet(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      const lang = t('lang') === 'en' ? 'en' : 'zh';
      const layerRef = useRef(null);
      const stageRef = useRef(null);
      const flipRef = useRef(null);
      const tiltRef = useRef(null);
      const bodyRef = useRef(null);
      const shadowRef = useRef(null);
      const bubbleRef = useRef(null);
      const menuRef = useRef(null);
      const petRef = useRef(null);

      const [ready, setReady] = useState(false);
      const [bursts, setBursts] = useState([]);
      const [outfits, setOutfits] = useState([]);
      const [frames, setFrames] = useState({ ...BASE_FRAMES });
      const [menu, setMenu] = useState(null);
      const [panel, setPanel] = useState(false);
      const [frameHeight, setFrameHeight] = useState(Math.round(168 * DEFAULT_FRAME_RATIO));
      const seqRef = useRef(0);
      const squashTimerRef = useRef(0);
      const bubbleTimerRef = useRef(0);

      const { snapshot, save } = useHostConfig();
      const config = snapshot?.config ?? null;
      const displayMode = config?.displayMode ?? 'app';
      const visible = displayMode === 'app' || displayMode === 'both';

      useEffect(() => {
        loadOutfitIndex()
          .then((index) => {
            if (Array.isArray(index?.outfits)) setOutfits(index.outfits);
          })
          .catch((err) => console.warn('[dsh-naiwa-pet] outfit index unavailable: ' + String(err)));
      }, []);

      const activeOutfit = (() => {
        if (!config) return null;
        return outfits.find((outfit) => outfit.id === config.activeOutfit) ?? outfits[0] ?? null;
      })();

      useEffect(() => {
        let alive = true;
        if (!activeOutfit) {
          setFrames({ ...BASE_FRAMES });
          return () => {
            alive = false;
          };
        }
        resolveOutfitFrames(activeOutfit)
          .then((next) => {
            if (alive) setFrames({ front: next.front, 'front-closed': next['front-closed'], side: next.side });
          })
          .catch(() => {
            if (alive) setFrames({ ...BASE_FRAMES });
          });
        return () => {
          alive = false;
        };
      }, [activeOutfit]);

      const paint = useCallback((view) => {
        const stage = stageRef.current;
        const flip = flipRef.current;
        const tilt = tiltRef.current;
        const body = bodyRef.current;
        const shadow = shadowRef.current;
        if (!stage || !flip || !tilt || !body || !shadow) return;
        stage.style.transform = 'translate3d(' + view.x.toFixed(2) + 'px,' + view.y.toFixed(2) + 'px,0)';
        stage.style.width = view.size + 'px';
        stage.style.height = view.stageH + 'px';
        flip.style.transform = view.dir === 1 ? 'scaleX(1)' : 'scaleX(-1)';
        tilt.style.transform = view.tilt ? 'rotate(' + view.tilt.toFixed(2) + 'deg) scale(1.03)' : '';
        body.dataset.face = view.face;
        body.dataset.mode = view.mode;
        body.dataset.action = view.actionEffect || '';
        body.dataset.expression = view.expressionEffect || '';
        body.style.transform =
          view.expressionScale && view.expressionScale !== 1 ? 'scale(' + view.expressionScale + ')' : '';

        const floorTop = view.floorY + view.stageH - 8;
        const air = Math.max(0, view.floorY - view.y);
        const k = Math.min(1, air / 320);
        shadow.style.transform =
          'translate3d(' +
          (view.x + view.size / 2 - 56).toFixed(1) +
          'px,' +
          floorTop.toFixed(1) +
          'px,0) scale(' +
          (1 - 0.32 * k).toFixed(3) +
          ',' +
          (1 - 0.2 * k).toFixed(3) +
          ')';
        shadow.style.opacity = String(0.85 - 0.5 * k);
        setFrameHeight((prev) => (prev === view.stageH ? prev : view.stageH));
      }, []);

      const speak = useCallback(
        (key, ms) => {
          const bubble = bubbleRef.current;
          if (!bubble) return;
          const text = t(key);
          if (!text || text === key) return;
          bubble.textContent = text;
          bubble.classList.add('show');
          clearTimeout(bubbleTimerRef.current);
          bubbleTimerRef.current = window.setTimeout(
            () => {
              bubble.classList.remove('show');
            },
            ms == null ? 2400 : ms,
          );
        },
        [t],
      );

      const burst = useCallback((kind) => {
        const id = ++seqRef.current;
        const parts = [];
        if (kind === 'hearts') {
          const glyphs = ['💛', '🧡', '💛', '✨'];
          for (let i = 0; i < 6; i += 1) {
            parts.push({
              glyph: glyphs[i % glyphs.length],
              left: (48 + rand(-18, 18)).toFixed(1) + '%',
              top: (24 + rand(-6, 6)).toFixed(1) + '%',
              dx: rand(-48, 48).toFixed(0) + 'px',
              delay: Math.round(rand(0, 170)),
              size: Math.round(rand(13, 19)),
            });
          }
        } else {
          for (let i = 0; i < 5; i += 1) {
            parts.push({
              glyph: '',
              left: (50 + rand(-16, 16)).toFixed(1) + '%',
              top: '',
              dx: rand(-26, 26).toFixed(0) + 'px',
              delay: Math.round(rand(0, 60)),
              size: Math.round(rand(7, 13)),
            });
          }
        }
        setBursts((prev) => [...prev.slice(-3), { id, kind, parts }]);
        window.setTimeout(() => setBursts((prev) => prev.filter((item) => item.id !== id)), 1400);
      }, []);

      const flashClass = useCallback((name, ms) => {
        const body = bodyRef.current;
        if (!body) return;
        body.classList.remove(name);
        void body.offsetWidth;
        body.classList.add(name);
        window.setTimeout(() => body.classList.remove(name), ms);
      }, []);

      // 宠物核心只创建一次：之后靠 setter 响应配置变化。
      useEffect(() => {
        const pet = createPet({
          content: {
            ACTIONS,
            EXPRESSIONS,
            ACTION_ORDER,
            IDLE_BUBBLES,
            CLICK_BUBBLES,
            WALK_BUBBLE,
            DRAG_BUBBLE,
            DROP_BUBBLE,
            GREET_BUBBLE,
          },
          motion: 'dom',
          size: config ? config.petSize : 168,
          frameRatio: DEFAULT_FRAME_RATIO,
          initial: loadSavedPosition() ?? undefined,
          requestFrame: (callback) => window.requestAnimationFrame(callback),
          cancelFrame: (id) => window.cancelAnimationFrame(id),
          bounds: () => ({ width: window.innerWidth, height: window.innerHeight }),
          now: () => performance.now(),
          onPaint: paint,
          onBubble: speak,
          onBurst: burst,
          onPersist: persistPosition,
          onEvent: (type) => {
            if (type === 'squash') {
              flashClass('is-squash', 300);
            } else if (type === 'spin') {
              flashClass('is-spin', 850);
            } else if (type === 'hop') {
              flashClass('is-hop', 440);
            }
          },
        });
        petRef.current = pet;
        pet.start();
        setReady(true);
        pingHost('overlay');
        const onResize = () => pet.resize();
        window.addEventListener('resize', onResize);
        return () => {
          window.removeEventListener('resize', onResize);
          pet.stop();
          petRef.current = null;
          clearTimeout(squashTimerRef.current);
          clearTimeout(bubbleTimerRef.current);
        };
      }, []);

      // 配置热更新：大小 / 自动动作间隔 / 服饰。
      useEffect(() => {
        const pet = petRef.current;
        if (!pet) return;
        if (config) {
          pet.setSize(config.petSize);
          pet.setOutfit(config.activeOutfit);
          pet.paint();
        }
      }, [config]);

      useEffect(() => {
        const pet = petRef.current;
        if (!pet) return;
        const next = config ? config.autoActionInterval : undefined;
        pet.setIntervalSource(() => next);
      }, [config]);

      useEffect(() => {
        const pet = petRef.current;
        if (pet) pet.setFrames(frames);
      }, [frames]);

      // 右键菜单 / 设置面板的关闭逻辑。
      useEffect(() => {
        if (!menu && !panel) return undefined;
        const onDown = (event) => {
          const menuNode = menuRef.current;
          if (menuNode && menuNode.contains(event.target)) return;
          if (event.target && event.target.closest && event.target.closest('.naiwa-panel')) return;
          setMenu(null);
          setPanel(false);
        };
        const onKey = (event) => {
          if (event.key === 'Escape') {
            setMenu(null);
            setPanel(false);
          }
        };
        window.addEventListener('pointerdown', onDown, true);
        window.addEventListener('keydown', onKey);
        return () => {
          window.removeEventListener('pointerdown', onDown, true);
          window.removeEventListener('keydown', onKey);
        };
      }, [menu, panel]);

      const openMenu = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        const pet = petRef.current;
        if (pet && pet.state().dragging) pet.pointerCancel({});
        setPanel(false);
        const width = 190;
        const height = 320;
        setMenu({
          x: Math.min(event.clientX, window.innerWidth - width - 12),
          y: Math.min(event.clientY, Math.max(12, window.innerHeight - height)),
        });
      }, []);

      const setActiveOutfit = useCallback(
        async (id) => {
          setMenu(null);
          await save({ activeOutfit: id }).catch((err) =>
            console.warn('[dsh-naiwa-pet] outfit save failed ' + String(err)),
          );
        },
        [save],
      );

      const setDisplayMode = useCallback(
        async (mode) => {
          setMenu(null);
          await save({ displayMode: mode }).catch((err) =>
            console.warn('[dsh-naiwa-pet] mode save failed ' + String(err)),
          );
        },
        [save],
      );

      const openApp = useCallback(
        async (id) => {
          setMenu(null);
          try {
            await launchApp(id);
          } catch (err) {
            console.warn('[dsh-naiwa-pet] launch failed: ' + String(err));
            speak('panel.launchFailed', 1800);
          }
        },
        [speak],
      );

      const pointerPoint = (event) => ({
        x: event.clientX,
        y: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        pointerId: event.pointerId,
        time: performance.now(),
      });

      const onPointerDown = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        setMenu(null);
        setPanel(false);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* 指针捕获失败时仍可用 window 级兜底 */
        }
        const pet = petRef.current;
        if (pet) pet.pointerDown(pointerPoint(event));
      };

      const onPointerMove = (event) => {
        const pet = petRef.current;
        if (pet) pet.pointerMove(pointerPoint(event));
      };

      const onPointerUp = (event) => {
        const pet = petRef.current;
        if (pet) pet.pointerUp(pointerPoint(event));
      };

      const onPointerCancel = (event) => {
        const pet = petRef.current;
        if (pet) pet.pointerCancel(pointerPoint(event));
      };

      const activeMenuGroups = menu
        ? [
            {
              id: 'actions',
              label: t('menu.actions'),
              items: ACTION_ORDER.map((id) => ({
                id: 'action:' + id,
                label: t('menu.action.' + id),
                run: () => {
                  setMenu(null);
                  petRef.current?.playAction(id);
                },
              })),
            },
            {
              id: 'outfits',
              label: t('menu.outfits'),
              items: outfits.map((outfit) => ({
                id: 'outfit:' + outfit.id,
                label: labelText(outfit.name, lang) + (config && config.activeOutfit === outfit.id ? ' ✓' : ''),
                run: () => setActiveOutfit(outfit.id),
              })),
            },
            {
              id: 'expressions',
              label: t('menu.expressions'),
              items: Object.values(EXPRESSIONS).map((expression) => ({
                id: 'expression:' + expression.id,
                label: t('menu.expression.' + expression.id),
                run: () => {
                  setMenu(null);
                  petRef.current?.setExpression(expression.id);
                },
              })),
            },
            {
              id: 'apps',
              label: t('menu.apps'),
              items: [...BUILTIN_APPS, ...((config && config.customApps) || [])].map((app) => ({
                id: 'app:' + app.id,
                label: labelText(typeof app.label === 'string' ? app.label : app.label, lang),
                run: () => openApp(app.id),
              })),
            },
            {
              id: 'position',
              label: t('menu.position'),
              items: POSITION_MODES.map((mode) => ({
                id: 'mode:' + mode.id,
                label: t('menu.position.' + mode.id) + (displayMode === mode.id ? ' ✓' : ''),
                run: () => setDisplayMode(mode.id),
              })),
            },
          ]
        : [];

      const trailingMenu = [
        {
          id: 'settings',
          label: t('menu.settings'),
          run: () => {
            setMenu(null);
            setPanel(true);
          },
        },
        { id: 'quit', label: t('menu.quit'), run: () => setDisplayMode('none') },
      ];

      const layerStyle = { display: visible ? '' : 'none' };

      return h(
        'div',
        { ref: layerRef, className: 'naiwa-layer', 'aria-hidden': 'true', style: layerStyle },
        h('style', null, PET_CSS + MENU_CSS),
        h('div', { ref: shadowRef, className: 'naiwa-shadow' }),
        h(
          'div',
          {
            ref: stageRef,
            className: 'naiwa-stage',
            style: {
              width: config ? config.petSize + 'px' : '168px',
              height: frameHeight + 'px',
              opacity: ready ? 1 : 0,
              transition: 'opacity .25s ease',
            },
          },
          h(
            'div',
            { ref: flipRef, className: 'naiwa-flip' },
            h(
              'div',
              { ref: tiltRef, className: 'naiwa-tilt' },
              h(
                'div',
                { ref: bodyRef, className: 'naiwa-body', 'data-mode': 'idle', 'data-face': 'front' },
                h('img', { className: 'naiwa-img naiwa-front', src: frames.front, alt: '', draggable: false }),
                h('img', { className: 'naiwa-img naiwa-side', src: frames.side, alt: '', draggable: false }),
                h('img', {
                  className: 'naiwa-img naiwa-closed',
                  src: frames['front-closed'],
                  alt: '',
                  draggable: false,
                }),
                h('div', { className: 'naiwa-blush' }),
              ),
            ),
          ),
          h('div', { ref: bubbleRef, className: 'naiwa-bubble' }),
          h(BurstLayer, { bursts }),
          h('div', {
            className: 'naiwa-hit',
            role: 'presentation',
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel,
            onContextMenu: openMenu,
          }),
        ),
        menu
          ? h(
              'div',
              {
                ref: menuRef,
                className: 'naiwa-menu',
                style: { left: menu.x + 'px', top: menu.y + 'px' },
                onContextMenu: (event) => event.preventDefault(),
              },
              activeMenuGroups.map((group) =>
                h(
                  'div',
                  { key: group.id, className: 'naiwa-menu-item' },
                  h(
                    'button',
                    { type: 'button', className: 'naiwa-menu-button' },
                    h('span', null, group.label),
                    h('span', { className: 'naiwa-menu-arrow' }, '▸'),
                  ),
                  h(
                    'div',
                    { className: 'naiwa-submenu' },
                    group.items.map((item) =>
                      h(
                        'button',
                        {
                          key: item.id,
                          type: 'button',
                          className: 'naiwa-menu-button',
                          onClick: item.run,
                        },
                        h('span', null, item.label),
                      ),
                    ),
                  ),
                ),
              ),
              h('div', { className: 'naiwa-menu-sep' }),
              trailingMenu.map((item) =>
                h(
                  'button',
                  { key: item.id, type: 'button', className: 'naiwa-menu-button', onClick: item.run },
                  h('span', null, item.label),
                ),
              ),
            )
          : null,
        panel && visible
          ? h(SettingsForm, {
              t,
              snapshot,
              save,
              outfits,
              onClose: () => setPanel(false),
            })
          : null,
      );
    }

    function NaiwaSettingsSection(props) {
      const t = props.t;
      const { snapshot, save } = useHostConfig();
      const [outfits, setOutfits] = useState([]);
      useEffect(() => {
        loadOutfitIndex()
          .then((index) => {
            if (Array.isArray(index?.outfits)) setOutfits(index.outfits);
          })
          .catch(() => setOutfits([]));
        pingHost('settings');
      }, []);
      return h(
        React.Fragment,
        null,
        h('style', null, MENU_CSS),
        h(SettingsForm, { t, snapshot, save, outfits, page: true }),
      );
    }

    return {
      name: 'naiwa-pet',
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const disposers = [];
          try {
            disposers.push(ctx.locale.register(NS, 'zh', ZH));
            disposers.push(ctx.locale.register(NS, 'en', EN));
          } catch (error) {
            console.warn('[dsh-naiwa-pet] 文案注册失败（宠物仍可用，气泡走 key 兜底）: ' + String(error));
          }
          return () => {
            for (const dispose of disposers) dispose();
          };
        }, 'dsh-naiwa-pet: dictionaries');

        const t = ctx.locale.bind(NS);

        ctx.slots.inject('shell.overlay', function* () {
          yield ctx.slots.register({ name: 'shell.overlay', id: 'naiwa-pet', order: 1200 }, () => h(NaiwaPet, { t }));
        });

        ctx.slots.inject('settings.section', function* () {
          yield ctx.slots.register(
            { name: 'settings.section', id: 'naiwa-pet', order: SETTINGS_ORDER, label: () => t('settings.title') },
            () => h(NaiwaSettingsSection, { t }),
          );
        });
      },
    };
  },
});
