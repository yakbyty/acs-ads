function debugOneSku475cu10() {
  debugOneSku_('45l75');
}

function debugOneSku_(sku) {
  const ss = SpreadsheetApp.getActive();
  const outName = 'DEBUG_ONE_SKU';

  let out = ss.getSheetByName(outName);
  if (!out) out = ss.insertSheet(outName);
  out.clear();

  const sheetsToCheck = [
    'r_pmax_prod_1',
    'r_pmax_prod_7',
    'r_pmax_prod_30',
    'r_pmax_prod_180',
    'r_pmax_prod_365',
    'SIG_Product_Duplicates',
    'SIG_Winners',
    'SIG_Bleeders'
  ];

  const result = [[
    'sheet',
    'rows_found',
    'campaign',
    'item_id',
    'cost',
    'value',
    'roas',
    'conv',
    'clicks',
    'impr'
  ]];

  sheetsToCheck.forEach(name => {
    const sh = ss.getSheetByName(name);

    if (!sh) {
      result.push([name, 'NO SHEET', '', '', '', '', '', '', '', '']);
      return;
    }

    const values = sh.getDataRange().getValues();

    if (values.length < 2) {
      result.push([name, 0, '', '', '', '', '', '', '', '']);
      return;
    }

    const headers = values[0].map(h => String(h || '').trim());
    const rows = values.slice(1);

    const iCampaign = findCol_(headers, ['campaign.name', 'Campaign']);
    const iItem = findCol_(headers, ['segments.product_item_id', 'Item ID', 'item_id']);
    const iCost = findCol_(headers, ['cost', 'Cost', 'Cost 30d']);
    const iValue = findCol_(headers, ['metrics.conversions_value', 'Value', 'Value 30d']);
    const iRoas = findCol_(headers, ['ROAS', 'ROAS 30d']);
    const iConv = findCol_(headers, ['metrics.conversions', 'Conv', 'Conv 30d']);
    const iClicks = findCol_(headers, ['metrics.clicks', 'Clicks', 'Clicks 30d']);
    const iImpr = findCol_(headers, ['metrics.impressions', 'Impr', 'Impr 30d']);

    let found = 0;

    rows.forEach(r => {
      const item = iItem >= 0 ? String(r[iItem] || '').trim() : '';

      if (item !== String(sku)) return;

      found++;

      const cost = iCost >= 0 ? Number(r[iCost]) || 0 : 0;
      const value = iValue >= 0 ? Number(r[iValue]) || 0 : 0;
      const roas = iRoas >= 0 ? Number(r[iRoas]) || 0 : (cost ? value / cost : 0);

      result.push([
        name,
        found,
        iCampaign >= 0 ? r[iCampaign] : '',
        item,
        cost,
        value,
        roas,
        iConv >= 0 ? Number(r[iConv]) || 0 : 0,
        iClicks >= 0 ? Number(r[iClicks]) || 0 : 0,
        iImpr >= 0 ? Number(r[iImpr]) || 0 : 0
      ]);
    });

    if (found === 0) {
      result.push([name, 0, '', sku, '', '', '', '', '', '']);
    }
  });

  out.getRange(1, 1, result.length, result[0].length).setValues(result);
  out.setFrozenRows(1);
  out.getRange(1, 1, 1, result[0].length).setFontWeight('bold').setBackground('#d9e2f3');
  out.autoResizeColumns(1, result[0].length);
}

function findCol_(headers, variants) {
  for (let i = 0; i < variants.length; i++) {
    const idx = headers.indexOf(variants[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}
