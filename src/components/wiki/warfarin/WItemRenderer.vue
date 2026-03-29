<template>
  <div>
    <section class="ww__section">
      <h3 class="ww__title">Item Info</h3>
      <WInfoGrid :entries="itemEntries" />
    </section>

    <section v-if="displayName" class="ww__section">
      <h3 class="ww__title">Display Name</h3>
      <div class="ww__prose ww__prose--box">{{ displayName }}</div>
    </section>

    <section v-if="itemDesc || itemDecoDesc" class="ww__section">
      <h3 class="ww__title">Description</h3>
      <div v-if="itemDesc" class="ww__prose ww__prose--box" v-html="formatWikiHtml(itemDesc)"></div>
      <div v-if="itemDecoDesc" class="ww__muted" v-html="formatWikiHtml(itemDecoDesc)"></div>
    </section>

    <section v-if="obtainWayIds.length" class="ww__section">
      <h3 class="ww__title">Obtain Ways</h3>
      <div class="ww__badges">
        <span v-for="id in obtainWayIds" :key="id" class="ww__badge">{{ id }}</span>
      </div>
    </section>

    <section v-if="outcomeItemIds.length" class="ww__section">
      <h3 class="ww__title">Outcome Items</h3>
      <div class="ww__badges">
        <span v-for="id in outcomeItemIds" :key="id" class="ww__badge">{{
          resolveEntityName(id, localNameMap)
        }}</span>
      </div>
    </section>

    <section v-if="hasData(useItemTable)" class="ww__section">
      <h3 class="ww__title">Use Item Table</h3>
      <div class="ww__stack">
        <div v-if="useItemEntries.length" class="ww__panel">
          <WInfoGrid :entries="useItemEntries" />
        </div>
        <div
          v-if="renderedUseItemDesc"
          class="ww__panel ww__prose ww__prose--box"
          v-html="formatWikiHtml(renderedUseItemDesc)"
        ></div>
        <q-expansion-item
          v-for="(action, index) in useActionBundles"
          :key="`use-action-${index}`"
          dense
          expand-separator
          switch-toggle-side
          :label="action.title"
          class="ww__expansion"
        >
          <div class="ww__stack ww__stack--compact">
            <div v-if="action.entries.length" class="ww__panel">
              <WInfoGrid :entries="action.entries" />
            </div>
            <WDataTable
              v-if="action.blackboardRows.length"
              :columns="blackboardColumns"
              :rows="action.blackboardRows"
            />
          </div>
        </q-expansion-item>
      </div>
    </section>

    <section v-if="hasData(equipItemTable)" class="ww__section">
      <h3 class="ww__title">Equip Item Table</h3>
      <div class="ww__stack">
        <div v-if="equipItemEntries.length" class="ww__panel">
          <WInfoGrid :entries="equipItemEntries" />
        </div>
        <div
          v-if="renderedEquipDesc"
          class="ww__panel ww__prose ww__prose--box"
          v-html="formatWikiHtml(renderedEquipDesc)"
        ></div>
        <div
          v-if="renderedEquipExtraDesc"
          class="ww__panel ww__prose ww__prose--box"
          v-html="formatWikiHtml(renderedEquipExtraDesc)"
        ></div>
      </div>
    </section>

    <!-- Recipe Tables -->
    <section v-for="recipe in recipeSections" :key="recipe.title" class="ww__section">
      <h3 class="ww__title">{{ recipe.title }}</h3>
      <div class="ww__stack">
        <div v-for="(formula, fi) in recipe.formulas" :key="fi" class="ww__panel">
          <div class="ww__panel-title">{{ formula.name || formula.id || `Formula ${fi + 1}` }}</div>
          <div v-if="formula.meta.length" class="ww__recipe-meta">
            <span v-for="m in formula.meta" :key="m.label">{{ m.label }}: {{ m.value }} · </span>
          </div>
          <div v-if="formula.ingredients.length" class="ww__recipe-items">
            <strong>Ingredients: </strong>
            <span v-for="(group, gi) in formula.ingredients" :key="gi">
              <template v-if="gi > 0"> | Option {{ gi + 1 }}: </template>
              {{ group.map((item) => formatCraftItem(item, localNameMap, liquidMap)).join(', ') }}
            </span>
          </div>
          <div v-if="formula.outcomes.length" class="ww__recipe-items">
            <strong>Outcomes: </strong>
            <span v-for="(group, gi) in formula.outcomes" :key="gi">
              <template v-if="gi > 0"> | Option {{ gi + 1 }}: </template>
              {{ group.map((item) => formatCraftItem(item, localNameMap, liquidMap)).join(', ') }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import WInfoGrid from './shared/WInfoGrid.vue';
import WDataTable from './shared/WDataTable.vue';
import {
  type RecordLike,
  isRecordLike,
  toArray,
  hasData,
  formatWikiHtml,
  formatScalar,
  formatCraftItem,
  normalizeItemGroups,
  resolveEntityName,
  buildInfoEntries,
  resolveEnumName,
  toText,
} from './utils';
import { itemTypeNames, itemShowingTypeNames } from './genums';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
  localNameMap: RecordLike;
}>();

const itemTableData = computed<RecordLike>(() =>
  isRecordLike(props.detail.itemTable) ? props.detail.itemTable : {},
);

const useItemTable = computed(() => props.detail.useItemTable);
const equipItemTable = computed(() => props.detail.equipItemTable);

const blackboardColumns = [
  { key: 'source', label: 'Source' },
  { key: 'key', label: 'Key' },
  { key: 'value', label: 'Value' },
  { key: 'valueStr', label: 'Value Str' },
];

const itemEntries = computed(() =>
  buildInfoEntries(itemTableData.value, [
    { key: 'name', label: 'Name' },
    { key: 'id', label: 'ID', mono: true },
    { key: 'iconId', label: 'Icon ID', mono: true },
    { key: 'iconCompositeId', label: 'Icon Composite ID', mono: true },
    { key: 'type', label: 'Type', format: (v: unknown) => resolveEnumName(itemTypeNames, v) },
    { key: 'rarity', label: 'Rarity' },
    {
      key: 'showingType',
      label: 'Showing Type',
      format: (v: unknown) => resolveEnumName(itemShowingTypeNames, v),
    },
    { key: 'maxStackCount', label: 'Max Stack' },
    { key: 'maxBackpackStackCount', label: 'Max Backpack Stack' },
    { key: 'backpackCanDiscard', label: 'Can Discard' },
    { key: 'valuableTabType', label: 'Tab Type' },
    { key: 'sortId1', label: 'Sort ID 1' },
    { key: 'sortId2', label: 'Sort ID 2' },
  ]),
);

const itemDesc = computed(() => itemTableData.value.desc);
const itemDecoDesc = computed(() => itemTableData.value.decoDesc);

const obtainWayIds = computed(() =>
  toArray(itemTableData.value.obtainWayIds).map(String).filter(Boolean),
);
const outcomeItemIds = computed(() =>
  toArray(itemTableData.value.outcomeItemIds).map(String).filter(Boolean),
);

// Build liquid container name map for item_fbottle_* display
const liquidMap = computed(() => {
  const map = new Map<string, string>();
  const id = typeof itemTableData.value.id === 'string' ? itemTableData.value.id : '';
  if (!id.startsWith('item_fbottle_')) return map;
  // Try to extract liquid names from recipe tables
  const craftTables = [
    props.detail.inFactoryMachineCraftTable,
    props.detail.outFactoryMachineCraftTable,
    props.detail.factoryHubCraftTable,
  ];
  for (const table of craftTables) {
    if (!isRecordLike(table)) continue;
    const formulas = toArray<RecordLike>(table.formula ?? Object.values(table));
    for (const formula of formulas) {
      if (!isRecordLike(formula)) continue;
      const outcomes = toArray<RecordLike>(formula.outcomes ?? formula.outcome);
      for (const groups of outcomes) {
        const items = Array.isArray(groups) ? groups : [groups];
        for (const item of items) {
          if (!isRecordLike(item)) continue;
          const itemId = typeof item.id === 'string' ? item.id : '';
          if (itemId.startsWith('item_fbottle_')) {
            const name = resolveEntityName(itemId, props.localNameMap);
            if (name !== itemId) map.set(itemId, name);
          }
        }
      }
    }
  }
  return map;
});

const displayName = computed(() => {
  const id = typeof itemTableData.value.id === 'string' ? itemTableData.value.id : '';
  if (!id.startsWith('item_fbottle_') || !liquidMap.value.size) return '';
  const baseName = resolveEntityName(id, props.localNameMap);
  const liquidName = liquidMap.value.get(id);
  return liquidName ? `${baseName} (${liquidName})` : '';
});

function formatTokenValue(value: unknown, format: string | undefined): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return formatScalar(value);
  if (!format) return formatScalar(num);
  if (format.includes('%')) {
    const digits = Number((format.match(/:(\d+)/)?.[1] ?? '0').trim());
    return `${(num * 100)
      .toFixed(digits)
      .replace(/\.0+$/, '')
      .replace(/(\.\d*?)0+$/, '$1')}%`;
  }
  const digits = Number((format.match(/:(\d+)/)?.[1] ?? '0').trim());
  return num
    .toFixed(digits)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1');
}

function renderTemplateWithTokens(text: unknown, tokens: Record<string, unknown>): string {
  if (typeof text !== 'string' || !text) return '';
  return text.replace(
    /\{([a-zA-Z0-9_]+)(:[^}]*)?\}/g,
    (_match, key: string, format: string | undefined) => {
      if (!(key in tokens)) return _match;
      return formatTokenValue(tokens[key], format);
    },
  );
}

function extractBlackboardRows(action: RecordLike): Array<Record<string, string>> {
  const groups = [
    ['buff', isRecordLike(action.buffBBData) ? action.buffBBData : {}],
    ['skill', isRecordLike(action.skillBBData) ? action.skillBBData : {}],
  ] as const;
  return groups.flatMap(([source, data]) => {
    const rows = toArray<RecordLike>(data.blackboard);
    return rows.map((row) => ({
      source,
      key: toText(row.key, '-'),
      value: formatScalar(row.value),
      valueStr: toText(row.valueStr, ''),
    }));
  });
}

function collectActionTokens(action: RecordLike): Record<string, unknown> {
  const tokens: Record<string, unknown> = {};
  const sources = [
    isRecordLike(action.buffBBData) ? action.buffBBData : {},
    isRecordLike(action.skillBBData) ? action.skillBBData : {},
  ];
  for (const source of sources) {
    const rows = toArray<RecordLike>(source.blackboard);
    for (const row of rows) {
      const key = toText(row.key);
      if (!key) continue;
      tokens[key] = row.value ?? row.valueStr;
    }
  }
  return tokens;
}

const useItemEntries = computed(() =>
  isRecordLike(useItemTable.value)
    ? buildInfoEntries(useItemTable.value, [
        { key: 'itemId', label: 'Item ID', mono: true },
        { key: 'effectType', label: 'Effect Type' },
        { key: 'uiType', label: 'UI Type' },
        { key: 'targetNumType', label: 'Target Num Type' },
        { key: 'duration', label: 'Duration' },
        { key: 'stackingKey', label: 'Stacking Key', mono: true },
        { key: 'isPersistentBuff', label: 'Persistent Buff' },
        { key: 'isValuableDepot', label: 'Valuable Depot' },
      ])
    : [],
);

const useActionBundles = computed(() => {
  if (!isRecordLike(useItemTable.value)) return [];
  return toArray<RecordLike>(useItemTable.value.useActions).map((action, index) => {
    const buff = isRecordLike(action.buffBBData) ? action.buffBBData : {};
    const skill = isRecordLike(action.skillBBData) ? action.skillBBData : {};
    const useType = action.useType === undefined ? '-' : formatScalar(action.useType);
    return {
      title: `Use Action ${index + 1} · Type ${useType}`,
      entries: buildInfoEntries(
        {
          useType: action.useType,
          buffId: buff.buffId,
          skillId: skill.skillId,
          skillPath: skill.skillPath,
        },
        [
          { key: 'useType', label: 'Use Type' },
          { key: 'buffId', label: 'Buff ID', mono: true },
          { key: 'skillId', label: 'Skill ID', mono: true },
          { key: 'skillPath', label: 'Skill Path', mono: true },
        ],
      ),
      blackboardRows: extractBlackboardRows(action),
      tokens: collectActionTokens(action),
    };
  });
});

const renderedUseItemDesc = computed(() => {
  if (!isRecordLike(useItemTable.value)) return '';
  const tokens: Record<string, unknown> = { duration: useItemTable.value.duration };
  for (const action of useActionBundles.value) {
    Object.assign(tokens, action.tokens);
  }
  return renderTemplateWithTokens(useItemTable.value.itemUseDesc, tokens);
});

const equipItemEntries = computed(() => {
  if (!isRecordLike(equipItemTable.value)) return [];
  const condParams = toArray(equipItemTable.value.condParams).map(String).filter(Boolean);
  const baseEntries = buildInfoEntries(equipItemTable.value, [
    { key: 'itemId', label: 'Item ID', mono: true },
    { key: 'castTime', label: 'Cast Time' },
    { key: 'cooldown', label: 'Cooldown' },
    { key: 'chargeCount', label: 'Charge Count' },
    { key: 'levelUpChargeCount', label: 'Level Up Charge Count' },
    { key: 'recoverTime', label: 'Recover Time' },
    { key: 'recoverUpperCount', label: 'Recover Upper Count' },
    { key: 'levelUpRecoverUpperCount', label: 'Level Up Recover Upper Count' },
    { key: 'checkTarget', label: 'Check Target' },
    { key: 'condType', label: 'Condition Type' },
    { key: 'useTarget', label: 'Use Target' },
    { key: 'autoCheckNotInFight', label: 'Auto Check Not In Fight' },
    { key: 'toMainCharCount', label: 'To Main Character Count' },
  ]);
  if (condParams.length) {
    baseEntries.push({ label: 'Condition Params', value: condParams.join(', '), mono: false });
  }
  return baseEntries;
});

function buildEquipTokens(table: RecordLike): Record<string, unknown> {
  const tokens: Record<string, unknown> = {
    count: table.chargeCount,
    cooldown: table.cooldown,
    castTime: table.castTime,
    recoverTime: table.recoverTime,
    recoverUpperCount: table.recoverUpperCount,
    levelUpChargeCount: table.levelUpChargeCount,
    levelUpRecoverUpperCount: table.levelUpRecoverUpperCount,
  };
  const condParams = toArray(table.condParams);
  condParams.forEach((value, index) => {
    tokens[`param${index + 1}`] = value;
  });
  return tokens;
}

const renderedEquipDesc = computed(() =>
  isRecordLike(equipItemTable.value)
    ? renderTemplateWithTokens(
        equipItemTable.value.equipDesc,
        buildEquipTokens(equipItemTable.value),
      )
    : '',
);

const renderedEquipExtraDesc = computed(() =>
  isRecordLike(equipItemTable.value)
    ? renderTemplateWithTokens(
        equipItemTable.value.equipExtraDesc,
        buildEquipTokens(equipItemTable.value),
      )
    : '',
);

interface RecipeFormula {
  name: string;
  id: string;
  meta: Array<{ label: string; value: string }>;
  ingredients: RecordLike[][];
  outcomes: RecordLike[][];
}

interface RecipeSection {
  title: string;
  formulas: RecipeFormula[];
}

function parseMachineCraftTable(table: unknown, title: string): RecipeSection | null {
  if (!isRecordLike(table)) return null;
  const formulas = toArray<RecordLike>(table.formula);
  if (!formulas.length) return null;
  return {
    title,
    formulas: formulas.map((f) => ({
      name: typeof f.formulaDesc === 'string' ? f.formulaDesc : '',
      id: typeof f.id === 'string' ? f.id : '',
      meta: [
        ...(f.machineId ? [{ label: 'Machine', value: formatScalar(f.machineId) }] : []),
        ...(f.formulaGroupId ? [{ label: 'Group', value: formatScalar(f.formulaGroupId) }] : []),
        ...(f.progressRound ? [{ label: 'Rounds', value: formatScalar(f.progressRound) }] : []),
        ...(f.totalProgress ? [{ label: 'Progress', value: formatScalar(f.totalProgress) }] : []),
      ],
      ingredients: normalizeItemGroups(f.ingredients),
      outcomes: normalizeItemGroups(f.outcomes),
    })),
  };
}

function parseManualCraftTable(table: unknown, title: string): RecipeSection | null {
  if (!isRecordLike(table)) return null;
  const entries = Object.entries(table);
  if (!entries.length) return null;
  return {
    title,
    formulas: entries.flatMap(([key, value]) => {
      if (!isRecordLike(value)) return [];
      const entry = value;
      return {
        name: typeof entry.name === 'string' ? entry.name : key,
        id: typeof entry.id === 'string' ? entry.id : key,
        meta: [
          ...(entry.domainId ? [{ label: 'Domain', value: formatScalar(entry.domainId) }] : []),
          ...(entry.rarity !== undefined
            ? [{ label: 'Rarity', value: formatScalar(entry.rarity) }]
            : []),
        ],
        ingredients: normalizeItemGroups(entry.ingredients),
        outcomes: normalizeItemGroups(entry.outcomes),
      };
    }),
  };
}

function parseEquipFormulaTable(table: unknown, title: string): RecipeSection | null {
  if (!isRecordLike(table)) return null;
  const entries = Object.values(table).filter((v): v is RecordLike => isRecordLike(v));
  if (!entries.length) return null;
  return {
    title,
    formulas: entries.map((entry) => {
      const costIds = toArray(entry.costItemId);
      const costNums = toArray(entry.costItemNum);
      const ingredientGroup: RecordLike[] = costIds.map((id, i) => ({
        id,
        count: costNums[i] ?? 1,
      }));
      if (entry.costGoldNum && entry.costGoldId) {
        ingredientGroup.push({ id: entry.costGoldId, count: entry.costGoldNum });
      }
      const ingredients: RecordLike[][] = ingredientGroup.length ? [ingredientGroup] : [];
      const outcomes: RecordLike[][] = entry.outcomeEquipId
        ? [[{ id: entry.outcomeEquipId, count: 1 }]]
        : [];
      return {
        name: typeof entry.formulaId === 'string' ? entry.formulaId : '',
        id: typeof entry.formulaId === 'string' ? entry.formulaId : '',
        meta: [
          ...(entry.packId ? [{ label: 'Pack', value: formatScalar(entry.packId) }] : []),
          ...(entry.unlockType !== undefined
            ? [
                {
                  label: 'Unlock',
                  value: `${toText(entry.unlockType, '-')} : ${toText(entry.unlockKey)} = ${toText(entry.unlockValue)}`,
                },
              ]
            : []),
        ],
        ingredients,
        outcomes,
      };
    }),
  };
}

function parseFactoryHubCraftTable(table: unknown, title: string): RecipeSection | null {
  if (!isRecordLike(table)) return null;
  const entries = Object.entries(table);
  if (!entries.length) return null;
  return {
    title,
    formulas: entries.flatMap(([key, value]) => {
      if (!isRecordLike(value)) return [];
      const entry = value;
      return {
        name: typeof entry.id === 'string' ? entry.id : key,
        id: typeof entry.id === 'string' ? entry.id : key,
        meta: [
          ...(entry.usableLevel !== undefined
            ? [{ label: 'Level', value: formatScalar(entry.usableLevel) }]
            : []),
          ...(entry.rarity !== undefined
            ? [{ label: 'Rarity', value: formatScalar(entry.rarity) }]
            : []),
        ],
        ingredients: normalizeItemGroups(entry.ingredients),
        outcomes: normalizeItemGroups(entry.outcomes),
      };
    }),
  };
}

function parseManualFormulaUnlockTable(table: unknown, title: string): RecipeSection | null {
  if (!isRecordLike(table)) return null;
  const entries = Object.values(table).filter((v): v is RecordLike => isRecordLike(v));
  if (!entries.length) return null;
  return {
    title,
    formulas: entries.map((entry) => {
      const ingredients: RecordLike[][] = [];
      const outcomes: RecordLike[][] = [];
      if (entry.itemId) {
        outcomes.push([{ id: entry.itemId, count: entry.gainItemNum ?? 1 }]);
      }
      // Collect reward items (rewardItemId1..N / rewardItemCount1..N)
      const rewards: RecordLike[] = [];
      for (let i = 1; i <= 10; i++) {
        const rid = entry[`rewardItemId${i}`];
        const rcount = entry[`rewardItemCount${i}`];
        if (rid) rewards.push({ id: rid, count: rcount ?? 1 });
      }
      if (rewards.length) outcomes.push(rewards);
      return {
        name: typeof entry.id === 'string' ? entry.id : '',
        id: typeof entry.id === 'string' ? entry.id : '',
        meta: [],
        ingredients,
        outcomes,
      };
    }),
  };
}

const recipeSections = computed<RecipeSection[]>(() => {
  const sections: RecipeSection[] = [];
  const tryAdd = (result: RecipeSection | null) => {
    if (result) sections.push(result);
  };
  tryAdd(
    parseMachineCraftTable(props.detail.inFactoryMachineCraftTable, 'In Factory Machine Craft'),
  );
  tryAdd(
    parseMachineCraftTable(props.detail.outFactoryMachineCraftTable, 'Out Factory Machine Craft'),
  );
  tryAdd(parseManualCraftTable(props.detail.factoryManualCraftTable, 'Factory Manual Craft'));
  tryAdd(parseEquipFormulaTable(props.detail.equipFormulaTable, 'Equip Formula'));
  tryAdd(parseFactoryHubCraftTable(props.detail.factoryHubCraftTable, 'Factory Hub Craft'));
  tryAdd(
    parseManualFormulaUnlockTable(
      props.detail.factoryManualCraftFormulaUnlockTable,
      'Manual Formula Unlock',
    ),
  );
  return sections;
});
</script>
