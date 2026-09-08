/* ══════════════════════════════════════════════════════
   pwa.js — PWA Service Worker Registration & Install Prompt
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // 1. Check if running in standalone (installed app) mode
  const isStandalone = () => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  };

  // 2. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed:', error);
        });
    });
  }

  // 3. Android / Desktop Install Prompt Handling
  let deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent standard mini-infobar from appearing on mobile
    e.preventDefault();
    deferredInstallPrompt = e;

    // Show custom install button/banner if present on page
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner && !isStandalone()) {
      installBanner.classList.remove('pwa-hidden');
    }
  });

  // Handle install button clicks
  document.addEventListener('click', (e) => {
    const installBtn = e.target.closest('#pwa-install-btn');
    if (installBtn && deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted the install prompt');
        } else {
          console.log('[PWA] User dismissed the install prompt');
        }
        deferredInstallPrompt = null;
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.classList.add('pwa-hidden');
      });
    }

    // Dismiss banner button
    const dismissBtn = e.target.closest('#pwa-dismiss-btn');
    if (dismissBtn) {
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.classList.add('pwa-hidden');
      sessionStorage.setItem('pwa-banner-dismissed', 'true');
    }

    // iOS Guide modal toggle
    const iosHelpBtn = e.target.closest('#pwa-ios-help-btn');
    if (iosHelpBtn) {
      const modal = document.getElementById('pwa-ios-modal');
      if (modal) modal.classList.toggle('pwa-hidden');
    }

    const iosModalClose = e.target.closest('#pwa-ios-close');
    if (iosModalClose) {
      const modal = document.getElementById('pwa-ios-modal');
      if (modal) modal.classList.add('pwa-hidden');
    }
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredInstallPrompt = null;
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.classList.add('pwa-hidden');
  });

  // 4. iOS Safari Guide Prompt
  window.addEventListener('DOMContentLoaded', () => {
    // If already installed/standalone, don't show any install prompts
    if (isStandalone()) {
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.classList.add('pwa-hidden');
      return;
    }

    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isSafari = /safari/.test(window.navigator.userAgent.toLowerCase()) && !/chrome|crios|fxios/.test(window.navigator.userAgent.toLowerCase());
    const dismissed = sessionStorage.getItem('pwa-banner-dismissed');

    if (isIos && isSafari && !dismissed) {
      const banner = document.getElementById('pwa-install-banner');
      const iosHelpBtn = document.getElementById('pwa-ios-help-btn');
      const androidBtn = document.getElementById('pwa-install-btn');

      if (banner) {
        // Customize banner for iOS
        if (androidBtn) androidBtn.style.display = 'none';
        if (iosHelpBtn) iosHelpBtn.style.display = 'inline-flex';
        banner.classList.remove('pwa-hidden');
      }
    }
  });

  // Expose helper to window
  window.PWA = {
    isStandalone
  };
})();
