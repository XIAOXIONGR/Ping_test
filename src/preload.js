const { contextBridge, ipcRenderer } = require('electron');

// 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('api', {
    getServerPort: () => ipcRenderer.invoke('get-port'),
    onWindowFocus: (callback) => ipcRenderer.on('window-focused', callback),
    onWindowBlur: (callback) => ipcRenderer.on('window-blurred', callback),
    focusWindow: () => ipcRenderer.send('focus-window'),
    toggleDevTools: () => ipcRenderer.send('toggle-dev-tools'),
    setInputFocus: (inputId) => ipcRenderer.send('set-input-focus', inputId),
    onInputFocus: (callback) => ipcRenderer.on('input-focused', callback),
    onInputBlur: (callback) => ipcRenderer.on('input-blurred', callback),
    requestInputFocus: () => ipcRenderer.send('request-input-focus')
});