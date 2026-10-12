/**
 * Dark Mode & Theme Controller for MaintenanceOps.
 *
 * Capabilities:
 * 1. Synchronizes with localStorage ('mo-theme' key).
 * 2. Detects OS system preference (prefers-color-scheme: dark).
 * 3. Applies or removes 'dark' class on <html> document element.
 * 4. Injects accessible Theme Toggle button (Moon / Sun) into header.
 * 5. Prevents Flash of Unstyled Content (FOUC).
 */
'use strict';

const THEME_KEY = 'mo-theme';

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch (e) {
    /* localStorage unavailable */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  updateThemeButton(theme);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const next = isDark ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (e) {
    /* storage unavailable */
  }
  applyTheme(next);
}

function updateThemeButton(theme) {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  const isDark = theme === 'dark';
  btn.setAttribute('aria-label', isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối');
  btn.setAttribute('title', isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối');
  btn.innerHTML = isDark
    ? `<svg class="h-5 w-5 text-amber-400 transition-transform duration-200 hover:rotate-45" fill="currentColor" viewBox="0 0 20 20">
         <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
       </svg>`
    : `<svg class="h-5 w-5 text-slate-600 transition-transform duration-200 hover:-rotate-12" fill="currentColor" viewBox="0 0 20 20">
         <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
       </svg>`;
}

function mountThemeButton() {
  const container = document.getElementById('theme-toggle-slot');
  if (container && !document.getElementById('theme-toggle-btn')) {
    const btn = document.createElement('button');
    btn.id = 'theme-toggle-btn';
    btn.type = 'button';
    btn.className = 'flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
    btn.onclick = toggleTheme;
    container.appendChild(btn);
    updateThemeButton(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }
}

// Self-invoking initializer executed immediately to prevent flash
(function init() {
  const initialTheme = getInitialTheme();
  applyTheme(initialTheme);

  // Listen to OS system changes if user hasn't explicitly set a preference
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (err) {}
    if (!saved) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountThemeButton);
  } else {
    mountThemeButton();
  }
})();

if (typeof window !== 'undefined') {
  window.toggleTheme = toggleTheme;
  window.applyTheme = applyTheme;
  window.mountThemeButton = mountThemeButton;
}
