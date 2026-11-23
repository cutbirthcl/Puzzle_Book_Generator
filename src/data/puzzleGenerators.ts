import {
  CalcudokuCage,
  CalcudokuPuzzleData,
  CrosswordParsedData,
  CrosswordPuzzleData,
  DifficultyLevel,
  GameBlock,
  KakuroCell,
  KakuroPuzzleData,
  LineArtPuzzleData,
  LineArtTheme,
  LineWeight,
  RenderedPuzzleItem,
  SudokuPuzzleData,
  TracingLineStyle,
  VaultItem,
  WordGridPuzzleData,
  WordGridTheme,
} from '../types/booklet';
import { PUBLIC_DOMAIN_PLATES } from './publicDomainPlates';

// Deterministic PRNG (Mulberry32) driven by live booklet generationSeed
function createRng(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------- 1. PROCEDURAL SUDOKU (ON THE FLY) ----------
const BASE_SUDOKU = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
  [4, 5, 6, 7, 8, 9, 1, 2, 3],
  [7, 8, 9, 1, 2, 3, 4, 5, 6],
  [2, 3, 4, 5, 6, 7, 8, 9, 1],
  [5, 6, 7, 8, 9, 1, 2, 3, 4],
  [8, 9, 1, 2, 3, 4, 5, 6, 7],
  [3, 4, 5, 6, 7, 8, 9, 1, 2],
  [6, 7, 8, 9, 1, 2, 3, 4, 5],
  [9, 1, 2, 3, 4, 5, 6, 7, 8],
];

const SUDOKU_CLUES: Record<DifficultyLevel, number> = {
  Easy: 40,
  Medium: 33,
  Hard: 26,
  Expert: 22,
};

export function generateSudoku(
  index: number,
  difficulty: DifficultyLevel,
  seed: number
): SudokuPuzzleData {
  const rng = createRng(seed + index * 7919);
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);

  const bandOrder = shuffle([0, 1, 2], rng);
  const rowOrder: number[] = [];
  for (const b of bandOrder) {
    const inner = shuffle([0, 1, 2], rng);
    for (const r of inner) rowOrder.push(b * 3 + r);
  }

  const stackOrder = shuffle([0, 1, 2], rng);
  const colOrder: number[] = [];
  for (const s of stackOrder) {
    const inner = shuffle([0, 1, 2], rng);
    for (const c of inner) colOrder.push(s * 3 + c);
  }

  let solution = rowOrder.map((r) =>
    colOrder.map((c) => digits[BASE_SUDOKU[r][c] - 1])
  );

  // Random transpose for extra structural diversity
  if (rng() > 0.5) {
    solution = solution[0].map((_, c) => solution.map((row) => row[c]));
  }

  const puzzle = solution.map((row) => [...row]);
  // Symmetric pair carving for clean visual balance
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < 40; i++) {
    pairs.push([i, 80 - i]);
  }
  const shuffledPairs = shuffle(pairs, rng);
  const targetBlanks = 81 - SUDOKU_CLUES[difficulty];
  let blanks = 0;

  if (targetBlanks % 2 === 1) {
    puzzle[4][4] = 0;
    blanks++;
  }
  for (const [a, b] of shuffledPairs) {
    if (blanks >= targetBlanks) break;
    puzzle[Math.floor(a / 9)][a % 9] = 0;
    puzzle[Math.floor(b / 9)][b % 9] = 0;
    blanks += 2;
  }

  return {
    kind: 'sudoku',
    index,
    difficulty,
    puzzle,
    solution,
  };
}

// ---------- 2. PROCEDURAL KAKURO (100% ON THE FLY) ----------
function hasOnlyValidRuns(mask: boolean[][], size: number): boolean {
  let openCount = 0;
  for (let r = 1; r < size; r++) {
    let run = 0;
    for (let c = 1; c < size; c++) {
      if (mask[r][c]) {
        run++;
        openCount++;
      } else {
        if (run === 1) return false;
        run = 0;
      }
    }
    if (run === 1) return false;
  }

  for (let c = 1; c < size; c++) {
    let run = 0;
    for (let r = 1; r < size; r++) {
      if (mask[r][c]) {
        run++;
      } else {
        if (run === 1) return false;
        run = 0;
      }
    }
    if (run === 1) return false;
  }

  return openCount >= Math.floor((size - 1) * (size - 1) * 0.48);
}

function buildProceduralKakuroMask(
  size: number,
  rng: () => number
): boolean[][] {
  for (let attempt = 0; attempt < 80; attempt++) {
    const mask: boolean[][] = Array.from({ length: size }, () =>
      Array(size).fill(false)
    );
    // Start with open interior and carve 2-4 symmetric barrier blocks
    for (let r = 1; r < size; r++) {
      for (let c = 1; c < size; c++) {
        mask[r][c] = true;
      }
    }

    const barrierPairs = size <= 6 ? 3 : 5;
    for (let b = 0; b < barrierPairs; b++) {
      const r = 1 + Math.floor(rng() * (size - 1));
      const c = 1 + Math.floor(rng() * (size - 1));
      mask[r][c] = false;
      mask[size - r][size - c] = false;
    }

    // Repair any length-1 runs by closing isolated cells or opening neighbors
    for (let pass = 0; pass < 4; pass++) {
      for (let r = 1; r < size; r++) {
        for (let c = 1; c < size; c++) {
          if (!mask[r][c]) continue;
          const hLen =
            (c > 1 && mask[r][c - 1] ? 1 : 0) +
            (c + 1 < size && mask[r][c + 1] ? 1 : 0);
          const vLen =
            (r > 1 && mask[r - 1][c] ? 1 : 0) +
            (r + 1 < size && mask[r + 1][c] ? 1 : 0);
          if (hLen === 0 || vLen === 0) {
            mask[r][c] = false;
          }
        }
      }
    }

    if (hasOnlyValidRuns(mask, size)) {
      return mask;
    }
  }

  // Fallback clean procedural cross-carve guaranteed to have run lengths >= 2
  const fallback: boolean[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => r > 0 && c > 0)
  );
  if (size >= 6) {
    fallback[1][3] = false;
    fallback[5][3] = false;
    fallback[3][1] = false;
    fallback[3][5] = false;
  }
  return fallback;
}

function solveKakuroDigits(
  mask: boolean[][],
  size: number,
  rng: () => number
): number[][] | null {
  const vals: number[][] = Array.from({ length: size }, () =>
    Array(size).fill(0)
  );
  const openCells: Array<[number, number]> = [];
  for (let r = 1; r < size; r++) {
    for (let c = 1; c < size; c++) {
      if (mask[r][c]) openCells.push([r, c]);
    }
  }

  const getRowUsed = (r: number, c: number) => {
    const used = new Set<number>();
    for (let cc = c - 1; cc >= 1 && mask[r][cc]; cc--) used.add(vals[r][cc]);
    for (let cc = c + 1; cc < size && mask[r][cc]; cc++) {
      if (vals[r][cc] > 0) used.add(vals[r][cc]);
    }
    return used;
  };

  const getColUsed = (r: number, c: number) => {
    const used = new Set<number>();
    for (let rr = r - 1; rr >= 1 && mask[rr][c]; rr--) used.add(vals[rr][c]);
    for (let rr = r + 1; rr < size && mask[rr][c]; rr++) {
      if (vals[rr][c] > 0) used.add(vals[rr][c]);
    }
    return used;
  };

  let steps = 0;
  function backtrack(idx: number): boolean {
    if (idx === openCells.length) return true;
    if (++steps > 8000) return false;
    const [r, c] = openCells[idx];
    const rowUsed = getRowUsed(r, c);
    const colUsed = getColUsed(r, c);
    const candidates = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
    for (const d of candidates) {
      if (!rowUsed.has(d) && !colUsed.has(d)) {
        vals[r][c] = d;
        if (backtrack(idx + 1)) return true;
        vals[r][c] = 0;
      }
    }
    return false;
  }

  return backtrack(0) ? vals : null;
}

export function generateKakuro(
  index: number,
  difficulty: DifficultyLevel,
  seed: number
): KakuroPuzzleData {
  const size =
    difficulty === 'Easy' ? 6 : difficulty === 'Expert' ? 8 : 7;
  const rng = createRng(seed + index * 3571 + size * 97);

  let mask = buildProceduralKakuroMask(size, rng);
  let digitsGrid = solveKakuroDigits(mask, size, rng);

  // Retry once if backtracking hit step cap
  if (!digitsGrid) {
    mask = buildProceduralKakuroMask(size, createRng(seed + index * 911));
    digitsGrid = solveKakuroDigits(mask, size, rng);
  }

  // Guaranteed deterministic fallback fill if needed
  const finalDigits =
    digitsGrid ??
    Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) =>
        mask[r][c] ? ((r + c * 2) % 9) + 1 : 0
      )
    );

  const grid: KakuroCell[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ type: 'black' }))
  );

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (finalDigits[r][c] > 0) {
        grid[r][c] = { type: 'empty', solution: finalDigits[r][c] };
      } else {
        let acrossSum = 0;
        if (c + 1 < size && finalDigits[r][c + 1] > 0) {
          let cc = c + 1;
          while (cc < size && finalDigits[r][cc] > 0) {
            acrossSum += finalDigits[r][cc];
            cc++;
          }
        }
        let downSum = 0;
        if (r + 1 < size && finalDigits[r + 1][c] > 0) {
          let rr = r + 1;
          while (rr < size && finalDigits[rr][c] > 0) {
            downSum += finalDigits[rr][c];
            rr++;
          }
        }
        if (acrossSum > 0 || downSum > 0) {
          grid[r][c] = {
            type: 'clue',
            acrossSum: acrossSum || undefined,
            downSum: downSum || undefined,
          };
        } else {
          grid[r][c] = { type: 'black' };
        }
      }
    }
  }

  return {
    kind: 'kakuro',
    index,
    difficulty,
    size,
    grid,
  };
}

// ---------- 3. PROCEDURAL CALCUDOKU / KENKEN (ON THE FLY) ----------
function buildLatinSquare(size: number, rng: () => number): number[][] {
  const base = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => ((r + c) % size) + 1)
  );
  const rowIdx = shuffle(
    Array.from({ length: size }, (_, i) => i),
    rng
  );
  const colIdx = shuffle(
    Array.from({ length: size }, (_, i) => i),
    rng
  );
  const digits = shuffle(
    Array.from({ length: size }, (_, i) => i + 1),
    rng
  );
  return rowIdx.map((r) => colIdx.map((c) => digits[base[r][c] - 1]));
}

export function generateCalcudoku(
  index: number,
  size: number,
  difficulty: DifficultyLevel,
  seed: number
): CalcudokuPuzzleData {
  const rng = createRng(seed + index * 4999 + size * 101);
  const solution = buildLatinSquare(size, rng);
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  const cages: CalcudokuCage[] = [];
  let cageId = 1;

  const maxCageSize = difficulty === 'Easy' ? 2 : difficulty === 'Medium' ? 3 : 4;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (visited[r][c]) continue;
      const cells: Array<[number, number]> = [[r, c]];
      visited[r][c] = true;

      const targetLen =
        rng() < 0.14 ? 1 : 2 + Math.floor(rng() * Math.max(1, maxCageSize - 1));

      while (cells.length < targetLen) {
        const neighbors: Array<[number, number]> = [];
        for (const [cr, cc] of cells) {
          for (const [dr, dc] of [
            [0, 1],
            [1, 0],
            [0, -1],
            [-1, 0],
          ]) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (
              nr >= 0 &&
              nr < size &&
              nc >= 0 &&
              nc < size &&
              !visited[nr][nc] &&
              !neighbors.some(([x, y]) => x === nr && y === nc)
            ) {
              neighbors.push([nr, nc]);
            }
          }
        }
        if (neighbors.length === 0) break;
        const pick = neighbors[Math.floor(rng() * neighbors.length)];
        visited[pick[0]][pick[1]] = true;
        cells.push(pick);
      }

      const vals = cells.map(([cr, cc]) => solution[cr][cc]);
      let target = vals[0];
      let op: CalcudokuCage['op'] = '';

      if (cells.length === 2) {
        const [a, b] = vals[0] >= vals[1] ? [vals[0], vals[1]] : [vals[1], vals[0]];
        const roll = rng();
        if (a % b === 0 && roll < 0.28) {
          op = '÷';
          target = a / b;
        } else if (roll < 0.56) {
          op = '-';
          target = a - b;
        } else if (roll < 0.8) {
          op = '×';
          target = a * b;
        } else {
          op = '+';
          target = a + b;
        }
      } else if (cells.length >= 3) {
        if (rng() < 0.48 && vals.reduce((acc, v) => acc * v, 1) <= 240) {
          op = '×';
          target = vals.reduce((acc, v) => acc * v, 1);
        } else {
          op = '+';
          target = vals.reduce((acc, v) => acc + v, 0);
        }
      }

      cages.push({ id: cageId++, target, op, cells });
    }
  }

  return {
    kind: 'calcudoku',
    index,
    difficulty,
    size,
    cages,
    solution,
  };
}

// ---------- 4. CROSSWORDS (.PUZ / SEEDED) ----------
export const SEEDED_CROSSWORDS: Record<string, CrosswordParsedData[]> = {
  'Mini 5x5': [
    {
      title: 'Morning Press',
      author: 'Pocket Press Desk',
      width: 5,
      height: 5,
      solutionGrid: [
        ['P', 'A', 'P', 'E', 'R'],
        ['A', 'L', 'O', 'N', 'E'],
        ['S', 'T', 'O', 'N', 'E'],
        ['T', 'A', 'P', 'E', 'D'],
        ['E', 'R', 'S', '.', '.'],
      ],
      acrossClues: [
        { number: 1, clue: 'Stationery sheet', answer: 'PAPER' },
        { number: 6, clue: 'Solo', answer: 'ALONE' },
        { number: 7, clue: 'Lithograph slab', answer: 'STONE' },
        { number: 8, clue: 'Secured with adhesive strip', answer: 'TAPED' },
        { number: 9, clue: 'Hesitation syllables', answer: 'ERS' },
      ],
      downClues: [
        { number: 1, clue: 'Bookbinder glue', answer: 'PASTE' },
        { number: 2, clue: 'Church table', answer: 'ALTAR' },
        { number: 3, clue: 'Burst balloons', answer: 'POPS' },
        { number: 4, clue: 'Chemical suffix', answer: 'ENE' },
        { number: 5, clue: 'Marsh plant', answer: 'REED' },
      ],
    },
    {
      title: 'Pocket Notebook',
      author: 'Pocket Press Desk',
      width: 5,
      height: 5,
      solutionGrid: [
        ['S', 'P', 'I', 'N', 'E'],
        ['T', 'A', 'P', 'E', 'R'],
        ['A', 'G', 'A', 'T', 'E'],
        ['M', 'E', 'T', 'E', 'D'],
        ['P', 'S', '.', '.', '.'],
      ],
      acrossClues: [
        { number: 1, clue: 'Stapled fold edge', answer: 'SPINE' },
        { number: 6, clue: 'Slender candle', answer: 'TAPER' },
        { number: 7, clue: '5.5-point type size', answer: 'AGATE' },
        { number: 8, clue: 'Measured out', answer: 'METED' },
        { number: 9, clue: 'Postscript abbr.', answer: 'PS' },
      ],
      downClues: [
        { number: 1, clue: 'Rubber ink block', answer: 'STAMP' },
        { number: 2, clue: 'Book leaves', answer: 'PAGES' },
        { number: 3, clue: 'Tablet model', answer: 'IPAT' },
        { number: 4, clue: 'Mesh fabric', answer: 'NET' },
        { number: 5, clue: 'Before, of old', answer: 'ERED' },
      ],
    },
  ],
  Everyday: [
    {
      title: 'Stationery Shop',
      author: 'H. Vance',
      width: 7,
      height: 7,
      solutionGrid: [
        ['F', 'O', 'L', 'I', 'O', '.', 'P'],
        ['O', 'V', 'E', 'N', 'S', '.', 'A'],
        ['L', 'E', 'A', 'F', 'S', '.', 'P'],
        ['D', 'R', 'N', '.', 'E', 'R', 'E'],
        ['.', 'S', 'T', 'A', 'T', 'E', 'R'],
        ['P', 'E', 'N', 'N', 'E', 'D', '.'],
        ['B', 'A', 'S', 'E', 'S', '.', '.'],
      ],
      acrossClues: [
        { number: 1, clue: 'Folded sheet size', answer: 'FOLIO' },
        { number: 6, clue: 'Bakery chambers', answer: 'OVENS' },
        { number: 7, clue: 'Book pages (var.)', answer: 'LEAFS' },
        { number: 8, clue: 'Before, poetically', answer: 'ERE' },
        { number: 10, clue: 'Ancient Greek coin', answer: 'STATER' },
        { number: 12, clue: 'Wrote with fountain ink', answer: 'PENNED' },
        { number: 13, clue: 'Foundations', answer: 'BASES' },
      ],
      downClues: [
        { number: 1, clue: 'Crease in half', answer: 'FOLD' },
        { number: 2, clue: 'Look closely at', answer: 'OVERSEA' },
        { number: 3, clue: 'Inclined toward', answer: 'LEANT' },
        { number: 4, clue: 'Information bit', answer: 'INF' },
        { number: 5, clue: 'Typeface weight', answer: 'OSSETE' },
        { number: 9, clue: 'Crimson shade', answer: 'RED' },
      ],
    },
  ],
  'Cryptic/Tough': [
    {
      title: 'Gutenberg Midnight',
      author: 'C. Mercer',
      width: 7,
      height: 7,
      solutionGrid: [
        ['Q', 'U', 'I', 'R', 'E', '.', 'B'],
        ['U', 'N', 'D', 'E', 'R', '.', 'I'],
        ['I', 'T', 'E', 'M', 'S', '.', 'N'],
        ['P', 'I', 'A', '.', 'T', 'Y', 'D'],
        ['.', 'E', 'S', 'T', 'E', 'E', 'S'],
        ['G', 'L', 'I', 'P', 'H', 'S', '.'],
        ['C', 'O', 'P', 'Y', '.', '.', '.'],
      ],
      acrossClues: [
        { number: 1, clue: '24 sheets of paper', answer: 'QUIRE' },
        { number: 6, clue: 'Beneath the margin', answer: 'UNDER' },
        { number: 7, clue: 'Inventory entries', answer: 'ITEMS' },
        { number: 8, clue: 'Devout Latin fem.', answer: 'PIA' },
        { number: 10, clue: 'Measured degrees', answer: 'ESTEES' },
        { number: 12, clue: 'Carved symbols (alt.)', answer: 'GLIPHS' },
        { number: 13, clue: 'Proofreading manuscript', answer: 'COPY' },
      ],
      downClues: [
        { number: 1, clue: 'Witty remark', answer: 'QUIP' },
        { number: 2, clue: 'Loosen knots', answer: 'UNTIE' },
        { number: 3, clue: 'Concepts in ink', answer: 'IDEAS' },
        { number: 4, clue: 'Dream sleep stage', answer: 'REM' },
        { number: 5, clue: 'Binds pages together', answer: 'BINDS' },
      ],
    },
  ],
};

export function generateCrossword(
  index: number,
  block: GameBlock,
  vaultItems: VaultItem[]
): CrosswordPuzzleData {
  const uploadedCrosswords = vaultItems.filter(
    (v) => v.gameType === 'crossword' && v.source === 'uploaded' && v.crosswordData
  );
  const seededCrosswords = vaultItems.filter(
    (v) => v.gameType === 'crossword' && v.source === 'seeded' && v.crosswordData
  );

  if (block.crosswordSource === 'Uploaded .puz Files' && uploadedCrosswords.length > 0) {
    const picked = uploadedCrosswords[(index - 1) % uploadedCrosswords.length];
    return {
      kind: 'crossword',
      index,
      pack: block.crosswordPack,
      sourceLabel: `Uploaded · ${picked.filename}`,
      data: picked.crosswordData!,
    };
  }

  if (block.crosswordPack === 'Custom Upload' && uploadedCrosswords.length > 0) {
    const picked = uploadedCrosswords[(index - 1) % uploadedCrosswords.length];
    return {
      kind: 'crossword',
      index,
      pack: block.crosswordPack,
      sourceLabel: `Upload · ${picked.filename}`,
      data: picked.crosswordData!,
    };
  }

  const matchingSeeded = seededCrosswords.filter(
    (v) => v.packOrTheme === block.crosswordPack && v.crosswordData
  );
  if (matchingSeeded.length > 0) {
    const picked = matchingSeeded[(index - 1) % matchingSeeded.length];
    return {
      kind: 'crossword',
      index,
      pack: block.crosswordPack,
      sourceLabel: `Seeded · ${picked.filename}`,
      data: picked.crosswordData!,
    };
  }

  const fallbackPool =
    SEEDED_CROSSWORDS[block.crosswordPack] ?? SEEDED_CROSSWORDS['Mini 5x5'];

  const data = fallbackPool[(index - 1) % fallbackPool.length];
  return {
    kind: 'crossword',
    index,
    pack: block.crosswordPack,
    sourceLabel:
      block.crosswordSource === 'Uploaded .puz Files'
        ? 'Fallback Seed (Upload .puz in Vault)'
        : `Seeded · ${block.crosswordPack}`,
    data,
  };
}

// ---------- 5. WORD GRID / BANANAGRAMS ----------
const WORD_BANKS: Record<WordGridTheme, string[][]> = {
  'Everyday Vocabulary': [
    ['PAPER', 'FOLIO', 'PRESS', 'STAMP', 'INK', 'BIND'],
    ['COFFEE', 'TRAIN', 'STATION', 'TICKET', 'NOTES', 'READ'],
    ['PENCIL', 'RULER', 'TABLE', 'CHAIR', 'LAMP', 'DESK'],
  ],
  'Sci-Fi & Fantasy': [
    ['ORBIT', 'NEBULA', 'STAR', 'WARP', 'BEAM', 'SHIP'],
    ['DRAGON', 'RUNE', 'QUEST', 'CASTLE', 'BLADE', 'MAGE'],
    ['CYBER', 'DROID', 'PULSE', 'NEXUS', 'COMET', 'VOID'],
  ],
  'Nature & Outdoors': [
    ['CEDAR', 'TRAIL', 'RIVER', 'PEAK', 'MOSS', 'FERN'],
    ['ACORN', 'BIRCH', 'CREEK', 'MEADOW', 'STONE', 'HAWK'],
    ['CLOUD', 'FROST', 'PINE', 'VALLEY', 'BROOK', 'LEAF'],
  ],
  'Custom Word List': [
    ['PRINT', 'BOOK', 'FOLD', 'STITCH', 'GRID', 'CROP'],
  ],
};

export function generateWordGrid(
  index: number,
  block: GameBlock,
  vaultItems: VaultItem[],
  seed: number
): WordGridPuzzleData {
  const rng = createRng(seed + index * 2027);

  const customVaultWords = vaultItems
    .filter((v) => v.customWords && v.customWords.length > 0)
    .flatMap((v) => v.customWords ?? []);

  let targetWords: string[];
  if (block.wordGridTheme === 'Custom Word List' && customVaultWords.length >= 4) {
    targetWords = shuffle(customVaultWords, rng).slice(0, 6);
  } else {
    const sets = WORD_BANKS[block.wordGridTheme];
    targetWords = sets[(index - 1) % sets.length];
  }

  const letters = targetWords.join('').split('');
  if (block.wordGridDifficulty === 'Timed Sprint') {
    letters.push('E', 'A', 'R', 'T', 'S');
  }
  const tiles = shuffle(letters, rng).slice(0, 21);

  const gridSize = 7;
  const sampleSolutionGrid = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill('')
  );
  const w0 = targetWords[0] || 'PRESS';
  for (let c = 0; c < Math.min(gridSize, w0.length); c++) {
    sampleSolutionGrid[3][c] = w0[c];
  }
  const w1 = targetWords[1] || 'PAPER';
  for (let r = 0; r < Math.min(gridSize, w1.length); r++) {
    sampleSolutionGrid[r][1] = w1[r];
  }
  const w2 = targetWords[2] || 'INK';
  for (let r = 0; r < Math.min(gridSize, w2.length); r++) {
    if (r + 1 < gridSize) sampleSolutionGrid[r + 1][4] = w2[r];
  }

  return {
    kind: 'word-grid',
    index,
    theme: block.wordGridTheme,
    difficulty: block.wordGridDifficulty,
    tiles,
    targetWords,
    gridSize,
    sampleSolutionGrid,
  };
}

// ---------- 6. PUBLIC DOMAIN INK TRACING PLATES ----------
export function generateLineArt(
  index: number,
  theme: LineArtTheme,
  lineWeight: LineWeight,
  tracingLineStyle: TracingLineStyle,
  vaultItems: VaultItem[]
): LineArtPuzzleData {
  // Check uploaded SVG plates if selected
  const uploadedPlates = vaultItems.filter(
    (v) => v.gameType === 'line-art' && v.source === 'uploaded' && v.illustrationData
  );

  if (theme === 'Uploaded SVG Plates' && uploadedPlates.length > 0) {
    const picked = uploadedPlates[(index - 1) % uploadedPlates.length];
    const ill = picked.illustrationData!;
    return {
      kind: 'line-art',
      index,
      theme,
      lineWeight,
      tracingLineStyle,
      title: ill.title,
      attribution: ill.attribution,
      viewBoxSize: ill.viewBoxSize,
      paths: ill.paths,
    };
  }

  const themedPlates = PUBLIC_DOMAIN_PLATES.filter((p) => p.theme === theme);
  const pool = themedPlates.length > 0 ? themedPlates : PUBLIC_DOMAIN_PLATES;
  const plate = pool[(index - 1) % pool.length];

  return {
    kind: 'line-art',
    index,
    theme,
    lineWeight,
    tracingLineStyle,
    title: plate.title,
    attribution: `${plate.attribution} · ${plate.year}`,
    viewBoxSize: plate.viewBoxSize,
    paths: plate.paths,
  };
}

export function generatePuzzleForBlock(
  block: GameBlock,
  puzzleIndexInBlock: number,
  vaultItems: VaultItem[],
  baseSeed = 202611
): RenderedPuzzleItem {
  const blockSeed =
    baseSeed +
    block.id
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0) * 17, 0);

  switch (block.gameType) {
    case 'sudoku':
      return generateSudoku(puzzleIndexInBlock, block.difficulty, blockSeed);
    case 'kakuro':
      return generateKakuro(puzzleIndexInBlock, block.difficulty, blockSeed);
    case 'calcudoku': {
      const sizeNum =
        block.calcudokuSize === '4x4' ? 4 : block.calcudokuSize === '8x8' ? 8 : 6;
      return generateCalcudoku(puzzleIndexInBlock, sizeNum, block.difficulty, blockSeed);
    }
    case 'crossword':
      return generateCrossword(puzzleIndexInBlock, block, vaultItems);
    case 'word-grid':
      return generateWordGrid(puzzleIndexInBlock, block, vaultItems, blockSeed);
    case 'line-art':
      return generateLineArt(
        puzzleIndexInBlock,
        block.lineArtTheme,
        block.lineWeight,
        block.tracingLineStyle,
        vaultItems
      );
  }
}
