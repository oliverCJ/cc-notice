import { describe, expect, test } from 'vitest';
import { SvgParseError, parseSvgDocument } from './svgParser';

describe('parseSvgDocument', () => {
  test('keeps a safe static SVG payload and source dimensions', () => {
    const document = parseSvgDocument(
      '<svg viewBox="0 0 100 50" width="100" height="50"><g transform="translate(4 2)" fill="red"><rect x="1" y="2" width="10" height="8"/><circle cx="30" cy="20" r="5"/><path d="M0 0 L10 10 Z"/></g><line x1="1" y1="2" x2="3" y2="4"/><polyline points="0,0 2,2"/><polygon points="1,1 4,1 2,4"/><ellipse cx="50" cy="20" rx="4" ry="2"/></svg>',
    );

    expect(document.viewBox).toEqual([0, 0, 100, 50]);
    expect(document.width).toBe(100);
    expect(document.height).toBe(50);
    expect(document.elementCount).toBe(7);
    expect(document.source).toContain('transform="translate(4 2)"');
  });

  test('accepts and removes safe static shape-rendering styles', () => {
    const document = parseSvgDocument(
      '<svg viewBox="0 0 8 8"><style>rect { shape-rendering: crispEdges; }</style><rect width="8" height="8" /></svg>',
    );

    expect(document.elementCount).toBe(1);
    expect(document.source).not.toContain('<style');
  });

  test('accepts SVG visual attributes supported by native rendering', () => {
    const document = parseSvgDocument(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges"><g opacity="0.5" stroke="white" stroke-width="1" stroke-linecap="round"><path d="M1 1 H7 V7 H1 Z M3 3 H5 V5 H3 Z" fill-rule="evenodd"/></g></svg>',
    );

    expect(document.elementCount).toBe(1);
  });

  test('accepts svg roots that provide width and height without a viewBox', () => {
    const document = parseSvgDocument(
      '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path d="M0 0 H8 V8 H0 Z" fill="#000000" transform="translate(0,0)"/></svg>',
    );

    expect(document.viewBox).toEqual([0, 0, 8, 8]);
    expect(document.width).toBe(8);
    expect(document.height).toBe(8);
  });

  test('rejects unsafe or unsupported style content', () => {
    for (const source of [
      '<svg viewBox="0 0 10 10"><style>rect { fill: red; }</style></svg>',
      '<svg viewBox="0 0 10 10"><style>@import url(https://example.com/a.css);</style></svg>',
      '<svg viewBox="0 0 10 10"><style>rect { animation: pulse 1s; }</style></svg>',
      '<svg viewBox="0 0 10 10"><style media="screen">rect { shape-rendering: crispEdges; }</style></svg>',
      '<svg viewBox="0 0 10 10"><g><style>rect { shape-rendering: crispEdges; }</style></g></svg>',
    ]) {
      expect(() => parseSvgDocument(source)).toThrow(SvgParseError);
    }
  });

  test('rejects executable, external and unsupported SVG content', () => {
    for (const source of [
      '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>',
      '<svg viewBox="0 0 10 10"><image href="https://example.com/a.png" /></svg>',
      '<svg viewBox="0 0 10 10"><path d="M0 0" fill="url(#fill)" /></svg>',
      '<svg viewBox="0 0 10 10"><use href="#shape" /></svg>',
      '<svg viewBox="0 0 10 10"><g onclick="alert(1)"><rect width="1" height="1" /></g></svg>',
      '<!DOCTYPE svg><svg viewBox="0 0 10 10" />',
      '<svg viewBox="0 0 10 10"><unknown /></svg>',
    ]) {
      expect(() => parseSvgDocument(source)).toThrow(SvgParseError);
    }
  });

  test('rejects invalid roots, viewBoxes and unsafe group attributes', () => {
    expect(() => parseSvgDocument('<div />')).toThrow(/根节点/);
    expect(() => parseSvgDocument('<svg viewBox="0 0 0 10" />')).toThrow(
      /viewBox/,
    );
    expect(() =>
      parseSvgDocument(
        '<svg viewBox="0 0 8 8"><g filter="blur(1)"><rect width="1" height="1" /></g></svg>',
      ),
    ).toThrow(/g 属性不受支持/);
  });
});
