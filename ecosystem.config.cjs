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
        PORT: 10002
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
