// =============================================================================
// 共通テスト化学データベース - アプリケーション
// マルチ出版社・年度対応 + 画像手動修正（管理モード）
// =============================================================================

// --- State ---
let allBooks = [];
let flatQuestions = [];
let currentSearch = '';
let activeFilters = { publisher: null, year: null, subject: null, round: null, units: new Set() };
let selectedQuestions = new Set();
let selectMode = false;
let adminMode = false;
let currentViewMode = 'pair';
let lastFocusedType = 'answer';  // pairモードCtrl+Vペースト時のデフォルトターゲット
let currentViewData = null;

// --- 排他制御: 連続ペースト時のレースコンディション防止 ---
const imageOpQueues = new Map();

async function withImageLock(key, fn) {
  const prev = imageOpQueues.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);  // 前の操作が失敗しても次を実行
  imageOpQueues.set(key, next);
  try { await next; } finally {
    // キューが現在のnextなら掃除
    if (imageOpQueues.get(key) === next) imageOpQueues.delete(key);
  }
}

// --- IndexedDB ---
const DB_NAME = 'chemdb_overrides';
const DB_VERSION = 1;
const STORE_NAME = 'image_overrides';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOverride(key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function setOverride(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteOverride(key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => resolve();
  });
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  loadAllBooks();
  buildFilterUI();
  renderCards();
  setupEventListeners();
});

// --- Load Books from global variables ---
function loadAllBooks() {
  allBooks = [];
  flatQuestions = [];

  BOOK_REGISTRY.forEach(reg => {
    if (!reg.enabled) return;
    const varName = `BOOK_DATA_${reg.id}`;
    const bookData = window[varName];
    if (!bookData) { console.warn(`Book data not found: ${varName}`); return; }
    allBooks.push(bookData);

    (bookData.rounds || []).forEach(round => {
      (round.questions || []).forEach(q => {
        flatQuestions.push({
          book: bookData,
          round,
          question: q,
          allTags: getAllTags(q),
          overrideKeyProblem: `${bookData.id}/${q.id}/problem`,
          overrideKeyAnswer: `${bookData.id}/${q.id}/answer`
        });
      });
    });
  });
}

function getAllTags(q) {
  const tags = [];
  (q.tags.aggregate_tags || []).forEach(t => tags.push(t));
  Object.values(q.tags.sub_questions || {}).forEach(subTags => {
    subTags.forEach(t => { if (!tags.includes(t)) tags.push(t); });
  });
  return tags;
}

// --- Build Filter UI ---
function buildFilterUI() {
  const publishers = [...new Set(allBooks.map(b => b.publisher))];
  renderChips('publisherFilters', publishers, 'publisher', p => {
    const theme = PUBLISHER_THEMES[p] || {};
    return `<span class="chip-icon">${theme.icon || '📕'}</span>${p}`;
  });

  const years = [...new Set(allBooks.map(b => b.year))].sort((a,b) => b-a);
  renderChips('yearFilters', years, 'year', y => `${y}年`);

  const subjects = [...new Set(allBooks.map(b => b.subject))];
  renderChips('subjectFilters', subjects, 'subject');

  const rounds = [...new Set(allBooks.flatMap(b => (b.rounds||[]).map(r => r.title)))].sort();
  renderChips('roundFilters', rounds, 'round');

  const units = Object.keys(TAG_CATEGORIES);
  const container = document.getElementById('unitFilters');
  container.innerHTML = units.map(u => {
    const info = TAG_CATEGORIES[u];
    return `<button class="filter-chip" data-filter-type="unit" data-value="${u}">
      <span class="chip-icon">${info.icon}</span>${u}
    </button>`;
  }).join('');
  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      if (activeFilters.units.has(val)) { activeFilters.units.delete(val); btn.classList.remove('active'); }
      else { activeFilters.units.add(val); btn.classList.add('active'); }
      renderCards();
    });
  });
}

function renderChips(containerId, values, filterKey, labelFn) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = values.map(v => {
    const label = labelFn ? labelFn(v) : v;
    return `<button class="filter-chip" data-filter-type="${filterKey}" data-value="${v}">${label}</button>`;
  }).join('');
  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      const isNumber = !isNaN(val);
      const parsed = isNumber ? parseInt(val) : val;
      if (activeFilters[filterKey] === parsed) {
        activeFilters[filterKey] = null;
        btn.classList.remove('active');
      } else {
        container.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        activeFilters[filterKey] = parsed;
        btn.classList.add('active');
      }
      renderCards();
    });
  });
}

// --- Event Listeners ---
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.trim();
    document.getElementById('clearSearch').classList.toggle('visible', currentSearch.length > 0);
    renderCards();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  document.getElementById('viewerModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.addEventListener('paste', async (e) => {
    if (!adminMode || !currentViewData) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        await handleAdminImageAdd(file);
        break;
      }
    }
  });
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  currentSearch = '';
  document.getElementById('clearSearch').classList.remove('visible');
  renderCards();
}

// --- Filtering ---
function getFilteredQuestions() {
  return flatQuestions.filter(({ book, round, question, allTags }) => {
    if (activeFilters.publisher && book.publisher !== activeFilters.publisher) return false;
    if (activeFilters.year && book.year !== activeFilters.year) return false;
    if (activeFilters.subject && book.subject !== activeFilters.subject) return false;
    if (activeFilters.round && round.title !== activeFilters.round) return false;
    if (activeFilters.units.size > 0) {
      const hasMatch = [...activeFilters.units].some(u => allTags.some(t => t.includes(u) || u.includes(t)));
      if (!hasMatch) return false;
    }
    if (currentSearch) {
      const s = currentSearch.toLowerCase();
      const searchable = [...allTags, question.name, question.tips?.topic || '', round.title, book.title, book.publisher].join(' ').toLowerCase();
      if (!searchable.includes(s)) return false;
    }
    return true;
  });
}

// --- Render Cards ---
function renderCards() {
  const grid = document.getElementById('cardsGrid');
  const noResults = document.getElementById('noResults');
  const results = getFilteredQuestions();

  document.getElementById('statsText').innerHTML = `<strong>${results.length}</strong> 件の問題`;

  if (results.length === 0) { grid.innerHTML = ''; noResults.style.display = 'block'; return; }
  noResults.style.display = 'none';

  grid.innerHTML = results.map(({ book, round, question, allTags }) => {
    const isSelected = selectedQuestions.has(`${book.id}/${question.id}`);
    const pTheme = PUBLISHER_THEMES[book.publisher] || { color: '#6366f1', bg: 'rgba(99,102,241,0.15)' };
    const imageCount = (question.problemImages?.length || 0) + (question.answerImages?.length || 0);
    const matchedTags = allTags.map(tag => {
      const isHighlight = (currentSearch && tag.toLowerCase().includes(currentSearch.toLowerCase()))
        || [...activeFilters.units].some(f => tag.includes(f) || f.includes(tag));
      return `<span class="card-tag ${isHighlight ? 'highlight' : ''}">${tag}</span>`;
    }).join('');

    return `
      <div class="question-card ${isSelected ? 'selected' : ''}"
           onclick="handleCardClick('${book.id}','${question.id}',event)">
        <div class="card-select-check">${isSelected ? '✓' : ''}</div>
        <div class="card-header">
          <span class="card-publisher-badge" style="background:${pTheme.color}">${book.publisher}</span>
          <span class="card-round-badge">${round.title}</span>
          <div class="card-title-area">
            <div class="card-title">${question.name}</div>
            <div class="card-meta">
              <span>配点${question.score}点</span>
              <span>目安${question.timeMinutes}分</span>
              <span>📄${imageCount}p</span>
            </div>
            <div class="card-source">${book.title}</div>
          </div>
        </div>
        <div class="card-tags">${matchedTags}</div>
        <div class="card-topic">${question.tips?.topic || ''}</div>
        <div class="card-footer">
          <span>${allTags[0] || ''}</span>
          <div class="card-footer-actions">
            <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation();openViewer('${book.id}','${question.id}')" title="表示">👁️</button>
            <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation();printSingle('${book.id}','${question.id}')" title="印刷">🖨️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --- Card Click ---
function handleCardClick(bookId, qId, event) {
  if (selectMode) {
    const key = `${bookId}/${qId}`;
    if (selectedQuestions.has(key)) selectedQuestions.delete(key); else selectedQuestions.add(key);
    updateSelectionUI(); renderCards();
  } else {
    openViewer(bookId, qId);
  }
}

// --- Select Mode ---
function toggleSelectMode() {
  selectMode = !selectMode;
  document.getElementById('selectModeBtn').textContent = selectMode ? '☑' : '☐';
  if (!selectMode) clearSelection();
}

function clearSelection() { selectedQuestions.clear(); updateSelectionUI(); renderCards(); }

function updateSelectionUI() {
  const bar = document.getElementById('selectionBar');
  bar.classList.toggle('visible', selectedQuestions.size > 0);
  document.getElementById('selCount').textContent = `${selectedQuestions.size} 件選択中`;
}

function toggleAllSelect() {
  const results = getFilteredQuestions();
  if (selectedQuestions.size === results.length) { clearSelection(); return; }
  selectMode = true;
  document.getElementById('selectModeBtn').textContent = '☑';
  results.forEach(r => selectedQuestions.add(`${r.book.id}/${r.question.id}`));
  updateSelectionUI(); renderCards();
}

// --- Find Question ---
function findQuestion(bookId, qId) {
  return flatQuestions.find(f => f.book.id === bookId && f.question.id === qId) || null;
}

// --- Admin Mode ---
function toggleAdminMode() {
  adminMode = !adminMode;
  document.body.classList.toggle('admin-mode', adminMode);
  document.getElementById('adminIndicator').classList.toggle('active', adminMode);
  if (currentViewData) renderViewerContent();
}

// --- Viewer Modal ---
async function openViewer(bookId, qId) {
  const data = findQuestion(bookId, qId);
  if (!data) return;
  currentViewData = data;
  currentViewMode = 'pair';

  const { book, round, question } = data;
  document.getElementById('modalTitle').innerHTML = `
    <span class="badge" style="background:${(PUBLISHER_THEMES[book.publisher]||{}).color || '#6366f1'}">${book.publisher}</span>
    <span class="badge">${round.title}</span>
    <span>${question.name}</span>
    <span style="font-size:12px;color:var(--text-muted);font-weight:400">(${question.score}点/${question.timeMinutes}分)</span>
  `;

  document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === 'pair'));
  await renderViewerContent();
  document.getElementById('viewerModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function switchView(mode) {
  currentViewMode = mode;
  document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === mode));
  renderViewerContent();
}

async function renderViewerContent() {
  if (!currentViewData) return;
  const { book, question } = currentViewData;
  const body = document.getElementById('modalBody');

  const problemImgs = await resolveImages(book, question, 'problem');
  const answerImgs = await resolveImages(book, question, 'answer');

  let imagesHtml = '';
  if (currentViewMode === 'pair') {
    imagesHtml = `<div class="gallery-pair">
      <div class="gallery-column"><h3>📝 問題</h3>${renderImgList(problemImgs, book.id, question.id, 'problem')}</div>
      <div class="gallery-column"><h3>✅ 解答・解説</h3>${renderImgList(answerImgs, book.id, question.id, 'answer')}</div>
    </div>`;
  } else if (currentViewMode === 'problem') {
    imagesHtml = `<div class="image-gallery">${renderImgList(problemImgs, book.id, question.id, 'problem')}</div>`;
  } else {
    imagesHtml = `<div class="image-gallery">${renderImgList(answerImgs, book.id, question.id, 'answer')}</div>`;
  }

  const q = question;
  const subQHtml = Object.entries(q.tags.sub_questions || {}).map(([label, tags]) => `
    <div class="sub-question"><span class="sub-question-label">${label}</span>
    <div class="sub-question-tags">${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div></div>`).join('');
  const tipsHtml = q.tips ? `<div class="tips-section"><h3>📚 学習ガイド</h3>
    <div class="sub-questions">${subQHtml}</div>
    <div class="tip-card" style="margin-top:12px"><h4>⚠️ つまずきやすいポイント</h4><ul>${(q.tips.stumbling_points||[]).map(p=>`<li>${p}</li>`).join('')}</ul></div>
    <div class="tip-start">${q.tips.key_to_start||''}</div></div>` : '';

  body.innerHTML = tipsHtml + imagesHtml;
  if (adminMode) setupAdminDropZones();
}

async function resolveImages(book, question, type) {
  const key = `${book.id}/${question.id}/${type}`;
  const override = await getOverride(key);
  if (override && override.length > 0) {
    return override.map(item => ({ src: item.src, isOverride: true, label: item.label }));
  }
  const originals = type === 'problem' ? question.problemImages : question.answerImages;
  return (originals || []).map(path => ({ src: `${book.basePath}${path}`, isOverride: false, label: path }));
}

function renderImgList(images, bookId, qId, type) {
  if (!images || images.length === 0) {
    const dropZone = adminMode ? renderDropZone(bookId, qId, type) : '';
    return `<div class="empty-images"><div class="empty-icon">📄</div><p>画像なし</p></div>${dropZone}`;
  }

  let html = images.map((img, idx) => {
    if (adminMode) {
      return `<div class="admin-img-wrapper" data-idx="${idx}" data-book="${bookId}" data-qid="${qId}" data-type="${type}">
        <img src="${img.src}" alt="${img.label}" loading="lazy">
        <div class="admin-img-actions">
          ${idx > 0 ? `<button class="btn-up" onclick="event.stopPropagation();moveImage('${bookId}','${qId}','${type}',${idx},-1)" title="上に移動">↑</button>` : ''}
          ${idx < images.length - 1 ? `<button class="btn-down" onclick="event.stopPropagation();moveImage('${bookId}','${qId}','${type}',${idx},1)" title="下に移動">↓</button>` : ''}
          <button class="btn-del" onclick="event.stopPropagation();removeImage('${bookId}','${qId}','${type}',${idx})" title="削除">🗑</button>
        </div>
      </div>`;
    }
    return `<img src="${img.src}" alt="${img.label}" loading="lazy">`;
  }).join('');

  if (adminMode) html += renderDropZone(bookId, qId, type);
  return html;
}

function renderDropZone(bookId, qId, type) {
  return `<div class="admin-drop-zone" data-book="${bookId}" data-qid="${qId}" data-type="${type}">
    <span style="font-size:20px">📎</span>
    <span>ここに画像をドラッグ&ドロップ、または<br>Ctrl+Vでペースト、クリックでファイル選択</span>
    <input type="file" accept="image/*" multiple>
  </div>`;
}

function setupAdminDropZones() {
  document.querySelectorAll('.admin-drop-zone').forEach(zone => {
    const bookId = zone.dataset.book;
    const qId = zone.dataset.qid;
    const type = zone.dataset.type;
    const fileInput = zone.querySelector('input[type="file"]');

    zone.addEventListener('click', () => { lastFocusedType = type; fileInput.click(); });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); lastFocusedType = type; zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      lastFocusedType = type;
      for (const file of e.dataTransfer.files) {
        if (file.type.startsWith('image/')) await addImageFromFile(bookId, qId, type, file);
      }
    });
    fileInput.addEventListener('change', async (e) => {
      for (const file of e.target.files) {
        if (file.type.startsWith('image/')) await addImageFromFile(bookId, qId, type, file);
      }
    });
  });

  // gallery-column のクリック・mouseenterでもフォーカスを記録（問題/解答ヘッダー等のクリック）
  document.querySelectorAll('.gallery-column').forEach(col => {
    const updateFocus = () => {
      const zone = col.querySelector('.admin-drop-zone');
      if (zone) lastFocusedType = zone.dataset.type;
    };
    col.addEventListener('click', updateFocus);
    col.addEventListener('mouseenter', updateFocus);
  });
}

async function handleAdminImageAdd(file) {
  if (!currentViewData) return;
  const { book, question } = currentViewData;
  let type;
  if (currentViewMode === 'answer') {
    type = 'answer';
  } else if (currentViewMode === 'problem') {
    type = 'problem';
  } else {
    // pairモード: 最後にクリック/操作した側にペースト（デフォルトはanswer）
    type = lastFocusedType || 'answer';
  }
  await addImageFromFile(book.id, question.id, type, file);
}

async function addImageFromFile(bookId, qId, type, file) {
  const dataUrl = await fileToDataUrl(file);
  const key = `${bookId}/${qId}/${type}`;

  await withImageLock(key, async () => {
    let existing = await getOverride(key);

    if (!existing) {
      const data = findQuestion(bookId, qId);
      if (data) {
        const originals = type === 'problem' ? data.question.problemImages : data.question.answerImages;
        existing = await Promise.all((originals || []).map(async (path) => {
          try {
            const resp = await fetch(`${data.book.basePath}${path}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const origDataUrl = await blobToDataUrl(blob);
            return { src: origDataUrl, label: path };
          } catch {
            // fetch失敗時はスキップ（相対パスを混在させない）
            console.warn(`Failed to fetch original image: ${path}`);
            return null;
          }
        }));
        existing = existing.filter(item => item !== null);
      } else {
        existing = [];
      }
    }

    existing.push({ src: dataUrl, label: `pasted_${Date.now()}` });
    await setOverride(key, existing);
  });
  await renderViewerContent();
}

async function removeImage(bookId, qId, type, idx) {
  const key = `${bookId}/${qId}/${type}`;

  await withImageLock(key, async () => {
    let images = await getOverride(key);

    if (!images) {
      const data = findQuestion(bookId, qId);
      if (!data) return;
      const originals = type === 'problem' ? data.question.problemImages : data.question.answerImages;
      images = await Promise.all((originals || []).map(async (path) => {
        try {
          const resp = await fetch(`${data.book.basePath}${path}`);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          return { src: await blobToDataUrl(blob), label: path };
        } catch {
          console.warn(`Failed to fetch original image: ${path}`);
          return null;
        }
      }));
      images = images.filter(item => item !== null);
    }

    images.splice(idx, 1);
    // 空配列でも保持する（deleteOverrideしない）
    // → 次回追加時にオリジナル画像の意図しない復活を防ぐ
    await setOverride(key, images);
  });
  await renderViewerContent();
}

async function moveImage(bookId, qId, type, idx, direction) {
  const key = `${bookId}/${qId}/${type}`;

  await withImageLock(key, async () => {
    let images = await getOverride(key);

    if (!images) {
      const data = findQuestion(bookId, qId);
      if (!data) return;
      const originals = type === 'problem' ? data.question.problemImages : data.question.answerImages;
      images = await Promise.all((originals || []).map(async (path) => {
        try {
          const resp = await fetch(`${data.book.basePath}${path}`);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          return { src: await blobToDataUrl(blob), label: path };
        } catch {
          console.warn(`Failed to fetch original image: ${path}`);
          return null;
        }
      }));
      images = images.filter(item => item !== null);
    }

    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= images.length) return;
    [images[idx], images[newIdx]] = [images[newIdx], images[idx]];
    await setOverride(key, images);
  });
  await renderViewerContent();
}

// --- Utilities ---
function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// --- Close Modal ---
function closeModal() {
  document.getElementById('viewerModal').classList.remove('active');
  document.body.style.overflow = '';
  currentViewData = null;
}

// --- Print ---
function printCurrent() {
  if (!currentViewData) return;
  preparePrint([currentViewData]);
}

function printSingle(bookId, qId) {
  const d = findQuestion(bookId, qId);
  if (d) preparePrint([d]);
}

function printSelected() {
  const items = [];
  selectedQuestions.forEach(key => {
    const [bookId, qId] = key.split('/');
    const d = findQuestion(bookId, qId);
    if (d) items.push(d);
  });
  if (items.length > 0) preparePrint(items);
}

function viewSelected() {
  const keys = [...selectedQuestions];
  if (keys.length > 0) {
    const [bookId, qId] = keys[0].split('/');
    openViewer(bookId, qId);
  }
}

async function preparePrint(items) {
  const printBody = document.getElementById('printBody');
  const printHeader = document.getElementById('printHeader');
  const printModal = document.getElementById('printModal');

  printHeader.textContent = items.map(d => `${d.round.title} ${d.question.name}`).join(' / ');

  let html = '';
  for (const { book, round, question } of items) {
    const problemImgs = await resolveImages(book, question, 'problem');
    const answerImgs = await resolveImages(book, question, 'answer');
    const title = `${book.publisher} ${book.year}年 ${round.title} ${question.name}（${question.score}点）`;

    html += problemImgs.map((img, idx) => {
      const pb = idx > 0 ? 'page-break-before:always;' : '';
      const hdr = idx === 0 ? `<div style="font-size:11px;font-weight:bold;color:#333;border-bottom:1px solid #999;padding-bottom:1px;margin-bottom:2px">${title} ─ 問題</div>` : '';
      const mh = idx === 0 ? '270mm' : '277mm';
      return `<div style="${pb}text-align:center">${hdr}<img src="${img.src}" style="display:block;max-width:100%;max-height:${mh};width:auto;height:auto;object-fit:contain;margin:0 auto"></div>`;
    }).join('');

    html += answerImgs.map((img, idx) => {
      const hdr = idx === 0 ? `<div style="font-size:11px;font-weight:bold;color:#333;border-bottom:1px solid #999;padding-bottom:1px;margin-bottom:2px">${title} ─ 解答・解説</div>` : '';
      const mh = idx === 0 ? '270mm' : '277mm';
      return `<div style="page-break-before:always;text-align:center">${hdr}<img src="${img.src}" style="display:block;max-width:100%;max-height:${mh};width:auto;height:auto;object-fit:contain;margin:0 auto"></div>`;
    }).join('');
  }

  printBody.innerHTML = html;
  printModal.classList.add('active');
  document.getElementById('viewerModal').classList.remove('active');

  const imgs = printBody.querySelectorAll('img');
  const promises = Array.from(imgs).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });
  await Promise.all(promises);
  await new Promise(r => setTimeout(r, 200));
  window.print();
  printModal.classList.remove('active');
  document.body.style.overflow = '';
}

// --- Theme Toggle ---
function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = isLight ? '🌙' : '☀️';
  try { localStorage.setItem('chemdb_theme', isLight ? 'dark' : 'light'); } catch {}
}

// Apply saved theme on load
(function() {
  try {
    const saved = localStorage.getItem('chemdb_theme');
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      const btn = document.getElementById('themeToggle');
      if (btn) btn.textContent = '☀️';
    }
  } catch {}
})();

// --- Help Modal ---
function openHelp() {
  document.getElementById('helpModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeHelp() {
  document.getElementById('helpModal').classList.remove('active');
  document.body.style.overflow = '';
}
