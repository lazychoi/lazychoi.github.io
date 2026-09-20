/**
 * genealogy.js — 일부일처 부부 표시 시 우측 배우자 화살표(▶) 숨김 정밀 보완 버전
 */

const supabaseUrl = 'https://tpwwwpcbinxdhxqvcvqc.supabase.co';
const supabaseKey = 'sb_publishable_A1sd3hvbeQx9-gVoFXL0qA_G923SWm9';
const supabaseClient = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

/**
 * 🏛️ 그리스 ⟷ 로마 신화 신명 및 주요 영웅 대응 사전 (Interpretatio Romana)
 */
const MYTHOLOGY_SYNCRETISM_MAP = {
  // 올림포스 12신 및 주요 주신
  '제우스': { roman: '유피테르', romanEng: 'Jupiter', aliases: ['유피테르', '주피터', 'Jupiter', 'Jove'] },
  '헤라': { roman: '유노', romanEng: 'Juno', aliases: ['유노', '주노', 'Juno'] },
  '포세이돈': { roman: '넵투누스', romanEng: 'Neptune', aliases: ['넵투누스', '넵튠', 'Neptune'] },
  '데메테르': { roman: '케레스', romanEng: 'Ceres', aliases: ['케레스', '세레스', 'Ceres'] },
  '아테나': { roman: '미네르바', romanEng: 'Minerva', aliases: ['미네르바', 'Minerva'] },
  '아폴론': { roman: '아폴로', romanEng: 'Apollo', aliases: ['아폴로', '포이보스', 'Apollo', 'Phoebus'] },
  '아르테미스': { roman: '디아나', romanEng: 'Diana', aliases: ['디아나', '다이애나', 'Diana'] },
  '아레스': { roman: '마르스', romanEng: 'Mars', aliases: ['마르스', 'Mars'] },
  '아프로디테': { roman: '베누스', romanEng: 'Venus', aliases: ['베누스', '비너스', 'Venus'] },
  '헤르메스': { roman: '메르쿠리우스', romanEng: 'Mercury', aliases: ['메르쿠리우스', '머큐리', 'Mercury'] },
  '헤파이스토스': { roman: '불카누스', romanEng: 'Vulcan', aliases: ['불카누스', '불칸', 'Vulcan'] },
  '디오니소스': { roman: '바쿠스', romanEng: 'Bacchus', aliases: ['바쿠스', '리베르', 'Bacchus', 'Liber'] },
  '헤스티아': { roman: '베스타', romanEng: 'Vesta', aliases: ['베스타', 'Vesta'] },
  '하데스': { roman: '플루토', romanEng: 'Pluto', aliases: ['플루토', '디스 파테르', 'Pluto', 'Dis Pater'] },

  // 원초신 및 티탄족
  '우라노스': { roman: '카이엘루스', romanEng: 'Caelus', aliases: ['카이엘루스', 'Caelus'] },
  '가이아': { roman: '테라', romanEng: 'Terra', aliases: ['테라', '텔루스', 'Terra', 'Tellus'] },
  '크로노스': { roman: '사투르누스', romanEng: 'Saturn', aliases: ['사투르누스', '새턴', 'Saturn'] },
  '레아': { roman: '옵스', romanEng: 'Ops', aliases: ['옵스', '마그나 마테르', 'Ops', 'Magna Mater'] },

  // 주요 신령 및 권속
  '에로스': { roman: '쿠피도', romanEng: 'Cupid', aliases: ['쿠피도', '아모르', '큐피드', 'Cupid', 'Amor'] },
  '페르세포네': { roman: '프로세르피나', romanEng: 'Proserpina', aliases: ['프로세르피나', 'Proserpina'] },
  '헤라클레스': { roman: '헤르쿨레스', romanEng: 'Hercules', aliases: ['헤르쿨레스', '허큘리스', 'Hercules'] },
  '헬리오스': { roman: '솔', romanEng: 'Sol', aliases: ['솔', 'Sol'] },
  '셀레네': { roman: '루나', romanEng: 'Luna', aliases: ['루나', 'Luna'] },
  '에오스': { roman: '아우로라', romanEng: 'Aurora', aliases: ['아우로라', '오로라', 'Aurora'] },
  '니케': { roman: '빅토리아', romanEng: 'Victoria', aliases: ['빅토리아', 'Victoria'] },
  '튀케': { roman: '포르투나', romanEng: 'Fortuna', aliases: ['포르투나', 'Fortuna'] },
  '네메시스': { roman: '인비디아', romanEng: 'Invidia', aliases: ['인비디아', 'Invidia'] },
  '판': { roman: '파우누스', romanEng: 'Faunus', aliases: ['파우누스', 'Faunus'] },
  '에리스': { roman: '디스코르디아', romanEng: 'Discordia', aliases: ['디스코르디아', 'Discordia'] },
  '헤베': { roman: '유벤타스', romanEng: 'Juventas', aliases: ['유벤타스', 'Juventas'] },
  '이리스': { roman: '아르쿠스', romanEng: 'Arcus', aliases: ['아르쿠스', 'Arcus'] },
  '타나토스': { roman: '모르스', romanEng: 'Mors', aliases: ['모르스', 'Mors'] },
  '휘프노스': { roman: '솜누스', romanEng: 'Somnus', aliases: ['솜누스', 'Somnus'] },
  '모르페우스': { roman: '솜니아', romanEng: 'Somnia', aliases: ['솜니아', 'Somnia'] },
  '아스클레피오스': { roman: '아에스쿨라피우스', romanEng: 'Aesculapius', aliases: ['아에스쿨라피우스', '베디오비스', 'Aesculapius'] }
};

/**
 * 📜 복수 부모 전승 (상충하는 설화) 기본 사전
 */
const DEFAULT_PARENT_VARIANTS_MAP = {
  '아프로디테': [
    {
      id: 'hesiod',
      source: '헤시오도스 《신통기》 (통설)',
      parentNames: ['우라노스'],
      info: '크로노스에게 거세된 우라노스의 성기에서 나온 바다 거품(아프로스)에서 탄생 (어머니 없음)',
      isPrimary: true
    },
    {
      id: 'homer',
      source: '호메로스 《일리아스》',
      parentNames: ['제우스', '디오네'],
      info: '하늘의 주신 제우스와 고대 바다 님프 디오네 사이에서 태어난 딸',
      isPrimary: false
    }
  ],
  '에로스': [
    {
      id: 'classical',
      source: '서정시·로마 전승 (쿠피도)',
      parentNames: ['아레스', '아프로디테'],
      info: '전쟁의 신 아레스와 사랑의 여신 아프로디테의 아들',
      isPrimary: true
    },
    {
      id: 'hesiod',
      source: '헤시오도스 《신통기》',
      parentNames: ['카오스'],
      info: '태초의 카오스 직후 스스로 생겨난 우주 생성과 결합의 원초신',
      isPrimary: false
    }
  ],
  '아테나': [
    {
      id: 'head',
      source: '고전 전승 (단독 탄생)',
      parentNames: ['제우스'],
      info: '제우스의 머리/이마를 헤파이스토스가 도끼로 가르자 완전 무장한 채 단독 탄생',
      isPrimary: true
    },
    {
      id: 'metis',
      source: '헤시오도스 전승 (메티스)',
      parentNames: ['제우스', '메티스'],
      info: '제우스가 통째로 삼킨 첫 번째 지혜의 아내 메티스가 제우스의 몸속에서 잉태',
      isPrimary: false
    }
  ],
  '헤파이스토스': [
    {
      id: 'zeus_hera',
      source: '호메로스 전승 (일반설)',
      parentNames: ['제우스', '헤라'],
      info: '올림포스의 주신 제우스와 정실 왕비 헤라 사이의 정식 아들',
      isPrimary: true
    },
    {
      id: 'parthenogenesis',
      source: '헤시오도스 전승 (처녀생식)',
      parentNames: ['헤라'],
      info: '제우스가 혼자 아테나를 낳은 것에 분노하여 헤라가 혼자 힘으로 단독 낳은 아들',
      isPrimary: false
    }
  ],
  '디오니소스': [
    {
      id: 'semele',
      source: '테베 전승 (일반설)',
      parentNames: ['제우스', '세멜레'],
      info: '제우스와 테베의 인간 공주 세멜레의 아들 (제우스의 허벅지에서 다시 태어남)',
      isPrimary: true
    },
    {
      id: 'zagreus',
      source: '오르페우스교 전승 (자그레우스)',
      parentNames: ['제우스', '페르세포네'],
      info: '제우스와 지하세계의 여왕 페르세포네 사이에서 태어난 자그레우스 전승',
      isPrimary: false
    }
  ]
};

class DynamicGenealogyApp {
  constructor() {
    // Data Store
    this.nodesMap = new Map();
    this.datasetsList = [];

    // App State (Dynamic Graph State)
    this.focusNodeId = null;
    this.hasSearched = false;
    this.highlightedSearchIndex = -1;
    this.currentDatasetKey = 'greek';
    this.currentUser = null;
    this.isEditMode = false;

    // 그리스 로마 신화 표기 모드 및 다중 부모 전승 상태
    this.mythNameMode = 'both'; // 'both' | 'greek' | 'roman'
    this.activeParentVariants = new Map(); // personId -> variantId

    // 인물 추가 대화상자 임시 상태
    this.pendingQuickAddAction = null;

    // 현재 캔버스에 표시중인 노드와 펼침 상태
    this.visibleNodes = new Map();
    this.expandedTop = new Set();
    this.expandedLeft = new Set();
    this.expandedRight = new Set();
    this.expandedBottom = new Set();
    this.expandedCouples = new Set();
    this.expandedGroups = new Set();

    // Canvas Transform State (Pan & Zoom)
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.lastPanX = 0;
    this.lastPanY = 0;

    // Base Node Dimensions
    this.nodeWidth = 160;
    this.nodeHeight = 44;

    // DOM Elements
    this.viewport = document.getElementById('appViewport');
    this.stage = document.getElementById('canvasStage');
    this.svgLayer = document.getElementById('connectionsLayer');
    this.nodesLayer = document.getElementById('nodesLayer');
    this.searchInput = document.getElementById('searchInput');
    this.searchDropdown = document.getElementById('searchDropdown');
    this.datasetSelect = document.getElementById('datasetSelect');
    this.btnZoomIn = document.getElementById('btnZoomIn');
    this.btnZoomOut = document.getElementById('btnZoomOut');
    this.btnResetView = document.getElementById('btnResetView');
    this.btnToggleEditor = document.getElementById('btnToggleEditor');
    this.btnAuthToggle = document.getElementById('btnAuthToggle');

    this.emptyPlaceholder = document.getElementById('emptyPlaceholder');
    this.editModal = document.getElementById('editModal');
    this.authModal = document.getElementById('authModal');
    this.loginForm = document.getElementById('loginForm');
    this.loginError = document.getElementById('loginError');

    // 새 가계도 만들기 모달 요소
    this.createDatasetModal = document.getElementById('createDatasetModal');
    this.createDatasetForm = document.getElementById('createDatasetForm');
    this.newDatasetTitle = document.getElementById('newDatasetTitle');
    this.newDatasetFirstPersonName = document.getElementById('newDatasetFirstPersonName');
    this.newDatasetFirstPersonGender = document.getElementById('newDatasetFirstPersonGender');
    this.btnCreateDatasetCancel = document.getElementById('btnCreateDatasetCancel');
    this.btnCreateDatasetClose = document.getElementById('btnCreateDatasetClose');

    // 스케치 기반 다중 행 추가 모달 요소
    this.quickAddModal = document.getElementById('quickAddModal');
    this.quickAddTitle = document.getElementById('quickAddTitle');
    this.quickAddSubtitle = document.getElementById('quickAddSubtitle');
    this.quickAddRowsContainer = document.getElementById('quickAddRowsContainer');
    this.btnAddQuickRow = document.getElementById('btnAddQuickRow');
    this.btnQuickAddSubmit = document.getElementById('btnQuickAddSubmit');
    this.btnQuickAddCancel = document.getElementById('btnQuickAddCancel');
    this.btnQuickAddClose = document.getElementById('btnQuickAddClose');
    this.quickAddPersonDatalist = document.getElementById('quickAddPersonDatalist');

    // 인물 정보 수정 ✏️ 모달 & 🗑️ 삭제 버튼 요소
    this.quickEditModal = document.getElementById('quickEditModal');
    this.quickEditForm = document.getElementById('quickEditForm');
    this.quickEditId = document.getElementById('quickEditId');
    this.quickEditName = document.getElementById('quickEditName');
    this.quickEditNameEng = document.getElementById('quickEditNameEng');
    this.quickEditParents = document.getElementById('quickEditParents');
    this.quickEditSpouses = document.getElementById('quickEditSpouses');
    this.quickEditTitle = document.getElementById('quickEditTitle');
    this.quickEditGroup = document.getElementById('quickEditGroup');
    this.quickEditGender = document.getElementById('quickEditGender');
    this.quickEditInfo = document.getElementById('quickEditInfo');
    this.btnQuickEditDelete = document.getElementById('btnQuickEditDelete');
    this.btnQuickEditCancel = document.getElementById('btnQuickEditCancel');
    this.btnQuickEditClose = document.getElementById('btnQuickEditClose');

    // 그리스 로마 신화 표기 모드 및 전승 팝오버 요소
    this.mythModeGroup = document.getElementById('mythModeGroup');
    this.traditionPopover = document.getElementById('traditionPopover');
    this.traditionPopoverList = document.getElementById('traditionPopoverList');
    this.btnTraditionPopoverClose = document.getElementById('btnTraditionPopoverClose');
    this.quickEditNameRoman = document.getElementById('quickEditNameRoman');
    this.quickEditNameRomanEng = document.getElementById('quickEditNameRomanEng');
    this.quickEditVariantsGroup = document.getElementById('quickEditVariantsGroup');
    this.quickEditVariantsList = document.getElementById('quickEditVariantsList');
    this.btnToggleVariants = document.getElementById('btnToggleVariants');
    this.btnQuickEditAddVariant = document.getElementById('btnQuickEditAddVariant');

    this.init();
  }

  async init() {
    this.bindEvents();
    this.bindCreateDatasetModalEvents();
    this.bindQuickAddModalEvents();
    this.bindQuickEditModalEvents();
    this.initSupabaseAuth();
    await this.fetchDatasetsFromDB();
    await this.loadDataset(this.currentDatasetKey, false);
  }

  initSupabaseAuth() {
    if (!supabaseClient) return;

    supabaseClient.auth.onAuthStateChange((event, session) => {
      this.currentUser = session?.user || null;
      this.updateAuthUI();
    });
  }

  updateAuthUI() {
    const authStatusText = document.getElementById('authStatusText');
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');

    const btnToggleEditor = document.getElementById('btnToggleEditor');
    const btnImportCsv = document.getElementById('btnImportCsv');
    const btnExportCsv = document.getElementById('btnExportCsv');

    if (this.currentUser) {
      if (authStatusText) authStatusText.textContent = `${this.currentUser.email}`;
      if (btnLogin) btnLogin.style.display = 'none';
      if (btnLogout) btnLogout.style.display = 'inline-flex';

      // 로그인 상태에서만 편집 관련 버튼들 노출
      if (btnToggleEditor) btnToggleEditor.style.display = 'inline-flex';
      if (btnImportCsv) btnImportCsv.style.display = 'inline-flex';
      if (btnExportCsv) btnExportCsv.style.display = 'inline-flex';
    } else {
      if (authStatusText) authStatusText.textContent = '';
      if (btnLogin) btnLogin.style.display = 'inline-flex';
      if (btnLogout) btnLogout.style.display = 'none';

      // 로그아웃 상태에서는 편집 관련 버튼들 모두 숨김
      if (btnToggleEditor) btnToggleEditor.style.display = 'none';
      if (btnImportCsv) btnImportCsv.style.display = 'none';
      if (btnExportCsv) btnExportCsv.style.display = 'none';
      this.isEditMode = false;
    }

    this.updateEditModeBtn();
  }

  updateEditModeBtn() {
    if (!this.btnToggleEditor) return;
    if (this.isEditMode) {
      this.btnToggleEditor.innerHTML = '✅ 편집 완료';
      this.btnToggleEditor.style.background = '#10b981';
      this.btnToggleEditor.style.color = '#ffffff';
    } else {
      this.btnToggleEditor.innerHTML = '✏️ 데이터 편집';
      this.btnToggleEditor.style.background = '#0f172a';
      this.btnToggleEditor.style.color = '#ffffff';
    }
  }

  // ── 1. Supabase DB에서 dataset_id 목록 조회 ──
  async fetchDatasetsFromDB() {
    if (!supabaseClient) return;

    try {
      await supabaseClient.from('genealogy_datasets').update({ title: '그리스 로마 신화' }).eq('id', 'greek');
      await supabaseClient.from('genealogy_datasets').update({ title: '조선 왕실' }).eq('id', 'joseon');

      const { data, error } = await supabaseClient
        .from('genealogy_datasets')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        this.datasetsList = data.map(ds => {
          let cleanTitle = ds.title || ds.id;
          cleanTitle = cleanTitle.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim();
          if (cleanTitle === '그리스·로마 신화 가계도' || cleanTitle === '그리스·로마 신화' || cleanTitle === '그리스 로마 신화 가계도') {
            cleanTitle = '그리스 로마 신화';
          } else if (cleanTitle === '조선 왕실 가계도') {
            cleanTitle = '조선 왕실';
          }
          return { ...ds, title: cleanTitle };
        });
      } else {
        this.datasetsList = [
          { id: 'greek', title: '그리스 로마 신화' },
          { id: 'joseon', title: '조선 왕실' }
        ];
      }
    } catch (err) {
      console.warn("Dataset fetch exception:", err);
      this.datasetsList = [
        { id: 'greek', title: '그리스 로마 신화' },
        { id: 'joseon', title: '조선 왕실' }
      ];
    }

    this.renderDatasetSelectOptions();
  }

  renderDatasetSelectOptions() {
    if (!this.datasetSelect) return;

    const datasetOptionsHtml = this.datasetsList.map(ds => `
      <option value="${ds.id}" ${ds.id === this.currentDatasetKey ? 'selected' : ''}>
        ${this.escapeHtml(ds.title)}
      </option>
    `).join('');

    this.datasetSelect.innerHTML = `
      ${datasetOptionsHtml}
      <option value="__CREATE_NEW_DATASET__">새 가계도 추가...</option>
    `;
  }

  // ── 2. 선택된 dataset_id 노드 데이터 로드 ──
  async loadDataset(datasetKey = 'greek', isUserCreatedNew = false) {
    this.currentDatasetKey = datasetKey;
    this.renderDatasetSelectOptions();

    if (this.mythModeGroup) {
      this.mythModeGroup.style.display = (datasetKey === 'greek') ? 'flex' : 'none';
    }

    if (!supabaseClient) return;

    try {
      const { data, error } = await supabaseClient
        .from('genealogy_nodes')
        .select('*')
        .eq('dataset_id', datasetKey);

      if (error) {
        console.error("Supabase load error:", error);
      }

      this.nodesMap.clear();

      if (data && data.length > 0) {
        data.forEach(node => {
          const nodeName = (node.name && !node.name.startsWith(`${datasetKey}_`)) ? node.name : "이름 없음";
          const syn = (datasetKey === 'greek') ? (MYTHOLOGY_SYNCRETISM_MAP[nodeName] || {}) : {};
          const nameRoman = node.name_roman || syn.roman || "";
          const nameRomanEng = node.name_roman_eng || syn.romanEng || "";
          const parentVariants = Array.isArray(node.parent_variants) ? [...node.parent_variants] : [];

          this.nodesMap.set(node.id, {
            id: node.id,
            name: nodeName,
            nameEng: node.name_eng || "",
            nameRoman: nameRoman,
            nameRomanEng: nameRomanEng,
            title: node.title || "",
            gender: node.gender || "male",
            info: node.info || "",
            groupName: node.group_name || node.groupName || "",
            parentIds: Array.isArray(node.parent_ids) ? [...node.parent_ids] : [],
            spouseIds: Array.isArray(node.spouse_ids) ? [...node.spouse_ids] : [],
            parentVariants: parentVariants
          });
        });
      }
    } catch (err) {
      console.error("Supabase connection exception:", err);
    }

    // 그리스 로마 신화 기본 전승 매핑 보완 (DB에 parent_variants가 아직 비어있는 경우)
    if (this.currentDatasetKey === 'greek') {
      const findIdByName = (targetName) => {
        for (const [id, p] of this.nodesMap.entries()) {
          if (p.name === targetName) return id;
        }
        return null;
      };

      for (const [id, person] of this.nodesMap.entries()) {
        if ((!person.parentVariants || person.parentVariants.length === 0) && DEFAULT_PARENT_VARIANTS_MAP[person.name]) {
          const defVariants = DEFAULT_PARENT_VARIANTS_MAP[person.name];
          const resolved = [];
          for (const v of defVariants) {
            const pIds = v.parentNames.map(name => findIdByName(name)).filter(Boolean);
            resolved.push({
              id: v.id,
              source: v.source,
              parent_ids: pIds,
              info: v.info,
              is_primary: !!v.isPrimary
            });
          }
          if (resolved.length > 0) {
            person.parentVariants = resolved;
          }
        }

        // 초기 활성 전승 설정
        if (person.parentVariants && person.parentVariants.length > 0) {
          const primary = person.parentVariants.find(v => v.is_primary) || person.parentVariants[0];
          this.activeParentVariants.set(person.id, primary.id);
        }
      }
    }

    await this.deduplicateExistingNodes();
    this.sanitizeRelationships();
    this.updateQuickAddDatalist();
    this.resetGraphState();

    if (isUserCreatedNew && this.nodesMap.size > 0) {
      const firstNodeId = Array.from(this.nodesMap.keys())[0];
      this.setFocusPerson(firstNodeId);
    } else {
      this.render();
    }
  }

  // ── 2.5 활성 전승(Tradition)에 따른 유효 부모 ID 반환 ──
  getEffectiveParentIds(personId) {
    const person = this.nodesMap.get(personId);
    if (!person) return [];

    if (person.parentVariants && person.parentVariants.length > 0) {
      const activeVarId = this.activeParentVariants.get(personId);
      const activeVar = person.parentVariants.find(v => v.id === activeVarId) || person.parentVariants[0];
      if (activeVar && Array.isArray(activeVar.parent_ids)) {
        return activeVar.parent_ids.filter(id => this.nodesMap.has(id));
      }
    }

    return (person.parentIds || []).filter(id => this.nodesMap.has(id));
  }

  updateQuickAddDatalist() {
    if (!this.quickAddPersonDatalist) return;
    const allPersons = Array.from(this.nodesMap.values());
    this.quickAddPersonDatalist.innerHTML = allPersons.map(p => `
      <option value="${this.escapeHtml(p.name)}">${this.escapeHtml(p.name)}${p.title ? ` (${this.escapeHtml(p.title)})` : ''}</option>
    `).join('');
  }

  async deduplicateExistingNodes() {
    const nameToPrimaryIdMap = new Map();
    const duplicateIdToPrimaryIdMap = new Map();

    for (const [id, person] of this.nodesMap.entries()) {
      const normName = (person.name || '').replace(/\s+/g, '').toLowerCase();
      if (!normName || normName === '이름없음') continue;

      if (nameToPrimaryIdMap.has(normName)) {
        const primaryId = nameToPrimaryIdMap.get(normName);
        duplicateIdToPrimaryIdMap.set(id, primaryId);

        const primaryPerson = this.nodesMap.get(primaryId);
        if (primaryPerson) {
          person.parentIds.forEach(pId => {
            if (!primaryPerson.parentIds.includes(pId)) primaryPerson.parentIds.push(pId);
          });
          person.spouseIds.forEach(sId => {
            if (!primaryPerson.spouseIds.includes(sId)) primaryPerson.spouseIds.push(sId);
          });
        }
      } else {
        nameToPrimaryIdMap.set(normName, id);
      }
    }

    if (duplicateIdToPrimaryIdMap.size > 0) {
      for (const [dupId, primaryId] of duplicateIdToPrimaryIdMap.entries()) {
        this.nodesMap.delete(dupId);

        for (const [id, p] of this.nodesMap.entries()) {
          let updated = false;
          if (p.parentIds.includes(dupId)) {
            p.parentIds = p.parentIds.map(x => x === dupId ? primaryId : x).filter((x, i, a) => a.indexOf(x) === i);
            updated = true;
          }
          if (p.spouseIds.includes(dupId)) {
            p.spouseIds = p.spouseIds.map(x => x === dupId ? primaryId : x).filter((x, i, a) => a.indexOf(x) === i);
            updated = true;
          }
          if (updated) {
            await this.savePersonToDB(id);
          }
        }

        if (supabaseClient) {
          await supabaseClient.from('genealogy_nodes').delete().eq('id', dupId);
        }
      }
    }
  }

  // ── 3. parent_ids 및 복수 전승 기반 자식 및 부부 공통 자식 추적 ──
  getChildIds(personId) {
    const children = [];
    for (const [id, person] of this.nodesMap.entries()) {
      const effParents = this.getEffectiveParentIds(id);
      if (effParents.includes(personId)) {
        children.push(id);
      }
    }
    return children;
  }

  getCommonChildren(p1Id, p2Id) {
    const common = [];
    for (const [cId, person] of this.nodesMap.entries()) {
      const effParents = this.getEffectiveParentIds(cId);
      if (effParents.includes(p1Id) && effParents.includes(p2Id)) {
        common.push(cId);
      }
    }
    return common;
  }

  sanitizeRelationships() {
    const validIds = new Set(this.nodesMap.keys());

    for (const [id, person] of this.nodesMap.entries()) {
      person.parentIds = person.parentIds.filter(pId => validIds.has(pId) && pId !== id);
      person.spouseIds = person.spouseIds.filter(sId => validIds.has(sId) && sId !== id);
    }

    for (const [id, person] of this.nodesMap.entries()) {
      person.spouseIds.forEach(spouseId => {
        const spouse = this.nodesMap.get(spouseId);
        if (spouse && !spouse.spouseIds.includes(id)) {
          spouse.spouseIds.push(id);
        }
      });
    }
  }

  findOrCreatePersonByNameOrId(inputStr, defaultGender = 'male') {
    const term = inputStr.trim();
    if (!term) return null;

    if (this.nodesMap.has(term)) return term;

    const normalizedInput = term.replace(/\s+/g, '').toLowerCase();

    for (const [id, person] of this.nodesMap.entries()) {
      const normName = (person.name || '').replace(/\s+/g, '').toLowerCase();
      const normEng = (person.nameEng || '').replace(/\s+/g, '').toLowerCase();
      const normRoman = (person.nameRoman || '').replace(/\s+/g, '').toLowerCase();
      const normRomanEng = (person.nameRomanEng || '').replace(/\s+/g, '').toLowerCase();

      if (normName === normalizedInput || (normEng && normEng === normalizedInput) ||
          normRoman === normalizedInput || (normRomanEng && normRomanEng === normalizedInput)) {
        return id;
      }
    }

    const syn = (this.currentDatasetKey === 'greek') ? (MYTHOLOGY_SYNCRETISM_MAP[term] || {}) : {};

    const newAutoId = `${this.currentDatasetKey}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newPerson = {
      id: newAutoId,
      name: term,
      nameEng: "",
      nameRoman: syn.roman || "",
      nameRomanEng: syn.romanEng || "",
      title: "",
      gender: defaultGender,
      info: "",
      parentIds: [],
      spouseIds: [],
      parentVariants: []
    };
    this.nodesMap.set(newAutoId, newPerson);

    if (supabaseClient) {
      this.savePersonToDB(newAutoId).then(() => {});
    }

    return newAutoId;
  }

  async savePersonToDB(personId) {
    const person = this.nodesMap.get(personId);
    if (!person || !supabaseClient) return;

    const payload = {
      id: person.id,
      dataset_id: this.currentDatasetKey,
      name: person.name,
      name_eng: person.nameEng || "",
      name_roman: person.nameRoman || null,
      name_roman_eng: person.nameRomanEng || null,
      title: person.title || "",
      gender: person.gender || "male",
      info: person.info || "",
      group_name: person.groupName || null,
      parent_ids: person.parentIds || [],
      spouse_ids: person.spouseIds || [],
      parent_variants: person.parentVariants || [],
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabaseClient.from('genealogy_nodes').upsert(payload);
      if (error) {
        // Supabase DB에 name_roman 또는 parent_variants 컬럼이 아직 없을 경우의 안전한 폴백
        if (error.message && (error.message.includes('name_roman') || error.message.includes('parent_variants'))) {
          console.warn("Supabase schema missing new columns, falling back to legacy fields. Please execute ALTER TABLE in Supabase SQL editor.");
          delete payload.name_roman;
          delete payload.name_roman_eng;
          delete payload.parent_variants;
          await supabaseClient.from('genealogy_nodes').upsert(payload);
        } else {
          console.error("DB Save error:", error);
        }
      }
    } catch (err) {
      console.warn("DB Save warning:", err);
    }
  }

  resetGraphState() {
    this.hasSearched = false;
    this.focusNodeId = null;
    this.visibleNodes.clear();
    this.expandedTop.clear();
    this.expandedLeft.clear();
    this.expandedRight.clear();
    this.expandedBottom.clear();
    this.expandedCouples.clear();
    this.expandedGroups.clear();
    this.highlightedSearchIndex = -1;
  }

  setFocusPerson(personId) {
    if (!this.nodesMap.has(personId)) return;

    this.resetGraphState();
    this.focusNodeId = personId;
    this.hasSearched = true;

    const centerX = 2500;
    const centerY = 2500;

    this.visibleNodes.set(personId, {
      id: personId,
      x: centerX,
      y: centerY,
      isFocus: true
    });

    this.render();
    this.centerOnFocusNode();
  }

  render() {
    if (!this.hasSearched || !this.focusNodeId) {
      this.nodesLayer.innerHTML = '';
      this.svgLayer.innerHTML = '';
      if (this.emptyPlaceholder) this.emptyPlaceholder.style.display = 'flex';
      return;
    }

    if (this.emptyPlaceholder) this.emptyPlaceholder.style.display = 'none';

    const layout = this.recalculateDynamicPositions();

    this.renderNodes(layout);
    this.renderConnections(layout);
  }

  getNodeGroup(person) {
    if (!person) return '';
    if (person.groupName && person.groupName.trim().length > 0) {
      return person.groupName.trim();
    }

    const titanNames = ['오케아노스', '테티스', '테튀스', '히페리온', '테이아', '코이오스', '포이베', '크리오스', '므네모시네', '이아페토스', '테미스', '크로노스', '레아', '디오네'];
    const cyclopesNames = ['브론테스', '스테로페스', '아르게스', '아스테로페스'];
    const hecatoncheiresNames = ['코토스', '브리아레오스', '귀게스', '지에스', '기에스', '에뤼토스', '그퀴게스'];
    const gigantesNames = ['다마센', '게게네이스', '미마스', '안타이오스', '아르고스 파놉테스', '아토스', '에피알테스', '에우리메돈', '에우리토스', '그라티온', '티티오스', '쉬케우스', '올륌브로스', '뮐리노스', '호플로다모스', '팔라스 (거인)', '폴리보테스', '포르피리온', '펠로루스', '알퀴오네우스', '히폴뤼토스', '토아스', '오리온', '아그리오스'];
    const protogenoiNames = ['카오스', '가이아', '타르타로스', '에로스', '에레보스', '뉠스', '우라노스', '우레아', '폰토스', '아난케', '크로노스(태초신)', '네소이'];
    const monsterNames = ['피톤', '캄페', '티폰', '에키드나', '오피오타우로스'];
    const pontoiNames = ['네레우스', '타우마스', '포르퀴스', '케토', '에우리비아', '프로테우스', '카륍디스', '알페이오스'];

    if (titanNames.includes(person.name)) return '티탄 12신';
    if (cyclopesNames.includes(person.name)) return '퀴클롭스';
    if (hecatoncheiresNames.includes(person.name)) return '헤카톤케이레스';
    if (gigantesNames.includes(person.name)) return '기가스 (거인족)';
    if (protogenoiNames.includes(person.name)) return '태초신 (Protogenoi)';
    if (monsterNames.includes(person.name)) return '태초의 괴수';
    if (pontoiNames.includes(person.name)) return '바다의 신 (Pontoi)';

    return '';
  }

  recalculateDynamicPositions() {
    const layoutNodes = [];
    const nodePosMap = new Map();
    const couplePairs = [];
    const groupBadgeNodes = [];

    const focusNode = this.visibleNodes.get(this.focusNodeId);
    if (!focusNode) return { nodes: [], couples: [], groupBadges: [] };

    const centerX = focusNode.x;
    const centerY = focusNode.y;

    // Helper to get active spouse for a person when a couple's children are expanded
    const getActiveSpouseForNode = (nodeId) => {
      for (const coupleKey of this.expandedCouples) {
        const parts = coupleKey.split('__');
        if (parts[0] === nodeId) return parts[1];
        if (parts[1] === nodeId) return parts[0];
      }
      return null;
    };

    // Helper to place spouse(s) for a node vertically to the right (at nodeX, nodeY)
    const placeSpousesForNode = (nodeId, nodeX, nodeY) => {
      if (!this.expandedRight.has(nodeId)) return nodeY;
      const person = this.nodesMap.get(nodeId);
      if (!person) return nodeY;

      let spouses = person.spouseIds.filter(spId => this.nodesMap.has(spId));
      const activeSpouseId = getActiveSpouseForNode(nodeId);
      if (activeSpouseId) {
        spouses = spouses.filter(spId => spId === activeSpouseId);
      }

      if (spouses.length === 0) return nodeY;

      const rightX = nodeX + 280;
      const spouseRowHeight = 62;
      const totalH = (spouses.length - 1) * spouseRowHeight;
      const startY = nodeY - (totalH / 2);
      let maxSpY = nodeY;

      spouses.forEach((spId, idx) => {
        const spY = startY + (idx * spouseRowHeight);
        maxSpY = Math.max(maxSpY, spY);
        nodePosMap.set(spId, {
          id: spId,
          x: rightX,
          y: spY,
          isSpouse: true
        });

        const coupleKey = [nodeId, spId].sort().join('__');
        couplePairs.push({
          key: coupleKey,
          p1: nodeId,
          p2: spId,
          midX: (nodeX + rightX) / 2,
          midY: spY
        });
      });

      return maxSpY;
    };

    // 1. Focus Node Position
    nodePosMap.set(this.focusNodeId, {
      id: this.focusNodeId,
      x: centerX,
      y: centerY,
      isFocus: true
    });

    const focusPerson = this.nodesMap.get(this.focusNodeId);

    // 2. Parents & Ancestors Placement (Upwards)
    const placeAncestors = (childNodeId, childX, childY) => {
      if (!this.expandedTop.has(childNodeId)) return;
      const person = this.nodesMap.get(childNodeId);
      if (!person) return;
      const parents = this.getEffectiveParentIds(childNodeId);
      if (parents.length === 0) return;

      const parentY = childY - 140;
      const parentStepX = 220;
      const totalW = (parents.length - 1) * parentStepX;
      const startX = childX - (totalW / 2);

      parents.forEach((pId, idx) => {
        const pX = startX + (idx * parentStepX);
        nodePosMap.set(pId, {
          id: pId,
          x: pX,
          y: parentY,
          isParent: true
        });

        placeAncestors(pId, pX, parentY);
      });

      if (parents.length >= 2) {
        const p1 = parents[0];
        const p2 = parents[1];
        const p1Pos = nodePosMap.get(p1);
        const p2Pos = nodePosMap.get(p2);
        if (p1Pos && p2Pos) {
          const coupleKey = [p1, p2].sort().join('__');
          couplePairs.push({
            key: coupleKey,
            p1,
            p2,
            midX: (p1Pos.x + p2Pos.x) / 2,
            midY: p1Pos.y
          });
        }
      }
    };

    placeAncestors(this.focusNodeId, centerX, centerY);

    // 3. Siblings of Focus Node (Left)
    let leftSiblingMaxX = centerX - 280;
    if (this.expandedLeft.has(this.focusNodeId)) {
      const siblings = new Set();
      const focusParents = this.getEffectiveParentIds(this.focusNodeId);
      focusParents.forEach(pId => {
        const parentChildren = this.getChildIds(pId);
        parentChildren.forEach(cId => {
          if (cId !== this.focusNodeId) siblings.add(cId);
        });
      });

      const sibArray = Array.from(siblings);
      if (sibArray.length > 0) {
        const leftX = centerX - 280;
        leftSiblingMaxX = leftX + (this.nodeWidth / 2);
        const sibRowHeight = 55;
        const totalH = (sibArray.length - 1) * sibRowHeight;
        const startY = centerY - (totalH / 2);

        sibArray.forEach((sId, idx) => {
          nodePosMap.set(sId, {
            id: sId,
            x: leftX,
            y: startY + (idx * sibRowHeight),
            isSibling: true
          });
        });
      }
    }

    // 4. Focus Node Spouses (Right, stacked vertically)
    const maxFocusSpouseY = placeSpousesForNode(this.focusNodeId, centerX, centerY);

    // 5. Children & Multi-Generational Descendants Layout (Downwards)
    const placeChildrenRecursive = (parentIds, anchorX, parentY) => {
      let childIds = [];
      if (parentIds.length === 2) {
        childIds = this.getCommonChildren(parentIds[0], parentIds[1]);
      } else if (parentIds.length === 1) {
        const pId = parentIds[0];
        const allChildren = this.getChildIds(pId);
        childIds = allChildren.filter(cId => {
          const childPerson = this.nodesMap.get(cId);
          if (!childPerson) return false;
          const validParents = this.getEffectiveParentIds(cId);
          return validParents.length <= 1;
        });
      }

      if (childIds.length === 0) return;

      const coupleKey = parentIds.slice().sort().join('__');

      // Group children by groupName or auto-batching
      const groupsMap = new Map();
      childIds.forEach(cId => {
        const cPerson = this.nodesMap.get(cId);
        const gName = this.getNodeGroup(cPerson);
        if (!groupsMap.has(gName)) groupsMap.set(gName, []);
        groupsMap.get(gName).push(cId);
      });

      // Handle unnamed children if total children > 6 -> auto batching into 6-item groups
      if (groupsMap.has('') && childIds.length > 6 && groupsMap.size === 1) {
        const unnamedList = groupsMap.get('');
        groupsMap.delete('');
        const batchSize = 6;
        for (let i = 0; i < unnamedList.length; i += batchSize) {
          const batchIndex = Math.floor(i / batchSize) + 1;
          const batchName = `자식 그룹 ${batchIndex} (${i + 1}~${Math.min(i + batchSize, unnamedList.length)})`;
          groupsMap.set(batchName, unnamedList.slice(i, i + batchSize));
        }
      }

      const showGroupBadges = (groupsMap.size >= 2) || (childIds.length > 6 && !groupsMap.has(''));

      if (!showGroupBadges) {
        // Direct layout
        const baseChildY = (parentY === centerY) ? Math.max(parentY + 140, maxFocusSpouseY + (this.nodeHeight / 2) + 70) : parentY + 140;
        const childY = baseChildY;

        let totalRowWidth = 0;
        childIds.forEach((cId, idx) => {
          const isSpouseExpanded = this.expandedRight.has(cId);
          if (idx < childIds.length - 1) {
            totalRowWidth += isSpouseExpanded ? 500 : 220;
          } else {
            totalRowWidth += isSpouseExpanded ? 280 : 0;
          }
        });

        let startX = anchorX - (totalRowWidth / 2);
        const minAllowedLeftX = leftSiblingMaxX + 40 + (this.nodeWidth / 2);
        if (startX < minAllowedLeftX) startX = minAllowedLeftX;

        let currentX = startX;
        childIds.forEach((cId) => {
          const itemX = currentX;
          nodePosMap.set(cId, { id: cId, x: itemX, y: childY, isChild: true });
          const isSpouseExpanded = this.expandedRight.has(cId);
          if (isSpouseExpanded) {
            placeSpousesForNode(cId, itemX, childY);
            currentX += 500;
          } else {
            currentX += 220;
          }
        });

        // Recurse for deeper generations
        childIds.forEach(cId => {
          const cPerson = this.nodesMap.get(cId);
          if (cPerson) {
            const spouses = cPerson.spouseIds.filter(spId => this.nodesMap.has(spId));
            spouses.forEach(spId => {
              const cCoupleKey = [cId, spId].sort().join('__');
              if (this.expandedCouples.has(cCoupleKey)) {
                const coupleObj = couplePairs.find(c => c.key === cCoupleKey);
                if (coupleObj) placeChildrenRecursive([cId, spId], coupleObj.midX, coupleObj.midY);
              }
            });
          }
          if (this.expandedBottom.has(cId)) {
            const cPos = nodePosMap.get(cId);
            if (cPos) placeChildrenRecursive([cId], cPos.x, cPos.y);
          }
        });
      } else {
        // Group Badges Layout
        const groupY = (parentY === centerY) ? Math.max(parentY + 140, maxFocusSpouseY + (this.nodeHeight / 2) + 70) : parentY + 140;

        const groupList = Array.from(groupsMap.entries());
        const groupStepX = 260;
        const totalGroupW = (groupList.length - 1) * groupStepX;
        let startGroupX = anchorX - (totalGroupW / 2);

        groupList.forEach(([gName, gChildIds], gIdx) => {
          const displayName = gName || '기타';
          const gX = startGroupX + (gIdx * groupStepX);
          const fullGroupKey = `${coupleKey}__GROUP__${displayName}`;

          groupBadgeNodes.push({
            key: fullGroupKey,
            coupleKey,
            name: displayName,
            count: gChildIds.length,
            x: gX,
            y: groupY,
            parentY,
            parentX: anchorX
          });

          if (this.expandedGroups.has(fullGroupKey)) {
            const childY = groupY + 140;

            let totalRowWidth = 0;
            gChildIds.forEach((cId, idx) => {
              const isSpouseExpanded = this.expandedRight.has(cId);
              if (idx < gChildIds.length - 1) {
                totalRowWidth += isSpouseExpanded ? 500 : 220;
              } else {
                totalRowWidth += isSpouseExpanded ? 280 : 0;
              }
            });

            let startX = gX - (totalRowWidth / 2);
            let currentX = startX;

            gChildIds.forEach((cId) => {
              const itemX = currentX;
              nodePosMap.set(cId, { id: cId, x: itemX, y: childY, isChild: true, parentGroupKey: fullGroupKey });
              const isSpouseExpanded = this.expandedRight.has(cId);
              if (isSpouseExpanded) {
                placeSpousesForNode(cId, itemX, childY);
                currentX += 500;
              } else {
                currentX += 220;
              }
            });

            // Recurse for deeper generations
            gChildIds.forEach(cId => {
              const cPerson = this.nodesMap.get(cId);
              if (cPerson) {
                const spouses = cPerson.spouseIds.filter(spId => this.nodesMap.has(spId));
                spouses.forEach(spId => {
                  const cCoupleKey = [cId, spId].sort().join('__');
                  if (this.expandedCouples.has(cCoupleKey)) {
                    const coupleObj = couplePairs.find(c => c.key === cCoupleKey);
                    if (coupleObj) placeChildrenRecursive([cId, spId], coupleObj.midX, coupleObj.midY);
                  }
                });
              }
              if (this.expandedBottom.has(cId)) {
                const cPos = nodePosMap.get(cId);
                if (cPos) placeChildrenRecursive([cId], cPos.x, cPos.y);
              }
            });
          }
        });
      }
    };

    // Trigger children placement for focus couples & focus bottom children
    focusPerson.spouseIds.forEach(spId => {
      const coupleKey = [this.focusNodeId, spId].sort().join('__');
      if (this.expandedCouples.has(coupleKey)) {
        const coupleObj = couplePairs.find(c => c.key === coupleKey);
        if (coupleObj) {
          placeChildrenRecursive([this.focusNodeId, spId], coupleObj.midX, coupleObj.midY);
        }
      }
    });

    if (this.expandedBottom.has(this.focusNodeId)) {
      placeChildrenRecursive([this.focusNodeId], centerX, centerY);
    }

    nodePosMap.forEach(pos => {
      const person = this.nodesMap.get(pos.id);
      if (person) {
        layoutNodes.push({
          ...person,
          ...pos
        });
      }
    });

    return { nodes: layoutNodes, couples: couplePairs, groupBadges: groupBadgeNodes };
  }

  // 🌟 5. HTML 텍스트 노드 렌더링 (일부일처 배우자 우측화살표 ▶ 감춤 처리) 🌟
  renderNodes(layout) {
    this.nodesLayer.innerHTML = '';

    const renderedNodeIds = new Set(layout.nodes.map(n => n.id));

    layout.nodes.forEach(node => {
      const el = document.createElement('div');
      const genderClass = node.gender || 'male';
      el.className = `text-node gender-${genderClass} ${node.isFocus ? 'is-focus' : ''} ${this.isEditMode ? 'is-edit-mode' : ''}`;
      el.style.left = `${node.x - (this.nodeWidth / 2)}px`;
      el.style.top = `${node.y - (this.nodeHeight / 2)}px`;

      const effectiveParents = this.getEffectiveParentIds(node.id);
      const parentCount = effectiveParents.length;

      const siblings = new Set();
      effectiveParents.forEach(pId => {
        const pChildren = this.getChildIds(pId);
        pChildren.forEach(cId => { if (cId !== node.id) siblings.add(cId); });
      });
      const siblingCount = siblings.size;

      const validSpouses = node.spouseIds.filter(spId => this.nodesMap.has(spId));
      const spouseCount = validSpouses.length;

      const allNodeChildren = this.getChildIds(node.id);
      const trueSingleChildCount = allNodeChildren.filter(cId => {
        const childPerson = this.nodesMap.get(cId);
        if (!childPerson) return false;
        const validParents = this.getEffectiveParentIds(cId);
        return validParents.length <= 1;
      }).length;

      let directionalNodesHtml = '';

      if (this.isEditMode && node.isFocus) {
        directionalNodesHtml = `
          <button type="button" class="dir-node dir-top edit-plus" id="btnAddTop_${node.id}" title="부모 추가 (+)">
            ➕
          </button>
          <button type="button" class="dir-node dir-left edit-plus" id="btnAddLeft_${node.id}" title="형제자매 추가 (+)">
            ➕
          </button>
          <button type="button" class="dir-node dir-right edit-plus" id="btnAddRight_${node.id}" title="배우자 추가 (+)">
            ➕
          </button>
          <button type="button" class="dir-node dir-bottom edit-plus" id="btnAddBottom_${node.id}" title="단독 자식 추가 (+)">
            ➕
          </button>
        `;
      } else if (!this.isEditMode) {
        const isTopOpen = this.expandedTop.has(node.id);
        const isLeftOpen = this.expandedLeft.has(node.id);
        const isRightOpen = this.expandedRight.has(node.id);
        const isBottomOpen = this.expandedBottom.has(node.id);

        directionalNodesHtml = `
          ${parentCount > 0 ? `
            <button type="button" class="dir-node dir-top ${isTopOpen ? 'open' : ''}" id="dirTop_${node.id}" title="${node.name}의 부모 (${parentCount}명)">
              ▲
            </button>
          ` : ''}
          ${siblingCount > 0 ? `
            <button type="button" class="dir-node dir-left ${isLeftOpen ? 'open' : ''}" id="dirLeft_${node.id}" title="${node.name}의 형제자매 (${siblingCount}명)">
              ◀
            </button>
          ` : ''}
          ${spouseCount > 0 ? `
            <button type="button" class="dir-node dir-right ${isRightOpen ? 'open' : ''}" id="dirRight_${node.id}" title="${node.name}의 배우자 (${spouseCount}명)">
              ▶
            </button>
          ` : ''}
          ${trueSingleChildCount > 0 ? `
            <button type="button" class="dir-node dir-bottom ${isBottomOpen ? 'open' : ''}" id="dirBottom_${node.id}" title="${node.name}의 단독 자식 (${trueSingleChildCount}명)">
              ▼
            </button>
          ` : ''}
        `;
      }

      // 그리스 / 로마 표기 모드에 따른 이름 표시 결정
      let mainName = node.name;
      let subName = "";
      const isGreekDataset = (this.currentDatasetKey === 'greek');

      if (isGreekDataset) {
        const roman = node.nameRoman || "";
        const greekEng = node.nameEng || "";
        if (this.mythNameMode === 'both') {
          mainName = node.name;
          if (roman) {
            subName = `🏛️ ${roman}`;
          } else if (greekEng) {
            subName = greekEng;
          }
        } else if (this.mythNameMode === 'roman') {
          mainName = roman || node.name;
          if (roman) {
            subName = `🇬🇷 ${node.name}`;
          } else if (greekEng) {
            subName = greekEng;
          }
        } else if (this.mythNameMode === 'greek') {
          mainName = node.name;
          if (greekEng) {
            subName = `🇬🇷 ${greekEng}`;
          }
        }
      }

      // 복수 부모 전승 뱃지 (상단에 📜 표시)
      let traditionBadgeHtml = '';
      if (!this.isEditMode && node.parentVariants && node.parentVariants.length > 1) {
        const activeVarId = this.activeParentVariants.get(node.id);
        const activeVar = node.parentVariants.find(v => v.id === activeVarId) || node.parentVariants[0];
        let varLabel = '전승';
        if (activeVar && activeVar.source) {
          varLabel = activeVar.source.split(' ')[0] || '전승';
        }
        traditionBadgeHtml = `
          <button type="button" class="text-node-tradition-btn ${parentCount > 0 ? 'has-dir-top' : ''}" id="btnTradition_${node.id}" title="부모 전승 변경 (클릭)">
            📜 ${this.escapeHtml(varLabel)} ▾
          </button>
        `;
      }

      el.innerHTML = `
        ${directionalNodesHtml}
        ${traditionBadgeHtml}
        <div class="text-node-content" id="textContent_${node.id}">
          <span class="text-node-name">${this.escapeHtml(mainName)}</span>
          ${subName ? `<span class="text-node-subname">${this.escapeHtml(subName)}</span>` : ''}
          ${node.title ? `<span class="text-node-title">(${this.escapeHtml(node.title)})</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:2px;">
          <button type="button" class="btn-node-edit" id="btnQuickEdit_${node.id}" title="이름 및 성별 수정">
            ✏️
          </button>
          <button type="button" class="btn-info-icon" id="btnInfo_${node.id}" title="구글 AI 검색하기">
            ℹ️
          </button>
        </div>
      `;

      this.nodesLayer.appendChild(el);

      const btnTradition = el.querySelector(`#btnTradition_${node.id}`);
      if (btnTradition) {
        this.preventDrag(btnTradition);
        btnTradition.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openTraditionPopover(node.id, btnTradition);
        });
      }

      const btnQuickEdit = el.querySelector(`#btnQuickEdit_${node.id}`);
      if (btnQuickEdit) {
        this.preventDrag(btnQuickEdit);
        btnQuickEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openQuickEditModal(node.id);
        });
      }

      if (this.isEditMode && node.isFocus) {
        const btnAddTop = el.querySelector(`#btnAddTop_${node.id}`);
        if (btnAddTop) {
          this.preventDrag(btnAddTop);
          btnAddTop.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openQuickAddModal('parent', node.id);
          });
        }

        const btnAddLeft = el.querySelector(`#btnAddLeft_${node.id}`);
        if (btnAddLeft) {
          this.preventDrag(btnAddLeft);
          btnAddLeft.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openQuickAddModal('sibling', node.id);
          });
        }

        const btnAddRight = el.querySelector(`#btnAddRight_${node.id}`);
        if (btnAddRight) {
          this.preventDrag(btnAddRight);
          btnAddRight.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openQuickAddModal('spouse', node.id);
          });
        }

        const btnAddBottom = el.querySelector(`#btnAddBottom_${node.id}`);
        if (btnAddBottom) {
          this.preventDrag(btnAddBottom);
          btnAddBottom.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openQuickAddModal('singleChild', node.id);
          });
        }
      } else if (!this.isEditMode) {
        const btnTop = el.querySelector(`#dirTop_${node.id}`);
        if (btnTop) {
          this.preventDrag(btnTop);
          btnTop.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.expandedTop.has(node.id)) this.expandedTop.delete(node.id);
            else this.expandedTop.add(node.id);
            this.render();
          });
        }

        const btnLeft = el.querySelector(`#dirLeft_${node.id}`);
        if (btnLeft) {
          this.preventDrag(btnLeft);
          btnLeft.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.expandedLeft.has(node.id)) this.expandedLeft.delete(node.id);
            else this.expandedLeft.add(node.id);
            this.render();
          });
        }

        const btnRight = el.querySelector(`#dirRight_${node.id}`);
        if (btnRight) {
          this.preventDrag(btnRight);
          btnRight.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.expandedRight.has(node.id)) {
              this.expandedRight.delete(node.id);
            } else {
              this.expandedRight.add(node.id);
            }
            this.render();
          });
        }

        const btnBottom = el.querySelector(`#dirBottom_${node.id}`);
        if (btnBottom) {
          this.preventDrag(btnBottom);
          btnBottom.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.expandedBottom.has(node.id)) this.expandedBottom.delete(node.id);
            else this.expandedBottom.add(node.id);
            this.render();
          });
        }
      }

      const btnInfo = el.querySelector(`#btnInfo_${node.id}`);
      if (btnInfo) {
        this.preventDrag(btnInfo);
        btnInfo.addEventListener('click', (e) => {
          e.stopPropagation();
          const query = `${node.name} ${node.title || ''}`.trim();
          window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
        });
      }

      const textContent = el.querySelector(`#textContent_${node.id}`);
      if (textContent) {
        this.preventDrag(textContent);
        textContent.addEventListener('click', (e) => {
          e.stopPropagation();
          this.setFocusPerson(node.id);
        });
      }
    });

    layout.couples.forEach(couple => {
      const commonChildren = this.getCommonChildren(couple.p1, couple.p2);
      const isOpen = this.expandedCouples.has(couple.key);

      const p1 = this.nodesMap.get(couple.p1);
      const p2 = this.nodesMap.get(couple.p2);
      const cLabel = `${p1 ? p1.name : ''} & ${p2 ? p2.name : ''}`;

      const coupleBtn = document.createElement('button');
      coupleBtn.type = 'button';

      if (this.isEditMode) {
        coupleBtn.className = `couple-node-btn edit-couple-plus`;
        coupleBtn.style.left = `${couple.midX - 14}px`;
        coupleBtn.style.top = `${couple.midY - 14}px`;
        coupleBtn.title = `${cLabel} 부부 사이의 자식 추가 (+)`;
        coupleBtn.innerHTML = '➕';

        this.preventDrag(coupleBtn);
        coupleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openQuickAddModal('coupleChild', { p1Id: couple.p1, p2Id: couple.p2, coupleKey: couple.key });
        });
      } else {
        if (commonChildren.length > 0) {
          coupleBtn.className = `couple-node-btn ${isOpen ? 'open' : ''}`;
          coupleBtn.style.left = `${couple.midX - 14}px`;
          coupleBtn.style.top = `${couple.midY - 14}px`;
          coupleBtn.title = `자식 보기 (${commonChildren.length}명)`;
          coupleBtn.innerHTML = isOpen ? '▼' : '👶';

          this.preventDrag(coupleBtn);
          coupleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.expandedCouples.has(couple.key)) {
              this.expandedCouples.delete(couple.key);
            } else {
              // 동일 인물의 다른 부부 자식 보기가 열려있는 경우 해제하여 해당 자식의 어머니만 표시
              for (const existingKey of Array.from(this.expandedCouples)) {
                const parts = existingKey.split('__');
                if (parts.includes(couple.p1) || parts.includes(couple.p2)) {
                  this.expandedCouples.delete(existingKey);
                }
              }
              this.expandedCouples.add(couple.key);
            }
            this.render();
          });
        }
      }

      if (this.isEditMode || commonChildren.length > 0) {
        this.nodesLayer.appendChild(coupleBtn);
      }
    });

    if (layout.groupBadges) {
      layout.groupBadges.forEach(badge => {
        const isOpen = this.expandedGroups.has(badge.key);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `group-badge-btn ${isOpen ? 'open' : ''}`;
        btn.style.left = `${badge.x - 70}px`;
        btn.style.top = `${badge.y - 18}px`;
        btn.title = `${badge.name} (${badge.count}명) 펼치기/접기`;

        let icon = '🏛️';
        if (badge.name.includes('퀴클롭스')) icon = '👁️';
        else if (badge.name.includes('헤카톤케이레스')) icon = '✋';
        else if (badge.name.includes('그룹')) icon = '👶';

        btn.innerHTML = `${icon} ${this.escapeHtml(badge.name)} (${badge.count}명) ${isOpen ? '▼' : '▶'}`;

        this.preventDrag(btn);
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.expandedGroups.has(badge.key)) {
            this.expandedGroups.delete(badge.key);
          } else {
            this.expandedGroups.add(badge.key);
          }
          this.render();
        });

        this.nodesLayer.appendChild(btn);
      });
    }
  }

  // ── 새 가계도 생성 모달 이벤트 바인딩 ──
  bindCreateDatasetModalEvents() {
    if (this.btnCreateDatasetCancel) {
      this.btnCreateDatasetCancel.addEventListener('click', () => this.closeCreateDatasetModal());
    }
    if (this.btnCreateDatasetClose) {
      this.btnCreateDatasetClose.addEventListener('click', () => this.closeCreateDatasetModal());
    }

    if (this.createDatasetForm) {
      this.createDatasetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = this.newDatasetTitle.value.trim();
        const firstPersonName = this.newDatasetFirstPersonName.value.trim();
        const firstPersonGender = this.newDatasetFirstPersonGender.value;

        if (!title || !firstPersonName) return;

        const newDatasetId = `ds_${Date.now()}`;

        if (supabaseClient) {
          const { error: dsErr } = await supabaseClient.from('genealogy_datasets').upsert({
            id: newDatasetId,
            title: title,
            description: '신규 생성 가계도'
          });

          if (dsErr) {
            alert(`가계도 생성 실패: ${dsErr.message}`);
            return;
          }

          const firstPersonId = `${newDatasetId}_1`;
          const { error: nodeErr } = await supabaseClient.from('genealogy_nodes').upsert({
            id: firstPersonId,
            dataset_id: newDatasetId,
            name: firstPersonName,
            name_eng: '',
            title: '',
            gender: firstPersonGender,
            info: '',
            parent_ids: [],
            spouse_ids: [],
            updated_at: new Date().toISOString()
          });

          if (nodeErr) {
            alert(`시조 인물 생성 실패: ${nodeErr.message}`);
            return;
          }
        }

        await this.fetchDatasetsFromDB();
        await this.loadDataset(newDatasetId, true);

        this.closeCreateDatasetModal();
      });
    }
  }

  openCreateDatasetModal() {
    if (this.newDatasetTitle) this.newDatasetTitle.value = '';
    if (this.newDatasetFirstPersonName) this.newDatasetFirstPersonName.value = '';
    if (this.newDatasetFirstPersonGender) this.newDatasetFirstPersonGender.value = 'male';

    this.createDatasetModal.classList.add('active');

    setTimeout(() => {
      if (this.newDatasetTitle) this.newDatasetTitle.focus();
    }, 100);
  }

  closeCreateDatasetModal() {
    if (this.createDatasetModal) {
      this.createDatasetModal.classList.remove('active');
    }
    this.renderDatasetSelectOptions();
  }

  openQuickAddModal(type, targetData) {
    this.pendingQuickAddAction = { type, targetData };
    const focusPerson = typeof targetData === 'string' ? this.nodesMap.get(targetData) : null;
    const focusName = focusPerson ? focusPerson.name : '';

    let defaultGender = 'male';

    if (type === 'parent') {
      this.quickAddTitle.innerText = `부모 인물 추가 (${focusName})`;
      this.quickAddSubtitle.innerText = `'${focusName}'의 부모 이름과 성별을 입력하고 + 버튼으로 행을 늘리세요.`;
      defaultGender = 'male';
    } else if (type === 'sibling') {
      this.quickAddTitle.innerText = `형제자매 추가 (${focusName})`;
      this.quickAddSubtitle.innerText = `'${focusName}'의 형제자매 이름과 성별을 입력하세요.`;
      defaultGender = 'male';
    } else if (type === 'spouse') {
      this.quickAddTitle.innerText = `배우자 추가 (${focusName})`;
      this.quickAddSubtitle.innerText = `'${focusName}'의 배우자 이름과 성별을 입력하세요.`;
      defaultGender = (focusPerson && focusPerson.gender === 'male') ? 'female' : 'male';
    } else if (type === 'singleChild') {
      this.quickAddTitle.innerText = `단독 자식 추가 (${focusName})`;
      this.quickAddSubtitle.innerText = `'${focusName}'의 자식 이름과 성별을 입력하세요.`;
      defaultGender = 'male';
    } else if (type === 'coupleChild') {
      const p1 = this.nodesMap.get(targetData.p1Id);
      const p2 = this.nodesMap.get(targetData.p2Id);
      const coupleTitle = `${p1 ? p1.name : ''} & ${p2 ? p2.name : ''}`;
      this.quickAddTitle.innerText = `부부 자식 추가 (${coupleTitle})`;
      this.quickAddSubtitle.innerText = `'${coupleTitle}' 부부 사이의 자식 이름과 성별을 입력하세요.`;
      defaultGender = 'male';
    }

    this.updateQuickAddDatalist();
    this.quickAddRowsContainer.innerHTML = '';
    this.addQuickAddRow('', defaultGender);

    this.quickAddModal.classList.add('active');

    setTimeout(() => {
      const firstInput = this.quickAddRowsContainer.querySelector('.quick-name-input');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  addQuickAddRow(name = '', gender = 'male') {
    const row = document.createElement('div');
    row.className = 'quick-add-row';
    row.style.cssText = 'display:flex; gap:10px; margin-bottom:10px; align-items:center;';
    row.innerHTML = `
      <input type="text" class="form-control quick-name-input" list="quickAddPersonDatalist" value="${this.escapeHtml(name)}" placeholder="이름 입력 (기존 인물 추천)" style="flex:2;" autocomplete="off" />
      <select class="form-control quick-gender-select" style="flex:1.2;">
        <option value="male" ${gender === 'male' ? 'selected' : ''}>남성 ▼</option>
        <option value="female" ${gender === 'female' ? 'selected' : ''}>여성 ▼</option>
        <option value="genderless" ${gender === 'genderless' ? 'selected' : ''}>중성 ▼</option>
      </select>
    `;

    const nameInput = row.querySelector('.quick-name-input');
    const genderSelect = row.querySelector('.quick-gender-select');

    if (nameInput && genderSelect) {
      nameInput.addEventListener('input', () => {
        const val = nameInput.value.trim();
        if (!val) return;
        const normVal = val.replace(/\s+/g, '').toLowerCase();

        for (const p of this.nodesMap.values()) {
          const normName = (p.name || '').replace(/\s+/g, '').toLowerCase();
          if (normName === normVal) {
            genderSelect.value = p.gender || 'male';
            break;
          }
        }
      });
    }

    this.quickAddRowsContainer.appendChild(row);
  }

  closeQuickAddModal() {
    if (this.quickAddModal) {
      this.quickAddModal.classList.remove('active');
    }
    this.pendingQuickAddAction = null;
  }

  bindQuickAddModalEvents() {
    if (this.btnQuickAddCancel) {
      this.btnQuickAddCancel.addEventListener('click', () => this.closeQuickAddModal());
    }
    if (this.btnQuickAddClose) {
      this.btnQuickAddClose.addEventListener('click', () => this.closeQuickAddModal());
    }

    if (this.btnAddQuickRow) {
      this.btnAddQuickRow.addEventListener('click', () => {
        this.addQuickAddRow('', 'male');
        const inputs = this.quickAddRowsContainer.querySelectorAll('.quick-name-input');
        if (inputs.length > 0) {
          inputs[inputs.length - 1].focus();
        }
      });
    }

    if (this.btnQuickAddSubmit) {
      this.btnQuickAddSubmit.addEventListener('click', () => this.executeBatchRowsAdd());
    }
  }

  async executeBatchRowsAdd() {
    if (!this.pendingQuickAddAction) return;

    const rowEls = Array.from(this.quickAddRowsContainer.querySelectorAll('.quick-add-row'));
    const itemsToAdd = [];

    rowEls.forEach(row => {
      const nameInput = row.querySelector('.quick-name-input');
      const genderSelect = row.querySelector('.quick-gender-select');
      if (nameInput && nameInput.value.trim()) {
        itemsToAdd.push({
          name: nameInput.value.trim(),
          gender: genderSelect ? genderSelect.value : 'male'
        });
      }
    });

    if (itemsToAdd.length === 0) {
      this.closeQuickAddModal();
      return;
    }

    const { type, targetData } = this.pendingQuickAddAction;

    if (type === 'parent') {
      const focusId = targetData;
      const focusPerson = this.nodesMap.get(focusId);

      if (focusPerson) {
        for (const item of itemsToAdd) {
          const parentId = this.findOrCreatePersonByNameOrId(item.name, item.gender);
          const parentPerson = this.nodesMap.get(parentId);
          if (parentId && parentPerson) {
            if (!focusPerson.parentIds.includes(parentId)) focusPerson.parentIds.push(parentId);
            await this.savePersonToDB(parentId);
          }
        }
        await this.savePersonToDB(focusId);
        this.expandedTop.add(focusId);
      }
    } else if (type === 'sibling') {
      const focusId = targetData;
      const focusPerson = this.nodesMap.get(focusId);

      if (focusPerson) {
        for (const item of itemsToAdd) {
          const sibId = this.findOrCreatePersonByNameOrId(item.name, item.gender);
          const sibPerson = this.nodesMap.get(sibId);
          if (sibId && sibPerson) {
            focusPerson.parentIds.forEach(pId => {
              if (!sibPerson.parentIds.includes(pId)) sibPerson.parentIds.push(pId);
              this.savePersonToDB(pId);
            });
            await this.savePersonToDB(sibId);
          }
        }
        await this.savePersonToDB(focusId);
        this.expandedLeft.add(focusId);
      }
    } else if (type === 'spouse') {
      const focusId = targetData;
      const focusPerson = this.nodesMap.get(focusId);

      if (focusPerson) {
        for (const item of itemsToAdd) {
          const spouseId = this.findOrCreatePersonByNameOrId(item.name, item.gender);
          const spousePerson = this.nodesMap.get(spouseId);
          if (spouseId && spousePerson) {
            if (!focusPerson.spouseIds.includes(spouseId)) focusPerson.spouseIds.push(spouseId);
            if (!spousePerson.spouseIds.includes(focusId)) spousePerson.spouseIds.push(focusId);
            await this.savePersonToDB(spouseId);
          }
        }
        await this.savePersonToDB(focusId);
        this.expandedRight.add(focusId);
      }
    } else if (type === 'singleChild') {
      const focusId = targetData;
      const focusPerson = this.nodesMap.get(focusId);

      if (focusPerson) {
        for (const item of itemsToAdd) {
          const childId = this.findOrCreatePersonByNameOrId(item.name, item.gender);
          const childPerson = this.nodesMap.get(childId);
          if (childId && childPerson) {
            if (!childPerson.parentIds.includes(focusId)) childPerson.parentIds.push(focusId);
            await this.savePersonToDB(childId);
          }
        }
        await this.savePersonToDB(focusId);
        this.expandedBottom.add(focusId);
      }
    } else if (type === 'coupleChild') {
      const { p1Id, p2Id, coupleKey } = targetData;
      const p1 = this.nodesMap.get(p1Id);
      const p2 = this.nodesMap.get(p2Id);

      for (const item of itemsToAdd) {
        const childId = this.findOrCreatePersonByNameOrId(item.name, item.gender);
        const childPerson = this.nodesMap.get(childId);
        if (childId && childPerson) {
          if (!childPerson.parentIds.includes(p1Id)) childPerson.parentIds.push(p1Id);
          if (!childPerson.parentIds.includes(p2Id)) childPerson.parentIds.push(p2Id);
          await this.savePersonToDB(childId);
        }
      }
      if (p1) await this.savePersonToDB(p1Id);
      if (p2) await this.savePersonToDB(p2Id);
      this.expandedCouples.add(coupleKey);
    }

    this.sanitizeRelationships();
    this.closeQuickAddModal();
    this.render();
  }

  // ── 7.2 복수 부모 전승(이설) 편집 카드 생성 및 이벤트 관리 ──
  renderQuickEditVariantCard(variant, idx, isLoggedIn) {
    let parentNamesStr = "";
    if (Array.isArray(variant.parent_ids) && variant.parent_ids.length > 0) {
      parentNamesStr = variant.parent_ids.map(pId => {
        const p = this.nodesMap.get(pId);
        return p ? p.name : pId;
      }).filter(Boolean).join(', ');
    } else if (Array.isArray(variant.parentNames) && variant.parentNames.length > 0) {
      parentNamesStr = variant.parentNames.join(', ');
    } else if (typeof variant.parentNamesStr === 'string') {
      parentNamesStr = variant.parentNamesStr;
    }

    const vId = variant.id || `var_${Date.now()}_${idx}`;
    const isPrimary = !!variant.is_primary;
    const disabledAttr = isLoggedIn ? '' : 'disabled';

    return `
      <div class="variant-edit-card ${isPrimary ? 'is-primary' : ''}" data-variant-id="${this.escapeHtml(vId)}">
        <div class="variant-edit-header">
          <label class="variant-primary-label" title="기본 통설(대표 계보)로 지정">
            <input type="radio" name="quickEditPrimaryVariant" value="${this.escapeHtml(vId)}" ${isPrimary ? 'checked' : ''} ${disabledAttr} />
            <span>기본 통설 (대표 계보)</span>
            <span class="variant-primary-badge" style="font-size:10px; color:#2563eb; font-weight:700; background:#dbeafe; padding:1px 6px; border-radius:4px; display:${isPrimary ? 'inline' : 'none'};">기본</span>
          </label>
          ${isLoggedIn ? `
            <button type="button" class="variant-delete-btn" title="이 전승 삭제">
              🗑️ 삭제
            </button>
          ` : ''}
        </div>
        <div class="variant-fields-grid">
          <div class="variant-field-group">
            <label class="variant-field-label">출처 / 전승명</label>
            <input type="text" class="variant-input variant-source-input" value="${this.escapeHtml(variant.source || '')}" placeholder="예: 헤시오도스 《신통기》" ${disabledAttr} />
          </div>
          <div class="variant-field-group">
            <label class="variant-field-label">부모 (쉼표 , 구분)</label>
            <input type="text" class="variant-input variant-parents-input" value="${this.escapeHtml(parentNamesStr)}" list="quickAddPersonDatalist" placeholder="예: 우라노스 (단독 탄생이면 비움)" autocomplete="off" ${disabledAttr} />
          </div>
        </div>
        <div class="variant-field-group">
          <label class="variant-field-label">설화 배경 / 부연 설명 (선택)</label>
          <input type="text" class="variant-input variant-info-input" value="${this.escapeHtml(variant.info || '')}" placeholder="예: 바다 거품에서 탄생 (어머니 없음)" ${disabledAttr} />
        </div>
      </div>
    `;
  }

  attachVariantCardEvents(cardEl, isLoggedIn) {
    if (!cardEl) return;

    // 1. 라디오 버튼 변경: 대표 전승 전환
    const radio = cardEl.querySelector('input[name="quickEditPrimaryVariant"]');
    if (radio) {
      radio.addEventListener('change', () => {
        if (!this.quickEditVariantsList) return;
        const allCards = this.quickEditVariantsList.querySelectorAll('.variant-edit-card');
        allCards.forEach(c => {
          c.classList.remove('is-primary');
          const badge = c.querySelector('.variant-primary-badge');
          if (badge) badge.style.display = 'none';
        });

        cardEl.classList.add('is-primary');
        const badge = cardEl.querySelector('.variant-primary-badge');
        if (badge) badge.style.display = 'inline';

        const parentsInput = cardEl.querySelector('.variant-parents-input');
        if (parentsInput && this.quickEditParents) {
          this.quickEditParents.value = parentsInput.value.trim();
        }
      });
    }

    // 2. 기본 통설 카드 부모 입력 시 메인 부모 필드 자동 동기화
    const parentsInput = cardEl.querySelector('.variant-parents-input');
    if (parentsInput) {
      parentsInput.addEventListener('input', () => {
        if (cardEl.classList.contains('is-primary') && this.quickEditParents) {
          this.quickEditParents.value = parentsInput.value.trim();
        }
      });
    }

    // 3. 삭제 버튼
    const deleteBtn = cardEl.querySelector('.variant-delete-btn');
    if (deleteBtn && isLoggedIn) {
      deleteBtn.addEventListener('click', () => {
        const wasPrimary = cardEl.classList.contains('is-primary');
        cardEl.remove();

        if (this.quickEditVariantsList) {
          const remainingCards = this.quickEditVariantsList.querySelectorAll('.variant-edit-card');
          if (wasPrimary && remainingCards.length > 0) {
            const firstCard = remainingCards[0];
            firstCard.classList.add('is-primary');
            const firstRadio = firstCard.querySelector('input[name="quickEditPrimaryVariant"]');
            if (firstRadio) firstRadio.checked = true;
            const firstBadge = firstCard.querySelector('.variant-primary-badge');
            if (firstBadge) firstBadge.style.display = 'inline';

            const firstParents = firstCard.querySelector('.variant-parents-input');
            if (firstParents && this.quickEditParents) {
              this.quickEditParents.value = firstParents.value.trim();
            }
          }
        }
      });
    }
  }

  populateQuickEditVariants(variants, isLoggedIn) {
    if (!this.quickEditVariantsList) return;
    this.quickEditVariantsList.innerHTML = (variants || []).map((v, idx) => {
      return this.renderQuickEditVariantCard(v, idx, isLoggedIn);
    }).join('');

    const cards = this.quickEditVariantsList.querySelectorAll('.variant-edit-card');
    cards.forEach(c => this.attachVariantCardEvents(c, isLoggedIn));
  }

  addNewVariantCard(initialData = null) {
    if (!this.quickEditVariantsList) return;
    const existingCards = this.quickEditVariantsList.querySelectorAll('.variant-edit-card');
    const isFirst = existingCards.length === 0;

    const newVariant = initialData || {
      id: `var_${Date.now()}_${existingCards.length + 1}`,
      source: '',
      parent_ids: [],
      info: '',
      is_primary: isFirst
    };

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = this.renderQuickEditVariantCard(newVariant, existingCards.length, !!this.currentUser);
    const newCard = tempDiv.firstElementChild;
    if (!newCard) return;

    this.quickEditVariantsList.appendChild(newCard);
    this.attachVariantCardEvents(newCard, !!this.currentUser);

    const srcInput = newCard.querySelector('.variant-source-input');
    if (srcInput) srcInput.focus();
  }

  // 카드 ✏️ 수정 모달 열기
  openQuickEditModal(personId) {
    const person = this.nodesMap.get(personId);
    if (!person) return;

    this.updateQuickAddDatalist();

    if (this.quickEditId) this.quickEditId.value = person.id;
    if (this.quickEditName) this.quickEditName.value = person.name || '';
    if (this.quickEditNameEng) this.quickEditNameEng.value = person.nameEng || '';
    if (this.quickEditTitle) this.quickEditTitle.value = person.title || '';
    if (this.quickEditGroup) this.quickEditGroup.value = person.groupName || '';
    if (this.quickEditGender) this.quickEditGender.value = person.gender || 'male';
    if (this.quickEditInfo) this.quickEditInfo.value = person.info || '';

    if (this.quickEditParents) {
      const parentNames = (person.parentIds || []).map(pId => {
        const p = this.nodesMap.get(pId);
        return p ? p.name : '';
      }).filter(Boolean);
      this.quickEditParents.value = parentNames.join(', ');
    }

    if (this.quickEditSpouses) {
      const spouseNames = (person.spouseIds || []).map(sId => {
        const p = this.nodesMap.get(sId);
        return p ? p.name : '';
      }).filter(Boolean);
      this.quickEditSpouses.value = spouseNames.join(', ');
    }

    if (this.quickEditNameRoman) this.quickEditNameRoman.value = person.nameRoman || '';
    if (this.quickEditNameRomanEng) this.quickEditNameRomanEng.value = person.nameRomanEng || '';

    const isLoggedIn = !!this.currentUser;

    // 복수 부모 전승(설화) 목록 표시 및 편집 박스 렌더링
    if (this.quickEditVariantsGroup && this.quickEditVariantsList) {
      if (person.parentVariants && person.parentVariants.length > 0) {
        this.quickEditVariantsGroup.style.display = 'block';
        if (this.btnToggleVariants) this.btnToggleVariants.textContent = '📜 복수 부모 전승 접기 ▴';
        this.populateQuickEditVariants(person.parentVariants, isLoggedIn);
      } else {
        this.quickEditVariantsGroup.style.display = 'none';
        if (this.btnToggleVariants) this.btnToggleVariants.textContent = '📜 복수 부모 전승(이설) 관리 ▾';
        this.quickEditVariantsList.innerHTML = '';
      }
    }

    if (this.btnQuickEditAddVariant) {
      this.btnQuickEditAddVariant.style.display = isLoggedIn ? 'inline-block' : 'none';
    }

    const titleEl = document.getElementById('quickEditModalTitle');
    const subtitleEl = document.getElementById('quickEditModalSubtitle');
    const loggedInActions = document.getElementById('quickEditLoggedInActions');
    const loggedOutActions = document.getElementById('quickEditLoggedOutActions');
    const formInputs = [
      this.quickEditName, this.quickEditNameEng, this.quickEditNameRoman, this.quickEditNameRomanEng,
      this.quickEditParents, this.quickEditSpouses, this.quickEditTitle, this.quickEditGender, this.quickEditInfo
    ];

    if (titleEl) titleEl.textContent = '정보 수정';
    if (this.btnQuickEditDelete) this.btnQuickEditDelete.style.display = isLoggedIn ? 'inline-block' : 'none';
    if (this.btnQuickEditSubmit) this.btnQuickEditSubmit.textContent = '💾 저장하기';

    if (isLoggedIn) {
      if (subtitleEl) subtitleEl.textContent = '이름, 영문명, 로마명, 관계, 칭호, 성별, 설명을 수정하여 DB에 반영합니다.';
      if (loggedInActions) loggedInActions.style.display = 'flex';
      if (loggedOutActions) loggedOutActions.style.display = 'none';
      formInputs.forEach(input => { if (input) input.disabled = false; });
    } else {
      if (subtitleEl) subtitleEl.textContent = '인물 상세 정보입니다. (수정하려면 상단 로그인 필요)';
      if (loggedInActions) loggedInActions.style.display = 'none';
      if (loggedOutActions) loggedOutActions.style.display = 'flex';
      formInputs.forEach(input => { if (input) input.disabled = true; });
    }

    this.quickEditModal.classList.add('active');

    setTimeout(() => {
      if (isLoggedIn && this.quickEditName) this.quickEditName.focus();
    }, 100);
  }

  // 🌟 신규 인물 추가 전용 모달 열기 (검색 결과 없을 때 연동) 🌟
  openCreatePersonModal(initialName = '') {
    this.updateQuickAddDatalist();

    if (this.quickEditId) this.quickEditId.value = '';
    if (this.quickEditName) this.quickEditName.value = initialName;
    if (this.quickEditNameEng) this.quickEditNameEng.value = '';

    // 그리스 로마 신화 가계도일 경우 신명 사전 자동 매핑
    const syn = (this.currentDatasetKey === 'greek') ? (MYTHOLOGY_SYNCRETISM_MAP[initialName] || {}) : {};
    if (this.quickEditNameRoman) this.quickEditNameRoman.value = syn.roman || '';
    if (this.quickEditNameRomanEng) this.quickEditNameRomanEng.value = syn.romanEng || '';

    if (this.quickEditParents) this.quickEditParents.value = '';
    if (this.quickEditSpouses) this.quickEditSpouses.value = '';
    if (this.quickEditTitle) this.quickEditTitle.value = '';
    if (this.quickEditGroup) this.quickEditGroup.value = '';
    if (this.quickEditGender) this.quickEditGender.value = 'male';
    if (this.quickEditInfo) this.quickEditInfo.value = '';

    // 복수 부모 전승 접기 및 초기화
    if (this.quickEditVariantsGroup && this.quickEditVariantsList) {
      this.quickEditVariantsGroup.style.display = 'none';
      if (this.btnToggleVariants) this.btnToggleVariants.textContent = '📜 복수 부모 전승(이설) 관리 ▾';
      this.quickEditVariantsList.innerHTML = '';
    }
    if (this.btnQuickEditAddVariant) {
      this.btnQuickEditAddVariant.style.display = 'inline-block';
    }

    const titleEl = document.getElementById('quickEditModalTitle');
    const subtitleEl = document.getElementById('quickEditModalSubtitle');
    const loggedInActions = document.getElementById('quickEditLoggedInActions');
    const loggedOutActions = document.getElementById('quickEditLoggedOutActions');
    const formInputs = [
      this.quickEditName, this.quickEditNameEng, this.quickEditNameRoman, this.quickEditNameRomanEng,
      this.quickEditParents, this.quickEditSpouses, this.quickEditTitle, this.quickEditGender, this.quickEditInfo
    ];

    if (titleEl) titleEl.textContent = '✨ 새 인물 추가';
    if (subtitleEl) subtitleEl.textContent = initialName 
      ? `'${initialName}' 인물의 기본 정보와 부모/배우자 관계를 입력하여 추가합니다.`
      : '새로운 인물의 기본 정보와 부모/배우자 관계를 입력하여 추가합니다.';

    if (this.btnQuickEditDelete) this.btnQuickEditDelete.style.display = 'none';
    if (this.btnQuickEditSubmit) this.btnQuickEditSubmit.textContent = '💾 추가하기';

    if (loggedInActions) loggedInActions.style.display = 'flex';
    if (loggedOutActions) loggedOutActions.style.display = 'none';
    formInputs.forEach(input => { if (input) input.disabled = false; });

    this.quickEditModal.classList.add('active');

    setTimeout(() => {
      if (this.quickEditName) {
        if (!initialName) {
          this.quickEditName.focus();
        } else if (this.quickEditParents) {
          this.quickEditParents.focus();
        }
      }
    }, 100);
  }

  closeQuickEditModal() {
    if (this.quickEditModal) {
      this.quickEditModal.classList.remove('active');
    }
  }

  // 인물 정보 수정 & 🗑️ DB 삭제 처리 바인딩
  bindQuickEditModalEvents() {
    if (this.btnQuickEditCancel) {
      this.btnQuickEditCancel.addEventListener('click', () => this.closeQuickEditModal());
    }
    if (this.btnQuickEditClose) {
      this.btnQuickEditClose.addEventListener('click', () => this.closeQuickEditModal());
    }
    const btnQuickEditCloseOnly = document.getElementById('btnQuickEditCloseOnly');
    if (btnQuickEditCloseOnly) {
      btnQuickEditCloseOnly.addEventListener('click', () => this.closeQuickEditModal());
    }

    if (this.btnQuickEditDelete) {
      this.btnQuickEditDelete.addEventListener('click', async () => {
        if (!this.currentUser) return;
        const deleteId = this.quickEditId.value;
        const person = this.nodesMap.get(deleteId);
        if (!person) return;

        if (confirm(`'${person.name}' 인물을 가계도 및 Supabase DB에서 정말로 삭제하시겠습니까?`)) {
          this.nodesMap.delete(deleteId);

          for (const [id, p] of this.nodesMap.entries()) {
            let updated = false;
            if (p.parentIds.includes(deleteId)) { p.parentIds = p.parentIds.filter(x => x !== deleteId); updated = true; }
            if (p.spouseIds.includes(deleteId)) { p.spouseIds = p.spouseIds.filter(x => x !== deleteId); updated = true; }

            if (updated && supabaseClient) {
              await supabaseClient.from('genealogy_nodes').update({
                parent_ids: p.parentIds,
                spouse_ids: p.spouseIds,
                updated_at: new Date().toISOString()
              }).eq('id', id);
            }
          }

          this.sanitizeRelationships();

          if (supabaseClient) {
            await supabaseClient.from('genealogy_nodes').delete().eq('id', deleteId);
          }

          this.closeQuickEditModal();

          if (this.focusNodeId === deleteId) {
            if (this.nodesMap.size > 0) {
              const nextFocusId = Array.from(this.nodesMap.keys())[0];
              this.setFocusPerson(nextFocusId);
            } else {
              this.resetGraphState();
              this.render();
            }
          } else {
            this.render();
          }
        }
      });
    }

    if (this.btnToggleVariants) {
      this.btnToggleVariants.addEventListener('click', () => {
        if (!this.quickEditVariantsGroup) return;
        const isCurrentlyHidden = (this.quickEditVariantsGroup.style.display === 'none' || !this.quickEditVariantsGroup.style.display);
        if (isCurrentlyHidden) {
          this.quickEditVariantsGroup.style.display = 'block';
          this.btnToggleVariants.textContent = '📜 복수 부모 전승 접기 ▴';

          const cards = this.quickEditVariantsList ? this.quickEditVariantsList.querySelectorAll('.variant-edit-card') : [];
          if (cards.length === 0) {
            const currentParentsVal = this.quickEditParents ? this.quickEditParents.value.trim() : '';
            const initialVariants = [
              {
                id: `var_${Date.now()}_1`,
                source: '기본 통설',
                parentNamesStr: currentParentsVal,
                info: '',
                is_primary: true
              },
              {
                id: `var_${Date.now()}_2`,
                source: '',
                parentNamesStr: '',
                info: '',
                is_primary: false
              }
            ];
            this.populateQuickEditVariants(initialVariants, !!this.currentUser);
          }
        } else {
          this.quickEditVariantsGroup.style.display = 'none';
          this.btnToggleVariants.textContent = '📜 복수 부모 전승(이설) 관리 ▾';
        }
      });
    }

    if (this.btnQuickEditAddVariant) {
      this.btnQuickEditAddVariant.addEventListener('click', () => {
        if (!this.currentUser) return;
        this.addNewVariantCard();
      });
    }

    if (this.quickEditParents) {
      this.quickEditParents.addEventListener('input', () => {
        if (this.quickEditVariantsList) {
          const primaryCard = this.quickEditVariantsList.querySelector('.variant-edit-card.is-primary');
          if (primaryCard) {
            const pInput = primaryCard.querySelector('.variant-parents-input');
            if (pInput) pInput.value = this.quickEditParents.value;
          }
        }
      });
    }

    if (this.quickEditForm) {
      this.quickEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!this.currentUser) return;
        let pId = this.quickEditId.value ? this.quickEditId.value.trim() : '';
        let person = pId ? this.nodesMap.get(pId) : null;
        const isCreating = !person;

        if (isCreating) {
          const newName = this.quickEditName.value.trim();
          if (!newName) return;
          pId = `${this.currentDatasetKey}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          person = {
            id: pId,
            name: newName,
            nameEng: "",
            nameRoman: "",
            nameRomanEng: "",
            title: "",
            gender: "male",
            info: "",
            parentIds: [],
            spouseIds: [],
            parentVariants: []
          };
          this.nodesMap.set(pId, person);
        }

        if (person) {
          person.name = this.quickEditName.value.trim();
          if (this.quickEditNameEng) person.nameEng = this.quickEditNameEng.value.trim();
          if (this.quickEditNameRoman) person.nameRoman = this.quickEditNameRoman.value.trim();
          if (this.quickEditNameRomanEng) person.nameRomanEng = this.quickEditNameRomanEng.value.trim();
          if (this.quickEditTitle) person.title = this.quickEditTitle.value.trim();
          if (this.quickEditGroup) person.groupName = this.quickEditGroup.value.trim();
          if (this.quickEditGender) person.gender = this.quickEditGender.value;
          if (this.quickEditInfo) person.info = this.quickEditInfo.value.trim();

          // 📜 복수 부모 전승 데이터 추출 및 처리
          const variantCards = this.quickEditVariantsList ? Array.from(this.quickEditVariantsList.querySelectorAll('.variant-edit-card')) : [];
          const isVariantsActive = (this.quickEditVariantsGroup && this.quickEditVariantsGroup.style.display !== 'none' && variantCards.length > 0);

          if (isVariantsActive) {
            const selectedPrimaryRadio = this.quickEditVariantsList.querySelector('input[name="quickEditPrimaryVariant"]:checked');
            const selectedPrimaryId = selectedPrimaryRadio ? selectedPrimaryRadio.value : (variantCards[0]?.dataset?.variantId || null);

            const newVariants = [];
            for (let i = 0; i < variantCards.length; i++) {
              const card = variantCards[i];
              const vId = card.dataset.variantId || `var_${Date.now()}_${i}`;
              const srcInput = card.querySelector('.variant-source-input');
              const parentsInput = card.querySelector('.variant-parents-input');
              const infoInput = card.querySelector('.variant-info-input');

              const source = srcInput ? srcInput.value.trim() : '';
              const rawParents = parentsInput ? parentsInput.value.trim() : '';
              const info = infoInput ? infoInput.value.trim() : '';
              const isPrimary = (vId === selectedPrimaryId) || (selectedPrimaryId === null && i === 0);

              // 완전 빈 카드는 스킵
              if (!source && !rawParents && !info) continue;

              const parentNames = rawParents ? rawParents.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
              const parentIds = parentNames
                .map(pName => this.findOrCreatePersonByNameOrId(pName, 'male'))
                .filter(targetId => targetId && targetId !== pId);

              newVariants.push({
                id: vId,
                source: source || `전승 ${newVariants.length + 1}`,
                parent_ids: parentIds,
                info: info,
                is_primary: isPrimary
              });
            }

            if (newVariants.length > 0) {
              if (!newVariants.some(v => v.is_primary)) {
                newVariants[0].is_primary = true;
              }
              person.parentVariants = newVariants;

              const primaryVar = newVariants.find(v => v.is_primary) || newVariants[0];
              person.parentIds = [...primaryVar.parent_ids];

              const currentActive = this.activeParentVariants.get(pId);
              if (!newVariants.some(v => v.id === currentActive)) {
                this.activeParentVariants.set(pId, primaryVar.id);
              }
            } else {
              person.parentVariants = [];
              if (this.quickEditParents) {
                const rawVal = this.quickEditParents.value.trim();
                const parentNames = rawVal ? rawVal.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
                person.parentIds = parentNames
                  .map(pName => this.findOrCreatePersonByNameOrId(pName, 'male'))
                  .filter(targetId => targetId && targetId !== pId);
              }
            }
          } else {
            // 전승 관리 그룹이 비활성이거나 비어있으면 기본 부모 필드 사용
            if (this.quickEditParents) {
              const rawVal = this.quickEditParents.value.trim();
              const parentNames = rawVal ? rawVal.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
              const newParentIds = parentNames
                .map(pName => this.findOrCreatePersonByNameOrId(pName, 'male'))
                .filter(targetId => targetId && targetId !== pId);

              person.parentIds = newParentIds;
            }
            person.parentVariants = [];
          }

          if (this.quickEditSpouses) {
            const rawVal = this.quickEditSpouses.value.trim();
            const spouseNames = rawVal ? rawVal.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
            const newSpouseIds = spouseNames
              .map(sName => this.findOrCreatePersonByNameOrId(sName, 'female'))
              .filter(targetId => targetId && targetId !== pId);

            person.spouseIds = newSpouseIds;
          }

          this.sanitizeRelationships();
          await this.savePersonToDB(pId);
          this.closeQuickEditModal();

          if (isCreating) {
            this.searchInput.value = '';
            this.searchDropdown.classList.remove('show');
            this.setFocusPerson(pId);
          } else {
            this.render();
          }
        }
      });
    }
  }

  // ── 7.5 복수 부모 전승(Tradition) 선택 팝오버 오픈 ──
  openTraditionPopover(personId, anchorEl) {
    const person = this.nodesMap.get(personId);
    if (!person || !person.parentVariants || person.parentVariants.length <= 1) return;

    const popover = this.traditionPopover;
    const list = this.traditionPopoverList;
    if (!popover || !list) return;

    const activeVarId = this.activeParentVariants.get(personId);

    list.innerHTML = person.parentVariants.map(v => {
      const isActive = (v.id === activeVarId) || (!activeVarId && v.is_primary);

      let parentNamesStr = "단독 탄생 (어머니/아버지 없음)";
      if (Array.isArray(v.parent_ids) && v.parent_ids.length > 0) {
        parentNamesStr = v.parent_ids.map(pId => {
          const p = this.nodesMap.get(pId);
          return p ? p.name : pId;
        }).join(', ');
      } else if (Array.isArray(v.parentNames) && v.parentNames.length > 0) {
        parentNamesStr = v.parentNames.join(', ');
      }

      return `
        <div class="tradition-option-card ${isActive ? 'active' : ''}" data-variant-id="${v.id}">
          <div class="tradition-option-source">
            <span>📜 ${this.escapeHtml(v.source)}</span>
            <span style="font-size:11px; font-weight:600; color:${isActive ? 'var(--accent)' : 'var(--text-muted)'};">
              ${isActive ? '✅ 적용중' : '선택'}
            </span>
          </div>
          <div class="tradition-option-parents">부모 계보: ${this.escapeHtml(parentNamesStr)}</div>
          ${v.info ? `<div class="tradition-option-info">${this.escapeHtml(v.info)}</div>` : ''}
        </div>
      `;
    }).join('');

    popover.style.display = 'flex';

    const rect = anchorEl.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;

    if (left + 300 > window.innerWidth) {
      left = window.innerWidth - 310;
    }
    if (left < 10) left = 10;
    if (top + 240 > window.innerHeight) {
      top = rect.top - 230;
    }

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    list.querySelectorAll('.tradition-option-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const variantId = card.dataset.variantId;
        this.activeParentVariants.set(personId, variantId);
        popover.style.display = 'none';
        this.render();
      });
    });
  }

  preventDrag(element) {
    ['pointerdown', 'mousedown', 'touchstart'].forEach(evt => {
      element.addEventListener(evt, e => e.stopPropagation());
    });
  }

  // ── 8. SVG 연결선 렌더링 ──
  renderConnections(layout) {
    const nodePosMap = new Map();
    layout.nodes.forEach(n => nodePosMap.set(n.id, n));

    let svgHtml = '';

    // 1. Couple Spouse Lines (Horizontal/Orthogonal lines connecting p1 and p2)
    layout.couples.forEach(couple => {
      const n1 = nodePosMap.get(couple.p1);
      const n2 = nodePosMap.get(couple.p2);

      if (n1 && n2) {
        const x1 = n1.x + (this.nodeWidth / 2);
        const y1 = n1.y;
        const x2 = n2.x - (this.nodeWidth / 2);
        const y2 = n2.y;

        if (y1 === y2) {
          svgHtml += `<path class="connection-line spouse" d="M ${x1} ${y1} L ${x2} ${y2}" />`;
        } else {
          const midX = (x1 + x2) / 2;
          svgHtml += `<path class="connection-line spouse" d="M ${x1} ${y1} H ${midX} V ${y2} H ${x2}" />`;
        }
      }
    });

    // 2. Parent-to-Child Lines for all Couples
    layout.couples.forEach(couple => {
      if (this.expandedCouples.has(couple.key) || this.isEditMode) {
        const p1 = nodePosMap.get(couple.p1);
        const p2 = nodePosMap.get(couple.p2);
        if (p1 && p2) {
          const commonChildren = this.getCommonChildren(couple.p1, couple.p2);
          commonChildren.forEach(cId => {
            const childNode = nodePosMap.get(cId);
            if (childNode && !childNode.parentGroupKey) {
              const childTopY = childNode.y - (this.nodeHeight / 2);
              const midY = (couple.midY + childTopY) / 2;
              svgHtml += `<path class="connection-line active" d="M ${couple.midX} ${couple.midY} V ${midY} H ${childNode.x} V ${childTopY}" />`;
            }
          });
        }
      }
    });

    // 2.5 Group Badges T-Bar SVG Lines
    if (layout.groupBadges && layout.groupBadges.length > 0) {
      const parentGroupsMap = new Map();
      layout.groupBadges.forEach(badge => {
        const pKey = `${badge.parentX}__${badge.parentY}`;
        if (!parentGroupsMap.has(pKey)) parentGroupsMap.set(pKey, []);
        parentGroupsMap.get(pKey).push(badge);
      });

      parentGroupsMap.forEach((badges) => {
        const parentX = badges[0].parentX;
        const parentY = badges[0].parentY;
        const parentBottomY = parentY + (this.nodeHeight / 2);
        const badgeTopY = badges[0].y - 18;
        const midY = (parentBottomY + badgeTopY) / 2;

        if (badges.length === 1) {
          svgHtml += `<path class="connection-line active" d="M ${parentX} ${parentBottomY} V ${badgeTopY}" />`;
        } else {
          const badgeXs = badges.map(b => b.x);
          const minX = Math.min(...badgeXs);
          const maxX = Math.max(...badgeXs);

          let pathD = `M ${parentX} ${parentBottomY} V ${midY} M ${minX} ${midY} H ${maxX}`;
          badges.forEach(b => {
            pathD += ` M ${b.x} ${midY} V ${badgeTopY}`;
          });
          svgHtml += `<path class="connection-line active" d="${pathD}" />`;
        }

        badges.forEach(badge => {
          if (this.expandedGroups.has(badge.key)) {
            const badgeBottomY = badge.y + 18;
            const groupChildren = layout.nodes.filter(n => n.parentGroupKey === badge.key);

            if (groupChildren.length > 0) {
              const childTopY = groupChildren[0].y - (this.nodeHeight / 2);
              const cMidY = (badgeBottomY + childTopY) / 2;
              const childXs = groupChildren.map(c => c.x);
              const minChildX = Math.min(...childXs);
              const maxChildX = Math.max(...childXs);

              let pathD = `M ${badge.x} ${badgeBottomY} V ${cMidY} M ${minChildX} ${cMidY} H ${maxChildX}`;
              groupChildren.forEach(c => {
                pathD += ` M ${c.x} ${cMidY} V ${childTopY}`;
              });
              svgHtml += `<path class="connection-line active" d="${pathD}" />`;
            }
          }
        });
      });
    }

    // 3. Parent-to-Child & Ancestor Lines for Nodes
    layout.nodes.forEach(n => {
      if (this.expandedBottom.has(n.id) || this.isEditMode) {
        const focusBottomY = n.y + (this.nodeHeight / 2);
        const allChildren = this.getChildIds(n.id);
        const singleChildren = allChildren.filter(cId => {
          const childPerson = this.nodesMap.get(cId);
          if (!childPerson) return false;
          const validParents = this.getEffectiveParentIds(cId);
          return validParents.length <= 1;
        });

        singleChildren.forEach(cId => {
          const childNode = nodePosMap.get(cId);
          if (childNode && !childNode.parentGroupKey) {
            const childTopY = childNode.y - (this.nodeHeight / 2);
            const midY = (focusBottomY + childTopY) / 2;
            svgHtml += `<path class="connection-line active" d="M ${n.x} ${focusBottomY} V ${midY} H ${childNode.x} V ${childTopY}" />`;
          }
        });
      }

      // Ancestor connections
      if (this.expandedTop.has(n.id)) {
        const parents = this.getEffectiveParentIds(n.id).filter(pId => nodePosMap.has(pId));
        if (parents.length > 0) {
          let parentStartX = n.x;
          let parentStartY = n.y - (this.nodeHeight / 2) - 60;

          if (parents.length >= 2) {
            const p1 = nodePosMap.get(parents[0]);
            const p2 = nodePosMap.get(parents[1]);
            if (p1 && p2) {
              parentStartX = (p1.x + p2.x) / 2;
              parentStartY = p1.y;
            }
          } else {
            const p1 = nodePosMap.get(parents[0]);
            if (p1) {
              parentStartX = p1.x;
              parentStartY = p1.y + (this.nodeHeight / 2);
            }
          }

          const childTopY = n.y - (this.nodeHeight / 2);
          const midY = (parentStartY + childTopY) / 2;
          svgHtml += `<path class="connection-line active" d="M ${parentStartX} ${parentStartY} V ${midY} H ${n.x} V ${childTopY}" />`;
        }
      }

      // Sibling connections
      if (n.isSibling) {
        const focusNode = nodePosMap.get(this.focusNodeId);
        if (focusNode) {
          const sX = n.x + (this.nodeWidth / 2);
          const sY = n.y;
          const focusLeftX = focusNode.x - (this.nodeWidth / 2);
          const midX = (sX + focusLeftX) / 2;
          svgHtml += `<path class="connection-line" d="M ${focusLeftX} ${focusNode.y} H ${midX} V ${sY} H ${sX}" />`;
        }
      }
    });

    this.svgLayer.innerHTML = svgHtml;
  }

  // ── 9. 카메라 및 뷰포트 제어 ──
  updateTransform() {
    this.stage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  centerOnFocusNode() {
    if (!this.hasSearched || !this.focusNodeId) return;

    const focusNode = this.visibleNodes.get(this.focusNodeId);
    if (!focusNode) return;

    const viewportWidth = this.viewport.clientWidth;
    const viewportHeight = this.viewport.clientHeight;

    this.panX = (viewportWidth / 2) - (focusNode.x * this.zoom);
    this.panY = (viewportHeight / 2) - (focusNode.y * this.zoom);
    this.updateTransform();
  }

  zoomAt(deltaScale, clientX, clientY) {
    if (isNaN(deltaScale) || deltaScale <= 0) return;
    const newZoom = Math.min(Math.max(0.3, this.zoom * deltaScale), 2.5);
    if (newZoom === this.zoom || isNaN(newZoom)) return;

    const rect = this.viewport.getBoundingClientRect();
    const cx = (clientX !== undefined && clientX !== null) ? clientX : (rect.left + rect.width / 2);
    const cy = (clientY !== undefined && clientY !== null) ? clientY : (rect.top + rect.height / 2);

    const mouseX = cx - rect.left;
    const mouseY = cy - rect.top;

    if (!isNaN(mouseX) && !isNaN(mouseY)) {
      this.panX = mouseX - ((mouseX - this.panX) * (newZoom / this.zoom));
      this.panY = mouseY - ((mouseY - this.panY) * (newZoom / this.zoom));
      this.zoom = newZoom;
      this.updateTransform();
    }
  }

  // ── 10. 이벤트 바인딩 ──
  bindEvents() {
    // 🌟 iOS Safari 브라우저 페이지 전체 핀치 줌 방지 (gesturestart, gesturechange, gestureend)
    const preventNativeGesture = (e) => {
      e.preventDefault();
    };
    document.addEventListener('gesturestart', preventNativeGesture, { passive: false });
    document.addEventListener('gesturechange', preventNativeGesture, { passive: false });
    document.addEventListener('gestureend', preventNativeGesture, { passive: false });

    // UI 요소 여부 확인 (버튼, 인풋, 모달, 노드 등)
    const isUIElement = (target) => {
      return (
        target.closest('.genealogy-header') ||
        target.closest('.modal-backdrop') ||
        target.closest('.empty-placeholder') ||
        target.closest('.nav') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('.text-node') ||
        target.closest('.couple-node-btn') ||
        target.closest('.tradition-popover')
      );
    };

    // 🌟 통합 멀티터치 Pointer Events 관리자 (마우스 드래그 & 모바일 터치 핀치 줌/팬) 🌟
    const activePointers = new Map();
    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let pinchStartPanX = 0;
    let pinchStartPanY = 0;
    let pinchStartCenter = { x: 0, y: 0 };
    let lastSinglePointerPos = { x: 0, y: 0 };

    this.viewport.addEventListener('pointerdown', (e) => {
      if (isUIElement(e.target)) return;

      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1) {
        this.isDragging = true;
        lastSinglePointerPos = { x: e.clientX, y: e.clientY };
      } else if (activePointers.size === 2) {
        // 두 손가락 핀치 줌 진입: 단일 드래그 일시 중지
        this.isDragging = false;
        const pts = Array.from(activePointers.values());
        pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinchStartZoom = this.zoom;
        pinchStartPanX = this.panX;
        pinchStartPanY = this.panY;
        pinchStartCenter = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2
        };
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1 && this.isDragging) {
        // 1개 포인터 (마우스 또는 1손가락 터치) 상대 이동량 기반 부드러운 패닝
        const dx = e.clientX - lastSinglePointerPos.x;
        const dy = e.clientY - lastSinglePointerPos.y;
        lastSinglePointerPos = { x: e.clientX, y: e.clientY };

        this.panX += dx;
        this.panY += dy;
        this.updateTransform();
      } else if (activePointers.size === 2 && pinchStartDist > 10) {
        // 2손가락 정밀 핀치 줌 및 중심점 동시 이동
        const pts = Array.from(activePointers.values());
        const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const currentCenter = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2
        };

        const factor = currentDist / pinchStartDist;
        const newZoom = Math.min(Math.max(0.3, pinchStartZoom * factor), 2.5);

        const rect = this.viewport.getBoundingClientRect();
        const startCenterX = pinchStartCenter.x - rect.left;
        const startCenterY = pinchStartCenter.y - rect.top;
        const currentCenterX = currentCenter.x - rect.left;
        const currentCenterY = currentCenter.y - rect.top;

        // 원본 시작 기준 스테이지 좌표 역계산
        const stageX = (startCenterX - pinchStartPanX) / pinchStartZoom;
        const stageY = (startCenterY - pinchStartPanY) / pinchStartZoom;

        const nextPanX = currentCenterX - (stageX * newZoom);
        const nextPanY = currentCenterY - (stageY * newZoom);

        if (!isNaN(nextPanX) && !isNaN(nextPanY) && !isNaN(newZoom)) {
          this.panX = nextPanX;
          this.panY = nextPanY;
          this.zoom = newZoom;
          this.updateTransform();
        }
      }
    });

    const removePointer = (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.delete(e.pointerId);

      if (activePointers.size === 1) {
        // 핀치 중 한 손가락을 떼었을 때: 남은 손가락의 현재 위치에서 점프 없이 단일 드래그 복귀
        this.isDragging = true;
        const remainingPt = activePointers.values().next().value;
        lastSinglePointerPos = { x: remainingPt.x, y: remainingPt.y };
      } else if (activePointers.size === 0) {
        this.isDragging = false;
        pinchStartDist = 0;
      }
    };

    window.addEventListener('pointerup', removePointer);
    window.addEventListener('pointercancel', removePointer);

    // 휠 스크롤 줌
    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomAt(zoomFactor, e.clientX, e.clientY);
    }, { passive: false });

    // iOS Safari에서 캔버스 터치 시 브라우저 바운스 스크롤 방지
    this.viewport.addEventListener('touchmove', (e) => {
      if (!isUIElement(e.target) && e.cancelable) {
        e.preventDefault();
      }
    }, { passive: false });

    this.btnZoomIn.addEventListener('click', () => {
      this.zoomAt(1.2);
    });

    this.btnZoomOut.addEventListener('click', () => {
      this.zoomAt(0.8);
    });

    this.btnResetView.addEventListener('click', () => {
      this.zoom = 1;
      this.centerOnFocusNode();
    });

    this.datasetSelect.addEventListener('change', async (e) => {
      const val = e.target.value;
      if (val === '__CREATE_NEW_DATASET__') {
        this.openCreateDatasetModal();
      } else {
        await this.loadDataset(val, false);
      }
    });

    this.searchInput.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });

    this.searchInput.addEventListener('focus', (e) => {
      if (e.target.value.trim()) {
        this.handleSearch(e.target.value);
      }
    });

    this.searchInput.addEventListener('keydown', (e) => {
      const items = Array.from(this.searchDropdown.querySelectorAll('.search-item[data-id]'));

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length > 0) {
          this.highlightedSearchIndex = (this.highlightedSearchIndex + 1) % items.length;
          this.updateSearchHighlight(items);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length > 0) {
          this.highlightedSearchIndex = (this.highlightedSearchIndex - 1 + items.length) % items.length;
          this.updateSearchHighlight(items);
        }
      } else if (e.key === 'Enter') {
        if (e.isComposing) return;
        e.preventDefault();

        if (this.highlightedSearchIndex >= 0 && items[this.highlightedSearchIndex]) {
          const personId = items[this.highlightedSearchIndex].dataset.id;
          this.setFocusPerson(personId);
          this.searchDropdown.classList.remove('show');
          this.searchInput.value = '';
          this.searchInput.blur();
        } else {
          const query = this.searchInput.value;
          const matches = this.getSearchMatches(query);
          if (matches.length > 0) {
            this.setFocusPerson(matches[0].id);
            this.searchDropdown.classList.remove('show');
            this.searchInput.value = '';
            this.searchInput.blur();
          } else if (query.trim()) {
            const btnAdd = this.searchDropdown.querySelector('#btnSearchAddPerson');
            if (btnAdd) {
              btnAdd.click();
            }
          }
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) {
        this.searchDropdown.classList.remove('show');
      }
    });

    // 그리스 로마 신화 표기 모드 (병기 / 그리스 / 로마) 세그먼트 버튼 이벤트 바인딩
    if (this.mythModeGroup) {
      this.mythModeGroup.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.mode;
          if (!mode) return;
          this.mythNameMode = mode;
          this.mythModeGroup.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.render();
        });
      });
    }

    // 복수 부모 전승 팝오버 닫기 이벤트 바인딩
    if (this.btnTraditionPopoverClose) {
      this.btnTraditionPopoverClose.addEventListener('click', () => {
        if (this.traditionPopover) this.traditionPopover.style.display = 'none';
      });
    }

    document.addEventListener('click', (e) => {
      if (this.traditionPopover && this.traditionPopover.style.display !== 'none') {
        if (!e.target.closest('#traditionPopover') && !e.target.closest('.text-node-tradition-btn')) {
          this.traditionPopover.style.display = 'none';
        }
      }
    });

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.editModal) this.editModal.classList.remove('active');
        if (this.authModal) this.authModal.classList.remove('active');
        if (this.quickEditModal) this.closeQuickEditModal();
        if (this.createDatasetModal) this.closeCreateDatasetModal();
      });
    });

    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');

    if (btnLogin) {
      btnLogin.addEventListener('click', () => {
        if (this.loginError) this.loginError.style.display = 'none';
        if (this.authModal) this.authModal.classList.add('active');
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        if (confirm("로그아웃 하시겠습니까?")) {
          if (supabaseClient) {
            await supabaseClient.auth.signOut();
          }
        }
      });
    }

    const btnImportCsv = document.getElementById('btnImportCsv');
    const csvFileInput = document.getElementById('csvFileInput');

    if (btnImportCsv && csvFileInput) {
      btnImportCsv.addEventListener('click', () => {
        if (!this.currentUser) {
          alert("🔒 CSV 데이터 가져오기는 Supabase 로그인 후 이용 가능합니다.");
          if (this.loginError) this.loginError.style.display = 'none';
          if (this.authModal) this.authModal.classList.add('active');
          return;
        }
        csvFileInput.value = '';
        csvFileInput.click();
      });

      csvFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          await this.handleCsvImport(file);
        }
      });
    }

    const btnExportCsv = document.getElementById('btnExportCsv');
    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', async () => {
        await this.handleCsvExport();
      });
    }

    if (this.loginForm) {
      this.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (supabaseClient) {
          const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (error) {
            this.loginError.innerText = `로그인 실패: ${error.message}`;
            this.loginError.style.display = 'block';
          } else {
            this.authModal.classList.remove('active');
            this.isEditMode = true;
            this.updateEditModeBtn();
            this.render();
          }
        }
      });
    }

    this.btnToggleEditor.addEventListener('click', () => {
      if (!this.currentUser) {
        alert("🔒 가계도 데이터 편집은 Supabase 로그인 후 이용 가능합니다.");
        this.loginError.style.display = 'none';
        this.authModal.classList.add('active');
        return;
      }
      this.isEditMode = !this.isEditMode;
      this.updateEditModeBtn();
      this.render();
    });
  }

  // ── CSV 파이프(|) 구분자 데이터 Import 및 ID 변환 처리 ──
  async handleCsvImport(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

      if (lines.length === 0) {
        alert("CSV 파일이 비어있습니다.");
        return;
      }

      // 1. 헤더 컬럼 위치 파악 (dataset, name, name_eng, gender, title, info, parents, spouse)
      const firstLine = lines[0];
      const cols = firstLine.split('|').map(c => c.trim().toLowerCase());

      let colDataset = cols.indexOf('dataset') >= 0 ? cols.indexOf('dataset') : cols.indexOf('dataset_id');
      let colName = cols.indexOf('name');
      let colNameEng = cols.indexOf('name_eng');
      let colGender = cols.indexOf('gender');
      let colTitle = cols.indexOf('title');
      let colInfo = cols.indexOf('info');
      let colParents = cols.indexOf('parents') >= 0 ? cols.indexOf('parents') : (cols.indexOf('parents_ids') >= 0 ? cols.indexOf('parents_ids') : cols.indexOf('parent_ids'));
      let colSpouse = cols.indexOf('spouse') >= 0 ? cols.indexOf('spouse') : (cols.indexOf('spouse_ids') >= 0 ? cols.indexOf('spouse_ids') : cols.indexOf('spouse_id'));

      let dataLines = lines;
      if (colName !== -1) {
        dataLines = lines.slice(1);
      } else {
        colDataset = 0;
        colName = 1;
        colNameEng = 2;
        colGender = 3;
        colTitle = 4;
        colInfo = 5;
        colParents = 6;
        colSpouse = 7;
      }

      if (dataLines.length === 0) {
        alert("가져올 인물 데이터 행이 존재하지 않습니다.");
        return;
      }

      // 2. CSV dataset 컬럼의 Title 또는 ID를 DB의 dataset_id로 변환하는 헬퍼
      const resolveDatasetId = (rawInput) => {
        if (!rawInput) return this.currentDatasetKey || 'greek';

        const clean = rawInput.trim();
        const norm = clean.toLowerCase();

        // 1) 기존 datasetsList에서 ID 또는 Title과 매칭
        for (const ds of this.datasetsList) {
          if (ds.id === clean || ds.id.toLowerCase() === norm) return ds.id;
          if (ds.title === clean || (ds.title && ds.title.trim().toLowerCase() === norm)) return ds.id;
        }

        // 2) 고정 주요 명칭 호환
        if (clean === '그리스·로마 신화' || clean === '그리스 로마 신화' || clean === '그리스 로마 신화 가계도') return 'greek';
        if (clean === '조선 왕실' || clean === '조선 왕실 가계도') return 'joseon';

        // 3) 새로운 가계도 주제일 경우 영문/숫자 slug 기반 dataset_id 생성
        let newDsId = clean.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
        if (!newDsId || newDsId.replace(/_/g, '').length === 0) {
          newDsId = `ds_${Date.now()}`;
        }

        this.datasetsList.push({
          id: newDsId,
          title: clean
        });

        return newDsId;
      };

      // 3. CSV 행 파싱
      const rows = [];
      for (const line of dataLines) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 2) continue;

        const rawDs = colDataset >= 0 ? parts[colDataset] : '';
        const dsId = resolveDatasetId(rawDs);
        const name = parts[colName] || '';
        if (!name) continue;

        const nameEng = colNameEng >= 0 && parts[colNameEng] ? parts[colNameEng] : '';
        const genderRaw = colGender >= 0 && parts[colGender] ? parts[colGender] : '';
        let gender = 'male';
        if (genderRaw) {
          const g = genderRaw.trim().toLowerCase();
          if (g === 'female' || g === 'f' || g === '여' || g === '여성') gender = 'female';
          else if (g === 'genderless' || g === '중' || g === '중성') gender = 'genderless';
          else if (g === 'male' || g === 'm' || g === '남' || g === '남성') gender = 'male';
          else gender = g;
        }
        const title = colTitle >= 0 && parts[colTitle] ? parts[colTitle] : '';
        const info = colInfo >= 0 && parts[colInfo] ? parts[colInfo] : '';
        const parentsStr = colParents >= 0 && parts[colParents] ? parts[colParents] : '';
        const spouseStr = colSpouse >= 0 && parts[colSpouse] ? parts[colSpouse] : '';

        rows.push({
          rawDs,
          dsId,
          name,
          nameEng,
          gender,
          title,
          info,
          parentsStr,
          spouseStr
        });
      }

      if (rows.length === 0) {
        alert("유효한 인물 행이 존재하지 않습니다.");
        return;
      }

      // 4. dataset_id별 DB 기존 노드 매핑 및 데이터셋 업서트
      const uniqueDatasetIds = [...new Set(rows.map(r => r.dsId))];
      const datasetNameMap = new Map(); // datasetId -> Map(normalizedName -> id)

      for (const dsId of uniqueDatasetIds) {
        const nameMap = new Map();
        datasetNameMap.set(dsId, nameMap);

        const targetDsObj = this.datasetsList.find(d => d.id === dsId);
        const targetTitle = targetDsObj ? targetDsObj.title : (rows.find(r => r.dsId === dsId)?.rawDs || dsId);

        if (supabaseClient) {
          try {
            await supabaseClient.from('genealogy_datasets').upsert({
              id: dsId,
              title: targetTitle,
              description: 'CSV Import로 생성된 가계도'
            });
          } catch (e) {
            console.warn("Dataset upsert warning:", e);
          }

          try {
            const { data: dbNodes } = await supabaseClient
              .from('genealogy_nodes')
              .select('*')
              .eq('dataset_id', dsId);

            if (dbNodes) {
              for (const n of dbNodes) {
                if (n.id) nameMap.set(n.id, n.id);
                if (n.name) nameMap.set(n.name.trim().toLowerCase(), n.id);
                if (n.name_eng) nameMap.set(n.name_eng.trim().toLowerCase(), n.id);
              }
            }
          } catch (e) {
            console.warn("Fetch existing nodes warning:", e);
          }
        }

        if (dsId === this.currentDatasetKey) {
          for (const [id, person] of this.nodesMap.entries()) {
            nameMap.set(id, id);
            if (person.name) nameMap.set(person.name.trim().toLowerCase(), id);
            if (person.nameEng) nameMap.set(person.nameEng.trim().toLowerCase(), id);
          }
        }
      }

      // 이름 -> 고유 ID 변환 헬퍼 (중복 생성 방지)
      let idCounter = 1;
      const getOrCreateId = (dsId, rawName) => {
        const trimmed = rawName.trim();
        if (!trimmed) return null;

        const norm = trimmed.toLowerCase();
        const nameMap = datasetNameMap.get(dsId);

        if (nameMap && nameMap.has(norm)) {
          return nameMap.get(norm);
        }

        const newId = `${dsId}_csv_${Date.now()}_${idCounter++}_${Math.floor(Math.random() * 1000)}`;
        if (nameMap) {
          nameMap.set(norm, newId);
        }
        return newId;
      };

      // Pass 1: CSV 메인 인물 고유 ID 부여
      for (const row of rows) {
        row.id = getOrCreateId(row.dsId, row.name);
      }

      // Pass 2: 부모/배우자 이름들을 중복 없이 ID 배열로 변환 및 노드 생성
      const nodeObjectsMap = new Map();

      for (const row of rows) {
        const parentNames = row.parentsStr ? row.parentsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        const spouseNames = row.spouseStr ? row.spouseStr.split(',').map(s => s.trim()).filter(Boolean) : [];

        const parentIds = [...new Set(parentNames.map(pName => getOrCreateId(row.dsId, pName)).filter(pId => pId && pId !== row.id))];
        const spouseIds = [...new Set(spouseNames.map(sName => getOrCreateId(row.dsId, sName)).filter(sId => sId && sId !== row.id))];

        nodeObjectsMap.set(row.id, {
          id: row.id,
          dataset_id: row.dsId,
          name: row.name,
          name_eng: row.nameEng,
          gender: row.gender || 'male',
          title: row.title,
          info: row.info,
          parent_ids: parentIds,
          spouse_ids: spouseIds,
          updated_at: new Date().toISOString()
        });
      }

      // CSV 행으로 직접 명시되지는 않았으나 부모/배우자로 참조된 인물 더미 노드 보장
      for (const dsId of uniqueDatasetIds) {
        const nameMap = datasetNameMap.get(dsId);
        if (!nameMap) continue;

        for (const [normName, nodeId] of nameMap.entries()) {
          if (!nodeObjectsMap.has(nodeId)) {
            const existingInMemory = this.nodesMap.get(nodeId);
            nodeObjectsMap.set(nodeId, {
              id: nodeId,
              dataset_id: dsId,
              name: existingInMemory ? existingInMemory.name : normName,
              name_eng: existingInMemory ? (existingInMemory.nameEng || '') : '',
              gender: existingInMemory ? (existingInMemory.gender || 'male') : 'male',
              title: existingInMemory ? (existingInMemory.title || '') : '',
              info: existingInMemory ? (existingInMemory.info || '') : '',
              parent_ids: existingInMemory ? (existingInMemory.parentIds || []) : [],
              spouse_ids: existingInMemory ? (existingInMemory.spouseIds || []) : [],
              updated_at: new Date().toISOString()
            });
          }
        }
      }

      // Pass 3: 배우자 상호 양방향 관계 동기화
      for (const [id, node] of nodeObjectsMap.entries()) {
        for (const sId of node.spouse_ids) {
          const spouseNode = nodeObjectsMap.get(sId);
          if (spouseNode && !spouseNode.spouse_ids.includes(id)) {
            spouseNode.spouse_ids.push(id);
          }
        }
      }

      // Supabase DB 일괄 Upsert
      const allNodesToSave = Array.from(nodeObjectsMap.values());

      if (supabaseClient) {
        const chunkSize = 50;
        for (let i = 0; i < allNodesToSave.length; i += chunkSize) {
          const chunk = allNodesToSave.slice(i, i + chunkSize);
          const { error } = await supabaseClient.from('genealogy_nodes').upsert(chunk);
          if (error) {
            console.error("CSV Import error:", error);
            alert(`DB 저장 실패 (${error.message})`);
            return;
          }
        }
      }

      // 데이터셋 및 화면 리로드
      await this.fetchDatasetsFromDB();
      const firstDs = uniqueDatasetIds[0] || this.currentDatasetKey;
      await this.loadDataset(firstDs);

      alert(`🎉 CSV 파일의 인물 데이터 ${rows.length}개가 성공적으로 Supabase DB에 저장되었습니다!`);
    } catch (err) {
      console.error("CSV file parse error:", err);
      alert(`CSV 처리 중 오류가 발생했습니다: ${err.message}`);
    }
  }

  // ── CSV 파이프(|) 구분자 데이터 Export 및 변환 처리 ──
  async handleCsvExport() {
    if (!this.currentUser) {
      alert("🔒 CSV 데이터 내보내기는 Supabase 로그인 후 이용 가능합니다.");
      return;
    }

    try {
      const datasetId = this.currentDatasetKey;
      const currentDs = this.datasetsList.find(d => d.id === datasetId);
      const datasetTitle = currentDs ? currentDs.title : datasetId;

      let rawNodes = [];

      // Supabase 페이징 쿼리 (100개 단위로 반복 조회하여 행 수 제한 우회)
      if (supabaseClient) {
        let page = 0;
        const pageSize = 100;
        let keepFetching = true;

        while (keepFetching) {
          const { data, error } = await supabaseClient
            .from('genealogy_nodes')
            .select('*')
            .eq('dataset_id', datasetId)
            .order('id', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) {
            console.error("Fetch nodes error for export:", error);
            alert(`DB 데이터 조회 중 오류가 발생했습니다: ${error.message}`);
            return;
          }

          if (!data || data.length === 0) {
            keepFetching = false;
          } else {
            rawNodes = rawNodes.concat(data);
            if (data.length < pageSize) {
              keepFetching = false;
            } else {
              page++;
            }
          }
        }
      }

      if (rawNodes.length === 0 && this.nodesMap.size > 0) {
        rawNodes = Array.from(this.nodesMap.values()).map(n => ({
          id: n.id,
          dataset_id: datasetId,
          name: n.name,
          name_eng: n.nameEng || '',
          gender: n.gender || 'male',
          title: n.title || '',
          info: n.info || '',
          parent_ids: n.parentIds || [],
          spouse_ids: n.spouseIds || []
        }));
      }

      if (rawNodes.length === 0) {
        alert("내보낼 인물 데이터가 없습니다.");
        return;
      }

      const idToNodeMap = new Map();
      for (const n of rawNodes) {
        idToNodeMap.set(n.id, n);
      }
      for (const [id, n] of this.nodesMap.entries()) {
        if (!idToNodeMap.has(id)) {
          idToNodeMap.set(id, n);
        }
      }

      const convertIdsToNames = (ids) => {
        if (!ids) return '';
        let idArray = [];
        if (Array.isArray(ids)) {
          idArray = ids;
        } else if (typeof ids === 'string') {
          idArray = ids.replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(Boolean);
        }
        return idArray
          .map(id => {
            const cleanId = String(id).trim();
            const node = idToNodeMap.get(cleanId);
            return node ? (node.name || cleanId) : cleanId;
          })
          .filter(Boolean)
          .join(', ');
      };

      // 1. 헤더 컬럼명 변경 (dataset, name, name_eng, gender, title, info, parents, spouse)
      const header = ['dataset', 'name', 'name_eng', 'gender', 'title', 'info', 'parents', 'spouse'].join('|');
      const csvRows = [header];

      // 2. dataset은 title로, parents/spouse는 name으로 변환하여 행 구성
      for (const node of rawNodes) {
        const dsVal = datasetTitle;
        const nameVal = (node.name || '').trim();
        const nameEngVal = (node.name_eng || node.nameEng || '').trim();
        const genderVal = (node.gender || 'male').trim();
        const titleVal = (node.title || '').trim();
        const infoVal = (node.info || '').trim().replace(/[\r\n]+/g, ' ');
        const parentsVal = convertIdsToNames(node.parent_ids || node.parentIds);
        const spouseVal = convertIdsToNames(node.spouse_ids || node.spouseIds);

        const rowStr = [dsVal, nameVal, nameEngVal, genderVal, titleVal, infoVal, parentsVal, spouseVal].join('|');
        csvRows.push(rowStr);
      }

      const csvContent = csvRows.join('\r\n');

      // BOM(\uFEFF)을 추가하여 한글 엑셀/메모장 인코딩 깨짐 방지
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `genealogy_${datasetId}_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`🎉 총 ${rawNodes.length}개 인물 데이터가 성공적으로 CSV 파일로 내보내졌습니다!`);
    } catch (err) {
      console.error("CSV export error:", err);
      alert(`CSV 내보내기 중 오류가 발생했습니다: ${err.message}`);
    }
  }

  updateSearchHighlight(items) {
    items.forEach((item, idx) => {
      if (idx === this.highlightedSearchIndex) {
        item.classList.add('highlighted');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('highlighted');
      }
    });
  }

  getSearchMatches(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matches = [];
    for (const [id, person] of this.nodesMap.entries()) {
      const matchName = person.name.toLowerCase().includes(q);
      const matchNameEng = person.nameEng && person.nameEng.toLowerCase().includes(q);
      const matchNameRoman = person.nameRoman && person.nameRoman.toLowerCase().includes(q);
      const matchNameRomanEng = person.nameRomanEng && person.nameRomanEng.toLowerCase().includes(q);
      const matchTitle = person.title && person.title.toLowerCase().includes(q);

      // 신화 대응 사전 별칭 검색
      let matchAlias = false;
      const syn = (this.currentDatasetKey === 'greek') ? MYTHOLOGY_SYNCRETISM_MAP[person.name] : null;
      if (syn && syn.aliases) {
        matchAlias = syn.aliases.some(a => a.toLowerCase().includes(q));
      }

      if (matchName || matchNameEng || matchNameRoman || matchNameRomanEng || matchTitle || matchAlias) {
        matches.push(person);
      }
    }

    matches.sort((a, b) => {
      const aExact = (
        a.name.toLowerCase() === q ||
        (a.nameRoman && a.nameRoman.toLowerCase() === q) ||
        (a.nameEng && a.nameEng.toLowerCase() === q) ||
        (a.nameRomanEng && a.nameRomanEng.toLowerCase() === q)
      ) ? 0 : 1;

      const bExact = (
        b.name.toLowerCase() === q ||
        (b.nameRoman && b.nameRoman.toLowerCase() === q) ||
        (b.nameEng && b.nameEng.toLowerCase() === q) ||
        (b.nameRomanEng && b.nameRomanEng.toLowerCase() === q)
      ) ? 0 : 1;

      return aExact - bExact;
    });

    return matches;
  }

  handleSearch(query) {
    this.highlightedSearchIndex = -1;
    const matches = this.getSearchMatches(query);
    if (!query.trim()) {
      this.searchDropdown.classList.remove('show');
      return;
    }

    if (matches.length === 0) {
      const trimmedQuery = query.trim();
      const safeQuery = this.escapeHtml(trimmedQuery);
      this.searchDropdown.innerHTML = `
        <div class="search-item-empty">
          <div class="search-item-title">검색 결과가 없습니다.</div>
          <button type="button" class="btn-search-add" id="btnSearchAddPerson">
            <span>➕</span>
            <span>'<strong>${safeQuery}</strong>' 인물 추가하기</span>
          </button>
        </div>
      `;

      const btnAdd = this.searchDropdown.querySelector('#btnSearchAddPerson');
      if (btnAdd) {
        btnAdd.addEventListener('click', (e) => {
          e.stopPropagation();
          this.searchDropdown.classList.remove('show');
          if (!this.currentUser) {
            alert("🔒 인물 추가는 Supabase 로그인 후 이용 가능합니다.");
            if (this.loginError) this.loginError.style.display = 'none';
            if (this.authModal) this.authModal.classList.add('active');
            return;
          }
          this.openCreatePersonModal(trimmedQuery);
        });
      }
    } else {
      this.searchDropdown.innerHTML = matches.slice(0, 8).map(person => {
        const hasRoman = !!person.nameRoman;
        let nameHtml = this.escapeHtml(person.name);
        if (hasRoman) {
          nameHtml += ` <span style="font-size:12px; font-weight:normal; color:#64748b;">(로마: ${this.escapeHtml(person.nameRoman)})</span>`;
        }

        let titleHtml = "";
        if (hasRoman) {
          titleHtml = `🇬🇷 ${this.escapeHtml(person.nameEng || person.name)} · 🏛️ ${this.escapeHtml(person.nameRomanEng || person.nameRoman)}`;
          if (person.title) titleHtml += ` | ${this.escapeHtml(person.title)}`;
        } else {
          titleHtml = this.escapeHtml(person.title || person.nameEng || '');
        }

        return `
          <div class="search-item" data-id="${person.id}">
            <div>
              <div class="search-item-name">${nameHtml}</div>
              <div class="search-item-title">${titleHtml}</div>
            </div>
            <span style="font-size:12px; color:var(--accent);">선택 ➔</span>
          </div>
        `;
      }).join('');

      this.searchDropdown.querySelectorAll('.search-item[data-id]').forEach(item => {
        item.addEventListener('click', () => {
          const personId = item.dataset.id;
          this.setFocusPerson(personId);
          this.searchDropdown.classList.remove('show');
          this.searchInput.value = '';
        });
      });
    }

    this.searchDropdown.classList.add('show');
  }

  openEditorModal() {
    const editBody = document.getElementById('editModalBody');
    const allPersons = Array.from(this.nodesMap.values());

    editBody.innerHTML = `
      <div style="border-bottom:1px solid #e2e8f0; padding-bottom:14px; margin-bottom:16px;">
        <div class="detail-label" style="margin-bottom:8px;">📁 가계도 주제 (dataset_id) 관리</div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <select id="editorDatasetSelect" class="form-control" style="flex:1; min-width:200px;">
            ${this.datasetsList.map(ds => `
              <option value="${ds.id}" ${ds.id === this.currentDatasetKey ? 'selected' : ''}>
                ${this.escapeHtml(ds.title)} (${ds.id})
              </option>
            `).join('')}
          </select>
          <button class="btn btn-secondary" id="btnCreateDataset" style="font-size:12px; padding:8px 12px;">+ 주제 추가</button>
          <button class="btn btn-secondary" id="btnEditDataset" style="font-size:12px; padding:8px 12px;">✏️ 수정</button>
          <button class="btn btn-danger" id="btnDeleteDataset" style="font-size:12px; padding:8px 12px;">🗑️ 삭제</button>
        </div>
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <strong style="font-size:14px;">현재 가계도 인물 관리</strong>
        <div style="display:flex; gap:6px;">
          ${this.currentDatasetKey === 'greek' ? `<button class="btn btn-secondary" id="btnSyncMythologyToDB" style="font-size:12px; padding:6px 12px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;" title="신화 사전의 로마명 및 전승을 Supabase DB에 일괄 저장합니다.">🏛️ 로마명/전승 DB 일괄 저장</button>` : ''}
          <button class="btn-modal-primary" id="btnAddNewPerson" style="font-size:13px; padding:6px 14px;">+ 새 인물 추가</button>
        </div>
      </div>

      <div style="margin-bottom:12px;">
        <input type="text" id="editorSearchInput" class="form-control" placeholder="🔍 수정/삭제할 인물 이름 검색 (예: 정종, 세종대왕, 제우스)..." />
      </div>

      <div class="detail-label" id="editorPersonCount">인물 목록 (${allPersons.length}명)</div>
      <div id="editorPersonListContainer" style="max-height:220px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:12px; padding:8px; background:#ffffff;">
      </div>
    `;

    const btnSyncMyth = document.getElementById('btnSyncMythologyToDB');
    if (btnSyncMyth) {
      btnSyncMyth.addEventListener('click', async () => {
        if (!confirm("그리스-로마 신화의 로마명(마르스, 베누스 등)과 복수 부모 전승 데이터를 Supabase DB에 일괄 동기화(저장)하시겠습니까?")) return;

        btnSyncMyth.disabled = true;
        btnSyncMyth.innerText = "⏳ DB 저장 중...";

        let updatedCount = 0;
        for (const [id, person] of this.nodesMap.entries()) {
          const hasRoman = person.nameRoman && person.nameRoman.length > 0;
          const hasVariants = person.parentVariants && person.parentVariants.length > 0;
          if (hasRoman || hasVariants) {
            await this.savePersonToDB(id);
            updatedCount++;
          }
        }

        alert(`총 ${updatedCount}명의 인물 데이터(로마 신화 이름 및 부모 전승)가 Supabase DB에 성공적으로 동기화되었습니다!`);
        btnSyncMyth.disabled = false;
        btnSyncMyth.innerText = "🏛️ 로마명/전승 DB 일괄 저장";
        this.openEditorModal();
      });
    }

    const editorDatasetSelect = document.getElementById('editorDatasetSelect');
    if (editorDatasetSelect) {
      editorDatasetSelect.addEventListener('change', async (e) => {
        await this.loadDataset(e.target.value, false);
        this.openEditorModal();
      });
    }

    document.getElementById('btnCreateDataset').addEventListener('click', () => {
      this.openCreateDatasetModal();
    });

    document.getElementById('btnEditDataset').addEventListener('click', async () => {
      const currentDs = this.datasetsList.find(d => d.id === this.currentDatasetKey);
      const updatedTitle = prompt(`'${this.currentDatasetKey}' 주제의 새 이름을 입력하세요:`, currentDs ? currentDs.title : '')?.trim();
      if (!updatedTitle) return;

      if (supabaseClient) {
        await supabaseClient.from('genealogy_datasets').update({ title: updatedTitle }).eq('id', this.currentDatasetKey);
      }

      await this.fetchDatasetsFromDB();
      this.openEditorModal();
    });

    document.getElementById('btnDeleteDataset').addEventListener('click', async () => {
      if (this.datasetsList.length <= 1) {
        alert("최소 1개 이상의 가계도 주제가 존재해야 하므로 삭제할 수 없습니다.");
        return;
      }

      if (confirm(`정말로 '${this.currentDatasetKey}' 가계도 주제와 이에 속한 모든 인물 데이터를 삭제하시겠습니까?`)) {
        if (supabaseClient) {
          await supabaseClient.from('genealogy_nodes').delete().eq('dataset_id', this.currentDatasetKey);
          await supabaseClient.from('genealogy_datasets').delete().eq('id', this.currentDatasetKey);
        }

        await this.fetchDatasetsFromDB();
        const nextDs = this.datasetsList[0]?.id || 'greek';
        await this.loadDataset(nextDs, false);
        this.openEditorModal();
      }
    });

    const renderEditorList = (filterTerm = '') => {
      const container = document.getElementById('editorPersonListContainer');
      const countLabel = document.getElementById('editorPersonCount');
      const term = filterTerm.trim().toLowerCase();

      const filtered = allPersons.filter(p => 
        !term || p.name.toLowerCase().includes(term) ||
        (p.nameEng && p.nameEng.toLowerCase().includes(term)) ||
        (p.nameRoman && p.nameRoman.toLowerCase().includes(term)) ||
        (p.nameRomanEng && p.nameRomanEng.toLowerCase().includes(term))
      );

      if (countLabel) {
        countLabel.innerText = term ? `검색된 인물 (${filtered.length}명 / 전체 ${allPersons.length}명)` : `인물 목록 (${allPersons.length}명)`;
      }

      if (filtered.length === 0) {
        container.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-muted); font-size:13px;">검색어와 일치하는 인물이 없습니다.</div>`;
        return;
      }

      container.innerHTML = filtered.map(p => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid #f1f5f9;">
          <div>
            <strong>${this.escapeHtml(p.name)}</strong>
            ${p.nameRoman ? `<span style="font-size:12px; color:var(--accent);"> [🏛️ ${this.escapeHtml(p.nameRoman)}]</span>` : ''}
            ${p.nameEng ? `<span style="font-size:12px; color:var(--text-muted);"> (${this.escapeHtml(p.nameEng)})</span>` : ''}
          </div>
          <div>
            <button class="btn btn-secondary btn-mini btn-edit-person" data-id="${p.id}" style="font-size:12px; padding:4px 10px;">수정</button>
            <button class="btn btn-danger btn-mini btn-delete-person" data-id="${p.id}" style="font-size:12px; padding:4px 10px; margin-left:4px;">삭제</button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.btn-edit-person').forEach(btn => {
        btn.addEventListener('click', () => {
          this.openPersonFormModal(btn.dataset.id);
        });
      });

      container.querySelectorAll('.btn-delete-person').forEach(btn => {
        btn.addEventListener('click', async () => {
          const person = this.nodesMap.get(btn.dataset.id);
          const pName = person ? person.name : btn.dataset.id;
          const deleteId = btn.dataset.id;

          if (confirm(`'${pName}' 인물을 Supabase DB에서 삭제하시겠습니까?`)) {
            this.nodesMap.delete(deleteId);

            for (const [id, p] of this.nodesMap.entries()) {
              let updated = false;
              if (p.parentIds.includes(deleteId)) { p.parentIds = p.parentIds.filter(x => x !== deleteId); updated = true; }
              if (p.spouseIds.includes(deleteId)) { p.spouseIds = p.spouseIds.filter(x => x !== deleteId); updated = true; }

              if (updated && supabaseClient) {
                await supabaseClient.from('genealogy_nodes').update({
                  parent_ids: p.parentIds,
                  spouse_ids: p.spouseIds,
                  updated_at: new Date().toISOString()
                }).eq('id', id);
              }
            }

            this.sanitizeRelationships();

            if (supabaseClient) {
              await supabaseClient.from('genealogy_nodes').delete().eq('id', deleteId);
            }

            this.render();
            this.openEditorModal();
          }
        });
      });
    };

    renderEditorList();

    const editorSearchInput = document.getElementById('editorSearchInput');
    if (editorSearchInput) {
      editorSearchInput.addEventListener('input', (e) => {
        renderEditorList(e.target.value);
      });
    }

    document.getElementById('btnAddNewPerson').addEventListener('click', () => {
      this.openPersonFormModal();
    });

    this.editModal.classList.add('active');
  }

  // ── 11. Supabase DB 전용 인물 추가/수정 폼 ──
  openPersonFormModal(personId = null) {
    const isEdit = !!personId;
    const person = isEdit ? this.nodesMap.get(personId) : {
      id: '', name: '', nameEng: '', gender: 'male',
      parentIds: [], spouseIds: []
    };

    const allNodes = Array.from(this.nodesMap.values());
    const datalistOptions = allNodes.map(n => `<option value="${this.escapeHtml(n.name)}">${n.name}</option>`).join('');

    const getNameListStr = (ids) => ids.map(id => {
      const p = this.nodesMap.get(id);
      return (p && p.name && !p.name.startsWith(this.currentDatasetKey)) ? p.name : '';
    }).filter(Boolean).join(', ');

    const editBody = document.getElementById('editModalBody');
    editBody.innerHTML = `
      <h3 style="font-size:18px; font-weight:700; margin-bottom:16px;">${isEdit ? '인물 정보 수정' : '신규 인물 추가'}</h3>
      <form id="personForm">
        <datalist id="personDatalist">${datalistOptions}</datalist>

        <input type="hidden" id="formId" value="${person.id}" />

        <div class="form-group">
          <label class="form-label">이름 (필수)</label>
          <input type="text" id="formName" class="form-control" value="${person.name}" required placeholder="예: 정종, 세종대왕, 제우스, 카오스" />
        </div>

        <div class="form-group">
          <label class="form-label">영문 이름 (선택)</label>
          <input type="text" id="formNameEng" class="form-control" value="${person.nameEng || ''}" placeholder="예: Jeongjong, Zeus, Chaos" />
        </div>

        <div class="form-group">
          <label class="form-label">성별 (카드 색상 연동)</label>
          <select id="formGender" class="form-control">
            <option value="male" ${person.gender === 'male' ? 'selected' : ''}>🟦 남성 (파란색 테두리)</option>
            <option value="female" ${person.gender === 'female' ? 'selected' : ''}>🟥 여성 (분홍색 테두리)</option>
            <option value="genderless" ${person.gender === 'genderless' ? 'selected' : ''}>🟪 중성 (보라색 테두리 - 태초의 신/카오스 등)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">부모 이름 (쉼표 , 구분)</label>
          <input type="text" id="formParents" class="form-control" list="personDatalist" value="${getNameListStr(person.parentIds)}" placeholder="예: 태조, 신의왕후 (이름 검색 가능)" />
        </div>

        <div class="form-group">
          <label class="form-label">배우자 이름 (쉼표 , 구분)</label>
          <input type="text" id="formSpouses" class="form-control" list="personDatalist" value="${getNameListStr(person.spouseIds)}" placeholder="예: 정안왕후 (이름 검색 가능)" />
        </div>

        <div class="form-group">
          <label class="form-label">칭호 / 부연 설명 (선택)</label>
          <input type="text" id="formTitle" class="form-control" value="${this.escapeHtml(person.title || '')}" placeholder="예: 번개와 하늘의 신" />
        </div>

        <div class="form-group">
          <label class="form-label">상세 정보 / 설명 (선택)</label>
          <textarea id="formInfo" class="form-control" rows="3" placeholder="상세 설명을 입력하세요...">${this.escapeHtml(person.info || '')}</textarea>
        </div>

        <div class="form-actions" style="margin-top:24px;">
          <button type="button" class="btn btn-secondary" id="btnCancelForm" style="background:#f1f5f9; color:#475569; padding:10px 18px; border-radius:12px; font-weight:600; border:1px solid #cbd5e1;">취소</button>
          <button type="submit" class="btn-modal-primary">💾 Supabase DB에 저장하기</button>
        </div>
      </form>
    `;

    document.getElementById('btnCancelForm').addEventListener('click', () => {
      this.openEditorModal();
    });

    document.getElementById('personForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('formName').value.trim();
      let id = document.getElementById('formId').value.trim();

      if (!name) return;

      if (!id) {
        id = `${this.currentDatasetKey}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      }

      const selectedGender = document.getElementById('formGender').value;

      const parseNamesToIds = (val) => {
        if (!val) return [];
        return val.split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .map(nameOrId => this.findOrCreatePersonByNameOrId(nameOrId, 'male'))
          .filter(targetId => targetId && targetId !== id);
      };

      const parentIds = parseNamesToIds(document.getElementById('formParents').value);
      const spouseIds = parseNamesToIds(document.getElementById('formSpouses').value);
      const existingPerson = this.nodesMap.get(id);

      const updated = {
        id,
        name,
        nameEng: document.getElementById('formNameEng').value.trim(),
        nameRoman: existingPerson ? existingPerson.nameRoman : "",
        nameRomanEng: existingPerson ? existingPerson.nameRomanEng : "",
        title: document.getElementById('formTitle').value.trim(),
        gender: selectedGender,
        info: document.getElementById('formInfo').value.trim(),
        groupName: existingPerson ? existingPerson.groupName : null,
        parentIds,
        spouseIds,
        parentVariants: existingPerson ? existingPerson.parentVariants : []
      };

      this.nodesMap.set(id, updated);
      this.sanitizeRelationships();

      if (supabaseClient) {
        try {
          await supabaseClient.from('genealogy_nodes').upsert({
            id: updated.id,
            dataset_id: this.currentDatasetKey,
            name: updated.name,
            name_eng: updated.nameEng,
            title: updated.title,
            gender: updated.gender,
            info: updated.info,
            parent_ids: updated.parentIds,
            spouse_ids: updated.spouseIds,
            updated_at: new Date().toISOString()
          });
        } catch (dbErr) {
          console.warn("Supabase upsert warning:", dbErr);
        }
      }

      this.render();
      this.openEditorModal();
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.genealogyApp = new DynamicGenealogyApp();
});
