export type SvgDocument = {
  width: number;
  height: number;
  viewBox: [number, number, number, number];
  elementCount: number;
  source: string;
};

export class SvgParseError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'SvgParseError';
  }
}

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_ELEMENTS = 10_000;
const supportedElements = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
]);
const allowedSvgAttributes = new Set([
  'xmlns',
  'version',
  'viewBox',
  'width',
  'height',
  'shape-rendering',
]);
const allowedGroupAttributes = new Set([
  'transform',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'shape-rendering',
]);
const allowedElementAttributes = new Set([
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'points',
  'd',
  ...allowedGroupAttributes,
]);
const safeStaticStylePattern =
  /^\s*(?:rect\s*\{\s*shape-rendering\s*:\s*(?:auto|crispEdges)\s*;?\s*\}\s*)+$/;

export function parseSvgDocument(source: string): SvgDocument {
  if (source.length > MAX_SOURCE_BYTES) {
    throw new SvgParseError('SVG 文件超过 2 MiB 限制');
  }
  if (containsDisallowedMarkup(source)) {
    throw new SvgParseError('SVG 包含不支持的脚本、外链或动态元素');
  }

  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') {
    throw new SvgParseError('根节点必须是 svg');
  }
  if (root.querySelector('parsererror')) {
    throw new SvgParseError('SVG XML 格式无效');
  }

  removeSafeStaticStyles(root);
  validateAttributes(root, allowedSvgAttributes, 'svg');
  const viewBox = parseViewBox(root.getAttribute('viewBox'));
  const width = parsePositiveNumber(root.getAttribute('width')) ?? viewBox[2];
  const height = parsePositiveNumber(root.getAttribute('height')) ?? viewBox[3];
  const elementCount = validateChildren(root);
  if (elementCount > MAX_ELEMENTS) {
    throw new SvgParseError('SVG 元素数量超过限制');
  }

  return {
    width,
    height,
    viewBox,
    elementCount,
    source: new XMLSerializer().serializeToString(root),
  };
}

function containsDisallowedMarkup(source: string) {
  return /<!doctype|<!entity|<\/?(?:script|animate(?:[a-z-]*)?|image|filter|lineargradient|radialgradient|foreignobject|use|mask|pattern|clipPath|text)\b|\b(?:href|xlink:href)\s*=|\b(?:url|javascript|data):/i.test(source);
}

function removeSafeStaticStyles(root: Element) {
  // Styles are removed before native rendering, so accepted SVGs keep no executable CSS.
  const styles = Array.from(root.querySelectorAll('style'));
  for (const style of styles) {
    if (style.parentElement !== root || style.attributes.length > 0) {
      throw new SvgParseError('SVG style 只支持根节点下的静态声明');
    }
    if (!safeStaticStylePattern.test(style.textContent ?? '')) {
      throw new SvgParseError('SVG style 只支持静态 shape-rendering 声明');
    }
    style.remove();
  }
}

function validateChildren(node: Element): number {
  let count = 0;
  for (const child of Array.from(node.children)) {
    const type = child.tagName.toLowerCase();
    if (type === 'g') {
      validateAttributes(child, allowedGroupAttributes, 'g');
      count += validateChildren(child);
      continue;
    }
    if (!supportedElements.has(type)) {
      throw new SvgParseError(`SVG 元素不受支持：${type}`);
    }
    validateAttributes(child, allowedElementAttributes, type);
    count += 1;
  }
  return count;
}

function validateAttributes(
  node: Element,
  allowed: Set<string>,
  elementName: string,
) {
  for (const attribute of Array.from(node.attributes)) {
    if (
      !allowed.has(attribute.name) ||
      /^on/i.test(attribute.name) ||
      /url\(|javascript:|data:/i.test(attribute.value)
    ) {
      throw new SvgParseError(
        `${elementName} 属性不受支持：${attribute.name}`,
      );
    }
    if (
      attribute.name === 'shape-rendering' &&
      !['auto', 'crispEdges'].includes(attribute.value)
    ) {
      throw new SvgParseError('shape-rendering 值不受支持');
    }
  }
}

function parseViewBox(value: string | null): [number, number, number, number] {
  if (!value) {
    throw new SvgParseError('必须提供有效 viewBox 或尺寸');
  }
  const values = value.trim().split(/[ ,]+/).map(Number);
  if (
    values.length !== 4 ||
    values.some((item) => !Number.isFinite(item)) ||
    values[2] <= 0 ||
    values[3] <= 0
  ) {
    throw new SvgParseError('viewBox 无效');
  }
  return values as [number, number, number, number];
}

function parsePositiveNumber(value: string | null) {
  if (value === null) return undefined;
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new SvgParseError('SVG 尺寸无效');
  }
  return number;
}
