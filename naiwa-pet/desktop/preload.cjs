'use strict';

/**
 * 桌面形态 preload：只暴露窗口控制原语，不暴露 Node / fs / ipcRenderer 本体。
 * 渲染页只拿到这些方法，所有实际动作都由主进程校验后执行。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petBridge', {
  getState: () => ipcRenderer.invoke('pet:get-state'),
  moveBy: (dx, dy) => ipcRenderer.send('pet:move-by', { dx, dy }),
  throwWindow: (vx, vy) => ipcRenderer.send('pet:throw', { vx, vy }),
  showMenu: () => ipcRenderer.send('pet:show-menu'),
  writeConfig: (patch) => ipcRenderer.invoke('pet:write-config', patch),
  onState: (callback) => ipcRenderer.on('pet:state', (_event, state) => callback(state)),
  onMotion: (callback) => ipcRenderer.on('pet:motion', (_event, motion) => callback(motion)),
  onAction: (callback) => ipcRenderer.on('pet:action', (_event, id) => callback(id)),
  onExpression: (callback) => ipcRenderer.on('pet:expression', (_event, id) => callback(id)),
  onSpeak: (callback) => ipcRenderer.on('pet:speak', (_event, key) => callback(key)),
});
