/************************************************************
 * ACS | Control Panel FINAL (Google Sheets Apps Script)
 *
 * RAW INPUT SHEETS:
 * - r_campaign_30
 * - r_campaign_day_30
 * - r_pmax_prod_30
 * - r_pmax_prod_180
 * - r_pmax_zombies_365
 * - r_search_terms_30
 * - r_assets_pmax
 * - r_asset_groups_30
  RAW_CAMP_1: 'r_campaign_1',
  RAW_CAMP_7: 'r_campaign_7',
  RAW_CAMP_365: 'r_campaign_365',
 *
 * OPTIONAL HELPER SHEET:
 * - PRODUCT_GROUP_MAP
 *   headers:
 *   item_id | category_name | subcategory_name
 *
 * OUTPUT:
 * - Оглавление
 * - SETTINGS
 * - CATALOG_RULES
 * - PRODUCT_GROUP_MAP
 * - SIG_Summary
 * - SIG_Money_Control
 * - SIG_Category_Control
 * - SIG_Campaigns
 * - SIG_AdGroup_Control
 * - SIG_Winners
 * - SIG_Bleeders
 * - SIG_Zombies
 * - SIG_Product_Duplicates
 * - PRODUCT_AUDIT_QUEUE
 * - SIG_Search_Waste
 * - SIG_Search_Winners
 * - SIG_Creatives_Groups
 * - SIG_Creatives_Issues
 * - TASK_LOG
 * - CHANGE_LOG
 * - VERIFICATION_QUEUE
 ************************************************************/

const CFG = {
  // SOURCE RAW SPREADSHEET
  SOURCE_SPREADSHEET_ID: '1msV6tVPTZ5GGS4pxiKE2MkVixY5F9EKFQZM0fb6uFkQ',
  SOURCE_TOC: 'Оглавление',

  // RAW
  RAW_CAMP_30: 'r_campaign_30',
  RAW_CAMP_DAY_30: 'r_campaign_day_30',
  RAW_PMAX_PROD_30: 'r_pmax_prod_30',
  RAW_PMAX_PROD_180: 'r_pmax_prod_180',
  RAW_PMAX_ZOMBIES_365: 'r_pmax_zombies_365',
  RAW_SEARCH_TERMS_30: 'r_search_terms_30',
  RAW_PMAX_ASSETS: 'r_assets_pmax',
  RAW_ASSET_GROUPS_30: 'r_asset_groups_30',

  // CONFIG / HELPER
  OUT_INDEX: 'Оглавление',
  OUT_SETTINGS: 'SETTINGS',
  OUT_CATALOG_RULES: 'CATALOG_RULES',
  OUT_GROUP_MAP: 'PRODUCT_GROUP_MAP',

  // SIGNALS
  OUT_SUMMARY: 'SIG_Summary',
  OUT_MONEY: 'SIG_Money_Control',
  OUT_CATEGORY_CONTROL: 'SIG_Category_Control',
  OUT_CAMPAIGNS: 'SIG_Campaigns',
  OUT_ADGROUP_CONTROL: 'SIG_AdGroup_Control',
  OUT_WINNERS: 'SIG_Winners',
  OUT_BLEEDERS: 'SIG_Bleeders',
  OUT_ZOMBIES: 'SIG_Zombies',
  OUT_PRODUCT_DUPLICATES: 'SIG_Product_Duplicates',
  OUT_PRODUCT_AUDIT: 'PRODUCT_AUDIT_QUEUE',
  OUT_SEARCH_WASTE: 'SIG_Search_Waste',
  OUT_SEARCH_WINNERS: 'SIG_Search_Winners',
  OUT_CG: 'SIG_Creatives_Groups',
  OUT_CI: 'SIG_Creatives_Issues',
  OUT_PERIOD_COMPARE: 'SIG_Period_Compare',

  // WORKFLOW
  OUT_TASK_LOG: 'TASK_LOG',
  OUT_CHANGE_LOG: 'CHANGE_LOG',
  OUT_VERIFICATION_QUEUE: 'VERIFICATION_QUEUE',

  HIDE_RAW: true,
  DELETE_OTHER_SHEETS: false,
  PROTECT_SIG_SHEETS: true,

  STATUS_OK: 'OK',
  STATUS_WARN: 'WARN',
  STATUS_CRIT: 'CRIT'
};

const DEFAULT_SETTINGS = [
  ['group', 'key', 'value', 'description'],

  ['campaigns', 'camp_min_cost_data', 300, 'Минимальный расход для решения по кампании'],
  ['campaigns', 'camp_scale_roas_min', 6, 'ROAS для масштабирования кампании'],
  ['campaigns', 'camp_ok_roas_min', 4, 'ROAS для hold/optimize'],
  ['campaigns', 'camp_cut_roas_max', 2.5, 'ROAS ниже которого кампания слабая'],
  ['campaigns', 'camp_cut_cost_min', 800, 'Минимальный расход для сигнала cut'],
  ['campaigns', 'camp_min_conv_for_scale', 2, 'Минимум конверсий для scale'],
  ['campaigns', 'camp_high_cpa_factor', 1.3, 'Множитель к target CPA для high risk'],
  ['campaigns', 'target_cpa', 250, 'Целевой CPA'],

  ['products', 'prod_win_conv_min', 2, 'Минимум конверсий товара для winners'],
  ['products', 'prod_win_roas_min', 6, 'Минимум ROAS товара для winners'],
  ['products', 'prod_bleed_cost_min', 500, 'Минимальный расход товара для bleed'],
  ['products', 'prod_bleed_roas_max', 3, 'Максимальный ROAS товара для bleed'],

  ['zombies', 'zombie_impr_min', 150, 'Минимум показов для zombie'],
  ['zombies', 'zombie_impr_urgent', 500, 'Порог срочности для zombie'],
  ['zombies', 'zombie_ctr_good_min', 0.005, 'CTR после исправления, признак улучшения'],

  ['search', 'search_waste_cost_min', 150, 'Минимальный расход запроса для waste'],
  ['search', 'search_waste_conv_max', 0, 'Максимум конверсий для waste'],
  ['search', 'search_win_conv_min', 2, 'Минимум конверсий для winning search term'],
  ['search', 'search_win_roas_min', 4, 'Минимум ROAS для winning search term'],

  ['creatives', 'min_images', 5, 'Минимум изображений в asset group'],
  ['creatives', 'min_videos', 1, 'Минимум видео в asset group'],
  ['creatives', 'min_headlines', 5, 'Минимум headlines в asset group'],
  ['creatives', 'min_descriptions', 2, 'Минимум descriptions в asset group'],

  ['workflow', 'default_task_owner_marketing', 'Маркетолог', 'Исполнитель для рекламных задач'],
  ['workflow', 'default_task_owner_content', 'Контент', 'Исполнитель для товарных задач'],
  ['workflow', 'default_task_owner_design', 'Дизайнер', 'Исполнитель для креативных задач'],
  ['workflow', 'verification_days_after_done', 7, 'Через сколько дней после Done проверять результат'],
  ['workflow', 'bleeder_roas_recovery_min', 4, 'ROAS после исправления, который считаем нормой'],
  ['workflow', 'task_due_days_high', 1, 'Срок в днях для HIGH'],
  ['workflow', 'task_due_days_med', 2, 'Срок в днях для MED'],
  ['workflow', 'task_due_days_low', 5, 'Срок в днях для LOW'],

  ['limits', 'winners_limit', 100, 'Лимит winners'],
  ['limits', 'bleeders_limit', 300, 'Лимит bleeders'],
  ['limits', 'zombies_limit', 500, 'Лимит zombies'],
  ['limits', 'search_waste_limit', 300, 'Лимит search waste'],
  ['limits', 'search_winners_limit', 200, 'Лимит search winners'],
  ['limits', 'creative_issues_limit', 500, 'Лимит creative issues']
];

const DEFAULT_CATALOG_RULES = [
  [
    'rule_name',
    'priority',
    'is_active',
    'campaign_contains',
    'title_contains',
    'item_id_contains',
    'category_name',
    'subcategory_name',
    'target_roas',
    'target_cpa',
    'min_profit_per_order',
    'bleed_cost_min',
    'winner_roas_min',
    'winner_conv_min',
    'comment'
  ],
  [
    'DEFAULT_ALL',
    999,
    'YES',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'Fallback. Основные значения берутся из SETTINGS.'
  ]
];

const DEFAULT_GROUP_MAP = [
  ['item_id', 'category_name', 'subcategory_name']
];

const DEFAULT_TASK_LOG = [
  ['task_id','created_at','source_sheet','object_type','campaign','item_id','asset_group','search_term','problem_type','task_title','task_description','owner','priority','status','due_date','done_at','verified_at','verification_result','verification_comment']
];

const DEFAULT_CHANGE_LOG = [
  ['change_id','task_id','changed_at','changed_by','object_type','campaign','item_id','field_name','old_value','new_value','comment']
];

const DEFAULT_VERIFICATION_QUEUE = [
  ['task_id','object_type','campaign','item_id','task_title','owner','done_at','verify_after','expected_check','status']
];

/** =========================
 * ENTRY
 * ========================= */
function buildControlPanelFinal() {
  const ss = SpreadsheetApp.getActive();
  const sourceSs = SpreadsheetApp.openById(CFG.SOURCE_SPREADSHEET_ID);

  validateSourceRawSheets_(sourceSs);

  ensureSettingsSheet_(ss);
  ensureCatalogRulesSheet_(ss);
  syncGroupMapFromSource_(sourceSs, ss);
  ensureWorkflowSheets_(ss);

  const S = readSettings_(ss);
  const rules = readCatalogRules_(ss);
  const groupMap = readGroupMap_(ss);
  const raw = readAllRaw_(sourceSs);

  const campaigns = buildCampaignSignals_(raw.camp30, raw.campDay30, S);
  const products30 = dedupProducts_(raw.prod30, groupMap);
  const products180 = dedupProducts_(raw.prod180, groupMap);
  const winners = buildProductWinners_(products30, products180, S, rules);
  const bleeders = buildProductBleeders_(products30, S, rules);
  const zombies = buildZombieSignals_(raw.zombies, groupMap, S);
  const searchWaste = buildSearchWaste_(raw.searchTerms, S);
  const searchWinners = buildSearchWinners_(raw.searchTerms, S);
  const creativeGroups = buildCreativesGroups_(raw.assets, S);
  const creativeIssues = buildCreativesIssues_(raw.assets, S);
  const categoryControl = buildCategoryControl_(products30, S, rules);
  const adGroupControl = buildAdGroupControl_(raw.assetGroups30, raw.assets, S);
  const duplicates = buildProductDuplicates_(products30);
  const productAudit = buildProductAuditQueue_(bleeders, zombies, S);
  const money = buildMoneyControl_(campaigns, winners, bleeders, zombies, duplicates, adGroupControl);
  const summary = buildSummary_(campaigns, winners, bleeders, zombies, searchWaste, searchWinners, creativeGroups, creativeIssues, productAudit);
  const periodCompare = buildPeriodCompare_(
    raw.camp1,
    raw.camp7,
    raw.camp30,
    raw.camp365
  );

  writeSummary_(ss, summary);
  writeMoneyControl_(ss, money);
  writePeriodCompare_(ss, periodCompare);
  writeCategoryControl_(ss, categoryControl);
  writeCampaigns_(ss, campaigns);
  writeAdGroupControl_(ss, adGroupControl);
  writeWinners_(ss, winners);
  writeBleeders_(ss, bleeders);
  writeZombies_(ss, zombies);
  writeProductDuplicates_(ss, duplicates);
  writeProductAuditQueue_(ss, productAudit);
  writeSearchWaste_(ss, searchWaste);
  writeSearchWinners_(ss, searchWinners);
  writeCreativesGroups_(ss, creativeGroups);
  writeCreativesIssues_(ss, creativeIssues);

  syncTaskLog_(ss, productAudit, campaigns, searchWaste, creativeGroups, creativeIssues, S);
  syncVerificationQueue_(ss, S);
  markUnconfirmedDoneTasks_(ss);

  formatTaskLogSheet_(ss);
  formatChangeLogSheet_(ss);
  formatVerificationQueueSheet_(ss);

  const tasks = readBodyRows_(ss, CFG.OUT_TASK_LOG);
  const pageStatuses = buildPageStatuses_({
    campaigns,
    winners,
    bleeders,
    zombies,
    searchWaste,
    searchWinners,
    creativeGroups,
    creativeIssues,
    categoryControl,
    adGroupControl,
    duplicates,
    productAudit,
    tasks,
    money
  });

  writeIndex_(ss, pageStatuses);
  applySheetStatusColors_(ss, pageStatuses);

  reorderSheets_(ss);
  SpreadsheetApp.flush();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ACS Control')
    .addItem('Собрать Control Panel FINAL', 'buildControlPanelFinal')
    .addItem('Создать/обновить SETTINGS', 'ensureSettingsMenu_')
    .addItem('Создать/обновить CATALOG_RULES', 'ensureCatalogRulesMenu_')
    .addItem('Создать/обновить PRODUCT_GROUP_MAP', 'ensureGroupMapMenu_')
    .addToUi();
}

function ensureSettingsMenu_() {
  ensureSettingsSheet_(SpreadsheetApp.getActive());
}

function ensureCatalogRulesMenu_() {
  ensureCatalogRulesSheet_(SpreadsheetApp.getActive());
}

function ensureGroupMapMenu_() {
  ensureGroupMapSheet_(SpreadsheetApp.getActive());
}

/** =========================
 * SETTINGS / RULES / MAP / WORKFLOW
 * ========================= */
function ensureSettingsSheet_(ss) {
  let sh = ss.getSheetByName(CFG.OUT_SETTINGS);
  if (!sh) sh = ss.insertSheet(CFG.OUT_SETTINGS);

  const existing = sh.getDataRange().getValues();
  if (existing.length < 2) {
    sh.clear();
    sh.getRange(1, 1, DEFAULT_SETTINGS.length, DEFAULT_SETTINGS[0].length).setValues(DEFAULT_SETTINGS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#d9ead3');
    sh.autoResizeColumns(1, 4);
  } else {
    mergeDefaultSettings_(sh);
  }
}

function mergeDefaultSettings_(sh) {
  const values = sh.getDataRange().getValues();
  const existingKeys = new Set();

  for (let i = 1; i < values.length; i++) {
    const key = str_(values[i][1]);
    if (key) existingKeys.add(key);
  }

  const rowsToAppend = [];
  for (let i = 1; i < DEFAULT_SETTINGS.length; i++) {
    const key = DEFAULT_SETTINGS[i][1];
    if (!existingKeys.has(key)) rowsToAppend.push(DEFAULT_SETTINGS[i]);
  }

  if (rowsToAppend.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rowsToAppend.length, 4).setValues(rowsToAppend);
  }
}

function ensureCatalogRulesSheet_(ss) {
  let sh = ss.getSheetByName(CFG.OUT_CATALOG_RULES);
  if (!sh) sh = ss.insertSheet(CFG.OUT_CATALOG_RULES);

  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    sh.clear();
    sh.getRange(1, 1, DEFAULT_CATALOG_RULES.length, DEFAULT_CATALOG_RULES[0].length).setValues(DEFAULT_CATALOG_RULES);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, DEFAULT_CATALOG_RULES[0].length).setFontWeight('bold').setBackground('#cfe2f3');
    sh.autoResizeColumns(1, DEFAULT_CATALOG_RULES[0].length);
  } else {
    mergeDefaultCatalogRules_(sh);
  }
}

function mergeDefaultCatalogRules_(sh) {
  const values = sh.getDataRange().getValues();
  const existing = new Set();

  for (let i = 1; i < values.length; i++) {
    const ruleName = str_(values[i][0]);
    if (ruleName) existing.add(ruleName);
  }

  const rowsToAppend = [];
  for (let i = 1; i < DEFAULT_CATALOG_RULES.length; i++) {
    const ruleName = DEFAULT_CATALOG_RULES[i][0];
    if (!existing.has(ruleName)) rowsToAppend.push(DEFAULT_CATALOG_RULES[i]);
  }

  if (rowsToAppend.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rowsToAppend.length, DEFAULT_CATALOG_RULES[0].length).setValues(rowsToAppend);
  }
}

function ensureGroupMapSheet_(ss) {
  let sh = ss.getSheetByName(CFG.OUT_GROUP_MAP);
  if (!sh) sh = ss.insertSheet(CFG.OUT_GROUP_MAP);

  const values = sh.getDataRange().getValues();
  if (values.length < 1 || str_(values[0][0]) !== 'item_id') {
    sh.clear();
    sh.getRange(1, 1, DEFAULT_GROUP_MAP.length, DEFAULT_GROUP_MAP[0].length).setValues(DEFAULT_GROUP_MAP);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#fce5cd');
    sh.autoResizeColumns(1, 3);
  }
}

function ensureWorkflowSheets_(ss) {
  ensureSimpleTemplateSheet_(ss, CFG.OUT_TASK_LOG, DEFAULT_TASK_LOG, '#ead1dc');
  ensureSimpleTemplateSheet_(ss, CFG.OUT_CHANGE_LOG, DEFAULT_CHANGE_LOG, '#d9ead3');
  ensureSimpleTemplateSheet_(ss, CFG.OUT_VERIFICATION_QUEUE, DEFAULT_VERIFICATION_QUEUE, '#fff2cc');
}

function ensureSimpleTemplateSheet_(ss, name, template, color) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  const values = sh.getDataRange().getValues();
  if (values.length < 1 || str_(values[0][0]) !== str_(template[0][0])) {
    sh.clear();
    sh.getRange(1, 1, template.length, template[0].length).setValues(template);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, template[0].length).setFontWeight('bold').setBackground(color);
    sh.autoResizeColumns(1, template[0].length);
  }
}

function readSettings_(ss) {
  const sh = ss.getSheetByName(CFG.OUT_SETTINGS);
  const values = sh.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < values.length; i++) {
    const key = str_(values[i][1]);
    const val = values[i][2];
    if (!key) continue;

    const num = Number(val);
    map[key] = (val !== '' && !isNaN(num)) ? num : val;
  }
  return map;
}

function readCatalogRules_(ss) {
  const sh = ss.getSheetByName(CFG.OUT_CATALOG_RULES);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);
  const rules = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    headers.forEach((h, idx) => obj[h] = row[idx]);

    if (!str_(obj.rule_name)) continue;
    if (str_(obj.is_active).toUpperCase() !== 'YES') continue;

    rules.push({
      rule_name: str_(obj.rule_name),
      priority: num_(obj.priority) || 999,
      campaign_contains: str_(obj.campaign_contains).toLowerCase(),
      title_contains: str_(obj.title_contains).toLowerCase(),
      item_id_contains: str_(obj.item_id_contains).toLowerCase(),
      category_name: str_(obj.category_name).toLowerCase(),
      subcategory_name: str_(obj.subcategory_name).toLowerCase(),
      target_roas: numOrBlank_(obj.target_roas),
      target_cpa: numOrBlank_(obj.target_cpa),
      min_profit_per_order: numOrBlank_(obj.min_profit_per_order),
      bleed_cost_min: numOrBlank_(obj.bleed_cost_min),
      winner_roas_min: numOrBlank_(obj.winner_roas_min),
      winner_conv_min: numOrBlank_(obj.winner_conv_min),
      comment: str_(obj.comment)
    });
  }

  rules.sort((a, b) => a.priority - b.priority);
  return rules;
}

function readGroupMap_(ss) {
  const sh = ss.getSheetByName(CFG.OUT_GROUP_MAP);
  const values = sh.getDataRange().getValues();
  const map = new Map();

  if (values.length < 2) return map;

  for (let i = 1; i < values.length; i++) {
    const itemId = str_(values[i][0]);
    if (!itemId) continue;
    map.set(itemId, {
      category: str_(values[i][1]),
      subcategory: str_(values[i][2])
    });
  }
  return map;
}

/** =========================
 * RAW READ
 * ========================= */

function validateSourceRawSheets_(sourceSs) {
  const required = [
    CFG.RAW_CAMP_30,
    CFG.RAW_CAMP_DAY_30,
    CFG.RAW_PMAX_PROD_30,
    CFG.RAW_PMAX_PROD_180,
    CFG.RAW_PMAX_ZOMBIES_365,
    CFG.RAW_SEARCH_TERMS_30,
    CFG.RAW_PMAX_ASSETS,
    CFG.RAW_ASSET_GROUPS_30,
    CFG.RAW_CAMP_1,
    CFG.RAW_CAMP_7,
    CFG.RAW_CAMP_365,
  ];

  const toc = sourceSs.getSheetByName(CFG.SOURCE_TOC);
  const allowedByToc = new Set();

  if (toc) {
    const values = toc.getDataRange().getValues();
    const headers = values[0] || [];
    const sheetCol = headers.indexOf('Лист');
    const canUseCol = headers.indexOf('Можно использовать как источник');

    if (sheetCol >= 0) {
      for (let i = 1; i < values.length; i++) {
        const sheetName = str_(values[i][sheetCol]);
        const canUse = canUseCol >= 0 ? str_(values[i][canUseCol]).toUpperCase() : 'YES';
        if (sheetName && canUse !== 'NO') allowedByToc.add(sheetName);
      }
    }
  }

  const missing = [];
  required.forEach(name => {
    if (!sourceSs.getSheetByName(name)) missing.push(name);
    if (allowedByToc.size && !allowedByToc.has(name)) missing.push(name + ' (нет YES в оглавлении)');
  });

  if (missing.length) {
    throw new Error('В RAW-таблице не найдены обязательные источники: ' + missing.join(', '));
  }
}

function syncGroupMapFromSource_(sourceSs, targetSs) {
  const source = sourceSs.getSheetByName(CFG.OUT_GROUP_MAP);

  if (!source) {
    ensureGroupMapSheet_(targetSs);
    return;
  }

  let target = targetSs.getSheetByName(CFG.OUT_GROUP_MAP);
  if (!target) target = targetSs.insertSheet(CFG.OUT_GROUP_MAP);

  target.clear();

  const values = source.getDataRange().getValues();

  if (!values.length) {
    target.getRange(1, 1, DEFAULT_GROUP_MAP.length, DEFAULT_GROUP_MAP[0].length)
      .setValues(DEFAULT_GROUP_MAP);
  } else {
    target.getRange(1, 1, values.length, values[0].length).setValues(values);
  }

  target.setFrozenRows(1);
  target.getRange(1, 1, 1, target.getLastColumn())
    .setFontWeight('bold')
    .setBackground('#fce5cd');

  target.autoResizeColumns(1, target.getLastColumn());
}

function readAllRaw_(ss) {
  return {
    camp30: readSheet_(ss, CFG.RAW_CAMP_30),
    campDay30: readSheet_(ss, CFG.RAW_CAMP_DAY_30),
    prod30: readSheet_(ss, CFG.RAW_PMAX_PROD_30),
    prod180: readSheet_(ss, CFG.RAW_PMAX_PROD_180),
    zombies: readSheet_(ss, CFG.RAW_PMAX_ZOMBIES_365),
    searchTerms: readSheet_(ss, CFG.RAW_SEARCH_TERMS_30),
    assets: readSheet_(ss, CFG.RAW_PMAX_ASSETS),
    assetGroups30: readSheet_(ss, CFG.RAW_ASSET_GROUPS_30)
  };
}

function readSheet_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Нет RAW-листа: ' + name);

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { name: name, headers: [], rows: [] };

  return { name: name, headers: values[0].map(String), rows: values.slice(1) };
}

function readBodyRows_(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  const vals = sh.getDataRange().getValues();
  return vals.length > 1 ? vals.slice(1) : [];
}

/** =========================
 * HELPERS
 * ========================= */
function idx_(headers) {
  const variants = Array.prototype.slice.call(arguments, 1);
  for (let i = 0; i < variants.length; i++) {
    const pos = headers.indexOf(variants[i]);
    if (pos >= 0) return pos;
  }
  return -1;
}

function num_(x) {
  if (x === '' || x === null || x === undefined) return 0;
  const n = Number(x);
  return isNaN(n) ? 0 : n;
}

function numOrBlank_(x) {
  if (x === '' || x === null || x === undefined) return '';
  const n = Number(x);
  return isNaN(n) ? '' : n;
}

function str_(x) {
  return String(x === null || x === undefined ? '' : x).trim();
}

function safeDiv_(a, b) {
  return b ? a / b : 0;
}

function makeId_(prefix) {
  const d = new Date();
  const stamp = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
  const rand = Math.floor(Math.random() * 10000);
  return prefix + '_' + stamp + '_' + rand;
}

function priorityScore_(p) {
  const v = str_(p).toUpperCase();
  if (v === 'HIGH' || v === 'CRIT') return 0;
  if (v === 'MED' || v === 'WARN') return 1;
  return 2;
}

function calcDueDate_(priority, S) {
  const d = new Date();
  const p = str_(priority).toUpperCase();

  if (p === 'HIGH') d.setDate(d.getDate() + Number(S.task_due_days_high || 1));
  else if (p === 'MED') d.setDate(d.getDate() + Number(S.task_due_days_med || 2));
  else d.setDate(d.getDate() + Number(S.task_due_days_low || 5));

  return d;
}

function pickTopKey_(obj) {
  let bestKey = '';
  let bestVal = -1;

  Object.keys(obj || {}).forEach(k => {
    if (obj[k] > bestVal) {
      bestVal = obj[k];
      bestKey = k;
    }
  });

  return bestKey;
}

function resolveRuleForEntity_(campaignName, itemId, title, category, subcategory, rules, S) {
  const c = str_(campaignName).toLowerCase();
  const i = str_(itemId).toLowerCase();
  const t = str_(title).toLowerCase();
  const cat = str_(category).toLowerCase();
  const sub = str_(subcategory).toLowerCase();

  for (let k = 0; k < rules.length; k++) {
    const r = rules[k];

    if (r.campaign_contains && c.indexOf(r.campaign_contains) < 0) continue;
    if (r.title_contains && t.indexOf(r.title_contains) < 0) continue;
    if (r.item_id_contains && i.indexOf(r.item_id_contains) < 0) continue;
    if (r.category_name && cat !== r.category_name) continue;
    if (r.subcategory_name && sub !== r.subcategory_name) continue;

    return {
      rule_name: r.rule_name,
      target_roas: r.target_roas !== '' ? r.target_roas : S.camp_ok_roas_min,
      target_cpa: r.target_cpa !== '' ? r.target_cpa : S.target_cpa,
      min_profit_per_order: r.min_profit_per_order !== '' ? r.min_profit_per_order : 0,
      bleed_cost_min: r.bleed_cost_min !== '' ? r.bleed_cost_min : S.prod_bleed_cost_min,
      winner_roas_min: r.winner_roas_min !== '' ? r.winner_roas_min : S.prod_win_roas_min,
      winner_conv_min: r.winner_conv_min !== '' ? r.winner_conv_min : S.prod_win_conv_min
    };
  }

  return {
    rule_name: 'DEFAULT_ALL',
    target_roas: S.camp_ok_roas_min,
    target_cpa: S.target_cpa,
    min_profit_per_order: 0,
    bleed_cost_min: S.prod_bleed_cost_min,
    winner_roas_min: S.prod_win_roas_min,
    winner_conv_min: S.prod_win_conv_min
  };
}

/** =========================
 * PRODUCTS
 * output:
 * [camp, item, title, category, subcategory, cost, value, roas, conv, clicks, impr]
 * ========================= */
function dedupProducts_(prod, groupMap) {
  const h = prod.headers;
  const rows = prod.rows;

  const iCamp = idx_(h, 'campaign.name');
  const iItem = idx_(h, 'segments.product_item_id');
  const iTitle = idx_(h, 'segments.product_title');
  const iCat = idx_(h, 'Категория товара', 'category_name');
  const iSubcat = idx_(h, 'Подкатегория товара', 'subcategory_name');
  const iImpr = idx_(h, 'metrics.impressions');
  const iClk = idx_(h, 'metrics.clicks');
  const iCost = idx_(h, 'cost', 'metrics.cost_micros');
  const iConv = idx_(h, 'metrics.conversions');
  const iVal = idx_(h, 'metrics.conversions_value');

  const m = new Map();

  rows.forEach(r => {
    const camp = iCamp >= 0 ? str_(r[iCamp]) : '';
    const item = iItem >= 0 ? str_(r[iItem]) : '';
    const title = iTitle >= 0 ? str_(r[iTitle]) : '';
    if (!camp || !item) return;

    const rawCat = iCat >= 0 ? str_(r[iCat]) : '';
    const rawSubcat = iSubcat >= 0 ? str_(r[iSubcat]) : '';
    const helper = groupMap.get(item) || { category: '', subcategory: '' };

    const category = rawCat || helper.category || '';
    const subcategory = rawSubcat || helper.subcategory || '';

    const key = camp + '||' + item;
    if (!m.has(key)) {
      m.set(key, {
        camp: camp,
        item: item,
        title: title,
        category: category,
        subcategory: subcategory,
        cost: 0,
        val: 0,
        conv: 0,
        clk: 0,
        impr: 0
      });
    }

    const a = m.get(key);
    if (!a.title && title) a.title = title;
    if (!a.category && category) a.category = category;
    if (!a.subcategory && subcategory) a.subcategory = subcategory;

    a.cost += iCost >= 0 ? num_(r[iCost]) : 0;
    a.val += iVal >= 0 ? num_(r[iVal]) : 0;
    a.conv += iConv >= 0 ? num_(r[iConv]) : 0;
    a.clk += iClk >= 0 ? num_(r[iClk]) : 0;
    a.impr += iImpr >= 0 ? num_(r[iImpr]) : 0;
  });

  const out = [];
  m.forEach(a => {
    out.push([
      a.camp,
      a.item,
      a.title,
      a.category,
      a.subcategory,
      a.cost,
      a.val,
      safeDiv_(a.val, a.cost),
      a.conv,
      a.clk,
      a.impr
    ]);
  });

  out.sort((a, b) => num_(b[5]) - num_(a[5]));
  return out;
}

/** =========================
 * CAMPAIGNS
 * ========================= */
function buildCampaignSignals_(camp30, campDay30, S) {
  const h = camp30.headers;
  const rows = camp30.rows;

  const iId = idx_(h, 'campaign.id');
  const iName = idx_(h, 'campaign.name');
  const iStatus = idx_(h, 'campaign.status');
  const iType = idx_(h, 'campaign.advertising_channel_type');
  const iImpr = idx_(h, 'metrics.impressions');
  const iClk = idx_(h, 'metrics.clicks');
  const iCtr = idx_(h, 'metrics.ctr');
  const iAvgCpc = idx_(h, 'metrics.average_cpc');
  const iCost = idx_(h, 'cost', 'metrics.cost_micros');
  const iConv = idx_(h, 'metrics.conversions');
  const iVal = idx_(h, 'metrics.conversions_value');

  const trendMap = buildCampaignTrendMap_(campDay30);

  const out = rows.map(r => {
    const id = iId >= 0 ? str_(r[iId]) : '';
    const name = iName >= 0 ? str_(r[iName]) : '';
    const status = iStatus >= 0 ? str_(r[iStatus]) : '';
    const type = iType >= 0 ? str_(r[iType]) : '';
    const impr = iImpr >= 0 ? num_(r[iImpr]) : 0;
    const clk = iClk >= 0 ? num_(r[iClk]) : 0;
    const ctr = iCtr >= 0 ? num_(r[iCtr]) : safeDiv_(clk, impr);
    const avgCpc = iAvgCpc >= 0 ? num_(r[iAvgCpc]) : 0;
    const cost = iCost >= 0 ? num_(r[iCost]) : 0;
    const conv = iConv >= 0 ? num_(r[iConv]) : 0;
    const val = iVal >= 0 ? num_(r[iVal]) : 0;
    const roas = safeDiv_(val, cost);
    const cpa = safeDiv_(cost, conv);

    const trend = trendMap.get(name) || { cost7: 0, val7: 0, conv7: 0, costPrev7: 0, valPrev7: 0, convPrev7: 0 };
    const roas7 = safeDiv_(trend.val7, trend.cost7);
    const roasPrev7 = safeDiv_(trend.valPrev7, trend.costPrev7);
    const roasDelta = roasPrev7 ? (roas7 - roasPrev7) / roasPrev7 : 0;
    const convDelta = trend.convPrev7 ? (trend.conv7 - trend.convPrev7) / trend.convPrev7 : 0;

    const signal = recommendCampaign_(cost, conv, roas, cpa, S);
    const risk = campaignRisk_(cost, conv, roas, cpa, roasDelta, convDelta, S);
    const action = campaignAction_(signal, risk);

    return [
      id, name, status, type,
      cost, val, roas, conv, cpa, clk, impr, ctr, avgCpc,
      trend.cost7, trend.val7, roas7, trend.conv7,
      roasPrev7, roasDelta, convDelta,
      signal, risk, action
    ];
  });

  out.sort((a, b) => num_(b[4]) - num_(a[4]));
  return out;
}

function buildCampaignTrendMap_(campDay30) {
  const h = campDay30.headers;
  const rows = campDay30.rows;
  if (!rows.length) return new Map();

  const iDate = idx_(h, 'segments.date');
  const iName = idx_(h, 'campaign.name');
  const iCost = idx_(h, 'cost', 'metrics.cost_micros');
  const iConv = idx_(h, 'metrics.conversions');
  const iVal = idx_(h, 'metrics.conversions_value');

  const arr = rows.map(r => ({
    date: iDate >= 0 ? new Date(str_(r[iDate])) : null,
    name: iName >= 0 ? str_(r[iName]) : '',
    cost: iCost >= 0 ? num_(r[iCost]) : 0,
    conv: iConv >= 0 ? num_(r[iConv]) : 0,
    val: iVal >= 0 ? num_(r[iVal]) : 0
  })).filter(x => x.name && x.date);

  if (!arr.length) return new Map();

  let maxDate = arr[0].date;
  arr.forEach(x => { if (x.date > maxDate) maxDate = x.date; });

  const dayMs = 24 * 60 * 60 * 1000;
  const start7 = new Date(maxDate.getTime() - 6 * dayMs);
  const startPrev7 = new Date(maxDate.getTime() - 13 * dayMs);
  const endPrev7 = new Date(maxDate.getTime() - 7 * dayMs);

  const m = new Map();
  arr.forEach(x => {
    if (!m.has(x.name)) {
      m.set(x.name, { cost7: 0, val7: 0, conv7: 0, costPrev7: 0, valPrev7: 0, convPrev7: 0 });
    }
    const a = m.get(x.name);

    if (x.date >= start7 && x.date <= maxDate) {
      a.cost7 += x.cost;
      a.val7 += x.val;
      a.conv7 += x.conv;
    } else if (x.date >= startPrev7 && x.date <= endPrev7) {
      a.costPrev7 += x.cost;
      a.valPrev7 += x.val;
      a.convPrev7 += x.conv;
    }
  });

  return m;
}

function recommendCampaign_(cost, conv, roas, cpa, S) {
  if (cost < S.camp_min_cost_data) return 'LOW_DATA';
  if (conv >= S.camp_min_conv_for_scale && roas >= S.camp_scale_roas_min && (cpa <= S.target_cpa || S.target_cpa <= 0)) return 'SCALE';
  if (cost >= S.camp_cut_cost_min && (roas <= S.camp_cut_roas_max || cpa > S.target_cpa * S.camp_high_cpa_factor)) return 'CUT';
  if (conv <= 0 && cost >= S.camp_min_cost_data) return 'CHECK';
  if (roas >= S.camp_ok_roas_min) return 'HOLD_OPTIMIZE';
  return 'HOLD';
}

function campaignRisk_(cost, conv, roas, cpa, roasDelta, convDelta, S) {
  if (cost >= S.camp_cut_cost_min && (roas <= S.camp_cut_roas_max || cpa > S.target_cpa * S.camp_high_cpa_factor)) return 'HIGH';
  if (roasDelta <= -0.3 || convDelta <= -0.3) return 'HIGH';
  if (conv <= 0 && cost >= S.camp_min_cost_data) return 'HIGH';
  if (roasDelta < 0 || convDelta < 0) return 'MED';
  return 'LOW';
}

function campaignAction_(signal, risk) {
  if (signal === 'SCALE') return 'Увеличить бюджет на 15–20%. Проверить наличие, цену, ассортимент, ассеты.';
  if (signal === 'CUT') return 'Снизить бюджет на 20–30%. Проверить bleed-товары, мусорные запросы, карточки.';
  if (signal === 'CHECK') return 'Проверить фид, цену, наличие, фото, title, ассеты и корректность целей.';
  if (signal === 'HOLD_OPTIMIZE') return 'Держать бюджет. Улучшать точечно: креативы, карточки, запросы.';
  if (signal === 'LOW_DATA') return 'Накопить статистику без резких изменений.';
  return risk === 'HIGH' ? 'Есть деградация. Нужна ручная проверка.' : 'Держать и наблюдать.';
}

/** =========================
 * CATEGORY CONTROL / WINNERS / BLEEDERS / DUPLICATES
 * ========================= */
function buildProductWinners_(products30, products180, S, rules) {
  const histMap = new Map();
  products180.forEach(r => {
    histMap.set(str_(r[0]) + '||' + str_(r[1]), r);
  });

  const out = products30
    .map(r => ({ row: r, rule: resolveRuleForEntity_(r[0], r[1], r[2], r[3], r[4], rules, S) }))
    .filter(x => num_(x.row[8]) >= x.rule.winner_conv_min && num_(x.row[7]) >= x.rule.winner_roas_min)
    .map(x => {
      const r = x.row;
      const hist = histMap.get(str_(r[0]) + '||' + str_(r[1])) || [];
      return [
        r[0], r[1], r[2], r[3], r[4],
        r[5], r[6], r[7], r[8], r[9], r[10],
        num_(hist[5]), num_(hist[6]), num_(hist[7]),
        x.rule.rule_name,
        x.rule.winner_roas_min,
        x.rule.winner_conv_min,
        'Усилить товар по правилу категории. Проверить наличие, цену, фото, title.'
      ];
    })
    .slice(0, S.winners_limit);

  out.sort((a, b) => num_(b[7]) - num_(a[7]) || num_(b[8]) - num_(a[8]));
  return out;
}

function buildProductBleeders_(products30, S, rules) {
  return products30
    .map(r => ({ row: r, rule: resolveRuleForEntity_(r[0], r[1], r[2], r[3], r[4], rules, S) }))
    .filter(x => num_(x.row[5]) >= x.rule.bleed_cost_min && num_(x.row[7]) <= x.rule.target_roas)
    .map(x => {
      const r = x.row;
      const conv = num_(r[8]);
      const action = conv <= 0
        ? 'Кандидат на остановку. Срочно проверить title, фото, цену, наличие, релевантность.'
        : 'Снизить долю бюджета. Улучшить карточку, цену и качество трафика.';
      return [
        r[0], r[1], r[2], r[3], r[4],
        r[5], r[6], r[7], r[8], r[9], r[10],
        x.rule.rule_name, x.rule.target_roas, x.rule.bleed_cost_min, action
      ];
    })
    .slice(0, S.bleeders_limit);
}

function buildCategoryControl_(products30, S, rules) {
  const map = new Map();

  products30.forEach(r => {
    const resolved = resolveRuleForEntity_(r[0], r[1], r[2], r[3], r[4], rules, S);
    const key = resolved.rule_name;

    if (!map.has(key)) {
      map.set(key, {
        rule_name: resolved.rule_name,
        target_roas: resolved.target_roas,
        target_cpa: resolved.target_cpa,
        bleed_cost_min: resolved.bleed_cost_min,
        items: 0,
        cost: 0,
        value: 0,
        conv: 0,
        clicks: 0,
        impr: 0,
        winners: 0,
        bleeders: 0,
        categories: {},
        subcategories: {}
      });
    }

    const a = map.get(key);
    const cat = str_(r[3]);
    const sub = str_(r[4]);

    a.items++;
    a.cost += num_(r[5]);
    a.value += num_(r[6]);
    a.conv += num_(r[8]);
    a.clicks += num_(r[9]);
    a.impr += num_(r[10]);

    if (cat) a.categories[cat] = (a.categories[cat] || 0) + 1;
    if (sub) a.subcategories[sub] = (a.subcategories[sub] || 0) + 1;

    if (num_(r[8]) >= resolved.winner_conv_min && num_(r[7]) >= resolved.winner_roas_min) a.winners++;
    if (num_(r[5]) >= resolved.bleed_cost_min && num_(r[7]) <= resolved.target_roas) a.bleeders++;
  });

  const out = [];
  map.forEach(a => {
    const roas = safeDiv_(a.value, a.cost);
    const cpa = safeDiv_(a.cost, a.conv);

    let signal = 'HOLD';
    let risk = 'LOW';
    let action = 'Наблюдать.';

    if (a.cost < S.camp_min_cost_data) {
      signal = 'LOW_DATA';
      risk = 'LOW';
      action = 'Недостаточно данных для вывода.';
    } else if (a.bleeders > 0 && a.cost > 0 && roas <= a.target_roas) {
      signal = 'CHECK';
      risk = 'HIGH';
      action = 'Есть bleed-товары в категории. Нужна ручная проверка и чистка.';
    } else if (a.winners > 0 && roas > a.target_roas) {
      signal = 'SCALE';
      risk = 'LOW';
      action = 'Есть потенциал к масштабированию.';
    } else if (roas < a.target_roas) {
      signal = 'HOLD_OPTIMIZE';
      risk = 'MED';
      action = 'Нужно улучшать карточки, фид и структуру.';
    }

    out.push([
      a.rule_name,
      pickTopKey_(a.categories),
      pickTopKey_(a.subcategories),
      a.items,
      a.cost,
      a.value,
      roas,
      a.conv,
      cpa,
      a.clicks,
      a.impr,
      a.target_roas,
      a.target_cpa,
      a.bleed_cost_min,
      a.winners,
      a.bleeders,
      signal,
      risk,
      action
    ]);
  });

  out.sort((a, b) => num_(b[4]) - num_(a[4]));
  return out;
}

function buildProductDuplicates_(products30) {
  const map = new Map();

  products30.forEach(r => {
    const itemId = str_(r[1]);
    if (!map.has(itemId)) map.set(itemId, []);
    map.get(itemId).push(r);
  });

  const out = [];
  map.forEach(list => {
    if (list.length < 2) return;

    let keepIdx = 0;
    for (let i = 1; i < list.length; i++) {
      const current = list[i];
      const best = list[keepIdx];
      const curScore = num_(current[7]) * 1000 + num_(current[8]);
      const bestScore = num_(best[7]) * 1000 + num_(best[8]);
      if (curScore > bestScore) keepIdx = i;
    }

    const keepCamp = str_(list[keepIdx][0]);

    list.forEach(r => {
      const campaign = str_(r[0]);
      const keepDelete = campaign === keepCamp ? 'KEEP' : 'DELETE_HERE';
      const action = campaign === keepCamp
        ? 'Оставить здесь как основную кампанию'
        : 'Удалить товар из этой кампании, оставить в ' + keepCamp;

      out.push([
        str_(r[1]), campaign, str_(r[3]), str_(r[4]),
        num_(r[5]), num_(r[6]), num_(r[7]), num_(r[8]),
        keepDelete, keepCamp, action
      ]);
    });
  });

  out.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
  return out;
}

/** =========================
 * ZOMBIES
 * output:
 * [campaign,item,title,category,subcategory,impr,clicks,conv,value,urgent,action]
 * ========================= */
function buildZombieSignals_(zomb, groupMap, S) {
  const h = zomb.headers;
  const rows = zomb.rows;
  if (!rows.length) return [];

  const iCamp = idx_(h, 'campaign.name');
  const iItem = idx_(h, 'segments.product_item_id');
  const iTitle = idx_(h, 'segments.product_title');
  const iCat = idx_(h, 'Категория товара', 'category_name');
  const iSubcat = idx_(h, 'Подкатегория товара', 'subcategory_name');
  const iImpr = idx_(h, 'metrics.impressions');
  const iClk = idx_(h, 'metrics.clicks');
  const iConv = idx_(h, 'metrics.conversions');
  const iVal = idx_(h, 'metrics.conversions_value');

  return rows.map(r => {
    const item = iItem >= 0 ? str_(r[iItem]) : '';
    const helper = groupMap.get(item) || { category: '', subcategory: '' };
    const category = iCat >= 0 ? str_(r[iCat]) : helper.category;
    const subcategory = iSubcat >= 0 ? str_(r[iSubcat]) : helper.subcategory;

    const impr = iImpr >= 0 ? num_(r[iImpr]) : 0;
    const clk = iClk >= 0 ? num_(r[iClk]) : 0;
    if (impr < S.zombie_impr_min || clk > 0) return null;

    const urgent = impr >= S.zombie_impr_urgent ? 'URGENT' : '';
    return [
      iCamp >= 0 ? str_(r[iCamp]) : '',
      item,
      iTitle >= 0 ? str_(r[iTitle]) : '',
      category,
      subcategory,
      impr,
      clk,
      iConv >= 0 ? num_(r[iConv]) : 0,
      iVal >= 0 ? num_(r[iVal]) : 0,
      urgent,
      urgent ? 'Срочно исправить или исключить товар.' : 'Проверить релевантность title, фото, цену и наличие.'
    ];
  }).filter(Boolean)
    .sort((a, b) => num_(b[5]) - num_(a[5]))
    .slice(0, S.zombies_limit);
}

/** =========================
 * SEARCH
 * ========================= */
function buildSearchWaste_(searchTerms, S) {
  const h = searchTerms.headers;
  const rows = searchTerms.rows;
  if (!rows.length) return [];

  const iCamp = idx_(h, 'campaign.name');
  const iAg = idx_(h, 'ad_group.name');
  const iTerm = idx_(h, 'search_term_view.search_term');
  const iImpr = idx_(h, 'metrics.impressions');
  const iClk = idx_(h, 'metrics.clicks');
  const iCost = idx_(h, 'cost', 'metrics.cost_micros');
  const iConv = idx_(h, 'metrics.conversions');
  const iVal = idx_(h, 'metrics.conversions_value');

  return rows
    .filter(r => (iCost >= 0 ? num_(r[iCost]) : 0) >= S.search_waste_cost_min && (iConv >= 0 ? num_(r[iConv]) : 0) <= S.search_waste_conv_max)
    .map(r => {
      const cost = iCost >= 0 ? num_(r[iCost]) : 0;
      const clk = iClk >= 0 ? num_(r[iClk]) : 0;
      const impr = iImpr >= 0 ? num_(r[iImpr]) : 0;
      return [
        iCamp >= 0 ? str_(r[iCamp]) : '',
        iAg >= 0 ? str_(r[iAg]) : '',
        iTerm >= 0 ? str_(r[iTerm]) : '',
        cost,
        iVal >= 0 ? num_(r[iVal]) : 0,
        iConv >= 0 ? num_(r[iConv]) : 0,
        clk,
        impr,
        safeDiv_(clk, impr),
        'Добавить в минус-слова или сузить соответствие.'
      ];
    })
    .sort((a, b) => num_(b[3]) - num_(a[3]))
    .slice(0, S.search_waste_limit);
}

function buildSearchWinners_(searchTerms, S) {
  const h = searchTerms.headers;
  const rows = searchTerms.rows;
  if (!rows.length) return [];

  const iCamp = idx_(h, 'campaign.name');
  const iAg = idx_(h, 'ad_group.name');
  const iTerm = idx_(h, 'search_term_view.search_term');
  const iImpr = idx_(h, 'metrics.impressions');
  const iClk = idx_(h, 'metrics.clicks');
  const iCost = idx_(h, 'cost', 'metrics.cost_micros');
  const iConv = idx_(h, 'metrics.conversions');
  const iVal = idx_(h, 'metrics.conversions_value');

  return rows
    .map(r => {
      const cost = iCost >= 0 ? num_(r[iCost]) : 0;
      const val = iVal >= 0 ? num_(r[iVal]) : 0;
      const roas = safeDiv_(val, cost);
      const conv = iConv >= 0 ? num_(r[iConv]) : 0;
      return { r: r, cost: cost, val: val, roas: roas, conv: conv };
    })
    .filter(x => x.conv >= S.search_win_conv_min && x.roas >= S.search_win_roas_min)
    .map(x => {
      const r = x.r;
      return [
        iCamp >= 0 ? str_(r[iCamp]) : '',
        iAg >= 0 ? str_(r[iAg]) : '',
        iTerm >= 0 ? str_(r[iTerm]) : '',
        x.cost, x.val, x.roas, x.conv,
        iClk >= 0 ? num_(r[iClk]) : 0,
        iImpr >= 0 ? num_(r[iImpr]) : 0,
        'Усилить запрос. Вынести в точное соответствие и использовать в SEO.'
      ];
    })
    .sort((a, b) => num_(b[5]) - num_(a[5]) || num_(b[6]) - num_(a[6]))
    .slice(0, S.search_winners_limit);
}

/** =========================
 * CREATIVES
 * ========================= */
function buildCreativesGroups_(assets, S) {
  const h = assets.headers;
  const rows = assets.rows;
  if (!rows.length) return [];

  const iCamp = idx_(h, 'campaign.name');
  const iAg = idx_(h, 'asset_group.name');
  const iFt = idx_(h, 'asset_group_asset.field_type');

  const m = new Map();

  rows.forEach(r => {
    const camp = iCamp >= 0 ? str_(r[iCamp]) : '';
    const ag = iAg >= 0 ? str_(r[iAg]) : '';
    const ft = iFt >= 0 ? str_(r[iFt]).toUpperCase() : '';
    if (!camp || !ag) return;

    const key = camp + '||' + ag;
    if (!m.has(key)) m.set(key, { camp: camp, ag: ag, images: 0, videos: 0, headlines: 0, descriptions: 0 });

    const a = m.get(key);
    if (ft.indexOf('IMAGE') >= 0 || ft.indexOf('LOGO') >= 0) a.images++;
    if (ft.indexOf('VIDEO') >= 0) a.videos++;
    if (ft.indexOf('HEADLINE') >= 0) a.headlines++;
    if (ft.indexOf('DESCRIPTION') >= 0) a.descriptions++;
  });

  const out = [];
  m.forEach(a => {
    const missImg = Math.max(0, S.min_images - a.images);
    const missVid = Math.max(0, S.min_videos - a.videos);
    const missHead = Math.max(0, S.min_headlines - a.headlines);
    const missDesc = Math.max(0, S.min_descriptions - a.descriptions);

    let priority = 'LOW';
    let action = 'OK';

    if (missVid > 0) {
      priority = 'HIGH';
      action = 'Добавить видео';
    } else if (missImg > 0) {
      priority = missImg >= 2 ? 'HIGH' : 'MED';
      action = 'Добавить изображения';
    } else if (missHead > 0 || missDesc > 0) {
      priority = 'MED';
      action = 'Добавить тексты';
    }

    out.push([
      a.camp, a.ag, a.images, a.videos, a.headlines, a.descriptions,
      missImg, missVid, missHead, missDesc, priority, action
    ]);
  });

  out.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
  return out;
}

function buildCreativesIssues_(assets, S) {
  const h = assets.headers;
  const rows = assets.rows;
  if (!rows.length) return [];

  const iCamp = idx_(h, 'campaign.name');
  const iAg = idx_(h, 'asset_group.name');
  const iFt = idx_(h, 'asset_group_asset.field_type');
  const iRes = idx_(h, 'asset.resource_name');
  const iType = idx_(h, 'asset.type');
  const iName = idx_(h, 'asset.name');
  const iText = idx_(h, 'asset.text_asset.text', 'asset_text');
  const iImg = idx_(h, 'asset.image_asset.full_size.url');
  const iYt = idx_(h, 'asset.youtube_video_asset.youtube_video_id');

  const textCount = new Map();
  rows.forEach(r => {
    const camp = iCamp >= 0 ? str_(r[iCamp]) : '';
    const ag = iAg >= 0 ? str_(r[iAg]) : '';
    const ft = iFt >= 0 ? str_(r[iFt]).toUpperCase() : '';
    const text = iText >= 0 ? str_(r[iText]) : '';
    if (!camp || !ag || !ft || !text) return;

    const key = [camp, ag, ft, text].join('||');
    textCount.set(key, (textCount.get(key) || 0) + 1);
  });

  const out = [];
  rows.forEach(r => {
    const camp = iCamp >= 0 ? str_(r[iCamp]) : '';
    const ag = iAg >= 0 ? str_(r[iAg]) : '';
    const ft = iFt >= 0 ? str_(r[iFt]).toUpperCase() : '';
    if (!camp || !ag || !ft) return;

    const res = iRes >= 0 ? str_(r[iRes]) : '';
    const aType = iType >= 0 ? str_(r[iType]) : '';
    const aName = iName >= 0 ? str_(r[iName]) : '';
    const text = iText >= 0 ? str_(r[iText]) : '';
    const img = iImg >= 0 ? str_(r[iImg]) : '';
    const yt = iYt >= 0 ? str_(r[iYt]) : '';

    if ((ft.indexOf('HEADLINE') >= 0 || ft.indexOf('DESCRIPTION') >= 0) && !text) {
      out.push([camp, ag, ft, 'MISSING_TEXT', 'HIGH', res, aType, aName, text, img, 'Добавить текст с выгодой и оффером.']);
    }
    if ((ft.indexOf('IMAGE') >= 0 || ft.indexOf('LOGO') >= 0) && !img) {
      out.push([camp, ag, ft, 'MISSING_IMAGE_URL', 'HIGH', res, aType, aName, text, img, 'Перезалить изображение.']);
    }
    if (ft.indexOf('VIDEO') >= 0 && !yt) {
      out.push([camp, ag, ft, 'MISSING_VIDEO_ID', 'HIGH', res, aType, aName, text, img, 'Добавить YouTube-видео.']);
    }
    if (text) {
      const key = [camp, ag, ft, text].join('||');
      if ((textCount.get(key) || 0) > 1) {
        out.push([camp, ag, ft, 'DUP_TEXT_IN_GROUP', 'MED', res, aType, aName, text, img, 'Убрать дубль текста.']);
      }
    }
  });

  out.sort((a, b) => priorityScore_(a[4]) - priorityScore_(b[4]));
  return out.slice(0, S.creative_issues_limit);
}

/** =========================
 * AD GROUP CONTROL (REAL ASSET GROUPS)
 * raw.assetGroups30 columns expected:
 * campaign.name, asset_group.name, metrics...
 * ========================= */
function buildAdGroupControl_(assetGroups30, assets, S) {
  const h = assetGroups30.headers;
  const rows = assetGroups30.rows;
  if (!rows.length) return [];

  const iCamp = idx_(h, 'campaign.name');
  const iAg = idx_(h, 'asset_group.name');
  const iStatus = idx_(h, 'asset_group.primary_status');
  const iImpr = idx_(h, 'metrics.impressions');
  const iClk = idx_(h, 'metrics.clicks');
  const iCost = idx_(h, 'cost', 'metrics.cost_micros');
  const iConv = idx_(h, 'metrics.conversions');
  const iVal = idx_(h, 'metrics.conversions_value');

  const creativeMap = buildCreativeCompletenessMap_(assets, S);
  const out = [];

  rows.forEach(r => {
    const campaign = iCamp >= 0 ? str_(r[iCamp]) : '';
    const adGroup = iAg >= 0 ? str_(r[iAg]) : '';
    if (!campaign || !adGroup) return;

    const key = campaign + '||' + adGroup;
    const assetState = creativeMap.get(key) || { priority: 'LOW', action: 'OK' };

    const impr = iImpr >= 0 ? num_(r[iImpr]) : 0;
    const clk = iClk >= 0 ? num_(r[iClk]) : 0;
    const cost = iCost >= 0 ? num_(r[iCost]) : 0;
    const conv = iConv >= 0 ? num_(r[iConv]) : 0;
    const val = iVal >= 0 ? num_(r[iVal]) : 0;
    const roas = safeDiv_(val, cost);

    let signal = 'HOLD';
    let risk = 'LOW';
    let action = 'Наблюдать';

    if (str_(iStatus >= 0 ? r[iStatus] : '') === 'NOT_ELIGIBLE') {
      signal = 'CHECK';
      risk = 'HIGH';
      action = 'Группа не eligible. Проверить статус и настройки.';
    } else if (cost < S.camp_min_cost_data) {
      signal = 'LOW_DATA';
      risk = 'LOW';
      action = 'Недостаточно данных.';
    } else if (conv >= S.camp_min_conv_for_scale && roas >= S.camp_scale_roas_min) {
      signal = 'SCALE';
      risk = 'LOW';
      action = 'Масштабировать группу.';
    } else if (cost >= S.camp_cut_cost_min && roas <= S.camp_cut_roas_max) {
      signal = 'CUT';
      risk = 'HIGH';
      action = 'Снизить давление бюджета и проверить состав группы.';
    } else if (impr >= S.zombie_impr_urgent && clk === 0) {
      signal = 'RELEVANCE';
      risk = 'MED';
      action = 'Есть проблема релевантности группы или ассетов.';
    } else if (roas < S.camp_ok_roas_min) {
      signal = 'HOLD_OPTIMIZE';
      risk = 'MED';
      action = 'Оптимизировать группу и состав товаров.';
    }

    if (assetState.priority === 'HIGH') {
      if (risk === 'LOW') risk = 'MED';
      action += ' Срочно доукомплектовать ассеты.';
    } else if (assetState.priority === 'MED') {
      action += ' Улучшить комплектность ассетов.';
    }

    out.push([
      campaign,
      adGroup,
      iStatus >= 0 ? str_(r[iStatus]) : '',
      cost,
      val,
      roas,
      conv,
      clk,
      impr,
      signal,
      risk,
      assetState.priority,
      action
    ]);
  });

  out.sort((a, b) => num_(b[3]) - num_(a[3]));
  return out;
}

function buildCreativeCompletenessMap_(assets, S) {
  const h = assets.headers;
  const rows = assets.rows;

  const iCamp = idx_(h, 'campaign.name');
  const iAg = idx_(h, 'asset_group.name');
  const iFt = idx_(h, 'asset_group_asset.field_type');

  const map = new Map();

  rows.forEach(r => {
    const camp = iCamp >= 0 ? str_(r[iCamp]) : '';
    const ag = iAg >= 0 ? str_(r[iAg]) : '';
    const ft = iFt >= 0 ? str_(r[iFt]).toUpperCase() : '';
    if (!camp || !ag) return;

    const key = camp + '||' + ag;
    if (!map.has(key)) map.set(key, { images: 0, videos: 0, headlines: 0, descriptions: 0 });

    const a = map.get(key);
    if (ft.indexOf('IMAGE') >= 0 || ft.indexOf('LOGO') >= 0) a.images++;
    if (ft.indexOf('VIDEO') >= 0) a.videos++;
    if (ft.indexOf('HEADLINE') >= 0) a.headlines++;
    if (ft.indexOf('DESCRIPTION') >= 0) a.descriptions++;
  });

  const out = new Map();
  map.forEach((a, key) => {
    const missImg = Math.max(0, S.min_images - a.images);
    const missVid = Math.max(0, S.min_videos - a.videos);
    const missHead = Math.max(0, S.min_headlines - a.headlines);
    const missDesc = Math.max(0, S.min_descriptions - a.descriptions);

    let priority = 'LOW';
    let action = 'OK';
    if (missVid > 0) {
      priority = 'HIGH';
      action = 'Добавить видео';
    } else if (missImg > 0) {
      priority = missImg >= 2 ? 'HIGH' : 'MED';
      action = 'Добавить изображения';
    } else if (missHead > 0 || missDesc > 0) {
      priority = 'MED';
      action = 'Добавить тексты';
    }

    out.set(key, { priority: priority, action: action });
  });

  return out;
}

/** =========================
 * MONEY
 * ========================= */
function buildMoneyControl_(campaigns, winners, bleeders, zombies, duplicates, adGroupControl) {
  let totalCost = 0;
  let totalValue = 0;
  let totalConv = 0;

  campaigns.forEach(r => {
    totalCost += num_(r[4]);
    totalValue += num_(r[5]);
    totalConv += num_(r[7]);
  });

  const roas = safeDiv_(totalValue, totalCost);
  const cpa = safeDiv_(totalCost, totalConv);

  let bleedCost = 0;
  bleeders.forEach(r => { bleedCost += num_(r[5]); });

  let zombieImpr = 0;
  zombies.forEach(r => { zombieImpr += num_(r[5]); });

  let duplicateRows = duplicates.length;
  let scalePotential = winners.length;

  let adgroupCut = 0;
  let adgroupStructure = 0;
  adGroupControl.forEach(r => {
    if (str_(r[9]) === 'CUT') adgroupCut++;
    if (str_(r[9]) === 'HOLD_OPTIMIZE' || str_(r[9]) === 'RELEVANCE') adgroupStructure++;
  });

  return [
    ['Метрика', 'Значение', 'Вывод'],
    ['Total Cost', totalCost, 'Общий рекламный расход'],
    ['Total Value', totalValue, 'Общая ценность конверсий'],
    ['ROAS', roas, roas >= 4 ? 'Рабочий уровень' : 'Ниже желаемого уровня'],
    ['CPA', cpa, 'Средняя стоимость конверсии'],
    ['Bleed Cost', bleedCost, bleedCost > 0 ? 'Есть прямой слив бюджета' : 'Слив не выявлен'],
    ['Bleed Share', safeDiv_(bleedCost, totalCost), 'Доля слабых товаров в расходе'],
    ['Zombie Impressions', zombieImpr, zombieImpr > 0 ? 'Есть показы без кликов' : 'Критичных zombies нет'],
    ['Scale Potential Items', scalePotential, scalePotential > 0 ? 'Есть товары для роста' : 'Явных точек роста мало'],
    ['Duplicate Product Rows', duplicateRows, duplicateRows > 0 ? 'Есть каннибализация товаров' : 'Дублей не видно'],
    ['AdGroups CUT', adgroupCut, adgroupCut > 0 ? 'Есть группы под сокращение' : 'Критичных групп нет'],
    ['AdGroups Optimize/Relevance', adgroupStructure, adgroupStructure > 0 ? 'Есть группы, которые надо улучшать' : 'Структура выглядит стабильно']
  ];
}

/** =========================
 * PRODUCT AUDIT
 * ========================= */
function diagnoseProductIssue_(productRow, signalType, rule, S) {
  const campaign = str_(productRow[0]);
  const itemId = str_(productRow[1]);
  const title = str_(productRow[2]);
  const cost = num_(productRow[5]);
  const roas = num_(productRow[7]);
  const conv = num_(productRow[8]);
  const clicks = num_(productRow[9]);
  const impr = num_(productRow[10]);
  const ctr = safeDiv_(clicks, impr);

  let problemType = '';
  let likelyCause = '';
  let checklist = '';
  let owner = S.default_task_owner_content || 'Контент';
  let verificationRule = '';
  let priority = 'MED';

  if (signalType === 'ZOMBIE') {
    priority = impr >= S.zombie_impr_urgent ? 'HIGH' : 'MED';

    if (!title || title.length < 15) {
      problemType = 'TITLE_WEAK';
      likelyCause = 'Слишком слабый или короткий title, низкая релевантность в выдаче.';
      checklist = 'Проверить: тип товара, материал, размер, бренд, назначение в title.';
      verificationRule = 'После правки CTR должен вырасти выше ' + S.zombie_ctr_good_min;
    } else if (ctr < 0.002) {
      problemType = 'PRICE_OR_IMAGE';
      likelyCause = 'Товар показывается, но предложение визуально или по цене проигрывает.';
      checklist = 'Проверить: главное фото, цену, акцию, наличие, УТП в названии.';
      verificationRule = 'Через 7 дней проверить рост CTR и наличие кликов.';
    } else {
      problemType = 'RELEVANCE';
      likelyCause = 'Низкое соответствие спросу или плохая карточка товара.';
      checklist = 'Проверить: категорию, фильтры, title, фото, цену, наличие, посадочную.';
      verificationRule = 'Товар должен выйти из zombie-списка.';
    }
  } else if (signalType === 'BLEEDER') {
    priority = 'HIGH';

    if (clicks > 0 && conv <= 0) {
      problemType = 'CARD_OR_TRAFFIC';
      likelyCause = 'Есть интерес, но карточка или трафик не доводят до заказа.';
      checklist = 'Проверить: фото, цена, наличие, доставка, доверие, соответствие запросам.';
      owner = S.default_task_owner_marketing || 'Маркетолог';
      verificationRule = 'Через 7 дней проверить рост ROAS и/или появление конверсий.';
    } else if (roas < rule.target_roas) {
      problemType = 'LOW_UNIT_ECONOMICS';
      likelyCause = 'Текущий ROAS ниже целевого для категории.';
      checklist = 'Проверить: цену, маржу, релевантность, стратегию приоритета, необходимость рекламы.';
      owner = S.default_task_owner_marketing || 'Маркетолог';
      verificationRule = 'ROAS должен вырасти выше ' + rule.target_roas;
    } else {
      problemType = 'MANUAL_REVIEW';
      likelyCause = 'Нужна ручная проверка причин перерасхода.';
      checklist = 'Проверить: запросы, карточку, цену, конкуренцию, наличие.';
      verificationRule = 'Снижение расхода при сохранении конверсий или рост ROAS.';
    }
  }

  return {
    campaign: campaign,
    item_id: itemId,
    title: title,
    signal_type: signalType,
    problem_type: problemType,
    likely_cause: likelyCause,
    checklist: checklist,
    owner: owner,
    priority: priority,
    verification_rule: verificationRule
  };
}

function buildProductAuditQueue_(bleeders, zombies, S) {
  const out = [];

  bleeders.forEach(r => {
    const rule = { target_roas: num_(r[12]) || S.prod_bleed_roas_max };
    const baseRow = [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10]];
    const d = diagnoseProductIssue_(baseRow, 'BLEEDER', rule, S);

    out.push([
      d.campaign, d.item_id, d.title, str_(r[3]), str_(r[4]),
      d.signal_type, d.problem_type, d.likely_cause, d.checklist,
      d.owner, d.priority, d.verification_rule, 'NEW'
    ]);
  });

  zombies.forEach(r => {
    const baseRow = [r[0], r[1], r[2], r[3], r[4], 0, r[8], 0, r[7], r[6], r[5]];
    const d = diagnoseProductIssue_(baseRow, 'ZOMBIE', {}, S);

    out.push([
      d.campaign, d.item_id, d.title, str_(r[3]), str_(r[4]),
      d.signal_type, d.problem_type, d.likely_cause, d.checklist,
      d.owner, d.priority, d.verification_rule, 'NEW'
    ]);
  });

  return out;
}

/** =========================
 * TASK / CHANGE / VERIFICATION
 * ========================= */
function syncTaskLog_(ss, productAudit, campaigns, searchWaste, creativeGroups, creativeIssues, S) {
  const sh = ss.getSheetByName(CFG.OUT_TASK_LOG);
  const values = sh.getDataRange().getValues();
  const existing = new Set();

  for (let i = 1; i < values.length; i++) {
    const key = [
      str_(values[i][3]),
      str_(values[i][4]),
      str_(values[i][5]),
      str_(values[i][8])
    ].join('||');
    if (key !== '|||') existing.add(key);
  }

  const newRows = [];

  productAudit.forEach(r => {
    const key = ['PRODUCT', str_(r[0]), str_(r[1]), str_(r[6])].join('||');
    if (existing.has(key)) return;

    const priority = str_(r[10]);
    newRows.push([
      makeId_('TASK'),
      new Date(),
      CFG.OUT_PRODUCT_AUDIT,
      'PRODUCT',
      str_(r[0]),
      str_(r[1]),
      '',
      '',
      str_(r[6]),
      str_(r[5]) + ': ' + str_(r[6]),
      str_(r[7]) + ' ' + str_(r[8]),
      str_(r[9]),
      priority,
      'NEW',
      calcDueDate_(priority, S),
      '',
      '',
      '',
      ''
    ]);
  });

  campaigns.forEach(r => {
    const signal = str_(r[20]);
    if (signal !== 'CUT' && signal !== 'CHECK') return;

    const key = ['CAMPAIGN', str_(r[1]), '', signal].join('||');
    if (existing.has(key)) return;

    newRows.push([
      makeId_('TASK'),
      new Date(),
      CFG.OUT_CAMPAIGNS,
      'CAMPAIGN',
      str_(r[1]),
      '',
      '',
      '',
      signal,
      'Campaign ' + signal,
      str_(r[22]),
      S.default_task_owner_marketing || 'Маркетолог',
      'HIGH',
      'NEW',
      calcDueDate_('HIGH', S),
      '',
      '',
      '',
      ''
    ]);
  });

  searchWaste.forEach(r => {
    const key = ['SEARCH_TERM', str_(r[0]), '', str_(r[2])].join('||');
    if (existing.has(key)) return;

    newRows.push([
      makeId_('TASK'),
      new Date(),
      CFG.OUT_SEARCH_WASTE,
      'SEARCH_TERM',
      str_(r[0]),
      '',
      '',
      str_(r[2]),
      'NEGATIVE_KEYWORD',
      'Добавить минус-слово',
      str_(r[9]),
      S.default_task_owner_marketing || 'Маркетолог',
      'HIGH',
      'NEW',
      calcDueDate_('HIGH', S),
      '',
      '',
      '',
      ''
    ]);
  });

  creativeGroups.forEach(r => {
    if (str_(r[10]) === 'LOW' || str_(r[11]) === 'OK') return;

    const key = ['ASSET_GROUP', str_(r[0]), '', str_(r[1])].join('||');
    if (existing.has(key)) return;

    newRows.push([
      makeId_('TASK'),
      new Date(),
      CFG.OUT_CG,
      'ASSET_GROUP',
      str_(r[0]),
      '',
      str_(r[1]),
      '',
      'ASSET_DEFICIT',
      'Доукомплектовать Asset Group',
      str_(r[11]),
      S.default_task_owner_design || 'Дизайнер',
      str_(r[10]),
      'NEW',
      calcDueDate_(str_(r[10]), S),
      '',
      '',
      '',
      ''
    ]);
  });

  creativeIssues.forEach(r => {
    const key = ['ASSET', str_(r[0]), '', str_(r[3]) + '|' + str_(r[1])].join('||');
    if (existing.has(key)) return;

    newRows.push([
      makeId_('TASK'),
      new Date(),
      CFG.OUT_CI,
      'ASSET',
      str_(r[0]),
      '',
      str_(r[1]),
      '',
      str_(r[3]),
      'Исправить ассет',
      str_(r[10]),
      S.default_task_owner_design || 'Дизайнер',
      str_(r[4]),
      'NEW',
      calcDueDate_(str_(r[4]), S),
      '',
      '',
      '',
      ''
    ]);
  });

  if (newRows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, newRows.length, 19).setValues(newRows);
  }
}

function syncVerificationQueue_(ss, S) {
  const taskSh = ss.getSheetByName(CFG.OUT_TASK_LOG);
  const verSh = ss.getSheetByName(CFG.OUT_VERIFICATION_QUEUE);

  const taskVals = taskSh.getDataRange().getValues();
  const verVals = verSh.getDataRange().getValues();
  const existing = new Set();

  for (let i = 1; i < verVals.length; i++) {
    existing.add(str_(verVals[i][0]));
  }

  const newRows = [];
  for (let i = 1; i < taskVals.length; i++) {
    const taskId = str_(taskVals[i][0]);
    const status = str_(taskVals[i][13]).toUpperCase();
    const doneAt = taskVals[i][15];

    if (status !== 'DONE' || !doneAt || existing.has(taskId)) continue;

    const verifyAfter = new Date(doneAt);
    verifyAfter.setDate(verifyAfter.getDate() + Number(S.verification_days_after_done || 7));

    newRows.push([
      taskId,
      str_(taskVals[i][3]),
      str_(taskVals[i][4]),
      str_(taskVals[i][5]),
      str_(taskVals[i][9]),
      str_(taskVals[i][11]),
      doneAt,
      verifyAfter,
      str_(taskVals[i][10]),
      'PENDING'
    ]);
  }

  if (newRows.length) {
    verSh.getRange(verSh.getLastRow() + 1, 1, newRows.length, 10).setValues(newRows);
  }
}

function checkTaskExecutionByChangeLog_(ss, taskId) {
  const changeSh = ss.getSheetByName(CFG.OUT_CHANGE_LOG);
  const changeVals = changeSh.getDataRange().getValues();

  for (let j = 1; j < changeVals.length; j++) {
    if (str_(changeVals[j][1]) === taskId) return true;
  }
  return false;
}

function markUnconfirmedDoneTasks_(ss) {
  const sh = ss.getSheetByName(CFG.OUT_TASK_LOG);
  const vals = sh.getDataRange().getValues();

  for (let i = 1; i < vals.length; i++) {
    const taskId = str_(vals[i][0]);
    const status = str_(vals[i][13]).toUpperCase();
    if (status !== 'DONE') continue;

    const ok = checkTaskExecutionByChangeLog_(ss, taskId);
    const cell = sh.getRange(i + 1, 19);
    if (!ok) {
      cell.setValue('Нет записи в CHANGE_LOG. Изменение не подтверждено.');
      sh.getRange(i + 1, 14).setBackground('#fff2cc');
    }
  }
}

/** =========================
 * SUMMARY / PAGE STATUS
 * ========================= */
function buildSummary_(campaigns, winners, bleeders, zombies, searchWaste, searchWinners, creativeGroups, creativeIssues, productAudit) {
  let scale = 0, hold = 0, cut = 0, check = 0, lowData = 0;
  let highRiskCampaigns = 0;

  campaigns.forEach(r => {
    const signal = str_(r[20]);
    const risk = str_(r[21]);
    if (signal === 'SCALE') scale++;
    else if (signal === 'CUT') cut++;
    else if (signal === 'CHECK') check++;
    else if (signal === 'LOW_DATA') lowData++;
    else hold++;
    if (risk === 'HIGH') highRiskCampaigns++;
  });

  let urgentZombies = 0;
  zombies.forEach(r => { if (str_(r[9]) === 'URGENT') urgentZombies++; });

  let highCreativeGroups = 0;
  creativeGroups.forEach(r => { if (str_(r[10]) === 'HIGH') highCreativeGroups++; });

  let highCreativeIssues = 0;
  creativeIssues.forEach(r => { if (str_(r[4]) === 'HIGH') highCreativeIssues++; });

  return [
    ['Метрика', 'Значение'],
    ['Campaigns SCALE', scale],
    ['Campaigns HOLD/HOLD_OPTIMIZE', hold],
    ['Campaigns CUT', cut],
    ['Campaigns CHECK', check],
    ['Campaigns LOW_DATA', lowData],
    ['Campaigns HIGH RISK', highRiskCampaigns],
    ['Product Winners', winners.length],
    ['Product Bleeders', bleeders.length],
    ['Product Audit Queue', productAudit.length],
    ['Zombies total', zombies.length],
    ['Zombies urgent', urgentZombies],
    ['Search waste', searchWaste.length],
    ['Search winners', searchWinners.length],
    ['Creative groups HIGH', highCreativeGroups],
    ['Creative issues HIGH', highCreativeIssues]
  ];
}

function buildPageStatuses_(data) {
  const pages = [];

  const cutCount = data.campaigns.filter(r => str_(r[20]) === 'CUT').length;
  const checkCount = data.campaigns.filter(r => str_(r[20]) === 'CHECK').length;
  const highRiskCamp = data.campaigns.filter(r => str_(r[21]) === 'HIGH').length;
  const catCrit = data.categoryControl.filter(r => str_(r[17]) === 'HIGH').length;
  const catWarn = data.categoryControl.filter(r => str_(r[17]) === 'MED').length;
  const adCrit = data.adGroupControl.filter(r => str_(r[10]) === 'HIGH' || str_(r[9]) === 'CUT').length;
  const adWarn = data.adGroupControl.filter(r => str_(r[9]) === 'HOLD_OPTIMIZE' || str_(r[9]) === 'RELEVANCE').length;
  const dupCrit = data.duplicates.filter(r => str_(r[8]) === 'DELETE_HERE').length;
  const auditCrit = data.productAudit.filter(r => str_(r[10]) === 'HIGH').length;
  const auditWarn = data.productAudit.filter(r => str_(r[10]) === 'MED').length;
  const taskCrit = data.tasks.filter(r => str_(r[12]) === 'HIGH' && str_(r[13]).toUpperCase() !== 'VERIFIED').length;
  const taskWarn = data.tasks.filter(r => str_(r[13]).toUpperCase() === 'NEW').length;
  const verPending = data.tasks.filter(r => str_(r[13]).toUpperCase() === 'DONE' && !str_(r[16])).length;

  pages.push(makePageStatus_(CFG.OUT_SUMMARY, 'Ключевая сводка по системе', highRiskCamp > 0 || cutCount > 0 ? CFG.STATUS_CRIT : CFG.STATUS_OK, Math.max(highRiskCamp, cutCount), checkCount, cutCount > 0 ? 'Есть кампании под сокращение бюджета' : 'Все под контролем'));
  pages.push(makePageStatus_(CFG.OUT_MONEY, 'Денежные выводы и доли потерь', num_(data.money[6][1]) > 0 ? CFG.STATUS_CRIT : CFG.STATUS_OK, num_(data.money[6][1]) > 0 ? 1 : 0, 0, 'Проверить bleed share и потенциал роста'));
  pages.push(makePageStatus_(CFG.OUT_CATEGORY_CONTROL, 'Контроль категорий и правил', catCrit > 0 ? CFG.STATUS_CRIT : (catWarn > 0 ? CFG.STATUS_WARN : CFG.STATUS_OK), catCrit, catWarn, catCrit > 0 ? 'Есть проблемные категории' : 'Все ок'));
  pages.push(makePageStatus_(CFG.OUT_CAMPAIGNS, 'Решения по бюджету и рискам кампаний', cutCount > 0 || highRiskCamp > 0 ? CFG.STATUS_CRIT : (checkCount > 0 ? CFG.STATUS_WARN : CFG.STATUS_OK), Math.max(cutCount, highRiskCamp), checkCount, cutCount > 0 ? 'Снизить бюджет у слабых кампаний' : checkCount > 0 ? 'Проверить кампании без конверсий' : 'Критичных сигналов нет'));
  pages.push(makePageStatus_(CFG.OUT_ADGROUP_CONTROL, 'Контроль реальных asset groups по кампаниям', adCrit > 0 ? CFG.STATUS_CRIT : (adWarn > 0 ? CFG.STATUS_WARN : CFG.STATUS_OK), adCrit, adWarn, adCrit > 0 ? 'Есть слабые группы' : 'Все ок'));
  pages.push(makePageStatus_(CFG.OUT_WINNERS, 'Товары для масштабирования', data.winners.length > 0 ? CFG.STATUS_OK : CFG.STATUS_WARN, 0, data.winners.length === 0 ? 1 : 0, data.winners.length > 0 ? 'Есть товары для усиления' : 'Нет явных winners'));
  pages.push(makePageStatus_(CFG.OUT_BLEEDERS, 'Товары, которые сливают бюджет', data.bleeders.length > 0 ? CFG.STATUS_CRIT : CFG.STATUS_OK, data.bleeders.length, 0, data.bleeders.length > 0 ? 'Есть bleed-товары' : 'Все ок'));
  pages.push(makePageStatus_(CFG.OUT_ZOMBIES, 'Товары с показами без кликов', data.zombies.filter(r => str_(r[9]) === 'URGENT').length > 0 ? CFG.STATUS_CRIT : (data.zombies.length > 0 ? CFG.STATUS_WARN : CFG.STATUS_OK), data.zombies.filter(r => str_(r[9]) === 'URGENT').length, data.zombies.filter(r => str_(r[9]) !== 'URGENT').length, data.zombies.length > 0 ? 'Нужно править карточки товаров' : 'Все ок'));
  pages.push(makePageStatus_(CFG.OUT_PRODUCT_DUPLICATES, 'Товары, показывающиеся в нескольких кампаниях', dupCrit > 0 ? CFG.STATUS_CRIT : CFG.STATUS_OK, dupCrit, 0, dupCrit > 0 ? 'Есть каннибализация товаров' : 'Все ок'));
  pages.push(makePageStatus_(CFG.OUT_PRODUCT_AUDIT, 'Диагностика проблемных товаров с конкретными причинами', auditCrit > 0 ? CFG.STATUS_CRIT : (auditWarn > 0 ? CFG.STATUS_WARN : CFG.STATUS_OK), auditCrit, auditWarn, auditCrit > 0 ? 'Есть срочные товарные проблемы' : 'Все ок'));
  pages.push(makePageStatus_(CFG.OUT_SEARCH_WASTE, 'Поисковые запросы на минусацию', data.searchWaste.length > 0 ? CFG.STATUS_CRIT : CFG.STATUS_OK, data.searchWaste.length, 0, data.searchWaste.length > 0 ? 'Есть waste-запросы' : 'Все ок'));
  pages.push(makePageStatus_(CFG.OUT_SEARCH_WINNERS, 'Поисковые запросы для усиления', data.searchWinners.length > 0 ? CFG.STATUS_OK : CFG.STATUS_WARN, 0, data.searchWinners.length === 0 ? 1 : 0, data.searchWinners.length > 0 ? 'Есть сильные запросы' : 'Нет выраженных winners'));
  pages.push(makePageStatus_(CFG.OUT_CG, 'Комплектность Asset Group', data.creativeGroups.filter(r => str_(r[10]) === 'HIGH').length > 0 ? CFG.STATUS_CRIT : (data.creativeGroups.filter(r => str_(r[10]) === 'MED').length > 0 ? CFG.STATUS_WARN : CFG.STATUS_OK), data.creativeGroups.filter(r => str_(r[10]) === 'HIGH').length, data.creativeGroups.filter(r => str_(r[10]) === 'MED').length, data.creativeGroups.filter(r => str_(r[10]) === 'HIGH').length > 0 ? 'Не хватает ассетов' : 'Все ок'));
  pages.push(makePageStatus_(CFG.OUT_CI, 'Ошибки и дубли ассетов', data.creativeIssues.filter(r => str_(r[4]) === 'HIGH').length > 0 ? CFG.STATUS_CRIT : (data.creativeIssues.length > 0 ? CFG.STATUS_WARN : CFG.STATUS_OK), data.creativeIssues.filter(r => str_(r[4]) === 'HIGH').length, data.creativeIssues.filter(r => str_(r[4]) === 'MED').length, data.creativeIssues.length > 0 ? 'Есть проблемы в ассетах' : 'Все ок'));
  pages.push(makePageStatus_(CFG.OUT_TASK_LOG, 'Журнал задач и статусов исполнения', taskCrit > 0 ? CFG.STATUS_CRIT : (taskWarn > 0 ? CFG.STATUS_WARN : CFG.STATUS_OK), taskCrit, taskWarn, 'Проверить статусы и просрочку'));
  pages.push(makePageStatus_(CFG.OUT_CHANGE_LOG, 'История внесенных изменений', CFG.STATUS_OK, 0, 0, 'Использовать для подтверждения факта изменений'));
  pages.push(makePageStatus_(CFG.OUT_VERIFICATION_QUEUE, 'Очередь задач на проверку результата', verPending > 0 ? CFG.STATUS_WARN : CFG.STATUS_OK, 0, verPending, verPending > 0 ? 'Есть задачи на верификацию' : 'Все ок'));

  const periodCrit = data.periodCompare
    ? data.periodCompare.filter(r => ['АВАРИЯ', 'ДЕГРАДАЦИЯ'].indexOf(str_(r[13])) >= 0).length
    : 0;

  const periodWarn = data.periodCompare
    ? data.periodCompare.filter(r => ['НЕСТАБИЛЬНО', 'СЕЗОННОСТЬ'].indexOf(str_(r[13])) >= 0).length
    : 0;

  pages.push(makePageStatus_(
    CFG.OUT_PERIOD_COMPARE,
    'Сравнение рекламы за 1 / 7 / 30 / 365 дней и управленческие выводы',
    periodCrit > 0 ? CFG.STATUS_CRIT : (periodWarn > 0 ? CFG.STATUS_WARN : CFG.STATUS_OK),
    periodCrit,
    periodWarn,
    periodCrit > 0 ? 'Проверить аварии и деградацию по кампаниям' : 'Контролировать тренды'
  ));

  return pages;
}

function makePageStatus_(sheet, desc, status, critCount, warnCount, urgentAction) {
  return {
    sheet: sheet,
    description: desc,
    status: status,
    critCount: critCount,
    warnCount: warnCount,
    urgentAction: urgentAction
  };
}

/** =========================
 * WRITERS
 * ========================= */
function resetSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  sh.showSheet();
  return sh;
}

function setHeader_(sh, headers, color) {
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground(color || '#f1f3f4');
  sh.setFrozenRows(1);
}

function writeSummary_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_SUMMARY);
  setHeader_(sh, rows[0], '#d9ead3');
  if (rows.length > 1) sh.getRange(2, 1, rows.length - 1, 2).setValues(rows.slice(1));
  sh.autoResizeColumns(1, 2);
}

function writeMoneyControl_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_MONEY);
  setHeader_(sh, rows[0], '#fce5cd');
  if (rows.length > 1) sh.getRange(2, 1, rows.length - 1, 3).setValues(rows.slice(1));
  wrapCols_(sh, [3]);
  sh.autoResizeColumns(1, 3);
}

function writeCategoryControl_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_CATEGORY_CONTROL);
  setHeader_(sh, [
    'Rule','Категория товара','Подкатегория товара','Items','Cost','Value','ROAS','Conv','CPA','Clicks','Impr',
    'Target ROAS','Target CPA','Bleed Cost Min','Winners','Bleeders','Signal','Risk','Что делать сейчас'
  ], '#d9e2f3');

  if (rows.length) sh.getRange(2, 1, rows.length, 19).setValues(rows);

  formatNumbersStandard_(sh, {
    costCols: [5, 6, 9, 12, 13, 14],
    roasCols: [7],
    convCols: [8],
    intCols: [4, 10, 11, 15, 16]
  });

  applySignalColors_(sh, 17, 2);
  applyRiskColors_(sh, 18, 2);
  wrapCols_(sh, [2, 3, 19]);
  sh.autoResizeColumns(1, 19);
}

function writeCampaigns_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_CAMPAIGNS);
  setHeader_(sh, [
    'Campaign ID','Campaign','Status','Type','Cost','Value','ROAS','Conv','CPA','Clicks','Impr','CTR','Avg CPC',
    'Cost 7d','Value 7d','ROAS 7d','Conv 7d','ROAS prev 7d','ROAS delta','Conv delta',
    'Signal','Risk','Что делать сейчас'
  ], '#d9e2f3');
  if (rows.length) sh.getRange(2, 1, rows.length, 23).setValues(rows);
  formatNumbersCampaigns_(sh);
  wrapCols_(sh, [2, 23]);
  applySignalColors_(sh, 21, 2);
  applyRiskColors_(sh, 22, 2);
  sh.autoResizeColumns(1, 23);
}

function writeAdGroupControl_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_ADGROUP_CONTROL);
  setHeader_(sh, [
    'Campaign','Asset Group','Primary Status','Cost','Value','ROAS','Conv','Clicks','Impr','Signal','Risk','Asset Priority','Что делать сейчас'
  ], '#d9e2f3');

  if (rows.length) sh.getRange(2, 1, rows.length, 13).setValues(rows);

  formatNumbersStandard_(sh, { costCols: [4, 5], roasCols: [6], convCols: [7], intCols: [8, 9] });
  applySignalColors_(sh, 10, 2);
  applyRiskColors_(sh, 11, 2);
  applyPriorityColors_(sh, 12, 2);
  wrapCols_(sh, [2, 13]);
  sh.autoResizeColumns(1, 13);
}

function writeWinners_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_WINNERS);
  setHeader_(sh, [
    'Campaign','Item ID','Title','Категория товара','Подкатегория товара',
    'Cost 30d','Value 30d','ROAS 30d','Conv 30d','Clicks 30d','Impr 30d',
    'Cost 180d','Value 180d','ROAS 180d','Rule','Target Winner ROAS','Target Winner Conv','Что делать сейчас'
  ], '#d9ead3');

  if (rows.length) sh.getRange(2, 1, rows.length, 18).setValues(rows);

  formatNumbersStandard_(sh, {
    costCols: [6, 7, 12, 13, 16],
    roasCols: [8, 14],
    convCols: [9, 17],
    intCols: [10, 11]
  });

  wrapCols_(sh, [3, 4, 5, 18]);
  sh.autoResizeColumns(1, 18);
}

function writeBleeders_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_BLEEDERS);
  setHeader_(sh, [
    'Campaign','Item ID','Title','Категория товара','Подкатегория товара',
    'Cost','Value','ROAS','Conv','Clicks','Impr','Rule','Target ROAS','Bleed Cost Min','Что делать сейчас'
  ], '#f4cccc');

  if (rows.length) sh.getRange(2, 1, rows.length, 15).setValues(rows);

  formatNumbersStandard_(sh, {
    costCols: [6, 7, 14],
    roasCols: [8, 13],
    convCols: [9],
    intCols: [10, 11]
  });

  wrapCols_(sh, [3, 4, 5, 15]);
  sh.autoResizeColumns(1, 15);
}

function writeZombies_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_ZOMBIES);
  setHeader_(sh, [
    'Campaign','Item ID','Title','Категория товара','Подкатегория товара',
    'Impr','Clicks','Conv','Value','Urgent','Что делать сейчас'
  ], '#fff2cc');
  if (rows.length) sh.getRange(2, 1, rows.length, 11).setValues(rows);
  formatNumbersStandard_(sh, { costCols: [9], convCols: [8], intCols: [6, 7] });
  wrapCols_(sh, [3, 4, 5, 11]);
  applyUrgentColors_(sh, 10, 2);
  sh.autoResizeColumns(1, 11);
}

function writeProductDuplicates_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_PRODUCT_DUPLICATES);
  setHeader_(sh, [
    'Item ID','Campaign','Категория товара','Подкатегория товара','Cost','Value','ROAS','Conv','Keep/Delete','Keep In Campaign','Что делать'
  ], '#f4cccc');

  if (rows.length) sh.getRange(2, 1, rows.length, 11).setValues(rows);

  formatNumbersStandard_(sh, { costCols: [5, 6], roasCols: [7], convCols: [8], intCols: [] });
  applyKeepDeleteColors_(sh, 9, 2);
  wrapCols_(sh, [10, 11]);
  sh.autoResizeColumns(1, 11);
}

function writeProductAuditQueue_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_PRODUCT_AUDIT);
  setHeader_(sh, [
    'Campaign','Item ID','Title','Категория товара','Подкатегория товара',
    'Signal Type','Problem Type','Likely Cause','Checklist','Owner','Priority','Verification Rule','Status'
  ], '#fce5cd');

  if (rows.length) sh.getRange(2, 1, rows.length, 13).setValues(rows);

  applyPriorityColors_(sh, 11, 2);
  wrapCols_(sh, [3, 4, 5, 8, 9, 12]);
  sh.autoResizeColumns(1, 13);
}

function writeSearchWaste_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_SEARCH_WASTE);
  setHeader_(sh, ['Campaign','Ad Group','Search Term','Cost','Value','Conv','Clicks','Impr','CTR','Что делать сейчас'], '#f4cccc');
  if (rows.length) sh.getRange(2, 1, rows.length, 10).setValues(rows);
  formatNumbersStandard_(sh, { costCols: [4, 5], convCols: [6], intCols: [7, 8], roasCols: [9] });
  wrapCols_(sh, [2, 3, 10]);
  sh.autoResizeColumns(1, 10);
}

function writeSearchWinners_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_SEARCH_WINNERS);
  setHeader_(sh, ['Campaign','Ad Group','Search Term','Cost','Value','ROAS','Conv','Clicks','Impr','Что делать сейчас'], '#d9ead3');
  if (rows.length) sh.getRange(2, 1, rows.length, 10).setValues(rows);
  formatNumbersStandard_(sh, { costCols: [4, 5], roasCols: [6], convCols: [7], intCols: [8, 9] });
  wrapCols_(sh, [2, 3, 10]);
  sh.autoResizeColumns(1, 10);
}

function writeCreativesGroups_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_CG);
  setHeader_(sh, [
    'Campaign','Asset Group','Images','Videos','Headlines','Descriptions',
    'Miss Images','Miss Videos','Miss Headlines','Miss Descriptions','Priority','Что делать сейчас'
  ], '#fff2cc');
  if (rows.length) sh.getRange(2, 1, rows.length, 12).setValues(rows);
  wrapCols_(sh, [2, 12]);
  applyPriorityColors_(sh, 11, 2);
  sh.autoResizeColumns(1, 12);
}

function writeCreativesIssues_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_CI);
  setHeader_(sh, [
    'Campaign','Asset Group','Field Type','Issue','Priority',
    'Asset Resource','Asset Type','Asset Name','Asset Text','Image URL','Что сделать'
  ], '#fff2cc');
  if (rows.length) sh.getRange(2, 1, rows.length, 11).setValues(rows);
  wrapCols_(sh, [2, 8, 9, 10, 11]);
  applyPriorityColors_(sh, 5, 2);
  sh.autoResizeColumns(1, 11);
}

function writeIndex_(ss, pageStatuses) {
  const sh = resetSheet_(ss, CFG.OUT_INDEX);

  sh.getRange('A1')
    .setValue('Control Panel — оглавление всех листов документа')
    .setFontWeight('bold')
    .setFontSize(14);

  sh.getRange('A2').setValue('Обновлено');
  sh.getRange('B2').setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm');

  const usedMap = buildUsedSheetsMap_(pageStatuses);

  const headers = [
    'Порядок',
    'Лист',
    'Описание',
    'Статус',
    'Критично',
    'Некритично',
    'Главное действие',
    'Используется скриптом',
    'Роль в скрипте',
    'Строк',
    'Колонок',
    'Последняя строка',
    'Последняя колонка',
    'GID'
  ];

  sh.getRange(4, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#d9d9d9');

  sh.setFrozenRows(4);

  const sheets = ss.getSheets();

  const rows = sheets.map((sheet, i) => {
    const name = sheet.getName();
    const info = usedMap[name] || {};
    const url = ss.getUrl().split('#')[0] + '#gid=' + sheet.getSheetId();

    return [
      i + 1,
      '=HYPERLINK("' + url + '";"' + name + '")',
      info.description || '',
      info.status || '',
      info.critCount || 0,
      info.warnCount || 0,
      info.urgentAction || '',
      info.used ? 'YES' : 'NO',
      info.role || defineSheetRole_(name),
      sheet.getMaxRows(),
      sheet.getMaxColumns(),
      sheet.getLastRow(),
      sheet.getLastColumn(),
      sheet.getSheetId()
    ];
  });

  if (rows.length) {
    sh.getRange(5, 1, rows.length, headers.length).setValues(rows);
  }

  formatIndexAllSheets_(sh, rows.length);
}

function formatTaskLogSheet_(ss) {
  const sh = ss.getSheetByName(CFG.OUT_TASK_LOG);
  if (!sh) return;

  sh.setFrozenRows(1);
  wrapCols_(sh, [10, 11, 19]);
  applyPriorityColors_(sh, 13, 2);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  const rng = sh.getRange(2, 14, lastRow - 1, 1);
  const vals = rng.getValues();

  for (let i = 0; i < vals.length; i++) {
    const cell = rng.getCell(i + 1, 1);
    const v = str_(vals[i][0]).toUpperCase();
    if (v === 'NEW') cell.setBackground('#f4cccc');
    else if (v === 'IN PROGRESS') cell.setBackground('#fff2cc');
    else if (v === 'DONE') cell.setBackground('#d9ead3');
    else if (v === 'VERIFIED') cell.setBackground('#cfe2f3');
    else if (v === 'REOPEN') cell.setBackground('#f4cccc');
  }

  sh.autoResizeColumns(1, 19);
}

function formatChangeLogSheet_(ss) {
  const sh = ss.getSheetByName(CFG.OUT_CHANGE_LOG);
  if (!sh) return;
  sh.setFrozenRows(1);
  wrapCols_(sh, [8, 9, 10, 11]);
  sh.autoResizeColumns(1, 11);
}

function formatVerificationQueueSheet_(ss) {
  const sh = ss.getSheetByName(CFG.OUT_VERIFICATION_QUEUE);
  if (!sh) return;
  sh.setFrozenRows(1);
  wrapCols_(sh, [5, 9]);
  sh.autoResizeColumns(1, 10);
}

/** =========================
 * FORMATTING / COLORS
 * ========================= */
function formatNumbersCampaigns_(sh) {
  formatNumbersStandard_(sh, {
    costCols: [5, 6, 9, 13, 14, 15, 18],
    roasCols: [7, 12, 16, 18, 19, 20],
    convCols: [8, 17],
    intCols: [10, 11]
  });
}

function formatNumbersStandard_(sh, opts) {
  const lastRow = Math.max(2, sh.getLastRow());
  (opts.costCols || []).forEach(c => sh.getRange(2, c, lastRow - 1, 1).setNumberFormat('#,##0.00'));
  (opts.roasCols || []).forEach(c => sh.getRange(2, c, lastRow - 1, 1).setNumberFormat('0.00'));
  (opts.convCols || []).forEach(c => sh.getRange(2, c, lastRow - 1, 1).setNumberFormat('#,##0.00'));
  (opts.intCols || []).forEach(c => sh.getRange(2, c, lastRow - 1, 1).setNumberFormat('#,##0'));
}

function wrapCols_(sh, cols) {
  const rows = Math.max(1, sh.getLastRow());
  cols.forEach(c => {
    sh.getRange(1, c, rows, 1).setWrap(true).setVerticalAlignment('middle');
  });
}

function applySignalColors_(sh, col, startRow) {
  const lastRow = sh.getLastRow();
  if (lastRow < startRow) return;

  const rng = sh.getRange(startRow, col, lastRow - startRow + 1, 1);
  const vals = rng.getValues();
  for (let i = 0; i < vals.length; i++) {
    const cell = rng.getCell(i + 1, 1);
    const v = str_(vals[i][0]);
    if (v === 'SCALE') cell.setBackground('#d9ead3');
    else if (v === 'CUT' || v === 'CHECK') cell.setBackground('#f4cccc');
    else if (v === 'HOLD_OPTIMIZE' || v === 'HOLD' || v === 'RELEVANCE') cell.setBackground('#fff2cc');
    else if (v === 'LOW_DATA') cell.setBackground('#d9e2f3');
  }
}

function applyRiskColors_(sh, col, startRow) {
  applyPriorityColors_(sh, col, startRow);
}

function applyPriorityColors_(sh, col, startRow) {
  const lastRow = sh.getLastRow();
  if (lastRow < startRow) return;

  const rng = sh.getRange(startRow, col, lastRow - startRow + 1, 1);
  const vals = rng.getValues();
  for (let i = 0; i < vals.length; i++) {
    const cell = rng.getCell(i + 1, 1);
    const v = str_(vals[i][0]).toUpperCase();
    if (v === 'HIGH' || v === 'CRIT') cell.setBackground('#f4cccc');
    else if (v === 'MED' || v === 'WARN') cell.setBackground('#fff2cc');
    else if (v === 'LOW' || v === 'OK') cell.setBackground('#d9ead3');
  }
}

function applyUrgentColors_(sh, col, startRow) {
  const lastRow = sh.getLastRow();
  if (lastRow < startRow) return;

  const rng = sh.getRange(startRow, col, lastRow - startRow + 1, 1);
  const vals = rng.getValues();
  for (let i = 0; i < vals.length; i++) {
    const cell = rng.getCell(i + 1, 1);
    const v = str_(vals[i][0]).toUpperCase();
    if (v === 'URGENT') cell.setBackground('#f4cccc');
    else cell.setBackground('#fff2cc');
  }
}

function applyKeepDeleteColors_(sh, col, startRow) {
  const lastRow = sh.getLastRow();
  if (lastRow < startRow) return;
  const rng = sh.getRange(startRow, col, lastRow - startRow + 1, 1);
  const vals = rng.getValues();

  for (let i = 0; i < vals.length; i++) {
    const cell = rng.getCell(i + 1, 1);
    const v = str_(vals[i][0]).toUpperCase();
    if (v === 'DELETE_HERE') cell.setBackground('#f4cccc');
    else if (v === 'KEEP') cell.setBackground('#d9ead3');
  }
}

function applySheetStatusColors_(ss, pageStatuses) {
  pageStatuses.forEach(p => {
    const sh = ss.getSheetByName(p.sheet);
    if (!sh) return;

    let color = '#d9ead3';
    if (p.status === CFG.STATUS_WARN) color = '#fff2cc';
    if (p.status === CFG.STATUS_CRIT) color = '#f4cccc';
    sh.setTabColor(color);
  });
}

function applyIndexStatusColors_(sh, rowCount, startRow, statusCol) {
  if (rowCount <= 0) return;
  const rng = sh.getRange(startRow, statusCol, rowCount, 1);
  const vals = rng.getValues();

  for (let i = 0; i < vals.length; i++) {
    const cell = rng.getCell(i + 1, 1);
    const v = str_(vals[i][0]);
    if (v === CFG.STATUS_OK) cell.setBackground('#d9ead3');
    else if (v === CFG.STATUS_WARN) cell.setBackground('#fff2cc');
    else if (v === CFG.STATUS_CRIT) cell.setBackground('#f4cccc');
  }
}

/** =========================
 * HOUSEKEEPING
 * ========================= */
function hideRaw_(ss) {
  [
    CFG.RAW_CAMP_30,
    CFG.RAW_CAMP_DAY_30,
    CFG.RAW_PMAX_PROD_30,
    CFG.RAW_PMAX_PROD_180,
    CFG.RAW_PMAX_ZOMBIES_365,
    CFG.RAW_SEARCH_TERMS_30,
    CFG.RAW_PMAX_ASSETS,
    CFG.RAW_ASSET_GROUPS_30
  ].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (sh) sh.hideSheet();
  });
}

function deleteNonWhitelistSheets_(ss) {
  const whitelist = new Set([
    CFG.RAW_CAMP_30,
    CFG.RAW_CAMP_DAY_30,
    CFG.RAW_PMAX_PROD_30,
    CFG.RAW_PMAX_PROD_180,
    CFG.RAW_PMAX_ZOMBIES_365,
    CFG.RAW_SEARCH_TERMS_30,
    CFG.RAW_PMAX_ASSETS,
    CFG.RAW_ASSET_GROUPS_30,

    CFG.OUT_INDEX,
    CFG.OUT_SETTINGS,
    CFG.OUT_CATALOG_RULES,
    CFG.OUT_GROUP_MAP,
    CFG.OUT_SUMMARY,
    CFG.OUT_MONEY,
    CFG.OUT_CATEGORY_CONTROL,
    CFG.OUT_CAMPAIGNS,
    CFG.OUT_ADGROUP_CONTROL,
    CFG.OUT_WINNERS,
    CFG.OUT_BLEEDERS,
    CFG.OUT_ZOMBIES,
    CFG.OUT_PRODUCT_DUPLICATES,
    CFG.OUT_PRODUCT_AUDIT,
    CFG.OUT_SEARCH_WASTE,
    CFG.OUT_SEARCH_WINNERS,
    CFG.OUT_CG,
    CFG.OUT_CI,
    CFG.OUT_TASK_LOG,
    CFG.OUT_CHANGE_LOG,
    CFG.OUT_VERIFICATION_QUEUE
  ]);

  ss.getSheets().forEach(sh => {
    const name = sh.getName();
    if (whitelist.has(name)) return;
    if (
      CFG.PROTECT_SIG_SHEETS &&
      (name.indexOf('SIG_') === 0 ||
       name === 'Оглавление' ||
       name === 'SETTINGS' ||
       name === 'CATALOG_RULES' ||
       name === 'PRODUCT_GROUP_MAP' ||
       name === 'PRODUCT_AUDIT_QUEUE' ||
       name === 'TASK_LOG' ||
       name === 'CHANGE_LOG' ||
       name === 'VERIFICATION_QUEUE')
    ) return;

    ss.deleteSheet(sh);
  });
}

function reorderSheets_(ss) {
  const order = [
    CFG.OUT_INDEX,
    CFG.OUT_SETTINGS,
    CFG.OUT_CATALOG_RULES,
    CFG.OUT_GROUP_MAP,
    CFG.OUT_SUMMARY,
    CFG.OUT_MONEY,
    CFG.OUT_CATEGORY_CONTROL,
    CFG.OUT_CAMPAIGNS,
    CFG.OUT_ADGROUP_CONTROL,
    CFG.OUT_WINNERS,
    CFG.OUT_BLEEDERS,
    CFG.OUT_ZOMBIES,
    CFG.OUT_PRODUCT_DUPLICATES,
    CFG.OUT_PRODUCT_AUDIT,
    CFG.OUT_SEARCH_WASTE,
    CFG.OUT_SEARCH_WINNERS,
    CFG.OUT_CG,
    CFG.OUT_CI,
    CFG.OUT_TASK_LOG,
    CFG.OUT_CHANGE_LOG,
    CFG.OUT_VERIFICATION_QUEUE
  ];

  let pos = 1;
  order.forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    sh.activate();
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(pos);
    pos++;
  });
}

/** =========================
 * OPTIONAL TRIGGER
 * ========================= */
function installControlPanelTriggerEvery6Hours() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'buildControlPanelFinal') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('buildControlPanelFinal')
    .timeBased()
    .everyHours(6)
    .create();
}

function buildUsedSheetsMap_(pageStatuses) {
  const map = {};

  pageStatuses.forEach(p => {
    map[p.sheet] = {
      used: true,
      role: defineSheetRole_(p.sheet),
      description: p.description,
      status: p.status,
      critCount: p.critCount,
      warnCount: p.warnCount,
      urgentAction: p.urgentAction
    };
  });

  [
    CFG.OUT_INDEX,
    CFG.OUT_SETTINGS,
    CFG.OUT_CATALOG_RULES,
    CFG.OUT_GROUP_MAP,
    CFG.OUT_TASK_LOG,
    CFG.OUT_CHANGE_LOG,
    CFG.OUT_VERIFICATION_QUEUE
  ].forEach(name => {
    if (!map[name]) {
      map[name] = {
        used: true,
        role: defineSheetRole_(name),
        description: '',
        status: '',
        critCount: 0,
        warnCount: 0,
        urgentAction: ''
      };
    } else {
      map[name].used = true;
      map[name].role = defineSheetRole_(name);
    }
  });

  return map;
}

function defineSheetRole_(name) {
  if (name === CFG.OUT_INDEX) return 'Оглавление';
  if (name === CFG.OUT_SETTINGS) return 'Настройки скрипта';
  if (name === CFG.OUT_CATALOG_RULES) return 'Правила категорий';
  if (name === CFG.OUT_GROUP_MAP) return 'Справочник товаров';
  if (name === CFG.OUT_TASK_LOG) return 'Журнал задач';
  if (name === CFG.OUT_CHANGE_LOG) return 'Журнал изменений';
  if (name === CFG.OUT_VERIFICATION_QUEUE) return 'Очередь проверки';

  if (name.indexOf('SIG_') === 0) return 'Выходной лист скрипта';
  if (name.indexOf('RAW') >= 0 || name.indexOf('r_') === 0) return 'RAW / источник';
  if (name.indexOf('ADS_') === 0) return 'История / реклама';
  if (name.indexOf('PROM') >= 0 || name.indexOf('ПРОМ') >= 0) return 'PROM';
  if (name.indexOf('LOG') >= 0) return 'Лог';

  return 'Не используется текущим скриптом';
}

function formatIndexAllSheets_(sh, rowCount) {
  if (rowCount <= 0) return;

  sh.autoResizeColumns(1, sh.getLastColumn());

  sh.getRange(5, 2, rowCount, 1).setFontColor('#1155cc');
  sh.getRange(5, 3, rowCount, 5).setWrap(true);
  sh.getRange(5, 8, rowCount, 1).setHorizontalAlignment('center');

  const usedRange = sh.getRange(5, 8, rowCount, 1);
  const usedValues = usedRange.getValues();

  for (let i = 0; i < usedValues.length; i++) {
    const cell = usedRange.getCell(i + 1, 1);
    const v = String(usedValues[i][0]).trim();

    if (v === 'YES') {
      cell.setBackground('#d9ead3');
    } else {
      cell.setBackground('#f4cccc');
    }
  }

  const statusRange = sh.getRange(5, 4, rowCount, 1);
  const statusValues = statusRange.getValues();

  for (let i = 0; i < statusValues.length; i++) {
    const cell = statusRange.getCell(i + 1, 1);
    const v = String(statusValues[i][0]).trim();

    if (v === CFG.STATUS_OK) cell.setBackground('#d9ead3');
    if (v === CFG.STATUS_WARN) cell.setBackground('#fff2cc');
    if (v === CFG.STATUS_CRIT) cell.setBackground('#f4cccc');
  }
}

function buildPeriodCompare_(camp1, camp7, camp30, camp365) {
  const d1 = aggregateCampaignsForPeriod_(camp1);
  const d7 = aggregateCampaignsForPeriod_(camp7);
  const d30 = aggregateCampaignsForPeriod_(camp30);
  const d365 = aggregateCampaignsForPeriod_(camp365);

  const allCampaigns = new Set([
    ...Object.keys(d1),
    ...Object.keys(d7),
    ...Object.keys(d30),
    ...Object.keys(d365)
  ]);

  const out = [];

  Array.from(allCampaigns).forEach(campaign => {
    const p1 = d1[campaign] || emptyPeriod_();
    const p7 = d7[campaign] || emptyPeriod_();
    const p30 = d30[campaign] || emptyPeriod_();
    const p365 = d365[campaign] || emptyPeriod_();

    const trend = detectCampaignPeriodTrend_(p1, p7, p30, p365);
    const conclusion = buildCampaignManagementConclusion_(trend);

    out.push([
      campaign,
      p1.cost, p1.roas, p1.conv,
      p7.cost, p7.roas, p7.conv,
      p30.cost, p30.roas, p30.conv,
      p365.cost, p365.roas, p365.conv,
      trend,
      conclusion
    ]);
  });

  out.sort((a, b) => num_(b[7]) - num_(a[7]));
  return out;
}

function aggregateCampaignsForPeriod_(data) {
  const h = data.headers;
  const rows = data.rows;

  const iCamp = idx_(h, 'campaign.name');
  const iCost = idx_(h, 'cost', 'metrics.cost_micros');
  const iConv = idx_(h, 'metrics.conversions');
  const iValue = idx_(h, 'metrics.conversions_value');

  const map = {};

  rows.forEach(r => {
    const campaign = iCamp >= 0 ? str_(r[iCamp]) : '';
    if (!campaign) return;

    if (!map[campaign]) {
      map[campaign] = { cost: 0, value: 0, conv: 0, roas: 0 };
    }

    map[campaign].cost += iCost >= 0 ? num_(r[iCost]) : 0;
    map[campaign].value += iValue >= 0 ? num_(r[iValue]) : 0;
    map[campaign].conv += iConv >= 0 ? num_(r[iConv]) : 0;
  });

  Object.keys(map).forEach(k => {
    map[k].roas = safeDiv_(map[k].value, map[k].cost);
  });

  return map;
}

function emptyPeriod_() {
  return { cost: 0, value: 0, conv: 0, roas: 0 };
}

function detectCampaignPeriodTrend_(p1, p7, p30, p365) {
  if (p1.cost > 0 && p1.conv === 0 && p7.conv > 0) return 'АВАРИЯ';

  if (p1.roas > p7.roas && p7.roas > p30.roas && p30.roas > p365.roas) {
    return 'УСТОЙЧИВЫЙ РОСТ';
  }

  if (p1.roas < p7.roas && p7.roas < p30.roas && p30.cost > 0) {
    return 'ДЕГРАДАЦИЯ';
  }

  if (p30.roas > 0 && p1.roas > p30.roas * 1.5) {
    return 'ВОССТАНОВЛЕНИЕ';
  }

  if (p30.roas > 0 && p365.roas > p30.roas * 1.5) {
    return 'СЕЗОННОСТЬ';
  }

  if (p7.roas > 0 && p1.roas > 0 && Math.abs(p1.roas - p7.roas) / p7.roas > 0.5) {
    return 'НЕСТАБИЛЬНО';
  }

  return 'СТАБИЛЬНО';
}

function buildCampaignManagementConclusion_(trend) {
  if (trend === 'АВАРИЯ') {
    return 'Проверить цели, фид, сайт, остатки, модерацию и ставки. Возможна техническая поломка или резкая потеря спроса.';
  }

  if (trend === 'УСТОЙЧИВЫЙ РОСТ') {
    return 'Можно постепенно масштабировать бюджет. Перед ростом проверить наличие товара и производственные ограничения.';
  }

  if (trend === 'ДЕГРАДАЦИЯ') {
    return 'Эффективность ухудшается. Проверить конкурентов, цены, качество трафика, ассортимент и выгорание креативов.';
  }

  if (trend === 'ВОССТАНОВЛЕНИЕ') {
    return 'Система начала восстанавливаться. Не вмешиваться резко. Наблюдать еще 7–14 дней.';
  }

  if (trend === 'СЕЗОННОСТЬ') {
    return 'Есть признаки сезонного спроса. Не делать выводы только по 30 дням.';
  }

  if (trend === 'НЕСТАБИЛЬНО') {
    return 'Высокая волатильность. Нужен ручной контроль и осторожное изменение бюджета.';
  }

  return 'Система выглядит стабильной.';
}

function writePeriodCompare_(ss, rows) {
  const sh = resetSheet_(ss, CFG.OUT_PERIOD_COMPARE);

  setHeader_(sh, [
    'Campaign',
    'Cost 1d', 'ROAS 1d', 'Conv 1d',
    'Cost 7d', 'ROAS 7d', 'Conv 7d',
    'Cost 30d', 'ROAS 30d', 'Conv 30d',
    'Cost 365d', 'ROAS 365d', 'Conv 365d',
    'Trend',
    'Управленческий вывод'
  ], '#d9e2f3');

  if (rows.length) {
    sh.getRange(2, 1, rows.length, 15).setValues(rows);
  }

  formatNumbersStandard_(sh, {
    costCols: [2, 5, 8, 11],
    roasCols: [3, 6, 9, 12],
    convCols: [4, 7, 10, 13],
    intCols: []
  });

  wrapCols_(sh, [1, 15]);
  applyPeriodTrendColors_(sh);
  sh.autoResizeColumns(1, 15);
}

function applyPeriodTrendColors_(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  const rng = sh.getRange(2, 14, lastRow - 1, 1);
  const vals = rng.getValues();

  for (let i = 0; i < vals.length; i++) {
    const cell = rng.getCell(i + 1, 1);
    const v = str_(vals[i][0]);

    if (v === 'УСТОЙЧИВЫЙ РОСТ' || v === 'СТАБИЛЬНО') {
      cell.setBackground('#d9ead3');
    } else if (v === 'ДЕГРАДАЦИЯ' || v === 'АВАРИЯ') {
      cell.setBackground('#f4cccc');
    } else if (v === 'НЕСТАБИЛЬНО' || v === 'СЕЗОННОСТЬ' || v === 'ВОССТАНОВЛЕНИЕ') {
      cell.setBackground('#fff2cc');
    }
  }
}
