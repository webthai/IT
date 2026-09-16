/**
 * IT Asset, Phone Directory & Dashboard System
 * Backend: Google Apps Script Web App (doGet / doPost)
 * Database: Google Sheets
 *
 * ไฟล์นี้ต่อยอดจาก Code.gs ที่ deploy อยู่จริง (ไม่ใช่เขียนใหม่ทั้งหมด)
 * สิ่งที่เพิ่มเข้ามาเพื่อแก้ปัญหาโหลดช้า มีแค่ 3 อย่าง:
 *   1. cachedRows() — อ่านแต่ละชีตแล้วเก็บไว้ 5 นาที (memory + CacheService)
 *      เดิมเปิดแดชบอร์ดครั้งเดียวอ่านชีต 10 รอบ ตอนนี้เหลือ 5 รอบครั้งแรก แล้ว 0 รอบในครั้งถัดไป
 *   2. action=bootstrap — ส่งข้อมูลทุกประเภทกลับในคำขอเดียว ให้ frontend ยิงครั้งเดียวตอนเปิดเว็บ
 *   3. clearCache() ตอน save/delete — กันไม่ให้เห็นข้อมูลเก่าค้างหลังแก้ไข
 * ของเดิมทั้งหมด (SPREADSHEET_ID, checkSetup, fieldValues, action เดิมทุกตัว) ยังอยู่ครบ ใช้งานได้เหมือนเดิม
 *
 * DEPLOY:
 * 1. เปิด Google Sheet ที่ใช้เป็นฐานข้อมูล > Extensions > Apps Script
 * 2. วางไฟล์นี้ทับ Code.gs เดิม (Save)
 * 3. รันฟังก์ชัน setupSheets() หนึ่งครั้ง (ถ้าเคยรันแล้วไม่ต้องรันซ้ำ)
 * 4. Deploy > Manage deployments > (ไอคอนดินสอ) > Version: New version > Deploy
 *    ใช้วิธีนี้แทน New deployment เพื่อให้ URL เดิมใช้ต่อได้ ไม่ต้องแก้ app.js
 */

// ---------- CONFIG ----------
var PIN_CODE = '5340';
var CACHE_SECONDS = 300; // เก็บ cache 5 นาที ปรับได้

// ถ้าสร้างโปรเจกต์ Apps Script แบบแยก (standalone) ให้ใส่ Spreadsheet ID ตรงนี้
// วิธีดู ID: เปิด Google Sheet แล้วดูจาก URL ช่วงระหว่าง /d/ กับ /edit
// ถ้าเปิด Apps Script จากในชีตอยู่แล้ว (ปกติ) ปล่อยว่างไว้ได้เลย
var SPREADSHEET_ID = '';

var SHEET_DEFS = {
  IPPhone: ['ID', 'สาขา', 'อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย', 'เบอร์ภายใน', 'IP Address', 'สายตรง', 'สำรอง', 'หมายเหตุ', 'อัปเดตล่าสุด'],
  EDC: ['ID', 'สาขา', 'อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย', 'TID', 'Serial Number', 'สำรอง', 'หมายเหตุ', 'อัปเดตล่าสุด'],
  Pinpad: ['ID', 'สาขา', 'อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย', 'TID', 'Serial Number', 'สำรอง', 'หมายเหตุ', 'อัปเดตล่าสุด'],
  PrinterServer: ['ID', 'สาขา', 'อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย', 'Hostname', 'IP Address', 'MAC Address', 'ชื่อ Share Printer', 'รุ่นตลับหมึก', 'เลข AnyDesk', 'สำรอง', 'หมายเหตุ', 'อัปเดตล่าสุด'],
  PC: ['ID', 'สาขา', 'อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย', 'Hostname', 'IP Address', 'MAC Address', 'สเปกเครื่อง', 'เลข AnyDesk', 'สำรอง', 'หมายเหตุ', 'อัปเดตล่าสุด'],
  Log: ['เวลา', 'การกระทำ', 'ประเภท', 'ID รายการ', 'รายละเอียด']
};

var BRANCHES = ['อโศก', 'ปิ่นเกล้า', 'อุดร'];

function assetTypes() {
  return Object.keys(SHEET_DEFS).filter(function (t) { return t !== 'Log'; });
}

// ---------- SETUP ----------
function getSpreadsheet() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

// รันฟังก์ชันนี้จาก Apps Script editor เพื่อเช็คว่าตอนนี้ชีตไหนถูกสร้างไปแล้วบ้าง
// ดูผลได้ที่ View > Logs (หรือ Ctrl+Enter หลัง Run)
function checkSetup() {
  var ss = getSpreadsheet();
  Logger.log('กำลังเช็คไฟล์: ' + ss.getName() + ' (' + ss.getUrl() + ')');
  Logger.log('ชีตที่มีอยู่: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
}

function setupSheets() {
  var ss = getSpreadsheet();
  Object.keys(SHEET_DEFS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    var headers = SHEET_DEFS[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  });
  // ลบ Sheet1 เริ่มต้นถ้ายังไม่ได้ใช้
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  clearAllCache();
}

// ---------- CACHE ----------
var _mem = {}; // cache ระดับ memory ใช้ซ้ำภายใน request เดียวกัน (เช่นตอน getAll วนอ่านหลายชีต)

function cachedRows(type) {
  if (_mem[type]) return _mem[type];
  var cache = CacheService.getScriptCache();
  var hit = cache.get('rows_' + type);
  if (hit) {
    _mem[type] = JSON.parse(hit);
    return _mem[type];
  }
  var rows = sheetToObjects(getSheet(type));
  _mem[type] = rows;
  try {
    cache.put('rows_' + type, JSON.stringify(rows), CACHE_SECONDS);
  } catch (e) {
    // ข้อมูลเกิน 100KB ต่อ key — ข้าม cache ไป ยังทำงานได้ปกติแค่ช้ากว่า
  }
  return rows;
}

function clearCache(type) {
  delete _mem[type];
  CacheService.getScriptCache().remove('rows_' + type);
}

function clearAllCache() {
  _mem = {};
  CacheService.getScriptCache().removeAll(assetTypes().map(function (t) { return 'rows_' + t; }));
}

// ---------- ENTRY POINTS ----------
function doGet(e) {
  try {
    var action = e.parameter.action;
    // ส่งทุกอย่างในคำขอเดียว — frontend รุ่นใหม่ใช้ตัวนี้เป็นหลัก
    if (action === 'bootstrap') return jsonOut(getAll());
    // action เดิมทั้งหมด ยังใช้งานได้ตามปกติ
    if (action === 'summary') return jsonOut(getSummary());
    if (action === 'spare') return jsonOut(getSpareList(e.parameter.branch));
    if (action === 'list') return jsonOut(listRows(e.parameter.type, e.parameter.branch));
    if (action === 'search') return jsonOut(searchPhones(e.parameter.q));
    if (action === 'suggest') return jsonOut(getSuggestions(e.parameter.type));
    if (action === 'fieldValues') return jsonOut(getFieldValues(e.parameter.type, e.parameter.field, e.parameter.branch));
    return jsonOut({ error: 'unknown action' });
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.pin !== PIN_CODE) return jsonOut({ error: 'PIN ไม่ถูกต้อง' });

    if (body.action === 'save') return jsonOut(saveRow(body.type, body.data));
    if (body.action === 'delete') return jsonOut(deleteRow(body.type, body.id));
    return jsonOut({ error: 'unknown action' });
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

// ---------- HELPERS ----------
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function nowThai() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}

function getSheet(type) {
  if (!SHEET_DEFS[type]) throw new Error('ไม่พบประเภทอุปกรณ์: ' + type);
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
  var out = { branches: BRANCHES, updated: nowThai(), data: {} };
  assetTypes().forEach(function (t) { out.data[t] = cachedRows(t); });
  return out;
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
  var summary = { total: {}, spare: {}, byBranch: {} };
  BRANCHES.forEach(function (b) { summary.byBranch[b] = {}; });

  assetTypes().forEach(function (type) {
    var rows = cachedRows(type);
    summary.total[type] = rows.length;
    summary.spare[type] = rows.filter(function (r) { return r['สำรอง'] === true || r['สำรอง'] === 'TRUE'; }).length;
    BRANCHES.forEach(function (b) {
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

// ---------- WRITE ----------
function saveRow(type, data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet(type);
    var headers = SHEET_DEFS[type];
    var values = sheet.getDataRange().getValues();
    data['อัปเดตล่าสุด'] = nowThai();

    if (data['ID']) {
      // แก้ไขแถวเดิม
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
    // เพิ่มแถวใหม่
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
  var sheet = getSheet('Log');
  sheet.appendRow([nowThai(), action, type, id, detail]);
}
