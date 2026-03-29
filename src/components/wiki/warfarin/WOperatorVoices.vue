<template>
  <div>
    <section v-if="profileRecords.length" class="ww__section">
      <h3 class="ww__title">Profile Records / 档案记录</h3>
      <div class="ww__stack">
        <div
          v-for="record in profileRecords"
          :key="toText(record.id, toText(record.recordID, 'record'))"
          class="ww__panel"
        >
          <div class="ww__panel-title">{{ record.recordTitle || 'Record' }}</div>
          <div v-if="record.unlockType || record.unlockValue" class="ww__panel-sub">
            Unlock:
            {{ resolveEnumName(charDocUnlockTypeNames, record.unlockType ?? 0) }}, value
            {{ record.unlockValue ?? 0 }}
          </div>
          <div class="ww__prose" v-html="formatWikiHtml(record.recordDesc)"></div>
        </div>
      </div>
    </section>

    <section v-if="voiceGroups.length" class="ww__section">
      <h3 class="ww__title">Voice Lines / 语音</h3>
      <q-expansion-item
        v-for="group in voiceGroups"
        :key="group.title"
        dense
        expand-separator
        switch-toggle-side
        :label="`${group.title} (${group.items.length})`"
        class="ww__expansion"
      >
        <div class="ww__stack ww__stack--compact">
          <div
            v-for="voice in group.items"
            :key="toText(voice.id, toText(voice.voId, 'voice'))"
            class="ww__panel"
          >
            <div class="ww__panel-title">{{ voice.voiceTitle || 'Voice' }}</div>
            <div class="ww__prose" v-html="formatWikiHtml(voice.voiceDesc)"></div>
            <div v-if="voice.voId" class="ww__panel-sub ww__value--mono">{{ voice.voId }}</div>
          </div>
        </div>
      </q-expansion-item>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  type RecordLike,
  isRecordLike,
  toArray,
  formatWikiHtml,
  resolveEnumName,
  toText,
} from './utils';
import { charDocUnlockTypeNames } from './genums';

const props = defineProps<{
  detail: RecordLike;
}>();

const characterTable = computed<RecordLike | null>(() =>
  isRecordLike(props.detail.characterTable) ? props.detail.characterTable : null,
);

const profileRecords = computed(() => toArray<RecordLike>(characterTable.value?.profileRecord));

const voiceGroups = computed(() => {
  const voices = toArray<RecordLike>(characterTable.value?.profileVoice);
  const groups = new Map<string, RecordLike[]>();
  voices.forEach((voice) => {
    const rawTitle = typeof voice.voiceTitle === 'string' ? voice.voiceTitle.trim() : 'Voice';
    const groupTitle = rawTitle.replace(/\d+$/, '').trim() || rawTitle;
    const bucket = groups.get(groupTitle) ?? [];
    bucket.push(voice);
    groups.set(groupTitle, bucket);
  });
  return Array.from(groups.entries()).map(([title, items]) => ({ title, items }));
});
</script>
