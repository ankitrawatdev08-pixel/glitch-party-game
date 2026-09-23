// public/js/utils.js

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

// Session storage keys
const STORAGE_PLAYER_ID = 'glitch_player_id';
const STORAGE_ROOM_CODE = 'glitch_room_code';
const STORAGE_PLAYER_NAME = 'glitch_player_name';

export function getStoredPlayerId() {
  return sessionStorage.getItem(STORAGE_PLAYER_ID);
}

export function setStoredPlayerId(id) {
  if (id) {
    sessionStorage.setItem(STORAGE_PLAYER_ID, id);
  } else {
    sessionStorage.removeItem(STORAGE_PLAYER_ID);
  }
}

export function getStoredRoomCode() {
  return sessionStorage.getItem(STORAGE_ROOM_CODE);
}

export function setStoredRoomCode(code) {
  if (code) {
    sessionStorage.setItem(STORAGE_ROOM_CODE, code);
  } else {
    sessionStorage.removeItem(STORAGE_ROOM_CODE);
  }
}

export function getStoredPlayerName() {
  return sessionStorage.getItem(STORAGE_PLAYER_NAME) || '';
}

export function setStoredPlayerName(name) {
  if (name) {
    sessionStorage.setItem(STORAGE_PLAYER_NAME, name);
  } else {
    sessionStorage.removeItem(STORAGE_PLAYER_NAME);
  }
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_PLAYER_ID);
  sessionStorage.removeItem(STORAGE_ROOM_CODE);
}

// Copy to clipboard with UI feedback
export async function copyToClipboard(text, tooltipEl) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    if (tooltipEl) {
      tooltipEl.classList.add('visible');
      setTimeout(() => {
        tooltipEl.classList.remove('visible');
      }, 1800);
    }
    return true;
  } catch (err) {
    console.warn('Clipboard write failed:', err);
    return false;
  }
}

// Toast notification helper with queue (max 2 visible, 1.5s auto-dismiss, non-blocking)
const MAX_VISIBLE_TOASTS = 2;
const DEFAULT_TOAST_DURATION = 1500;
const toastQueue = [];
let activeToastCount = 0;

function getToastContainer() {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function processNextToast() {
  if (activeToastCount >= MAX_VISIBLE_TOASTS || toastQueue.length === 0) {
    return;
  }

  const { message, type, duration } = toastQueue.shift();
  displayToast(message, type, duration);
}

function displayToast(message, type, duration) {
  activeToastCount++;
  const container = getToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  // Trigger appear transition
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      activeToastCount--;
      processNextToast();
    }, 200);
  }, duration);
}

export function showToast(message, type = 'info', duration = DEFAULT_TOAST_DURATION) {
  if (activeToastCount < MAX_VISIBLE_TOASTS) {
    displayToast(message, type, duration);
  } else {
    toastQueue.push({ message, type, duration });
  }
}

