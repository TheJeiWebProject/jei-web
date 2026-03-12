<template>
  <div ref="containerEl" class="quant-sankey">
    <svg ref="svgEl" class="quant-sankey__svg" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Dark } from 'quasar';
import { drag, select, zoom, type D3DragEvent, type D3ZoomEvent } from 'd3';
import type { ItemDef, ItemKey } from 'src/jei/types';
import type { QuantFlowEdge, QuantFlowNode } from 'src/jei/planner/quantFlow';
import { itemKeyHash } from 'src/jei/indexing/key';
import {
  sankey,
  sankeyJustify,
  sankeyLinkHorizontal,
  sankeyLinkLoop,
  type SankeyGraph,
  type SankeyGraphMinimal,
  type SankeyLayout,
  type SankeyLink,
  type SankeyLinkExtraProperties,
  type SankeyNode,
  type SankeyNodeExtraProperties,
} from 'src/jei/sankey-lib';
import { coalesce } from 'src/jei/sankey-lib/utils';

type DisplayUnit = 'items' | 'per_second' | 'per_minute' | 'per_hour';

type SankeyNodeDatum = SankeyNodeExtraProperties & {
  id: string;
  kind: 'item' | 'fluid';
  name: string;
  color: string;
  href?: string;
  itemKey?: ItemKey;
};

type SankeyLinkDatum = SankeyLinkExtraProperties & {
  id: string;
  source: string;
  target: string;
  value: number;
  color: string;
  name: string;
  text: string;
  recovery?: true;
};

const NODE_WIDTH = 32;

const props = withDefaults(
  defineProps<{
    model: { nodes: QuantFlowNode[]; edges: QuantFlowEdge[] };
    itemDefsByKeyHash: Record<string, ItemDef>;
    displayUnit: DisplayUnit;
    widthByRate: boolean;
    lineWidthScale: number;
  }>(),
  {
    widthByRate: true,
    lineWidthScale: 1,
  },
);

const emit = defineEmits<{
  (e: 'item-click', itemKey: ItemKey): void;
  (e: 'item-mouseenter', keyHash: string): void;
  (e: 'item-mouseleave'): void;
}>();

const containerEl = ref<HTMLElement | null>(null);
const svgEl = ref<SVGSVGElement | null>(null);

let resizeObserver: ResizeObserver | null = null;
let renderToken = 0;
let iconResolveToken = 0;
let sankeyLayoutRef:
  | SankeyLayout<SankeyGraphMinimal<SankeyNodeDatum, SankeyLinkDatum>, SankeyNodeDatum, SankeyLinkDatum>
  | undefined;
let currentGraph: SankeyGraph<SankeyNodeDatum, SankeyLinkDatum> | undefined;
const resolvedIconByHash = ref(new Map<string, string>());

function finiteOr(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatAmount(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}

function displayRateFromAmount(amountPerMinute: number, unit: DisplayUnit): number {
  if (unit === 'items') return amountPerMinute;
  if (unit === 'per_second') return amountPerMinute / 60;
  if (unit === 'per_hour') return amountPerMinute * 60;
  return amountPerMinute;
}

function unitSuffix(unit: DisplayUnit): string {
  if (unit === 'items') return '';
  if (unit === 'per_second') return '/s';
  if (unit === 'per_hour') return '/h';
  return '/min';
}

function edgeItemName(edge: QuantFlowEdge): string {
  if (edge.kind === 'item') {
    const def = props.itemDefsByKeyHash[itemKeyHash(edge.itemKey)];
    return def?.name ?? edge.itemKey.id;
  }
  return edge.fluidId;
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

function colorWithAlpha(color: string, alpha: number): string {
  const s = color.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1]!;
    const normalized = raw.length === 3 ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}` : raw;
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }
  return color;
}

function parseSpritePosition(position: string): { x: number; y: number } {
  const nums = Array.from(position.matchAll(/-?\d+(?:\.\d+)?/g)).map((m) => Number(m[0]));
  if (nums.length < 2) return { x: 0, y: 0 };
  return { x: nums[0] ?? 0, y: nums[1] ?? 0 };
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

async function resolveSpriteIcon(def: ItemDef): Promise<string | null> {
  const sprite = def.iconSprite;
  if (!sprite?.url) return null;
  try {
    const source = await loadImageWithFallback(sprite.url);
    const { x, y } = parseSpritePosition(sprite.position);
    const size = Math.max(1, Math.round(finiteOr(sprite.size, 64)));
    const sx = x < 0 ? -x : x;
    const sy = y < 0 ? -y : y;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, 64, 64);
    if (sprite.color) {
      ctx.fillStyle = sprite.color;
      ctx.fillRect(0, 0, 64, 64);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, sx, sy, size, size, 0, 0, 64, 64);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function ensureResolvedIcons(): Promise<void> {
  const token = ++iconResolveToken;
  const next = new Map<string, string>();
  const hashes = new Set<string>();
  props.model.nodes.forEach((node) => {
    if (node.kind === 'item') hashes.add(itemKeyHash(node.itemKey));
  });

  await Promise.all(
    Array.from(hashes).map(async (hash) => {
      const def = props.itemDefsByKeyHash[hash];
      if (!def) return;
      if (def.icon) {
        next.set(hash, def.icon);
        return;
      }
      const icon = await resolveSpriteIcon(def);
      if (icon) next.set(hash, icon);
    }),
  );

  if (token !== iconResolveToken) return;
  resolvedIconByHash.value = next;
}

function nodeHeight(node: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>): number {
  return coalesce(node.y1, 0) - coalesce(node.y0, 0);
}

function getLayout(
  data: SankeyGraphMinimal<SankeyNodeDatum, SankeyLinkDatum>,
  width: number,
  height: number,
): SankeyGraph<SankeyNodeDatum, SankeyLinkDatum> {
  sankeyLayoutRef = sankey<SankeyNodeDatum, SankeyLinkDatum>()
    .nodeId((d) => d.id)
    .nodeWidth(NODE_WIDTH)
    .nodeAlign(sankeyJustify)
    .extent([
      [1, 5],
      [width - 1, height - 5],
    ]);

  return sankeyLayoutRef({
    nodes: data.nodes
      .filter((n) => data.links.some((l) => l.source === n.id || l.target === n.id))
      .map((n) => ({ ...n })),
    links: data.links.map((l) => ({ ...l })),
  });
}

function edgePathId(link: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>): string {
  const raw = String(link.id ?? link.index ?? 'link');
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `quant-sankey-link-${safe}`;
}

function pathForLink(
  link: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>,
): string {
  if (link.direction === 'forward') {
    return sankeyLinkHorizontal<SankeyNodeDatum, SankeyLinkDatum>()(link) ?? '';
  }
  const source = link.source as SankeyNode<SankeyNodeDatum, SankeyLinkDatum>;
  const target = link.target as SankeyNode<SankeyNodeDatum, SankeyLinkDatum>;
  return (
    sankeyLinkLoop<SankeyNodeDatum, SankeyLinkDatum>(
      coalesce(link.width, 0),
      NODE_WIDTH,
      source.y1,
      target.y1,
    )(link) ?? ''
  );
}

function toFlowData(): SankeyGraphMinimal<SankeyNodeDatum, SankeyLinkDatum> {
  const isDark = Dark.isActive;
  const nodes: SankeyNodeDatum[] = props.model.nodes.map((node) => {
    if (node.kind === 'item') {
      const hash = itemKeyHash(node.itemKey);
      const def = props.itemDefsByKeyHash[hash];
      const color = itemColorOfDef(def);
      const href = resolvedIconByHash.value.get(hash) ?? def?.icon;
      return {
        id: node.nodeId,
        kind: 'item',
        itemKey: node.itemKey,
        name: def?.name ?? node.itemKey.id,
        color: color ? colorWithAlpha(color, isDark ? 0.52 : 0.65) : isDark ? '#4b5563' : '#94a3b8',
        ...(href ? { href } : {}),
      };
    }
    return {
      id: node.nodeId,
      kind: 'fluid',
      name: node.id,
      color: isDark ? '#0f4c64' : '#7dd3fc',
    };
  });

  const widthScale = Math.max(0.1, finiteOr(props.lineWidthScale, 1));
  const links: SankeyLinkDatum[] = props.model.edges
    .map((edge) => {
      const isRecovery = edge.kind === 'item' && edge.recovery === true;
      const edgeColor =
        isRecovery
          ? '#26a69a'
          : edge.kind === 'item'
          ? itemColorOfDef(props.itemDefsByKeyHash[itemKeyHash(edge.itemKey)]) ??
            (isDark ? '#9ca3af' : '#64748b')
          : isDark
            ? '#67e8f9'
            : '#0284c7';
      const rawAmount = Math.max(0, finiteOr(edge.amount, 0));
      const value = props.widthByRate ? Math.max(0.0001, rawAmount * widthScale) : 1;
      const rateText = `${formatAmount(displayRateFromAmount(rawAmount, props.displayUnit))}${unitSuffix(props.displayUnit)}${edge.kind === 'fluid' ? (edge.unit ?? '') : ''}`;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        value,
        color: edgeColor,
        name: edgeItemName(edge),
        text: `${rateText}${isRecovery ? ' ♻' : ''}`,
        ...(isRecovery ? { recovery: true as const } : {}),
      };
    })
    .filter((l) => l.value > 0);

  return { nodes, links };
}

function rebuildChart(): void {
  const container = containerEl.value;
  const svgDom = svgEl.value;
  if (!container || !svgDom) return;

  const data = toFlowData();
  const viewportWidth = Math.max(1, Math.floor(container.clientWidth));
  const viewportHeight = Math.max(1, Math.floor(container.clientHeight));

  const svg = select(svgDom);
  svg.selectAll('*').remove();

  if (!data.nodes.length || !data.links.length) {
    svg.attr('viewBox', '0 0 1 1');
    return;
  }

  let graph = getLayout(data, 800, viewportHeight);
  const columns = Math.max(...graph.nodes.map((d) => coalesce(d.depth, 0)));
  const width = Math.max(viewportWidth, (columns + 1) * NODE_WIDTH + columns * NODE_WIDTH * 8);
  const height = Math.max(120, Math.min(viewportHeight, width * 0.75));
  graph = getLayout(data, width, height);
  currentGraph = graph;

  svg.attr('viewBox', `0 0 ${width} ${height}`);

  const viewport = svg.append('g').attr('class', 'quant-sankey__viewport');
  svg.call(
    zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 5])
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        viewport.attr('transform', event.transform.toString());
      }),
  );

  const linkLayer = viewport
    .append('g')
    .attr('fill', 'none')
    .attr('stroke-opacity', 0.65)
    .style('will-change', 'opacity')
    .selectAll('g')
    .data(graph.links)
    .join('g')
    .style('mix-blend-mode', 'multiply');

  const linkPath = linkLayer
    .append('path')
    .attr('id', (l: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>) => edgePathId(l))
    .attr('d', (l: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>) => pathForLink(l))
    .attr('stroke', (l: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>) => l.color)
    .attr(
      'stroke-width',
      (l: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>) => Math.max(1, coalesce(l.width, 0)),
    )
    .attr(
      'stroke-dasharray',
      (l: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>) => (l.recovery ? '6 4' : null),
    );

  linkLayer
    .append('title')
    .text((l: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>) => `${l.text} ${l.name}`);

  viewport
    .append('g')
    .selectAll('text')
    .data(graph.links)
    .join('text')
    .attr('class', 'quant-sankey__edge-label')
    .append('textPath')
    .attr('startOffset', '4px')
    .attr('href', (l: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>) => `#${edgePathId(l)}`)
    .text((l: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>) => `${l.text} ${l.name}`);

  const nodeRect = viewport
    .append('g')
    .attr('stroke', 'rgba(148,163,184,0.72)')
    .selectAll<SVGRectElement, SankeyNode<SankeyNodeDatum, SankeyLinkDatum>>('rect')
    .data(graph.nodes)
    .join('rect')
    .attr('x', (d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => coalesce(d.x0, 0))
    .attr('y', (d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => coalesce(d.y0, 0))
    .attr('height', (d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => nodeHeight(d))
    .attr(
      'width',
      (d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => coalesce(d.x1, 0) - coalesce(d.x0, 0),
    )
    .attr('fill', (d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => d.color)
    .attr('rx', 2)
    .style(
      'cursor',
      (d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => (d.kind === 'item' ? 'pointer' : 'default'),
    )
    .on('click', (event: MouseEvent, d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => {
      if (event.defaultPrevented) return;
      if (d.kind !== 'item' || !d.itemKey) return;
      emit('item-click', d.itemKey);
    })
    .on('mouseenter', (_event: MouseEvent, d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => {
      if (d.kind !== 'item' || !d.itemKey) return;
      emit('item-mouseenter', itemKeyHash(d.itemKey));
    })
    .on('mouseleave', () => {
      emit('item-mouseleave');
    })
    .call(
      drag<SVGRectElement, SankeyNode<SankeyNodeDatum, SankeyLinkDatum>>()
        .subject((_event: MouseEvent, d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => d)
        .on(
          'drag',
          function onDrag(
            this: SVGRectElement,
            event: D3DragEvent<
              SVGRectElement,
              SankeyNode<SankeyNodeDatum, SankeyLinkDatum>,
              SankeyNode<SankeyNodeDatum, SankeyLinkDatum>
            >,
            d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>,
          ) {
          d.y0 = coalesce(d.y0, 0) + event.dy;
          d.y1 = coalesce(d.y1, 0) + event.dy;
          d.x0 = coalesce(d.x0, 0) + event.dx;
          d.x1 = coalesce(d.x1, 0) + event.dx;
          select(this)
            .attr('x', d.x0)
            .attr('y', d.y0);

          if (sankeyLayoutRef && currentGraph) sankeyLayoutRef.update(currentGraph);

          linkPath.attr('d', (l: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>) => pathForLink(l));
          nodeImage
            .attr('width', (n: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => Math.min(30, Math.max(0, nodeHeight(n) - 2)))
            .attr('height', (n: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => Math.min(30, Math.max(0, nodeHeight(n) - 2)))
            .attr(
              'x',
              (n: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) =>
                (coalesce(n.x0, 0) + coalesce(n.x1, 0)) / 2 -
                Math.min(30, Math.max(0, nodeHeight(n) - 2)) / 2,
            )
            .attr(
              'y',
              (n: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) =>
                (coalesce(n.y0, 0) + coalesce(n.y1, 0)) / 2 -
                Math.min(30, Math.max(0, nodeHeight(n) - 2)) / 2,
            );
          },
        ),
    );
  nodeRect.append('title').text((d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => d.name);

  const nodeImage = viewport
    .append('g')
    .selectAll<SVGImageElement, SankeyNode<SankeyNodeDatum, SankeyLinkDatum>>('image')
    .data(
      graph.nodes.filter(
        (d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => nodeHeight(d) >= 16 && !!d.href,
      ),
    )
    .join('image')
    .attr('href', (d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => d.href ?? '')
    .attr('width', (d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => Math.min(30, nodeHeight(d) - 2))
    .attr('height', (d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) => Math.min(30, nodeHeight(d) - 2))
    .attr(
      'x',
      (d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) =>
        (coalesce(d.x0, 0) + coalesce(d.x1, 0)) / 2 -
        Math.min(30, nodeHeight(d) - 2) / 2,
    )
    .attr(
      'y',
      (d: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>) =>
        (coalesce(d.y0, 0) + coalesce(d.y1, 0)) / 2 -
        Math.min(30, nodeHeight(d) - 2) / 2,
    )
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('pointer-events', 'none');
}

async function renderAll(): Promise<void> {
  const token = ++renderToken;
  rebuildChart();
  await ensureResolvedIcons();
  if (token !== renderToken) return;
  rebuildChart();
}

onMounted(() => {
  void renderAll();
  if (containerEl.value) {
    resizeObserver = new ResizeObserver(() => {
      void renderAll();
    });
    resizeObserver.observe(containerEl.value);
  }
});

watch(
  () => [props.model, props.itemDefsByKeyHash, props.displayUnit, props.widthByRate, props.lineWidthScale, Dark.isActive],
  () => {
    void renderAll();
  },
  { deep: true },
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<style scoped>
.quant-sankey {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.quant-sankey__svg {
  display: block;
  width: 100%;
  height: 100%;
}

.quant-sankey :deep(.quant-sankey__edge-label) {
  font-size: 15px;
  fill: rgba(229, 231, 235, 0.92);
  paint-order: stroke;
  stroke: rgba(15, 23, 42, 0.5);
  stroke-width: 2px;
  pointer-events: none;
}

.body--dark .quant-sankey :deep(.quant-sankey__edge-label) {
  fill: rgba(229, 231, 235, 0.92);
  stroke: rgba(15, 23, 42, 0.7);
}

.body--light .quant-sankey :deep(.quant-sankey__edge-label) {
  fill: rgba(51, 65, 85, 0.9);
  stroke: rgba(255, 255, 255, 0.85);
}
</style>
