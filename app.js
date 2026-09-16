/* =========================================================
   IT Asset, Phone Directory & Dashboard System
   app.js — ต้องแนบไฟล์นี้ฉบับเต็มทุกครั้งที่มีการแก้ไข
   ========================================================= */

// ⚠️ แก้ URL นี้เป็น Web App URL ที่ได้จากการ Deploy Google Apps Script (Code.gs)
const API_URL = 'https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXX/exec';

const BRANCHES = ['อโศก', 'ปิ่นเกล้า', 'อุดร'];

const ASSET_TYPES = {
  IPPhone: {
    label: 'IP Phone',
    fields: [
      { key: 'เบอร์ภายใน', label: 'เบอร์ภายใน (Ext.)' },
      { key: 'สายตรง', label: 'สายตรง (Direct Line)' },
      { key: 'IP Address', label: 'IP Address' }
    ],
    columns: ['เบอร์ภายใน', 'สายตรง', 'IP Address']
  },
  EDC: {
    label: 'EDC (เครื่องรูดบัตร)',
    fields: [
      { key: 'ธนาคาร', label: 'ธนาคารเจ้าของเครื่อง' },
      { key: 'TID', label: 'TID' },
      { key: 'MID', label: 'MID' },
      { key: 'IP/SIM', label: 'IP Address / SIM' }
    ],
    columns: ['ธนาคาร', 'TID', 'MID']
  },
  Pinpad: {
    label: 'Pinpad',
    fields: [
      { key: 'Serial Number', label: 'Serial Number (S/N)' },
      { key: 'PC การเงินที่เชื่อมต่อ', label: 'PC การเงินที่เชื่อมต่อ' }
    ],
    columns: ['Serial Number', 'PC การเงินที่เชื่อมต่อ']
  },
  Printer: {
    label: 'Printer',
    fields: [
      { key: 'IP Address', label: 'IP Address' },
      { key: 'ชื่อ Share Printer', label: 'ชื่อ Share Printer' },
      { key: 'รุ่นตลับหมึก', label: 'รุ่นตลับหมึกพิมพ์' }
    ],
    columns: ['IP Address', 'ชื่อ Share Printer', 'รุ่นตลับหมึก']
  },
  ServerPC: {
    label: 'Server / PC',
    fields: [
      { key: 'Hostname', label: 'Hostname' },
      { key: 'IP Address', label: 'IP Address' },
      { key: 'MAC Address', label: 'MAC Address' },
      { key: 'สเปกเครื่อง', label: 'สเปกเครื่อง' }
    ],
    columns: ['Hostname', 'IP Address', 'MAC Address']
  }
};

// ---------------- STATE ----------------
let state = {
  branch: '',
  tab: 'dashboard',
  assetType: 'IPPhone',
  cache: {},      // { [type]: rows[] }
  suggestCache: {}, // { [type]: {อาคาร:[], ชั้น:[], แผนก:[], ตำแหน่งย่อย:[]} }
  editing: null   // row being edited, or null when adding
};

// ---------------- DOM SHORTCUTS ----------------
const $ = (id) => document.getElementById(id);

// ---------------- API ----------------
async function apiGet(params) {
  const url = `${API_URL}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url);
  return res.json();
}
async function apiPost(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // เลี่ยง CORS preflight
    body: JSON.stringify(body)
  });
  return res.json();
}

// ---------------- INIT ----------------
function initBranchSelects() {
  const branchSelect = $('branchSelect');
  const fBranch = $('f_branch');
  BRANCHES.forEach((b) => {
    branchSelect.insertAdjacentHTML('beforeend', `<option value="${b}">${b}</option>`);
    fBranch.insertAdjacentHTML('beforeend', `<option value="${b}">${b}</option>`);
  });
  branchSelect.addEventListener('change', () => {
    state.branch = branchSelect.value;
    state.cache = {}; // ล้างแคชเมื่อเปลี่ยนสาขา
    refreshCurrentTab();
  });
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  ['dashboard', 'directory', 'assets'].forEach((t) => {
    $(`tab-${t}`).classList.toggle('hidden', t !== tab);
  });
  refreshCurrentTab();
}

function refreshCurrentTab() {
  if (state.tab === 'dashboard') loadDashboard();
  if (state.tab === 'directory') loadDirectory();
  if (state.tab === 'assets') loadAssetTab();
}

function initAssetTypeTabs() {
  const wrap = $('assetTypeTabs');
  Object.entries(ASSET_TYPES).forEach(([key, cfg]) => {
    const btn = document.createElement('button');
    btn.textContent = cfg.label;
    btn.dataset.type = key;
    btn.className = 'asset-type-btn whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border ' +
      (key === state.assetType ? 'bg-teal-650 text-white border-teal-650' : 'bg-white text-slate-600 border-slate-300');
    btn.addEventListener('click', () => {
      state.assetType = key;
      document.querySelectorAll('.asset-type-btn').forEach((b) => {
        const active = b.dataset.type === key;
        b.className = 'asset-type-btn whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border ' +
          (active ? 'bg-teal-650 text-white border-teal-650' : 'bg-white text-slate-600 border-slate-300');
      });
      loadAssetTab();
    });
    wrap.appendChild(btn);
  });
}

// ---------------- DASHBOARD ----------------
async function loadDashboard() {
  const [summary, spareList] = await Promise.all([
    apiGet({ action: 'summary' }),
    apiGet({ action: 'spare', branch: state.branch })
  ]);
  renderSummaryCards(summary);
  renderSpareTable(spareList);
}

function renderSummaryCards(summary) {
  const wrap = $('summaryCards');
  wrap.innerHTML = '';
  if (summary.error) { wrap.innerHTML = `<p class="col-span-full text-red-600 text-sm">${summary.error}</p>`; return; }
  Object.entries(ASSET_TYPES).forEach(([key, cfg]) => {
    const count = state.branch ? (summary.byBranch[state.branch]?.[key] ?? 0) : (summary.total[key] ?? 0);
    const spare = summary.spare[key] ?? 0;
    wrap.insertAdjacentHTML('beforeend', `
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <p class="text-xs font-semibold text-slate-500">${cfg.label}</p>
        <p class="text-2xl font-extrabold mt-1 mono">${count}</p>
        <p class="text-[11px] text-slate-400 mt-0.5">สำรอง ${spare} เครื่อง</p>
      </div>
    `);
  });
}

function renderSpareTable(list) {
  const body = $('spareTableBody');
  const empty = $('spareEmpty');
  $('spareCount').textContent = list.length ? `${list.length} รายการ` : '';
  body.innerHTML = '';
  empty.classList.toggle('hidden', list.length > 0);
  list.forEach((r) => {
    const cfg = ASSET_TYPES[r['ประเภท']];
    const detail = cfg.columns.map((c) => r[c]).filter(Boolean).join(' · ');
    const loc = [r['อาคาร'], r['ชั้น'], r['แผนก'], r['ตำแหน่งย่อย']].filter(Boolean).join(' / ');
    body.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="px-4 py-2.5 font-semibold">${cfg.label}</td>
        <td class="px-4 py-2.5">${r['สาขา'] || '-'}</td>
        <td class="px-4 py-2.5 text-slate-500">${loc || '-'}</td>
        <td class="px-4 py-2.5 text-slate-500 mono">${detail || '-'}</td>
      </tr>
    `);
  });
}

// ---------------- DIRECTORY ----------------
let directoryData = [];
async function loadDirectory() {
  directoryData = await apiGet({ action: 'list', type: 'IPPhone', branch: state.branch });
  renderDirectory(directoryData);
}
function renderDirectory(list) {
  const wrap = $('directoryList');
  const empty = $('directoryEmpty');
  wrap.innerHTML = '';
  empty.classList.toggle('hidden', list.length > 0);
  list.forEach((r) => {
    const loc = [r['อาคาร'], r['ชั้น'], r['แผนก'], r['ตำแหน่งย่อย']].filter(Boolean).join(' / ');
    wrap.insertAdjacentHTML('beforeend', `
      <div class="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="font-bold text-sm">${r['แผนก'] || 'ไม่ระบุแผนก'} <span class="text-slate-400 font-normal">· ${r['สาขา'] || '-'}</span></p>
          <p class="text-xs text-slate-400 truncate">${loc || '-'}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="mono font-extrabold text-teal-650 text-lg leading-none">${r['เบอร์ภายใน'] || '-'}</p>
          ${r['สายตรง'] ? `<p class="mono text-xs text-slate-400 mt-1">สายตรง ${r['สายตรง']}</p>` : ''}
        </div>
      </div>
    `);
  });
}
function filterDirectory(q) {
  q = q.trim().toLowerCase();
  if (!q) return renderDirectory(directoryData);
  const filtered = directoryData.filter((r) =>
    ['เบอร์ภายใน', 'สายตรง', 'แผนก', 'ตำแหน่งย่อย', 'อาคาร', 'ชั้น'].some((f) =>
      (r[f] || '').toString().toLowerCase().includes(q))
  );
  renderDirectory(filtered);
}

// ---------------- ASSETS ----------------
let assetData = [];
async function loadAssetTab() {
  $('assetEmpty').classList.add('hidden');
  $('assetLoading').classList.remove('hidden');
  $('assetTableBody').innerHTML = '';
  renderAssetTableHead();

  const [rows, suggest] = await Promise.all([
    apiGet({ action: 'list', type: state.assetType, branch: state.branch }),
    apiGet({ action: 'suggest', type: state.assetType })
  ]);
  assetData = Array.isArray(rows) ? rows : [];
  state.suggestCache[state.assetType] = suggest;
  $('assetLoading').classList.add('hidden');
  renderAssetTable(assetData);
}

function renderAssetTableHead() {
  const cfg = ASSET_TYPES[state.assetType];
  const head = $('assetTableHead');
  head.innerHTML = `
    <th class="text-left font-semibold px-4 py-2">ตำแหน่ง</th>
    ${cfg.columns.map((c) => `<th class="text-left font-semibold px-4 py-2">${c}</th>`).join('')}
    <th class="text-left font-semibold px-4 py-2">สำรอง</th>
    <th class="px-4 py-2"></th>
  `;
}

function renderAssetTable(list) {
  const cfg = ASSET_TYPES[state.assetType];
  const body = $('assetTableBody');
  body.innerHTML = '';
  $('assetEmpty').classList.toggle('hidden', list.length > 0);
  list.forEach((r) => {
    const loc = [r['สาขา'], r['อาคาร'], r['ชั้น'], r['แผนก'], r['ตำแหน่งย่อย']].filter(Boolean).join(' / ');
    const isSpare = r['สำรอง'] === true || r['สำรอง'] === 'TRUE';
    body.insertAdjacentHTML('beforeend', `
      <tr class="hover:bg-slate-50 cursor-pointer" data-id="${r['ID']}">
        <td class="px-4 py-2.5 text-slate-500 max-w-[220px] truncate">${loc || '-'}</td>
        ${cfg.columns.map((c) => `<td class="px-4 py-2.5 mono">${r[c] || '-'}</td>`).join('')}
        <td class="px-4 py-2.5">${isSpare ? '<span class="text-teal-650 font-semibold text-xs">● สำรอง</span>' : ''}</td>
        <td class="px-4 py-2.5 text-right text-slate-300">›</td>
      </tr>
    `);
  });
  body.querySelectorAll('tr').forEach((tr) => {
    tr.addEventListener('click', () => openForm(assetData.find((r) => r['ID'] === tr.dataset.id)));
  });
}

function filterAssets(q) {
  q = q.trim().toLowerCase();
  const cfg = ASSET_TYPES[state.assetType];
  if (!q) return renderAssetTable(assetData);
  const fields = ['สาขา', 'อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย', ...cfg.columns];
  renderAssetTable(assetData.filter((r) => fields.some((f) => (r[f] || '').toString().toLowerCase().includes(q))));
}

// ---------------- FORM MODAL ----------------
function openForm(row) {
  state.editing = row || null;
  const cfg = ASSET_TYPES[state.assetType];
  $('formTitle').textContent = row ? `แก้ไข · ${cfg.label}` : `เพิ่มรายการ · ${cfg.label}`;
  $('btnDeleteItem').classList.toggle('hidden', !row);
  $('formError').classList.add('hidden');
  $('itemForm').reset();
  $('f_id').value = row ? row['ID'] : '';
  $('f_branch').value = row ? row['สาขา'] : (state.branch || BRANCHES[0]);
  $('f_building').value = row ? row['อาคาร'] || '' : '';
  $('f_floor').value = row ? row['ชั้น'] || '' : '';
  $('f_dept').value = row ? row['แผนก'] || '' : '';
  $('f_sub').value = row ? row['ตำแหน่งย่อย'] || '' : '';
  $('f_note').value = row ? row['หมายเหตุ'] || '' : '';
  $('f_spare').checked = row ? (row['สำรอง'] === true || row['สำรอง'] === 'TRUE') : false;

  // datalists
  const sug = state.suggestCache[state.assetType] || {};
  fillDatalist('dl_building', sug['อาคาร']);
  fillDatalist('dl_floor', sug['ชั้น']);
  fillDatalist('dl_dept', sug['แผนก']);
  fillDatalist('dl_sub', sug['ตำแหน่งย่อย']);

  // dynamic fields
  const dyn = $('dynamicFields');
  dyn.innerHTML = cfg.fields.map((f) => `
    <div class="${f.key === 'สเปกเครื่อง' ? 'col-span-2' : ''}">
      <label class="text-xs font-semibold text-slate-500">${f.label}</label>
      <input data-field="${f.key}" value="${row ? (row[f.key] || '') : ''}"
        class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
    </div>
  `).join('');

  $('formModal').classList.remove('hidden');
  $('formModal').classList.add('flex');
}

function fillDatalist(id, values) {
  $(id).innerHTML = (values || []).map((v) => `<option value="${v}">`).join('');
}

function closeForm() {
  $('formModal').classList.add('hidden');
  $('formModal').classList.remove('flex');
  state.editing = null;
}

async function submitForm(e) {
  e.preventDefault();
  const cfg = ASSET_TYPES[state.assetType];
  const data = {
    ID: $('f_id').value || undefined,
    'สาขา': $('f_branch').value,
    'อาคาร': $('f_building').value,
    'ชั้น': $('f_floor').value,
    'แผนก': $('f_dept').value,
    'ตำแหน่งย่อย': $('f_sub').value,
    'สำรอง': $('f_spare').checked,
    'หมายเหตุ': $('f_note').value
  };
  $('dynamicFields').querySelectorAll('[data-field]').forEach((inp) => { data[inp.dataset.field] = inp.value; });

  const pin = $('f_pin').value;
  setFormBusy(true);
  const res = await apiPost({ action: 'save', type: state.assetType, pin, data });
  setFormBusy(false);

  if (res.error) return showFormError(res.error);
  closeForm();
  showToast(state.editing ? 'แก้ไขข้อมูลเรียบร้อย' : 'เพิ่มรายการเรียบร้อย');
  loadAssetTab();
}

async function deleteCurrentItem() {
  if (!state.editing) return;
  const pin = prompt('กรอกรหัส PIN เพื่อยืนยันการลบ');
  if (pin === null) return;
  const res = await apiPost({ action: 'delete', type: state.assetType, pin, id: state.editing['ID'] });
  if (res.error) return showToast(res.error);
  closeForm();
  showToast('ลบรายการเรียบร้อย');
  loadAssetTab();
}

function setFormBusy(busy) {
  $('btnSaveForm').disabled = busy;
  $('btnSaveForm').textContent = busy ? 'กำลังบันทึก...' : 'บันทึก';
}
function showFormError(msg) {
  $('formError').textContent = msg;
  $('formError').classList.remove('hidden');
}

// ---------------- TOAST ----------------
let toastTimer;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2500);
}

// ---------------- WIRE UP ----------------
document.addEventListener('DOMContentLoaded', () => {
  initBranchSelects();
  initTabs();
  initAssetTypeTabs();
  renderAssetTableHead();

  $('directorySearch').addEventListener('input', (e) => filterDirectory(e.target.value));
  $('assetSearch').addEventListener('input', (e) => filterAssets(e.target.value));
  $('btnAddNew').addEventListener('click', () => openForm(null));
  $('formClose').addEventListener('click', closeForm);
  $('btnCancelForm').addEventListener('click', closeForm);
  $('itemForm').addEventListener('submit', submitForm);
  $('btnDeleteItem').addEventListener('click', deleteCurrentItem);

  loadDashboard();
});
