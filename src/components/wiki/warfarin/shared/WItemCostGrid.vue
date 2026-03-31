<template>
  <div v-if="entries.length" class="ww__cost-grid" :class="{ 'ww__cost-grid--compact': compact }">
    <button
      v-for="entry in entries"
      :key="`${entry.rawId}-${String(entry.count)}`"
      type="button"
      class="ww__cost-card"
      :class="{ 'ww__cost-card--clickable': !!entry.packItemId }"
      @click="handleClick(entry.packItemId)"
    >
      <div class="ww__cost-thumb">
        <img
          v-if="entry.icon"
          :src="entry.icon"
          :alt="entry.name"
          class="ww__cost-image"
        />
        <div v-else class="ww__cost-fallback">{{ entry.name.slice(0, 1) }}</div>
        <div class="ww__cost-count">{{ formatScalar(entry.count) }}</div>
      </div>
      <div class="ww__cost-name">{{ entry.name }}</div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue';
import { formatScalar, type MaterialCostEntry } from '../utils';

defineProps<{
  entries: MaterialCostEntry[];
  compact?: boolean | undefined;
}>();

const navigate = inject<((itemId: string) => void) | undefined>('wikiEntryNavigate', undefined);

function handleClick(itemId: string | undefined): void {
  if (!itemId) return;
  navigate?.(itemId);
}
</script>
