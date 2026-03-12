// Adapted from factoriolab-zmd d3-sankey implementation (MIT License).
import { min } from 'd3';

import { coalesce } from './utils';
import type {
  SankeyLink,
  SankeyLinkExtraProperties,
  SankeyNode,
  SankeyNodeExtraProperties,
} from './models';

function targetDepth<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(d: SankeyLink<N, L>): number | undefined {
  return (d.target as SankeyNode<N, L>).depth;
}

export function sankeyLeft<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(node: SankeyNode<N, L>): number {
  return coalesce(node.depth, 0);
}

export function sankeyRight<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(node: SankeyNode<N, L>, n: number): number {
  return n - 1 - coalesce(node.height, 0);
}

export function sankeyJustify<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(node: SankeyNode<N, L>, n: number): number {
  return node.sourceLinks?.length ? coalesce(node.depth, 0) : n - 1;
}

export function sankeyCenter<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(node: SankeyNode<N, L>): number {
  return node.targetLinks?.length
    ? coalesce(node.depth, 0)
    : node.sourceLinks?.length
      ? coalesce(min(node.sourceLinks, targetDepth), 0) - 1
      : 0;
}



