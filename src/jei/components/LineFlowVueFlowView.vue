<template>
  <VueFlow
    :id="flowId"
    :nodes="nodes"
    :edges="edges"
    :nodes-draggable="true"
    :nodes-connectable="false"
    :elements-selectable="true"
    :zoom-on-double-click="false"
    :min-zoom="0.2"
    :max-zoom="2"
    :pan-on-drag="true"
    no-pan-class-name="nopan"
    no-drag-class-name="nodrag"
    @node-click="onNodeClick"
    @node-drag-start="onNodeDragStart"
    @node-drag-stop="onNodeDragStop"
    @pane-click="emit('update:selected-node-id', null)"
  >
    <Background :gap="20" :pattern-color="flowBackgroundPatternColor" />
    <Controls />
    <MiniMap />
    <template #node-lineItemNode="p">
      <div
        class="planner__flow-node nopan"
        :class="{
          'planner__flow-node--selected': selectedNodeId === p.id,
          'planner__flow-node--recovery': p.data.recovery,
        }"
        @click.stop="emit('update:selected-node-id', p.id)"
      >
        <Handle
          v-for="i in p.data.inPorts"
          :id="`t${i - 1}`"
          :key="`t${i - 1}`"
          type="target"
          :position="Position.Left"
          class="planner__handle"
          :style="{ top: `${(i / (p.data.inPorts + 1)) * 100}%` }"
        />
        <Handle
          v-for="i in p.data.outPorts"
          :id="`s${i - 1}`"
          :key="`s${i - 1}`"
          type="source"
          :position="Position.Right"
          class="planner__handle"
          :style="{ top: `${(i / (p.data.outPorts + 1)) * 100}%` }"
        />
        <div class="planner__flow-node-icon cursor-pointer" @click="emit('item-click', p.data.itemKey)">
          <stack-view
            class="nopan"
            :content="{
              kind: 'item',
              id: p.data.itemKey.id,
              amount: 1,
              ...(p.data.itemKey.meta !== undefined ? { meta: p.data.itemKey.meta } : {}),
              ...(p.data.itemKey.nbt !== undefined ? { nbt: p.data.itemKey.nbt } : {}),
            }"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            variant="slot"
            :show-name="false"
            :show-subtitle="false"
            @item-mouseenter="emit('item-mouseenter', $event)"
            @item-mouseleave="emit('item-mouseleave')"
          />
        </div>
        <div class="planner__flow-node-text" @click.stop="emit('update:selected-node-id', p.id)" @dblclick.stop>
          <div class="planner__flow-node-title">{{ p.data.title }}</div>
          <div class="planner__flow-node-sub">
            {{ p.data.subtitle }}
            <q-badge v-if="p.data.isRoot" color="primary" class="q-ml-xs">目标</q-badge>
            <q-badge v-if="p.data.recovery" color="teal" class="q-ml-xs">
              回收
              <q-tooltip v-if="p.data.recoverySource">{{ p.data.recoverySource }}</q-tooltip>
            </q-badge>
            <q-badge v-if="p.data.forcedRaw" color="warning" class="q-ml-xs">原料</q-badge>
          </div>
        </div>
      </div>
    </template>
    <template #node-lineMachineNode="p">
      <div
        class="planner__flow-node planner__flow-node--machine nopan"
        :class="{ 'planner__flow-node--selected': selectedNodeId === p.id }"
        @click.stop="emit('update:selected-node-id', p.id)"
      >
        <Handle
          v-for="i in p.data.inPorts"
          :id="`t${i - 1}`"
          :key="`t${i - 1}`"
          type="target"
          :position="Position.Left"
          class="planner__handle"
          :style="{ top: p.data.inPorts === 1 ? '50%' : `${((i - 0.5) / p.data.inPorts) * 100}%` }"
        />
        <Handle
          v-for="i in p.data.outPorts"
          :id="`s${i - 1}`"
          :key="`s${i - 1}`"
          type="source"
          :position="Position.Right"
          class="planner__handle"
          :style="{ top: p.data.outPorts === 1 ? '50%' : `${((i - 0.5) / p.data.outPorts) * 100}%` }"
        />
        <div class="planner__flow-node-icon">
          <stack-view
            v-if="p.data.machineItemId"
            class="nopan"
            :content="{ kind: 'item', id: p.data.machineItemId, amount: 1 }"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            variant="slot"
            :show-name="false"
            :show-subtitle="false"
            @item-mouseenter="emit('item-mouseenter', $event)"
            @item-mouseleave="emit('item-mouseleave')"
          />
          <div v-else class="planner__flow-node-icon-fallback">M</div>
        </div>
        <div class="planner__flow-node-text" @click.stop="emit('update:selected-node-id', p.id)" @dblclick.stop>
          <div class="planner__flow-node-title">{{ p.data.title }}</div>
          <div class="planner__flow-node-sub">
            {{ p.data.subtitle }}
            <q-badge v-if="p.data.machineCount" color="accent" class="q-ml-xs">x{{ p.data.machineCount }}</q-badge>
          </div>
        </div>
        <div class="planner__flow-node-icon cursor-pointer" @click="emit('item-click', p.data.outputItemKey)">
          <stack-view
            class="nopan"
            :content="{
              kind: 'item',
              id: p.data.outputItemKey.id,
              amount: 1,
              ...(p.data.outputItemKey.meta !== undefined ? { meta: p.data.outputItemKey.meta } : {}),
              ...(p.data.outputItemKey.nbt !== undefined ? { nbt: p.data.outputItemKey.nbt } : {}),
            }"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            variant="slot"
            :show-name="false"
            :show-subtitle="false"
            @item-mouseenter="emit('item-mouseenter', $event)"
            @item-mouseleave="emit('item-mouseleave')"
          />
        </div>
      </div>
    </template>
    <template #node-lineFluidNode="p">
      <div
        class="planner__flow-node planner__flow-node--fluid nopan"
        :class="{ 'planner__flow-node--selected': selectedNodeId === p.id }"
        @click.stop="emit('update:selected-node-id', p.id)"
      >
        <Handle
          v-for="i in p.data.inPorts"
          :id="`t${i - 1}`"
          :key="`t${i - 1}`"
          type="target"
          :position="Position.Left"
          class="planner__handle"
          :style="{ top: p.data.inPorts === 1 ? '50%' : `${((i - 0.5) / p.data.inPorts) * 100}%` }"
        />
        <Handle
          v-for="i in p.data.outPorts"
          :id="`s${i - 1}`"
          :key="`s${i - 1}`"
          type="source"
          :position="Position.Right"
          class="planner__handle"
          :style="{ top: p.data.outPorts === 1 ? '50%' : `${((i - 0.5) / p.data.outPorts) * 100}%` }"
        />
        <div class="planner__flow-node-text" @click.stop="emit('update:selected-node-id', p.id)" @dblclick.stop>
          <div class="planner__flow-node-title">{{ p.data.title }}</div>
          <div class="planner__flow-node-sub">{{ p.data.subtitle }}</div>
        </div>
      </div>
    </template>
  </VueFlow>
</template>

<script setup lang="ts">
import type { Edge, Node } from '@vue-flow/core';
import { Handle, Position, VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import type { ItemDef, ItemKey } from 'src/jei/types';
import StackView from 'src/jei/components/StackView.vue';

defineProps<{
  flowId: string;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  itemDefsByKeyHash: Record<string, ItemDef>;
  flowBackgroundPatternColor: string;
}>();

const emit = defineEmits<{
  (e: 'update:selected-node-id', id: string | null): void;
  (e: 'node-drag-stop', evt: { node: Node }): void;
  (e: 'item-click', itemKey: ItemKey): void;
  (e: 'item-mouseenter', itemKeyHash: string): void;
  (e: 'item-mouseleave'): void;
}>();

function onNodeClick(evt: { node: Node }) {
  emit('update:selected-node-id', evt.node.id);
}

function onNodeDragStart(evt: { node: Node }) {
  emit('update:selected-node-id', evt.node.id);
}

function onNodeDragStop(evt: { node: Node }) {
  emit('node-drag-stop', evt);
}
</script>

<style scoped>
.planner__flow-node {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  background: #fff;
  min-width: 220px;
  max-width: 320px;
}

.planner__flow-node--selected {
  border-color: var(--q-primary);
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.25);
}

.planner__flow-node--recovery {
  border-color: #26a69a;
  box-shadow: 0 0 0 1px rgba(38, 166, 154, 0.3);
}

.planner__flow-node--fluid {
  min-width: 180px;
}

.planner__flow-node--machine {
  justify-content: space-between;
  gap: 10px;
}

.planner__handle {
  width: 10px !important;
  height: 10px !important;
  background: rgba(0, 0, 0, 0.32) !important;
  border: 1px solid rgba(255, 255, 255, 0.9) !important;
}

.planner__flow-node-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.planner__flow-node-icon-fallback {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.7);
  user-select: none;
}

.planner__flow-node-text {
  min-width: 0;
  flex: 1 1 auto;
}

.planner__flow-node-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.planner__flow-node-sub {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

:deep(.vue-flow__edge-path) {
  stroke-linecap: round;
}

:deep(.vue-flow__node) {
  cursor: default;
}

.body--dark .planner__flow-node {
  background: #1f2937;
  border-color: rgba(255, 255, 255, 0.18);
}

.body--dark .planner__flow-node-sub {
  color: rgba(229, 231, 235, 0.72);
}

.body--dark .planner__flow-node-icon-fallback {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(229, 231, 235, 0.82);
}
</style>
