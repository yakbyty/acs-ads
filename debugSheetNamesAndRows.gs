function debugSheetNamesAndRows() {
  const ss = SpreadsheetApp.getActive();
  const outName = 'DEBUG_SHEETS';
  let out = ss.getSheetByName(outName);
  if (!out) out = ss.insertSheet(outName);
  out.clear();

  const rows = [[
    'sheet_name',
    'last_row',
    'last_col',
    'is_hidden'
  ]];

  ss.getSheets().forEach(sh => {
    rows.push([
      sh.getName(),
      sh.getLastRow(),
      sh.getLastColumn(),
      sh.isSheetHidden()
    ]);
  });

  out.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  out.setFrozenRows(1);
  out.autoResizeColumns(1, rows[0].length);
}
