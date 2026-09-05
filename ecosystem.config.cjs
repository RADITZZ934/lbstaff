module.exports = {
  apps: [
    {
      name: 'lbstaff-backend',
      cwd: './backend',
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 10002,
        UPLOADS_DIR: process.env.UPLOADS_DIR || (process.platform === 'win32' ? 'D:/lbstaff_uploads' : '/home/radit/lbstaff_uploads')
      }
    },
    {
      name: 'lbstaff-frontend',
      cwd: './web-dashboard',
      script: '.output/server/index.mjs',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 10003,
        NITRO_PORT: 10003,
        NITRO_HOST: '0.0.0.0',
        HOST: '0.0.0.0',
        BACKEND_URL: 'http://127.0.0.1:10002'
      }
    }
  ]
};
