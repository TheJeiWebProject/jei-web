<template>
  <div class="ww__grid">
    <div v-for="entry in entries" :key="entry.label" class="ww__card">
      <div class="ww__label">{{ entry.label }}</div>
      <div class="ww__value" :class="{ 'ww__value--mono': entry.mono }">
        {{ entry.value ?? '-' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  entries: Array<{ label: string; value: unknown; mono?: boolean }>;
}>();
</script>
