/* =========================================================
   IT Asset, Phone Directory & Dashboard System
   app.js v3 — ต้องแนบไฟล์นี้ฉบับเต็มทุกครั้งที่มีการแก้ไข

   เปลี่ยนจาก v2:
   1. ไม่มี BRANCHES / ASSET_TYPES hardcode อีกต่อไป — ดึงจาก bootstrap ทั้งหมด
      (สาขา, ประเภทอุปกรณ์, ฟิลด์ มาจากชีต Config/SchemaTypes/SchemaFields ฝั่ง backend)
   2. login ตรวจฝั่ง server (action=login) ไม่ฝัง user/password ไว้ในไฟล์นี้อีกต่อไป
   3. เพิ่มแท็บ Admin: จัดการสาขา, ตั้งค่า PIN/Login, ดู Log ย้อนหลัง (กรองวันที่/ประเภท),
      จัดการประเภทอุปกรณ์และฟิลด์ (เพิ่ม/แก้ไข/ลบจริง)
   4. ฟิลด์รองรับ 3 ชนิด: text / dropdown (มีตัวเลือก) / date
   ========================================================= */

const API_URL = 'https://script.google.com/macros/s/AKfycbwZvOGA6_o2E2-0-fX3_SkASsyaPmhnMRiWydv8wiqFu58UGQH9mvh690YQMGT3FQVc/exec';

const LOC_FIELDS = ['อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย'];

// ---------------- STATE ----------------
const state = {
  branch: localStorage.getItem('it.branch') || '',
  tab: 'dashboard',
  assetType: '',
  adminPane: 'branches',
  branches: [],
  schema: { types: [], fieldsByType: {} },
  db: {},
  updated: '',
  editing: null
};

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isSpare = (r) => r['สำรอง'] === true || r['สำรอง'] === 'TRUE' || r['สำรอง'] === 'true';
const locOf = (r, withBranch) => [withBranch ? r['สาขา'] : null, r['อาคาร'], r['ชั้น'], r['แผนก'], r['ตำแหน่งย่อย']].filter(Boolean).join(' / ');

function typeCfg(key) {
  const t = state.schema.types.find((x) => x.key === key);
  const fields = state.schema.fieldsByType[key] || [];
  return {
    label: t ? t.label : key,
    fields,
    columns: fields.filter((f) => f.showInTable).map((f) => f.key)
  };
}

// ---------------- API ----------------
async function apiPost(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function setStatus(text, kind) {
  $('status').className = 'status' + (kind ? ' ' + kind : '');
  $('statusText').textContent = text;
}

function hasData() { return Object.keys(state.db).length > 0; }

async function loadAll(silent) {
  if (!silent) setStatus(hasData() ? 'กำลังตรวจสอบข้อมูลใหม่…' : 'กำลังโหลดข้อมูล…');
  $('btnReload').disabled = true;
  try {
    const res = await fetch(API_URL + '?action=bootstrap&t=' + Date.now());
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    state.branches = json.branches || [];
    state.schema = json.schema || { types: [], fieldsByType: {} };
    state.db = json.data || {};
    state.updated = json.updated || '';
    if (!state.assetType && state.schema.types.length) state.assetType = state.schema.types[0].key;
    localStorage.setItem('it.db', JSON.stringify({
      branches: state.branches, schema: state.schema, data: state.db, updated: state.updated
    }));
    renderAll();
    setStatus('ข้อมูลล่าสุด ' + state.updated, 'live');
  } catch (err) {
    setStatus(hasData()
      ? 'เชื่อมต่อไม่ได้ กำลังแสดงข้อมูลที่บันทึกไว้ในเครื่อง (' + state.updated + ')'
      : 'โหลดข้อมูลไม่สำเร็จ: ' + err.message, 'err');
  } finally {
    $('btnReload').disabled = false;
  }
}

function loadFromCache() {
  try {
    const raw = localStorage.getItem('it.db');
    if (!raw) return false;
    const c = JSON.parse(raw);
    if (!c || !c.data) return false;
    state.branches = c.branches || [];
    state.schema = c.schema || { types: [], fieldsByType: {} };
    state.db = c.data;
    state.updated = c.updated || '';
    if (!state.assetType && state.schema.types.length) state.assetType = state.schema.types[0].key;
    return true;
  } catch (e) { return false; }
}

function rowsOf(type) {
  const rows = state.db[type] || [];
  return state.branch ? rows.filter((r) => r['สาขา'] === state.branch) : rows;
}

function suggestFor(type, field) {
  const set = new Set();
  (state.db[type] || []).forEach((r) => { if (r[field]) set.add(String(r[field])); });
  return [...set].sort();
}

// ---------------- INIT ----------------
function renderBranchSelect() {
  const sel = $('branchSelect');
  const fb = $('f_branch');
  const opts = state.branches.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
  sel.innerHTML = '<option value="">ทุกสาขา</option>' + opts;
  fb.innerHTML = opts;
  sel.value = state.branch;
}

function initBranchSelect() {
  $('branchSelect').addEventListener('change', (e) => {
    state.branch = e.target.value;
    localStorage.setItem('it.branch', state.branch);
    renderAll();
  });
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
}

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  ['dashboard', 'directory', 'assets', 'admin'].forEach((t) => $('tab-' + t).classList.toggle('hidden', t !== tab));
  if (tab === 'admin') renderAdmin();
}

function renderAssetTypeTabs() {
  $('assetTypeTabs').innerHTML = state.schema.types.map((t) =>
    `<button type="button" data-type="${t.key}" aria-pressed="${t.key === state.assetType}">${esc(t.label)}</button>`
  ).join('');
}

function initAssetTypeTabs() {
  $('assetTypeTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-type]');
    if (!btn) return;
    state.assetType = btn.dataset.type;
    document.querySelectorAll('#assetTypeTabs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.type === state.assetType));
    $('assetSearch').value = '';
    renderAssets();
  });
}

// ---------------- RENDER: dashboard / directory / assets ----------------
function renderAll() {
  renderBranchSelect();
  renderAssetTypeTabs();
  renderDashboard();
  renderDirectory();
  renderAssets();
  if (state.tab === 'admin') renderAdmin();
}

function renderDashboard() {
  $('summaryCards').innerHTML = state.schema.types.map((t) => {
    const rows = rowsOf(t.key);
    const spare = rows.filter(isSpare).length;
    return `<div class="card">
      <p class="lbl">${esc(t.label)}</p>
      <p class="num mono">${rows.length}</p>
      <p class="sub">สำรอง ${spare} เครื่อง</p>
    </div>`;
  }).join('');

  const list = [];
  state.schema.types.forEach((t) => rowsOf(t.key).filter(isSpare).forEach((r) => list.push({ type: t.key, r })));

  $('spareCount').textContent = list.length ? list.length + ' รายการ' : '';
  $('spareEmpty').classList.toggle('hidden', list.length > 0);
  $('spareTableBody').innerHTML = list.map(({ type, r }) => {
    const cfg = typeCfg(type);
    const detail = cfg.columns.map((c) => r[c]).filter(Boolean).join(' · ');
    return `<tr>
      <td style="font-weight:600">${esc(cfg.label)}</td>
      <td>${esc(r['สาขา'] || '-')}</td>
      <td class="loc">${esc(locOf(r, false) || '-')}</td>
      <td class="loc mono">${esc(detail || '-')}</td>
    </tr>`;
  }).join('');
}

function renderDirectory() {
  const q = $('directorySearch').value.trim().toLowerCase();
  let rows = state.schema.types.some((t) => t.key === 'IPPhone') ? rowsOf('IPPhone') : [];
  if (q) {
    const keys = ['เบอร์ภายใน', 'สายตรง', 'แผนก', 'ตำแหน่งย่อย', 'อาคาร', 'ชั้น'];
    rows = rows.filter((r) => keys.some((k) => String(r[k] || '').toLowerCase().includes(q)));
  }
  $('directoryEmpty').classList.toggle('hidden', rows.length > 0);
  $('directoryList').innerHTML = rows.map((r) => `
    <div class="dir-item">
      <div class="who">
        <b>${esc(r['แผนก'] || 'ไม่ระบุแผนก')} <span>· ${esc(r['สาขา'] || '-')}</span></b>
        <small>${esc(locOf(r, false) || '-')}</small>
      </div>
      <div class="ext">
        <b class="mono">${esc(r['เบอร์ภายใน'] || '-')}</b>
        ${r['สายตรง'] ? `<small class="mono">สายตรง ${esc(r['สายตรง'])}</small>` : ''}
      </div>
    </div>`).join('');
}

function renderAssets() {
  if (!state.assetType) { $('assetTableHead').innerHTML = ''; $('assetTableBody').innerHTML = ''; $('assetEmpty').classList.remove('hidden'); $('assetEmpty').textContent = 'ยังไม่มีประเภทอุปกรณ์ — ไปเพิ่มที่แท็บ Admin'; return; }
  const cfg = typeCfg(state.assetType);
  $('assetTableHead').innerHTML = '<th>ตำแหน่ง</th>' + cfg.columns.map((c) => `<th>${esc(c)}</th>`).join('') + '<th>สำรอง</th><th></th>';

  const q = $('assetSearch').value.trim().toLowerCase();
  let rows = rowsOf(state.assetType);
  if (q) {
    const keys = ['สาขา'].concat(LOC_FIELDS, cfg.fields.map((f) => f.key), ['หมายเหตุ']);
    rows = rows.filter((r) => keys.some((k) => String(r[k] || '').toLowerCase().includes(q)));
  }

  $('assetEmpty').classList.toggle('hidden', rows.length > 0);
  $('assetEmpty').textContent = q ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีข้อมูล';
  $('assetTableBody').innerHTML = rows.map((r) => `
    <tr data-id="${esc(r['ID'])}">
      <td class="loc">${esc(locOf(r, true) || '-')}</td>
      ${cfg.columns.map((c) => `<td class="mono">${esc(r[c] || '-')}</td>`).join('')}
      <td>${isSpare(r) ? '<span class="spare-mark">● สำรอง</span>' : ''}</td>
      <td class="chev">›</td>
    </tr>`).join('');
}

// ---------------- FORM ----------------
function fillDatalist(id, values) {
  const el = $(id);
  if (el) el.innerHTML = (values || []).map((v) => `<option value="${esc(v)}">`).join('');
}

function fieldInputHtml(f, idx, value) {
  const id = `dyn_${idx}`;
  if (f.type === 'dropdown') {
    const opts = (f.options || []).map((o) => `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('');
    return `<select id="${id}" data-field="${esc(f.key)}"><option value=""></option>${opts}</select>`;
  }
  if (f.type === 'date') {
    return `<input id="${id}" type="date" data-field="${esc(f.key)}" value="${esc(value)}">`;
  }
  return `<input id="${id}" data-field="${esc(f.key)}" value="${esc(value)}" autocomplete="off"${f.linkedSuggest ? ` list="dl_link_${idx}"` : ''}>`;
}

function openForm(row) {
  state.editing = row || null;
  const cfg = typeCfg(state.assetType);

  $('formTitle').textContent = row ? `แก้ไข · ${cfg.label}` : `เพิ่มรายการ · ${cfg.label}`;
  $('btnDeleteItem').classList.toggle('hidden', !row);
  $('formError').classList.add('hidden');
  $('itemForm').reset();

  $('f_id').value = row ? row['ID'] : '';
  $('f_branch').value = row ? row['สาขา'] : (state.branch || state.branches[0] || '');
  $('f_building').value = row ? row['อาคาร'] || '' : '';
  $('f_floor').value = row ? row['ชั้น'] || '' : '';
  $('f_dept').value = row ? row['แผนก'] || '' : '';
  $('f_sub').value = row ? row['ตำแหน่งย่อย'] || '' : '';
  $('f_note').value = row ? row['หมายเหตุ'] || '' : '';
  $('f_spare').checked = row ? isSpare(row) : false;

  LOC_FIELDS.forEach((f) => {
    const set = new Set();
    state.schema.types.forEach((t) => suggestFor(t.key, f).forEach((v) => set.add(v)));
    fillDatalist({ 'อาคาร': 'dl_building', 'ชั้น': 'dl_floor', 'แผนก': 'dl_dept', 'ตำแหน่งย่อย': 'dl_sub' }[f], [...set].sort());
  });

  $('dynamicFields').innerHTML = cfg.fields.map((f, idx) => `
    <div class="f${f.type === 'dropdown' && f.key.length > 14 ? ' full' : ''}">
      <label for="dyn_${idx}">${esc(f.label)}</label>
      ${fieldInputHtml(f, idx, row ? row[f.key] || '' : '')}
    </div>`).join('');

  $('formModal').classList.remove('hidden');
}

function closeForm() { $('formModal').classList.add('hidden'); state.editing = null; }
function setFormBusy(busy) { $('btnSaveForm').disabled = busy; $('btnSaveForm').textContent = busy ? 'กำลังบันทึก...' : 'บันทึก'; }
function showFormError(msg) { $('formError').textContent = msg; $('formError').classList.remove('hidden'); }

async function submitForm(e) {
  e.preventDefault();
  const cfg = typeCfg(state.assetType);
  const data = {
    'สาขา': $('f_branch').value,
    'อาคาร': $('f_building').value.trim(),
    'ชั้น': $('f_floor').value.trim(),
    'แผนก': $('f_dept').value.trim(),
    'ตำแหน่งย่อย': $('f_sub').value.trim(),
    'สำรอง': $('f_spare').checked,
    'หมายเหตุ': $('f_note').value.trim()
  };
  if ($('f_id').value) data['ID'] = $('f_id').value;
  $('dynamicFields').querySelectorAll('[data-field]').forEach((inp) => { data[inp.dataset.field] = inp.value.trim(); });

  const wasEditing = !!state.editing;
  setFormBusy(true);
  let res;
  try {
    res = await apiPost({ action: 'save', type: state.assetType, pin: $('f_pin').value, data });
  } catch (err) {
    setFormBusy(false);
    return showFormError('บันทึกไม่สำเร็จ: ' + err.message);
  }
  setFormBusy(false);
  if (res.error) return showFormError(res.error);

  applyLocal(data, res.id);
  closeForm();
  showToast(wasEditing ? 'แก้ไขข้อมูลเรียบร้อย' : 'เพิ่มรายการเรียบร้อย');
}

async function deleteCurrentItem() {
  if (!state.editing) return;
  const id = state.editing['ID'];
  const pin = prompt('กรอกรหัส PIN เพื่อยืนยันการลบ');
  if (pin === null) return;

  let res;
  try {
    res = await apiPost({ action: 'delete', type: state.assetType, pin, id });
  } catch (err) { return showToast('ลบไม่สำเร็จ: ' + err.message); }
  if (res.error) return showToast(res.error);

  state.db[state.assetType] = (state.db[state.assetType] || []).filter((r) => r['ID'] !== id);
  persist();
  closeForm();
  renderAll();
  showToast('ลบรายการเรียบร้อย');
}

function applyLocal(data, id) {
  data['ID'] = id;
  data['อัปเดตล่าสุด'] = new Date().toLocaleString('th-TH');
  const list = state.db[state.assetType] || (state.db[state.assetType] = []);
  const i = list.findIndex((r) => r['ID'] === id);
  if (i >= 0) list[i] = data; else list.push(data);
  persist();
  renderAll();
}

function persist() {
  state.updated = new Date().toLocaleString('th-TH');
  localStorage.setItem('it.db', JSON.stringify({
    branches: state.branches, schema: state.schema, data: state.db, updated: state.updated
  }));
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

// =========================================================
// ADMIN
// =========================================================
function initAdmin() {
  $('adminSubTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-pane]');
    if (!btn) return;
    state.adminPane = btn.dataset.pane;
    document.querySelectorAll('#adminSubTabs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.pane === state.adminPane));
    document.querySelectorAll('.admin-pane').forEach((p) => p.classList.toggle('active', p.id === 'pane-' + state.adminPane));
    if (state.adminPane === 'logs') searchLogs();
  });

  $('btnAddBranch').addEventListener('click', async () => {
    const name = $('newBranchName').value.trim();
    if (!name) return;
    const pin = prompt('กรอก PIN เพื่อยืนยัน');
    if (pin === null) return;
    const res = await apiPost({ action: 'saveBranch', pin, mode: 'add', name });
    if (res.error) return showToast(res.error);
    state.branches = res.branches;
    $('newBranchName').value = '';
    persist(); renderBranchSelect(); renderAdminBranches();
    showToast('เพิ่มสาขาเรียบร้อย');
  });

  $('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('settingsError').classList.add('hidden');
    const res = await apiPost({
      action: 'saveSettings',
      pin: $('s_currentPin').value,
      newPin: $('s_pin').value.trim(),
      newLoginUser: $('s_user').value.trim(),
      newLoginPass: $('s_pass').value.trim()
    });
    if (res.error) { $('settingsError').textContent = res.error; $('settingsError').classList.remove('hidden'); return; }
    $('settingsForm').reset();
    showToast('บันทึกการตั้งค่าเรียบร้อย');
  });

  $('btnLogSearch').addEventListener('click', searchLogs);

  $('btnAddType').addEventListener('click', async () => {
    const key = $('newTypeKey').value.trim();
    const label = $('newTypeLabel').value.trim();
    if (!key || !label) return showToast('กรอกรหัสและชื่อประเภทให้ครบ');
    const pin = prompt('กรอก PIN เพื่อยืนยัน');
    if (pin === null) return;
    const res = await apiPost({ action: 'saveSchemaType', pin, mode: 'add', key, label });
    if (res.error) return showToast(res.error);
    state.schema.types.push({ key, label });
    state.schema.fieldsByType[key] = [];
    state.db[key] = [];
    $('newTypeKey').value = ''; $('newTypeLabel').value = '';
    if (!state.assetType) state.assetType = key;
    persist(); renderAssetTypeTabs(); renderAdminSchema();
    showToast('เพิ่มประเภทเรียบร้อย');
  });
}

function renderAdmin() {
  renderAdminBranches();
  renderLogTypeOptions();
  renderAdminSchema();
}

function renderAdminBranches() {
  $('branchList').innerHTML = state.branches.map((b) => `
    <div class="list-row" data-branch="${esc(b)}">
      <span>${esc(b)}</span>
      <div class="acts">
        <button type="button" class="rename">แก้ชื่อ</button>
        <button type="button" class="danger del">ลบ</button>
      </div>
    </div>`).join('') || '<p class="msg">ยังไม่มีสาขา</p>';

  $('branchList').querySelectorAll('.rename').forEach((btn) => btn.addEventListener('click', async () => {
    const name = btn.closest('.list-row').dataset.branch;
    const newName = prompt('ชื่อสาขาใหม่', name);
    if (!newName || newName === name) return;
    const pin = prompt('กรอก PIN เพื่อยืนยัน');
    if (pin === null) return;
    const res = await apiPost({ action: 'saveBranch', pin, mode: 'rename', name, newName });
    if (res.error) return showToast(res.error);
    state.branches = res.branches;
    persist(); renderBranchSelect(); renderAdminBranches();
    showToast('แก้ชื่อสาขาเรียบร้อย');
  }));

  $('branchList').querySelectorAll('.del').forEach((btn) => btn.addEventListener('click', async () => {
    const name = btn.closest('.list-row').dataset.branch;
    if (!confirm(`ลบสาขา "${name}"? อุปกรณ์ที่เคยผูกกับสาขานี้จะยังมีชื่อสาขานี้ค้างอยู่ในข้อมูลเดิม แค่จะไม่มีให้เลือกอีก`)) return;
    const pin = prompt('กรอก PIN เพื่อยืนยัน');
    if (pin === null) return;
    const res = await apiPost({ action: 'saveBranch', pin, mode: 'delete', name });
    if (res.error) return showToast(res.error);
    state.branches = res.branches;
    persist(); renderBranchSelect(); renderAdminBranches();
    showToast('ลบสาขาเรียบร้อย');
  }));
}

function renderLogTypeOptions() {
  $('logType').innerHTML = '<option value="">ทุกประเภท</option>' +
    state.schema.types.map((t) => `<option value="${esc(t.key)}">${esc(t.label)}</option>`).join('');
}

async function searchLogs() {
  const params = new URLSearchParams({ action: 'logs' });
  if ($('logFrom').value) params.set('from', $('logFrom').value);
  if ($('logTo').value) params.set('to', $('logTo').value);
  if ($('logType').value) params.set('type', $('logType').value);
  $('logTableBody').innerHTML = '';
  $('logEmpty').classList.add('hidden');
  try {
    const res = await fetch(API_URL + '?' + params.toString());
    const rows = await res.json();
    if (rows.error) throw new Error(rows.error);
    $('logEmpty').classList.toggle('hidden', rows.length > 0);
    $('logTableBody').innerHTML = rows.map((r) => `
      <tr>
        <td class="mono">${esc(r['เวลา'])}</td>
        <td>${esc(r['การกระทำ'])}</td>
        <td>${esc(r['ประเภท'])}</td>
        <td class="mono">${esc(r['ID รายการ'])}</td>
        <td>${esc(r['รายละเอียด'])}</td>
      </tr>`).join('');
  } catch (err) {
    showToast('โหลด Log ไม่สำเร็จ: ' + err.message);
  }
}

function renderAdminSchema() {
  $('schemaTypeList').innerHTML = state.schema.types.map((t) => {
    const fields = state.schema.fieldsByType[t.key] || [];
    return `
    <div class="field-group" data-type="${esc(t.key)}">
      <div class="field-group-head">
        <span>${esc(t.label)} <span class="type-badge">(${esc(t.key)}, ${fields.length} ฟิลด์)</span></span>
        <div class="acts" onclick="event.stopPropagation()">
          <button type="button" class="rename-type">แก้ชื่อ</button>
          <button type="button" class="danger del-type">ลบประเภท</button>
        </div>
      </div>
      <div class="field-group-body collapsed">
        ${fields.map((f) => `
          <div class="list-row" data-field="${esc(f.key)}">
            <span>${esc(f.label)} <span class="meta">(${esc(f.key)} · ${esc(f.type)}${f.type === 'dropdown' ? ': ' + esc(f.options.join(', ')) : ''})</span></span>
            <div class="acts">
              <button type="button" class="danger del-field">ลบ</button>
            </div>
          </div>`).join('') || '<p class="msg" style="padding:14px 0">ยังไม่มีฟิลด์</p>'}
        <div class="mini-form">
          <div class="grid2">
            <div class="f"><label>รหัสฟิลด์ (เช่น IP Address)</label><input class="nf-key"></div>
            <div class="f"><label>ชื่อที่แสดง</label><input class="nf-label"></div>
            <div class="f">
              <label>ชนิด</label>
              <select class="nf-type">
                <option value="text">ข้อความ</option>
                <option value="dropdown">ตัวเลือก (dropdown)</option>
                <option value="date">วันที่</option>
              </select>
            </div>
            <div class="f nf-options-wrap" style="display:none"><label>ตัวเลือก (คั่นด้วย ,)</label><input class="nf-options"></div>
          </div>
          <button type="button" class="btn add-field">+ เพิ่มฟิลด์ในประเภทนี้</button>
        </div>
      </div>
    </div>`;
  }).join('') || '<p class="msg">ยังไม่มีประเภทอุปกรณ์</p>';

  // เปิด/ปิดกลุ่ม
  $('schemaTypeList').querySelectorAll('.field-group-head').forEach((head) => {
    head.addEventListener('click', () => head.nextElementSibling.classList.toggle('collapsed'));
  });

  // แสดง/ซ่อนช่องตัวเลือกตามชนิดฟิลด์
  $('schemaTypeList').querySelectorAll('.nf-type').forEach((sel) => {
    sel.addEventListener('change', () => {
      const wrap = sel.closest('.mini-form').querySelector('.nf-options-wrap');
      wrap.style.display = sel.value === 'dropdown' ? '' : 'none';
    });
  });

  // แก้ชื่อประเภท
  $('schemaTypeList').querySelectorAll('.rename-type').forEach((btn) => btn.addEventListener('click', async () => {
    const key = btn.closest('.field-group').dataset.type;
    const cur = state.schema.types.find((t) => t.key === key);
    const label = prompt('ชื่อที่แสดงใหม่', cur.label);
    if (!label || label === cur.label) return;
    const pin = prompt('กรอก PIN เพื่อยืนยัน');
    if (pin === null) return;
    const res = await apiPost({ action: 'saveSchemaType', pin, mode: 'rename', key, label });
    if (res.error) return showToast(res.error);
    cur.label = label;
    persist(); renderAssetTypeTabs(); renderAdminSchema();
    showToast('แก้ชื่อประเภทเรียบร้อย');
  }));

  // ลบประเภท
  $('schemaTypeList').querySelectorAll('.del-type').forEach((btn) => btn.addEventListener('click', async () => {
    const key = btn.closest('.field-group').dataset.type;
    if (!confirm(`ลบประเภท "${key}" ทั้งชีต? ข้อมูลอุปกรณ์ทั้งหมดในประเภทนี้จะหายถาวร ลบไม่ได้คืน`)) return;
    const pin = prompt('กรอก PIN เพื่อยืนยัน (การลบนี้ถาวร)');
    if (pin === null) return;
    const res = await apiPost({ action: 'saveSchemaType', pin, mode: 'delete', key });
    if (res.error) return showToast(res.error);
    state.schema.types = state.schema.types.filter((t) => t.key !== key);
    delete state.schema.fieldsByType[key];
    delete state.db[key];
    if (state.assetType === key) state.assetType = state.schema.types[0] ? state.schema.types[0].key : '';
    persist(); renderAssetTypeTabs(); renderAssets(); renderAdminSchema();
    showToast('ลบประเภทเรียบร้อย');
  }));

  // ลบฟิลด์
  $('schemaTypeList').querySelectorAll('.del-field').forEach((btn) => btn.addEventListener('click', async () => {
    const typeKey = btn.closest('.field-group').dataset.type;
    const key = btn.closest('.list-row').dataset.field;
    if (!confirm(`ลบฟิลด์ "${key}"? ข้อมูลในคอลัมน์นี้ของทุกแถวจะหายถาวร ลบไม่ได้คืน`)) return;
    const pin = prompt('กรอก PIN เพื่อยืนยัน (การลบนี้ถาวร)');
    if (pin === null) return;
    const res = await apiPost({ action: 'saveSchemaField', pin, mode: 'delete', typeKey, key });
    if (res.error) return showToast(res.error);
    state.schema.fieldsByType[typeKey] = (state.schema.fieldsByType[typeKey] || []).filter((f) => f.key !== key);
    persist(); renderAssets(); renderAdminSchema();
    showToast('ลบฟิลด์เรียบร้อย');
  }));

  // เพิ่มฟิลด์
  $('schemaTypeList').querySelectorAll('.add-field').forEach((btn) => btn.addEventListener('click', async () => {
    const group = btn.closest('.field-group');
    const typeKey = group.dataset.type;
    const form = btn.closest('.mini-form');
    const key = form.querySelector('.nf-key').value.trim();
    const label = form.querySelector('.nf-label').value.trim();
    const fieldType = form.querySelector('.nf-type').value;
    const options = fieldType === 'dropdown'
      ? form.querySelector('.nf-options').value.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (!key || !label) return showToast('กรอกรหัสและชื่อฟิลด์ให้ครบ');
    const pin = prompt('กรอก PIN เพื่อยืนยัน');
    if (pin === null) return;
    const res = await apiPost({ action: 'saveSchemaField', pin, mode: 'add', typeKey, key, label, fieldType, options, showInTable: true });
    if (res.error) return showToast(res.error);
    (state.schema.fieldsByType[typeKey] = state.schema.fieldsByType[typeKey] || []).push({ typeKey, key, label, type: fieldType, options, showInTable: true });
    persist(); renderAssets(); renderAdminSchema();
    showToast('เพิ่มฟิลด์เรียบร้อย');
  }));
}

// =========================================================
// LOGIN
// =========================================================
async function handleLogin(e) {
  e.preventDefault();
  $('loginError').classList.add('hidden');
  const u = $('loginUser').value.trim();
  const p = $('loginPass').value;
  const btn = $('loginForm').querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ...';
  let res;
  try {
    res = await apiPost({ action: 'login', user: u, pass: p });
  } catch (err) {
    btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
    $('loginError').textContent = 'เชื่อมต่อไม่ได้: ' + err.message;
    $('loginError').classList.remove('hidden');
    return;
  }
  btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
  if (res.ok) {
    localStorage.setItem('it.auth', '1');
    document.documentElement.classList.add('authed');
    initApp();
  } else {
    $('loginError').textContent = res.error || 'เข้าสู่ระบบไม่สำเร็จ';
    $('loginError').classList.remove('hidden');
    $('loginPass').value = '';
    $('loginPass').focus();
  }
}

// ---------------- APP INIT (รันหลัง login ผ่านแล้วเท่านั้น) ----------------
let appStarted = false;
function initApp() {
  if (appStarted) return;
  appStarted = true;

  initBranchSelect();
  initTabs();
  initAssetTypeTabs();
  initAdmin();

  $('directorySearch').addEventListener('input', renderDirectory);
  $('assetSearch').addEventListener('input', renderAssets);
  $('btnAddNew').addEventListener('click', () => openForm(null));
  $('btnReload').addEventListener('click', () => loadAll());
  $('formClose').addEventListener('click', closeForm);
  $('btnCancelForm').addEventListener('click', closeForm);
  $('itemForm').addEventListener('submit', submitForm);
  $('btnDeleteItem').addEventListener('click', deleteCurrentItem);
  $('formModal').addEventListener('click', (e) => { if (e.target === $('formModal')) closeForm(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeForm(); });
  $('assetTableBody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) openForm((state.db[state.assetType] || []).find((r) => r['ID'] === tr.dataset.id));
  });

  if (loadFromCache()) {
    renderAll();
    setStatus('แสดงข้อมูลที่บันทึกไว้ (' + state.updated + ') กำลังตรวจสอบข้อมูลใหม่…');
  }
  loadAll(true);
}

// ---------------- WIRE UP ----------------
document.addEventListener('DOMContentLoaded', () => {
  $('loginForm').addEventListener('submit', handleLogin);
  if (localStorage.getItem('it.auth') === '1') initApp();
});
