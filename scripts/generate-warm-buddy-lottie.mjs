import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(root, 'src/assets/desktop-mascots/warm-buddy/animations');

mkdirSync(outputDir, { recursive: true });

const COMPOSITION_SIZE = 360;
const ART_OFFSET = 50;

const baseColors = {
  bodyTop: [1, 1, 1, 1],
  bodyBottom: [0.78, 0.87, 1, 1],
  limbTop: [0.93, 0.97, 1, 1],
  limbBottom: [0.73, 0.84, 1, 1],
  screenTop: [0.07, 0.12, 0.2, 1],
  screenBottom: [0.12, 0.18, 0.29, 1],
  blue: [0.49, 0.83, 0.99, 1],
  green: [0.65, 0.95, 0.81, 1],
  red: [0.99, 0.65, 0.65, 1],
  white: [1, 1, 1, 1],
  antenna: [0.58, 0.77, 0.99, 1],
  shadow: [0.23, 0.51, 0.96, 0.2]
};

const animations = [
  {
    name: 'idle',
    op: 90,
    bodyY: [0, -2, 0],
    eye: 'normal',
    mouth: 'smile',
    glowOpacity: [18, 32, 18],
    rightArmRotation: [-32, -28, -32],
    leftArmRotation: [14, 10, 14]
  },
  {
    name: 'working',
    op: 72,
    bodyY: [0, -1, 0],
    eye: 'scan',
    mouth: 'line',
    glowOpacity: [24, 46, 24],
    rightArmRotation: [-30, -24, -30],
    leftArmRotation: [16, 22, 16]
  },
  {
    name: 'success',
    op: 54,
    bodyY: [0, -16, 0],
    bodyScale: [100, 106, 100],
    eye: 'happy',
    mouth: 'smile',
    glowOpacity: [20, 60, 20],
    rightArmRotation: [-28, -58, -28],
    leftArmRotation: [16, 40, 16],
    accentColor: baseColors.green
  },
  {
    name: 'error',
    op: 66,
    bodyX: [0, -5, 5, 0],
    bodyY: [0, 3, 0],
    eye: 'sad',
    mouth: 'sad',
    glowOpacity: [14, 20, 14],
    rightArmRotation: [-18, -12, -18],
    leftArmRotation: [8, 14, 8],
    accentColor: baseColors.red
  },
  {
    name: 'wave',
    op: 60,
    bodyY: [0, -5, 0],
    eye: 'normal',
    mouth: 'smile',
    glowOpacity: [20, 42, 20],
    rightArmRotation: [-42, -78, -42, -72, -42],
    leftArmRotation: [14, 10, 14]
  }
];

for (const animation of animations) {
  const lottie = createLottie(animation);
  writeFileSync(join(outputDir, `${animation.name}.json`), `${JSON.stringify(lottie)}\n`);
}

function createLottie(config) {
  const op = config.op;
  const accent = config.accentColor ?? baseColors.blue;
  const bodyY = config.bodyY ?? [0, 0, 0];
  const bodyX = config.bodyX ?? [0, 0, 0];
  const bodyScale = config.bodyScale ?? [100, 100, 100];
  const layers = [
    shadowLayer(op),
    groupLayer('body-group', 1, op, {
      p: animatedPosition(op, 130 + ART_OFFSET, 144 + ART_OFFSET, bodyX, bodyY),
      s: animatedScale(op, bodyScale)
    }, [
      roundRect('body', 150, 190, 58, fillGradient(baseColors.bodyTop, baseColors.bodyBottom), [0, 0]),
      roundRect('head-cap', 76, 32, 16, fillGradient([0.86, 0.92, 1, 1], [0.58, 0.77, 0.99, 1]), [0, -116]),
      roundRect('antenna-stem', 22, 34, 11, fill(baseColors.antenna), [0, -146]),
      ellipse('antenna-dot', 14, 14, fill([0.4, 0.91, 0.98, 1]), [0, -168]),
      roundRect('screen', 98, 58, 28, fillGradient(baseColors.screenTop, baseColors.screenBottom), [0, -38]),
      ...faceShapes(config.eye, config.mouth, accent),
      roundRect('chest-light', 38, 12, 6, fillGradient(baseColors.blue, baseColors.green), [0, 38]),
      roundRect('left-foot', 32, 10, 5, fill([0.38, 0.65, 0.98, 0.38]), [-42, 82]),
      roundRect('right-foot', 32, 10, 5, fill([0.38, 0.65, 0.98, 0.38]), [42, 82])
    ]),
    armLayer('left-arm', 2, op, [-60, 6], config.leftArmRotation, false),
    armLayer('right-arm', 3, op, [60, -8], config.rightArmRotation, true),
    glowLayer(op, config.glowOpacity ?? [18, 28, 18], accent)
  ];
  return {
    v: '5.10.2',
    fr: 30,
    ip: 0,
    op,
    w: COMPOSITION_SIZE,
    h: COMPOSITION_SIZE,
    nm: `warm-buddy-${config.name}`,
    ddd: 0,
    assets: [],
    layers
  };
}

function shadowLayer(op) {
  return shapeLayer('shadow', 10, op, [130 + ART_OFFSET, 228 + ART_OFFSET], [
    ellipse('shadow', 112, 18, fill(baseColors.shadow), [0, 0])
  ]);
}

function glowLayer(op, values, color) {
  return shapeLayer('soft-glow', 11, op, [130 + ART_OFFSET, 150 + ART_OFFSET], [
    ellipse('glow', 170, 210, fill([color[0], color[1], color[2], 0.12]), [0, 0])
  ], {
    o: animatedOpacity(op, values)
  });
}

function armLayer(name, index, op, anchorOffset, rotations, rightSide) {
  const armX = (rightSide ? 74 : -74) + ART_OFFSET;
  const armY = (rightSide ? 118 : 150) + ART_OFFSET;
  const handY = rightSide ? -54 : 54;
  return groupLayer(name, index, op, {
    p: { a: 0, k: [armX, armY, 0] },
    a: { a: 0, k: [anchorOffset[0], anchorOffset[1], 0] },
    r: animatedRotation(op, rotations)
  }, [
    roundRect(`${name}-tube`, 32, 76, 16, fillGradient(baseColors.limbTop, baseColors.limbBottom), [0, 0]),
    ellipse(`${name}-hand`, 40, 40, fillGradient(baseColors.white, baseColors.limbBottom), [0, handY])
  ]);
}

function faceShapes(eye, mouth, accent) {
  if (eye === 'scan') {
    return [
      roundRect('scan-line', 52, 5, 3, fill([0.4, 0.91, 0.98, 1]), [0, -38]),
      roundRect('scan-soft', 64, 12, 6, fill([0.4, 0.91, 0.98, 0.2]), [0, -38]),
      roundRect('mouth-line', 24, 5, 3, fill(accent), [0, -20])
    ];
  }
  if (eye === 'happy') {
    return [
      roundRect('left-eye-happy', 15, 7, 4, fill(accent), [-24, -42]),
      roundRect('right-eye-happy', 15, 7, 4, fill(accent), [24, -42]),
      pathShape('mouth-smile', smilePath(0, -24, 26, 9), stroke(accent, 4))
    ];
  }
  if (eye === 'sad') {
    return [
      roundRect('left-eye-sad', 13, 5, 3, fill(accent), [-24, -40]),
      roundRect('right-eye-sad', 13, 5, 3, fill(accent), [24, -40]),
      pathShape('mouth-sad', sadPath(0, -22, 22, 7), stroke(accent, 4))
    ];
  }
  const shapes = [
    ellipse('left-eye', 12, 12, fill(accent), [-24, -40]),
    ellipse('right-eye', 12, 12, fill(accent), [24, -40])
  ];
  if (mouth === 'line') {
    shapes.push(roundRect('mouth-line', 24, 5, 3, fill(accent), [0, -20]));
  } else {
    shapes.push(pathShape('mouth-smile', smilePath(0, -24, 24, 8), stroke(accent, 4)));
  }
  return shapes;
}

function shapeLayer(name, ind, op, position, shapes, overrides = {}) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: overrides.o ?? { a: 0, k: 100 },
      r: overrides.r ?? { a: 0, k: 0 },
      p: overrides.p ?? { a: 0, k: [position[0], position[1], 0] },
      a: overrides.a ?? { a: 0, k: [0, 0, 0] },
      s: overrides.s ?? { a: 0, k: [100, 100, 100] }
    },
    ao: 0,
    shapes,
    ip: 0,
    op,
    st: 0,
    bm: 0
  };
}

function groupLayer(name, ind, op, ks, items) {
  return shapeLayer(name, ind, op, [130 + ART_OFFSET, 130 + ART_OFFSET], [
    {
      ty: 'gr',
      nm: `${name}-group`,
      it: [...items, { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }]
    }
  ], ks);
}

function roundRect(name, width, height, radius, style, position) {
  return {
    ty: 'gr',
    nm: name,
    it: [
      { ty: 'rc', d: 1, s: { a: 0, k: [width, height] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: radius } },
      style,
      transform(position)
    ]
  };
}

function ellipse(name, width, height, style, position) {
  return {
    ty: 'gr',
    nm: name,
    it: [
      { ty: 'el', d: 1, s: { a: 0, k: [width, height] }, p: { a: 0, k: [0, 0] } },
      style,
      transform(position)
    ]
  };
}

function pathShape(name, path, style) {
  return {
    ty: 'gr',
    nm: name,
    it: [
      { ty: 'sh', ks: { a: 0, k: path } },
      style,
      transform([0, 0])
    ]
  };
}

function fill(color) {
  return { ty: 'fl', c: { a: 0, k: color }, o: { a: 0, k: color[3] * 100 }, r: 1 };
}

function fillGradient(start, end) {
  return {
    ty: 'gf',
    o: { a: 0, k: 100 },
    r: 1,
    bm: 0,
    g: {
      p: 2,
      k: {
        a: 0,
        k: [0, start[0], start[1], start[2], 1, end[0], end[1], end[2]]
      }
    },
    s: { a: 0, k: [0, -80] },
    e: { a: 0, k: [0, 90] },
    t: 1
  };
}

function stroke(color, width) {
  return {
    ty: 'st',
    c: { a: 0, k: color },
    o: { a: 0, k: 100 },
    w: { a: 0, k: width },
    lc: 2,
    lj: 2,
    ml: 4,
    bm: 0
  };
}

function transform(position) {
  return {
    ty: 'tr',
    p: { a: 0, k: position },
    a: { a: 0, k: [0, 0] },
    s: { a: 0, k: [100, 100] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
    sk: { a: 0, k: 0 },
    sa: { a: 0, k: 0 }
  };
}

function smilePath(x, y, width, depth) {
  return {
    i: [[0, 0], [-width / 4, 0], [0, 0]],
    o: [[width / 4, 0], [0, 0], [0, 0]],
    v: [[x - width / 2, y], [x, y + depth], [x + width / 2, y]],
    c: false
  };
}

function sadPath(x, y, width, depth) {
  return {
    i: [[0, 0], [-width / 4, 0], [0, 0]],
    o: [[width / 4, 0], [0, 0], [0, 0]],
    v: [[x - width / 2, y + depth], [x, y], [x + width / 2, y + depth]],
    c: false
  };
}

function animatedPosition(op, baseX, baseY, xs, ys) {
  const count = Math.max(xs.length, ys.length);
  return {
    a: 1,
    k: Array.from({ length: count }, (_, index) => {
      const t = Math.round((op - 1) * (index / (count - 1 || 1)));
      return key(t, [baseX + valueAt(xs, index), baseY + valueAt(ys, index), 0]);
    })
  };
}

function animatedScale(op, values) {
  return {
    a: 1,
    k: values.map((value, index) => key(Math.round((op - 1) * (index / (values.length - 1 || 1))), [value, value, 100]))
  };
}

function animatedRotation(op, values) {
  return {
    a: 1,
    k: values.map((value, index) => key(Math.round((op - 1) * (index / (values.length - 1 || 1))), value))
  };
}

function animatedOpacity(op, values) {
  return {
    a: 1,
    k: values.map((value, index) => key(Math.round((op - 1) * (index / (values.length - 1 || 1))), value))
  };
}

function key(t, value) {
  return {
    t,
    s: Array.isArray(value) ? value : [value],
    i: { x: [0.45], y: [1] },
    o: { x: [0.45], y: [0] }
  };
}

function valueAt(values, index) {
  return values[Math.min(index, values.length - 1)] ?? 0;
}
