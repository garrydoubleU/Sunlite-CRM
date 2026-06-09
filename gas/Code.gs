// ============================================================
// Sunlite Sales & Routing Hub — Google Apps Script Backend
// Deploy as: Web App → Execute as Me → Anyone can access
// ============================================================

const SHEET_ID = '1Y5Hf98dhR-T0O7KoG-E456NI4mtvWO2yES_DGvbJOm4';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

// ── CORS helper ──────────────────────────────────────────────
function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GET router ───────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action;
  try {
    switch (action) {
      case 'login':       return buildResponse(handleLogin(e.parameter));
      case 'getCustomers':return buildResponse(getSheetData('Customers'));
      case 'getLogs':     return buildResponse(getSheetData('Activities'));
      case 'getUsers':    return buildResponse(getSheetData('Users'));
      case 'getQuickLinks': return buildResponse(getSheetData('QuickLinks'));
      case 'ping':        return buildResponse({ status: 'ok' });
      default:            return buildResponse({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return buildResponse({ error: err.toString() });
  }
}

// ── POST router ──────────────────────────────────────────────
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    body = e.parameter;
  }
  const action = body.action || e.parameter.action;
  try {
    switch (action) {
      case 'saveLog':       return buildResponse(saveLog(body));
      case 'updateCustomer':return buildResponse(updateCustomer(body));
      case 'deleteLog':     return buildResponse(deleteLog(body));
      default:              return buildResponse({ error: 'Unknown POST action: ' + action });
    }
  } catch (err) {
    return buildResponse({ error: err.toString() });
  }
}

// ── Generic sheet reader ──────────────────────────────────────
function getSheetData(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName, data: [] };

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { data: [] };

  const headers = values[0].map(h => String(h).trim());
  const rows = values.slice(1).filter(row => row.some(cell => cell !== ''));

  const data = rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const val = row[i];
      // Auto-coerce numbers and booleans
      if (val === 'TRUE' || val === true) obj[h] = true;
      else if (val === 'FALSE' || val === false) obj[h] = false;
      else if (typeof val === 'number') obj[h] = val;
      else if (val instanceof Date) obj[h] = val.toISOString();
      else obj[h] = String(val ?? '');
    });
    return obj;
  });

  return { data };
}

// ── Login handler ─────────────────────────────────────────────
function handleLogin(params) {
  const email = (params.email || '').toLowerCase().trim();
  const password = (params.password || '').trim();

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return { success: false, error: 'Users sheet not found' };

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const rows = values.slice(1);

  const emailIdx = headers.indexOf('email');
  const passIdx  = headers.indexOf('password');

  const match = rows.find(row => {
    const rowEmail = String(row[emailIdx] || '').toLowerCase().trim();
    const rowPass  = String(row[passIdx]  || '').trim();
    return rowEmail === email && rowPass === password;
  });

  if (!match) return { success: false, error: 'Invalid email or password' };

  const user = {};
  headers.forEach((h, i) => { user[h] = match[i]; });
  delete user.password;

  return { success: true, user };
}

// ── Save activity log ─────────────────────────────────────────
function saveLog(body) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Activities');
  if (!sheet) return { success: false, error: 'Activities sheet not found' };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Generate ID if not provided
  const id = body.id || 'a_' + Date.now();
  const now = new Date().toISOString();

  const row = headers.map(h => {
    if (h === 'id') return id;
    if (h === 'date' && !body.date) return now;
    return body[h] !== undefined ? body[h] : '';
  });

  sheet.appendRow(row);
  return { success: true, id };
}

// ── Update customer field ─────────────────────────────────────
function updateCustomer(body) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Customers');
  if (!sheet) return { success: false, error: 'Customers sheet not found' };

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const idIdx = headers.indexOf('id');

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIdx]) === String(body.id)) {
      Object.keys(body).forEach(key => {
        if (key === 'id') return;
        const colIdx = headers.indexOf(key);
        if (colIdx >= 0) {
          sheet.getRange(i + 1, colIdx + 1).setValue(body[key]);
        }
      });
      return { success: true };
    }
  }
  return { success: false, error: 'Customer not found: ' + body.id };
}

// ── Delete activity log ───────────────────────────────────────
function deleteLog(body) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Activities');
  if (!sheet) return { success: false, error: 'Activities sheet not found' };

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const idIdx = headers.indexOf('id');

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIdx]) === String(body.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Log not found: ' + body.id };
}

// ── Sheet setup helper (run once manually) ────────────────────
function setupSheets() {
  const ss = getSpreadsheet();

  const schemas = {
    Users: ['id','name','email','password','role','territory','avatarInitials'],
    Customers: ['id','name','assignedRepId','assignedRepName','territory','billingAddress',
                'phone','email','priorityTier','customerClass','visitFrequency',
                'lastContactDate','activeStatus','openOrderCount','revenue','dayOfWeek'],
    Activities: ['id','customerId','type','date','repName','summary','source'],
    QuickLinks: ['id','label','icon','description','color','url'],
  };

  Object.entries(schemas).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    // Only write headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#0F2A4A')
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  });

  // Seed Users sheet with demo reps if empty
  const userSheet = ss.getSheetByName('Users');
  if (userSheet.getLastRow() <= 1) {
    const users = [
      ['rep1','Lipa Cohen','lipa@sunlite.com','demo123','admin','Brooklyn','LC'],
      ['rep2','David Stern','david@sunlite.com','demo123','field_sales','Queens','DS'],
      ['rep3','Sarah Klein','sarah@sunlite.com','demo123','inside_sales','Manhattan','SK'],
      ['rep4','Mike Rosen','mike@sunlite.com','demo123','customer_service','Bronx','MR'],
    ];
    userSheet.getRange(2, 1, users.length, users[0].length).setValues(users);
  }

  // Seed QuickLinks if empty
  const qlSheet = ss.getSheetByName('QuickLinks');
  if (qlSheet.getLastRow() <= 1) {
    const links = [
      ['ql1','Product Catalog','BookOpen','Full product catalog & specs','bg-blue-50 text-blue-600','#'],
      ['ql2','Price Sheet','DollarSign','Current pricing by category','bg-green-50 text-green-600','#'],
      ['ql3','Order Entry','ShoppingCart','Acumatica order entry portal','bg-amber-50 text-amber-600','#'],
      ['ql4','Internal Docs','FileText','Policies, SOPs, and training','bg-purple-50 text-purple-600','#'],
      ['ql5','Territory Map','Map','Rep territory boundaries','bg-teal-50 text-teal-600','#'],
      ['ql6','CRM Reports','BarChart2','Sales activity reports','bg-indigo-50 text-indigo-600','#'],
      ['ql7','Sample Requests','Package','Request product samples','bg-orange-50 text-orange-600','#'],
      ['ql8','Support Desk','Headphones','Internal IT & ops support','bg-red-50 text-red-500','#'],
    ];
    qlSheet.getRange(2, 1, links.length, links[0].length).setValues(links);
  }

  Logger.log('✅ Sheet setup complete. Tabs: ' + Object.keys(schemas).join(', '));
}
