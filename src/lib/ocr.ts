export interface OcrChunkBlock {
  id?: string;
  text?: string;
  block_type?: string;
  page?: number;
  bbox?: number[];
  polygon?: number[][];
}

export interface NormalizedBbox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface NormalizedGeometry {
  bbox?: NormalizedBbox;
  polygon?: Array<{ x: number; y: number }>;
}

const MAX_TRAVERSAL_DEPTH = 8;

export const extractOcrBlocks = (chunks: unknown): OcrChunkBlock[] => {
  const collected: OcrChunkBlock[] = [];
  const seen = new Set<string>();
  collectBlocks(chunks, collected, seen, 0);
  return collected;
};

export const cleanOcrMarkdown = (markdown?: string | null): string => {
  if (!markdown) return "";

  // DataLab markdown often includes embedded image links; hide them in textual OCR preview.
  const withoutImages = markdown.replace(/!\[[^\]]*]\([^)]*\)/g, "");
  return withoutImages.replace(/\n{3,}/g, "\n\n").trim();
};

export const anchorSummary = (anchor: Record<string, unknown>): string => {
  const page = typeof anchor.page === "number" ? anchor.page : null;
  const blockType =
    typeof anchor.block_type === "string" && anchor.block_type.trim().length > 0
      ? anchor.block_type.trim()
      : "block";
  if (page === null) {
    return blockType;
  }
  return `page ${page}, ${blockType}`;
};

export const geometryForBlock = (
  block: OcrChunkBlock,
  naturalWidth: number | null,
  naturalHeight: number | null
): NormalizedGeometry | null => {
  const bbox = normalizeBbox(block.bbox, naturalWidth, naturalHeight) ?? undefined;
  const polygon = normalizePolygon(block.polygon, naturalWidth, naturalHeight) ?? undefined;
  if (!bbox && !polygon) return null;
  return { bbox, polygon };
};

const collectBlocks = (
  node: unknown,
  result: OcrChunkBlock[],
  seen: Set<string>,
  depth: number
) => {
  if (depth > MAX_TRAVERSAL_DEPTH || node === null || node === undefined) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectBlocks(item, result, seen, depth + 1);
    }
    return;
  }

  if (typeof node !== "object") {
    return;
  }

  const value = node as Record<string, unknown>;
  const maybeBlock = toChunkBlock(value);
  if (maybeBlock) {
    const signature = JSON.stringify({
      id: maybeBlock.id ?? null,
      text: maybeBlock.text ?? null,
      block_type: maybeBlock.block_type ?? null,
      page: maybeBlock.page ?? null,
      bbox: maybeBlock.bbox ?? null,
      polygon: maybeBlock.polygon ?? null,
    });
    if (!seen.has(signature)) {
      seen.add(signature);
      result.push(maybeBlock);
    }
  }

  for (const key of Object.keys(value)) {
    collectBlocks(value[key], result, seen, depth + 1);
  }
};

const toChunkBlock = (value: Record<string, unknown>): OcrChunkBlock | null => {
  const bbox = parseBbox(value.bbox);
  const polygon = parsePolygon(value.polygon);
  const text = firstString(value, ["text", "content", "value", "markdown"]);
  const blockType = firstString(value, ["block_type", "type", "label", "category"]);
  const id = firstString(value, ["id", "chunk_id", "uuid"]);
  const page = firstNumber(value, ["page", "page_number"]);

  const hasGeometry = Boolean(bbox || polygon);
  const hasText = typeof text === "string" && text.trim().length > 0;
  if (!hasGeometry && !hasText && !blockType) {
    return null;
  }

  return {
    id: id ?? undefined,
    text: text ?? undefined,
    block_type: blockType ?? undefined,
    page: page ?? undefined,
    bbox: bbox ?? undefined,
    polygon: polygon ?? undefined,
  };
};

const firstString = (value: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
};

const firstNumber = (value: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
};

const parseBbox = (raw: unknown): number[] | null => {
  if (Array.isArray(raw)) {
    const numeric = raw
      .map((item) => (typeof item === "number" ? item : Number.NaN))
      .filter((item) => Number.isFinite(item));
    if (numeric.length >= 4) {
      return numeric.slice(0, 4);
    }
    return null;
  }

  if (raw && typeof raw === "object") {
    const box = raw as Record<string, unknown>;
    const x = pickNumber(box, ["x", "left", "x1"]);
    const y = pickNumber(box, ["y", "top", "y1"]);
    const width = pickNumber(box, ["width", "w"]);
    const height = pickNumber(box, ["height", "h"]);
    const x2 = pickNumber(box, ["x2", "right"]);
    const y2 = pickNumber(box, ["y2", "bottom"]);

    if (x !== null && y !== null && x2 !== null && y2 !== null) {
      return [x, y, x2, y2];
    }
    if (x !== null && y !== null && width !== null && height !== null) {
      return [x, y, x + width, y + height];
    }
  }

  return null;
};

const parsePolygon = (raw: unknown): number[][] | null => {
  if (!Array.isArray(raw)) {
    return null;
  }
  const points: number[][] = [];
  for (const point of raw) {
    if (Array.isArray(point) && point.length >= 2) {
      const x = typeof point[0] === "number" ? point[0] : Number.NaN;
      const y = typeof point[1] === "number" ? point[1] : Number.NaN;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        points.push([x, y]);
      }
      continue;
    }
    if (point && typeof point === "object") {
      const obj = point as Record<string, unknown>;
      const x = pickNumber(obj, ["x", "left"]);
      const y = pickNumber(obj, ["y", "top"]);
      if (x !== null && y !== null) {
        points.push([x, y]);
      }
    }
  }
  return points.length >= 3 ? points : null;
};

const pickNumber = (value: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
};

const normalizeBbox = (
  bbox: number[] | undefined,
  naturalWidth: number | null,
  naturalHeight: number | null
): NormalizedBbox | null => {
  if (!bbox || bbox.length < 4) {
    return null;
  }

  const [a, b, c, d] = bbox;
  const x1 = a;
  const y1 = b;
  let x2 = c;
  let y2 = d;

  if (c <= a || d <= b) {
    x2 = a + c;
    y2 = b + d;
  }

  const left = normalizeAxis(x1, naturalWidth);
  const top = normalizeAxis(y1, naturalHeight);
  const right = normalizeAxis(x2, naturalWidth);
  const bottom = normalizeAxis(y2, naturalHeight);
  if (![left, top, right, bottom].every((item) => Number.isFinite(item))) {
    return null;
  }

  return {
    left: clampPercent(left),
    top: clampPercent(top),
    width: clampPercent(right - left),
    height: clampPercent(bottom - top),
  };
};

const normalizePolygon = (
  polygon: number[][] | undefined,
  naturalWidth: number | null,
  naturalHeight: number | null
): Array<{ x: number; y: number }> | null => {
  if (!polygon || polygon.length < 3) {
    return null;
  }

  const points = polygon
    .map(([x, y]) => ({
      x: normalizeAxis(x, naturalWidth),
      y: normalizeAxis(y, naturalHeight),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: clampPercent(point.x), y: clampPercent(point.y) }));

  return points.length >= 3 ? points : null;
};

const normalizeAxis = (value: number, size: number | null): number => {
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }
  if (value >= 0 && value <= 1.5) {
    return value * 100;
  }
  if (size && size > 0) {
    return (value / size) * 100;
  }
  if (value >= 0 && value <= 100) {
    return value;
  }
  return Number.NaN;
};

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));
