'use strict';

/**
 * 桌面窗口物理（纯函数，可单测）。
 *
 * 单位：像素 / 秒。每次 step 接收当前窗口位置与速度，返回下一帧位置、速度、
 * 是否发生碰撞（用于压扁动画）以及是否已经稳定停在地面。
 */

const DEFAULT_PHYSICS = Object.freeze({
  gravity: 2400,
  wallRestitution: 0.55,
  floorRestitution: 0.35,
  ceilingRestitution: 0.45,
  frictionPerFrame: 0.985,
  minBounceSpeed: 60,
  settleSpeed: 8,
});

function createBody(position) {
  return {
    x: Number(position && position.x) || 0,
    y: Number(position && position.y) || 0,
    vx: Number(position && position.vx) || 0,
    vy: Number(position && position.vy) || 0,
  };
}

/**
 * @param {{x:number,y:number,vx:number,vy:number}} body
 * @param {number} dt 秒
 * @param {{x:number,y:number,width:number,height:number}} area 可用工作区
 * @param {{width:number,height:number}} size 窗口尺寸
 * @param {object} [options]
 */
function step(body, dt, area, size, options) {
  const physics = { ...DEFAULT_PHYSICS, ...(options || {}) };
  const clampedDt = Math.min(0.05, Math.max(0, Number(dt) || 0));
  const next = { ...body };

  next.vy += physics.gravity * clampedDt;
  next.x += next.vx * clampedDt;
  next.y += next.vy * clampedDt;

  const minX = area.x;
  const maxX = area.x + area.width - size.width;
  const minY = area.y;
  const maxY = area.y + area.height - size.height;
  let impact = false;

  if (next.x < minX) {
    next.x = minX;
    next.vx = Math.abs(next.vx) * physics.wallRestitution;
    impact = true;
  } else if (next.x > maxX) {
    next.x = maxX;
    next.vx = -Math.abs(next.vx) * physics.wallRestitution;
    impact = true;
  }

  if (next.y < minY) {
    next.y = minY;
    next.vy = Math.abs(next.vy) * physics.ceilingRestitution;
    impact = true;
  } else if (next.y > maxY) {
    next.y = maxY;
    if (Math.abs(next.vy) > physics.minBounceSpeed) {
      next.vy = -Math.abs(next.vy) * physics.floorRestitution;
      impact = true;
    } else {
      next.vy = 0;
    }
  }

  const onFloor = next.y >= maxY - 0.5;
  if (onFloor) {
    next.vx *= Math.pow(physics.frictionPerFrame, clampedDt * 60);
    if (Math.abs(next.vx) < 0.5) next.vx = 0;
  }

  const settled = onFloor && Math.abs(next.vx) < physics.settleSpeed && Math.abs(next.vy) < 1;
  if (settled) {
    next.vx = 0;
    next.vy = 0;
    next.y = maxY;
  }

  return { body: next, impact, settled, onFloor };
}

module.exports = { DEFAULT_PHYSICS, createBody, step };
