export interface OcrChunkBlock {
  id?: string;
  text?: string;
  block_type?: string;
  page?: number;
  bbox?: number[];
  polygon?: number[][];
  page_bbox?: number[];
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
const SKIP_FALLBACK_KEYS = new Set(["metadata", "page_info", "images", "section_hierarchy"]);

export const extractOcrBlocks = (chunks: unknown): OcrChunkBlock[] => {
  const container = resolveChunksContainer(chunks);
  const pageBoundsByPage = extractPageBoundsByPage(container);
  const sourceBlocks = resolveSourceBlocks(chunks, container);

  if (sourceBlocks.length > 0) {
    return dedupeBlocks(
      sourceBlocks
        .map((item) =>
          item && typeof item === "object"
            ? toChunkBlock(item as Record<string, unknown>, pageBoundsByPage)
            : null
        )
        .filter((item): item is OcrChunkBlock => Boolean(item))
    );
  }

  const collected: OcrChunkBlock[] = [];
  const seen = new Set<string>();
  collectBlocks(chunks, collected, seen, 0, pageBoundsByPage);
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
  const frame = coordinateFrameForPage(block.page_bbox);
  const bbox = normalizeBbox(block.bbox, naturalWidth, naturalHeight, frame) ?? undefined;
  const polygon =
    normalizePolygon(block.polygon, naturalWidth, naturalHeight, frame) ?? undefined;
  if (!bbox && !polygon) return null;
  return { bbox, polygon };
};

const collectBlocks = (
  node: unknown,
  result: OcrChunkBlock[],
  seen: Set<string>,
  depth: number,
  pageBoundsByPage: Map<number, number[]>
) => {
  if (depth > MAX_TRAVERSAL_DEPTH || node === null || node === undefined) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectBlocks(item, result, seen, depth + 1, pageBoundsByPage);
    }
    return;
  }

  if (typeof node !== "object") {
    return;
  }

  const value = node as Record<string, unknown>;
  const maybeBlock = toChunkBlock(value, pageBoundsByPage);
  if (maybeBlock) {
    const signature = JSON.stringify({
      id: maybeBlock.id ?? null,
      text: maybeBlock.text ?? null,
      block_type: maybeBlock.block_type ?? null,
      page: maybeBlock.page ?? null,
      bbox: maybeBlock.bbox ?? null,
      polygon: maybeBlock.polygon ?? null,
      page_bbox: maybeBlock.page_bbox ?? null,
    });
    if (!seen.has(signature)) {
      seen.add(signature);
      result.push(maybeBlock);
    }
  }

  for (const key of Object.keys(value)) {
    if (SKIP_FALLBACK_KEYS.has(key)) {
      continue;
    }
    collectBlocks(value[key], result, seen, depth + 1, pageBoundsByPage);
  }
};

const resolveChunksContainer = (chunks: unknown): Record<string, unknown> | null => {
  if (!chunks || typeof chunks !== "object") return null;
  const root = chunks as Record<string, unknown>;

  if (Array.isArray(root.blocks)) {
    return root;
  }

  const nestedChunks = root.chunks;
  if (nestedChunks && typeof nestedChunks === "object") {
    const nested = nestedChunks as Record<string, unknown>;
    if (Array.isArray(nested.blocks)) {
      return nested;
    }
  }

  const result = root.result;
  if (result && typeof result === "object") {
    const resultObject = result as Record<string, unknown>;
    if (Array.isArray(resultObject.blocks)) {
      return resultObject;
    }
    const resultChunks = resultObject.chunks;
    if (resultChunks && typeof resultChunks === "object") {
      const nested = resultChunks as Record<string, unknown>;
      if (Array.isArray(nested.blocks)) {
        return nested;
      }
    }
  }

  return null;
};

const resolveSourceBlocks = (
  chunks: unknown,
  container: Record<string, unknown> | null
): unknown[] => {
  if (container && Array.isArray(container.blocks)) {
    return container.blocks;
  }
  if (Array.isArray(chunks)) {
    return chunks;
  }
  return [];
};

const extractPageBoundsByPage = (container: Record<string, unknown> | null): Map<number, number[]> => {
  const pageBounds = new Map<number, number[]>();
  if (!container) {
    return pageBounds;
  }

  const pageInfo = container.page_info;
  if (!pageInfo) {
    return pageBounds;
  }

  if (Array.isArray(pageInfo)) {
    for (const entry of pageInfo) {
      if (!entry || typeof entry !== "object") continue;
      const value = entry as Record<string, unknown>;
      const page = parsePageNumber(value.page ?? value.page_id ?? value.id);
      const bbox = parseBbox(value.bbox);
      if (page !== null && bbox) {
        pageBounds.set(page, bbox);
      }
    }
    return pageBounds;
  }

  if (typeof pageInfo !== "object") {
    return pageBounds;
  }

  for (const [key, entry] of Object.entries(pageInfo as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const page = parsePageNumber(key);
    const bbox = parseBbox((entry as Record<string, unknown>).bbox);
    if (page !== null && bbox) {
      pageBounds.set(page, bbox);
    }
  }

  return pageBounds;
};

const toChunkBlock = (
  value: Record<string, unknown>,
  pageBoundsByPage: Map<number, number[]>
): OcrChunkBlock | null => {
  const bbox = parseBbox(value.bbox);
  const polygon = parsePolygon(value.polygon);
  const text = extractChunkText(value);
  const blockType = firstString(value, ["block_type", "type", "label", "category"]);
  const id = firstString(value, ["id", "chunk_id", "uuid"]);
  const page = firstNumber(value, ["page", "page_number", "page_id"]);
  const pageBbox = resolvePageBbox(page, value, pageBoundsByPage);

  if (blockType && blockType.toLowerCase() === "page") {
    return null;
  }

  const hasGeometry = Boolean(bbox || polygon);
  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasIdentity =
    (typeof blockType === "string" && blockType.trim().length > 0) ||
    (typeof id === "string" && id.trim().length > 0);
  if (!hasGeometry && !hasText && !hasIdentity) {
    return null;
  }
  if (hasGeometry && !hasIdentity) {
    return null;
  }

  return {
    id: id ?? undefined,
    text: text ?? undefined,
    block_type: blockType ?? undefined,
    page: page ?? undefined,
    bbox: bbox ?? undefined,
    polygon: polygon ?? undefined,
    page_bbox: pageBbox ?? undefined,
  };
};

const resolvePageBbox = (
  page: number | null,
  value: Record<string, unknown>,
  pageBoundsByPage: Map<number, number[]>
): number[] | null => {
  const explicit = parseBbox(value.page_bbox ?? value.page_bbox_pixels ?? value.pageBounds);
  if (explicit) {
    return explicit;
  }

  if (page !== null) {
    const matched = pageBoundsByPage.get(page);
    if (matched) {
      return matched;
    }
  }

  if (pageBoundsByPage.size === 1) {
    const first = pageBoundsByPage.values().next().value;
    return first ?? null;
  }

  return null;
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
    const parsed = parsePageNumber(value[key]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
};

const parsePageNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return null;
};

const extractChunkText = (value: Record<string, unknown>): string | null => {
  const direct = firstString(value, ["text", "content", "value", "markdown"]);
  if (direct) {
    return direct;
  }

  const html = firstString(value, ["html"]);
  if (!html) {
    return null;
  }

  const plain = htmlToPlainText(html);
  return plain.length > 0 ? plain : null;
};

const htmlToPlainText = (html: string): string =>
  decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();

const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    })
    .replace(/&#(\d+);/g, (_, num: string) => {
      const codePoint = Number.parseInt(num, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    });

const dedupeBlocks = (blocks: OcrChunkBlock[]): OcrChunkBlock[] => {
  const result: OcrChunkBlock[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const signature = JSON.stringify({
      id: block.id ?? null,
      text: block.text ?? null,
      block_type: block.block_type ?? null,
      page: block.page ?? null,
      bbox: block.bbox ?? null,
      polygon: block.polygon ?? null,
      page_bbox: block.page_bbox ?? null,
    });
    if (!seen.has(signature)) {
      seen.add(signature);
      result.push(block);
    }
  }

  return result;
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
  naturalHeight: number | null,
  frame: CoordinateFrame | null
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

  const left = normalizeAxis(x1, naturalWidth, frame?.left ?? null, frame?.width ?? null);
  const top = normalizeAxis(y1, naturalHeight, frame?.top ?? null, frame?.height ?? null);
  const right = normalizeAxis(x2, naturalWidth, frame?.left ?? null, frame?.width ?? null);
  const bottom = normalizeAxis(y2, naturalHeight, frame?.top ?? null, frame?.height ?? null);
  if (![left, top, right, bottom].every((item) => Number.isFinite(item))) {
    return null;
  }

  const leftEdge = Math.min(left, right);
  const rightEdge = Math.max(left, right);
  const topEdge = Math.min(top, bottom);
  const bottomEdge = Math.max(top, bottom);

  const clampedLeft = clampPercent(leftEdge);
  const clampedTop = clampPercent(topEdge);
  const clampedRight = clampPercent(rightEdge);
  const clampedBottom = clampPercent(bottomEdge);

  return {
    left: clampedLeft,
    top: clampedTop,
    width: Math.max(0, clampedRight - clampedLeft),
    height: Math.max(0, clampedBottom - clampedTop),
  };
};

const normalizePolygon = (
  polygon: number[][] | undefined,
  naturalWidth: number | null,
  naturalHeight: number | null,
  frame: CoordinateFrame | null
): Array<{ x: number; y: number }> | null => {
  if (!polygon || polygon.length < 3) {
    return null;
  }

  const points = polygon
    .map(([x, y]) => ({
      x: normalizeAxis(x, naturalWidth, frame?.left ?? null, frame?.width ?? null),
      y: normalizeAxis(y, naturalHeight, frame?.top ?? null, frame?.height ?? null),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: clampPercent(point.x), y: clampPercent(point.y) }));

  return points.length >= 3 ? points : null;
};

interface CoordinateFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

const coordinateFrameForPage = (bbox: number[] | undefined): CoordinateFrame | null => {
  if (!bbox || bbox.length < 4) {
    return null;
  }

  const [x1, y1, x2Raw, y2Raw] = bbox;
  let x2 = x2Raw;
  let y2 = y2Raw;
  if (x2Raw <= x1 || y2Raw <= y1) {
    x2 = x1 + x2Raw;
    y2 = y1 + y2Raw;
  }
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
    return null;
  }

  const width = x2 - x1;
  const height = y2 - y1;
  if (width <= 0 || height <= 0) {
    return null;
  }

  return { left: x1, top: y1, width, height };
};

const normalizeAxis = (
  value: number,
  size: number | null,
  frameStart: number | null,
  frameSize: number | null
): number => {
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }
  if (value >= 0 && value <= 1.5) {
    return value * 100;
  }

  if (frameStart !== null && frameSize !== null && frameSize > 0) {
    return ((value - frameStart) / frameSize) * 100;
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
