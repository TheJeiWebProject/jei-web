<template>
  <div class="ww">
    <div v-if="!payload" class="ww__empty">No raw data available.</div>

    <template v-else>
      <!-- Operator: 3 tabs + raw -->
      <template v-if="endpoint === 'operators'">
        <q-tabs v-model="activeTab" dense align="left" class="text-primary">
          <q-tab name="overview" label="Overview" />
          <q-tab name="voices" label="Voices / Records" />
          <q-tab name="skills" label="Skills" />
          <q-tab name="raw" label="Raw" />
        </q-tabs>
        <q-separator />
        <q-tab-panels v-model="activeTab" animated>
          <q-tab-panel name="overview">
            <WOperatorOverview
              :detail="payload.detail"
              :list="payload.list"
              :local-name-map="payload.localNameMap"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </q-tab-panel>
          <q-tab-panel name="voices">
            <WOperatorVoices :detail="payload.detail" />
          </q-tab-panel>
          <q-tab-panel name="skills">
            <WOperatorSkills
              :detail="payload.detail"
              :local-name-map="payload.localNameMap"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </q-tab-panel>
          <q-tab-panel name="raw">
            <WJsonViewer :value="payload" />
          </q-tab-panel>
        </q-tab-panels>
      </template>

      <!-- Enemy: has its own tabs internally -->
      <template v-else-if="endpoint === 'enemies'">
        <WEnemyRenderer
          :detail="payload.detail"
          :list="payload.list"
          :refs="payload.refs"
          :local-name-map="payload.localNameMap"
        />
      </template>

      <!-- All other endpoints: overview + raw tabs -->
      <template v-else>
        <q-tabs v-model="activeTab" dense align="left" class="text-primary">
          <q-tab name="overview" label="Overview" />
          <q-tab name="raw" label="Raw" />
        </q-tabs>
        <q-separator />
        <q-tab-panels v-model="activeTab" animated>
          <q-tab-panel name="overview">
            <component
              :is="endpointComponent"
              :detail="payload.detail"
              :list="payload.list"
              :refs="payload.refs"
              :local-name-map="payload.localNameMap"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </q-tab-panel>
          <q-tab-panel name="raw">
            <WJsonViewer :value="payload" />
          </q-tab-panel>
        </q-tab-panels>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue';
import type { ItemDef } from 'src/jei/types';
import WJsonViewer from './shared/WJsonViewer.vue';
import WOperatorOverview from './WOperatorOverview.vue';
import WOperatorVoices from './WOperatorVoices.vue';
import WOperatorSkills from './WOperatorSkills.vue';
import WEnemyRenderer from './WEnemyRenderer.vue';
import WItemRenderer from './WItemRenderer.vue';
import WWeaponRenderer from './WWeaponRenderer.vue';
import WGearRenderer from './WGearRenderer.vue';
import WFacilityRenderer from './WFacilityRenderer.vue';
import WMedalRenderer from './WMedalRenderer.vue';
import WMissionRenderer from './WMissionRenderer.vue';
import WLoreRenderer from './WLoreRenderer.vue';
import WTutorialRenderer from './WTutorialRenderer.vue';
import WDocumentRenderer from './WDocumentRenderer.vue';
import WGenericRenderer from './WGenericRenderer.vue';
import { type WarfarinEndpointType, normalizePayload } from './utils';

const props = defineProps<{
  source: unknown;
  endpoint?: string | undefined;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
}>();

const activeTab = ref('overview');

const payload = computed(() => normalizePayload(props.source));

const endpoint = computed<WarfarinEndpointType>(() => {
  if (props.endpoint) return props.endpoint as WarfarinEndpointType;
  // Try to detect endpoint from data structure
  const detail = payload.value?.detail;
  if (!detail) return 'operators';
  if (detail.characterTable) return 'operators';
  if (detail.displayEnemyInfoTable) return 'enemies';
  if (detail.weaponBasicTable) return 'weapons';
  if (detail.equipTable) return 'gear';
  if (detail.factoryBuildingTable) return 'facilities';
  if (detail.achievementTable) return 'medals';
  if (detail.mission) return 'missions';
  if (detail.wikiTutorialPageTable || detail.wikiTutorialPageByEntryTable) return 'tutorials';
  if (detail.prtsDocument) return 'documents';
  if (detail.richContentTable && !detail.itemTable) return 'lore';
  if (detail.itemTable) return 'items';
  return 'operators';
});

const endpointComponentMap: Record<string, Component> = {
  items: WItemRenderer,
  weapons: WWeaponRenderer,
  gear: WGearRenderer,
  facilities: WFacilityRenderer,
  medals: WMedalRenderer,
  missions: WMissionRenderer,
  lore: WLoreRenderer,
  tutorials: WTutorialRenderer,
  documents: WDocumentRenderer,
};

const endpointComponent = computed<Component>(
  () => endpointComponentMap[endpoint.value] ?? WGenericRenderer,
);
</script>

<style>
/* Shared styles for all warfarin-wiki sub-components (intentionally unscoped) */
.ww {
  --ww-text: rgba(0, 0, 0, 0.88);
  --ww-muted: rgba(0, 0, 0, 0.6);
  --ww-subtle: rgba(0, 0, 0, 0.45);
  --ww-border: rgba(0, 0, 0, 0.12);
  --ww-border-soft: rgba(0, 0, 0, 0.08);
  --ww-surface: rgba(0, 0, 0, 0.03);
  --ww-surface-soft: rgba(0, 0, 0, 0.02);
  --ww-surface-strong: rgba(0, 0, 0, 0.06);
  --ww-surface-hover: rgba(0, 0, 0, 0.08);
  --ww-table-bg: #ffffff;
  --ww-table-head-bg: #f7f7f7;
  --ww-raw-bg: #111827;
  --ww-raw-text: #e5e7eb;
  --ww-code-bg: rgba(0, 0, 0, 0.06);
  --ww-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  color: var(--ww-text);
}

body.body--dark .ww {
  --ww-text: rgba(255, 255, 255, 0.92);
  --ww-muted: rgba(255, 255, 255, 0.72);
  --ww-subtle: rgba(255, 255, 255, 0.52);
  --ww-border: rgba(255, 255, 255, 0.16);
  --ww-border-soft: rgba(255, 255, 255, 0.1);
  --ww-surface: rgba(255, 255, 255, 0.06);
  --ww-surface-soft: rgba(255, 255, 255, 0.04);
  --ww-surface-strong: rgba(255, 255, 255, 0.1);
  --ww-surface-hover: rgba(255, 255, 255, 0.14);
  --ww-table-bg: #1b1f2a;
  --ww-table-head-bg: #252b38;
  --ww-raw-bg: #0f172a;
  --ww-raw-text: rgba(255, 255, 255, 0.88);
  --ww-code-bg: rgba(255, 255, 255, 0.08);
  --ww-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
}

.ww__empty {
  color: var(--ww-muted);
}
.ww__section {
  margin-bottom: 1.5rem;
}
.ww__title {
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--ww-border);
  color: var(--q-primary);
  font-size: 1rem;
  font-weight: 600;
}
.ww__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}
.ww__card,
.ww__panel,
.ww__tag-box {
  background: var(--ww-surface);
  border: 1px solid var(--ww-border);
  border-radius: 8px;
  box-shadow: var(--ww-shadow);
}
.ww__card {
  padding: 1rem;
}
.ww__card--media {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.ww__image {
  width: 100%;
  background: var(--ww-surface-soft);
  border: 1px solid var(--ww-border-soft);
  border-radius: 6px;
  object-fit: cover;
}
.ww__label,
.ww__panel-sub {
  color: var(--ww-muted);
  font-size: 0.75rem;
}
.ww__value,
.ww__panel-title {
  color: var(--ww-text);
  font-size: 0.95rem;
  font-weight: 600;
}
.ww__value--mono {
  font-family: Consolas, 'Courier New', monospace;
  word-break: break-all;
}
.ww__tag-box,
.ww__panel {
  padding: 0.9rem 1rem;
}
.ww__tag-row + .ww__tag-row,
.ww__panel + .ww__panel {
  margin-top: 0.75rem;
}
.ww__tag-label {
  display: inline-block;
  min-width: 5rem;
  color: var(--q-primary);
  font-weight: 600;
}
.ww__stack {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.ww__stack--compact {
  gap: 0.75rem;
}
.ww__prose {
  margin-top: 0.75rem;
  line-height: 1.65;
}
.ww__prose--box {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--ww-surface);
  border-radius: 8px;
}
.ww__prose--small {
  font-size: 0.875rem;
}
.ww__muted {
  margin-top: 0.5rem;
  color: var(--ww-muted);
  font-size: 0.85rem;
  line-height: 1.55;
}
.ww__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.ww__badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: var(--ww-surface-strong);
  color: var(--ww-text);
  border-radius: 4px;
  font-size: 0.85rem;
}
.ww__table-wrap {
  overflow: auto;
}
.ww__table {
  width: 100%;
  border-collapse: collapse;
  background: var(--ww-table-bg);
  color: var(--ww-text);
}
.ww__table--wide {
  min-width: 720px;
}
.ww__table th,
.ww__table td {
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--ww-border);
  text-align: left;
  vertical-align: top;
}
.ww__table th {
  position: sticky;
  top: 0;
  background: var(--ww-table-head-bg);
  z-index: 1;
}
.ww__table tbody tr:nth-child(even) {
  background: var(--ww-surface-soft);
}
.ww__table tbody tr:hover {
  background: var(--ww-surface-hover);
}
.ww__attr-type {
  display: block;
  color: var(--ww-subtle);
  font-size: 0.7rem;
  font-weight: 400;
}
.ww__expansion {
  background: var(--ww-surface-soft);
  border: 1px solid var(--ww-border-soft);
  border-radius: 8px;
  margin-bottom: 0.75rem;
}
.ww__expansion .q-item {
  color: var(--ww-text);
}
.ww__expansion .q-item__label,
.ww__expansion .q-item__section {
  color: inherit;
}
.ww__expansion .q-separator {
  background: var(--ww-border-soft);
}
.ww__raw {
  margin: 0;
  padding: 1rem;
  overflow: auto;
  background: var(--ww-raw-bg);
  color: var(--ww-raw-text);
  border-radius: 8px;
  font-size: 0.75rem;
  line-height: 1.55;
}
.ww__recipe-meta {
  font-size: 0.8rem;
  color: var(--ww-muted);
  margin-top: 0.5rem;
}
.ww__recipe-items {
  color: var(--ww-text);
  font-size: 0.85rem;
  margin-top: 0.25rem;
}
.ww__rich-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.ww__prose,
.ww__prose :where(p, li, strong, em, span, div) {
  color: inherit;
}
.ww__prose p {
  margin: 0.5rem 0;
}
.ww__prose ul,
.ww__prose ol {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
}
.ww__prose code {
  background: var(--ww-code-bg);
  color: inherit;
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
}
.ww__prose pre {
  background: var(--ww-raw-bg);
  color: var(--ww-raw-text);
  border-radius: 8px;
  padding: 0.875rem 1rem;
  overflow: auto;
}
.ww__prose pre code {
  background: transparent;
  padding: 0;
}
.ww__prose a {
  color: var(--q-primary);
  text-decoration-color: var(--ww-muted);
}
.ww__prose a:hover {
  text-decoration-color: currentColor;
}
.ww .q-tab-panels,
.ww .q-tab-panel {
  background: transparent;
  color: var(--ww-text);
}
</style>
