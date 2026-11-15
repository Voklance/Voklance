import type { CatalogItem } from '@voklance/shared';
import type { Types } from 'mongoose';

export function toCatalogDto(record: {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  category: string;
}): CatalogItem {
  return {
    id: record._id.toString(),
    name: record.name,
    slug: record.slug,
    category: record.category
  };
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
