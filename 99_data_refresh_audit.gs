/************************************************************
 * ACS | DATA REFRESH AUDIT v2
 * Проверка качества обновления RAW-данных Google Ads
 ************************************************************/

function auditDataRefreshQuality() {
  const ss = SpreadsheetApp.getActive();

  const rawSheets = [
    { name: 'r_campaign_1', expectedDays: 1, allowEmpty: false },
    { name: 'r_campaign_7', expectedDays: 7, allowEmpty: false },
    { name: 'r_campaign_30', expectedDays: 30, allowEmpty: false },
    { name: 'r_campaign_365', expectedDays: 365, allowEmpty: false },
    { name: 'r_campaign_day_30', expectedDays: 30, allowEmpty: false, mustHaveDate: true },

    { name: 'r_pmax_prod_1', expectedDays: 1, allowEmpty: false },
    { name: 'r_pmax_prod_7', expectedDays: 7, allowEmpty: false },
    { name: 'r_pmax_prod_30', expectedDays: 30, allowEmpty: false },
    { name: 'r_pmax_prod_180', expectedDays: 180, allowEmpty: false },
    { name: 'r_pmax_prod_365', expectedDays: 365, allowEmpty: false },

    { name: 'r_pmax_zombies_365', expectedDays: 365, allowEmpty: true },

    { name: 'r_search_terms_1', expectedDays: 1, allowEmpty: true },
    { name: 'r_search_terms_7', expectedDays: 7, allowEmpty: true },
    { name: 'r_search_terms_30', expectedDays: 30, allowEmpty: true },
    { name: 'r_search_terms_365', expectedDays: 365, allowEmpty: true },

    { name: 'r_assets_pmax', expectedDays: null, allowEmpty: false },

    { name: 'r_asset_groups_1', expectedDays: 1, allowEmpty: false },
    { name: 'r_asset_groups_7', expectedDays: 7, allowEmpty: false },
    { name: 'r_asset_groups_30', expectedDays: 30, allowEmpty: false },
    { name: 'r_asset_groups_365', expectedDays: 365, allowEmpty: false },

    { name: 'RAW_EXPORT_AUDIT', expectedDays: null, allowEmpty: false },
    { name: 'EXEC_LOG', expectedDays: null, allowEmpty: false }
  ];

  const exportAuditMap = readRawExportAuditMap_(ss);

  const outName = 'DATA_REFRESH_AUDIT';
  let out = ss.getSheetByName(outName);
  if (!out) out = ss.insertSheet(outName);
  out.clear();

  const now = new Date();

  const result = [[
    'RAW лист',
    'Статус',
    'Строк данных',
    'Колонок',
    'Ожидаемый период',
    'Export from',
    'Export to',
    'Export status',
    'Export rows',
    'Has data',
    'Пустые заголовки',
    'Дубли заголовков',
    'Пустые строки',
    'Cost total',
    'Conversions total',
    'Value total',
    'Проблема',
    'Проверено'
  ]];

  rawSheets.forEach(cfg => {
    const sh = ss.getSheetByName(cfg.name);
    const exportInfo = exportAuditMap[cfg.name] || {};

    if (!sh) {
      result.push([
        cfg.name, 'CRIT',
        0, 0,
        cfg.expectedDays || '',
        exportInfo.from_date || '',
        exportInfo.to_date || '',
        exportInfo.status || '',
        exportInfo.rows || '',
        exportInfo.has_data || '',
        '', '', '',
        '', '', '',
        'RAW-лист отсутствует',
        now
      ]);
      return;
    }

    const values = sh.getDataRange().getValues();

    if (values.length < 1 || values[0].length < 1) {
      result.push([
        cfg.name, 'CRIT',
        0, 0,
        cfg.expectedDays || '',
        exportInfo.from_date || '',
        exportInfo.to_date || '',
        exportInfo.status || '',
        exportInfo.rows || '',
        exportInfo.has_data || '',
        '', '', '',
        '', '', '',
        'RAW-лист полностью пустой',
        now
      ]);
      return;
    }

    const headers = values[0].map(h => String(h || '').trim());
    const rows = values.length > 1 ? values.slice(1) : [];

    const emptyHeaders = headers.filter(h => !h).length;
    const duplicateHeaders = countDuplicateHeadersAudit_(headers);
    const emptyRows = countEmptyRowsAudit_(rows);
    const metricInfo = getMetricTotalsAudit_(headers, rows);

    let status = 'OK';
    const problems = [];

    if (rows.length === 0 && !cfg.allowEmpty) {
      status = 'CRIT';
      problems.push('Нет строк данных');
    }

    if (rows.length === 0 && cfg.allowEmpty) {
      status = 'INFO';
      problems.push('Пусто допустимо для этого типа RAW');
    }

    if (emptyHeaders > 0) {
      status = maxAuditStatus_(status, 'WARN');
      problems.push('Есть пустые заголовки');
    }

    if (duplicateHeaders > 0) {
      status = maxAuditStatus_(status, 'WARN');
      problems.push('Есть дубли заголовков');
    }

    if (emptyRows > 0) {
      status = maxAuditStatus_(status, 'WARN');
      problems.push('Есть полностью пустые строки');
    }

    if (cfg.mustHaveDate) {
      const dateInfo = getDateCoverageAudit_(headers, rows, ['segments.date', 'date', 'Дата']);

      if (!dateInfo.hasDateColumn) {
        status = maxAuditStatus_(status, 'CRIT');
        problems.push('Нет колонки даты');
      } else if (!dateInfo.maxDate) {
        status = maxAuditStatus_(status, 'CRIT');
        problems.push('Дата есть, но не распознана');
      } else {
        const diffFromToday = daysBetweenAudit_(dateInfo.maxDate, now);

        if (diffFromToday > 2) {
          status = maxAuditStatus_(status, 'CRIT');
          problems.push('Данные устарели: последняя дата старше 2 дней');
        }

        if (cfg.expectedDays && dateInfo.daysInData < Math.min(cfg.expectedDays * 0.7, cfg.expectedDays - 2)) {
          status = maxAuditStatus_(status, 'WARN');
          problems.push('Период данных короче ожидаемого');
        }
      }
    }

    if (exportInfo.status && exportInfo.status !== 'OK') {
      status = maxAuditStatus_(status, 'CRIT');
      problems.push('RAW export failed: ' + exportInfo.message);
    }

    if (exportInfo.rows !== '' && Number(exportInfo.rows) !== rows.length) {
      status = maxAuditStatus_(status, 'WARN');
      problems.push('Количество строк в RAW не совпадает с RAW_EXPORT_AUDIT');
    }

    if (metricInfo.hasCost && metricInfo.costTotal === 0 && rows.length > 0 && cfg.name.indexOf('assets') < 0) {
      status = maxAuditStatus_(status, 'WARN');
      problems.push('Cost total = 0');
    }

    result.push([
      cfg.name,
      status,
      rows.length,
      headers.length,
      cfg.expectedDays || '',
      exportInfo.from_date || '',
      exportInfo.to_date || '',
      exportInfo.status || '',
      exportInfo.rows || '',
      exportInfo.has_data || '',
      emptyHeaders,
      duplicateHeaders,
      emptyRows,
      metricInfo.costTotal,
      metricInfo.conversionsTotal,
      metricInfo.valueTotal,
      problems.length ? problems.join('; ') : 'OK',
      now
    ]);
  });

  out.getRange(1, 1, result.length, result[0].length).setValues(result);

  out.setFrozenRows(1);
  out.getRange(1, 1, 1, result[0].length)
    .setFontWeight('bold')
    .setBackground('#d9e2f3');

  formatAuditSheetV2_(out);
  out.autoResizeColumns(1, result[0].length);

  SpreadsheetApp.flush();
}

function readRawExportAuditMap_(ss) {
  const sh = ss.getSheetByName('RAW_EXPORT_AUDIT');
  const map = {};

  if (!sh) return map;

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return map;

  const headers = values[0].map(h => String(h || '').trim());

  const iSheet = headers.indexOf('sheet');
  const iFrom = headers.indexOf('from_date');
  const iTo = headers.indexOf('to_date');
  const iStatus = headers.indexOf('status');
  const iRows = headers.indexOf('rows');
  const iHasData = headers.indexOf('has_data');
  const iMessage = headers.indexOf('message');

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const sheetName = iSheet >= 0 ? String(row[iSheet] || '').trim() : '';
    if (!sheetName) continue;

    map[sheetName] = {
      from_date: iFrom >= 0 ? row[iFrom] : '',
      to_date: iTo >= 0 ? row[iTo] : '',
      status: iStatus >= 0 ? String(row[iStatus] || '').trim() : '',
      rows: iRows >= 0 ? row[iRows] : '',
      has_data: iHasData >= 0 ? String(row[iHasData] || '').trim() : '',
      message: iMessage >= 0 ? String(row[iMessage] || '').trim() : ''
    };
  }

  return map;
}

function countDuplicateHeadersAudit_(headers) {
  const seen = {};
  let duplicates = 0;

  headers.forEach(h => {
    if (!h) return;
    seen[h] = (seen[h] || 0) + 1;
  });

  Object.keys(seen).forEach(h => {
    if (seen[h] > 1) duplicates += seen[h] - 1;
  });

  return duplicates;
}

function countEmptyRowsAudit_(rows) {
  return rows.filter(row => row.every(cell => cell === '' || cell === null)).length;
}

function getMetricTotalsAudit_(headers, rows) {
  const costCol = findHeaderAudit_(headers, ['cost', 'metrics.cost_micros']);
  const convCol = findHeaderAudit_(headers, ['metrics.conversions', 'conversions']);
  const valueCol = findHeaderAudit_(headers, ['metrics.conversions_value', 'conversion_value', 'value']);

  let costTotal = 0;
  let conversionsTotal = 0;
  let valueTotal = 0;

  rows.forEach(row => {
    if (costCol >= 0) costTotal += Number(row[costCol]) || 0;
    if (convCol >= 0) conversionsTotal += Number(row[convCol]) || 0;
    if (valueCol >= 0) valueTotal += Number(row[valueCol]) || 0;
  });

  return {
    hasCost: costCol >= 0,
    costTotal: costTotal,
    conversionsTotal: conversionsTotal,
    valueTotal: valueTotal
  };
}

function getDateCoverageAudit_(headers, rows, possibleDateColumns) {
  let dateCol = -1;

  for (let i = 0; i < possibleDateColumns.length; i++) {
    const idx = headers.indexOf(possibleDateColumns[i]);
    if (idx >= 0) {
      dateCol = idx;
      break;
    }
  }

  if (dateCol < 0) {
    return {
      hasDateColumn: false,
      minDate: '',
      maxDate: '',
      daysInData: ''
    };
  }

  const dates = [];

  rows.forEach(row => {
    const d = parseDateSafeAudit_(row[dateCol]);
    if (d) dates.push(d);
  });

  if (!dates.length) {
    return {
      hasDateColumn: true,
      minDate: '',
      maxDate: '',
      daysInData: ''
    };
  }

  dates.sort((a, b) => a - b);

  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  return {
    hasDateColumn: true,
    minDate: minDate,
    maxDate: maxDate,
    daysInData: daysBetweenAudit_(minDate, maxDate) + 1
  };
}

function parseDateSafeAudit_(value) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const s = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const parts = s.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  if (/^\d{8}$/.test(s)) {
    return new Date(
      Number(s.substring(0, 4)),
      Number(s.substring(4, 6)) - 1,
      Number(s.substring(6, 8))
    );
  }

  const d = new Date(s);
  if (!isNaN(d)) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  return null;
}

function findHeaderAudit_(headers, variants) {
  for (let i = 0; i < variants.length; i++) {
    const idx = headers.indexOf(variants[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

function daysBetweenAudit_(d1, d2) {
  const a = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const b = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor(Math.abs(b - a) / (24 * 60 * 60 * 1000));
}

function maxAuditStatus_(current, next) {
  const rank = {
    'OK': 0,
    'INFO': 0,
    'WARN': 1,
    'CRIT': 2
  };

  return rank[next] > rank[current] ? next : current;
}

function formatAuditSheetV2_(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  sh.getRange(2, 6, lastRow - 1, 2).setNumberFormat('yyyy-mm-dd');
  sh.getRange(2, 14, lastRow - 1, 3).setNumberFormat('#,##0.00');
  sh.getRange(2, 18, lastRow - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');

  const statusRange = sh.getRange(2, 2, lastRow - 1, 1);
  const values = statusRange.getValues();

  for (let i = 0; i < values.length; i++) {
    const cell = statusRange.getCell(i + 1, 1);
    const status = String(values[i][0]).trim();

    if (status === 'OK') {
      cell.setBackground('#d9ead3');
    } else if (status === 'INFO') {
      cell.setBackground('#d9e2f3');
    } else if (status === 'WARN') {
      cell.setBackground('#fff2cc');
    } else if (status === 'CRIT') {
      cell.setBackground('#f4cccc');
    }
  }

  sh.getRange(1, 1, lastRow, sh.getLastColumn()).setVerticalAlignment('middle');
  sh.getRange(1, 17, lastRow, 1).setWrap(true);
}
