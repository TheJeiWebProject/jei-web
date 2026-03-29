<template>
  <div>
    <section class="ww__section">
      <h3 class="ww__title">Basic Info</h3>
      <WInfoGrid :entries="basicEntries" />
    </section>

    <section v-if="cvEntries.length" class="ww__section">
      <h3 class="ww__title">CV / 声优</h3>
      <WInfoGrid :entries="cvEntries" />
    </section>

    <section v-if="tagEntries.length" class="ww__section">
      <h3 class="ww__title">Tags</h3>
      <div class="ww__tag-box">
        <div v-for="entry in tagEntries" :key="entry.label" class="ww__tag-row">
          <span class="ww__tag-label">{{ entry.label }}</span>
          <span>{{ entry.value }}</span>
        </div>
      </div>
    </section>

    <section v-if="itemTable" class="ww__section">
      <h3 class="ww__title">Item / 物品</h3>
      <WInfoGrid :entries="itemEntries" />
      <div
        v-if="itemTable.desc"
        class="ww__prose ww__prose--box"
        v-html="formatWikiHtml(itemTable.desc)"
      ></div>
      <div
        v-if="itemTable.decoDesc"
        class="ww__muted"
        v-html="formatWikiHtml(itemTable.decoDesc)"
      ></div>
    </section>

    <section v-if="attributeStages.length" class="ww__section">
      <h3 class="ww__title">Attributes / 属性</h3>
      <q-expansion-item
        v-for="stage in attributeStages"
        :key="`attr-${stage.breakStage}`"
        dense
        expand-separator
        switch-toggle-side
        :label="`Break Stage ${stage.breakStage} (${stage.entries.length} Levels)`"
        class="ww__expansion"
      >
        <div class="ww__table-wrap">
          <table class="ww__table ww__table--wide">
            <thead>
              <tr>
                <th>Level</th>
                <th v-for="type in stage.attrTypes" :key="type">
                  {{ getAttrName(type) }}
                  <span class="ww__attr-type">#{{ type }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in stage.rows" :key="formatScalar(row.level)">
                <td>Lv {{ formatScalar(row.level) }}</td>
                <td v-for="type in stage.attrTypes" :key="`${row.level}-${type}`">
                  {{ formatScalar(row.values[type]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </q-expansion-item>
    </section>

    <section v-if="potentialBundles.length" class="ww__section">
      <h3 class="ww__title">Potential / 潜能</h3>
      <div class="ww__stack">
        <div v-for="bundle in potentialBundles" :key="formatScalar(bundle.level)" class="ww__panel">
          <div class="ww__panel-title">
            Potential {{ bundle.level }}<span v-if="bundle.name"> · {{ bundle.name }}</span>
          </div>
          <div class="ww__panel-sub">
            {{ formatItemBundle(bundle.itemIds, bundle.itemCnts, itemDefsByKeyHash) || '-' }}
          </div>
        </div>
      </div>
    </section>

    <section v-if="growthNodes.length" class="ww__section">
      <h3 class="ww__title">Growth / 成长</h3>
      <div class="ww__stack">
        <div v-for="node in growthNodes" :key="formatScalar(node.nodeId)" class="ww__panel">
          <div class="ww__panel-title">{{ node.name || node.nodeId }}</div>
          <div class="ww__panel-sub">
            {{
              resolveEnumName(
                { 1: 'Promotion / 精英化', 2: 'Outfitting / 装备' },
                node.nodeType,
                'Node',
              )
            }}
          </div>
          <div
            v-if="node.description"
            class="ww__prose ww__prose--small"
            v-html="formatWikiHtml(node.description)"
          ></div>
          <div class="ww__muted">
            {{
              formatRequiredItems(node.requiredItem, localNameMap, itemDefsByKeyHash) ||
              'No required items'
            }}
          </div>
        </div>
      </div>
    </section>

    <section v-if="snapshotEntries.length" class="ww__section">
      <h3 class="ww__title">Artwork / 立绘</h3>
      <div class="ww__grid">
        <div
          v-for="snapshot in snapshotEntries"
          :key="toText(snapshot.pictureId, toText(snapshot.imgId, 'snapshot'))"
          class="ww__card ww__card--media"
        >
          <img
            v-if="snapshot.imgId || snapshot.pictureId"
            :src="toCdnAssetUrl(snapshot.imgId || snapshot.pictureId)"
            :alt="toText(snapshot.name, toText(snapshot.pictureId, 'snapshot'))"
            class="ww__image"
          />
          <div class="ww__value">{{ snapshot.name || snapshot.pictureId || '-' }}</div>
          <div class="ww__label ww__value--mono">
            {{ snapshot.pictureId || snapshot.imgId || '-' }}
          </div>
          <div v-if="snapshot.decoDescription" class="ww__muted">
            {{ stripWikiText(snapshot.decoDescription) }}
          </div>
          <div v-if="snapshot.description" class="ww__muted">
            {{ stripWikiText(snapshot.description) }}
          </div>
          <div class="ww__label">By {{ snapshot.author || 'Unknown' }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ItemDef } from 'src/jei/types';
import WInfoGrid from './shared/WInfoGrid.vue';
import {
  type RecordLike,
  isRecordLike,
  toArray,
  formatWikiHtml,
  formatScalar,
  formatRarity,
  formatRequiredItems,
  formatItemBundle,
  toCdnAssetUrl,
  stripWikiText,
  getAttrName,
  resolveEnumName,
  toText,
} from './utils';
import { weaponTypeNames, professionCategoryNames, charTypeNames } from './genums';

interface AttributeStageRow {
  level: unknown;
  values: Record<string, unknown>;
}

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
  localNameMap: RecordLike;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
}>();

const characterTable = computed<RecordLike | null>(() =>
  isRecordLike(props.detail.characterTable) ? props.detail.characterTable : null,
);
const charTagTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.charTagTable) ? props.detail.charTagTable : {},
);
const growthTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.charGrowthTable) ? props.detail.charGrowthTable : {},
);
const itemTable = computed<RecordLike | null>(() =>
  isRecordLike(props.detail.itemTable) ? props.detail.itemTable : null,
);
const potentialTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.characterPotentialTable) ? props.detail.characterPotentialTable : {},
);

const basicEntries = computed(() => [
  { label: 'Name', value: characterTable.value?.name || props.list?.name || '-' },
  { label: 'English Name', value: characterTable.value?.engName || '-' },
  { label: 'ID', value: characterTable.value?.charId || props.list?.id || '-', mono: true },
  { label: 'Rarity', value: formatRarity(characterTable.value?.rarity ?? props.list?.rarity) },
  {
    label: 'Type',
    value: resolveEnumName(
      charTypeNames,
      characterTable.value?.charTypeId ?? props.list?.charTypeId,
    ),
  },
  {
    label: 'Profession',
    value: resolveEnumName(
      professionCategoryNames,
      props.list?.professionId ?? characterTable.value?.professionId,
      (props.list?.profession as string | undefined) || '-',
    ),
  },
  {
    label: 'Weapon Type',
    value: resolveEnumName(
      weaponTypeNames,
      characterTable.value?.weaponType ?? props.list?.weaponType,
    ),
  },
  { label: 'Department', value: characterTable.value?.department || '-' },
  { label: 'Default Weapon', value: characterTable.value?.defaultWeaponId || '-', mono: true },
]);

const cvEntries = computed(() => {
  const cv =
    characterTable.value && isRecordLike(characterTable.value.cvName)
      ? characterTable.value.cvName
      : {};
  return [
    { label: '中文CV', value: cv.ChiCVName },
    { label: '英文CV', value: cv.EngCVName },
    { label: '日文CV', value: cv.JapCVName },
    { label: '韩文CV', value: cv.KorCVName },
  ].filter(
    (entry): entry is { label: string; value: string } =>
      typeof entry.value === 'string' && entry.value.trim().length > 0,
  );
});

const tagEntries = computed(() => {
  const tags: Array<{ label: string; value: string }> = [];
  const table = charTagTable.value;
  const pushArray = (label: string, value: unknown) => {
    const arr = toArray(value)
      .map((entry) => toText(entry))
      .filter((entry) => entry.length > 0);
    if (arr.length) tags.push({ label, value: arr.join(', ') });
  };
  if (typeof table.raceTagId === 'string' && table.raceTagId)
    tags.push({ label: '种族', value: table.raceTagId });
  if (typeof table.blocTagId === 'string' && table.blocTagId)
    tags.push({ label: '阵营', value: table.blocTagId });
  pushArray('专家', table.expertTagIds);
  pushArray('性格', table.dispositionTagIds);
  pushArray('爱好', table.hobbyTagIds);
  pushArray('厌恶', table.behaviourHateTagIds);
  pushArray('礼物偏好', table.giftPreferTagId);
  return tags;
});

const itemEntries = computed(() => {
  if (!itemTable.value) return [];
  return [
    { label: 'Item ID', value: itemTable.value.id || '-', mono: true },
    { label: 'Item Name', value: itemTable.value.name || '-' },
    { label: 'Icon ID', value: itemTable.value.iconId || '-', mono: true },
  ];
});

const attributeStages = computed(() => {
  const grouped = new Map<number, RecordLike[]>();
  toArray<RecordLike>(characterTable.value?.attributes).forEach((entry) => {
    const breakStage = Number(entry.breakStage ?? 0);
    const bucket = grouped.get(breakStage) ?? [];
    bucket.push(entry);
    grouped.set(breakStage, bucket);
  });
  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([breakStage, entries]) => {
      const typeSet = new Set<string>();
      const rows: AttributeStageRow[] = [];
      entries.forEach((entry, index) => {
        const attrSource = isRecordLike(entry.Attribute) ? entry.Attribute.attrs : entry.attrs;
        const attrs = toArray<RecordLike>(attrSource);
        if (!attrs.length) return;
        let level: unknown = index + 1;
        const values: Record<string, unknown> = {};
        attrs.forEach((attr) => {
          if (attr.attrType === undefined || attr.attrValue === undefined) return;
          const type = toText(attr.attrType);
          if (!type) return;
          if (type === '0') {
            level = attr.attrValue;
            return;
          }
          values[type] = attr.attrValue;
          typeSet.add(type);
        });
        rows.push({ level, values });
      });
      rows.sort((a, b) => Number(a.level) - Number(b.level));
      return {
        breakStage,
        entries,
        rows,
        attrTypes: Array.from(typeSet).sort((a, b) => Number(a) - Number(b)),
      };
    })
    .filter((stage) => stage.rows.length > 0 && stage.attrTypes.length > 0);
});

const potentialBundles = computed(() =>
  toArray<RecordLike>(potentialTable.value.potentialUnlockBundle),
);

const growthNodes = computed(() =>
  Object.values(
    isRecordLike(growthTable.value.charBreakCostMap) ? growthTable.value.charBreakCostMap : {},
  ).filter((entry): entry is RecordLike => isRecordLike(entry)),
);

const snapshotEntries = computed(() =>
  Object.values(isRecordLike(props.detail?.snapshots) ? props.detail.snapshots : {}).filter(
    (entry): entry is RecordLike => isRecordLike(entry),
  ),
);
</script>
