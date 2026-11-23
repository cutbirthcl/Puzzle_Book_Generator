import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';
import { GAME_TYPE_META } from '../data/presets';
import {
  CalcudokuSize,
  CrosswordPack,
  CrosswordSource,
  DifficultyLevel,
  GameBlock,
  GameType,
  LineArtTheme,
  LineWeight,
  PuzzlesPerPage,
  TracingLineStyle,
  WordGridDifficulty,
  WordGridTheme,
} from '../types/booklet';

interface GameBlockCardProps {
  block: GameBlock;
  index: number;
  totalBlocks: number;
  uploadedCrosswordCount: number;
  uploadedSvgCount: number;
  onUpdate: (updated: GameBlock) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const GAME_TYPES: GameType[] = [
  'sudoku',
  'kakuro',
  'calcudoku',
  'crossword',
  'word-grid',
  'line-art',
];

const DIFFICULTIES: DifficultyLevel[] = ['Easy', 'Medium', 'Hard', 'Expert'];

export const GameBlockCard: React.FC<GameBlockCardProps> = ({
  block,
  index,
  totalBlocks,
  uploadedCrosswordCount,
  uploadedSvgCount,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
}) => {
  const perPage =
    block.gameType === 'sudoku' ||
    block.gameType === 'kakuro' ||
    block.gameType === 'calcudoku'
      ? block.puzzlesPerPage
      : 1;
  const totalBlockPuzzles = block.pageCount * perPage;
  const meta = GAME_TYPE_META[block.gameType];

  const setPages = (next: number) => {
    const clamped = Math.max(1, Math.min(32, next));
    onUpdate({ ...block, pageCount: clamped });
  };

  return (
    <div className="bg-[#111113] border border-[#27272A] p-4 space-y-3.5">
      {/* Row Header: Order + Game Selector + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#27272A]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-mono text-xs text-[#A1A1AA] tabular-nums shrink-0">
            {String(index + 1).padStart(2, '0')}
          </span>

          <select
            aria-label={`Block ${index + 1} Game Type`}
            value={block.gameType}
            onChange={(e) => {
              const nextType = e.target.value as GameType;
              onUpdate({
                ...block,
                gameType: nextType,
                puzzlesPerPage:
                  nextType === 'sudoku' ||
                  nextType === 'kakuro' ||
                  nextType === 'calcudoku'
                    ? block.puzzlesPerPage
                    : 1,
              });
            }}
            className="min-w-[205px] max-w-full px-2.5 py-1.5 text-xs font-mono font-medium bg-[#18181B] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E] cursor-pointer"
          >
            {GAME_TYPES.map((gt) => (
              <option key={gt} value={gt}>
                {GAME_TYPE_META[gt].label}
              </option>
            ))}
          </select>

          <span className="hidden sm:inline text-[11px] text-[#A1A1AA] font-mono uppercase tracking-[0.06em] tabular-nums whitespace-nowrap">
            {block.pageCount} pp · {totalBlockPuzzles}{' '}
            {block.gameType === 'line-art' ? 'drawing' : 'puzzle'}
            {totalBlockPuzzles > 1 ? 's' : ''}
            {meta.isProceduralOnTheFly ? ' · Auto' : ''}
          </span>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move block up"
            aria-label="Move block up"
            className="p-1.5 border border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#E4E4E7] hover:border-[#52525B] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalBlocks - 1}
            title="Move block down"
            aria-label="Move block down"
            className="p-1.5 border border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#E4E4E7] hover:border-[#52525B] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicate block"
            aria-label="Duplicate block"
            className="p-1.5 border border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#E4E4E7] hover:border-[#52525B] cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={totalBlocks <= 1}
            title="Remove block"
            aria-label="Remove block"
            className="p-1.5 border border-[#27272A] bg-[#18181B] text-[#FB7185] hover:border-[#F43F5E] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dynamic Controls Based on Selected Game Type */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        {/* Procedural Logic Grid Games: Sudoku, Kakuro, Calcudoku */}
        {(block.gameType === 'sudoku' ||
          block.gameType === 'kakuro' ||
          block.gameType === 'calcudoku') && (
          <>
            <div className="sm:col-span-4">
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1">
                Difficulty
              </label>
              <select
                value={block.difficulty}
                onChange={(e) =>
                  onUpdate({
                    ...block,
                    difficulty: e.target.value as DifficultyLevel,
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#18181B] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1">
                Puzzles / Page
              </label>
              <select
                value={block.puzzlesPerPage}
                onChange={(e) =>
                  onUpdate({
                    ...block,
                    puzzlesPerPage: Number(e.target.value) as PuzzlesPerPage,
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#18181B] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
              >
                <option value={1}>1 / page</option>
                <option value={2}>2 / page</option>
              </select>
            </div>

            {block.gameType === 'calcudoku' && (
              <div className="sm:col-span-2">
                <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1">
                  Grid Size
                </label>
                <select
                  value={block.calcudokuSize}
                  onChange={(e) =>
                    onUpdate({
                      ...block,
                      calcudokuSize: e.target.value as CalcudokuSize,
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#18181B] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
                >
                  <option value="4x4">4×4</option>
                  <option value="6x6">6×6</option>
                  <option value="8x8">8×8</option>
                </select>
              </div>
            )}
          </>
        )}

        {/* Crossword (.puz) */}
        {block.gameType === 'crossword' && (
          <>
            <div className="sm:col-span-4">
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1">
                Puzzle Source
              </label>
              <select
                value={block.crosswordSource}
                onChange={(e) =>
                  onUpdate({
                    ...block,
                    crosswordSource: e.target.value as CrosswordSource,
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#18181B] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
              >
                <option value="Seeded Library">Seeded Library</option>
                <option value="Uploaded .puz Files">
                  Uploaded .puz Files ({uploadedCrosswordCount})
                </option>
              </select>
            </div>

            <div className="sm:col-span-5">
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1">
                Theme / Pack
              </label>
              <select
                value={block.crosswordPack}
                onChange={(e) =>
                  onUpdate({
                    ...block,
                    crosswordPack: e.target.value as CrosswordPack,
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#18181B] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
              >
                <option value="Everyday">Everyday</option>
                <option value="Mini 5x5">Mini 5×5</option>
                <option value="Cryptic/Tough">Cryptic/Tough</option>
                <option value="Custom Upload">Custom Upload</option>
              </select>
            </div>
          </>
        )}

        {/* Bananagrams / Word Grid */}
        {block.gameType === 'word-grid' && (
          <>
            <div className="sm:col-span-5">
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1">
                Word Theme
              </label>
              <select
                value={block.wordGridTheme}
                onChange={(e) =>
                  onUpdate({
                    ...block,
                    wordGridTheme: e.target.value as WordGridTheme,
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#18181B] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
              >
                <option value="Everyday Vocabulary">Everyday Vocabulary</option>
                <option value="Sci-Fi & Fantasy">Sci-Fi &amp; Fantasy</option>
                <option value="Nature & Outdoors">Nature &amp; Outdoors</option>
                <option value="Custom Word List">Custom Word List</option>
              </select>
            </div>

            <div className="sm:col-span-4">
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1">
                Mode
              </label>
              <select
                value={block.wordGridDifficulty}
                onChange={(e) =>
                  onUpdate({
                    ...block,
                    wordGridDifficulty: e.target.value as WordGridDifficulty,
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#18181B] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
              >
                <option value="Standard">Standard</option>
                <option value="Timed Sprint">Timed Sprint</option>
              </select>
            </div>
          </>
        )}

        {/* Public Domain Ink Tracing Illustrations */}
        {block.gameType === 'line-art' && (
          <>
            <div className="sm:col-span-4">
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1">
                Illustration Set
              </label>
              <select
                value={block.lineArtTheme}
                onChange={(e) =>
                  onUpdate({
                    ...block,
                    lineArtTheme: e.target.value as LineArtTheme,
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#18181B] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
              >
                <option value="Botanical Engravings">Botanical Engravings</option>
                <option value="Natural History & Shells">Natural History &amp; Shells</option>
                <option value="Architectural Plates">Architectural Plates</option>
                <option value="Celestial & Geometric">Celestial &amp; Geometric</option>
                <option value="Uploaded SVG Plates">
                  Uploaded SVG Plates ({uploadedSvgCount})
                </option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1">
                Line Style
              </label>
              <select
                value={block.tracingLineStyle}
                onChange={(e) =>
                  onUpdate({
                    ...block,
                    tracingLineStyle: e.target.value as TracingLineStyle,
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#18181B] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
              >
                <option value="light-solid">Light Solid Ink</option>
                <option value="faint-dashed">Faint Dashed Guide</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1">
                Weight
              </label>
              <select
                value={block.lineWeight}
                onChange={(e) =>
                  onUpdate({
                    ...block,
                    lineWeight: e.target.value as LineWeight,
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#18181B] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
              >
                <option value="Fine">Fine</option>
                <option value="Medium">Medium</option>
              </select>
            </div>
          </>
        )}

        {/* Page Count Stepper (1 to 32) */}
        <div
          className={
            block.gameType === 'calcudoku' || block.gameType === 'line-art'
              ? 'sm:col-span-3'
              : 'sm:col-span-3 sm:col-start-10'
          }
        >
          <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1">
            Pages (1–32)
          </label>
          <div className="flex items-center border border-[#27272A] bg-[#18181B]">
            <button
              type="button"
              onClick={() => setPages(block.pageCount - 1)}
              disabled={block.pageCount <= 1}
              aria-label="Decrease page count"
              className="px-2 py-1.5 text-[#A1A1AA] hover:text-[#E4E4E7] hover:bg-[#27272A] disabled:opacity-35 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min={1}
              max={32}
              value={block.pageCount}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) setPages(v);
              }}
              aria-label="Page count"
              className="w-full text-center text-xs font-mono tabular-nums py-1 bg-transparent text-[#E4E4E7] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setPages(block.pageCount + 1)}
              disabled={block.pageCount >= 32}
              aria-label="Increase page count"
              className="px-2 py-1.5 text-[#A1A1AA] hover:text-[#E4E4E7] hover:bg-[#27272A] disabled:opacity-35 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
