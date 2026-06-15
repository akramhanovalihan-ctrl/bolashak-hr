# Bolashak HR

Внутренняя HR-платформа ТОО «Болашак»: веб + Telegram-бот + SQL Server.

## Стек

- **Frontend:** React 19, Vite, TypeScript
- **Backend:** Node.js, Express
- **Bot:** Telegraf
- **DB:** SQL Server Express (`bolashak_hr`, schema `hr.*`)
- **Process manager:** PM2

## Быстрый старт (сервер)

```powershell
cd "C:\path\to\bolashak-hr"
copy server\.env.example server\.env
# заполните server\.env (пароли, JWT, TELEGRAM_BOT_TOKEN)

npm install --prefix server
npm install --prefix bot
npm run build --prefix client

pm2 start ecosystem.config.cjs --env production
pm2 save
```

## Доступ

| Среда | URL |
|-------|-----|
| На сервере | http://localhost:3002 |
| LAN | http://192.168.100.217:3002 |
| Tailscale | http://100.121.80.67:3002 |
| Telegram | @BolashakHR_bot |

## Скрипты

| Скрипт | Назначение |
|--------|------------|
| `scripts/pilot-check.ps1` | Smoke-тест API по ролям |
| `scripts/backup-sqlserver.ps1` | Ручной бэкап БД |
| `scripts/register-backup-task.ps1` | Ежедневный бэкап 02:00 (admin) |
| `scripts/setup-pm2-autostart.ps1` | Автозапуск PM2 после reboot (admin) |
| `scripts/role-check.ps1` | Проверка прав по эндпоинтам |

## Секреты

- **Не коммитить** `server/.env` — только `server/.env.example`
- `ecosystem.config.cjs` читает переменные из `server/.env`

## Бот — cron

- **1-го числа 10:00** — автоматическая рассылка пульс-опроса
- **Ежедневно 09:00** — напоминание HR об окончании испытательного срока

Ручной запуск опроса: `/opros` (HR).

## Демо-логины

| Роль | Email | Пароль |
|------|-------|--------|
| Admin | aizada@bolashak.local | admin123 |
| HR | talshyn@bolashak.local | hr123 |

Смените пароли перед production-использованием.
