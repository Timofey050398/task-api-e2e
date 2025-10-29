# task-api-e2e

Подробное руководство по подготовке окружения для end-to-end тестов криптовалютного бота. Инструкция охватывает настройку всех переменных окружения, получение Telegram API ID/Hash и TG_SESSION, генерацию и активацию TON-кошелька, а также правила работы с почтой mailtm.

## Требования

- Node.js 18+
- npm 8+
- Активные аккаунты Telegram (основной и дополнительный)
- Почтовый ящик, поддерживающий переадресацию
- Установленный `git`

```bash
npm install
```

## Структура переменных окружения

Создайте файл `.env` в корне проекта и заполните его по образцу ниже:

| Переменная | Назначение |
|------------|------------|
| `ENVIRONMENT` | Тип окружения (`PROD`, `STAGE`, `DEV`). |
| `TG_BOT_NAME` | Имя Telegram-бота, с которым работают тесты. |
| `TEST_USER_LOGIN` / `TEST_USER_LOGIN_OTHER` | Логины тестовых пользователей. |
| `TEST_USER_PASS` | Пароль тестовых пользователей. |
| `TEST_PIN` | PIN-код для подтверждения операций в боте. |
| `MAILTM_EMAIL` / `MAILTM_EMAIL_OTHER` | Адреса mailtm, на которые будут пересылаться письма. |
| `TG_API_ID` / `TG_API_ID_OTHER` | Telegram API ID для основного и дополнительного аккаунтов. |
| `TG_API_HASH` / `TG_API_HASH_OTHER` | Telegram API Hash для основного и дополнительного аккаунтов. |
| `TG_PHONE_NUMBER` / `TG_PHONE_NUMBER_OTHER` | Телефонные номера аккаунтов Telegram. |
| `TG_SESSION` / `TG_SESSION_OTHER` | Сессионные ключи Telegram, генерируются скриптом. |
| `BTC_ADDRESS`, `BTC_PRIVATE_KEY`, `BTC_NETWORK` | Данные Bitcoin-кошелька (поддерживается `mainnet`). |
| `ETH_NETWORK`, `ETH_INFURA_PROJECT_ID`, `ETH_PRIVATE_KEY`, `ETH_ADDRESS` | Параметры для работы с Ethereum. |
| `TRON_NETWORK`, `TRON_PRIVATE_KEY`, `TRON_ADDRESS` | Параметры для Tron. |
| `TON_NETWORK`, `TON_API_KEY`, `TON_WALLET_PUBLIC_KEY_32_HEX`, `TON_WALLET_PUBLIC_KEY`, `TON_WALLET_PRIVATE_KEY`, `TON_PRIVATE_KEY_SEED` | Параметры TON-кошелька. |
| `USDT_ERC20_CONTRACT`, `USDC_ERC20_CONTRACT`, `USDT_TRC20_CONTRACT` | Контракты стейблкоинов. |

> **Совет.** Разделите переменные на секции «Основной пользователь», «Второй пользователь» и «TON / сети», чтобы проще поддерживать файл.

## Настройка почты mailtm

1. Зарегистрируйте любой почтовый ящик или возьмите любой текущий (например, Gmail, Outlook и т.д.).
2. Настройте в нём автоматическое правило переадресации всех писем с платформы app.aifory на адрес сервиса mailtm (`MAILTM_EMAIL`).
3. Убедитесь, что почта пересылается немедленно и без фильтров (никакой модерации по папкам «Спам»).
4. Второй почтовый адрес настраивается аналогично на `MAILTM_EMAIL_OTHER`.

Таким образом тесты всегда читают входящую корреспонденцию через mailtm, не требуя прямого доступа к основному почтовому ящику.

## Получение Telegram API ID и Hash

1. Перейдите на [my.telegram.org](https://my.telegram.org) и войдите под нужным номером телефона.
2. Откройте раздел **API development tools**.
3. Нажмите **Create new application** (или **Edit**, если приложение уже создано).
4. Заполните поля:
   - **App title** — любое понятное название, например `Task API Tests`.
   - **Short name** — латинское короткое имя без пробелов.
   - **Platform** — `Desktop`.
   - **Description** — по желанию, можно указать «E2E tests for task-api bot».
5. После сохранения скопируйте выданные значения `App api_id` и `App api_hash` в `.env` (`TG_API_ID`, `TG_API_HASH`). Для второго аккаунта повторите процедуру после выхода и входа с другого номера.

> Telegram позволяет создавать только одно приложение на аккаунт. Если оно уже есть, просто используйте существующие значения `api_id` и `api_hash`.

## Генерация TG_SESSION скриптом `TelegramSessionGenerator.cjs`

Скрипт `scripts/telegram/TelegramSessionGenerator.cjs` автоматизирует получение сессионного ключа:

```bash
node scripts/telegram/TelegramSessionGenerator.cjs
```

1. Скрипт читает `TG_API_ID`, `TG_API_HASH` и `TG_PHONE_NUMBER` из `.env` (значения можно переопределить, передав в конструктор `USER_TWO`).
2. После подключения к серверам Telegram вы получите запрос на код подтверждения — введите его в консоль.
3. При успешной авторизации в терминале появится значение `TG_SESSION`; скопируйте его в `.env`.

> Сессия привязана к комбинации номер телефона + IP. При смене IP или номера повторно запустите скрипт.

## Подготовка TON-кошелька

### 1. Генерация ключей

```bash
node scripts/ton/gen-ton-key.js
```

Скрипт выдаст:

- `privateKeySeed` → сохраняем в `TON_PRIVATE_KEY_SEED`;
- `publicKey` (32 hex) → `TON_WALLET_PUBLIC_KEY_32_HEX`;
- `secretKey` (64 hex) → `TON_WALLET_PRIVATE_KEY`.

Дополнительно сохраните friendly-адрес и 64-символьный публичный ключ в резервном месте.

### 2. Получение friendly-адреса

```bash
node scripts/ton/pubkey-to-ton-address.js
```

Скрипт использует `TON_WALLET_PUBLIC_KEY_32_HEX` и выводит friendly-адрес (`EQ…`) и сырой hex-адрес. Сохраните friendly-форму в `TON_WALLET_PUBLIC_KEY`.

### 3. Активация кошелька

```bash
node scripts/ton/deployTonWallet.mjs
```

- `TON_NETWORK` — `mainnet` или `testnet`.
- `TON_API_KEY` — ключ для [toncenter.com](https://toncenter.com). Для тестнета используйте `https://testnet.toncenter.com`.
- Перед запуском переведите на адрес 0.05 TON (или больше) для оплаты деплоя.
- Скрипт проверит баланс и при необходимости отправит транзакцию активации. После выполнения убедитесь в статусе на `tonscan.org`.

## Прочие переменные сетей

- **Ethereum**: заполните `ETH_NETWORK`, `ETH_INFURA_PROJECT_ID`, `ETH_PRIVATE_KEY`, `ETH_ADDRESS` — тесты используют `ethers` для взаимодействия с сетью.
- **Bitcoin**: укажите `BTC_ADDRESS`, `BTC_PRIVATE_KEY`, `BTC_NETWORK`.
- **Tron**: заполните `TRON_NETWORK`, `TRON_PRIVATE_KEY`, `TRON_ADDRESS`.
- **Стейблкоины**: значения контрактов заданы для mainnet и при необходимости могут быть переопределены.

## Запуск тестов

После настройки `.env` выполните требуемые команды Playwright или другие скрипты проекта. В качестве примера:

```bash
npx playwright test
```

По завершении убедитесь, что отчёты Allure и логи сгенерированы корректно.

## Полезные советы

- Храните `.env` вне репозитория или используйте менеджер секретов.
- При смене номера телефона заново сгенерируйте `TG_SESSION`.
- Регулярно обновляйте ключи TON и резервные копии seed-фразы.
- Для отладки сетевых взаимодействий используйте прокси и verbose-режимы Playwright.

