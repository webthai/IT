/* =========================================================
   IT Asset, Phone Directory & Dashboard System
   app.js v2 — ต้องแนบไฟล์นี้ฉบับเต็มทุกครั้งที่มีการแก้ไข

   สิ่งที่เปลี่ยนจาก v1:
   1. ยิง API ครั้งเดียวตอนเปิดเว็บ (action=bootstrap) แทนการยิงทุกครั้งที่
      เปลี่ยนแท็บ / เปลี่ยนสาขา / สลับประเภทอุปกรณ์
   2. ค้นหา กรองสาขา และ autocomplete ทำในเบราว์เซอร์ทั้งหมด ไม่แตะ server
   3. เก็บสำเนาไว้ใน localStorage แล้ววาดหน้าจอทันทีตอนเปิด ค่อยอัปเดตเบื้องหลัง
      (เปิดดูได้แม้เน็ตหลุด)
   4. ไม่เรียก action 'fieldValues' อีกต่อไป — Serial Number ของ Pinpad คำนวณจาก
      ข้อมูลที่มีอยู่แล้วใน bootstrap แทน (Code.gs ฝั่ง backend ยังรองรับ action นี้อยู่
      เผื่อมีที่อื่นเรียกใช้ แต่ฝั่งนี้ไม่จำเป็นต้องยิงขอเพิ่มอีกรอบ)
   5. ยอด "สำรอง" บนการ์ดแดชบอร์ดกรองตามสาขาที่เลือก (เดิมเป็นยอดรวมทุกสาขา)
   ========================================================= */

// ⚠️ ใส่ Web App URL ที่ได้จากการ Deploy Google Apps Script (Code.gs) ตรงนี้
// (นี่คือ URL ที่ deploy อยู่ปัจจุบัน — ถ้า deploy เวอร์ชันใหม่ทับของเดิมด้วย
//  "Manage deployments > New version" ไม่ต้องแก้บรรทัดนี้ เพราะ URL เดิมยังใช้ได้)
const API_URL = 'https://script.google.com/macros/s/AKfycbwZvOGA6_o2E2-0-fX3_SkASsyaPmhnMRiWydv8wiqFu58UGQH9mvh690YQMGT3FQVc/exec';

const BRANCHES = ['อโศก', 'ปิ่นเกล้า', 'อุดร'];
const LOC_FIELDS = ['อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย'];

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
      { key: 'TID', label: 'TID' }
    ],
    columns: ['TID']
  },
  Pinpad: {
    label: 'Pinpad',
    fields: [
      { key: 'Serial Number', label: 'Serial Number (S/N)' }
    ],
    columns: ['Serial Number']
  },
  PrinterServer: {
    label: 'Printer / Print Server',
    fields: [
      { key: 'Hostname', label: 'Hostname (เครื่อง Print Server)' },
      { key: 'IP Address', label: 'IP Address' },
      { key: 'MAC Address', label: 'MAC Address' },
      { key: 'ชื่อ Share Printer', label: 'ชื่อ Share Printer' },
      { key: 'รุ่นตลับหมึก', label: 'รุ่นตลับหมึกพิมพ์' },
      { key: 'เลข AnyDesk', label: 'เลข AnyDesk (AnyDesk ID)' }
    ],
    columns: ['Hostname', 'IP Address', 'ชื่อ Share Printer']
  },
  PC: {
    label: 'PC',
    fields: [
      { key: 'Hostname', label: 'Hostname' },
      { key: 'IP Address', label: 'IP Address' },
      { key: 'MAC Address', label: 'MAC Address' },
      { key: 'เลข AnyDesk', label: 'เลข AnyDesk (AnyDesk ID)' },
      { key: 'สเปกเครื่อง', label: 'สเปกเครื่อง' }
    ],
    columns: ['Hostname', 'IP Address', 'เลข AnyDesk']
  }
};

// ---------------- STATE ----------------
const state = {
  branch: localStorage.getItem('it.branch') || '',
  tab: 'dashboard',
  assetType: 'IPPhone',
  db: {},          // { [type]: rows[] } — ข้อมูลทั้งหมดเก็บไว้ในเครื่อง
  updated: '',
  editing: null
};

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isSpare = (r) => r['สำรอง'] === true || r['สำรอง'] === 'TRUE' || r['สำรอง'] === 'true';
const locOf = (r, withBranch) => [withBranch ? r['สาขา'] : null, r['อาคาร'], r['ชั้น'], r['แผนก'], r['ตำแหน่งย่อย']].filter(Boolean).join(' / ');

// ---------------- API ----------------
async function apiPost(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // เลี่ยง CORS preflight
    body: JSON.stringify(body)
  });
  return res.json();
}

function setStatus(text, kind) {
  $('status').className = 'status' + (kind ? ' ' + kind : '');
  $('statusText').textContent = text;
}

function hasData() {
  return Object.keys(state.db).length > 0;
}

/** โหลดข้อมูลทั้งหมดในคำขอเดียว */
async function loadAll(silent) {
  if (!silent) setStatus(hasData() ? 'กำลังตรวจสอบข้อมูลใหม่…' : 'กำลังโหลดข้อมูล…');
  $('btnReload').disabled = true;
  try {
    const res = await fetch(API_URL + '?action=bootstrap&t=' + Date.now());
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    state.db = json.data;
    state.updated = json.updated || '';
    localStorage.setItem('it.db', JSON.stringify({ data: state.db, updated: state.updated }));
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
    state.db = c.data;
    state.updated = c.updated || '';
    return true;
  } catch (e) { return false; }
}

// ---------------- อ่านข้อมูลจาก state ----------------
function rowsOf(type) {
  const rows = state.db[type] || [];
  return state.branch ? rows.filter((r) => r['สาขา'] === state.branch) : rows;
}

/** ค่าที่เคยกรอกไว้ ใช้ทำ autocomplete — คำนวณจากข้อมูลในเครื่อง ไม่ยิง server */
function suggestFor(type, field) {
  const set = new Set();
  (state.db[type] || []).forEach((r) => { if (r[field]) set.add(String(r[field])); });
  return [...set].sort();
}

// ---------------- INIT ----------------
function initBranchSelects() {
  const sel = $('branchSelect');
  const fb = $('f_branch');
  BRANCHES.forEach((b) => {
    sel.insertAdjacentHTML('beforeend', `<option value="${esc(b)}">${esc(b)}</option>`);
    fb.insertAdjacentHTML('beforeend', `<option value="${esc(b)}">${esc(b)}</option>`);
  });
  sel.value = state.branch;
  sel.addEventListener('change', () => {
    state.branch = sel.value;
    localStorage.setItem('it.branch', state.branch);
    renderAll();   // แค่วาดใหม่ ไม่ยิง API
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
    $('tab-' + t).classList.toggle('hidden', t !== tab);
  });
}

function initAssetTypeTabs() {
  $('assetTypeTabs').innerHTML = Object.entries(ASSET_TYPES).map(([key, cfg]) =>
    `<button type="button" data-type="${key}" aria-pressed="${key === state.assetType}">${esc(cfg.label)}</button>`
  ).join('');
  $('assetTypeTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-type]');
    if (!btn) return;
    state.assetType = btn.dataset.type;
    document.querySelectorAll('#assetTypeTabs button').forEach((b) =>
      b.setAttribute('aria-pressed', b.dataset.type === state.assetType));
    $('assetSearch').value = '';
    renderAssets();   // แค่วาดใหม่ ไม่ยิง API
  });
}

// ---------------- RENDER ----------------
function renderAll() {
  renderDashboard();
  renderDirectory();
  renderAssets();
}

function renderDashboard() {
  $('summaryCards').innerHTML = Object.entries(ASSET_TYPES).map(([key, cfg]) => {
    const rows = rowsOf(key);
    const spare = rows.filter(isSpare).length;
    return `<div class="card">
      <p class="lbl">${esc(cfg.label)}</p>
      <p class="num mono">${rows.length}</p>
      <p class="sub">สำรอง ${spare} เครื่อง</p>
    </div>`;
  }).join('');

  const list = [];
  Object.keys(ASSET_TYPES).forEach((type) => {
    rowsOf(type).filter(isSpare).forEach((r) => list.push({ type, r }));
  });

  $('spareCount').textContent = list.length ? list.length + ' รายการ' : '';
  $('spareEmpty').classList.toggle('hidden', list.length > 0);
  $('spareTableBody').innerHTML = list.map(({ type, r }) => {
    const cfg = ASSET_TYPES[type];
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
  let rows = rowsOf('IPPhone');
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
  const cfg = ASSET_TYPES[state.assetType];
  $('assetTableHead').innerHTML =
    '<th>ตำแหน่ง</th>' + cfg.columns.map((c) => `<th>${esc(c)}</th>`).join('') + '<th>สำรอง</th><th></th>';

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
  $('f_spare').checked = row ? isSpare(row) : false;

  // autocomplete — รวมค่าที่เคยกรอกจากทุกประเภทอุปกรณ์ ไม่ต้องยิง server
  LOC_FIELDS.forEach((f) => {
    const set = new Set();
    Object.keys(ASSET_TYPES).forEach((t) => suggestFor(t, f).forEach((v) => set.add(v)));
    fillDatalist({ 'อาคาร': 'dl_building', 'ชั้น': 'dl_floor', 'แผนก': 'dl_dept', 'ตำแหน่งย่อย': 'dl_sub' }[f], [...set].sort());
  });

  $('dynamicFields').innerHTML = cfg.fields.map((f, idx) => `
    <div class="f${f.key === 'สเปกเครื่อง' || f.key === 'ชื่อ Share Printer' ? ' full' : ''}">
      <label for="dyn_${idx}">${esc(f.label)}</label>
      <input id="dyn_${idx}" data-field="${esc(f.key)}" value="${esc(row ? row[f.key] || '' : '')}"
        autocomplete="off"${f.linkedSuggest ? ` list="dl_link_${idx}"` : ''}>
      ${f.linkedSuggest ? `<datalist id="dl_link_${idx}"></datalist>` : ''}
    </div>`).join('');

  // ช่องที่อ้างอิงข้อมูลจากประเภทอื่น เช่น Serial Number ของ Pinpad
  cfg.fields.forEach((f, idx) => {
    if (f.linkedSuggest) fillDatalist(`dl_link_${idx}`, suggestFor(f.linkedSuggest.type, f.linkedSuggest.field));
  });

  $('formModal').classList.remove('hidden');
}

function closeForm() {
  $('formModal').classList.add('hidden');
  state.editing = null;
}

function setFormBusy(busy) {
  $('btnSaveForm').disabled = busy;
  $('btnSaveForm').textContent = busy ? 'กำลังบันทึก...' : 'บันทึก';
}

function showFormError(msg) {
  $('formError').textContent = msg;
  $('formError').classList.remove('hidden');
}

async function submitForm(e) {
  e.preventDefault();
  const cfg = ASSET_TYPES[state.assetType];
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
  $('dynamicFields').querySelectorAll('[data-field]').forEach((inp) => {
    data[inp.dataset.field] = inp.value.trim();
  });

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

  applyLocal(data, res.id);   // อัปเดตหน้าจอทันที ไม่ต้องรอโหลดใหม่ทั้งก้อน
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
  } catch (err) {
    return showToast('ลบไม่สำเร็จ: ' + err.message);
  }
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
  localStorage.setItem('it.db', JSON.stringify({ data: state.db, updated: state.updated }));
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

  // แสดงข้อมูลที่เก็บไว้ในเครื่องก่อน แล้วค่อยดึงของใหม่เบื้องหลัง
  if (loadFromCache()) {
    renderAll();
    setStatus('แสดงข้อมูลที่บันทึกไว้ (' + state.updated + ') กำลังตรวจสอบข้อมูลใหม่…');
  }
  loadAll(true);
});
