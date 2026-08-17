/**
 * genealogy.js — 일부일처 부부 표시 시 우측 배우자 화살표(▶) 숨김 정밀 보완 버전
 */

const supabaseUrl = 'https://tpwwwpcbinxdhxqvcvqc.supabase.co';
const supabaseKey = 'sb_publishable_A1sd3hvbeQx9-gVoFXL0qA_G923SWm9';
const supabaseClient = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

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

    // 인물 추가 대화상자 임시 상태
    this.pendingQuickAddAction = null;

    // 현재 캔버스에 표시중인 노드와 펼침 상태
    this.visibleNodes = new Map();
    this.expandedTop = new Set();
    this.expandedLeft = new Set();
    this.expandedRight = new Set();
    this.expandedBottom = new Set();
    this.expandedCouples = new Set();

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
    this.quickEditTitle = document.getElementById('quickEditTitle');
    this.quickEditGender = document.getElementById('quickEditGender');
    this.btnQuickEditDelete = document.getElementById('btnQuickEditDelete');
    this.btnQuickEditCancel = document.getElementById('btnQuickEditCancel');
    this.btnQuickEditClose = document.getElementById('btnQuickEditClose');

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
    if (this.currentUser) {
      if (this.btnAuthToggle) {
        this.btnAuthToggle.innerHTML = '🔒 로그아웃';
        this.btnAuthToggle.title = `${this.currentUser.email} (로그인됨)`;
      }
    } else {
      if (this.btnAuthToggle) {
        this.btnAuthToggle.innerHTML = '🔑 로그인';
        this.btnAuthToggle.title = 'Supabase 로그인';
      }
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
      await supabaseClient.from('genealogy_datasets').update({ title: '그리스 로마 신화' }).eq('dataset_id', 'greek');
      await supabaseClient.from('genealogy_datasets').update({ title: '조선 왕실' }).eq('dataset_id', 'joseon');

      const { data, error } = await supabaseClient
        .from('genealogy_datasets')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        this.datasetsList = data.map(ds => {
          let cleanTitle = ds.title || ds.dataset_id;
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
          { dataset_id: 'greek', title: '그리스 로마 신화' },
          { dataset_id: 'joseon', title: '조선 왕실' }
        ];
      }
    } catch (err) {
      console.warn("Dataset fetch exception:", err);
      this.datasetsList = [
        { dataset_id: 'greek', title: '그리스 로마 신화' },
        { dataset_id: 'joseon', title: '조선 왕실' }
      ];
    }

    this.renderDatasetSelectOptions();
  }

  renderDatasetSelectOptions() {
    if (!this.datasetSelect) return;

    const datasetOptionsHtml = this.datasetsList.map(ds => `
      <option value="${ds.dataset_id}" ${ds.dataset_id === this.currentDatasetKey ? 'selected' : ''}>
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

    if (!supabaseClient) return;

    try {
      const { data, error } = await supabaseClient
        .from('genealogy_nodes')
        .select('id, dataset_id, name, name_eng, title, gender, info, parent_ids, spouse_ids')
        .eq('dataset_id', datasetKey);

      if (error) {
        console.error("Supabase load error:", error);
      }

      this.nodesMap.clear();

      if (data && data.length > 0) {
        data.forEach(node => {
          const nodeName = (node.name && !node.name.startsWith(`${datasetKey}_`)) ? node.name : "이름 없음";

          this.nodesMap.set(node.id, {
            id: node.id,
            name: nodeName,
            nameEng: node.name_eng || "",
            title: node.title || "",
            gender: node.gender || "male",
            info: node.info || "",
            parentIds: Array.isArray(node.parent_ids) ? [...node.parent_ids] : [],
            spouseIds: Array.isArray(node.spouse_ids) ? [...node.spouse_ids] : []
          });
        });
      }
    } catch (err) {
      console.error("Supabase connection exception:", err);
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

  // ── 3. parent_ids 기반 자식 및 부부 공통 자식 추적 ──
  getChildIds(personId) {
    const children = [];
    for (const [id, person] of this.nodesMap.entries()) {
      if (person.parentIds.includes(personId)) {
        children.push(id);
      }
    }
    return children;
  }

  getCommonChildren(p1Id, p2Id) {
    const common = [];
    for (const [cId, person] of this.nodesMap.entries()) {
      if (person.parentIds.includes(p1Id) && person.parentIds.includes(p2Id)) {
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

      if (normName === normalizedInput || (normEng && normEng === normalizedInput)) {
        if (defaultGender && person.gender !== defaultGender) {
          person.gender = defaultGender;
          this.savePersonToDB(id);
        }
        return id;
      }
    }

    const newAutoId = `${this.currentDatasetKey}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newPerson = {
      id: newAutoId,
      name: term,
      nameEng: "",
      title: "",
      gender: defaultGender,
      info: "",
      parentIds: [],
      spouseIds: []
    };
    this.nodesMap.set(newAutoId, newPerson);

    if (supabaseClient) {
      supabaseClient.from('genealogy_nodes').upsert({
        id: newPerson.id,
        dataset_id: this.currentDatasetKey,
        name: newPerson.name,
        name_eng: "",
        title: "",
        gender: newPerson.gender,
        info: "",
        parent_ids: [],
        spouse_ids: [],
        updated_at: new Date().toISOString()
      }).then(() => {});
    }

    return newAutoId;
  }

  async savePersonToDB(personId) {
    const person = this.nodesMap.get(personId);
    if (!person || !supabaseClient) return;

    try {
      await supabaseClient.from('genealogy_nodes').upsert({
        id: person.id,
        dataset_id: this.currentDatasetKey,
        name: person.name,
        name_eng: person.nameEng,
        title: person.title,
        gender: person.gender,
        info: person.info,
        parent_ids: person.parentIds,
        spouse_ids: person.spouseIds,
        updated_at: new Date().toISOString()
      });
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

  recalculateDynamicPositions() {
    const layoutNodes = [];
    const nodePosMap = new Map();

    const focusNode = this.visibleNodes.get(this.focusNodeId);
    if (!focusNode) return { nodes: [], couples: [] };

    const centerX = focusNode.x;
    const centerY = focusNode.y;

    nodePosMap.set(this.focusNodeId, {
      id: this.focusNodeId,
      x: centerX,
      y: centerY,
      isFocus: true
    });

    const focusPerson = this.nodesMap.get(this.focusNodeId);
    const couplePairs = [];

    let leftSiblingMaxX = centerX - 280;
    let siblingTopY = centerY;
    let siblingBottomY = centerY;
    let spouseTopY = centerY;
    let spouseBottomY = centerY;

    if (this.expandedLeft.has(this.focusNodeId)) {
      const siblings = new Set();
      focusPerson.parentIds.forEach(pId => {
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

        siblingTopY = startY - (this.nodeHeight / 2);
        siblingBottomY = startY + totalH + (this.nodeHeight / 2);

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

    if (this.expandedRight.has(this.focusNodeId)) {
      let spouses = focusPerson.spouseIds.filter(spId => this.nodesMap.has(spId));

      let activeSpouseId = null;
      if (this.expandedCouples.size > 0) {
        const activeCoupleKey = Array.from(this.expandedCouples)[0];
        const parts = activeCoupleKey.split('__');
        activeSpouseId = (parts[0] === this.focusNodeId) ? parts[1] : parts[0];
      }

      if (activeSpouseId) {
        spouses = spouses.filter(spId => spId === activeSpouseId);
      }

      if (spouses.length > 0) {
        const rightX = centerX + 280;
        const spouseRowHeight = 62;
        const totalH = (spouses.length - 1) * spouseRowHeight;
        const startY = centerY - (totalH / 2);

        spouseTopY = startY - (this.nodeHeight / 2);
        spouseBottomY = startY + totalH + (this.nodeHeight / 2);

        spouses.forEach((spId, idx) => {
          const spY = startY + (idx * spouseRowHeight);
          nodePosMap.set(spId, {
            id: spId,
            x: rightX,
            y: spY,
            isSpouse: true
          });

          const coupleKey = [this.focusNodeId, spId].sort().join('__');
          couplePairs.push({
            key: coupleKey,
            p1: this.focusNodeId,
            p2: spId,
            midX: (centerX + rightX) / 2,
            midY: (centerY + spY) / 2
          });
        });
      }
    }

    if (this.expandedTop.has(this.focusNodeId)) {
      const parents = focusPerson.parentIds.filter(pId => this.nodesMap.has(pId));
      if (parents.length > 0) {
        const minTopLimit = Math.min(siblingTopY, spouseTopY);
        const parentY = Math.min(centerY - 140, minTopLimit - 60);

        const parentStepX = 220;
        const totalW = (parents.length - 1) * parentStepX;
        const startX = centerX - (totalW / 2);

        parents.forEach((pId, idx) => {
          nodePosMap.set(pId, {
            id: pId,
            x: startX + (idx * parentStepX),
            y: parentY,
            isParent: true
          });
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
      }
    }

    const maxBottomLimit = Math.max(siblingBottomY, spouseBottomY);
    const dynamicChildY = Math.max(centerY + 140, maxBottomLimit + 70);

    let activeCoupleKey = null;
    let coupleChildrenList = [];
    if (this.expandedCouples.size > 0) {
      activeCoupleKey = Array.from(this.expandedCouples)[0];
      const activeCouple = couplePairs.find(c => c.key === activeCoupleKey);
      if (activeCouple) {
        coupleChildrenList = this.getCommonChildren(activeCouple.p1, activeCouple.p2);
      }
    }

    let singleChildrenList = [];
    if (this.expandedBottom.has(this.focusNodeId)) {
      const allFocusChildren = this.getChildIds(this.focusNodeId);
      singleChildrenList = allFocusChildren.filter(cId => {
        const childPerson = this.nodesMap.get(cId);
        if (!childPerson) return false;
        const validParents = childPerson.parentIds.filter(pId => this.nodesMap.has(pId));
        return validParents.length <= 1;
      });
    }

    const allChildIds = [];
    singleChildrenList.forEach(cId => {
      if (!allChildIds.includes(cId)) allChildIds.push(cId);
    });
    coupleChildrenList.forEach(cId => {
      if (!allChildIds.includes(cId)) allChildIds.push(cId);
    });

    if (allChildIds.length > 0) {
      const childStepX = 220;
      const totalW = (allChildIds.length - 1) * childStepX;

      let centerAnchorX = centerX;
      if (activeCoupleKey) {
        const activeCouple = couplePairs.find(c => c.key === activeCoupleKey);
        if (activeCouple) centerAnchorX = activeCouple.midX;
      }

      let startX = centerAnchorX - (totalW / 2);

      const minAllowedChildLeftX = leftSiblingMaxX + 40 + (this.nodeWidth / 2);
      if (startX < minAllowedChildLeftX) {
        startX = minAllowedChildLeftX;
      }

      allChildIds.forEach((cId, idx) => {
        const isCoupleChild = coupleChildrenList.includes(cId);
        const isSingleChild = singleChildrenList.includes(cId);

        nodePosMap.set(cId, {
          id: cId,
          x: startX + (idx * childStepX),
          y: dynamicChildY,
          isCoupleChild,
          isSingleChild,
          coupleKey: isCoupleChild ? activeCoupleKey : null
        });
      });
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

    return { nodes: layoutNodes, couples: couplePairs };
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

      const parentCount = node.parentIds.filter(id => this.nodesMap.has(id)).length;

      const siblings = new Set();
      node.parentIds.forEach(pId => {
        const pChildren = this.getChildIds(pId);
        pChildren.forEach(cId => { if (cId !== node.id) siblings.add(cId); });
      });
      const siblingCount = siblings.size;

      // 💡 현재 캔버스에 '아직 렌더링되지 않은 다른 배우자'가 있을 때만 spouseCount > 0 으로 계산! 💡
      // 일부일처 부부(우라노스-가이아)가 이미 화면에 함께 노출되어 있다면 unrenderedSpouses.length = 0 이 되어 ▶ 버튼이 숨겨집니다.
      const unrenderedSpouses = node.spouseIds.filter(spId => !renderedNodeIds.has(spId) && this.nodesMap.has(spId));
      const spouseCount = unrenderedSpouses.length;

      const allNodeChildren = this.getChildIds(node.id);
      const trueSingleChildCount = allNodeChildren.filter(cId => {
        const childPerson = this.nodesMap.get(cId);
        if (!childPerson) return false;
        const validParents = childPerson.parentIds.filter(pId => this.nodesMap.has(pId));
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
            <button type="button" class="dir-node dir-right ${isRightOpen ? 'open' : ''}" id="dirRight_${node.id}" title="${node.name}의 숨겨진 다른 배우자 (${spouseCount}명)">
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

      el.innerHTML = `
        ${directionalNodesHtml}
        <div class="text-node-content" id="textContent_${node.id}">
          <span class="text-node-name">${this.escapeHtml(node.name)}</span>
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
            if (node.id === this.focusNodeId) {
              if (this.expandedTop.has(node.id)) this.expandedTop.delete(node.id);
              else this.expandedTop.add(node.id);
              this.render();
            } else {
              this.setFocusPerson(node.id);
              this.expandedTop.add(node.id);
              this.render();
            }
          });
        }

        const btnLeft = el.querySelector(`#dirLeft_${node.id}`);
        if (btnLeft) {
          this.preventDrag(btnLeft);
          btnLeft.addEventListener('click', (e) => {
            e.stopPropagation();
            if (node.id === this.focusNodeId) {
              if (this.expandedLeft.has(node.id)) this.expandedLeft.delete(node.id);
              else this.expandedLeft.add(node.id);
              this.render();
            } else {
              this.setFocusPerson(node.id);
              this.expandedLeft.add(node.id);
              this.render();
            }
          });
        }

        const btnRight = el.querySelector(`#dirRight_${node.id}`);
        if (btnRight) {
          this.preventDrag(btnRight);
          btnRight.addEventListener('click', (e) => {
            e.stopPropagation();
            if (node.id === this.focusNodeId) {
              if (this.expandedRight.has(node.id)) {
                this.expandedRight.delete(node.id);
                this.expandedCouples.clear();
              } else {
                this.expandedRight.add(node.id);
              }
              this.render();
            } else {
              this.setFocusPerson(node.id);
              this.expandedRight.add(node.id);
              this.render();
            }
          });
        }

        const btnBottom = el.querySelector(`#dirBottom_${node.id}`);
        if (btnBottom) {
          this.preventDrag(btnBottom);
          btnBottom.addEventListener('click', (e) => {
            e.stopPropagation();
            if (node.id === this.focusNodeId) {
              if (this.expandedBottom.has(node.id)) this.expandedBottom.delete(node.id);
              else this.expandedBottom.add(node.id);
              this.render();
            } else {
              this.setFocusPerson(node.id);
              this.expandedBottom.add(node.id);
              this.render();
            }
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
              this.expandedCouples.clear();
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
            dataset_id: newDatasetId,
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

  // 카드 ✏️ 수정 모달 열기
  openQuickEditModal(personId) {
    const person = this.nodesMap.get(personId);
    if (!person) return;

    if (this.quickEditId) this.quickEditId.value = person.id;
    if (this.quickEditName) this.quickEditName.value = person.name;
    if (this.quickEditTitle) this.quickEditTitle.value = person.title || '';
    if (this.quickEditGender) this.quickEditGender.value = person.gender || 'male';

    this.quickEditModal.classList.add('active');

    setTimeout(() => {
      if (this.quickEditName) this.quickEditName.focus();
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

    if (this.btnQuickEditDelete) {
      this.btnQuickEditDelete.addEventListener('click', async () => {
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

    if (this.quickEditForm) {
      this.quickEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pId = this.quickEditId.value;
        const person = this.nodesMap.get(pId);

        if (person) {
          person.name = this.quickEditName.value.trim();
          person.title = this.quickEditTitle.value.trim();
          person.gender = this.quickEditGender.value;

          await this.savePersonToDB(pId);
          this.closeQuickEditModal();
          this.render();
        }
      });
    }
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

    layout.couples.forEach(couple => {
      const n1 = nodePosMap.get(couple.p1);
      const n2 = nodePosMap.get(couple.p2);

      if (n1 && n2) {
        const x1 = n1.x + (this.nodeWidth / 2);
        const y1 = n1.y;
        const x2 = n2.x - (this.nodeWidth / 2);
        const y2 = n2.y;

        svgHtml += `<path class="connection-line spouse" d="M ${x1} ${y1} L ${x2} ${y2}" />`;
      }
    });

    const focusNode = nodePosMap.get(this.focusNodeId);
    if (focusNode && (this.expandedTop.has(this.focusNodeId) || this.isEditMode)) {
      const parents = focusNode.parentIds.filter(pId => nodePosMap.has(pId));
      if (parents.length > 0) {
        let parentStartX = focusNode.x;
        let parentStartY = focusNode.y - (this.nodeHeight / 2) - 60;

        if (parents.length >= 2) {
          const p1 = nodePosMap.get(parents[0]);
          const p2 = nodePosMap.get(parents[1]);
          if (p1 && p2) {
            const p1X = p1.x + (this.nodeWidth / 2);
            const p2X = p2.x - (this.nodeWidth / 2);
            svgHtml += `<path class="connection-line spouse" d="M ${p1X} ${p1.y} L ${p2X} ${p2.y}" />`;
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

        const focusTopY = focusNode.y - (this.nodeHeight / 2);
        const midY = (parentStartY + focusTopY) / 2;
        svgHtml += `<path class="connection-line active" d="M ${parentStartX} ${parentStartY} V ${midY} H ${focusNode.x} V ${focusTopY}" />`;
      }
    }

    if (focusNode && (this.expandedLeft.has(this.focusNodeId) || this.isEditMode)) {
      layout.nodes.forEach(n => {
        if (n.isSibling) {
          const sX = n.x + (this.nodeWidth / 2);
          const sY = n.y;
          const focusLeftX = focusNode.x - (this.nodeWidth / 2);
          const midX = (sX + focusLeftX) / 2;
          svgHtml += `<path class="connection-line" d="M ${focusLeftX} ${focusNode.y} H ${midX} V ${sY} H ${sX}" />`;
        }
      });
    }

    layout.couples.forEach(couple => {
      if (this.expandedCouples.has(couple.key) || this.isEditMode) {
        layout.nodes.forEach(n => {
          if (n.isCoupleChild) {
            const childTopY = n.y - (this.nodeHeight / 2);
            const midY = (couple.midY + childTopY) / 2;
            svgHtml += `<path class="connection-line active" d="M ${couple.midX} ${couple.midY} V ${midY} H ${n.x} V ${childTopY}" />`;
          }
        });
      }
    });

    if (focusNode && (this.expandedBottom.has(this.focusNodeId) || this.isEditMode)) {
      const focusBottomY = focusNode.y + (this.nodeHeight / 2);
      layout.nodes.forEach(n => {
        if (n.isSingleChild && !n.isCoupleChild) {
          const childTopY = n.y - (this.nodeHeight / 2);
          const midY = (focusBottomY + childTopY) / 2;
          svgHtml += `<path class="connection-line active" d="M ${focusNode.x} ${focusBottomY} V ${midY} H ${n.x} V ${childTopY}" />`;
        }
      });
    }

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
    const newZoom = Math.min(Math.max(0.3, this.zoom * deltaScale), 2.5);
    if (newZoom === this.zoom) return;

    const rect = this.viewport.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    this.panX = mouseX - ((mouseX - this.panX) * (newZoom / this.zoom));
    this.panY = mouseY - ((mouseY - this.panY) * (newZoom / this.zoom));
    this.zoom = newZoom;
    this.updateTransform();
  }

  // ── 10. 이벤트 바인딩 ──
  bindEvents() {
    this.viewport.addEventListener('pointerdown', (e) => {
      if (
        e.target.closest('.genealogy-header') ||
        e.target.closest('.modal-backdrop') ||
        e.target.closest('.empty-placeholder') ||
        e.target.closest('button') ||
        e.target.closest('.text-node') ||
        e.target.closest('.couple-node-btn')
      ) {
        return;
      }
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.lastPanX = this.panX;
      this.lastPanY = this.panY;
      this.viewport.setPointerCapture(e.pointerId);
    });

    this.viewport.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.panX = this.lastPanX + dx;
      this.panY = this.lastPanY + dy;
      this.updateTransform();
    });

    const stopDrag = (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        try { this.viewport.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };
    this.viewport.addEventListener('pointerup', stopDrag);
    this.viewport.addEventListener('pointercancel', stopDrag);

    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomAt(zoomFactor, e.clientX, e.clientY);
    }, { passive: false });

    this.viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this.initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.initialZoom = this.zoom;
      }
    });

    this.viewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this.initialPinchDistance) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = currentDist / this.initialPinchDistance;
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const targetZoom = Math.min(Math.max(0.3, this.initialZoom * factor), 2.5);
        this.zoomAt(targetZoom / this.zoom, centerX, centerY);
      }
    });

    this.viewport.addEventListener('touchend', () => {
      this.initialPinchDistance = null;
    });

    this.btnZoomIn.addEventListener('click', () => {
      const rect = this.viewport.getBoundingClientRect();
      this.zoomAt(1.2, rect.width / 2, rect.height / 2);
    });

    this.btnZoomOut.addEventListener('click', () => {
      const rect = this.viewport.getBoundingClientRect();
      this.zoomAt(0.8, rect.width / 2, rect.height / 2);
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
          }
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) {
        this.searchDropdown.classList.remove('show');
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

    if (this.btnAuthToggle) {
      this.btnAuthToggle.addEventListener('click', () => {
        if (this.currentUser && supabaseClient) {
          if (confirm("로그아웃 하시겠습니까?")) {
            supabaseClient.auth.signOut();
          }
        } else {
          this.loginError.style.display = 'none';
          this.authModal.classList.add('active');
        }
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
      if (
        person.name.toLowerCase().includes(q) ||
        (person.nameEng && person.nameEng.toLowerCase().includes(q)) ||
        (person.title && person.title.toLowerCase().includes(q))
      ) {
        matches.push(person);
      }
    }

    matches.sort((a, b) => {
      const aExact = a.name.toLowerCase() === q ? 0 : 1;
      const bExact = b.name.toLowerCase() === q ? 0 : 1;
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
      this.searchDropdown.innerHTML = `<div class="search-item"><span class="search-item-title">검색 결과가 없습니다.</span></div>`;
    } else {
      this.searchDropdown.innerHTML = matches.slice(0, 8).map(person => `
        <div class="search-item" data-id="${person.id}">
          <div>
            <div class="search-item-name">${this.escapeHtml(person.name)}</div>
            <div class="search-item-title">${this.escapeHtml(person.title || person.nameEng || '')}</div>
          </div>
          <span style="font-size:12px; color:var(--accent);">선택 ➔</span>
        </div>
      `).join('');

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
              <option value="${ds.dataset_id}" ${ds.dataset_id === this.currentDatasetKey ? 'selected' : ''}>
                ${this.escapeHtml(ds.title)} (${ds.dataset_id})
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
        <button class="btn-modal-primary" id="btnAddNewPerson" style="font-size:13px; padding:6px 14px;">+ 새 인물 추가</button>
      </div>

      <div style="margin-bottom:12px;">
        <input type="text" id="editorSearchInput" class="form-control" placeholder="🔍 수정/삭제할 인물 이름 검색 (예: 정종, 세종대왕, 제우스)..." />
      </div>

      <div class="detail-label" id="editorPersonCount">인물 목록 (${allPersons.length}명)</div>
      <div id="editorPersonListContainer" style="max-height:220px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:12px; padding:8px; background:#ffffff;">
      </div>
    `;

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
      const currentDs = this.datasetsList.find(d => d.dataset_id === this.currentDatasetKey);
      const updatedTitle = prompt(`'${this.currentDatasetKey}' 주제의 새 이름을 입력하세요:`, currentDs ? currentDs.title : '')?.trim();
      if (!updatedTitle) return;

      if (supabaseClient) {
        await supabaseClient.from('genealogy_datasets').update({ title: updatedTitle }).eq('dataset_id', this.currentDatasetKey);
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
          await supabaseClient.from('genealogy_datasets').delete().eq('dataset_id', this.currentDatasetKey);
        }

        await this.fetchDatasetsFromDB();
        const nextDs = this.datasetsList[0]?.dataset_id || 'greek';
        await this.loadDataset(nextDs, false);
        this.openEditorModal();
      }
    });

    const renderEditorList = (filterTerm = '') => {
      const container = document.getElementById('editorPersonListContainer');
      const countLabel = document.getElementById('editorPersonCount');
      const term = filterTerm.trim().toLowerCase();

      const filtered = allPersons.filter(p => 
        !term || p.name.toLowerCase().includes(term) || (p.nameEng && p.nameEng.toLowerCase().includes(term))
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

      const existingPerson = this.nodesMap.get(id) || {};

      const updated = {
        id,
        name,
        nameEng: document.getElementById('formNameEng').value.trim(),
        title: existingPerson.title || "",
        gender: selectedGender,
        info: existingPerson.info || "",
        parentIds,
        spouseIds
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
