/**
 * dsh-naiwa-pet —— 浏览器半侧。
 *
 * 往 shell.overlay 插槽里注册一只浮在整个页面之上的小奶娃：
 *   - 待机：呼吸、随机眨眼、偶发歪头/小跳/碎碎念
 *   - 行走：沿视口底部走到随机目标点（侧面帧，朝右时镜像）
 *   - 拖动：跟手、带一点悬挂感和速度倾斜；松手后重力下落、弹跳、压扁、扬尘
 *   - 点击：开心跳一下 + 爱心 + 闭眼笑；双击：原地转圈
 *
 * 这一半不带素材，精灵帧由宿主半侧的路由 /dsh-naiwa-pet-7341/assets/*.png 提供。
 * 位置存 localStorage，刷新后还在原地。
 */
window.__ModuleLoader__.load({
  id: 'dsh-naiwa-pet',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useRef, useState } = React;

    const NS = 'naiwa.pet';
    const ASSET_BASE = '/dsh-naiwa-pet-7341/assets/';
    const POS_KEY = 'dsh-naiwa-pet:pos:v1';

    const FRAME_W = 168;
    const FRAME_RATIO = 768 / 640; // 素材画布比例，图片加载后会用真实比例覆盖
    const FLOOR_GAP = 12;
    const GRAVITY = 2400;
    const WALK_SPEED = 58;

    const ZH = {
      greet: '奶娃来啦～',
      'idle.1': '摸鱼中…',
      'idle.2': '今天也要加油鸭',
      'idle.3': '抱抱我嘛',
      'idle.4': '肚子有点饿了',
      'idle.5': '你在忙什么呀？',
      'idle.6': '我就在这儿陪你',
      'click.1': '呀！被摸头了～',
      'click.2': '嘿嘿，好痒',
      'click.3': '再摸一下嘛',
      'drag.1': '放我下来啦～',
      'drop.1': '哎哟喂～',
      'walk.1': '我出去溜达一圈',
    };
    const EN = {
      greet: 'Naiwa is here!',
      'idle.1': 'Slacking off…',
      'idle.2': 'You can do it today!',
      'idle.3': 'Hug me?',
      'idle.4': 'A little hungry…',
      'idle.5': 'What are you up to?',
      'idle.6': 'I am right here with you',
      'click.1': 'Ah! Head pats!',
      'click.2': 'Hehe, that tickles',
      'click.3': 'One more pat?',
      'drag.1': 'Put me down~',
      'drop.1': 'Oof!',
      'walk.1': 'Off for a little walk',
    };

    const CSS = `
.naiwa-layer{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:2147483000;contain:layout style}
.naiwa-shadow{position:absolute;left:0;top:0;width:112px;height:18px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.36) 0%,rgba(0,0,0,.15) 45%,rgba(0,0,0,0) 72%);filter:blur(1.5px);pointer-events:none;will-change:transform,opacity}
.naiwa-stage{position:absolute;left:0;top:0;pointer-events:none;will-change:transform}
.naiwa-flip,.naiwa-tilt,.naiwa-body{position:absolute;inset:0;transform-origin:50% 96%}
.naiwa-body{pointer-events:none}
.naiwa-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%;pointer-events:none;-webkit-user-drag:none;user-select:none;transition:opacity .1s linear}
.naiwa-side,.naiwa-closed{opacity:0}
.naiwa-body[data-face="side"] .naiwa-front{opacity:0}
.naiwa-body[data-face="side"] .naiwa-side{opacity:1}
.naiwa-body[data-face="closed"] .naiwa-closed{opacity:1}
.naiwa-body[data-mode="idle"]{animation:naiwa-breathe 3.6s ease-in-out infinite}
.naiwa-body[data-mode="walk"]{animation:naiwa-walk .46s ease-in-out infinite}
.naiwa-body[data-mode="drag"]{animation:naiwa-dangle 1.9s ease-in-out infinite}
.naiwa-body.is-squash{animation:naiwa-squash .24s ease-out}
.naiwa-body.is-spin{animation:naiwa-spin .8s ease-in-out}
.naiwa-hit{position:absolute;inset:0;pointer-events:auto;cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.naiwa-stage.is-dragging .naiwa-hit{cursor:grabbing}
.naiwa-bubble{position:absolute;left:50%;bottom:88%;transform:translate(-50%,4px);max-width:230px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:6px 10px;border-radius:12px;background:rgba(255,252,244,.96);color:#4a3a1c;font:500 12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:0;transition:opacity .16s ease,transform .16s ease;pointer-events:none}
.naiwa-bubble.show{opacity:1;transform:translate(-50%,-4px)}
.naiwa-bubble::after{content:"";position:absolute;left:50%;bottom:-5px;width:10px;height:10px;margin-left:-5px;background:rgba(255,252,244,.96);border-radius:2px;transform:rotate(45deg)}
.naiwa-fx{position:absolute;inset:0;pointer-events:none;overflow:visible}
.naiwa-heart{position:absolute;line-height:1;animation:naiwa-float 1.15s ease-out forwards;will-change:transform,opacity}
.naiwa-dust{position:absolute;bottom:1%;border-radius:50%;background:rgba(150,128,86,.42);animation:naiwa-dust .55s ease-out forwards}
@keyframes naiwa-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.014,.984) translateY(.6%)}}
@keyframes naiwa-walk{0%{transform:rotate(-5deg) translateY(0) scale(1.02,.98)}25%{transform:rotate(0deg) translateY(-5px) scale(.992,1.008)}50%{transform:rotate(5deg) translateY(0) scale(1.02,.98)}75%{transform:rotate(0deg) translateY(-5px) scale(.992,1.008)}100%{transform:rotate(-5deg) translateY(0) scale(1.02,.98)}}
@keyframes naiwa-dangle{0%,100%{transform:rotate(-3.5deg) translateY(-1px)}50%{transform:rotate(3.5deg) translateY(2px)}}
@keyframes naiwa-spin{0%{transform:rotate(0deg) scale(1,1)}55%{transform:rotate(200deg) scale(.94,1.04)}100%{transform:rotate(360deg) scale(1,1)}}
@keyframes naiwa-squash{0%{transform:scale(1,1)}28%{transform:scale(1.16,.82) translateY(3%)}62%{transform:scale(.94,1.07)}100%{transform:scale(1,1)}}
@keyframes naiwa-float{0%{opacity:0;transform:translate(-50%,0) scale(.5)}18%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--dx,0px)),-74px) scale(1.12)}}
@keyframes naiwa-dust{0%{opacity:.65;transform:translate(-50%,0) scale(.5)}100%{opacity:0;transform:translate(calc(-50% + var(--dx,0px)),-10px) scale(1.5)}}
`;

    const rand = (min, max) => min + Math.random() * (max - min);
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const pick = (list) => list[Math.floor(Math.random() * list.length)];

    function NaiwaPet(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key;

      const layerRef = useRef(null);
      const stageRef = useRef(null);
      const hitRef = useRef(null);
      const flipRef = useRef(null);
      const tiltRef = useRef(null);
      const bodyRef = useRef(null);
      const shadowRef = useRef(null);
      const bubbleRef = useRef(null);

      const [ready, setReady] = useState(false);
      const [frameH, setFrameH] = useState(Math.round(FRAME_W * FRAME_RATIO));
      const [bursts, setBursts] = useState([]);
      const seqRef = useRef(0);

      useEffect(() => {
        const stage = stageRef.current;
        const hit = hitRef.current;
        const flip = flipRef.current;
        const tilt = tiltRef.current;
        const body = bodyRef.current;
        const shadow = shadowRef.current;
        const bubble = bubbleRef.current;
        if (!stage || !hit || !flip || !tilt || !body || !shadow || !bubble) return undefined;

        let disposed = false;
        let raf = 0;
        let stageH = Math.round(FRAME_W * FRAME_RATIO);
        let squashTimer = 0;
        let bubbleTimer = 0;
        const timers = new Set();

        const later = (fn, ms) => {
          const id = setTimeout(() => {
            timers.delete(id);
            if (!disposed) fn();
          }, ms);
          timers.add(id);
          return id;
        };

        const viewportW = () => window.innerWidth;
        const maxX = () => Math.max(10, viewportW() - FRAME_W - 8);
        const floorY = () => window.innerHeight - stageH - FLOOR_GAP;

        const S = {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          mode: 'idle',
          dir: 1,
          targetX: 0,
          dragging: false,
          pointerId: null,
          grabDX: 0,
          grabDY: 0,
          pressAt: 0,
          moved: 0,
          lastPX: 0,
          lastPY: 0,
          lastPT: 0,
          vpx: 0,
          vpy: 0,
          closedUntil: 0,
          maxAir: 0,
        };

        let nextThink = 0;
        let nextBlink = 0;
        let lastClickAt = 0;
        let lastSaveAt = 0;

        // ---------- 初始位置 ----------
        let saved = null;
        try {
          const raw = window.localStorage.getItem(POS_KEY);
          if (raw) saved = JSON.parse(raw);
        } catch {
          saved = null;
        }
        const fallbackX = viewportW() - FRAME_W - 48;
        S.x = clamp(saved && Number.isFinite(saved.x) ? saved.x : fallbackX, 8, maxX());
        S.y = clamp(saved && Number.isFinite(saved.y) ? saved.y : floorY(), -40, floorY());

        const paint = (now) => {
          stage.style.transform = 'translate3d(' + S.x.toFixed(2) + 'px,' + S.y.toFixed(2) + 'px,0)';
          flip.style.transform = S.dir === 1 ? 'scaleX(1)' : 'scaleX(-1)';
          const tiltDeg = S.dragging ? clamp(S.vpx / 55, -13, 13) : 0;
          tilt.style.transform = tiltDeg ? 'rotate(' + tiltDeg.toFixed(2) + 'deg) scale(1.03)' : '';

          const fy = floorY() + stageH - 8;
          const air = Math.max(0, floorY() - S.y);
          const k = clamp(air / 320, 0, 1);
          shadow.style.transform =
            'translate3d(' +
            (S.x + FRAME_W / 2 - 56).toFixed(1) +
            'px,' +
            fy.toFixed(1) +
            'px,0) scale(' +
            (1 - 0.32 * k).toFixed(3) +
            ',' +
            (1 - 0.2 * k).toFixed(3) +
            ')';
          shadow.style.opacity = String(0.85 - 0.5 * k);

          let face = 'front';
          if (S.mode === 'walk') face = 'side';
          if (now < S.closedUntil && S.mode !== 'walk') face = 'closed';
          if (body.dataset.face !== face) body.dataset.face = face;
        };

        const setMode = (mode) => {
          if (S.mode === mode) return;
          S.mode = mode;
          body.dataset.mode = mode;
          stage.classList.toggle('is-dragging', mode === 'drag');
        };

        const save = (now) => {
          if (now - lastSaveAt < 400) return;
          lastSaveAt = now;
          try {
            window.localStorage.setItem(POS_KEY, JSON.stringify({ x: Math.round(S.x), y: Math.round(S.y) }));
          } catch {
            /* 隐私模式等场景下存不了就算了 */
          }
        };

        const squash = () => {
          body.classList.remove('is-squash');
          void body.offsetWidth;
          body.classList.add('is-squash');
          clearTimeout(squashTimer);
          squashTimer = window.setTimeout(() => {
            if (!disposed) body.classList.remove('is-squash');
          }, 260);
        };

        const speak = (key, ms) => {
          const text = t(key);
          if (!text || text === key) return;
          bubble.textContent = text;
          bubble.classList.add('show');
          clearTimeout(bubbleTimer);
          bubbleTimer = later(() => bubble.classList.remove('show'), ms == null ? 2400 : ms);
        };

        const burst = (kind) => {
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
          later(() => setBursts((prev) => prev.filter((item) => item.id !== id)), 1400);
        };

        const scheduleThink = (now) => {
          nextThink = now + rand(2800, 6400);
        };

        const startWalk = (now) => {
          let goal = rand(12, maxX());
          if (Math.abs(goal - S.x) < 44) goal = S.x > viewportW() / 2 ? rand(12, 80) : rand(maxX() - 80, maxX());
          S.targetX = clamp(goal, 8, maxX());
          S.dir = S.targetX > S.x ? -1 : 1;
          setMode('walk');
          if (Math.random() < 0.35) speak('walk.1', 1800);
          void now;
        };

        const startHop = () => {
          S.maxAir = 0;
          S.vx = rand(-55, 55);
          S.vy = -430;
          setMode('air');
        };

        const startSpin = () => {
          // 转圈是叠加动画，不占用状态机：站着转、跳起来也能转，落地照常压扁
          if (body.classList.contains('is-spin')) return;
          body.classList.add('is-spin');
          later(() => {
            if (!disposed) body.classList.remove('is-spin');
          }, 900);
        };

        const think = (now) => {
          if (S.mode !== 'idle') return;
          const roll = Math.random();
          if (roll < 0.34) startWalk(now);
          else if (roll < 0.55) startHop();
          else if (roll < 0.68) startSpin();
          else if (roll < 0.86) speak(pick(['idle.1', 'idle.2', 'idle.3', 'idle.4', 'idle.5', 'idle.6']), 2600);
          scheduleThink(now);
        };

        const react = (now) => {
          S.closedUntil = now + 620;
          S.maxAir = 0;
          S.vx = rand(-45, 45);
          S.vy = -440;
          setMode('air');
          burst('hearts');
          speak(pick(['click.1', 'click.2', 'click.3']), 2000);
        };

        const walkStep = (dt, now) => {
          const delta = S.targetX - S.x;
          const sign = delta > 0 ? 1 : -1;
          S.dir = sign > 0 ? -1 : 1;
          const step = WALK_SPEED * dt;
          if (Math.abs(delta) <= step) {
            S.x = S.targetX;
            setMode('idle');
            save(now);
            scheduleThink(now);
          } else {
            S.x += sign * step;
          }
        };

        const airStep = (dt, now) => {
          S.vy += GRAVITY * dt;
          S.x += S.vx * dt;
          S.y += S.vy * dt;

          const air = floorY() - S.y;
          if (air > S.maxAir) S.maxAir = air;

          const minX = 6;
          const mx = maxX();
          if (S.x < minX) {
            S.x = minX;
            S.vx = Math.abs(S.vx) * 0.42;
          } else if (S.x > mx) {
            S.x = mx;
            S.vx = -Math.abs(S.vx) * 0.42;
          }
          if (S.y < -stageH * 0.4) {
            S.y = -stageH * 0.4;
            S.vy = Math.abs(S.vy) * 0.3;
          }

          const floor = floorY();
          if (S.y >= floor) {
            S.y = floor;
            if (S.vy > 520) {
              S.vy = -S.vy * 0.34;
              S.vx *= 0.6;
              squash();
              if (S.maxAir > 90) {
                burst('dust');
                S.maxAir = 0;
              }
            } else {
              const impact = S.vy;
              const dropped = S.maxAir > 140;
              S.vy = 0;
              S.vx = 0;
              S.maxAir = 0;
              setMode('idle');
              squash();
              if (S.mode === 'idle' && dropped) {
                burst('dust');
                if (Math.random() < 0.55 || impact > 900) speak('drop.1', 1500);
              }
              save(now);
              scheduleThink(now);
            }
          }
        };

        const frame = (now) => {
          if (disposed) return;
          raf = window.requestAnimationFrame(frame);
          const dt = Math.min(0.048, Math.max(0, (now - lastFrame) / 1000));
          lastFrame = now;

          if (S.mode === 'walk') walkStep(dt, now);
          else if (S.mode === 'air') airStep(dt, now);

          if (S.mode === 'idle') {
            if (now > nextThink) think(now);
            if (now > nextBlink && now > S.closedUntil) {
              S.closedUntil = now + 130;
              nextBlink = now + rand(2800, 6800);
              if (Math.random() < 0.3) {
                later(() => {
                  if (!disposed && S.mode === 'idle') S.closedUntil = performance.now() + 120;
                }, 280);
              }
            }
          }

          paint(now);
        };
        let lastFrame = performance.now();

        // ---------- 指针交互 ----------
        const onDown = (event) => {
          if (event.button !== 0 || S.dragging) return;
          event.preventDefault();
          const now = performance.now();
          S.dragging = true;
          S.pointerId = event.pointerId;
          S.pressAt = now;
          S.moved = 0;
          S.lastPX = event.clientX;
          S.lastPY = event.clientY;
          S.lastPT = now;
          S.vpx = 0;
          S.vpy = 0;
          S.grabDX = event.clientX - S.x;
          S.grabDY = event.clientY - S.y;
          try {
            hit.setPointerCapture(event.pointerId);
          } catch {
            /* 指针捕获失败时仍可用 document 级兜底：这里不额外处理 */
          }
          setMode('drag');
          paint(now);
        };

        const onMove = (event) => {
          if (!S.dragging || event.pointerId !== S.pointerId) return;
          event.preventDefault();
          const now = performance.now();
          const dt = Math.max(12, now - S.lastPT) / 1000;
          const dx = event.clientX - S.lastPX;
          const dy = event.clientY - S.lastPY;
          S.moved += Math.hypot(dx, dy);
          S.vpx = S.vpx * 0.55 + (dx / dt) * 0.45;
          S.vpy = S.vpy * 0.55 + (dy / dt) * 0.45;
          S.lastPX = event.clientX;
          S.lastPY = event.clientY;
          S.lastPT = now;
          S.x = clamp(event.clientX - S.grabDX, -34, viewportW() - FRAME_W + 34);
          S.y = clamp(event.clientY - S.grabDY, -34, floorY());
          paint(now);
        };

        const endDrag = (event, cancelled) => {
          if (!S.dragging) return;
          if (event && event.pointerId !== S.pointerId) return;
          const now = performance.now();
          S.dragging = false;
          S.pointerId = null;
          try {
            if (event) hit.releasePointerCapture(event.pointerId);
          } catch {
            /* 已释放 */
          }
          stage.classList.remove('is-dragging');

          const held = now - S.pressAt;
          if (!cancelled && S.moved < 8 && held < 460) {
            const isDouble = now - lastClickAt < 330;
            lastClickAt = now;
            if (isDouble) {
              S.closedUntil = now + 520;
              startSpin();
              // 双击时鼠标已经把它从原来的状态里"抓"出来了：要么站回去，要么继续下落
              setMode(S.y < floorY() - 2 ? 'air' : 'idle');
              paint(now);
            } else {
              react(now);
            }
            return;
          }
          if (cancelled) {
            S.vx = 0;
            S.vy = 0;
          } else {
            S.vx = clamp(S.vpx * 0.18, -1100, 1100);
            S.vy = clamp(S.vpy * 0.18, -1100, 700);
          }
          S.maxAir = Math.max(0, floorY() - S.y);
          setMode('air');
          if (!cancelled && S.moved > 70 && Math.random() < 0.4) speak('drag.1', 1200);
          paint(now);
        };

        const onUp = (event) => endDrag(event, false);
        const onCancel = (event) => endDrag(event, true);

        const onAnimEnd = (event) => {
          if (event.target !== body) return;
          if (event.animationName === 'naiwa-spin') {
            body.classList.remove('is-spin');
            if (S.mode === 'idle') scheduleThink(performance.now());
          }
        };

        const onResize = () => {
          if (S.mode === 'idle') S.y = floorY();
          else S.y = Math.min(S.y, floorY());
          S.x = clamp(S.x, 8, maxX());
          paint(performance.now());
        };

        hit.addEventListener('pointerdown', onDown);
        hit.addEventListener('pointermove', onMove);
        hit.addEventListener('pointerup', onUp);
        hit.addEventListener('pointercancel', onCancel);
        body.addEventListener('animationend', onAnimEnd);
        window.addEventListener('resize', onResize);

        // ---------- 素材尺寸与预加载 ----------
        const probe = new Image();
        probe.onload = () => {
          if (disposed) return;
          if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
            stageH = Math.round((FRAME_W * probe.naturalHeight) / probe.naturalWidth);
            stage.style.height = stageH + 'px';
            setFrameH(stageH);
            S.y = clamp(S.y, -40, floorY());
          }
          paint(performance.now());
          setReady(true);
          later(() => speak('greet', 2600), 500);
        };
        probe.onerror = () => {
          if (!disposed) setReady(true);
        };
        probe.src = ASSET_BASE + 'naiwa-front.png';
        ['naiwa-side.png', 'naiwa-front-closed.png'].forEach((file) => {
          const image = new Image();
          image.src = ASSET_BASE + file;
        });

        scheduleThink(performance.now() + 1200);
        nextBlink = performance.now() + rand(1400, 3200);
        paint(performance.now());
        raf = window.requestAnimationFrame(frame);
        if (probe.complete && probe.naturalWidth > 0) probe.onload();

        return () => {
          disposed = true;
          window.cancelAnimationFrame(raf);
          for (const id of timers) clearTimeout(id);
          timers.clear();
          clearTimeout(squashTimer);
          clearTimeout(bubbleTimer);
          hit.removeEventListener('pointerdown', onDown);
          hit.removeEventListener('pointermove', onMove);
          hit.removeEventListener('pointerup', onUp);
          hit.removeEventListener('pointercancel', onCancel);
          body.removeEventListener('animationend', onAnimEnd);
          window.removeEventListener('resize', onResize);
        };
      }, []);

      return h(
        'div',
        { ref: layerRef, className: 'naiwa-layer', 'aria-hidden': 'true' },
        h('style', null, CSS),
        h('div', { ref: shadowRef, className: 'naiwa-shadow' }),
        h(
          'div',
          {
            ref: stageRef,
            className: 'naiwa-stage',
            style: {
              width: FRAME_W + 'px',
              height: frameH + 'px',
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
                h('img', {
                  className: 'naiwa-img naiwa-front',
                  src: ASSET_BASE + 'naiwa-front.png',
                  alt: '',
                  draggable: false,
                }),
                h('img', {
                  className: 'naiwa-img naiwa-side',
                  src: ASSET_BASE + 'naiwa-side.png',
                  alt: '',
                  draggable: false,
                }),
                h('img', {
                  className: 'naiwa-img naiwa-closed',
                  src: ASSET_BASE + 'naiwa-front-closed.png',
                  alt: '',
                  draggable: false,
                }),
              ),
            ),
          ),
          h('div', { ref: bubbleRef, className: 'naiwa-bubble' }),
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
          h('div', { ref: hitRef, className: 'naiwa-hit', role: 'presentation' }),
        ),
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
      },
    };
  },
});
