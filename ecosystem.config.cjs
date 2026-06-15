module.exports = {
  apps: [
    {
      name: 'bolashak-hr',
      cwd: './server',
      script: 'src/bootstrap.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
        HOST: '0.0.0.0',
        BOT_DISABLED: '1',
        COOKIE_SECURE: 'false',
      },
    },
    {
      name: 'bolashak-hr-bot',
      cwd: './bot',
      script: 'src/start.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env_production: {
        NODE_ENV: 'production',
        DB_DRIVER: 'sqlite',
        COOKIE_SECURE: 'false',
      },
    },
  ],
};
