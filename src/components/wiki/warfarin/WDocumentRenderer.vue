<template>
  <div>
    <section v-if="docEntries.length" class="ww__section">
      <h3 class="ww__title">Document Info</h3>
      <WInfoGrid :entries="docEntries" />
    </section>

    <section v-if="docDesc" class="ww__section">
      <h3 class="ww__title">Description</h3>
      <div class="ww__prose ww__prose--box" v-html="formatWikiHtml(docDesc)"></div>
    </section>

    <section v-if="hasData(richContentTable)" class="ww__section">
      <h3 class="ww__title">Document Content</h3>
      <WRichContent :content-table="richContentTable" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import WInfoGrid from './shared/WInfoGrid.vue';
import WRichContent from './shared/WRichContent.vue';
import { type RecordLike, isRecordLike, hasData, formatWikiHtml, buildInfoEntries } from './utils';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
}>();

const prtsDocument = computed<RecordLike>(() =>
  isRecordLike(props.detail.prtsDocument) ? props.detail.prtsDocument : {},
);
const richContentTable = computed(() => props.detail.richContentTable);

const docEntries = computed(() =>
  buildInfoEntries(prtsDocument.value, [
    { key: 'name', label: 'Name' },
    { key: 'id', label: 'ID', mono: true },
    { key: 'type', label: 'Type' },
    { key: 'order', label: 'Order' },
    { key: 'firstLvId', label: 'First Level ID', mono: true },
    { key: 'contentId', label: 'Content ID', mono: true },
  ]),
);

const docDesc = computed(() => prtsDocument.value.desc);
</script>
