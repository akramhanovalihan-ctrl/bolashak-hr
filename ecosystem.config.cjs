const path = require('path');
const { loadProjectEnv } = require('./scripts/load-env.cjs');

const env = loadProjectEnv(path.join(__dirname));
const nodeInterpreter = 'C:\\Program Files\\nodejs\\node.exe';

const dbEnv = {
  DB_DRIVER: env.DB_DRIVER || 'mssql',
  SQLSERVER_HOST: env.SQLSERVER_HOST || 'localhost\\SQLEXPRESS',
  SQLSERVER_DATABASE: env.SQLSERVER_DATABASE || 'bolashak_hr',
  SQLSERVER_USER: env.SQLSERVER_USER || 'sa',
  SQLSERVER_PASSWORD: env.SQLSERVER_PASSWORD || '',
  SQLSERVER_ENCRYPT: env.SQLSERVER_ENCRYPT || 'false',
  SQLSERVER_TRUST_CERT: env.SQLSERVER_TRUST_CERT || 'true',
};

module.exports = {
  apps: [
    {
      name: 'bolashak-hr',
      cwd: './server',
      script: 'src/bootstrap.js',
      interpreter: nodeInterpreter,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
        PORT: env.PORT || 3002,
        HOST: env.HOST || '0.0.0.0',
        BOT_DISABLED: env.BOT_DISABLED || '1',
        COOKIE_SECURE: env.COOKIE_SECURE || 'false',
        JWT_SECRET: env.JWT_SECRET,
        JWT_EXPIRES_IN: env.JWT_EXPIRES_IN || '30d',
        CLIENT_URL: env.CLIENT_URL,
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        HTTPS_PORT: env.HTTPS_PORT,
        SSL_PFX_PATH: env.SSL_PFX_PATH,
        SSL_PFX_PASSWORD: env.SSL_PFX_PASSWORD,
        ...dbEnv,
      },
    },
    {
      name: 'bolashak-hr-bot',
      cwd: './bot',
      script: 'src/start.js',
      interpreter: nodeInterpreter,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env_production: {
        NODE_ENV: 'production',
        TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        ...dbEnv,
      },
    },
  ],
};
