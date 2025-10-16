// utils/randomCredentials.js
// Универсальная утилита: работает в Node и в браузере (fallback на Math.random в браузере).

/**
 * Возвращает крипто-стойкий рандом int в диапазоне [0, max)
 * В Node использует crypto.randomInt, в браузере — Math.random.
 */
function randInt(max) {
  if (typeof max !== 'number' || max <= 0) throw new Error('max must be positive number');
  // Node.js crypto.randomInt if available
  try {
    // eslint-disable-next-line no-undef
    if (typeof require === 'function') {
      const crypto = require('crypto');
      if (crypto && typeof crypto.randomInt === 'function') {
        return crypto.randomInt(max);
      }
    }
  } catch (e) {
    // ignore, fallback to Math.random
  }
  // Browser fallback
  return Math.floor(Math.random() * max);
}

/**
 * Случайный выбор символа из строки
 */
function pick(str) {
  return str.charAt(randInt(str.length));
}

/**
 * Генерирует произвольную строку по набору символов и длине
 */
function randomString(length, charset) {
  if (!Number.isInteger(length) || length <= 0) throw new Error('length must be positive integer');
  let out = '';
  for (let i = 0; i < length; i++) out += pick(charset);
  return out;
}

/**
 * Генерирует пароль
 * @param {object} opts
 * @param {number} [opts.length=16] - длина пароля
 * @param {boolean} [opts.mustIncludeAll=true] - пытаться включить по 1 символу из каждой категории
 * @returns {string}
 */
export function generatePassword(opts = {}) {
  const length = Number.isInteger(opts.length) ? opts.length : 16;
  const mustIncludeAll = opts.mustIncludeAll !== false;

  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  // безопасный набор спецсимволов; можно расширить при необходимости
  const special = '!@#$%^&*()-_+=[]{}|:;,.<>?';

  const all = lower + upper + digits + special;

  if (length < 4 && mustIncludeAll) {
    // невозможно включить все 4 типа символов
    throw new Error('length must be >= 4 when mustIncludeAll=true');
  }

  let pwd = '';

  if (mustIncludeAll) {
    // гарантируем хотя бы один символ каждой категории
    pwd += pick(lower);
    pwd += pick(upper);
    pwd += pick(digits);
    pwd += pick(special);
    // добавляем оставшиеся случайные символы
    if (length > 4) pwd += randomString(length - 4, all);
    // перемешаем результирующую строку
    pwd = shuffleString(pwd);
  } else {
    pwd = randomString(length, all);
  }

  return pwd;
}

/**
 * Простая реализация Fisher–Yates shuffle для строки
 */
function shuffleString(s) {
  const arr = s.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr.join('');
}

/**
 * Генерирует случайный локальный-парт почты (до @) и возвращает адрес.
 * @param {object} opts
 * @param {string} [opts.domain] - домен. по умолчанию 'example.com'
 * @param {number} [opts.usernameLength=10]
 * @returns {string}
 */
export function generateEmail(opts = {}) {
  const domain = opts.domain || 'example.com';
  const usernameLength = Number.isInteger(opts.usernameLength) ? opts.usernameLength : 10;

  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const dotUnderscore = '._';
  // допустимые символы для локальной части (упрощённо)
  const firstChars = letters;
  const otherChars = letters + digits + dotUnderscore;

  const first = pick(firstChars);
  let rest = '';
  for (let i = 1; i < usernameLength; i++) {
    rest += pick(otherChars);
  }

  const local = (first + rest).toLowerCase();

  // добавляем случайный хвост, чтобы было ещё менее похоже на коллизию
  const tail = Math.abs(Date.now()).toString(36).slice(-4);

  return `${local}.${tail}@${domain}`;
}

/**
 * Утилита, возвращающая и email и пароль в виде объекта
 * @param {object} opts
 * @returns {{email: string, password: string}}
 */
export function generateCredentials(opts = {}) {
  const email = generateEmail({ domain: opts.domain, usernameLength: opts.usernameLength });
  const password = generatePassword({ length: opts.passwordLength ?? 16 });
  return { email, password };
}

/**
 * Генерирует человекопонятное рандомное имя.
 * Пример: 'wallet_silent-fox-83f'
 * @param {string} [prefix='wallet'] - префикс имени (например, wallet, user, test)
 * @param {object} [opts]
 * @param {number} [opts.maxRandom=9999] - диапазон случайного числа (для уникальности)
 * @returns {string}
 */
export function generateRandomName(prefix = 'wallet', opts = {}) {
    const adjectives = [
        'silent', 'brave', 'clever', 'swift', 'calm', 'fuzzy', 'shiny', 'wild', 'gentle', 'rapid',
    ];
    const animals = [
        'fox', 'tiger', 'eagle', 'otter', 'panda', 'lynx', 'dolphin', 'wolf', 'owl', 'bear',
    ];
    const adj = adjectives[randInt(adjectives.length)];
    const animal = animals[randInt(animals.length)];
    const num = randInt(opts.maxRandom ?? 9999).toString(16); // hex для компактности
    return `${prefix}_${adj}-${animal}-${num}`;
}

// CommonJS fallback (если в проекте require)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generatePassword,
    generateEmail,
    generateCredentials,
    generateRandomName
  };



}
