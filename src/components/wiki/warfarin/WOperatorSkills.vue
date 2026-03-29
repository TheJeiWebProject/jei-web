<template>
  <div>
    <section v-if="skillGroups.length" class="ww__section">
      <h3 class="ww__title">Skill Level Up</h3>
      <q-expansion-item
        v-for="group in skillGroups"
        :key="group.skillGroupId"
        dense
        expand-separator
        switch-toggle-side
        :label="group.name || group.skillGroupId"
        class="ww__expansion"
      >
        <div v-if="group.desc" class="ww__prose q-mb-md" v-html="formatWikiHtml(group.desc)"></div>
        <WDataTable :columns="skillLevelColumns" :rows="group.levels.map(formatSkillLevel)" />
      </q-expansion-item>
    </section>

    <section v-if="skillPatchGroups.length" class="ww__section">
      <h3 class="ww__title">Skill Patches / 技能</h3>
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
            <div v-if="toArray(patch.blackboard).length" class="ww__muted">
              {{ formatBlackboard(patch.blackboard) }}
            </div>
          </div>
        </div>
      </q-expansion-item>
    </section>

    <section v-if="potentialEffectEntries.length" class="ww__section">
      <h3 class="ww__title">Potential Talent Effects / 潜能天赋</h3>
      <div class="ww__stack ww__stack--compact">
        <div v-for="entry in potentialEffectEntries" :key="entry.key" class="ww__panel">
          <div class="ww__panel-title">{{ entry.title }}</div>
          <div class="ww__panel-sub ww__value--mono">{{ entry.key }}</div>
          <div
            v-if="entry.description"
            class="ww__prose"
            v-html="formatWikiHtml(entry.description)"
          ></div>
        </div>
      </div>
    </section>

    <section v-if="spaceshipSkills.length" class="ww__section">
      <h3 class="ww__title">Spaceship Skills / 飞船技能</h3>
      <div class="ww__stack ww__stack--compact">
        <div v-for="skill in spaceshipSkills" :key="skill.skillId" class="ww__panel">
          <div class="ww__panel-title">{{ skill.name || skill.skillId }}</div>
          <div v-if="skill.desc" class="ww__prose" v-html="formatWikiHtml(skill.desc)"></div>
          <div class="ww__panel-sub ww__value--mono">{{ skill.skillId }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ItemDef } from 'src/jei/types';
import WDataTable from './shared/WDataTable.vue';
import {
  type RecordLike,
  isRecordLike,
  toArray,
  formatWikiHtml,
  formatScalar,
  formatRequiredItems,
  toText,
} from './utils';

const props = defineProps<{
  detail: RecordLike;
  localNameMap: RecordLike;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
}>();

const growthTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.charGrowthTable) ? props.detail.charGrowthTable : {},
);
const potentialEffects = computed<RecordLike>(() =>
  isRecordLike(props.detail.potentialTalentEffectTable)
    ? props.detail.potentialTalentEffectTable
    : {},
);
const skillPatchTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.skillPatchTable) ? props.detail.skillPatchTable : {},
);

const skillLevelColumns = [
  { key: 'level', label: 'Level' },
  { key: 'goldCost', label: 'Gold' },
  { key: 'materials', label: 'Materials' },
];

const skillGroups = computed(() => {
  const groupMap = isRecordLike(growthTable.value.skillGroupMap)
    ? growthTable.value.skillGroupMap
    : {};
  const levelUps = toArray<RecordLike>(growthTable.value.skillLevelUp);
  return Object.values(groupMap)
    .filter((entry): entry is RecordLike => isRecordLike(entry))
    .map((entry) => {
      const skillGroupId = typeof entry.skillGroupId === 'string' ? entry.skillGroupId : '';
      return {
        skillGroupId,
        name: typeof entry.name === 'string' ? entry.name : skillGroupId,
        desc: entry.desc,
        sortKey: Number(entry.skillGroupType ?? 999),
        levels: levelUps
          .filter((item) => item.skillGroupId === skillGroupId)
          .sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0)),
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));
});

function formatSkillLevel(entry: RecordLike): Record<string, unknown> {
  return {
    level: `Lv ${formatScalar(entry.level)}`,
    goldCost: formatScalar(entry.goldCost),
    materials:
      formatRequiredItems(entry.itemBundle, props.localNameMap, props.itemDefsByKeyHash) || '-',
  };
}

const skillPatchGroups = computed(() => {
  const table = skillPatchTable.value;
  return Object.entries(table)
    .map(([skillId, value]) => {
      const bundles = toArray<RecordLike>(
        isRecordLike(value) ? (value.SkillPatchDataBundle ?? value) : [],
      );
      const patches = bundles
        .filter((b): b is RecordLike => isRecordLike(b))
        .sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0));
      const name = patches[0]?.skillName;
      return {
        skillId,
        name: typeof name === 'string' ? name : undefined,
        patches,
      };
    })
    .filter((g) => g.patches.length > 0);
});

function formatBlackboard(blackboard: unknown): string {
  return toArray<RecordLike>(blackboard)
    .map((entry) => `${toText(entry.key, '?')} = ${formatScalar(entry.value)}`)
    .join(', ');
}

const potentialEffectEntries = computed(() =>
  Object.entries(potentialEffects.value)
    .map(([key, value]) => {
      const entry = isRecordLike(value) ? value : {};
      const title =
        typeof entry.name === 'string' && entry.name.trim().length > 0 ? entry.name : key;
      const candidate = toArray<RecordLike>(entry.candidates)[0];
      const description =
        entry.desc ?? entry.description ?? candidate?.description ?? candidate?.desc;
      return { key, title, description };
    })
    .filter((entry) => entry.description !== undefined && entry.description !== null),
);

const spaceshipSkills = computed(() => {
  const charSkillTable = isRecordLike(props.detail.spaceshipCharSkillTable)
    ? props.detail.spaceshipCharSkillTable
    : {};
  const skillTable = isRecordLike(props.detail.spaceshipSkillTable)
    ? props.detail.spaceshipSkillTable
    : {};
  const charSkillIds = Object.values(charSkillTable)
    .filter((entry): entry is RecordLike => isRecordLike(entry))
    .flatMap((entry) => toArray<string>(entry.skillIds ?? entry.skillIdList));
  return charSkillIds
    .map((skillId) => {
      const skill = isRecordLike(skillTable[skillId]) ? skillTable[skillId] : {};
      return {
        skillId,
        name: skill.name,
        desc: skill.desc ?? skill.description,
      };
    })
    .filter((s) => s.name || s.desc);
});
</script>
