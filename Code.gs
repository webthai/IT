/**
 * IT Asset, Phone Directory & Dashboard System
 * Backend: Google Apps Script Web App (doGet / doPost)
 * Database: Google Sheets
 *
 * DEPLOY:
 * 1. เปิด Google Sheet ที่จะใช้เป็นฐานข้อมูล > Extensions > Apps Script
 * 2. วางไฟล์นี้ทับ Code.gs เดิม (Save)
 * 3. รันฟังก์ชัน setupSheets() หนึ่งครั้ง เพื่อสร้างชีตและหัวตารางทั้งหมดอัตโนมัติ
 *    (เลือกฟังก์ชัน setupSheets จาก dropdown ด้านบน แล้วกด Run)
 * 4. Deploy > New deployment > เลือกประเภท "Web app"
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. คัดลอก Web App URL ไปวางใน app.js (ตัวแปร API_URL)
 */

// ---------- CONFIG ----------
var PIN_CODE = '5340';

var SHEET_DEFS = {
  IPPhone: ['ID', 'สาขา', 'อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย', 'เบอร์ภายใน', 'IP Address', 'สายตรง', 'สำรอง', 'หมายเหตุ', 'อัปเดตล่าสุด'],
  EDC: ['ID', 'สาขา', 'อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย', 'ธนาคาร', 'TID', 'MID', 'IP/SIM', 'สำรอง', 'หมายเหตุ', 'อัปเดตล่าสุด'],
  Pinpad: ['ID', 'สาขา', 'อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย', 'Serial Number', 'PC การเงินที่เชื่อมต่อ', 'สำรอง', 'หมายเหตุ', 'อัปเดตล่าสุด'],
  Printer: ['ID', 'สาขา', 'อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย', 'IP Address', 'ชื่อ Share Printer', 'รุ่นตลับหมึก', 'สำรอง', 'หมายเหตุ', 'อัปเดตล่าสุด'],
  ServerPC: ['ID', 'สาขา', 'อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย', 'Hostname', 'IP Address', 'MAC Address', 'สเปกเครื่อง', 'สำรอง', 'หมายเหตุ', 'อัปเดตล่าสุด'],
  Log: ['เวลา', 'การกระทำ', 'ประเภท', 'ID รายการ', 'รายละเอียด']
};

var BRANCHES = ['อโศก', 'ปิ่นเกล้า', 'อุดร'];

// ---------- SETUP ----------
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
}

// ---------- ENTRY POINTS ----------
function doGet(e) {
  try {
    var action = e.parameter.action;
    if (action === 'summary') return jsonOut(getSummary());
    if (action === 'spare') return jsonOut(getSpareList(e.parameter.branch));
    if (action === 'list') return jsonOut(listRows(e.parameter.type, e.parameter.branch));
    if (action === 'search') return jsonOut(searchPhones(e.parameter.q));
    if (action === 'suggest') return jsonOut(getSuggestions(e.parameter.type));
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
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(type);
  if (!sheet) throw new Error('ไม่พบชีต: ' + type + ' (รัน setupSheets() ก่อน)');
  return sheet;
}

function sheetToObjects(sheet) {
  var values = sheet.getDataRange().getValues();
  var headers = values.shift();
  return values
    .filter(function (row) { return row[0] !== ''; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
}

function listRows(type, branch) {
  var rows = sheetToObjects(getSheet(type));
  if (branch) rows = rows.filter(function (r) { return r['สาขา'] === branch; });
  return rows;
}

function getSuggestions(type) {
  var rows = sheetToObjects(getSheet(type));
  var fields = ['อาคาร', 'ชั้น', 'แผนก', 'ตำแหน่งย่อย'];
  var out = {};
  fields.forEach(function (f) {
    var set = {};
    rows.forEach(function (r) { if (r[f]) set[r[f]] = true; });
    out[f] = Object.keys(set);
  });
  return out;
}

function getSummary() {
  var types = Object.keys(SHEET_DEFS).filter(function (t) { return t !== 'Log'; });
  var summary = { total: {}, spare: {}, byBranch: {} };
  BRANCHES.forEach(function (b) { summary.byBranch[b] = {}; });

  types.forEach(function (type) {
    var rows = sheetToObjects(getSheet(type));
    summary.total[type] = rows.length;
    summary.spare[type] = rows.filter(function (r) { return r['สำรอง'] === true || r['สำรอง'] === 'TRUE'; }).length;
    BRANCHES.forEach(function (b) {
      summary.byBranch[b][type] = rows.filter(function (r) { return r['สาขา'] === b; }).length;
    });
  });
  return summary;
}

function getSpareList(branch) {
  var types = Object.keys(SHEET_DEFS).filter(function (t) { return t !== 'Log'; });
  var out = [];
  types.forEach(function (type) {
    var rows = sheetToObjects(getSheet(type)).filter(function (r) {
      return (r['สำรอง'] === true || r['สำรอง'] === 'TRUE') && (!branch || r['สาขา'] === branch);
    });
    rows.forEach(function (r) { r['ประเภท'] = type; out.push(r); });
  });
  return out;
}

function searchPhones(q) {
  var rows = sheetToObjects(getSheet('IPPhone'));
  if (!q) return rows;
  q = q.toString().toLowerCase();
  return rows.filter(function (r) {
    return ['เบอร์ภายใน', 'สายตรง', 'แผนก', 'ตำแหน่งย่อย', 'อาคาร', 'ชั้น', 'สาขา'].some(function (f) {
      return (r[f] || '').toString().toLowerCase().indexOf(q) !== -1;
    });
  });
}

function saveRow(type, data) {
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
  return { ok: true, id: newId };
}

function deleteRow(type, id) {
  var sheet = getSheet(type);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      logAction('ลบ', type, id, '');
      return { ok: true };
    }
  }
  return { error: 'ไม่พบรายการ' };
}

function logAction(action, type, id, detail) {
  var sheet = getSheet('Log');
  sheet.appendRow([nowThai(), action, type, id, detail]);
}
