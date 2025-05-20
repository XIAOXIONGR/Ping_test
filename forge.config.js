module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'ip-status-monitor',
    extraResource: ['src/server.js', 'ip_status.db'],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ip-status-monitor',
        setupExe: 'IPStatusMonitorSetup.exe',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
  ],
};