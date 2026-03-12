<template>
  <line-flow-vue-flow-view
    v-if="renderer === 'vue_flow'"
    :flow-id="flowId"
    :nodes="nodes"
    :edges="edges"
    :selected-node-id="selectedNodeId"
    :item-defs-by-key-hash="itemDefsByKeyHash"
    :flow-background-pattern-color="flowBackgroundPatternColor"
    @update:selected-node-id="$emit('update:selected-node-id', $event)"
    @node-drag-stop="$emit('node-drag-stop', $event)"
    @item-click="$emit('item-click', $event)"
    @item-mouseenter="$emit('item-mouseenter', $event)"
    @item-mouseleave="$emit('item-mouseleave')"
  />
  <line-flow-g6-view
    v-else
    :nodes="nodes"
    :edges="edges"
    :selected-node-id="selectedNodeId"
    :item-defs-by-key-hash="itemDefsByKeyHash"
    :line-width-scale="lineWidthScale"
    @update:selected-node-id="$emit('update:selected-node-id', $event)"
    @node-drag-stop="$emit('node-drag-stop', $event)"
  />
</template>

<script setup lang="ts">
import type { Edge, Node } from '@vue-flow/core';
import type { ItemDef, ItemKey } from 'src/jei/types';
import LineFlowVueFlowView from 'src/jei/components/LineFlowVueFlowView.vue';
import LineFlowG6View from 'src/jei/components/LineFlowG6View.vue';

defineProps<{
  renderer: 'vue_flow' | 'g6';
  flowId: string;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  itemDefsByKeyHash: Record<string, ItemDef>;
  flowBackgroundPatternColor: string;
  lineWidthScale: number;
}>();

defineEmits<{
  (e: 'update:selected-node-id', id: string | null): void;
  (e: 'node-drag-stop', evt: { node: Node }): void;
  (e: 'item-click', itemKey: ItemKey): void;
  (e: 'item-mouseenter', itemKeyHash: string): void;
  (e: 'item-mouseleave'): void;
}>();
</script>
