/**
 * PM2 Process Manager Configuration
 * Keeps the broadcast server running 24/7, auto-restarts on crash,
 * and restarts on server reboot.
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'loveworld-broadcast',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        // Set SERVER_HOST to your VPS public IP or domain
        // e.g. SERVER_HOST: 'broadcast.loveworld.tv'
        SERVER_HOST: process.env.SERVER_HOST || 'localhost',
        RTMP_PORT: process.env.RTMP_PORT || '1935',
        HTTP_PORT: process.env.HTTP_PORT || '8000',
        API_PORT:  process.env.API_PORT  || '3001',
      },
      error_file: './logs/error.log',
      out_file:   './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
