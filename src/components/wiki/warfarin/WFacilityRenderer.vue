<template>
  <div>
    <section v-if="buildingEntries.length" class="ww__section">
      <h3 class="ww__title">Factory Building Info</h3>
      <WInfoGrid :entries="buildingEntries" />
    </section>

    <section v-if="hasData(buildingTable)" class="ww__section">
      <h3 class="ww__title">Factory Building (Full)</h3>
      <div
        v-if="buildingDescriptionHtml"
        class="ww__panel ww__prose ww__prose--box"
        v-html="buildingDescriptionHtml"
      />

      <WInfoGrid v-if="fullBuildingEntries.length" :entries="fullBuildingEntries" />

      <div v-if="rangeEntries.length" class="ww__panel">
        <div class="ww__panel-sub">Attack / Coverage Range</div>
        <WInfoGrid :entries="rangeEntries" />
      </div>

      <div v-if="capabilityEntries.length" class="ww__panel">
        <div class="ww__panel-sub">Placement And Power</div>
        <WInfoGrid :entries="capabilityEntries" />
      </div>

      <div v-if="assetEntries.length" class="ww__panel">
        <div class="ww__panel-sub">Assets And Scene</div>
        <WInfoGrid :entries="assetEntries" />
      </div>

      <div v-if="limitEntries.length" class="ww__panel">
        <div class="ww__panel-sub">Placement Limits</div>
        <WInfoGrid :entries="limitEntries" />
      </div>
    </section>

    <section v-if="hasData(machineCraftTable)" class="ww__section">
      <h3 class="ww__title">Factory Machine Craft Table</h3>
      <WJsonViewer :value="machineCraftTable" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import WInfoGrid from './shared/WInfoGrid.vue';
import WJsonViewer from './shared/WJsonViewer.vue';
import {
  type RecordLike,
  isRecordLike,
  hasData,
  buildInfoEntries,
  resolveEnumName,
  formatWikiHtml,
} from './utils';
import { facBuildingTypeNames } from './genums';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
}>();

const buildingTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.factoryBuildingTable) ? props.detail.factoryBuildingTable : {},
);
const machineCraftTable = computed(() => props.detail.factoryMachineCraftTable);
const buildingRange = computed<RecordLike>(() =>
  isRecordLike(buildingTable.value.range) ? buildingTable.value.range : {},
);

const buildingDescriptionHtml = computed(() => formatWikiHtml(buildingTable.value.desc));

const buildingEntries = computed(() =>
  buildInfoEntries(buildingTable.value, [
    { key: 'name', label: 'Name' },
    { key: 'id', label: 'ID', mono: true },
    {
      key: 'type',
      label: 'Type',
      format: (v: unknown) => resolveEnumName(facBuildingTypeNames, v as number),
    },
    { key: 'quickBarType', label: 'Quick Bar Type' },
    { key: 'rarity', label: 'Rarity' },
    { key: 'bandwidth', label: 'Bandwidth' },
    { key: 'powerConsume', label: 'Power Consumption' },
    { key: 'needPower', label: 'Needs Power' },
    { key: 'canDelete', label: 'Can Delete' },
    { key: 'canBatchSelect', label: 'Batch Select' },
    { key: 'liquidEnabled', label: 'Liquid Enabled' },
    { key: 'markInfoId', label: 'Mark Info ID', mono: true },
  ]),
);

const fullBuildingEntries = computed(() =>
  buildInfoEntries(buildingTable.value, [
    { key: 'bgOnPanel', label: 'Panel Background', mono: true },
    { key: 'iconOnPanel', label: 'Panel Icon', mono: true },
    { key: 'buildCamState', label: 'Build Camera State', mono: true },
    { key: 'modelHeight', label: 'Model Height' },
    { key: 'roadAttachSide', label: 'Road Attach Side' },
    { key: 'limitType', label: 'Limit Type' },
  ]),
);

const rangeEntries = computed(() =>
  buildInfoEntries(buildingRange.value, [
    { key: 'width', label: 'Width' },
    { key: 'height', label: 'Height' },
    { key: 'depth', label: 'Depth' },
    { key: 'x', label: 'Offset X' },
    { key: 'y', label: 'Offset Y' },
    { key: 'z', label: 'Offset Z' },
  ]),
);

const capabilityEntries = computed(() =>
  buildInfoEntries(buildingTable.value, [
    { key: 'needPower', label: 'Needs Power' },
    { key: 'powerConsume', label: 'Power Consumption' },
    { key: 'canBatchModeTogglePower', label: 'Batch Toggle Power' },
    { key: 'canBatchSelect', label: 'Can Batch Select' },
    { key: 'canDelete', label: 'Can Delete' },
    { key: 'onlyShowOnMain', label: 'Only Show On Main' },
    { key: 'liquidEnabled', label: 'Liquid Enabled' },
  ]),
);

const assetEntries = computed(() =>
  buildInfoEntries(buildingTable.value, [
    { key: 'markInfoId', label: 'Mark Info ID', mono: true },
    { key: 'quickBarType', label: 'Quick Bar Type', mono: true },
    { key: 'delConfirmText', label: 'Delete Confirm Text' },
  ]),
);

const limitEntries = computed(() =>
  [
    {
      label: 'Input Ports',
      value: String(
        Array.isArray(buildingTable.value.inputPorts) ? buildingTable.value.inputPorts.length : 0,
      ),
      mono: false,
    },
    {
      label: 'Output Ports',
      value: String(
        Array.isArray(buildingTable.value.outputPorts) ? buildingTable.value.outputPorts.length : 0,
      ),
      mono: false,
    },
    {
      label: 'Place Domains',
      value: String(
        Array.isArray(buildingTable.value.placeDomains)
          ? buildingTable.value.placeDomains.length
          : 0,
      ),
      mono: false,
    },
    {
      label: 'Recommended Domains',
      value: String(
        Array.isArray(buildingTable.value.recommendDomains)
          ? buildingTable.value.recommendDomains.length
          : 0,
      ),
      mono: false,
    },
    {
      label: 'Domain Limit Rules',
      value: String(
        Array.isArray(buildingTable.value.placeDomainLimitCnt)
          ? buildingTable.value.placeDomainLimitCnt.length
          : 0,
      ),
      mono: false,
    },
  ].filter((entry) => entry.value !== '0'),
);
</script>
