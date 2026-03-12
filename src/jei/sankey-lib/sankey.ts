// Adapted from factoriolab-zmd d3-sankey implementation (MIT License).
import { max, min, sum } from 'd3';

import { sankeyJustify } from './align';
import { constant } from './constant';
import { minFAS } from './min-fas';
import type {
  SankeyGraph,
  SankeyGraphMinimal,
  SankeyLayout,
  SankeyLink,
  SankeyLinkExtraProperties,
  SankeyNode,
  SankeyNodeExtraProperties,
} from './models';
import { coalesce } from './utils';

export function ascendingSourceBreadth<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(a: SankeyLink<N, L>, b: SankeyLink<N, L>): number {
  return (
    ascendingBreadth(
      a.source as SankeyNode<N, L>,
      b.source as SankeyNode<N, L>,
    ) || a.index - b.index
  );
}

function ascendingTargetBreadth<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(a: SankeyLink<N, L>, b: SankeyLink<N, L>): number {
  return (
    ascendingBreadth(
      a.target as SankeyNode<N, L>,
      b.target as SankeyNode<N, L>,
    ) || a.index - b.index
  );
}

function ascendingBreadth<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(a: SankeyNode<N, L>, b: SankeyNode<N, L>): number {
  return a.y0 - b.y0;
}

function value<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(d: SankeyNode<N, L> | SankeyLink<N, L>): number {
  return d.value;
}

export function defaultId<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(d: SankeyNode<N, L>): number | string {
  return d.index;
}

export function defaultNodes<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(graph: SankeyGraph<N, L>): SankeyNode<N, L>[] {
  return graph.nodes;
}

export function defaultLinks<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(graph: SankeyGraph<N, L>): SankeyLink<N, L>[] {
  return graph.links;
}

export function find<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(
  nodeById: Map<string | number, SankeyNode<N, L>>,
  id: string | number,
): SankeyNode<N, L> {
  const node = nodeById.get(id);
  if (!node) throw new Error(`missing: ${String(id)}`);
  return node;
}

function computeLinkBreadths<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>({ nodes }: { nodes: SankeyNode<N, L>[] }): void {
  for (const node of nodes) {
    let y0 = node.y0;
    let y1 = y0;
    for (const link of node.sourceLinks) {
      link.y0 = y0 + link.width / 2;
      y0 += link.width;
    }
    for (const link of node.targetLinks) {
      link.y1 = y1 + link.width / 2;
      y1 += link.width;
    }
  }
}

function num(n: number | undefined): number {
  return coalesce(n, 0);
}

export function sankey<
  N extends SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties,
>(): SankeyLayout<SankeyGraphMinimal<N, L>, N, L> {
  let x0 = 0;
  let y0 = 0;
  let x1 = 1;
  let y1 = 1;
  let nodeWidthValue = 24;
  let nodePaddingValue = 8;
  let nodeIdValue = defaultId<N, L>;
  let nodeAlignValue = sankeyJustify<N, L>;
  let nodeSortValue:
    | ((a: SankeyNode<N, L>, b: SankeyNode<N, L>) => number)
    | undefined;
  let linkSortValue:
    | ((a: SankeyLink<N, L>, b: SankeyLink<N, L>) => number)
    | undefined;
  let nodesValue = defaultNodes<N, L>;
  let linksValue = defaultLinks<N, L>;
  let iterationsValue = 6;

  function sankeyFn(data: SankeyGraph<N, L>): SankeyGraph<N, L> {
    const graph: SankeyGraph<N, L> = {
      nodes: [...data.nodes],
      links: [...data.links],
    };
    computeNodeLinks(graph);
    computeNodeValues(graph);
    computeReversedLinks(graph);
    computeNodeDepths(graph);
    computeNodeHeights(graph);
    computeNodeBreadths(graph);
    computeLinkBreadths(graph);
    return graph;
  }

  type Layout = SankeyLayout<SankeyGraphMinimal<N, L>, N, L>;
  const sankeyLayout = sankeyFn as unknown as Layout;

  sankeyLayout.update = function update(graph: SankeyGraph<N, L>): SankeyGraph<N, L> {
    computeLinkBreadths(graph);
    return graph;
  };

  sankeyLayout.nodeId = function nodeId(
    fn?: (node: SankeyNode<N, L>) => string | number,
  ):
    | ((node: SankeyNode<N, L>) => string | number)
    | Layout {
    if (fn == null) return nodeIdValue;
    nodeIdValue = fn;
    return sankeyLayout;
  } as Layout['nodeId'];

  sankeyLayout.nodeAlign = function nodeAlign(
    fn?: (node: SankeyNode<N, L>, n: number) => number,
  ):
    | ((node: SankeyNode<N, L>, n: number) => number)
    | Layout {
    if (fn == null) return nodeAlignValue;
    nodeAlignValue = fn;
    return sankeyLayout;
  } as Layout['nodeAlign'];

  sankeyLayout.nodeSort = function nodeSort(
    compare?: ((a: SankeyNode<N, L>, b: SankeyNode<N, L>) => number) | null,
  ):
    | ((a: SankeyNode<N, L>, b: SankeyNode<N, L>) => number)
    | undefined
    | Layout {
    if (compare == null) return nodeSortValue;
    nodeSortValue = compare;
    return sankeyLayout;
  } as Layout['nodeSort'];

  sankeyLayout.nodeWidth = function nodeWidth(width?: number): number | Layout {
    if (width == null) return nodeWidthValue;
    nodeWidthValue = width;
    return sankeyLayout;
  } as Layout['nodeWidth'];

  sankeyLayout.nodePadding = function nodePadding(
    padding?: number,
  ): number | Layout {
    if (padding == null) return nodePaddingValue;
    nodePaddingValue = padding;
    return sankeyLayout;
  } as Layout['nodePadding'];

  sankeyLayout.nodes = function nodes(
    nodesInput?:
      | SankeyNode<N, L>[]
      | ((data: SankeyGraph<N, L>) => SankeyNode<N, L>[]),
  ):
    | ((data: SankeyGraph<N, L>) => SankeyNode<N, L>[])
    | Layout {
    if (nodesInput == null) return nodesValue;
    nodesValue = typeof nodesInput === 'function' ? nodesInput : constant(nodesInput);
    return sankeyLayout;
  } as Layout['nodes'];

  sankeyLayout.links = function links(
    linksInput?:
      | SankeyLink<N, L>[]
      | ((data: SankeyGraph<N, L>) => SankeyLink<N, L>[]),
  ):
    | ((data: SankeyGraph<N, L>) => SankeyLink<N, L>[])
    | Layout {
    if (linksInput == null) return linksValue;
    linksValue = typeof linksInput === 'function' ? linksInput : constant(linksInput);
    return sankeyLayout;
  } as Layout['links'];

  sankeyLayout.linkSort = function linkSort(
    compare?: ((a: SankeyLink<N, L>, b: SankeyLink<N, L>) => number) | null,
  ):
    | ((a: SankeyLink<N, L>, b: SankeyLink<N, L>) => number)
    | undefined
    | Layout {
    if (compare == null) return linkSortValue;
    linkSortValue = compare;
    return sankeyLayout;
  } as Layout['linkSort'];

  sankeyLayout.size = function size(sz?: [number, number]): [number, number] | Layout {
    if (sz == null) return [x1 - x0, y1 - y0];
    x0 = 0;
    y0 = 0;
    [x1, y1] = sz;
    return sankeyLayout;
  } as Layout['size'];

  sankeyLayout.extent = function extent(
    ext?: [[number, number], [number, number]],
  ): [[number, number], [number, number]] | Layout {
    if (ext == null) {
      return [
        [x0, y0],
        [x1, y1],
      ];
    }
    [[x0, y0], [x1, y1]] = ext;
    return sankeyLayout;
  } as Layout['extent'];

  sankeyLayout.iterations = function iterations(iter?: number): number | Layout {
    if (iter == null) return iterationsValue;
    iterationsValue = iter;
    return sankeyLayout;
  } as Layout['iterations'];

  function computeNodeLinks({ nodes, links }: SankeyGraph<N, L>): void {
    for (const [i, node] of nodes.entries()) {
      node.index = i;
      node.sourceLinks = [];
      node.targetLinks = [];
    }
    const nodeById = new Map(nodes.map((d) => [nodeIdValue(d), d] as const));
    for (const [i, link] of links.entries()) {
      link.index = i;
      let { source, target } = link;
      if (typeof source !== 'object') source = link.source = find(nodeById, source);
      if (typeof target !== 'object') target = link.target = find(nodeById, target);
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    }
  }

  function computeNodeValues({ nodes }: SankeyGraph<N, L>): void {
    for (const node of nodes) {
      node.value = Math.max(
        sum(node.sourceLinks, value),
        sum(node.targetLinks, value),
      );
    }
  }

  function computeReversedLinks(graph: SankeyGraph<N, L>): void {
    minFAS(graph);
  }

  function computeNodeDepths({ nodes }: SankeyGraph<N, L>): void {
    const n = nodes.length;
    let current = new Set(nodes);
    let next = new Set<SankeyNode<N, L>>();
    let x = 0;
    while (current.size) {
      for (const node of current) {
        node.depth = x;
        for (const { target, direction } of node.sourceLinks) {
          if (direction === 'forward') next.add(target as SankeyNode<N, L>);
        }
      }
      if (++x > n) throw new Error('circular link');
      current = next;
      next = new Set();
    }
  }

  function computeNodeHeights({ nodes }: SankeyGraph<N, L>): void {
    const n = nodes.length;
    let current = new Set(nodes);
    let next = new Set<SankeyNode<N, L>>();
    let x = 0;
    while (current.size) {
      for (const node of current) {
        node.height = x;
        for (const { source, direction } of node.targetLinks) {
          if (direction === 'forward') next.add(source as SankeyNode<N, L>);
        }
      }
      if (++x > n) throw new Error('circular link');
      current = next;
      next = new Set();
    }
  }

  function computeNodeLayers({ nodes }: SankeyGraph<N, L>): SankeyNode<N, L>[][] {
    const x = num(max(nodes, (d: SankeyNode<N, L>) => d.depth)) + 1;
    const kx = (x1 - x0 - nodeWidthValue) / (x - 1);
    const columns = new Array<SankeyNode<N, L>[]>(x);
    for (const node of nodes) {
      const i = Math.max(
        0,
        Math.min(x - 1, Math.floor(nodeAlignValue.call(null, node, x))),
      );
      node.layer = i;
      node.x0 = x0 + i * kx;
      node.x1 = node.x0 + nodeWidthValue;
      if (columns[i]) columns[i].push(node);
      else columns[i] = [node];
    }
    if (nodeSortValue) {
      for (const column of columns) column.sort(nodeSortValue);
    }
    return columns;
  }

  function initializeNodeBreadths(columns: SankeyNode<N, L>[][]): number {
    let ky = min(
      columns,
      (c: SankeyNode<N, L>[]) =>
        (y1 - y0 - (c.length - 1) * nodePaddingValue) / sum(c, value),
    );
    ky = coalesce(ky, 0);
    for (const nodes of columns) {
      let y = y0;
      for (const node of nodes) {
        node.y0 = y;
        node.y1 = y + node.value * ky;
        y = node.y1 + nodePaddingValue;
        for (const link of node.sourceLinks) link.width = link.value * ky;
      }
      y = (y1 - y + nodePaddingValue) / (nodes.length + 1);
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i]!;
        node.y0 += y * (i + 1);
        node.y1 += y * (i + 1);
      }
      reorderLinks(nodes);
    }
    return y1;
  }

  function computeNodeBreadths(graph: SankeyGraph<N, L>): void {
    const columns = computeNodeLayers(graph);
    const yBottom = initializeNodeBreadths(columns);
    for (let i = 0; i < iterationsValue; i += 1) {
      const alpha = Math.pow(0.99, i);
      const beta = Math.max(1 - alpha, (i + 1) / iterationsValue);
      relaxRightToLeft(columns, alpha, beta, yBottom);
      relaxLeftToRight(columns, alpha, beta, yBottom);
    }
  }

  function relaxLeftToRight(
    columns: SankeyNode<N, L>[][],
    alpha: number,
    beta: number,
    yBottom: number,
  ): void {
    for (let i = 1, n = columns.length; i < n; i += 1) {
      const column = columns[i]!;
      for (const target of column) {
        let y = 0;
        let w = 0;
        for (const { source, value: linkValue } of target.targetLinks) {
          const v = linkValue * (num(target.layer) - num((source as SankeyNode<N, L>).layer));
          y += targetTop(source as SankeyNode<N, L>, target) * v;
          w += v;
        }
        if (!(w > 0)) continue;
        const dy = (y / w - target.y0) * alpha;
        target.y0 += dy;
        target.y1 += dy;
        reorderNodeLinks(target);
      }
      if (nodeSortValue === undefined) column.sort(ascendingBreadth);
      resolveCollisions(column, beta, yBottom);
    }
  }

  function relaxRightToLeft(
    columns: SankeyNode<N, L>[][],
    alpha: number,
    beta: number,
    yBottom: number,
  ): void {
    for (let n = columns.length, i = n - 2; i >= 0; i -= 1) {
      const column = columns[i]!;
      for (const source of column) {
        let y = 0;
        let w = 0;
        for (const { target, value: linkValue } of source.sourceLinks) {
          const v = linkValue * (num((target as SankeyNode<N, L>).layer) - num(source.layer));
          y += sourceTop(source, target as SankeyNode<N, L>) * v;
          w += v;
        }
        if (!(w > 0)) continue;
        const dy = (y / w - source.y0) * alpha;
        source.y0 += dy;
        source.y1 += dy;
        reorderNodeLinks(source);
      }
      if (nodeSortValue === undefined) column.sort(ascendingBreadth);
      resolveCollisions(column, beta, yBottom);
    }
  }

  function resolveCollisions(
    nodes: SankeyNode<N, L>[],
    alpha: number,
    yBottom: number,
  ): void {
    const i = nodes.length >> 1;
    const subject = nodes[i]!;
    resolveCollisionsBottomToTop(
      nodes,
      subject.y0 - nodePaddingValue,
      i - 1,
      alpha,
    );
    resolveCollisionsTopToBottom(
      nodes,
      subject.y1 + nodePaddingValue,
      i + 1,
      alpha,
    );
    resolveCollisionsBottomToTop(nodes, yBottom, nodes.length - 1, alpha);
    resolveCollisionsTopToBottom(nodes, y0, 0, alpha);
  }

  function resolveCollisionsTopToBottom(
    nodes: SankeyNode<N, L>[],
    y: number,
    i: number,
    alpha: number,
  ): void {
    for (; i < nodes.length; i += 1) {
      const node = nodes[i]!;
      const dy = (y - node.y0) * alpha;
      if (dy > 1e-6) {
        node.y0 += dy;
        node.y1 += dy;
      }
      y = node.y1 + nodePaddingValue;
    }
  }

  function resolveCollisionsBottomToTop(
    nodes: SankeyNode<N, L>[],
    y: number,
    i: number,
    alpha: number,
  ): void {
    for (; i >= 0; i -= 1) {
      const node = nodes[i]!;
      const dy = (node.y1 - y) * alpha;
      if (dy > 1e-6) {
        node.y0 -= dy;
        node.y1 -= dy;
      }
      y = node.y0 - nodePaddingValue;
    }
  }

  function reorderNodeLinks({ sourceLinks, targetLinks }: SankeyNode<N, L>): void {
    if (linkSortValue === undefined) {
      for (const link of targetLinks) {
        (link.source as SankeyNode<N, L>).sourceLinks.sort(ascendingTargetBreadth);
      }
      for (const link of sourceLinks) {
        (link.target as SankeyNode<N, L>).targetLinks.sort(ascendingSourceBreadth);
      }
    }
  }

  function reorderLinks(nodes: SankeyNode<N, L>[]): void {
    if (linkSortValue === undefined) {
      for (const { sourceLinks, targetLinks } of nodes) {
        sourceLinks.sort(ascendingTargetBreadth);
        targetLinks.sort(ascendingSourceBreadth);
      }
    }
  }

  function targetTop(source: SankeyNode<N, L>, target: SankeyNode<N, L>): number {
    let y = source.y0 - ((source.sourceLinks.length - 1) * nodePaddingValue) / 2;
    for (const { target: node, width } of source.sourceLinks) {
      if (node === target) break;
      y += width + nodePaddingValue;
    }
    for (const { source: node, width } of target.targetLinks) {
      if (node === source) break;
      y -= width;
    }
    return y;
  }

  function sourceTop(source: SankeyNode<N, L>, target: SankeyNode<N, L>): number {
    let y = target.y0 - ((target.targetLinks.length - 1) * nodePaddingValue) / 2;
    for (const { source: node, width } of target.targetLinks) {
      if (node === source) break;
      y += width + nodePaddingValue;
    }
    for (const { target: node, width } of source.sourceLinks) {
      if (node === target) break;
      y -= width;
    }
    return y;
  }

  return sankeyLayout;
}


