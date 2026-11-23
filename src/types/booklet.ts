export type SizePresetId =
  | 'pocket-mini'
  | 'field-notes'
  | 'passport-tn'
  | 'a6-standard'
  | 'custom-pocket';

export type PaperStyle =
  | 'clean-white'
  | 'dot-grid'
  | 'graph-grid';

export type GameType =
  | 'sudoku'
  | 'kakuro'
  | 'calcudoku'
  | 'crossword'
  | 'word-grid'
  | 'line-art';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard' | 'Expert';
export type PuzzlesPerPage = 1 | 2;
export type CalcudokuSize = '4x4' | '6x6' | '8x8';

export type CrosswordSource = 'Seeded Library' | 'Uploaded .puz Files';
export type CrosswordPack = 'Everyday' | 'Mini 5x5' | 'Cryptic/Tough' | 'Custom Upload';

export type WordGridTheme =
  | 'Everyday Vocabulary'
  | 'Sci-Fi & Fantasy'
  | 'Nature & Outdoors'
  | 'Custom Word List';
export type WordGridDifficulty = 'Standard' | 'Timed Sprint';

export type LineArtTheme =
  | 'Botanical Engravings'
  | 'Natural History & Shells'
  | 'Architectural Plates'
  | 'Celestial & Geometric'
  | 'Uploaded SVG Plates';
export type LineWeight = 'Fine' | 'Medium';
export type TracingLineStyle = 'light-solid' | 'faint-dashed';

export interface SizePreset {
  id: SizePresetId;
  label: string;
  widthIn: number;
  heightIn: number;
  panelsPerSheetSide: 2 | 4;
  description: string;
}

export interface CoverImageAsset {
  filename: string;
  dataUrl: string;
  originalDataUrl: string;
  grayscale: boolean;
  width: number;
  height: number;
}

export interface PrintSpecs {
  presetId: SizePresetId;
  widthIn: number;
  heightIn: number;
  bleedIn: number;
  marginIn: number;
  panelsPerSheetSide: 2 | 4;
  coverTitle: string;
  coverSubtitle: string;
  editionString: string;
  coverImage?: CoverImageAsset;
  paperStyle: PaperStyle;
  cropMarks: boolean;
  centerFoldGuides: boolean;
  includeAnswerKey: boolean;
}

export interface GameBlock {
  id: string;
  gameType: GameType;
  pageCount: number; // 1 to 32
  // Procedural logic games (Sudoku / Kakuro / Calcudoku)
  difficulty: DifficultyLevel;
  puzzlesPerPage: PuzzlesPerPage;
  calcudokuSize: CalcudokuSize;
  // Crossword (.puz)
  crosswordSource: CrosswordSource;
  crosswordPack: CrosswordPack;
  // Bananagrams / Word Grid
  wordGridTheme: WordGridTheme;
  wordGridDifficulty: WordGridDifficulty;
  // Public Domain Ink Tracing
  lineArtTheme: LineArtTheme;
  lineWeight: LineWeight;
  tracingLineStyle: TracingLineStyle;
}

export interface CrosswordParsedData {
  title: string;
  author: string;
  copyright?: string;
  width: number;
  height: number;
  solutionGrid: string[][]; // '.' for black square, A-Z for letter
  acrossClues: Array<{ number: number; clue: string; answer: string }>;
  downClues: Array<{ number: number; clue: string; answer: string }>;
}

export interface PublicDomainIllustrationData {
  title: string;
  attribution: string;
  year: string;
  viewBoxSize: number; // normalized square viewBox, e.g. 100
  paths: string[]; // SVG path d strings
}

export interface VaultItem {
  id: string;
  filename: string;
  gameType: GameType;
  source: 'seeded' | 'uploaded';
  packOrTheme: string;
  format: 'puz' | 'json' | 'txt' | 'svg' | 'seed';
  sha256: string;
  addedAt: string;
  summary: string;
  crosswordData?: CrosswordParsedData;
  illustrationData?: PublicDomainIllustrationData;
  customWords?: string[];
  rawNotes?: string;
}

export interface UploadLogEntry {
  id: string;
  filename: string;
  status: 'accepted' | 'rejected';
  sha256: string;
  duplicateOf?: string;
  reason: string;
  timestamp: string;
}

// Puzzle Instance Models for Rendering (UI Preview + pdf-lib)
export interface SudokuPuzzleData {
  kind: 'sudoku';
  index: number;
  difficulty: DifficultyLevel;
  puzzle: number[][]; // 0 = empty
  solution: number[][];
}

export interface KakuroCell {
  type: 'black' | 'clue' | 'empty';
  downSum?: number;
  acrossSum?: number;
  solution?: number;
}

export interface KakuroPuzzleData {
  kind: 'kakuro';
  index: number;
  difficulty: DifficultyLevel;
  size: number;
  grid: KakuroCell[][];
}

export interface CalcudokuCage {
  id: number;
  target: number;
  op: '+' | '-' | '×' | '÷' | '';
  cells: Array<[number, number]>;
}

export interface CalcudokuPuzzleData {
  kind: 'calcudoku';
  index: number;
  difficulty: DifficultyLevel;
  size: number;
  cages: CalcudokuCage[];
  solution: number[][];
}

export interface CrosswordPuzzleData {
  kind: 'crossword';
  index: number;
  pack: string;
  sourceLabel: string;
  data: CrosswordParsedData;
}

export interface WordGridPuzzleData {
  kind: 'word-grid';
  index: number;
  theme: WordGridTheme;
  difficulty: WordGridDifficulty;
  tiles: string[];
  targetWords: string[];
  gridSize: number;
  sampleSolutionGrid: string[][];
}

export interface LineArtPuzzleData {
  kind: 'line-art';
  index: number;
  theme: LineArtTheme;
  lineWeight: LineWeight;
  tracingLineStyle: TracingLineStyle;
  title: string;
  attribution: string;
  viewBoxSize: number;
  paths: string[];
}

export type RenderedPuzzleItem =
  | SudokuPuzzleData
  | KakuroPuzzleData
  | CalcudokuPuzzleData
  | CrosswordPuzzleData
  | WordGridPuzzleData
  | LineArtPuzzleData;

export type BookletPageKind =
  | 'front-cover'
  | 'puzzle'
  | 'answer-key'
  | 'dot-grid-filler'
  | 'back-cover';

export interface BookletPage {
  pageNumber: number; // 1-indexed
  kind: BookletPageKind;
  blockId?: string;
  gameType?: GameType;
  headerLabel?: string;
  puzzles?: RenderedPuzzleItem[];
  answerEntries?: Array<{
    puzzleNumber: number;
    label: string;
    puzzle: RenderedPuzzleItem;
  }>;
}

export interface ImpositionSpread {
  leftPage: BookletPage;
  rightPage: BookletPage;
  label: string;
}

export interface ImpositionSheet {
  sheetNumber: number;
  frontSpreads: ImpositionSpread[]; // 1 spread for 2-up, 2 spreads for 4-up
  backSpreads: ImpositionSpread[];
}

export interface SignatureStats {
  coverPages: number;
  puzzlePages: number;
  totalPuzzles: number;
  answerPages: number;
  backCoverPages: number;
  rawPages: number;
  paddedTotalPages: number;
  fillerPages: number;
  duplexSheets: number;
  panelsPerSheetSide: 2 | 4;
}

export interface BookletBuildManifest {
  schemaVersion: string;
  generator: string;
  generatedAt: string;
  generationSeed: number;
  targetEndpoint: string;
  printSpecs: PrintSpecs;
  signatureStats: SignatureStats;
  gameQueue: Array<{
    order: number;
    id: string;
    gameType: GameType;
    generationMode: 'procedural-on-the-fly' | 'vault-or-pack';
    pageCount: number;
    settings: Record<string, string | number>;
  }>;
  vaultSources: Array<{
    id: string;
    filename: string;
    gameType: GameType;
    source: 'seeded' | 'uploaded';
    sha256: string;
  }>;
  impositionPlan: Array<{
    sheetNumber: number;
    front: Array<{ leftPage: number; rightPage: number }>;
    back: Array<{ leftPage: number; rightPage: number }>;
  }>;
}
