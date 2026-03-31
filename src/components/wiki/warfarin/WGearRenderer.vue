<template>
  <div>
    <section v-if="itemEntries.length" class="ww__section">
      <h3 class="ww__title">Gear Item Info</h3>
      <WInfoGrid :entries="itemEntries" />
    </section>

    <section v-if="equipEntries.length" class="ww__section">
      <h3 class="ww__title">Equip Info</h3>
      <WInfoGrid :entries="equipEntries" />
    </section>

    <section v-if="itemDesc || itemDecoDesc" class="ww__section">
      <h3 class="ww__title">Description</h3>
      <div v-if="itemDesc" class="ww__prose ww__prose--box" v-html="formatWikiHtml(itemDesc)"></div>
      <div v-if="itemDecoDesc" class="ww__muted" v-html="formatWikiHtml(itemDecoDesc)"></div>
    </section>

    <section v-if="baseAttrModifiers.length" class="ww__section">
      <h3 class="ww__title">Base Attribute Modifier</h3>
      <WDataTable :columns="attrModColumns" :rows="baseAttrModifiers" />
    </section>

    <section v-if="displayAttrModifiers.length" class="ww__section">
      <h3 class="ww__title">Display Attribute Modifiers</h3>
      <WDataTable :columns="indexedAttrModColumns" :rows="displayAttrModifiers" />
    </section>

    <section v-if="equipAttrModifiers.length" class="ww__section">
      <h3 class="ww__title">Equip Attribute Modifiers</h3>
      <div class="ww__stack">
        <div v-for="(mod, i) in equipAttrModifiers" :key="i" class="ww__panel">
          <div class="ww__panel-title">
            {{ attrLabel(String(mod.attrType)) }} (#{{ mod.attrType }})
          </div>
          <div class="ww__panel-sub">
            Modifier Type: {{ mod.modifierType }} · Index: {{ mod.attrIndex }}
          </div>
          <div class="ww__muted">
            Values: {{ toArray(mod.attrValues).map(formatScalar).join(', ') }}
          </div>
        </div>
      </div>
    </section>

    <section v-if="hasData(equipSuitTable)" class="ww__section">
      <h3 class="ww__title">Equip Suit Table</h3>
      <div class="ww__stack">
        <div class="ww__panel">
          <WInfoGrid :entries="equipSuitEntries" />
          <div v-if="equipSuitLogoUrl" class="ww__stack q-mt-md">
            <div class="ww__label">Suit Logo</div>
            <img
              :src="equipSuitLogoUrl"
              :alt="String(equipSuitTable.suitName || equipSuitTable.suitID || 'Suit Logo')"
              class="ww__image ww__gear-logo"
            />
          </div>
        </div>
      </div>
    </section>

    <section v-if="skillPatchBundles.length" class="ww__section">
      <h3 class="ww__title">Skill Patch Table</h3>
      <q-expansion-item
        v-for="bundle in skillPatchBundles"
        :key="bundle.skillId"
        dense
        expand-separator
        switch-toggle-side
        :label="bundle.skillName"
        class="ww__expansion"
      >
        <div class="ww__stack ww__stack--compact">
          <div
            v-for="patch in bundle.patches"
            :key="`${bundle.skillId}-${patch.level}`"
            class="ww__panel"
          >
            <div class="ww__panel-title">Lv {{ patch.level }} · {{ patch.skillName }}</div>
            <div class="ww__panel-sub ww__value--mono">
              {{ bundle.skillId }}
              <span v-if="patch.costValue || patch.coolDown">
                · Cost {{ formatScalar(patch.costValue) }} · CD {{ formatScalar(patch.coolDown) }}
              </span>
            </div>
            <div
              v-if="patch.renderedDescription"
              class="ww__prose"
              v-html="formatWikiHtml(patch.renderedDescription)"
            ></div>
            <WDataTable
              v-if="patch.blackboardRows.length"
              :columns="blackboardColumns"
              :rows="patch.blackboardRows"
            />
          </div>
        </div>
      </q-expansion-item>
    </section>

    <section v-else-if="hasData(skillPatchTableData)" class="ww__section">
      <h3 class="ww__title">Skill Patch Table</h3>
      <WJsonViewer :value="skillPatchTableData" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import WInfoGrid from './shared/WInfoGrid.vue';
import WDataTable from './shared/WDataTable.vue';
import WJsonViewer from './shared/WJsonViewer.vue';
import {
  type RecordLike,
  isRecordLike,
  toArray,
  hasData,
  formatWikiHtml,
  formatScalar,
  getAttrName,
  buildInfoEntries,
  resolveEnumName,
  toCdnAssetUrl,
} from './utils';
import { itemTypeNames, partTypeNames, modifierTypeNames } from './genums';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
}>();

const { locale } = useI18n();
const attrLabel = (attrType: string | number) => getAttrName(attrType, locale.value);

const itemTableData = computed<RecordLike>(() =>
  isRecordLike(props.detail.itemTable) ? props.detail.itemTable : {},
);
const equipTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.equipTable) ? props.detail.equipTable : {},
);
const equipSuitTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.equipSuitTable) ? props.detail.equipSuitTable : {},
);
const skillPatchTableData = computed<RecordLike>(() =>
  isRecordLike(props.detail.skillPatchTable) ? props.detail.skillPatchTable : {},
);

const equipSuitEntries = computed(() => {
  const suit = isRecordLike(equipSuitTable.value) ? equipSuitTable.value : {};
  return buildInfoEntries(suit, [
    { key: 'suitName', label: 'Suit Name' },
    { key: 'suitID', label: 'Suit ID', mono: true },
    { key: 'equipCnt', label: 'Equip Count' },
    { key: 'skillID', label: 'Skill ID', mono: true },
    { key: 'skillLv', label: 'Skill Level' },
    { key: 'suitLogoName', label: 'Suit Logo ID', mono: true },
  ]);
});

const equipSuitLogoUrl = computed(() => {
  const suit = isRecordLike(equipSuitTable.value) ? equipSuitTable.value : {};
  return toCdnAssetUrl(suit.suitLogoName);
});

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

const equipEntries = computed(() =>
  buildInfoEntries(equipTable.value, [
    { key: 'itemId', label: 'Item ID', mono: true },
    { key: 'domainId', label: 'Domain ID', mono: true },
    { key: 'minWearLv', label: 'Min Wear Level' },
    {
      key: 'partType',
      label: 'Part Type',
      format: (v: unknown) => resolveEnumName(partTypeNames, v),
    },
    { key: 'suitID', label: 'Suit ID', mono: true },
  ]),
);

const itemDesc = computed(() => itemTableData.value.desc);
const itemDecoDesc = computed(() => itemTableData.value.decoDesc);

const attrModColumns = [
  { key: 'attrType', label: 'Attr Type' },
  { key: 'attrName', label: 'Attr Name' },
  { key: 'attrValue', label: 'Value' },
  { key: 'modifierType', label: 'Modifier Type' },
];

const indexedAttrModColumns = [{ key: 'attrIndex', label: 'Index' }, ...attrModColumns];

const baseAttrModifiers = computed(() => {
  const mod = equipTable.value.displayBaseAttrModifier;
  if (!isRecordLike(mod)) return [];
  return [
    {
      attrType: formatScalar(mod.attrType),
      attrName: attrLabel(String(mod.attrType)),
      attrValue: formatScalar(mod.attrValue),
      modifierType: resolveEnumName(modifierTypeNames, mod.modifierType),
    },
  ];
});

const displayAttrModifiers = computed(() =>
  toArray<RecordLike>(equipTable.value.displayAttrModifiers).map((mod) => ({
    attrIndex: formatScalar(mod.attrIndex),
    attrType: formatScalar(mod.attrType),
    attrName: attrLabel(String(mod.attrType)),
    attrValue: formatScalar(mod.attrValue),
    modifierType: resolveEnumName(modifierTypeNames, mod.modifierType),
  })),
);

const equipAttrModifiers = computed(() => toArray<RecordLike>(equipTable.value.equipAttrModifiers));

const blackboardColumns = [
  { key: 'key', label: 'Key' },
  { key: 'value', label: 'Value' },
  { key: 'valueStr', label: 'Value Str' },
];

function formatBlackboardTokenValue(value: unknown, format: string | undefined): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return formatScalar(value);
  if (!format) return formatScalar(num);

  if (format.endsWith('%')) {
    const numericPattern = format.slice(0, -1);
    const dot = numericPattern.indexOf('.');
    const decimals = dot >= 0 ? numericPattern.length - dot - 1 : 0;
    return `${(num * 100).toFixed(decimals).replace(/\.?0+$/, '')}%`;
  }

  const dot = format.indexOf('.');
  const decimals = dot >= 0 ? format.length - dot - 1 : 0;
  return num.toFixed(decimals).replace(/\.?0+$/, '');
}

function renderSkillPatchDescription(description: unknown, blackboard: unknown): string {
  const text = typeof description === 'string' ? description : '';
  if (!text) return '';
  const board = new Map(
    toArray<RecordLike>(blackboard)
      .filter((entry) => typeof entry.key === 'string')
      .map((entry) => [String(entry.key), entry]),
  );
  return text.replace(/\{([a-zA-Z0-9_]+)(?::([^}]+))?\}/g, (_full, key, format) => {
    const entry = board.get(String(key));
    if (!entry) return `{${String(key)}${format ? `:${String(format)}` : ''}}`;
    const valueStr = typeof entry.valueStr === 'string' ? entry.valueStr.trim() : '';
    if (valueStr) return valueStr;
    return formatBlackboardTokenValue(entry.value, typeof format === 'string' ? format : undefined);
  });
}

const skillPatchBundles = computed(() => {
  const raw = skillPatchTableData.value;
  const bundleSource = isRecordLike(raw) ? (raw.SkillPatchDataBundle ?? raw) : raw;
  const patches = toArray<RecordLike>(bundleSource)
    .filter((entry) => isRecordLike(entry))
    .map((patch) => {
      const skillId = typeof patch.skillId === 'string' ? patch.skillId : 'unknown-skill';
      const skillName =
        typeof patch.skillName === 'string' && patch.skillName.trim().length > 0
          ? patch.skillName
          : skillId;
      const blackboardRows = toArray<RecordLike>(patch.blackboard).map((entry) => ({
        key: typeof entry.key === 'string' ? entry.key : '-',
        value: formatScalar(entry.value),
        valueStr:
          typeof entry.valueStr === 'string' && entry.valueStr.trim().length > 0
            ? entry.valueStr
            : '-',
      }));
      return {
        skillId,
        skillName,
        level: Number(patch.level ?? 0),
        costValue: patch.costValue,
        coolDown: patch.coolDown,
        renderedDescription: renderSkillPatchDescription(patch.description, patch.blackboard),
        blackboardRows,
      };
    })
    .sort((a, b) => a.skillId.localeCompare(b.skillId) || a.level - b.level);

  const grouped = new Map<
    string,
    { skillId: string; skillName: string; patches: typeof patches }
  >();
  patches.forEach((patch) => {
    const existing = grouped.get(patch.skillId);
    if (existing) {
      existing.patches.push(patch);
      return;
    }
    grouped.set(patch.skillId, {
      skillId: patch.skillId,
      skillName: patch.skillName,
      patches: [patch],
    });
  });

  return Array.from(grouped.values());
});
</script>

<style scoped>
.ww__gear-logo {
  max-width: 240px;
  width: 100%;
  object-fit: contain;
}
</style>
