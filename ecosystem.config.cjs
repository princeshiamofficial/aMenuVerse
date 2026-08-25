// PM2 Ecosystem Config for aMenuVerse
// Usage: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "amenuverse",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
