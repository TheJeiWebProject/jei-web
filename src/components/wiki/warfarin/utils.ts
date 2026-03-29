import type { ItemDef } from 'src/jei/types';

export type RecordLike = Record<string, unknown>;

export function isRecordLike(value: unknown): value is RecordLike {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function toArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripWikiText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean)
    .replace(/<@[^>]+>/g, '')
    .replace(/<#[^>]+>/g, '')
    .replace(/<\/?>/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

export function formatWikiHtml(value: unknown): string {
  const text = stripWikiText(value);
  if (!text) return '';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

export function formatScalar(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(3).replace(/\.?0+$/, '');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean);
}

export function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return fallback;
}

export function formatRarity(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '-';
  return `${'★'.repeat(num)} (${num})`;
}

export function toCdnAssetUrl(assetId: unknown): string {
  const id = typeof assetId === 'string' ? assetId.trim() : '';
  return id ? `https://cdn.warfarin.wiki/assets/${id}.png` : '';
}

export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function hasData(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

export function formatRichContentBlock(text: string): string {
  return text
    .replace(/<image>(.*?)<\/image>/g, '[Image: $1]')
    .replace(/<video>(.*?)<\/video>/g, '[Video: $1]');
}

import { attributeTypeNames, resolveEnumName } from './genums';

export { resolveEnumName } from './genums';

export function getAttrName(attrType: string | number): string {
  return resolveEnumName(attributeTypeNames, attrType);
}

export interface NormalizedPayload {
  list: RecordLike;
  detail: RecordLike;
  refs: RecordLike;
  localNameMap: RecordLike;
  idToPackItemId: RecordLike;
}

export function normalizePayload(source: unknown): NormalizedPayload | null {
  if (!isRecordLike(source)) return null;
  let root = source;
  if (!isRecordLike(root.list) || !isRecordLike(root.detail)) {
    if (isRecordLike(source.raw)) {
      root = source.raw;
    }
  }
  if (!isRecordLike(root.list) || !isRecordLike(root.detail)) return null;
  return {
    list: root.list,
    detail: root.detail,
    refs: isRecordLike(root.refs) ? root.refs : {},
    localNameMap: isRecordLike(root.localNameMap) ? root.localNameMap : {},
    idToPackItemId: isRecordLike(root.idToPackItemId) ? root.idToPackItemId : {},
  };
}

export function resolveEntityName(id: unknown, localNameMap: RecordLike): string {
  const strId = typeof id === 'string' ? id : '';
  if (!strId) return '-';
  if (typeof localNameMap[strId] === 'string') return localNameMap[strId];
  return strId;
}

export function resolveItemNameFromDefs(
  rawId: unknown,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): string {
  const itemId = typeof rawId === 'string' ? rawId : '';
  if (!itemId) return '-';
  const values = Object.values(itemDefsByKeyHash || {});
  const found = values.find(
    (entry) => typeof entry?.key?.id === 'string' && entry.key.id.endsWith(itemId),
  );
  return found?.name || itemId;
}

export function formatCraftItem(
  item: RecordLike,
  localNameMap: RecordLike,
  liquidMap?: Map<string, string>,
): string {
  const id =
    typeof item.id === 'string'
      ? item.id
      : typeof item.itemId === 'string'
        ? item.itemId
        : '';
  const count = item.count ?? item.cnt ?? item.num ?? item.amount ?? 1;
  let name = resolveEntityName(id, localNameMap);
  if (liquidMap && id.startsWith('item_fbottle_') && liquidMap.has(id)) {
    name = `${name}(${liquidMap.get(id)})`;
  }
  return `${formatScalar(count)}x ${name} (${id})`;
}

export function normalizeItemGroups(source: unknown): RecordLike[][] {
  if (Array.isArray(source)) {
    if (source.length > 0 && Array.isArray(source[0])) {
      return source.map((group) => toArray<RecordLike>(group));
    }
    return [source.filter((item): item is RecordLike => isRecordLike(item))];
  }
  return [];
}

export function normalizeSimpleItems(source: unknown): RecordLike[] {
  if (Array.isArray(source)) return source.filter((item): item is RecordLike => isRecordLike(item));
  return [];
}

export function formatRequiredItems(
  value: unknown,
  localNameMap?: RecordLike,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): string {
  const items = toArray<RecordLike>(value);
  return items
    .map((item) => {
      const itemId = typeof item.id === 'string' ? item.id : '';
      const count = item.count ?? item.cnt ?? item.amount;
      const name = localNameMap
        ? resolveEntityName(itemId, localNameMap)
        : resolveItemNameFromDefs(itemId, itemDefsByKeyHash);
      return `${name} x${formatScalar(count)}`;
    })
    .filter((entry) => entry.trim().length > 0)
    .join(', ');
}

export function formatItemBundle(
  ids: unknown,
  counts: unknown,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): string {
  const idList = toArray(ids);
  const countList = toArray(counts);
  return idList
    .map(
      (id, index) =>
        `${resolveItemNameFromDefs(id, itemDefsByKeyHash)} x${formatScalar(countList[index])}`,
    )
    .join(', ');
}

export function buildInfoEntries(
  obj: RecordLike,
  keys: Array<string | { key: string; label?: string; mono?: boolean; format?: (v: unknown) => string }>,
): Array<{ label: string; value: string; mono: boolean }> {
  return keys
    .map((spec) => {
      const key = typeof spec === 'string' ? spec : spec.key;
      const label = typeof spec === 'string' ? humanizeKey(spec) : (spec.label ?? humanizeKey(spec.key));
      const mono = typeof spec === 'string' ? false : (spec.mono ?? false);
      const fmt = typeof spec === 'object' && spec.format ? spec.format : undefined;
      const raw = obj[key];
      if (raw === undefined || raw === null) return null;
      return { label, value: fmt ? fmt(raw) : formatScalar(raw), mono };
    })
    .filter((entry): entry is { label: string; value: string; mono: boolean } => entry !== null);
}

export type WarfarinEndpointType =
  | 'operators'
  | 'enemies'
  | 'items'
  | 'weapons'
  | 'gear'
  | 'facilities'
  | 'medals'
  | 'missions'
  | 'lore'
  | 'tutorials'
  | 'documents';
