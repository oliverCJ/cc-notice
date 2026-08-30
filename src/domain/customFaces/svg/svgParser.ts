export type SvgTransform =
  | { type: 'translate'; x: number; y: number }
  | { type: 'scale'; x: number; y: number }
  | { type: 'rotate'; angle: number };

export type SvgElement = {
  type: 'path' | 'rect' | 'circle' | 'ellipse' | 'line' | 'polyline' | 'polygon';
  attributes: Record<string, string>;
  transform: SvgTransform[];
};

export type SvgDocument = {
  width: number;
  height: number;
  viewBox: [number, number, number, number];
  elements: SvgElement[];
};

export class SvgParseError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'SvgParseError';
  }
}

const supportedElements = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const allowedSvgAttributes = new Set(['xmlns', 'version', 'viewBox', 'width', 'height', 'shape-rendering']);
const allowedElementAttributes = new Set(['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points', 'd', 'fill', 'stroke', 'stroke-width', 'shape-rendering', 'transform']);

export function parseSvgDocument(source: string): SvgDocument {
  if (source.length > 2 * 1024 * 1024) throw new SvgParseError('SVG 文件超过 2 MiB 限制');
  if (/<!doctype|<!entity|<script|<animate|<image|<filter|<lineargradient|<radialgradient|<foreignobject/i.test(source)) throw new SvgParseError('SVG 包含不支持的脚本、外链或动态元素');
  const hasMultipleRoots = /<\/svg>\s*<svg\b/i.test(source);
  const parsedSource = hasMultipleRoots ? `<root>${source}</root>` : source;
  const documentRoot = new DOMParser().parseFromString(parsedSource, 'image/svg+xml').documentElement;
  const root = hasMultipleRoots ? documentRoot?.querySelector('svg') : documentRoot;
  if (hasMultipleRoots) {
    const roots = documentRoot ? Array.from(documentRoot.children).filter((item) => item.tagName.toLowerCase() === 'svg') : [];
    if (!roots.length || roots.some((item) => item.getAttribute('viewBox') !== root?.getAttribute('viewBox'))) throw new SvgParseError('多个 SVG 根节点必须使用相同 viewBox');
  }
  if (!root || root.tagName.toLowerCase() !== 'svg') throw new SvgParseError('根节点必须是 svg');
  if (root.querySelector('parsererror')) throw new SvgParseError('SVG XML 格式无效');
  for (const attribute of Array.from(root.attributes)) {
    if (!allowedSvgAttributes.has(attribute.name)) throw new SvgParseError(`svg 属性不受支持：${attribute.name}`);
    if (attribute.name === 'shape-rendering' && !['auto', 'crispEdges'].includes(attribute.value)) throw new SvgParseError('shape-rendering 值不受支持');
  }
  const viewBox = parseViewBox(root.getAttribute('viewBox'));
  const width = parsePositiveNumber(root.getAttribute('width')) ?? viewBox[2];
  const height = parsePositiveNumber(root.getAttribute('height')) ?? viewBox[3];
  const elements: SvgElement[] = [];
  if (hasMultipleRoots && documentRoot) Array.from(documentRoot.children).filter((item) => item.tagName.toLowerCase() === 'svg').forEach((item) => walkElements(item, elements));
  else walkElements(root, elements);
  if (elements.length > 10000) throw new SvgParseError('SVG 元素数量超过限制');
  return { width, height, viewBox, elements };
}

function walkElements(node: Element, output: SvgElement[]) {
  for (const child of Array.from(node.children)) {
    const type = child.tagName.toLowerCase();
    if (type === 'g') {
      walkElements(child, output);
      continue;
    }
    if (type === 'style') {
      if (!/^\s*(?:[a-z-]+\s*)?\{?\s*shape-rendering\s*:\s*(?:auto|crispEdges)\s*;?\s*\}?\s*$/i.test(child.textContent ?? '')) throw new SvgParseError('style 内容不受支持');
      continue;
    }
    if (!supportedElements.has(type)) throw new SvgParseError(`SVG 元素不受支持：${type}`);
    const attributes: Record<string, string> = {};
    for (const attribute of Array.from(child.attributes)) {
      if (!allowedElementAttributes.has(attribute.name) || /^on/i.test(attribute.name) || /url\(|javascript:/i.test(attribute.value)) throw new SvgParseError(`SVG 属性不受支持：${attribute.name}`);
      if (attribute.name === 'shape-rendering' && !['auto', 'crispEdges'].includes(attribute.value)) throw new SvgParseError('shape-rendering 值不受支持');
      attributes[attribute.name] = attribute.value;
    }
    output.push({ type: type as SvgElement['type'], attributes, transform: parseTransform(attributes.transform) });
    if (child.children.length > 0) walkElements(child, output);
  }
}

function parseViewBox(value: string | null): [number, number, number, number] {
  if (!value) throw new SvgParseError('必须提供有效 viewBox 或尺寸');
  const values = value.trim().split(/[ ,]+/).map(Number);
  if (values.length !== 4 || values.some((item) => !Number.isFinite(item)) || values[2] <= 0 || values[3] <= 0) throw new SvgParseError('viewBox 无效');
  return values as [number, number, number, number];
}

function parsePositiveNumber(value: string | null) {
  if (value === null) return undefined;
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number) || number <= 0) throw new SvgParseError('SVG 尺寸无效');
  return number;
}

function parseTransform(value: string | undefined): SvgTransform[] {
  if (!value) return [];
  const transforms: SvgTransform[] = [];
  const pattern = /(translate|scale|rotate)\s*\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    const values = match[2].trim().split(/[ ,]+/).map(Number);
    if (values.some((item) => !Number.isFinite(item))) throw new SvgParseError('transform 参数无效');
    if (match[1] === 'translate' && (values.length === 1 || values.length === 2)) transforms.push({ type: 'translate', x: values[0], y: values[1] ?? 0 });
    else if (match[1] === 'scale' && (values.length === 1 || values.length === 2)) transforms.push({ type: 'scale', x: values[0], y: values[1] ?? values[0] });
    else if (match[1] === 'rotate' && values.length === 1) transforms.push({ type: 'rotate', angle: values[0] });
    else throw new SvgParseError('transform 类型或参数不受支持');
  }
  if (transforms.length === 0 || value.replace(/(translate|scale|rotate)\s*\(([^)]+)\)/g, '').trim()) throw new SvgParseError('transform 类型不受支持');
  return transforms;
}
