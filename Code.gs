/**
 * IT Asset, Phone Directory & Dashboard System — v3 (Admin / Dynamic Schema)
 * Backend: Google Apps Script Web App (doGet / doPost)
 * Database: Google Sheets
 *
 * เปลี่ยนจาก v2 ยังไงบ้าง:
 *   - สาขา, PIN, user/password login ย้ายจาก hardcode ในโค้ด มาเก็บในชีต "Config" แก้ผ่านหน้าเว็บได้แล้ว
 *   - ประเภทอุปกรณ์และฟิลด์ของแต่ละประเภท ย้ายมาเก็บในชีต "SchemaTypes" / "SchemaFields"
 *     เพิ่ม/ลบ/แก้ ประเภทและฟิลด์ได้จากหน้า Admin โดยไม่ต้องแก้โค้ดอีกต่อไป
 *   - เพิ่ม/ลบฟิลด์จริง ใช้คำสั่ง insertColumnBefore / deleteColumn ของ Apps Script
 *     (แทรก/ลบคอลัมน์จริงในชีต ข้อมูลแถวอื่นไม่เลื่อนตำแหน่งผิด)
 *   - login ตรวจฝั่ง server แล้ว (action=login) ไม่ฝัง user/password ไว้ใน app.js อีกต่อไป
 *   - เพิ่ม action=logs ดู Log ย้อนหลัง กรองตามวันที่/ประเภทได้
 *
 * DEPLOY / MIGRATE จาก v2:
 * 1. วางไฟล์นี้ทับ Code.gs เดิม (Save)
 * 2. รัน setupSheets() ครั้งเดียว — จะสร้างชีต Config / SchemaTypes / SchemaFields ให้ใหม่
 *    พร้อม seed ค่าเริ่มต้นจากของเดิมทั้งหมด (5 ประเภท, 3 สาขา, PIN ใหม่ 05032540, login เดิม)
 *    ชีตข้อมูลอุปกรณ์เดิม (IPPhone, EDC, ...) ที่มีอยู่แล้วจะไม่ถูกแตะต้อง ข้อมูลเดิมปลอดภัย
 * 3. Deploy > Manage deployments > New version
 * 4. อัปโหลด index.html และ app.js เวอร์ชันใหม่ทับของเดิม (ต้องคู่กัน ห้ามใช้ Code.gs v3 กับ app.js v2)
 */

// ---------- CONFIG (ค่าเริ่มต้น ใช้ตอน seed ครั้งแรกเท่านั้น หลังจากนั้นแก้ผ่านหน้าเว็บ) ----------
var CACHE_SECONDS = 300;
var SPREADSHEET_ID = ''; // ใส่ถ้าสคริปต์เป็น standalone ไม่ได้เปิดจากในชีต

var DEFAULT_PIN = '05032540';
var DEFAULT_LOGIN_USER = 'meen';
var DEFAULT_LOGIN_PASS = '5340';
var DEFAULT_BRANCHES = ['อโศก', 'ปิ่นเกล้า', 'อุดร'];

var BASE_PREFIX = ['ID', 'สาขา', 'อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย'];
var BASE_SUFFIX = ['สำรอง', 'หมายเหตุ', 'อัปเดตล่าสุด'];

var DEFAULT_TYPES = [
  { key: 'IPPhone', label: 'IP Phone', fields: [
    { key: 'เบอร์ภายใน', label: 'เบอร์ภายใน (Ext.)', type: 'text' },
    { key: 'สายตรง', label: 'สายตรง (Direct Line)', type: 'text' },
    { key: 'IP Address', label: 'IP Address', type: 'text' }
  ]},
  { key: 'EDC', label: 'EDC (เครื่องรูดบัตร)', fields: [
    { key: 'TID', label: 'TID', type: 'text' },
    { key: 'Serial Number', label: 'Serial Number (S/N)', type: 'text' }
  ]},
  { key: 'Pinpad', label: 'Pinpad', fields: [
    { key: 'TID', label: 'TID', type: 'text' },
    { key: 'Serial Number', label: 'Serial Number (S/N)', type: 'text' }
  ]},
  { key: 'PrinterServer', label: 'Printer / Print Server', fields: [
    { key: 'Hostname', label: 'Hostname (เครื่อง Print Server)', type: 'text' },
    { key: 'IP Address', label: 'IP Address', type: 'text' },
    { key: 'MAC Address', label: 'MAC Address', type: 'text' },
    { key: 'ชื่อ Share Printer', label: 'ชื่อ Share Printer', type: 'text' },
    { key: 'รุ่นตลับหมึก', label: 'รุ่นตลับหมึกพิมพ์', type: 'text' },
    { key: 'เลข AnyDesk', label: 'เลข AnyDesk (AnyDesk ID)', type: 'text' }
  ]},
  { key: 'PC', label: 'PC', fields: [
    { key: 'Hostname', label: 'Hostname', type: 'text' },
    { key: 'IP Address', label: 'IP Address', type: 'text' },
    { key: 'MAC Address', label: 'MAC Address', type: 'text' },
    { key: 'เลข AnyDesk', label: 'เลข AnyDesk (AnyDesk ID)', type: 'text' },
    { key: 'สเปกเครื่อง', label: 'สเปกเครื่อง', type: 'text' }
  ]}
];

// ---------- SETUP ----------
function getSpreadsheet() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function checkSetup() {
  var ss = getSpreadsheet();
  Logger.log('ไฟล์: ' + ss.getName() + ' (' + ss.getUrl() + ')');
  Logger.log('ชีตที่มีอยู่: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
  Logger.log('Config: ' + JSON.stringify(getConfig()));
  Logger.log('SchemaTypes: ' + JSON.stringify(getSchemaTypes()));
}

function setupSheets() {
  var ss = getSpreadsheet();

  var cfgSheet = ss.getSheetByName('Config');
  if (!cfgSheet) {
    cfgSheet = ss.insertSheet('Config');
    cfgSheet.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);
    cfgSheet.appendRow(['pin', DEFAULT_PIN]);
    cfgSheet.appendRow(['loginUser', DEFAULT_LOGIN_USER]);
    cfgSheet.appendRow(['loginPass', DEFAULT_LOGIN_PASS]);
    cfgSheet.appendRow(['branches', JSON.stringify(DEFAULT_BRANCHES)]);
    cfgSheet.setFrozenRows(1);
  }

  var stSheet = ss.getSheetByName('SchemaTypes');
  if (!stSheet) {
    stSheet = ss.insertSheet('SchemaTypes');
    stSheet.getRange(1, 1, 1, 2).setValues([['TypeKey', 'TypeLabel']]);
    DEFAULT_TYPES.forEach(function (t) { stSheet.appendRow([t.key, t.label]); });
    stSheet.setFrozenRows(1);
  }

  var sfSheet = ss.getSheetByName('SchemaFields');
  if (!sfSheet) {
    sfSheet = ss.insertSheet('SchemaFields');
    sfSheet.getRange(1, 1, 1, 6).setValues([['TypeKey', 'FieldKey', 'FieldLabel', 'FieldType', 'FieldOptions', 'ShowInTable']]);
    DEFAULT_TYPES.forEach(function (t) {
      t.fields.forEach(function (f) { sfSheet.appendRow([t.key, f.key, f.label, f.type, '', true]); });
    });
    sfSheet.setFrozenRows(1);
  }

  var logSheet = ss.getSheetByName('Log');
  if (!logSheet) {
    logSheet = ss.insertSheet('Log');
    logSheet.getRange(1, 1, 1, 5).setValues([['เวลา', 'การกระทำ', 'ประเภท', 'ID รายการ', 'รายละเอียด']]);
    logSheet.setFrozenRows(1);
  }

  // ชีตข้อมูลอุปกรณ์ — สร้างเฉพาะที่ยังไม่มี ถ้ามีอยู่แล้ว "ไม่แตะหัวตาราง" กันข้อมูลเดิมพัง
  DEFAULT_TYPES.forEach(function (t) {
    var sh = ss.getSheetByName(t.key);
    if (!sh) {
      sh = ss.insertSheet(t.key);
      var headers = BASE_PREFIX.concat(t.fields.map(function (f) { return f.key; })).concat(BASE_SUFFIX);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
  });

  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  clearAllCache();
}

// ---------- CACHE ----------
var _mem = {};

function cachedGeneric(key, loader) {
  if (_mem[key]) return _mem[key];
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) { _mem[key] = JSON.parse(hit); return _mem[key]; }
  var val = loader();
  _mem[key] = val;
  try { cache.put(key, JSON.stringify(val), CACHE_SECONDS); } catch (e) { /* เกิน 100KB ก็ข้าม cache ไป */ }
  return val;
}

function cachedRows(type) { return cachedGeneric('rows_' + type, function () { return sheetToObjects(getSheet(type)); }); }

function clearCacheKey(key) {
  delete _mem[key];
  CacheService.getScriptCache().remove(key);
}

function clearCache(type) { clearCacheKey('rows_' + type); }

function clearAllCache() {
  _mem = {};
  var cache = CacheService.getScriptCache();
  var keys = ['cfg', 'schemaTypes', 'schemaFields'];
  assetTypes().forEach(function (t) { keys.push('rows_' + t); });
  cache.removeAll(keys);
}

// ---------- CONFIG (สาขา / PIN / login) ----------
function getConfig() {
  return cachedGeneric('cfg', function () {
    var sheet = getSpreadsheet().getSheetByName('Config');
    var map = {};
    sheetToObjects(sheet).forEach(function (r) { map[r['Key']] = r['Value']; });
    return {
      pin: map.pin || DEFAULT_PIN,
      loginUser: map.loginUser || DEFAULT_LOGIN_USER,
      loginPass: map.loginPass || DEFAULT_LOGIN_PASS,
      branches: map.branches ? JSON.parse(map.branches) : DEFAULT_BRANCHES.slice()
    };
  });
}

function setConfigValue(key, value) {
  var sheet = getSpreadsheet().getSheetByName('Config');
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === key) { sheet.getRange(i + 1, 2).setValue(value); clearCacheKey('cfg'); return; }
  }
  sheet.appendRow([key, value]);
  clearCacheKey('cfg');
}

function checkPin(pin) { return String(pin) === String(getConfig().pin); }

// ---------- SCHEMA (ประเภทอุปกรณ์ / ฟิลด์) ----------
function getSchemaTypes() {
  return cachedGeneric('schemaTypes', function () {
    var sheet = getSpreadsheet().getSheetByName('SchemaTypes');
    return sheetToObjects(sheet).map(function (r) { return { key: r['TypeKey'], label: r['TypeLabel'] }; });
  });
}

function getAllSchemaFields() {
  return cachedGeneric('schemaFields', function () {
    var sheet = getSpreadsheet().getSheetByName('SchemaFields');
    return sheetToObjects(sheet).map(function (r) {
      return {
        typeKey: r['TypeKey'], key: r['FieldKey'], label: r['FieldLabel'],
        type: r['FieldType'] || 'text',
        options: r['FieldOptions'] ? String(r['FieldOptions']).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [],
        showInTable: r['ShowInTable'] === true || r['ShowInTable'] === 'TRUE'
      };
    });
  });
}

function getSchemaFields(typeKey) {
  return getAllSchemaFields().filter(function (f) { return f.typeKey === typeKey; });
}

function assetTypes() { return getSchemaTypes().map(function (t) { return t.key; }); }

// ---------- ENTRY POINTS ----------
function doGet(e) {
  try {
    var action = e.parameter.action;
    if (action === 'bootstrap') return jsonOut(getAll());
    if (action === 'summary') return jsonOut(getSummary());
    if (action === 'spare') return jsonOut(getSpareList(e.parameter.branch));
    if (action === 'list') return jsonOut(listRows(e.parameter.type, e.parameter.branch));
    if (action === 'search') return jsonOut(searchPhones(e.parameter.q));
    if (action === 'suggest') return jsonOut(getSuggestions(e.parameter.type));
    if (action === 'fieldValues') return jsonOut(getFieldValues(e.parameter.type, e.parameter.field, e.parameter.branch));
    if (action === 'logs') return jsonOut(getLogs(e.parameter.from, e.parameter.to, e.parameter.type, e.parameter.limit));
    return jsonOut({ error: 'unknown action' });
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.action === 'login') return jsonOut(checkLogin(body.user, body.pass));

    if (!checkPin(body.pin)) return jsonOut({ error: 'PIN ไม่ถูกต้อง' });

    if (body.action === 'save') return jsonOut(saveRow(body.type, body.data));
    if (body.action === 'delete') return jsonOut(deleteRow(body.type, body.id));
    if (body.action === 'saveBranch') return jsonOut(saveBranch(body.mode, body.name, body.newName));
    if (body.action === 'saveSettings') return jsonOut(saveSettings(body.newPin, body.newLoginUser, body.newLoginPass));
    if (body.action === 'saveSchemaType') return jsonOut(saveSchemaType(body.mode, body.key, body.label));
    if (body.action === 'saveSchemaField') return jsonOut(saveSchemaField(body.mode, body.typeKey, body.key, body.label, body.fieldType, body.options, body.showInTable));
    return jsonOut({ error: 'unknown action' });
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

function checkLogin(user, pass) {
  var cfg = getConfig();
  if (user === cfg.loginUser && pass === cfg.loginPass) return { ok: true };
  return { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
}

// ---------- HELPERS ----------
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function nowThai() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}

function getSheet(type) {
  var known = getSchemaTypes().some(function (t) { return t.key === type; });
  if (!known) throw new Error('ไม่พบประเภทอุปกรณ์: ' + type);
  var sheet = getSpreadsheet().getSheetByName(type);
  if (!sheet) throw new Error('ไม่พบชีต: ' + type + ' (รัน setupSheets() ก่อน)');
  return sheet;
}

function sheetToObjects(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values.shift();
  return values
    .filter(function (row) { return row[0] !== ''; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
}

// ---------- DATA ----------
function getAll() {
  var cfg = getConfig();
  var types = getSchemaTypes();
  var fieldsByType = {};
  types.forEach(function (t) { fieldsByType[t.key] = getSchemaFields(t.key); });
  var data = {};
  types.forEach(function (t) { data[t.key] = cachedRows(t.key); });
  return {
    branches: cfg.branches,
    schema: { types: types, fieldsByType: fieldsByType },
    data: data,
    updated: nowThai()
  };
}

function listRows(type, branch) {
  var rows = cachedRows(type);
  if (branch) rows = rows.filter(function (r) { return r['สาขา'] === branch; });
  return rows;
}

function getSuggestions(type) {
  var rows = cachedRows(type);
  var fields = ['อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย'];
  var out = {};
  fields.forEach(function (f) {
    var set = {};
    rows.forEach(function (r) { if (r[f]) set[r[f]] = true; });
    out[f] = Object.keys(set);
  });
  return out;
}

function getFieldValues(type, field, branch) {
  var rows = cachedRows(type);
  if (branch) rows = rows.filter(function (r) { return r['สาขา'] === branch; });
  var set = {};
  rows.forEach(function (r) { if (r[field]) set[r[field]] = true; });
  return Object.keys(set);
}

function getSummary() {
  var cfg = getConfig();
  var summary = { total: {}, spare: {}, byBranch: {} };
  cfg.branches.forEach(function (b) { summary.byBranch[b] = {}; });
  assetTypes().forEach(function (type) {
    var rows = cachedRows(type);
    summary.total[type] = rows.length;
    summary.spare[type] = rows.filter(function (r) { return r['สำรอง'] === true || r['สำรอง'] === 'TRUE'; }).length;
    cfg.branches.forEach(function (b) {
      summary.byBranch[b][type] = rows.filter(function (r) { return r['สาขา'] === b; }).length;
    });
  });
  return summary;
}

function getSpareList(branch) {
  var out = [];
  assetTypes().forEach(function (type) {
    var rows = cachedRows(type).filter(function (r) {
      return (r['สำรอง'] === true || r['สำรอง'] === 'TRUE') && (!branch || r['สาขา'] === branch);
    });
    rows.forEach(function (r) {
      var copy = {};
      Object.keys(r).forEach(function (k) { copy[k] = r[k]; });
      copy['ประเภท'] = type;
      out.push(copy);
    });
  });
  return out;
}

function searchPhones(q) {
  var rows = cachedRows('IPPhone');
  if (!q) return rows;
  q = q.toString().toLowerCase();
  return rows.filter(function (r) {
    return ['เบอร์ภายใน', 'สายตรง', 'แผนก', 'ตำแหน่งย่อย', 'อาคาร', 'ชั้น', 'สาขา'].some(function (f) {
      return (r[f] || '').toString().toLowerCase().indexOf(q) !== -1;
    });
  });
}

function getLogs(from, to, type, limit) {
  var rows = sheetToObjects(getSpreadsheet().getSheetByName('Log'));
  rows.reverse();
  if (type) rows = rows.filter(function (r) { return r['ประเภท'] === type; });
  if (from) rows = rows.filter(function (r) { return String(r['เวลา']) >= from; });
  if (to) rows = rows.filter(function (r) { return String(r['เวลา']) <= (to + ' 23:59:59'); });
  var n = limit ? parseInt(limit, 10) : 200;
  return rows.slice(0, n);
}

// ---------- WRITE: แถวอุปกรณ์ ----------
function saveRow(type, data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet(type);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var values = sheet.getDataRange().getValues();
    data['อัปเดตล่าสุด'] = nowThai();

    if (data['ID']) {
      for (var i = 1; i < values.length; i++) {
        if (values[i][0] === data['ID']) {
          var row = headers.map(function (h) { return data.hasOwnProperty(h) ? data[h] : values[i][headers.indexOf(h)]; });
          sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
          logAction('แก้ไข', type, data['ID'], data['แผนก'] || '');
          clearCache(type);
          return { ok: true, id: data['ID'] };
        }
      }
    }
    var newId = Utilities.getUuid().substring(0, 8);
    data['ID'] = newId;
    var newRow = headers.map(function (h) { return data.hasOwnProperty(h) ? data[h] : ''; });
    sheet.appendRow(newRow);
    logAction('เพิ่ม', type, newId, data['แผนก'] || '');
    clearCache(type);
    return { ok: true, id: newId };
  } finally {
    lock.releaseLock();
  }
}

function deleteRow(type, id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet(type);
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        sheet.deleteRow(i + 1);
        logAction('ลบ', type, id, '');
        clearCache(type);
        return { ok: true };
      }
    }
    return { error: 'ไม่พบรายการ' };
  } finally {
    lock.releaseLock();
  }
}

function logAction(action, type, id, detail) {
  getSpreadsheet().getSheetByName('Log').appendRow([nowThai(), action, type, id, detail]);
}

// ---------- ADMIN: สาขา ----------
function saveBranch(mode, name, newName) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var cfg = getConfig();
    var list = cfg.branches.slice();
    if (mode === 'add') {
      if (!name) return { error: 'กรุณาระบุชื่อสาขา' };
      if (list.indexOf(name) !== -1) return { error: 'มีสาขานี้อยู่แล้ว' };
      list.push(name);
    } else if (mode === 'rename') {
      var i = list.indexOf(name);
      if (i === -1) return { error: 'ไม่พบสาขา' };
      list[i] = newName;
    } else if (mode === 'delete') {
      list = list.filter(function (b) { return b !== name; });
    } else {
      return { error: 'unknown mode' };
    }
    setConfigValue('branches', JSON.stringify(list));
    logAction(mode === 'add' ? 'เพิ่มสาขา' : mode === 'rename' ? 'แก้ชื่อสาขา' : 'ลบสาขา', 'Config', name, newName || '');
    return { ok: true, branches: list };
  } finally {
    lock.releaseLock();
  }
}

// ---------- ADMIN: PIN / login ----------
function saveSettings(newPin, newLoginUser, newLoginPass) {
  if (newPin) setConfigValue('pin', String(newPin));
  if (newLoginUser) setConfigValue('loginUser', newLoginUser);
  if (newLoginPass) setConfigValue('loginPass', newLoginPass);
  logAction('แก้ไขตั้งค่า', 'Config', '-', [newPin ? 'PIN' : '', newLoginUser ? 'loginUser' : '', newLoginPass ? 'loginPass' : ''].filter(Boolean).join(', '));
  return { ok: true };
}

// ---------- ADMIN: ประเภทอุปกรณ์ ----------
function saveSchemaType(mode, key, label) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('SchemaTypes');
    var values = sheet.getDataRange().getValues();

    if (mode === 'add') {
      if (!key || !label) return { error: 'กรุณาระบุรหัสและชื่อประเภท' };
      if (ss.getSheetByName(key)) return { error: 'มีประเภทนี้อยู่แล้ว' };
      sheet.appendRow([key, label]);
      var newSheet = ss.insertSheet(key);
      var headers = BASE_PREFIX.concat(BASE_SUFFIX);
      newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      newSheet.setFrozenRows(1);
      logAction('เพิ่มประเภท', key, '-', label);
    } else if (mode === 'rename') {
      var found = false;
      for (var i = 1; i < values.length; i++) {
        if (values[i][0] === key) { sheet.getRange(i + 1, 2).setValue(label); found = true; break; }
      }
      if (!found) return { error: 'ไม่พบประเภทนี้' };
      logAction('แก้ชื่อประเภท', key, '-', label);
    } else if (mode === 'delete') {
      for (var j = 1; j < values.length; j++) {
        if (values[j][0] === key) { sheet.deleteRow(j + 1); break; }
      }
      var target = ss.getSheetByName(key);
      if (target) ss.deleteSheet(target);
      var sf = ss.getSheetByName('SchemaFields');
      var sfValues = sf.getDataRange().getValues();
      for (var k = sfValues.length - 1; k >= 1; k--) {
        if (sfValues[k][0] === key) sf.deleteRow(k + 1);
      }
      logAction('ลบประเภท', key, '-', '');
    } else {
      return { error: 'unknown mode' };
    }
    clearAllCache();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ---------- ADMIN: ฟิลด์ ----------
function saveSchemaField(mode, typeKey, key, label, fieldType, options, showInTable) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(typeKey);
    if (!sheet) return { error: 'ไม่พบประเภทอุปกรณ์' };
    var sf = ss.getSheetByName('SchemaFields');
    var sfValues = sf.getDataRange().getValues();

    if (mode === 'add') {
      if (!key || !label) return { error: 'กรุณาระบุรหัสและชื่อฟิลด์' };
      var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (headerRow.indexOf(key) !== -1) return { error: 'มีฟิลด์นี้อยู่แล้ว' };
      var insertBefore = headerRow.indexOf('สำรอง') + 1;
      if (insertBefore <= 0) insertBefore = headerRow.length + 1;
      sheet.insertColumnBefore(insertBefore);
      sheet.getRange(1, insertBefore).setValue(key);
      sf.appendRow([typeKey, key, label, fieldType || 'text', (options || []).join(','), showInTable !== false]);
      logAction('เพิ่มฟิลด์', typeKey, key, label);
    } else if (mode === 'edit') {
      var editedRow = -1;
      for (var i = 1; i < sfValues.length; i++) {
        if (sfValues[i][0] === typeKey && sfValues[i][1] === key) { editedRow = i; break; }
      }
      if (editedRow === -1) return { error: 'ไม่พบฟิลด์นี้' };
      sf.getRange(editedRow + 1, 3).setValue(label);
      sf.getRange(editedRow + 1, 4).setValue(fieldType || 'text');
      sf.getRange(editedRow + 1, 5).setValue((options || []).join(','));
      sf.getRange(editedRow + 1, 6).setValue(showInTable !== false);
      logAction('แก้ไขฟิลด์', typeKey, key, label);
    } else if (mode === 'delete') {
      var headerRow2 = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var colIdx = headerRow2.indexOf(key) + 1;
      if (colIdx > 0) sheet.deleteColumn(colIdx);
      for (var j = sfValues.length - 1; j >= 1; j--) {
        if (sfValues[j][0] === typeKey && sfValues[j][1] === key) { sf.deleteRow(j + 1); break; }
      }
      logAction('ลบฟิลด์', typeKey, key, '');
    } else {
      return { error: 'unknown mode' };
    }
    clearAllCache();
    clearCache(typeKey);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}
