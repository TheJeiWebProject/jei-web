<template>
  <div>
    <section class="ww__section">
      <h3 class="ww__title">Weapon Basic Info</h3>
      <WInfoGrid :entries="basicEntries" />
    </section>

    <section v-if="itemEntries.length" class="ww__section">
      <h3 class="ww__title">Item Info</h3>
      <WInfoGrid :entries="itemEntries" />
    </section>

    <section v-if="weaponDesc || itemDesc" class="ww__section">
      <h3 class="ww__title">Description</h3>
      <div
        v-if="weaponDesc"
        class="ww__prose ww__prose--box"
        v-html="formatWikiHtml(weaponDesc)"
      ></div>
      <div v-if="itemDesc" class="ww__prose ww__prose--box" v-html="formatWikiHtml(itemDesc)"></div>
      <div v-if="itemDecoDesc" class="ww__muted" v-html="formatWikiHtml(itemDecoDesc)"></div>
    </section>

    <section v-if="weaponSkillList.length" class="ww__section">
      <h3 class="ww__title">Weapon Skill List</h3>
      <div class="ww__badges">
        <span v-for="id in weaponSkillList" :key="id" class="ww__badge">{{ id }}</span>
      </div>
    </section>

    <section v-if="upgradeRows.length" class="ww__section">
      <h3 class="ww__title">Upgrade Curve</h3>
      <WDataTable :columns="upgradeColumns" :rows="upgradeRows" wide />
    </section>

    <section v-if="breakthroughRows.length" class="ww__section">
      <h3 class="ww__title">Breakthrough</h3>
      <div class="ww__stack">
        <div v-for="row in breakthroughRows" :key="row.breakthroughLv" class="ww__panel">
          <div class="ww__panel-title">
            Breakthrough Lv {{ row.breakthroughLv }}
            <span v-if="row.showLv"> (Show Lv {{ row.showLv }})</span>
          </div>
          <div class="ww__panel-sub">Gold: {{ formatScalar(row.gold) }}</div>
          <div v-if="row.items" class="ww__recipe-items">Items: {{ row.items }}</div>
          <div v-if="row.skillBounds" class="ww__muted">Skill Bounds: {{ row.skillBounds }}</div>
        </div>
      </div>
    </section>

    <section v-if="skillPatchGroups.length" class="ww__section">
      <h3 class="ww__title">Skill Patches</h3>
      <q-expansion-item
        v-for="group in skillPatchGroups"
        :key="group.skillId"
        dense
        expand-separator
        switch-toggle-side
        :label="group.name || group.skillId"
        class="ww__expansion"
      >
        <div class="ww__stack ww__stack--compact">
          <div v-for="patch in group.patches" :key="formatScalar(patch.level)" class="ww__panel">
            <div class="ww__panel-title">Lv {{ patch.level }} · {{ patch.skillName || '-' }}</div>
            <div class="ww__prose" v-html="formatWikiHtml(patch.description)"></div>
          </div>
        </div>
      </q-expansion-item>
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
  formatWikiHtml,
  formatScalar,
  buildInfoEntries,
  resolveEntityName,
  resolveEnumName,
} from './utils';
import { itemTypeNames, weaponTypeNames } from './genums';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
  localNameMap: RecordLike;
}>();

const weaponBasic = computed<RecordLike>(() =>
  isRecordLike(props.detail.weaponBasicTable) ? props.detail.weaponBasicTable : {},
);
const itemTableData = computed<RecordLike>(() =>
  isRecordLike(props.detail.itemTable) ? props.detail.itemTable : {},
);
const skillPatchTableData = computed<RecordLike>(() =>
  isRecordLike(props.detail.skillPatchTable) ? props.detail.skillPatchTable : {},
);

const basicEntries = computed(() =>
  buildInfoEntries(weaponBasic.value, [
    { key: 'engName', label: 'English Name' },
    { key: 'weaponId', label: 'Weapon ID', mono: true },
    {
      key: 'weaponType',
      label: 'Weapon Type',
      format: (v: unknown) => resolveEnumName(weaponTypeNames, v),
    },
    { key: 'rarity', label: 'Rarity' },
    { key: 'maxLv', label: 'Max Level' },
    { key: 'levelTemplateId', label: 'Level Template', mono: true },
    { key: 'breakthroughTemplateId', label: 'Breakthrough Template', mono: true },
    { key: 'talentTemplateId', label: 'Talent Template', mono: true },
    { key: 'modelPath', label: 'Model Path', mono: true },
  ]),
);

const itemEntries = computed(() =>
  buildInfoEntries(itemTableData.value, [
    { key: 'name', label: 'Name' },
    { key: 'id', label: 'ID', mono: true },
    { key: 'iconId', label: 'Icon ID', mono: true },
    { key: 'type', label: 'Type', format: (v: unknown) => resolveEnumName(itemTypeNames, v) },
    { key: 'rarity', label: 'Rarity' },
    { key: 'maxStackCount', label: 'Max Stack' },
    { key: 'backpackCanDiscard', label: 'Can Discard' },
  ]),
);

const weaponDesc = computed(() => weaponBasic.value.weaponDesc);
const itemDesc = computed(() => itemTableData.value.desc);
const itemDecoDesc = computed(() => itemTableData.value.decoDesc);

const weaponSkillList = computed(() =>
  toArray(weaponBasic.value.weaponSkillList).map(String).filter(Boolean),
);

const upgradeColumns = [
  { key: 'weaponLv', label: 'Level' },
  { key: 'baseAtk', label: 'Base ATK' },
  { key: 'lvUpExp', label: 'Upgrade EXP' },
  { key: 'lvUpGold', label: 'Upgrade Gold' },
];

const upgradeRows = computed(() => {
  const table = isRecordLike(props.detail.weaponUpgradeTemplateTable)
    ? props.detail.weaponUpgradeTemplateTable
    : {};
  return toArray<RecordLike>(table.list ?? table);
});

const breakthroughRows = computed(() => {
  const table = isRecordLike(props.detail.weaponBreakThroughTemplateTable)
    ? props.detail.weaponBreakThroughTemplateTable
    : {};
  return toArray<RecordLike>(table.list ?? table).map((entry) => {
    const breakItems = toArray<RecordLike>(entry.breakItemList);
    return {
      breakthroughLv: formatScalar(entry.breakthroughLv),
      showLv: formatScalar(entry.breakthroughShowLv),
      gold: entry.breakthroughGold,
      items: breakItems
        .map(
          (item) =>
            `${resolveEntityName(item.id, props.localNameMap)} x${formatScalar(item.count)}`,
        )
        .join(', '),
      skillBounds: toArray<RecordLike>(entry.skillLevelBounds)
        .map((b) => `[${formatScalar(b.lowerBound)}–${formatScalar(b.upperBound)}]`)
        .join(', '),
    };
  });
});

const skillPatchGroups = computed(() =>
  Object.entries(skillPatchTableData.value)
    .map(([skillId, value]) => {
      const bundles = toArray<RecordLike>(
        isRecordLike(value) ? (value.SkillPatchDataBundle ?? value) : [],
      );
      const patches = bundles
        .filter((b): b is RecordLike => isRecordLike(b))
        .sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0));
      return { skillId, name: patches[0]?.skillName as string | undefined, patches };
    })
    .filter((g) => g.patches.length > 0),
);
</script>
