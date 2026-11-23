import { GAME_TYPE_META } from '../data/presets';
import { generatePuzzleForBlock } from '../data/puzzleGenerators';
import {
  BookletBuildManifest,
  BookletPage,
  GameBlock,
  ImpositionSheet,
  ImpositionSpread,
  PrintSpecs,
  RenderedPuzzleItem,
  SignatureStats,
  VaultItem,
} from '../types/booklet';

export interface BookletCompilation {
  pages: BookletPage[];
  sheets: ImpositionSheet[];
  stats: SignatureStats;
}

export function compileBooklet(
  specs: PrintSpecs,
  queue: GameBlock[],
  vaultItems: VaultItem[],
  generationSeed = 202611
): BookletCompilation {
  const puzzlePages: BookletPage[] = [];
  const allPuzzlesWithMeta: Array<{
    puzzleNumber: number;
    label: string;
    puzzle: RenderedPuzzleItem;
  }> = [];

  let globalPuzzleNumber = 1;

  for (const block of queue) {
    const perPage =
      block.gameType === 'sudoku' ||
      block.gameType === 'kakuro' ||
      block.gameType === 'calcudoku'
        ? block.puzzlesPerPage
        : 1;

    let blockPuzzleIdx = 1;
    for (let p = 0; p < block.pageCount; p++) {
      const pagePuzzles: RenderedPuzzleItem[] = [];
      for (let slot = 0; slot < perPage; slot++) {
        const puzzle = generatePuzzleForBlock(
          block,
          blockPuzzleIdx,
          vaultItems,
          generationSeed
        );
        pagePuzzles.push(puzzle);
        if (puzzle.kind !== 'line-art') {
          allPuzzlesWithMeta.push({
            puzzleNumber: globalPuzzleNumber,
            label: `${GAME_TYPE_META[block.gameType].shortLabel} #${globalPuzzleNumber}`,
            puzzle,
          });
        }
        globalPuzzleNumber++;
        blockPuzzleIdx++;
      }

      puzzlePages.push({
        pageNumber: 0,
        kind: 'puzzle',
        blockId: block.id,
        gameType: block.gameType,
        headerLabel: GAME_TYPE_META[block.gameType].shortLabel,
        puzzles: pagePuzzles,
      });
    }
  }

  const answerPagesList: BookletPage[] = [];
  if (specs.includeAnswerKey && allPuzzlesWithMeta.length > 0) {
    const answersPerPage = 4;
    for (let i = 0; i < allPuzzlesWithMeta.length; i += answersPerPage) {
      answerPagesList.push({
        pageNumber: 0,
        kind: 'answer-key',
        headerLabel: 'Answer Key',
        answerEntries: allPuzzlesWithMeta.slice(i, i + answersPerPage),
      });
    }
  }

  const coverPages = 1;
  const backCoverPages = 1;
  const rawPages =
    coverPages + puzzlePages.length + answerPagesList.length + backCoverPages;
  const paddedTotalPages = Math.max(4, Math.ceil(rawPages / 4) * 4);
  const fillerCount = paddedTotalPages - rawPages;

  const fillerPages: BookletPage[] = Array.from({ length: fillerCount }, () => ({
    pageNumber: 0,
    kind: 'dot-grid-filler',
    headerLabel: 'Field Notes',
  }));

  const rawOrderedPages: BookletPage[] = [
    { pageNumber: 1, kind: 'front-cover', headerLabel: specs.coverTitle },
    ...puzzlePages,
    ...answerPagesList,
    ...fillerPages,
    { pageNumber: paddedTotalPages, kind: 'back-cover', headerLabel: 'Colophon' },
  ];

  const orderedPages: BookletPage[] = rawOrderedPages.map((page, idx) => ({
    ...page,
    pageNumber: idx + 1,
  }));

  const logicalSpreadsCount = paddedTotalPages / 4;
  const logicalFrontSpreads: ImpositionSpread[] = [];
  const logicalBackSpreads: ImpositionSpread[] = [];

  for (let s = 0; s < logicalSpreadsCount; s++) {
    const frontLeft = orderedPages[paddedTotalPages - 1 - 2 * s];
    const frontRight = orderedPages[2 * s];
    const backLeft = orderedPages[2 * s + 1];
    const backRight = orderedPages[paddedTotalPages - 2 - 2 * s];

    logicalFrontSpreads.push({
      leftPage: frontLeft,
      rightPage: frontRight,
      label: `p.${frontLeft.pageNumber} / p.${frontRight.pageNumber}`,
    });
    logicalBackSpreads.push({
      leftPage: backLeft,
      rightPage: backRight,
      label: `p.${backLeft.pageNumber} / p.${backRight.pageNumber}`,
    });
  }

  const sheets: ImpositionSheet[] = [];
  if (specs.panelsPerSheetSide === 4) {
    const physicalCount = Math.ceil(logicalSpreadsCount / 2);
    for (let k = 0; k < physicalCount; k++) {
      const idx1 = 2 * k;
      const idx2 = 2 * k + 1;
      const frontSpreads = [logicalFrontSpreads[idx1]];
      const backSpreads = [logicalBackSpreads[idx1]];
      if (idx2 < logicalSpreadsCount) {
        frontSpreads.push(logicalFrontSpreads[idx2]);
        backSpreads.push(logicalBackSpreads[idx2]);
      }
      sheets.push({
        sheetNumber: k + 1,
        frontSpreads,
        backSpreads,
      });
    }
  } else {
    for (let s = 0; s < logicalSpreadsCount; s++) {
      sheets.push({
        sheetNumber: s + 1,
        frontSpreads: [logicalFrontSpreads[s]],
        backSpreads: [logicalBackSpreads[s]],
      });
    }
  }

  const stats: SignatureStats = {
    coverPages,
    puzzlePages: puzzlePages.length,
    totalPuzzles:
      allPuzzlesWithMeta.length +
      puzzlePages.filter((p) => p.gameType === 'line-art').length,
    answerPages: answerPagesList.length,
    backCoverPages,
    rawPages,
    paddedTotalPages,
    fillerPages: fillerCount,
    duplexSheets: sheets.length,
    panelsPerSheetSide: specs.panelsPerSheetSide,
  };

  return { pages: orderedPages, sheets, stats };
}

export function buildExportManifest(
  specs: PrintSpecs,
  queue: GameBlock[],
  vaultItems: VaultItem[],
  compilation: BookletCompilation,
  generationSeed: number
): BookletBuildManifest {
  const sanitizedPrintSpecs: PrintSpecs = specs.coverImage
    ? {
        ...specs,
        coverImage: {
          ...specs.coverImage,
          dataUrl: `[embedded-png:${specs.coverImage.filename}]`,
          originalDataUrl: `[omitted]`,
        },
      }
    : specs;

  return {
    schemaVersion: '1.1.0',
    generator: 'Pocket Puzzle Press Client Imposition Engine',
    generatedAt: new Date().toISOString(),
    generationSeed,
    targetEndpoint: '/api/generate-booklet',
    printSpecs: sanitizedPrintSpecs,
    signatureStats: compilation.stats,
    gameQueue: queue.map((b, idx) => {
      const settings: Record<string, string | number> = {};
      if (b.gameType === 'sudoku' || b.gameType === 'kakuro') {
        settings.difficulty = b.difficulty;
        settings.puzzlesPerPage = b.puzzlesPerPage;
      } else if (b.gameType === 'calcudoku') {
        settings.difficulty = b.difficulty;
        settings.puzzlesPerPage = b.puzzlesPerPage;
        settings.gridSize = b.calcudokuSize;
      } else if (b.gameType === 'crossword') {
        settings.source = b.crosswordSource;
        settings.pack = b.crosswordPack;
      } else if (b.gameType === 'word-grid') {
        settings.theme = b.wordGridTheme;
        settings.difficulty = b.wordGridDifficulty;
      } else if (b.gameType === 'line-art') {
        settings.theme = b.lineArtTheme;
        settings.lineWeight = b.lineWeight;
        settings.tracingLineStyle = b.tracingLineStyle;
      }
      return {
        order: idx + 1,
        id: b.id,
        gameType: b.gameType,
        generationMode: GAME_TYPE_META[b.gameType].isProceduralOnTheFly
          ? 'procedural-on-the-fly'
          : 'vault-or-pack',
        pageCount: b.pageCount,
        settings,
      };
    }),
    vaultSources: vaultItems.map((v) => ({
      id: v.id,
      filename: v.filename,
      gameType: v.gameType,
      source: v.source,
      sha256: v.sha256,
    })),
    impositionPlan: compilation.sheets.map((sheet) => ({
      sheetNumber: sheet.sheetNumber,
      front: sheet.frontSpreads.map((sp) => ({
        leftPage: sp.leftPage.pageNumber,
        rightPage: sp.rightPage.pageNumber,
      })),
      back: sheet.backSpreads.map((sp) => ({
        leftPage: sp.leftPage.pageNumber,
        rightPage: sp.rightPage.pageNumber,
      })),
    })),
  };
}
