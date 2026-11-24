/**
 * ISO/IEC 18004 QR Code Matrix Generator (Byte Mode, Versions 1–6, ECC M / L)
 * Pure deterministic TypeScript with zero external dependencies.
 * Generates genuine camera-scannable QR matrices with Reed-Solomon ECC & 8-mask penalty evaluation.
 */

export interface QrMatrixResult {
  matrix: boolean[][];
  size: number;
  version: number;
  eccLevel: 'M' | 'L';
}

interface VersionSpec {
  version: number;
  eccLevel: 'M' | 'L';
  eccBits: number; // ISO 18004 2-bit indicator: L=01 (1), M=00 (0)
  totalCodewords: number;
  dataCodewords: number;
  ecPerBlock: number;
  blocks: number;
  alignCenter: number | null;
}

const VERSION_SPECS: VersionSpec[] = [
  { version: 1, eccLevel: 'M', eccBits: 0b00, totalCodewords: 26, dataCodewords: 16, ecPerBlock: 10, blocks: 1, alignCenter: null },
  { version: 2, eccLevel: 'M', eccBits: 0b00, totalCodewords: 44, dataCodewords: 28, ecPerBlock: 16, blocks: 1, alignCenter: 18 },
  { version: 3, eccLevel: 'M', eccBits: 0b00, totalCodewords: 70, dataCodewords: 44, ecPerBlock: 26, blocks: 1, alignCenter: 22 },
  { version: 4, eccLevel: 'M', eccBits: 0b00, totalCodewords: 100, dataCodewords: 64, ecPerBlock: 18, blocks: 2, alignCenter: 26 },
  { version: 5, eccLevel: 'M', eccBits: 0b00, totalCodewords: 134, dataCodewords: 86, ecPerBlock: 24, blocks: 2, alignCenter: 30 },
  { version: 6, eccLevel: 'M', eccBits: 0b00, totalCodewords: 172, dataCodewords: 108, ecPerBlock: 16, blocks: 4, alignCenter: 34 },
  { version: 6, eccLevel: 'L', eccBits: 0b01, totalCodewords: 172, dataCodewords: 136, ecPerBlock: 18, blocks: 2, alignCenter: 34 },
];

// GF(256) log/exp tables with primitive polynomial 0x11d
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeEc(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Array<number>(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift();
    rem.push(0);
    if (factor !== 0) {
      for (let i = 0; i < ecLen; i++) {
        rem[i] ^= gfMul(gen[i + 1], factor);
      }
    }
  }
  return rem;
}

function computeFormatBits(eccBits: number, mask: number): number {
  const data = ((eccBits & 0b11) << 3) | (mask & 0b111);
  let rem = data << 10;
  const gen = 0x537;
  for (let bit = 14; bit >= 10; bit--) {
    if ((rem >> bit) & 1) {
      rem ^= gen << (bit - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function encodeUtf8Bytes(input: string): number[] {
  if (typeof TextEncoder !== 'undefined') {
    return Array.from(new TextEncoder().encode(input));
  }
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    bytes.push(input.charCodeAt(i) & 0xff);
  }
  return bytes;
}

function buildDataCodewords(bytes: number[], spec: VersionSpec): number[] {
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Byte mode indicator: 0100
  pushBits(0b0100, 4);
  // Character count indicator (8 bits for Versions 1–9 in Byte mode)
  pushBits(bytes.length, 8);
  for (const b of bytes) {
    pushBits(b, 8);
  }

  const maxBits = spec.dataCodewords * 8;
  // Terminator (up to 4 zero bits)
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);

  // Align to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) {
      val = (val << 1) | bits[i + j];
    }
    codewords.push(val);
  }

  // Pad codewords 0xEC, 0x11 alternating
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (codewords.length < spec.dataCodewords) {
    codewords.push(padBytes[padIdx % 2]);
    padIdx++;
  }
  return codewords;
}

function interleaveCodewords(dataCodewords: number[], spec: VersionSpec): number[] {
  const blockDataSize = Math.floor(spec.dataCodewords / spec.blocks);
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];

  for (let b = 0; b < spec.blocks; b++) {
    const start = b * blockDataSize;
    const block = dataCodewords.slice(start, start + blockDataSize);
    dataBlocks.push(block);
    ecBlocks.push(rsComputeEc(block, spec.ecPerBlock));
  }

  const finalBytes: number[] = [];
  for (let i = 0; i < blockDataSize; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      finalBytes.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      finalBytes.push(ecBlocks[b][i]);
    }
  }
  return finalBytes;
}

function maskPredicate(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function evaluatePenalty(grid: boolean[][]): number {
  const n = grid.length;
  let penalty = 0;

  // Rule 1: Adjacent modules in row/col with same color (>= 5)
  for (let r = 0; r < n; r++) {
    let runLen = 1;
    for (let c = 1; c < n; c++) {
      if (grid[r][c] === grid[r][c - 1]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < n; c++) {
    let runLen = 1;
    for (let r = 1; r < n; r++) {
      if (grid[r][c] === grid[r - 1][c]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = grid[r][c];
      if (grid[r][c + 1] === v && grid[r + 1][c] === v && grid[r + 1][c + 1] === v) {
        penalty += 3;
      }
    }
  }

  // Rule 4: Balance of dark/light modules
  let darkCount = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c]) darkCount++;
    }
  }
  const percent = (darkCount * 100) / (n * n);
  const k = Math.floor(Math.abs(percent - 50) / 5);
  penalty += k * 10;

  return penalty;
}

function placeFormatBits(grid: boolean[][], eccBits: number, mask: number): void {
  const n = grid.length;
  const f = computeFormatBits(eccBits, mask);
  const bit = (i: number) => Boolean((f >> i) & 1);

  // Strip A around top-left finder
  const tlCoords: Array<[number, number, number]> = [
    [8, 0, 14],
    [8, 1, 13],
    [8, 2, 12],
    [8, 3, 11],
    [8, 4, 10],
    [8, 5, 9],
    [8, 7, 8],
    [8, 8, 7],
    [7, 8, 6],
    [5, 8, 5],
    [4, 8, 4],
    [3, 8, 3],
    [2, 8, 2],
    [1, 8, 1],
    [0, 8, 0],
  ];
  for (const [r, c, b] of tlCoords) {
    grid[r][c] = bit(b);
  }

  // Strip B along bottom-left & top-right
  for (let i = 0; i < 7; i++) {
    grid[n - 1 - i][8] = bit(14 - i);
  }
  grid[n - 8][8] = true; // Fixed dark module
  for (let i = 0; i < 8; i++) {
    grid[8][n - 8 + i] = bit(7 - i);
  }
}

export function generateQrMatrix(text: string): QrMatrixResult {
  const rawInput = (text || 'LOST-VN').trim() || 'LOST-VN';
  let bytes = encodeUtf8Bytes(rawInput);

  // Pick smallest version/ECC that fits payload (max 134 bytes for V6-L)
  const maxBytes = VERSION_SPECS[VERSION_SPECS.length - 1].dataCodewords - 2;
  if (bytes.length > maxBytes) {
    bytes = bytes.slice(0, maxBytes);
  }
  const spec =
    VERSION_SPECS.find((s) => bytes.length <= s.dataCodewords - 2) ||
    VERSION_SPECS[VERSION_SPECS.length - 1];

  const size = spec.version * 4 + 17;
  const baseGrid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunc: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunc = (r: number, c: number, val: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      baseGrid[r][c] = val;
      isFunc[r][c] = true;
    }
  };

  // Finder patterns + white 1-module separators
  const drawFinder = (topR: number, topC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topR + dr;
        const c = topC + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunc(r, c, inOuter && (onBorder || inCore));
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Alignment pattern (Versions 2–6 have 1 non-overlapping alignment pattern at (alignCenter, alignCenter))
  if (spec.alignCenter !== null) {
    const cr = spec.alignCenter;
    const cc = spec.alignCenter;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const dist = Math.max(Math.abs(dr), Math.abs(dc));
        setFunc(cr + dr, cc + dc, dist === 0 || dist === 2);
      }
    }
  }

  // Reserve format info & dark module areas
  for (let i = 0; i <= 8; i++) {
    if (!isFunc[8][i]) isFunc[8][i] = true;
    if (!isFunc[i][8]) isFunc[i][8] = true;
  }
  for (let i = size - 8; i < size; i++) {
    isFunc[8][i] = true;
    isFunc[i][8] = true;
  }
  setFunc(size - 8, 8, true);

  // Build data + Reed-Solomon ECC bitstream
  const dataCodewords = buildDataCodewords(bytes, spec);
  const fullBytes = interleaveCodewords(dataCodewords, spec);
  const bitStream: boolean[] = [];
  for (const byte of fullBytes) {
    for (let b = 7; b >= 0; b--) {
      bitStream.push(Boolean((byte >> b) & 1));
    }
  }

  // Zig-zag upward/downward module placement
  let bitIdx = 0;
  let upward = true;
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5; // Skip vertical timing column
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset++) {
        const c = rightCol - offset;
        if (!isFunc[r][c]) {
          baseGrid[r][c] = bitIdx < bitStream.length ? bitStream[bitIdx] : false;
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }

  // Evaluate all 8 mask patterns and select the lowest penalty mask
  let bestGrid = baseGrid;
  let bestPenalty = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = baseGrid.map((row, r) =>
      row.map((cell, c) => (isFunc[r][c] ? cell : maskPredicate(mask, r, c) ? !cell : cell))
    );
    placeFormatBits(candidate, spec.eccBits, mask);
    const penalty = evaluatePenalty(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestGrid = candidate;
    }
  }

  return {
    matrix: bestGrid,
    size,
    version: spec.version,
    eccLevel: spec.eccLevel,
  };
}

/**
 * Collapses dark QR modules into a single SVG path string for ultra-crisp rendering (zero subpixel seams).
 */
export function buildQrSvgPath(matrix: boolean[][], quietZone = 2): { pathD: string; viewBoxSize: number } {
  const n = matrix.length;
  const parts: string[] = [];
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!matrix[r][c]) {
        c++;
        continue;
      }
      const startC = c;
      while (c < n && matrix[r][c]) c++;
      const runWidth = c - startC;
      parts.push(`M${startC + quietZone} ${r + quietZone}h${runWidth}v1h-${runWidth}z`);
    }
  }
  return {
    pathD: parts.join(''),
    viewBoxSize: n + quietZone * 2,
  };
}
