<template>
  <div>
    <section v-if="missionEntries.length" class="ww__section">
      <h3 class="ww__title">Mission Info</h3>
      <WInfoGrid :entries="missionEntries" />
    </section>

    <section v-if="missionDesc" class="ww__section">
      <h3 class="ww__title">Description</h3>
      <div class="ww__prose ww__prose--box" v-html="formatWikiHtml(missionDesc)"></div>
    </section>

    <section v-if="quests.length" class="ww__section">
      <h3 class="ww__title">Quests</h3>
      <div class="ww__stack">
        <div v-for="quest in quests" :key="formatScalar(quest.questId)" class="ww__panel">
          <div class="ww__panel-title">Quest: {{ quest.questId }}</div>
          <div v-if="quest.prevQuests.length" class="ww__panel-sub">
            Previous: {{ quest.prevQuests.join(', ') }}
          </div>
          <div v-if="quest.objectives.length" class="ww__muted">
            <div v-for="(obj, oi) in quest.objectives" :key="oi">
              Objective {{ oi + 1 }}: {{ obj.description || '-' }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="dialogs.length" class="ww__section">
      <h3 class="ww__title">Dialog</h3>
      <div class="ww__stack ww__stack--compact">
        <div v-for="(line, i) in dialogs" :key="i" class="ww__panel">
          <div class="ww__panel-title">
            {{ line.actorName || line.actorNameId || 'Unknown' }}
            <span v-if="line.type" class="ww__panel-sub"> · {{ line.type }}</span>
          </div>
          <div class="ww__prose" v-html="formatWikiHtml(line.dialogText)"></div>
          <div v-if="line.optionText" class="ww__muted">Option: {{ line.optionText }}</div>
          <div class="ww__panel-sub ww__value--mono">{{ line.id || '-' }}</div>
        </div>
      </div>
    </section>

    <section v-if="radios.length" class="ww__section">
      <h3 class="ww__title">Radio Messages</h3>
      <q-expansion-item
        v-for="radio in radios"
        :key="formatScalar(radio.radioId)"
        dense
        expand-separator
        switch-toggle-side
        :label="`Radio: ${radio.radioId} (${radio.messages.length} messages)`"
        class="ww__expansion"
      >
        <div class="ww__stack ww__stack--compact">
          <div v-for="(msg, mi) in radio.messages" :key="mi" class="ww__panel">
            <div class="ww__panel-title">{{ msg.actorName || msg.actorNameId || 'Unknown' }}</div>
            <div class="ww__prose" v-html="formatWikiHtml(msg.radioText)"></div>
          </div>
        </div>
      </q-expansion-item>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import WInfoGrid from './shared/WInfoGrid.vue';
import {
  type RecordLike,
  isRecordLike,
  toArray,
  formatWikiHtml,
  formatScalar,
  buildInfoEntries,
  resolveEnumName,
} from './utils';
import { missionTypeNames } from './genums';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
}>();

const mission = computed<RecordLike>(() =>
  isRecordLike(props.detail.mission) ? props.detail.mission : {},
);

const missionEntries = computed(() =>
  buildInfoEntries(mission.value, [
    { key: 'name', label: 'Name' },
    { key: 'id', label: 'ID', mono: true },
    { key: 'typeName', label: 'Type Name' },
    {
      key: 'type',
      label: 'Type',
      format: (v: unknown) => resolveEnumName(missionTypeNames, v),
    },
    { key: 'importance', label: 'Importance' },
    { key: 'charId', label: 'Character ID', mono: true },
    { key: 'levelId', label: 'Level ID', mono: true },
    { key: 'rewardId', label: 'Reward ID', mono: true },
  ]),
);

const missionDesc = computed(() => mission.value.description);

const quests = computed(() =>
  toArray<RecordLike>(props.detail.quests).map((q) => ({
    questId: q.questId || q.id || '-',
    prevQuests: toArray(q.prevQuests).map(String).filter(Boolean),
    objectives: toArray<RecordLike>(q.objectives),
  })),
);

const dialogs = computed(() => toArray<RecordLike>(props.detail.dialog));

const radios = computed(() =>
  toArray<RecordLike>(props.detail.radios).map((r) => ({
    radioId: r.radioId || '-',
    questId: r.questId,
    actionId: r.actionId,
    messages: toArray<RecordLike>(r.messages),
  })),
);
</script>
