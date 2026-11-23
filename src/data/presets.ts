import { GameBlock, GameType, PaperStyle, PrintSpecs, SizePreset } from '../types/booklet';

export const SIZE_PRESETS: SizePreset[] = [
  {
    id: 'pocket-mini',
    label: 'Pocket Mini',
    widthIn: 3.0,
    heightIn: 4.25,
    panelsPerSheetSide: 4,
    description: '4 panels per US Letter sheet (quarter-cut saddle-stitch)',
  },
  {
    id: 'field-notes',
    label: 'Field Notes',
    widthIn: 3.5,
    heightIn: 5.5,
    panelsPerSheetSide: 2,
    description: '2-up booklet spread per US Letter sheet',
  },
  {
    id: 'passport-tn',
    label: 'Passport TN',
    widthIn: 3.5,
    heightIn: 4.88,
    panelsPerSheetSide: 2,
    description: '2-up booklet spread per US Letter sheet',
  },
  {
    id: 'a6-standard',
    label: 'A6 Standard',
    widthIn: 4.13,
    heightIn: 5.83,
    panelsPerSheetSide: 2,
    description: '2-up booklet spread per US Letter sheet',
  },
  {
    id: 'custom-pocket',
    label: 'Custom Pocket',
    widthIn: 3.25,
    heightIn: 5.0,
    panelsPerSheetSide: 2,
    description: 'Editable trim dimensions with bleed & margin control',
  },
];

export const PAPER_STYLE_OPTIONS: Array<{
  id: PaperStyle;
  label: string;
  spec: string;
}> = [
  { id: 'clean-white', label: 'Clean White', spec: 'Plain Blank' },
  { id: 'dot-grid', label: 'Dot Grid', spec: '5mm Dots' },
  { id: 'graph-grid', label: 'Graph Grid', spec: '5mm Squares' },
];

export const GAME_TYPE_META: Record<
  GameType,
  {
    label: string;
    shortLabel: string;
    subtitle: string;
    isProceduralOnTheFly: boolean;
  }
> = {
  sudoku: {
    label: 'Sudoku (9×9)',
    shortLabel: 'Sudoku',
    subtitle: 'Auto-generated · Classic 9×9 number grid',
    isProceduralOnTheFly: true,
  },
  kakuro: {
    label: 'Kakuro (Cross-Sums)',
    shortLabel: 'Kakuro',
    subtitle: 'Auto-generated · Number crossword sums',
    isProceduralOnTheFly: true,
  },
  calcudoku: {
    label: 'Calcudoku / KenKen',
    shortLabel: 'Calcudoku',
    subtitle: 'Auto-generated · Math cage puzzles',
    isProceduralOnTheFly: true,
  },
  crossword: {
    label: 'Crossword (.puz)',
    shortLabel: 'Crossword',
    subtitle: 'Built-in or uploaded .puz puzzles',
    isProceduralOnTheFly: false,
  },
  'word-grid': {
    label: 'Bananagrams / Word Grid',
    shortLabel: 'Word Grid',
    subtitle: 'Letter tile word-building grids',
    isProceduralOnTheFly: false,
  },
  'line-art': {
    label: 'Ink Tracing (Line Art)',
    shortLabel: 'Ink Tracing',
    subtitle: 'Light-line public domain illustrations',
    isProceduralOnTheFly: false,
  },
};

export const DEFAULT_PRINT_SPECS: PrintSpecs = {
  presetId: 'field-notes',
  widthIn: 3.5,
  heightIn: 5.5,
  bleedIn: 0.125,
  marginIn: 0.25,
  panelsPerSheetSide: 2,
  coverTitle: 'Autumn Commuter Edition',
  coverSubtitle: 'Procedural Logic, Crosswords & Public Domain Ink Studies',
  editionString: 'Vol. IV · Press Run No. 12',
  paperStyle: 'clean-white',
  cropMarks: true,
  centerFoldGuides: true,
  includeAnswerKey: true,
};

export function createDefaultGameBlock(
  gameType: GameType,
  idSuffix?: string
): GameBlock {
  const id = `blk_${Date.now().toString(36)}_${idSuffix ?? Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    gameType,
    pageCount: 2,
    difficulty: 'Medium',
    puzzlesPerPage:
      gameType === 'sudoku' || gameType === 'kakuro' || gameType === 'calcudoku'
        ? 2
        : 1,
    calcudokuSize: '6x6',
    crosswordSource: 'Seeded Library',
    crosswordPack: 'Everyday',
    wordGridTheme: 'Everyday Vocabulary',
    wordGridDifficulty: 'Standard',
    lineArtTheme: 'Botanical Engravings',
    lineWeight: 'Fine',
    tracingLineStyle: 'light-solid',
  };
}

export const INITIAL_GAME_QUEUE: GameBlock[] = [
  {
    ...createDefaultGameBlock('sudoku', 'init1'),
    pageCount: 2,
    difficulty: 'Medium',
    puzzlesPerPage: 2,
  },
  {
    ...createDefaultGameBlock('kakuro', 'init2'),
    pageCount: 1,
    difficulty: 'Medium',
    puzzlesPerPage: 2,
  },
  {
    ...createDefaultGameBlock('calcudoku', 'init3'),
    pageCount: 1,
    difficulty: 'Medium',
    puzzlesPerPage: 2,
    calcudokuSize: '6x6',
  },
  {
    ...createDefaultGameBlock('line-art', 'init4'),
    pageCount: 2,
    lineArtTheme: 'Botanical Engravings',
    lineWeight: 'Fine',
    tracingLineStyle: 'light-solid',
  },
];
