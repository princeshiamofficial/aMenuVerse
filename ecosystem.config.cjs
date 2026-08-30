// PM2 Ecosystem Config for aMenuVerse (Cluster Load Balancer)
// Usage:
//   Start:   pm2 start ecosystem.config.cjs
//   Reload:  pm2 reload ecosystem.config.cjs --update-env (Zero Downtime)
//   Status:  pm2 status
//   Logs:    pm2 logs amenuverse

module.exports = {
  apps: [
    {
      name: "amenuverse",
      script: "app.js",
      // Automatically distribute requests across all CPU cores (Load Balancing)
      instances: process.env.PM2_INSTANCES || "max",
      exec_mode: "cluster",
      watch: false,
      autorestart: true,
      max_memory_restart: "1G",

      // Zero-Downtime Rolling Reload Configuration
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 5000,

      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
