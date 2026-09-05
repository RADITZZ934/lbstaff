module.exports = {
  apps: [
    {
      name: 'lbstaff-backend',
      cwd: './backend',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 10002
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'lbstaff-frontend',
      cwd: './web-dashboard',
      script: '.output/server/index.mjs',
      env: {
        NODE_ENV: 'production',
        PORT: 10003,
        NITRO_PORT: 10003,
        NITRO_HOST: '0.0.0.0',
        HOST: '0.0.0.0'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
