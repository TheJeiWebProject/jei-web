<template>
  <div>
    <section v-if="achieveEntries.length" class="ww__section">
      <h3 class="ww__title">Achievement Info</h3>
      <WInfoGrid :entries="achieveEntries" />
    </section>

    <section v-if="achieveDesc" class="ww__section">
      <h3 class="ww__title">Description</h3>
      <div class="ww__prose ww__prose--box" v-html="formatWikiHtml(achieveDesc)"></div>
    </section>

    <section v-if="typeEntries.length" class="ww__section">
      <h3 class="ww__title">Achievement Type</h3>
      <WInfoGrid :entries="typeEntries" />
    </section>

    <section v-if="groupRows.length" class="ww__section">
      <h3 class="ww__title">Achievement Groups</h3>
      <WDataTable :columns="groupColumns" :rows="groupRows" />
    </section>

    <section v-if="levelInfos.length" class="ww__section">
      <h3 class="ww__title">Level Infos</h3>
      <div class="ww__stack">
        <div v-for="info in levelInfos" :key="info.level" class="ww__panel">
          <div class="ww__panel-title">Level {{ info.level }}</div>
          <div
            v-if="info.completeDesc"
            class="ww__prose"
            v-html="formatWikiHtml(info.completeDesc)"
          ></div>
          <div v-if="info.conditions.length" class="ww__muted">
            <div v-for="(cond, ci) in info.conditions" :key="ci">
              Condition {{ ci + 1 }}: {{ cond.desc || cond.conditionId || '-' }}
            </div>
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
  formatWikiHtml,
  formatScalar,
  buildInfoEntries,
} from './utils';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
}>();

const achieveTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.achievementTable) ? props.detail.achievementTable : {},
);
const typeTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.achievementTypeTable) ? props.detail.achievementTypeTable : {},
);

const achieveEntries = computed(() =>
  buildInfoEntries(achieveTable.value, [
    { key: 'name', label: 'Name' },
    { key: 'achieveId', label: 'Achievement ID', mono: true },
    { key: 'groupId', label: 'Group ID', mono: true },
    { key: 'order', label: 'Order' },
    { key: 'initLevel', label: 'Init Level' },
    { key: 'canBeUpgraded', label: 'Upgradeable' },
    { key: 'canBePlated', label: 'Platable' },
    { key: 'applyRareEffect', label: 'Rare Effect' },
  ]),
);

const achieveDesc = computed(() => achieveTable.value.desc);

const typeEntries = computed(() =>
  buildInfoEntries(typeTable.value, [
    { key: 'categoryName', label: 'Category Name' },
    { key: 'categoryId', label: 'Category ID', mono: true },
    { key: 'categoryPriority', label: 'Priority' },
    { key: 'noObtainCanView', label: 'View Without Obtaining' },
  ]),
);

const groupColumns = [
  { key: 'groupName', label: 'Group Name' },
  { key: 'groupId', label: 'Group ID' },
];

const groupRows = computed(() =>
  toArray<RecordLike>(typeTable.value.achievementGroupData).map((g) => ({
    groupName: formatScalar(g.groupName),
    groupId: formatScalar(g.groupId),
  })),
);

const levelInfos = computed(() => {
  const infos = isRecordLike(achieveTable.value.levelInfos) ? achieveTable.value.levelInfos : {};
  return Object.values(infos)
    .filter((v): v is RecordLike => isRecordLike(v))
    .sort((a, b) => Number(a.achieveLevel ?? 0) - Number(b.achieveLevel ?? 0))
    .map((info) => ({
      level: formatScalar(info.achieveLevel),
      completeDesc: info.completeDesc,
      conditions: toArray<RecordLike>(info.conditions),
    }));
});
</script>
