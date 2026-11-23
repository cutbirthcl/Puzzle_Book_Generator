import React from 'react';
import {
  BookletPage,
  CalcudokuPuzzleData,
  CrosswordPuzzleData,
  KakuroPuzzleData,
  LineArtPuzzleData,
  PaperStyle,
  PrintSpecs,
  RenderedPuzzleItem,
  SignatureStats,
  SudokuPuzzleData,
  WordGridPuzzleData,
} from '../types/booklet';

interface PageContentPreviewProps {
  page: BookletPage;
  specs: PrintSpecs;
  stats: SignatureStats;
}

function getPaperClass(style: PaperStyle): string {
  switch (style) {
    case 'dot-grid':
      return 'bg-white paper-dot-grid';
    case 'graph-grid':
      return 'bg-white paper-graph-grid';
    default:
      return 'bg-white';
  }
}

function MiniSudoku({ data, solved = false }: { data: SudokuPuzzleData; solved?: boolean }) {
  const grid = solved ? data.solution : data.puzzle;
  return (
    <div className="w-full max-w-[104px] aspect-square mx-auto border border-[#1C1B18] grid grid-cols-9 grid-rows-9 bg-white/80">
      {grid.map((row, r) =>
        row.map((val, c) => {
          const isGiven = data.puzzle[r][c] > 0;
          const borderR = (c + 1) % 3 === 0 && c < 8 ? 'border-r border-r-[#1C1B18]' : 'border-r border-r-[#1C1B18]/20';
          const borderB = (r + 1) % 3 === 0 && r < 8 ? 'border-b border-b-[#1C1B18]' : 'border-b border-b-[#1C1B18]/20';
          return (
            <div
              key={`${r}-${c}`}
              className={`flex items-center justify-center text-[5.5px] leading-none font-mono ${borderR} ${borderB} ${
                isGiven ? 'font-bold text-[#1C1B18]' : 'text-[#3F3F46]'
              }`}
            >
              {val > 0 ? val : ''}
            </div>
          );
        })
      )}
    </div>
  );
}

function MiniKakuro({ data, solved = false }: { data: KakuroPuzzleData; solved?: boolean }) {
  const n = data.size;
  return (
    <div
      className="w-full max-w-[98px] aspect-square mx-auto border border-[#1C1B18] grid bg-white/80"
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      {data.grid.map((row, r) =>
        row.map((cell, c) => {
          if (cell.type === 'black') {
            return <div key={`${r}-${c}`} className="bg-[#242320] border border-[#1C1B18]/40" />;
          }
          if (cell.type === 'clue') {
            return (
              <div
                key={`${r}-${c}`}
                className="relative bg-[#242320] border border-[#1C1B18]/40 text-white overflow-hidden"
              >
                <svg viewBox="0 0 10 10" className="absolute inset-0 w-full h-full">
                  <line x1="0" y1="0" x2="10" y2="10" stroke="#7A766E" strokeWidth="0.6" />
                </svg>
                {cell.acrossSum && (
                  <span className="absolute top-0 right-[1px] text-[4.5px] font-mono leading-none">
                    {cell.acrossSum}
                  </span>
                )}
                {cell.downSum && (
                  <span className="absolute bottom-0 left-[1px] text-[4.5px] font-mono leading-none">
                    {cell.downSum}
                  </span>
                )}
              </div>
            );
          }
          return (
            <div
              key={`${r}-${c}`}
              className="border border-[#1C1B18]/30 flex items-center justify-center text-[5.5px] font-mono text-[#3F3F46]"
            >
              {solved ? cell.solution : ''}
            </div>
          );
        })
      )}
    </div>
  );
}

function MiniCalcudoku({ data, solved = false }: { data: CalcudokuPuzzleData; solved?: boolean }) {
  const n = data.size;
  const cageMap = Array.from({ length: n }, () => Array(n).fill(0));
  const labelMap = new Map<string, string>();

  for (const cage of data.cages) {
    const sorted = [...cage.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    labelMap.set(`${sorted[0][0]}-${sorted[0][1]}`, `${cage.target}${cage.op}`);
    for (const [r, c] of cage.cells) {
      cageMap[r][c] = cage.id;
    }
  }

  return (
    <div
      className="w-full max-w-[98px] aspect-square mx-auto grid bg-white/80"
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: n }).map((_, r) =>
        Array.from({ length: n }).map((__, c) => {
          const id = cageMap[r][c];
          const top = r === 0 || cageMap[r - 1][c] !== id ? 'border-t border-t-[#1C1B18]' : 'border-t border-t-[#1C1B18]/15';
          const bot = r === n - 1 || cageMap[r + 1][c] !== id ? 'border-b border-b-[#1C1B18]' : 'border-b border-b-[#1C1B18]/15';
          const left = c === 0 || cageMap[r][c - 1] !== id ? 'border-l border-l-[#1C1B18]' : 'border-l border-l-[#1C1B18]/15';
          const right = c === n - 1 || cageMap[r][c + 1] !== id ? 'border-r border-r-[#1C1B18]' : 'border-r border-r-[#1C1B18]/15';
          const cornerLabel = labelMap.get(`${r}-${c}`);
          return (
            <div
              key={`${r}-${c}`}
              className={`relative flex items-center justify-center ${top} ${bot} ${left} ${right}`}
            >
              {cornerLabel && (
                <span className="absolute top-[1px] left-[1px] text-[4.5px] leading-none font-mono text-[#1C1B18]">
                  {cornerLabel}
                </span>
              )}
              {solved && (
                <span className="text-[6px] font-mono text-[#3F3F46] mt-1">
                  {data.solution[r][c]}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function MiniCrossword({ data, solved = false }: { data: CrosswordPuzzleData; solved?: boolean }) {
  const cw = data.data;
  let num = 1;
  return (
    <div className="w-full flex flex-col items-center gap-1">
      <div
        className="w-full max-w-[92px] aspect-square border border-[#1C1B18] grid bg-white"
        style={{ gridTemplateColumns: `repeat(${cw.width}, minmax(0, 1fr))` }}
      >
        {cw.solutionGrid.map((row, r) =>
          row.map((ch, c) => {
            if (ch === '.') {
              return <div key={`${r}-${c}`} className="bg-[#1C1B18]" />;
            }
            const startsA =
              (c === 0 || cw.solutionGrid[r][c - 1] === '.') &&
              c + 1 < cw.width &&
              cw.solutionGrid[r][c + 1] !== '.';
            const startsD =
              (r === 0 || cw.solutionGrid[r - 1][c] === '.') &&
              r + 1 < cw.height &&
              cw.solutionGrid[r + 1][c] !== '.';
            const displayNum = startsA || startsD ? num++ : null;
            return (
              <div
                key={`${r}-${c}`}
                className="relative border border-[#1C1B18]/40 flex items-center justify-center"
              >
                {displayNum && !solved && (
                  <span className="absolute top-[0.5px] left-[1px] text-[4px] leading-none font-mono text-[#6E6A61]">
                    {displayNum}
                  </span>
                )}
                {solved && (
                  <span className="text-[6px] font-mono font-semibold text-[#3F3F46]">
                    {ch}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      {!solved && (
        <div className="w-full grid grid-cols-2 gap-1 text-[4.5px] leading-[1.2] text-[#4B4842] px-0.5">
          <div className="truncate">
            <span className="font-semibold text-[#3F3F46]">A: </span>
            {cw.acrossClues.slice(0, 3).map((x) => `${x.number}.${x.clue}`).join(' · ')}
          </div>
          <div className="truncate">
            <span className="font-semibold text-[#3F3F46]">D: </span>
            {cw.downClues.slice(0, 3).map((x) => `${x.number}.${x.clue}`).join(' · ')}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniWordGrid({ data, solved = false }: { data: WordGridPuzzleData; solved?: boolean }) {
  if (solved) {
    return (
      <div
        className="w-full max-w-[78px] aspect-square mx-auto grid"
        style={{ gridTemplateColumns: `repeat(${data.gridSize}, minmax(0, 1fr))` }}
      >
        {data.sampleSolutionGrid.map((row, r) =>
          row.map((ch, c) => (
            <div
              key={`${r}-${c}`}
              className={`flex items-center justify-center text-[5px] font-mono ${
                ch ? 'border border-[#1C1B18] bg-white text-[#3F3F46]' : ''
              }`}
            >
              {ch}
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-1.5">
      <div className="grid grid-cols-7 gap-[2px] w-full max-w-[116px]">
        {data.tiles.slice(0, 21).map((ch, i) => (
          <div
            key={i}
            className="aspect-square border border-[#1C1B18]/70 bg-white flex items-center justify-center text-[5.5px] font-mono font-semibold"
          >
            {ch}
          </div>
        ))}
      </div>
      <div className="w-full max-w-[96px] aspect-[4/3] grid grid-cols-8 grid-rows-6 border border-[#1C1B18]/25">
        {Array.from({ length: 48 }).map((_, idx) => (
          <div key={idx} className="border border-[#1C1B18]/10" />
        ))}
      </div>
    </div>
  );
}

function MiniLineArt({ data }: { data: LineArtPuzzleData }) {
  const vb = data.viewBoxSize || 100;
  const strokeWidth = data.lineWeight === 'Medium' ? vb * 0.011 : vb * 0.0065;
  const isDashed = data.tracingLineStyle === 'faint-dashed';

  return (
    <div className="w-full flex flex-col items-center gap-1">
      <svg
        viewBox={`0 0 ${vb} ${vb}`}
        className="w-full max-w-[104px] aspect-square mx-auto"
      >
        {data.paths.map((d, idx) => (
          <path
            key={idx}
            d={d}
            fill="none"
            stroke="#9B958C"
            strokeOpacity={0.62}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={isDashed ? `${vb * 0.025} ${vb * 0.02}` : undefined}
          />
        ))}
      </svg>
      <div className="w-full text-center px-0.5">
        <div className="font-serif text-[5.5px] leading-tight text-[#4B4842] truncate">
          {data.title}
        </div>
        <div className="text-[4.3px] leading-tight text-[#78746C] truncate">
          {data.attribution}
        </div>
      </div>
    </div>
  );
}

function renderMiniPuzzle(item: RenderedPuzzleItem, solved = false) {
  switch (item.kind) {
    case 'sudoku':
      return <MiniSudoku data={item} solved={solved} />;
    case 'kakuro':
      return <MiniKakuro data={item} solved={solved} />;
    case 'calcudoku':
      return <MiniCalcudoku data={item} solved={solved} />;
    case 'crossword':
      return <MiniCrossword data={item} solved={solved} />;
    case 'word-grid':
      return <MiniWordGrid data={item} solved={solved} />;
    case 'line-art':
      return <MiniLineArt data={item} />;
  }
}

export const PageContentPreview: React.FC<PageContentPreviewProps> = ({
  page,
  specs,
  stats,
}) => {
  const paperClass = getPaperClass(specs.paperStyle);

  if (page.kind === 'front-cover') {
    return (
      <div className={`w-full h-full p-2.5 flex flex-col justify-between ${paperClass} relative`}>
        <div className="w-full h-full border border-[#1C1B18] p-2 flex flex-col justify-between">
          <div>
            <div className="font-mono text-[6px] uppercase tracking-wider text-[#6E6A61] truncate">
              {specs.editionString || 'Pocket Edition'}
            </div>
            <div className="mt-1.5 font-serif font-semibold text-[11px] leading-[1.15] text-[#1C1B18] line-clamp-3">
              {specs.coverTitle || 'Pocket Puzzle Press'}
            </div>
            {specs.coverSubtitle && (
              <div className="mt-1 text-[6.5px] text-[#57534E] leading-tight line-clamp-2">
                {specs.coverSubtitle}
              </div>
            )}
          </div>

          <div className="my-auto flex items-center justify-center px-2 overflow-hidden">
            {specs.coverImage ? (
              <img
                src={specs.coverImage.dataUrl}
                alt={specs.coverImage.filename}
                className="max-w-full max-h-[56px] object-contain"
              />
            ) : (
              <div className="w-8 h-8 border border-[#3F3F46] flex items-center justify-center">
                <div className="w-4 h-4 rounded-full border border-[#1C1B18]" />
              </div>
            )}
          </div>

          <div className="font-mono text-[5.5px] text-[#6E6A61] flex items-center justify-between border-t border-[#1C1B18]/15 pt-1">
            <span>
              {specs.widthIn.toFixed(2)}&Prime;×{specs.heightIn.toFixed(2)}&Prime;
            </span>
            <span>{stats.paddedTotalPages} pp</span>
          </div>
        </div>
      </div>
    );
  }

  if (page.kind === 'back-cover') {
    return (
      <div className={`w-full h-full p-3 flex flex-col justify-between ${paperClass}`}>
        <div />
        <div className="space-y-1 text-center">
          <div className="font-mono text-[6.5px] tracking-widest uppercase text-[#1C1B18]">
            Pocket Puzzle Press
          </div>
          <div className="text-[5.5px] text-[#6E6A61]">
            {stats.paddedTotalPages} pages · {stats.duplexSheets} duplex sheet{stats.duplexSheets > 1 ? 's' : ''}
          </div>
        </div>
        <div className="font-mono text-[5.5px] text-[#6E6A61] text-right">
          p.{page.pageNumber}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full p-2.5 flex flex-col justify-between ${paperClass}`}>
      <div className="flex items-center justify-between border-b border-[#1C1B18]/15 pb-0.5">
        <span className="font-mono text-[5.5px] uppercase tracking-wider text-[#6E6A61] truncate">
          {page.headerLabel}
        </span>
        <span className="font-mono text-[5.5px] text-[#6E6A61]">p.{page.pageNumber}</span>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-1.5 py-1 overflow-hidden">
        {page.kind === 'dot-grid-filler' && (
          <div className="w-full h-full paper-dot-grid border border-dashed border-[#1C1B18]/15 flex items-end justify-end p-1">
            <span className="font-mono text-[5px] text-[#6E6A61]">NOTES / PADDING</span>
          </div>
        )}

        {page.kind === 'answer-key' && page.answerEntries && (
          <div className="grid grid-cols-2 gap-1.5">
            {page.answerEntries.map((entry) => (
              <div key={entry.puzzleNumber} className="flex flex-col items-center gap-0.5">
                <span className="font-mono text-[4.8px] text-[#57534E] truncate max-w-full">
                  {entry.label}
                </span>
                <div className="w-full scale-90 origin-top">
                  {renderMiniPuzzle(entry.puzzle, true)}
                </div>
              </div>
            ))}
          </div>
        )}

        {page.kind === 'puzzle' &&
          page.puzzles?.map((item, idx) => (
            <div key={idx} className="w-full flex items-center justify-center">
              {renderMiniPuzzle(item, false)}
            </div>
          ))}
      </div>

      <div className="text-center font-mono text-[5.5px] text-[#6E6A61] tabular-nums">
        {page.pageNumber}
      </div>
    </div>
  );
};
