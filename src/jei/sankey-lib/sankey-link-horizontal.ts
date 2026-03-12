// Adapted from factoriolab-zmd d3-sankey implementation (MIT License).
import { type Link, link, linkHorizontal } from 'd3';
import type { Path } from 'd3-path';

import type {
  SankeyLink,
  SankeyLinkExtraProperties,
  SankeyNode,
  SankeyNodeExtraProperties,
} from './models';
import { coalesce } from './utils';

function horizontalSource<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(d: SankeyLink<N, L>): [number, number] {
  return [(d.source as SankeyNode<N, L>).x1, d.y0];
}

function horizontalTarget<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(d: SankeyLink<N, L>): [number, number] {
  return [(d.target as SankeyNode<N, L>).x0, d.y1];
}

export function sankeyLinkHorizontal<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(): Link<unknown, SankeyLink<N, L>, [number, number]> {
  return linkHorizontal<SankeyLink<N, L>, [number, number]>()
    .source(horizontalSource)
    .target(horizontalTarget);
}

export function sankeyLinkLoop<
  N extends SankeyNodeExtraProperties = SankeyNodeExtraProperties,
  L extends SankeyLinkExtraProperties = SankeyLinkExtraProperties,
>(
  width: number,
  padding: number,
  bottom0: number,
  bottom1: number,
): Link<unknown, SankeyLink<N, L>, [number, number]> {
  return linkHorizontalLoop<SankeyLink<N, L>, [number, number]>(
    width,
    padding,
    bottom0,
    bottom1,
  )
    .source(horizontalSource)
    .target(horizontalTarget);
}

function linkHorizontalLoop<L, N>(
  width: number,
  padding: number,
  bottom0: number,
  bottom1: number,
): Link<unknown, L, N> {
  return link<L, N>(bumpSankeyLoopX(width, padding, bottom0, bottom1));
}

function bumpSankeyLoopX(
  width: number,
  padding: number,
  bottom0: number,
  bottom1: number,
): (context: CanvasRenderingContext2D | Path) => BumpSankeyLoop {
  return (context: CanvasRenderingContext2D | Path) =>
    new BumpSankeyLoop(context, width, padding, bottom0, bottom1);
}

function num(n: number | undefined): number {
  return coalesce(n, 0);
}

export class BumpSankeyLoop {
  private readonly context: CanvasRenderingContext2D | Path;
  private readonly width: number;
  private readonly padding: number;
  private readonly bottom0: number;
  private readonly bottom1: number;
  private x0: number | undefined;
  private y0: number | undefined;
  private line: number | undefined;
  private pointState: number | undefined;

  constructor(
    context: CanvasRenderingContext2D | Path,
    width: number,
    padding: number,
    bottom0: number,
    bottom1: number,
  ) {
    this.context = context;
    this.width = width;
    this.padding = padding;
    this.bottom0 = bottom0;
    this.bottom1 = bottom1;
  }

  areaStart(): void {
    this.line = 0;
  }

  areaEnd(): void {
    this.line = Number.NaN;
  }

  lineStart(): void {
    this.pointState = 0;
  }

  lineEnd(): void {
    if (this.line || (this.line !== 0 && this.pointState === 1)) {
      this.context.closePath();
    }
    this.line = 1 - num(this.line);
  }

  point(x: number, y: number): void {
    x = +x;
    y = +y;
    switch (this.pointState) {
      case 0: {
        this.pointState = 1;
        if (this.line) this.context.lineTo(x, y);
        else this.context.moveTo(x, y);
        break;
      }
      case 1:
      default: {
        this.pointState = 2;
        const bottom =
          Math.max(this.bottom0, this.bottom1) +
          this.width / 2 +
          this.padding;
        const minRadius = this.width + this.padding;
        const radius0 = Math.max(minRadius, (bottom - num(this.y0)) * 0.75);
        const radius1 = Math.max(minRadius, (bottom - y) * 0.75);

        const previousX = num(this.x0);
        const previousY = num(this.y0);
        const flip = previousX > x ? 1 : -1;
        const x0cp = previousX + radius0 * flip;
        const xcp = x - radius1 * flip;

        this.context.bezierCurveTo(x0cp, previousY, x0cp, bottom, previousX, bottom);
        this.context.lineTo(x, bottom);
        this.context.bezierCurveTo(xcp, bottom, xcp, y, x, y);
      }
    }
    this.x0 = x;
    this.y0 = y;
  }
}



