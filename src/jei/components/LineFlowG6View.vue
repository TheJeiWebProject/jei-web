<template>
  <div ref="containerEl" class="line-flow-g6"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Dark } from 'quasar';
import { Graph } from '@antv/g6';
import type { EdgeData, GraphData, NodeData } from '@antv/g6';
import type { Edge, Node } from '@vue-flow/core';
import type { ItemDef, ItemKey } from 'src/jei/types';
import { itemKeyHash } from 'src/jei/indexing/key';
import { isProxyImageUrl } from 'src/jei/pack/runtimeImage';

type NodeDataRecord = {
  title?: string;
  subtitle?: string;
  itemKey?: ItemKey;
  machineItemId?: string;
  outputItemKey?: ItemKey;
  isRoot?: boolean;
  recovery?: boolean;
};

const props = defineProps<{
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  itemDefsByKeyHash: Record<string, ItemDef>;
}>();

const emit = defineEmits<{
  (e: 'update:selected-node-id', id: string | null): void;
  (e: 'node-drag-stop', evt: { node: Node }): void;
}>();

const containerEl = ref<HTMLElement | null>(null);
let graph: Graph | null = null;
let resizeObserver: ResizeObserver | null = null;
let renderToken = 0;
let iconResolveToken = 0;
const resolvedIconByHash = ref(new Map<string, string>());

function finiteOr(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function colorWithAlpha(color: string, alpha: number): string {
  const s = color.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1]!;
    const normalized =
      raw.length === 3 ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}` : raw;
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }
  const rgb = s.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgb) {
    const r = Number(rgb[1] ?? 0);
    const g = Number(rgb[2] ?? 0);
    const b = Number(rgb[3] ?? 0);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }
  return color;
}

function itemColorOfDef(def?: ItemDef): string | null {
  const fromDef = (def as { color?: string } | undefined)?.color?.trim();
  if (fromDef) return fromDef;
  const fromRarity = def?.rarity?.color?.trim();
  if (fromRarity) return fromRarity;
  const fromSprite = def?.iconSprite?.color?.trim();
  if (fromSprite) return fromSprite;
  return null;
}

function resolveCssColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const raw = value.trim();
  const varMatch = raw.match(/^var\((--[^,\s)]+)(?:,\s*([^)]+))?\)$/);
  if (!varMatch) return raw || fallback;
  const varName = varMatch[1]!;
  const fallbackInVar = (varMatch[2] ?? '').trim();
  const computedRoot = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const computedBody = getComputedStyle(document.body).getPropertyValue(varName).trim();
  return computedRoot || computedBody || fallbackInVar || fallback;
}

function parseLineDash(value: unknown): number[] | undefined {
  if (Array.isArray(value)) {
    const arr = value.map((v) => finiteOr(v, 0)).filter((v) => v > 0);
    return arr.length ? arr : undefined;
  }
  if (typeof value !== 'string') return undefined;
  const arr = value
    .split(/[,\s]+/)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  return arr.length ? arr : undefined;
}

function parseSpritePosition(position: string): { x: number; y: number } {
  const nums = Array.from(position.matchAll(/-?\d+(?:\.\d+)?/g)).map((m) => Number(m[0]));
  if (nums.length < 2) return { x: 0, y: 0 };
  return { x: nums[0] ?? 0, y: nums[1] ?? 0 };
}

function normalizeImageUrl(url: string): string {
  if (!isProxyImageUrl(url)) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.delete('access_token');
    parsed.searchParams.delete('anonymous_token');
    parsed.searchParams.delete('framework_token');
    return parsed.toString();
  } catch {
    return url;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

async function loadImageWithFallback(url: string): Promise<HTMLImageElement> {
  try {
    return await loadImage(url);
  } catch {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await loadImage(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

async function resolveDirectIcon(iconUrl: string): Promise<string | null> {
  try {
    const source = await loadImageWithFallback(normalizeImageUrl(iconUrl));
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, 8, 8, 64, 64);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function resolveSpriteIcon(def: ItemDef): Promise<string | null> {
  const sprite = def.iconSprite;
  if (!sprite?.url) return null;
  try {
    const source = await loadImageWithFallback(normalizeImageUrl(sprite.url));
    const { x, y } = parseSpritePosition(sprite.position);
    const size = Math.max(1, Math.round(finiteOr(sprite.size, 64)));
    const sx = x < 0 ? -x : x;
    const sy = y < 0 ? -y : y;
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, sx, sy, size, size, 8, 8, 64, 64);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function ensureResolvedIcons() {
  const token = ++iconResolveToken;
  const next = new Map<string, string>();
  const requiredHashes = new Set<string>();
  props.nodes.forEach((n) => {
    const data = (n.data ?? {}) as NodeDataRecord;
    if (data.itemKey) requiredHashes.add(itemKeyHash(data.itemKey));
    if (data.machineItemId) requiredHashes.add(itemKeyHash({ id: data.machineItemId }));
    if (data.outputItemKey) requiredHashes.add(itemKeyHash(data.outputItemKey));
  });

  await Promise.all(
    Array.from(requiredHashes).map(async (hash) => {
      const def = props.itemDefsByKeyHash[hash];
      if (!def) return;
      if (def.icon) {
        const resolved = await resolveDirectIcon(def.icon);
        next.set(hash, resolved ?? normalizeImageUrl(def.icon));
        return;
      }
      const spriteIcon = await resolveSpriteIcon(def);
      if (spriteIcon) next.set(hash, spriteIcon);
    }),
  );

  if (token !== iconResolveToken) return;
  resolvedIconByHash.value = next;
}

function eventNodeId(event: unknown): string | null {
  const evt = event as { target?: { id?: string }; data?: { id?: string } } | undefined;
  return evt?.target?.id ?? evt?.data?.id ?? null;
}

function nodeIconFromData(data: NodeDataRecord): string | undefined {
  if (data.itemKey) return resolvedIconByHash.value.get(itemKeyHash(data.itemKey));
  if (data.machineItemId)
    return resolvedIconByHash.value.get(itemKeyHash({ id: data.machineItemId }));
  if (data.outputItemKey) return resolvedIconByHash.value.get(itemKeyHash(data.outputItemKey));
  return undefined;
}

type SelectionContext = {
  selectedId: string | null;
  downstreamNodeIds: Set<string>;
  upstreamNodeIds: Set<string>;
  rootItemIds: Set<string>;
  leafItemIds: Set<string>;
};

function buildSelectionContext(selectedId: string | null): SelectionContext {
  const outBySource = new Map<string, string[]>();
  const inByTarget = new Map<string, string[]>();
  const typeById = new Map(props.nodes.map((n) => [n.id, n.type] as const));
  props.nodes.forEach((n) => {
    outBySource.set(n.id, []);
    inByTarget.set(n.id, []);
  });
  props.edges.forEach((e) => {
    (outBySource.get(e.source) ?? []).push(e.target);
    (inByTarget.get(e.target) ?? []).push(e.source);
  });

  const rootItemIds = new Set(
    props.nodes
      .filter((n) => n.type === 'lineItemNode' && ((n.data ?? {}) as NodeDataRecord).isRoot)
      .map((n) => n.id),
  );
  const itemIds = new Set(props.nodes.filter((n) => n.type === 'lineItemNode').map((n) => n.id));
  const incomingFromMachine = new Set<string>();
  props.edges.forEach((e) => {
    if (typeById.get(e.source) === 'lineMachineNode' && itemIds.has(e.target))
      incomingFromMachine.add(e.target);
  });
  const leafItemIds = new Set(Array.from(itemIds).filter((id) => !incomingFromMachine.has(id)));

  const downstreamNodeIds = new Set<string>();
  const upstreamNodeIds = new Set<string>();
  if (!selectedId) {
    return { selectedId, downstreamNodeIds, upstreamNodeIds, rootItemIds, leafItemIds };
  }

  const walkDownstream = (start: string) => {
    const visited = new Set<string>();
    const queue = [start];
    visited.add(start);
    downstreamNodeIds.add(start);
    while (queue.length) {
      const cur = queue.shift()!;
      (outBySource.get(cur) ?? []).forEach((target) => {
        if (!visited.has(target)) {
          visited.add(target);
          downstreamNodeIds.add(target);
          queue.push(target);
        }
      });
    }
  };

  const walkUpstream = (start: string) => {
    const visited = new Set<string>();
    const queue = [start];
    visited.add(start);
    upstreamNodeIds.add(start);
    while (queue.length) {
      const cur = queue.shift()!;
      (inByTarget.get(cur) ?? []).forEach((source) => {
        if (!visited.has(source)) {
          visited.add(source);
          upstreamNodeIds.add(source);
          queue.push(source);
        }
      });
    }
  };

  walkDownstream(selectedId);
  walkUpstream(selectedId);
  return { selectedId, downstreamNodeIds, upstreamNodeIds, rootItemIds, leafItemIds };
}

function toGraphData(): GraphData {
  const isDark = Dark.isActive;
  const selection = buildSelectionContext(props.selectedNodeId);
  const hasSelection = !!selection.selectedId;
  const colorPrimary = resolveCssColor('var(--q-primary)', '#1976d2');
  const colorSecondary = resolveCssColor('var(--q-secondary)', '#26a69a');

  const nodes: NodeData[] = props.nodes.map((n) => {
    const data = (n.data ?? {}) as NodeDataRecord;
    const selected = selection.selectedId === n.id;
    const kind =
      n.type === 'lineMachineNode' ? 'machine' : n.type === 'lineFluidNode' ? 'fluid' : 'item';
    const icon = nodeIconFromData(data);
    const title = data.title ?? n.id;
    const subtitle = data.subtitle ?? '';
    const itemColor =
      (data.itemKey ? itemColorOfDef(props.itemDefsByKeyHash[itemKeyHash(data.itemKey)]) : null) ??
      (data.outputItemKey
        ? itemColorOfDef(props.itemDefsByKeyHash[itemKeyHash(data.outputItemKey)])
        : null);
    const baseFill =
      kind === 'machine'
        ? isDark
          ? '#2d3441'
          : '#eef2f8'
        : kind === 'fluid'
          ? isDark
            ? '#115e73'
            : '#d9f4fb'
          : itemColor
            ? colorWithAlpha(itemColor, isDark ? 0.2 : 0.28)
            : isDark
              ? '#2b3a4f'
              : '#e8f0ff';
    const baseStroke =
      kind === 'fluid'
        ? '#0ea5e9'
        : kind === 'machine'
          ? isDark
            ? '#94a3b8'
            : '#8d99ab'
          : (itemColor ?? (isDark ? '#94a3b8' : '#8d99ab'));
    const inPath = selection.downstreamNodeIds.has(n.id) || selection.upstreamNodeIds.has(n.id);
    const toRoot = selection.rootItemIds.has(n.id) && selection.downstreamNodeIds.has(n.id);
    const fromLeaf = selection.leafItemIds.has(n.id);
    let stroke = baseStroke;
    let lineWidth = 2.2;
    let opacity = 1;
    if (selected) {
      stroke = colorPrimary;
      lineWidth = 3.2;
    } else if (hasSelection && toRoot) {
      stroke = '#7e57c2';
      lineWidth = 2.8;
      opacity = 0.95;
    } else if (hasSelection && inPath) {
      stroke = colorSecondary;
      lineWidth = 2.6;
      opacity = 0.92;
    } else if (hasSelection && fromLeaf) {
      stroke = '#f9a825';
      lineWidth = 2.3;
      opacity = 0.86;
    } else if (hasSelection) {
      lineWidth = 1.5;
      opacity = 0.35;
    }
    const nodeStyle: Record<string, unknown> = {
      x: finiteOr(n.position.x, 0),
      y: finiteOr(n.position.y, 0),
      size: kind === 'fluid' ? 92 : 96,
      fill: baseFill,
      stroke,
      lineWidth,
      opacity,
      shadowColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.14)',
      shadowBlur: selected ? 14 : 10,
      label: true,
      labelText: `${title}\n${subtitle}`,
      labelTextAlign: 'center' as const,
      labelTextBaseline: 'top' as const,
      labelPlacement: 'bottom' as const,
      labelOffsetY: 10,
      labelFontSize: 22,
      labelLineHeight: 20,
      labelFill: isDark ? '#e5e7eb' : '#111827',
      labelMaxWidth: 188,
      labelWordWrap: true,
      icon: !!icon,
      iconWidth: 82,
      iconHeight: 82,
      iconFontSize: 28,
      iconFill: isDark ? '#f8fafc' : '#111827',
    };
    if (kind === 'fluid') {
      nodeStyle.icon = true;
      nodeStyle.iconText = '液';
      nodeStyle.iconFontSize = 30;
      nodeStyle.iconFill = isDark ? '#d1f5ff' : '#0c4a6e';
    } else if (icon) nodeStyle.iconSrc = icon;
    else nodeStyle.iconText = title.slice(0, 1).toUpperCase();
    if (data.recovery && !hasSelection && !selected) {
      nodeStyle.stroke = '#26a69a';
      nodeStyle.lineDash = [6, 3];
    }

    return {
      id: n.id,
      type: 'circle',
      data: { kind },
      style: nodeStyle,
    };
  });

  const edges: EdgeData[] = props.edges.map((e) => {
    const style = (e.style ?? {}) as Record<string, unknown>;
    const strokeWidth = Math.max(1, finiteOr(style.strokeWidth, 2));
    const rawStroke = typeof style.stroke === 'string' ? style.stroke : undefined;
    const stroke = resolveCssColor(rawStroke, isDark ? '#9ca3af' : '#64748b');
    const opacity = Math.max(0.05, Math.min(1, finiteOr(style.opacity, 1)));
    const label = typeof e.label === 'string' ? e.label : '';
    const lineDash = parseLineDash(style.strokeDasharray);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'quadratic',
      style: {
        stroke,
        opacity,
        lineWidth: strokeWidth,
        curveOffset: 0,
        ...(lineDash ? { lineDash } : {}),
        endArrow: true,
        endArrowFill: stroke,
        endArrowSize: Math.max(6, Math.min(22, strokeWidth * 2)),
        label: label.length > 0,
        labelText: label,
        labelFontSize: 14,
        labelLineHeight: 18,
        labelFill: isDark ? '#dbe3ee' : '#334155',
        labelBackground: true,
        labelBackgroundFill: isDark ? 'rgba(17,24,39,0.7)' : 'rgba(255,255,255,0.84)',
        labelPadding: [2, 5],
      },
    };
  });

  return { nodes, edges };
}

async function renderGraph(fitView: boolean) {
  if (!graph) return;
  const token = ++renderToken;
  graph.setData(toGraphData());
  await graph.render();
  if (token !== renderToken) return;
  if (fitView) await graph.fitView();
}

onMounted(() => {
  const el = containerEl.value;
  if (!el) return;
  const width = Math.max(1, Math.floor(el.clientWidth));
  const height = Math.max(1, Math.floor(el.clientHeight));

  graph = new Graph({
    container: el,
    width,
    height,
    animation: false,
    data: toGraphData(),
    transforms: [
      {
        key: 'parallel-edges-line-g6',
        type: 'process-parallel-edges',
        mode: 'bundle',
        distance: 20,
      },
    ],
    node: {
      type: 'circle',
      style: (datum) => (datum.style ?? {}) as Record<string, unknown>,
    },
    edge: {
      type: 'quadratic',
      style: (datum) => (datum.style ?? {}) as Record<string, unknown>,
    },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
  });

  graph.on('node:click', (evt) => {
    emit('update:selected-node-id', eventNodeId(evt));
  });
  graph.on('canvas:click', () => {
    emit('update:selected-node-id', null);
  });
  graph.on('node:dragend', (evt) => {
    const id = eventNodeId(evt);
    if (!id || !graph) return;
    const position = graph.getElementPosition(id);
    emit('node-drag-stop', {
      node: {
        id,
        position: {
          x: finiteOr(position[0], 0),
          y: finiteOr(position[1], 0),
        },
      } as Node,
    });
  });

  void renderGraph(true);
  void ensureResolvedIcons().then(() => renderGraph(false));

  resizeObserver = new ResizeObserver(() => {
    if (!graph || !containerEl.value) return;
    graph.resize(
      Math.max(1, Math.floor(containerEl.value.clientWidth)),
      Math.max(1, Math.floor(containerEl.value.clientHeight)),
    );
  });
  resizeObserver.observe(el);
});

watch(
  () => [props.nodes, props.edges, props.selectedNodeId, props.itemDefsByKeyHash, Dark.isActive],
  () => {
    void renderGraph(false);
    void ensureResolvedIcons().then(() => renderGraph(false));
  },
  { deep: true },
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  graph?.destroy();
  graph = null;
});
</script>

<style scoped>
.line-flow-g6 {
  width: 100%;
  height: 100%;
}
</style>
