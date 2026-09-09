/* ══════════════════════════════════════════════════════
   nav.js — 통합 글로벌 내비게이션 메뉴 (단일 관리 모듈)
   새로운 앱을 추가하거나 수정할 때는 아래 NAV_ITEMS 배열만 수정하면
   모든 페이지의 햄버거 메뉴 및 데스크톱 상단 메뉴에 일괄 반영됩니다.
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // 사이트 전체 공통 앱 목록 (단일 관리 원본)
  const NAV_ITEMS = [
    { href: 'index.html', icon: '🏠', title: '홈' },
    { href: 'farm.html', icon: '🌱', title: '용어 노트' },
    { href: 'flashcards.html', icon: '🗂️', title: '플래시카드' },
    { href: 'hanja.html', icon: '📗', title: '한글(한자)' },
    { href: 'rebalance.html', icon: '⚖️', title: '자산 리밸런싱' },
    { href: 'listening.html', icon: '🎧', title: '영어 듣기' },
    { href: 'dialogue.html', icon: '💬', title: '영어 암기' },
    { href: 'reader.html', icon: '📖', title: '영어 읽기' },
    { href: 'timeline.html', icon: '⏳', title: '세계사 연표' },
    { href: 'genealogy.html', icon: '🌳', title: '가계도' }
  ];

  // 외부 참조용 전역 등록
  window.NAV_ITEMS = NAV_ITEMS;

  function getCurrentFilename() {
    let filename = window.location.pathname.split('/').pop() || '';
    if (!filename || filename === '') {
      filename = 'index.html';
    }
    return filename;
  }

  function renderNavMenu() {
    const navMenu = document.getElementById('nav-menu') || document.querySelector('.nav-menu');
    if (!navMenu) return;

    const currentFile = getCurrentFilename();

    navMenu.innerHTML = NAV_ITEMS.map((item) => {
      const isActive = item.href === currentFile;
      const activeClass = isActive ? ' active' : '';
      return `<a href="${item.href}" class="nav-link${activeClass}"><span class="nav-icon">${item.icon}</span> ${item.title}</a>`;
    }).join('\n      ');
  }

  function setupNavToggle() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu') || document.querySelector('.nav-menu');
    if (!navToggle || !navMenu) return;

    // 중복 바인딩 방지 플래그
    if (navToggle.dataset.navBound === 'true') return;
    navToggle.dataset.navBound = 'true';

    // 햄버거 버튼 토글
    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      navMenu.classList.toggle('open');
    });

    // 메뉴 바깥 클릭 시 닫기
    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('open') && !navMenu.contains(e.target) && !navToggle.contains(e.target)) {
        navMenu.classList.remove('open');
      }
    });

    // ESC 키 입력 시 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
      }
    });
  }

  function initNav() {
    renderNavMenu();
    setupNavToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNav);
  } else {
    initNav();
  }
})();
