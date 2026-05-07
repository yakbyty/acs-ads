function buildPromAdsDaily2026() {
  const ss = SpreadsheetApp.getActive();
  const sourceName = 'Статистика реклама ПРОМ';
  const targetName = 'PROM_ADS_DAILY_2026';

  const source = ss.getSheetByName(sourceName);
  if (!source) throw new Error('Не найдена страница: ' + sourceName);

  let target = ss.getSheetByName(targetName);
  if (!target) target = ss.insertSheet(targetName);
  target.clear();

  const values = source.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0];

  const colDate = headers.indexOf('Дата');
  const colImpressions = headers.indexOf('Кількість показів');
  const colClicks = headers.indexOf('Кількість кліків');
  const colCost = headers.indexOf('Витрати');
  const colOrders = headers.indexOf('Замовлення');
  const colOrderSum = headers.indexOf('Сума замовлені');
  const colPhoneViews = headers.indexOf('Переглядів теле');

  if (colDate === -1 || colCost === -1) {
    throw new Error('Не найдены обязательные колонки: Дата / Витрати');
  }

  const daily = {};

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const dateKey = makeDateKey_(row[colDate]);
    if (!dateKey) continue;

    if (!daily[dateKey]) {
      daily[dateKey] = {
        impressions: 0,
        clicks: 0,
        cost: 0,
        orders: 0,
        orderSum: 0,
        phoneViews: 0
      };
    }

    daily[dateKey].impressions += num_(row[colImpressions]);
    daily[dateKey].clicks += num_(row[colClicks]);
    daily[dateKey].cost += num_(row[colCost]);
    daily[dateKey].orders += num_(row[colOrders]);
    daily[dateKey].orderSum += num_(row[colOrderSum]);
    daily[dateKey].phoneViews += num_(row[colPhoneViews]);
  }

  const output = [[
    'Дата',
    'Показы',
    'Клики',
    'Расход',
    'CTR %',
    'CPC',
    'Заказы',
    'Сумма заказов',
    'Просмотры телефона',
    'Конверсия в заказ %',
    'Стоимость заказа',
    'ДРР %'
  ]];

  Object.keys(daily)
    .sort()
    .forEach(dateKey => {
      const d = daily[dateKey];

      const ctr = d.impressions ? d.clicks / d.impressions : 0;
      const cpc = d.clicks ? d.cost / d.clicks : 0;
      const crOrder = d.clicks ? d.orders / d.clicks : 0;
      const costPerOrder = d.orders ? d.cost / d.orders : 0;
      const drr = d.orderSum ? d.cost / d.orderSum : 0;

      output.push([
        formatDateKey_(dateKey),
        d.impressions,
        d.clicks,
        d.cost,
        ctr,
        cpc,
        d.orders,
        d.orderSum,
        d.phoneViews,
        crOrder,
        costPerOrder,
        drr
      ]);
    });

  target.getRange(1, 1, output.length, output[0].length).setValues(output);

  target.getRange(1, 1, 1, output[0].length)
    .setFontWeight('bold')
    .setBackground('#d9ead3');

  target.setFrozenRows(1);
  target.autoResizeColumns(1, output[0].length);

  if (output.length > 1) {
    target.getRange(2, 4, output.length - 1, 1).setNumberFormat('#,##0.00');
    target.getRange(2, 5, output.length - 1, 1).setNumberFormat('0.00%');
    target.getRange(2, 6, output.length - 1, 1).setNumberFormat('#,##0.00');
    target.getRange(2, 8, output.length - 1, 1).setNumberFormat('#,##0.00');
    target.getRange(2, 10, output.length - 1, 1).setNumberFormat('0.00%');
    target.getRange(2, 11, output.length - 1, 1).setNumberFormat('#,##0.00');
    target.getRange(2, 12, output.length - 1, 1).setNumberFormat('0.00%');
  }
}

function makeDateKey_(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }

  const text = String(value).trim();
  const parts = text.split('.');

  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return year + '-' + month + '-' + day;
  }

  return '';
}

function formatDateKey_(dateKey) {
  const parts = dateKey.split('-');
  return parts[2] + '.' + parts[1] + '.' + parts[0];
}

function num_(value) {
  if (value === null || value === '') return 0;
  if (typeof value === 'number') return value;

  return Number(
    String(value)
      .replace(/\s/g, '')
      .replace(',', '.')
  ) || 0;
}
