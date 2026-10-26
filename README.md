# MANS CARS 015 — аренда автомобилей с онлайн-бронированием

**Сайт:** https://imran-php.github.io/mans-cars/ (витрина)  
**Полная версия с бронированием:** https://mans-cars-015-portfolio.netlify.app

Сайт проката авто с календарём занятости и панелью владельца для управления бронями.

## Возможности
- лендинг с автопарком и формой бронирования
- проверка свободных дат по каждому автомобилю (`availability.js`)
- панель владельца (`admin.html`): ведение броней, включение календаря
- вход владельца через Netlify Identity (только по приглашению, роль `booking-admin`)

## Стек
HTML, CSS, JavaScript · Netlify Functions (TypeScript) · Netlify Blobs для хранения броней · Netlify Identity · сборка через esbuild · тесты на `node --test`

## Запуск
```bash
npm install
npm run build
npm test
```
Деплой: подключить репозиторий в Netlify. Настройка бронирования описана в `BOOKING-SETUP.md`.
