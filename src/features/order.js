/**
 * Code.gs (Apps Script)
 */

const SHEET_ID        = '1ETXPm2LMgrCikHGNEJvn-2gW7E6sNEvZ8NWsHHiflrg';
const DAILY_SHEET     = '善化';
const AGGREGATE_SHEET = '善化彙整';

/**
 * doPost(e)：接收 Bot POST，執行 order / cancel / prepaid，並更新該生彙整
 */
function doPost(e) {
  console.log('▶️ doPost payload:', e.postData.contents);
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    console.error('❌ JSON.parse 失敗', err);
    return _errorResponse('invalid JSON');
  }

  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const daily = ss.getSheetByName(DAILY_SHEET);
  const agg   = ss.getSheetByName(AGGREGATE_SHEET);
  if (!daily || !agg) {
    console.error('❌ 找不到分頁');
    return _errorResponse('sheet not found');
  }

  try {
    // 單筆訂單
    if (params.type === 'order') {
      console.log('→ 處理單筆 order:', params.student);
      const dateObj   = params.date ? new Date(params.date) : new Date();
      const formatted = Utilities.formatDate(dateObj, 'GMT+8', 'yyyy/MM/dd HH:mm:ss');
      const row = [
        formatted,
        params.student,
        params.items.map(i => `[${i.name}]x${i.qty}($${i.price})`).join(' + '),
        params.total
      ];
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        daily.appendRow(row);
        console.log(`✅ 已 appendRow 訂單到 ${DAILY_SHEET}`, row);
      } finally {
        lock.releaseLock();
      }
      updateStudentAggregate(params.student);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
    }

    // 取消訂單（負值抵消）
    else if (params.type === 'cancel') {
      console.log('→ 處理 cancel (負值抵銷):', params.student);
      const dateObj   = params.date ? new Date(params.date) : new Date();
      const formatted = Utilities.formatDate(dateObj, 'GMT+8', 'yyyy/MM/dd HH:mm:ss');
      const row = [
        formatted,
        params.student,
        params.items.map(i => `[${i.name}]x${i.qty}($${i.price})`).join(' + '),
        params.total
      ];
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        daily.appendRow(row);
        console.log(`✅ 已 append cancel offset 到 ${DAILY_SHEET}`, row);
      } finally {
        lock.releaseLock();
      }
      updateStudentAggregate(params.student);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
    }

    // 預收款
    else if (params.type === 'prepaid') {
      console.log('→ 處理 prepaid:', params.student, params.amount);
      const student = String(params.student).trim();
      const amount  = Number(params.amount) || 0;
      const lr      = agg.getLastRow();
      const names   = lr > 1 ? agg.getRange(2, 1, lr - 1, 1).getValues().flat() : [];
      const idx     = names.indexOf(student);
      if (idx >= 0) {
        agg.getRange(idx + 2, 3).setValue(amount);
        console.log(`✅ 更新預收：${student} C欄 = ${amount}`);
      } else {
        agg.appendRow([student, '', amount, '', '']);
        console.log(`✅ 新增預收：${student}, C = ${amount}`);
      }
      updateStudentAggregate(student);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
    }

    // 不支援的 type
    else {
      console.error('❌ 不支援的 type:', params.type);
      return _errorResponse('unsupported type');
    }
  } catch (err) {
    console.error('❌ doPost 處理失敗', err);
    return _errorResponse('processing error');
  }
}

/**
 * doGet(e)：支援 recalc / expense / balance
 */
function doGet(e) {
  const action = e.parameter.action;
  const ss     = SpreadsheetApp.openById(SHEET_ID);
  const sh     = ss.getSheetByName(AGGREGATE_SHEET);

  if (action === 'recalc') {
    recalcAllAggregate();
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
  }

  if (!sh || sh.getLastRow() < 2) {
    return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON);
  }
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  const out  = data.map(r => ({ student: r[0], value: action === 'balance' ? r[4] : r[3] }));
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// 以下函式保持不變：
// recalcAllAggregate, updateStudentAggregate, _errorResponse
