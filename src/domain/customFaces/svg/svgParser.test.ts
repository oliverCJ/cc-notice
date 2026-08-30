import { describe, expect, test } from 'vitest';
import { SvgParseError, parseSvgDocument } from './svgParser';

describe('parseSvgDocument', () => {
  test('parses the supported static elements and viewBox', () => {
    const document = parseSvgDocument('<svg viewBox="0 0 100 50" width="100" height="50"><rect x="1" y="2" width="10" height="8" fill="white"/><circle cx="30" cy="20" r="5"/><path d="M0 0 L10 10 Z"/><line x1="1" y1="2" x2="3" y2="4"/><polyline points="0,0 2,2"/><polygon points="1,1 4,1 2,4"/><ellipse cx="50" cy="20" rx="4" ry="2"/></svg>');
    expect(document.viewBox).toEqual([0, 0, 100, 50]);
    expect(document.elements).toHaveLength(7);
    expect(document.elements.map((element) => element.type)).toEqual(['rect', 'circle', 'path', 'line', 'polyline', 'polygon', 'ellipse']);
  });

  test('accepts standard SVG namespace declarations', () => {
    expect(parseSvgDocument('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect x="1" y="1" width="2" height="2" /></svg>').elements).toHaveLength(1);
  });

  test('accepts crispEdges rendering hints and safe shape-rendering style rules', () => {
    const document = parseSvgDocument('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges"><style>rect { shape-rendering: crispEdges; }</style><rect width="8" height="8" /></svg>');
    expect(document.elements).toHaveLength(1);
  });

  test('parses basic transform and rejects executable or external content', () => {
    expect(parseSvgDocument('<svg viewBox="0 0 10 10"><rect x="1" y="2" width="2" height="3" transform="translate(2 4) scale(2)" /></svg>').elements[0].transform).toEqual([
      { type: 'translate', x: 2, y: 4 },
      { type: 'scale', x: 2, y: 2 }
    ]);
    for (const source of [
      '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>',
      '<svg viewBox="0 0 10 10"><image href="https://example.com/a.png" /></svg>',
      '<!DOCTYPE svg><svg viewBox="0 0 10 10" />',
      '<svg viewBox="0 0 10 10"><unknown /></svg>'
    ]) {
      expect(() => parseSvgDocument(source)).toThrow(SvgParseError);
    }
  });

  test('rejects invalid root and unsafe attributes', () => {
    expect(() => parseSvgDocument('<div />')).toThrow(/根节点/);
    expect(() => parseSvgDocument('<svg><rect onclick="alert(1)" /></svg>')).toThrow(/viewBox|尺寸/);
    expect(() => parseSvgDocument('<svg viewBox="0 0 0 10" />')).toThrow(/viewBox/);
  });

  test('accepts structural groups while validating contained geometry', () => {
    expect(parseSvgDocument('<svg viewBox="0 0 8 8"><g><rect x="1" y="1" width="2" height="2" /></g></svg>').elements).toHaveLength(1);
  });

  test('merges adjacent SVG roots with the same viewBox', () => {
    expect(parseSvgDocument('<svg viewBox="0 0 8 8"><rect x="0" y="0" width="1" height="1" /></svg><svg viewBox="0 0 8 8"><rect x="2" y="2" width="1" height="1" /></svg>').elements).toHaveLength(2);
  });
});
