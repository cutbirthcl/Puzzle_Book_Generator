import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import {
  BookletPage,
  CalcudokuPuzzleData,
  CrosswordPuzzleData,
  KakuroPuzzleData,
  LineArtPuzzleData,
  PaperStyle,
  PrintSpecs,
  RenderedPuzzleItem,
  SudokuPuzzleData,
  WordGridPuzzleData,
} from '../types/booklet';
import { dataUrlToUint8Array } from './imageProcessor';
import { BookletCompilation } from './imposition';

const PT_PER_IN = 72;
const LETTER_W = 11 * PT_PER_IN; // 792 pt
const LETTER_H = 8.5 * PT_PER_IN; // 612 pt

const INK = rgb(0.08, 0.08, 0.08);
const INK_MUTED = rgb(0.42, 0.42, 0.42);
const INK_FAINT = rgb(0.76, 0.76, 0.76);
const ACCENT = rgb(0.22, 0.22, 0.22);
const WHITE_BG = rgb(1, 1, 1);

interface Fonts {
  serif: PDFFont;
  serifBold: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
  mono: PDFFont;
}

function drawPaperBackground(
  pdfPage: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  style: PaperStyle
) {
  pdfPage.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: WHITE_BG,
  });

  const step = 14; // ~5mm
  if (style === 'dot-grid') {
    for (let gx = x + step; gx < x + w - 4; gx += step) {
      for (let gy = y + step; gy < y + h - 4; gy += step) {
        pdfPage.drawCircle({
          x: gx,
          y: gy,
          size: 0.6,
          color: rgb(0.76, 0.74, 0.7),
        });
      }
    }
  } else if (style === 'graph-grid') {
    for (let gx = x + step; gx < x + w - 2; gx += step) {
      pdfPage.drawLine({
        start: { x: gx, y: y + 4 },
        end: { x: gx, y: y + h - 4 },
        thickness: 0.3,
        color: rgb(0.88, 0.87, 0.84),
      });
    }
    for (let gy = y + step; gy < y + h - 2; gy += step) {
      pdfPage.drawLine({
        start: { x: x + 4, y: gy },
        end: { x: x + w - 4, y: gy },
        thickness: 0.3,
        color: rgb(0.88, 0.87, 0.84),
      });
    }
  }
}

function drawCropMarks(
  pdfPage: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  offset = 4,
  len = 12
) {
  const color = rgb(0.25, 0.25, 0.25);
  const t = 0.5;
  // Bottom-left
  pdfPage.drawLine({ start: { x: x - offset - len, y }, end: { x: x - offset, y }, thickness: t, color });
  pdfPage.drawLine({ start: { x, y: y - offset - len }, end: { x, y: y - offset }, thickness: t, color });
  // Bottom-right
  pdfPage.drawLine({ start: { x: x + w + offset, y }, end: { x: x + w + offset + len, y }, thickness: t, color });
  pdfPage.drawLine({ start: { x: x + w, y: y - offset - len }, end: { x: x + w, y: y - offset }, thickness: t, color });
  // Top-left
  pdfPage.drawLine({ start: { x: x - offset - len, y: y + h }, end: { x: x - offset, y: y + h }, thickness: t, color });
  pdfPage.drawLine({ start: { x, y: y + h + offset }, end: { x, y: y + h + offset + len }, thickness: t, color });
  // Top-right
  pdfPage.drawLine({ start: { x: x + w + offset, y: y + h }, end: { x: x + w + offset + len, y: y + h }, thickness: t, color });
  pdfPage.drawLine({ start: { x: x + w, y: y + h + offset }, end: { x: x + w, y: y + h + offset + len }, thickness: t, color });
}

function drawCenterFoldLine(pdfPage: PDFPage, x: number, y: number, h: number) {
  pdfPage.drawLine({
    start: { x, y: y - 10 },
    end: { x, y: y + h + 10 },
    thickness: 0.6,
    dashArray: [4, 4],
    color: ACCENT,
  });
}

function drawSudoku(
  pdfPage: PDFPage,
  data: SudokuPuzzleData,
  x: number,
  y: number,
  size: number,
  fonts: Fonts,
  showSolution = false
) {
  const cell = size / 9;
  const grid = showSolution ? data.solution : data.puzzle;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = grid[r][c];
      if (val > 0) {
        const isGiven = data.puzzle[r][c] > 0;
        const txt = String(val);
        const fontSize = Math.max(6, cell * 0.56);
        const tw = fonts.mono.widthOfTextAtSize(txt, fontSize);
        pdfPage.drawText(txt, {
          x: x + c * cell + (cell - tw) / 2,
          y: y + size - (r + 1) * cell + (cell - fontSize) * 0.38,
          size: fontSize,
          font: isGiven ? fonts.sansBold : fonts.mono,
          color: isGiven ? INK : ACCENT,
        });
      }
    }
  }

  for (let i = 0; i <= 9; i++) {
    const thick = i % 3 === 0 ? 1.25 : 0.35;
    const col = i % 3 === 0 ? INK : INK_MUTED;
    pdfPage.drawLine({
      start: { x: x + i * cell, y },
      end: { x: x + i * cell, y: y + size },
      thickness: thick,
      color: col,
    });
    pdfPage.drawLine({
      start: { x, y: y + i * cell },
      end: { x: x + size, y: y + i * cell },
      thickness: thick,
      color: col,
    });
  }
}

function drawKakuro(
  pdfPage: PDFPage,
  data: KakuroPuzzleData,
  x: number,
  y: number,
  size: number,
  fonts: Fonts,
  showSolution = false
) {
  const n = data.size;
  const cell = size / n;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const item = data.grid[r][c];
      const cx = x + c * cell;
      const cy = y + size - (r + 1) * cell;

      if (item.type === 'black' || item.type === 'clue') {
        pdfPage.drawRectangle({
          x: cx,
          y: cy,
          width: cell,
          height: cell,
          color: rgb(0.16, 0.16, 0.15),
        });
      }
      if (item.type === 'clue') {
        pdfPage.drawLine({
          start: { x: cx, y: cy + cell },
          end: { x: cx + cell, y: cy },
          thickness: 0.45,
          color: rgb(0.6, 0.59, 0.56),
        });
        const fs = Math.max(5, cell * 0.28);
        if (item.acrossSum) {
          pdfPage.drawText(String(item.acrossSum), {
            x: cx + cell * 0.54,
            y: cy + cell * 0.6,
            size: fs,
            font: fonts.mono,
            color: WHITE_BG,
          });
        }
        if (item.downSum) {
          pdfPage.drawText(String(item.downSum), {
            x: cx + cell * 0.12,
            y: cy + cell * 0.15,
            size: fs,
            font: fonts.mono,
            color: WHITE_BG,
          });
        }
      } else if (item.type === 'empty' && showSolution && item.solution) {
        const txt = String(item.solution);
        const fs = Math.max(6, cell * 0.52);
        const tw = fonts.mono.widthOfTextAtSize(txt, fs);
        pdfPage.drawText(txt, {
          x: cx + (cell - tw) / 2,
          y: cy + (cell - fs) * 0.38,
          size: fs,
          font: fonts.mono,
          color: ACCENT,
        });
      }

      pdfPage.drawRectangle({
        x: cx,
        y: cy,
        width: cell,
        height: cell,
        borderColor: INK,
        borderWidth: 0.5,
      });
    }
  }
}

function drawCalcudoku(
  pdfPage: PDFPage,
  data: CalcudokuPuzzleData,
  x: number,
  y: number,
  size: number,
  fonts: Fonts,
  showSolution = false
) {
  const n = data.size;
  const cell = size / n;
  const cageMap = Array.from({ length: n }, () => Array(n).fill(0));
  for (const cage of data.cages) {
    for (const [r, c] of cage.cells) {
      cageMap[r][c] = cage.id;
    }
  }

  // Thin inner grid
  for (let i = 0; i <= n; i++) {
    pdfPage.drawLine({
      start: { x: x + i * cell, y },
      end: { x: x + i * cell, y: y + size },
      thickness: 0.35,
      color: INK_FAINT,
    });
    pdfPage.drawLine({
      start: { x, y: y + i * cell },
      end: { x: x + size, y: y + i * cell },
      thickness: 0.35,
      color: INK_FAINT,
    });
  }

  // Cage borders & labels
  for (const cage of data.cages) {
    const sorted = [...cage.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const [topR, topC] = sorted[0];
    const label = `${cage.target}${cage.op}`;
    const fs = Math.max(5, cell * 0.26);
    pdfPage.drawText(label, {
      x: x + topC * cell + 2,
      y: y + size - topR * cell - fs - 1.5,
      size: fs,
      font: fonts.mono,
      color: INK,
    });
  }

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cx = x + c * cell;
      const cy = y + size - (r + 1) * cell;
      const id = cageMap[r][c];

      if (r === 0 || cageMap[r - 1][c] !== id) {
        pdfPage.drawLine({ start: { x: cx, y: cy + cell }, end: { x: cx + cell, y: cy + cell }, thickness: 1.2, color: INK });
      }
      if (r === n - 1 || cageMap[r + 1][c] !== id) {
        pdfPage.drawLine({ start: { x: cx, y: cy }, end: { x: cx + cell, y: cy }, thickness: 1.2, color: INK });
      }
      if (c === 0 || cageMap[r][c - 1] !== id) {
        pdfPage.drawLine({ start: { x: cx, y: cy }, end: { x: cx, y: cy + cell }, thickness: 1.2, color: INK });
      }
      if (c === n - 1 || cageMap[r][c + 1] !== id) {
        pdfPage.drawLine({ start: { x: cx + cell, y: cy }, end: { x: cx + cell, y: cy + cell }, thickness: 1.2, color: INK });
      }

      if (showSolution) {
        const txt = String(data.solution[r][c]);
        const fs = Math.max(6, cell * 0.45);
        const tw = fonts.mono.widthOfTextAtSize(txt, fs);
        pdfPage.drawText(txt, {
          x: cx + (cell - tw) / 2,
          y: cy + cell * 0.16,
          size: fs,
          font: fonts.mono,
          color: ACCENT,
        });
      }
    }
  }
}

function drawCrossword(
  pdfPage: PDFPage,
  data: CrosswordPuzzleData,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: Fonts,
  showSolution = false
) {
  const cw = data.data;
  const maxGrid = showSolution ? Math.min(w, h) : Math.min(w, h * 0.52);
  const cell = Math.min(maxGrid / cw.width, maxGrid / cw.height);
  const gridW = cell * cw.width;
  const gridH = cell * cw.height;
  const gx = x + (w - gridW) / 2;
  const gy = y + h - gridH;

  let num = 1;
  for (let r = 0; r < cw.height; r++) {
    for (let c = 0; c < cw.width; c++) {
      const ch = cw.solutionGrid[r][c];
      const cx = gx + c * cell;
      const cy = gy + gridH - (r + 1) * cell;
      if (ch === '.') {
        pdfPage.drawRectangle({ x: cx, y: cy, width: cell, height: cell, color: INK });
      } else {
        pdfPage.drawRectangle({
          x: cx,
          y: cy,
          width: cell,
          height: cell,
          borderColor: INK,
          borderWidth: 0.6,
        });
        const startsA =
          (c === 0 || cw.solutionGrid[r][c - 1] === '.') &&
          c + 1 < cw.width &&
          cw.solutionGrid[r][c + 1] !== '.';
        const startsD =
          (r === 0 || cw.solutionGrid[r - 1][c] === '.') &&
          r + 1 < cw.height &&
          cw.solutionGrid[r + 1][c] !== '.';

        if (startsA || startsD) {
          if (!showSolution) {
            pdfPage.drawText(String(num), {
              x: cx + 1.5,
              y: cy + cell - Math.max(4.5, cell * 0.25) - 1,
              size: Math.max(4.5, cell * 0.25),
              font: fonts.mono,
              color: INK_MUTED,
            });
          }
          num++;
        }

        if (showSolution) {
          const fs = Math.max(5.5, cell * 0.52);
          const tw = fonts.mono.widthOfTextAtSize(ch, fs);
          pdfPage.drawText(ch, {
            x: cx + (cell - tw) / 2,
            y: cy + (cell - fs) * 0.35,
            size: fs,
            font: fonts.mono,
            color: ACCENT,
          });
        }
      }
    }
  }

  if (!showSolution) {
    let clueY = gy - 12;
    const clueFs = Math.max(5.5, Math.min(7.2, w / 34));
    const colW = (w - 8) / 2;

    const drawClueCol = (
      heading: string,
      items: Array<{ number: number; clue: string }>,
      colX: number
    ) => {
      let cy = clueY;
      pdfPage.drawText(heading, {
        x: colX,
        y: cy,
        size: clueFs + 0.5,
        font: fonts.sansBold,
        color: ACCENT,
      });
      cy -= clueFs + 4;
      for (const item of items.slice(0, 8)) {
        if (cy < y + 4) break;
        const line = `${item.number}. ${item.clue}`.slice(0, 32);
        pdfPage.drawText(line, {
          x: colX,
          y: cy,
          size: clueFs,
          font: fonts.sans,
          color: INK,
        });
        cy -= clueFs + 3;
      }
    };

    drawClueCol('ACROSS', cw.acrossClues, x);
    drawClueCol('DOWN', cw.downClues, x + colW + 8);
  }
}

function drawWordGrid(
  pdfPage: PDFPage,
  data: WordGridPuzzleData,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: Fonts,
  showSolution = false
) {
  if (showSolution) {
    const n = data.gridSize;
    const cell = Math.min(w, h) / n;
    const gx = x + (w - cell * n) / 2;
    const gy = y + (h - cell * n) / 2;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const ch = data.sampleSolutionGrid[r][c];
        if (!ch) continue;
        const cx = gx + c * cell;
        const cy = gy + cell * n - (r + 1) * cell;
        pdfPage.drawRectangle({
          x: cx,
          y: cy,
          width: cell,
          height: cell,
          borderColor: INK,
          borderWidth: 0.5,
        });
        const fs = Math.max(5.5, cell * 0.52);
        pdfPage.drawText(ch, {
          x: cx + cell * 0.28,
          y: cy + (cell - fs) * 0.35,
          size: fs,
          font: fonts.mono,
          color: ACCENT,
        });
      }
    }
    return;
  }

  // Tile rack
  const cols = 7;
  const tileSize = Math.min(20, (w - 12) / cols);
  const rackW = cols * tileSize;
  const rx = x + (w - rackW) / 2;
  let ry = y + h - tileSize - 2;

  data.tiles.slice(0, 21).forEach((letter, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const tx = rx + col * tileSize;
    const ty = ry - row * (tileSize + 3);
    pdfPage.drawRectangle({
      x: tx + 1,
      y: ty,
      width: tileSize - 2,
      height: tileSize - 2,
      borderColor: INK,
      borderWidth: 0.7,
      color: WHITE_BG,
    });
    const fs = tileSize * 0.5;
    const tw = fonts.mono.widthOfTextAtSize(letter, fs);
    pdfPage.drawText(letter, {
      x: tx + (tileSize - tw) / 2,
      y: ty + (tileSize - fs) * 0.35,
      size: fs,
      font: fonts.mono,
      color: INK,
    });
  });

  // Blank intersecting workspace grid below
  const rowsUsed = Math.ceil(Math.min(21, data.tiles.length) / cols);
  const gridTop = ry - rowsUsed * (tileSize + 3) - 6;
  const availH = gridTop - y - 4;
  const n = 8;
  const cell = Math.min(w / n, availH / n);
  const gx = x + (w - cell * n) / 2;
  const gy = gridTop - cell * n;
  for (let i = 0; i <= n; i++) {
    pdfPage.drawLine({
      start: { x: gx + i * cell, y: gy },
      end: { x: gx + i * cell, y: gy + cell * n },
      thickness: 0.35,
      color: INK_FAINT,
    });
    pdfPage.drawLine({
      start: { x: gx, y: gy + i * cell },
      end: { x: gx + cell * n, y: gy + i * cell },
      thickness: 0.35,
      color: INK_FAINT,
    });
  }
}

function drawLineArt(
  pdfPage: PDFPage,
  data: LineArtPuzzleData,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: Fonts
) {
  const captionH = 18;
  const availH = Math.max(24, h - captionH);
  const box = Math.min(w, availH);
  const ox = x + (w - box) / 2;
  const topY = y + h - (availH - box) / 2;
  const scale = box / (data.viewBoxSize || 100);
  const thickness = data.lineWeight === 'Medium' ? 0.9 : 0.5;
  // Light tracing ink tone so pens trace cleanly over the guide
  const traceColor = rgb(0.68, 0.66, 0.62);
  const dash = data.tracingLineStyle === 'faint-dashed' ? [2.2, 2.0] : undefined;

  for (const pathStr of data.paths) {
    pdfPage.drawSvgPath(pathStr, {
      x: ox,
      y: topY,
      scale,
      borderColor: traceColor,
      borderWidth: thickness,
      borderOpacity: 0.72,
      borderDashArray: dash,
    });
  }

  pdfPage.drawText(data.title.slice(0, 40), {
    x,
    y: y + 8,
    size: 6,
    font: fonts.serif,
    color: INK_MUTED,
  });
  pdfPage.drawText(data.attribution.slice(0, 52), {
    x,
    y: y + 1,
    size: 5,
    font: fonts.sans,
    color: INK_MUTED,
  });
}

function drawRenderedPuzzle(
  pdfPage: PDFPage,
  puzzle: RenderedPuzzleItem,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: Fonts,
  showSolution = false
) {
  switch (puzzle.kind) {
    case 'sudoku': {
      const s = Math.min(w, h);
      drawSudoku(pdfPage, puzzle, x + (w - s) / 2, y + (h - s) / 2, s, fonts, showSolution);
      break;
    }
    case 'kakuro': {
      const s = Math.min(w, h);
      drawKakuro(pdfPage, puzzle, x + (w - s) / 2, y + (h - s) / 2, s, fonts, showSolution);
      break;
    }
    case 'calcudoku': {
      const s = Math.min(w, h);
      drawCalcudoku(pdfPage, puzzle, x + (w - s) / 2, y + (h - s) / 2, s, fonts, showSolution);
      break;
    }
    case 'crossword':
      drawCrossword(pdfPage, puzzle, x, y, w, h, fonts, showSolution);
      break;
    case 'word-grid':
      drawWordGrid(pdfPage, puzzle, x, y, w, h, fonts, showSolution);
      break;
    case 'line-art':
      drawLineArt(pdfPage, puzzle, x, y, w, h, fonts);
      break;
  }
}

function drawBookletPage(
  pdfPage: PDFPage,
  page: BookletPage,
  x: number,
  y: number,
  w: number,
  h: number,
  specs: PrintSpecs,
  compilation: BookletCompilation,
  fonts: Fonts,
  embeddedCoverImage?: PDFImage
) {
  drawPaperBackground(pdfPage, x, y, w, h, specs.paperStyle);

  const margin = Math.max(10, Math.min(specs.marginIn * PT_PER_IN, w * 0.14));
  const ix = x + margin;
  const iy = y + margin;
  const iw = w - margin * 2;
  const ih = h - margin * 2;

  if (page.kind === 'front-cover') {
    // Crisp editorial cover frame
    pdfPage.drawRectangle({
      x: ix,
      y: iy,
      width: iw,
      height: ih,
      borderColor: INK,
      borderWidth: 1,
    });
    pdfPage.drawRectangle({
      x: ix + 4,
      y: iy + 4,
      width: iw - 8,
      height: ih - 8,
      borderColor: INK_FAINT,
      borderWidth: 0.4,
    });

    const edition = specs.editionString || 'Pocket Edition';
    pdfPage.drawText(edition.toUpperCase(), {
      x: ix + 14,
      y: iy + ih - 24,
      size: 6.5,
      font: fonts.mono,
      color: INK_MUTED,
    });

    // Title wrapping
    const titleWords = (specs.coverTitle || 'Pocket Puzzle Press').split(' ');
    const lines: string[] = [];
    let current = '';
    const titleSize = Math.min(20, Math.max(13, w / 14));
    for (const word of titleWords) {
      const test = current ? `${current} ${word}` : word;
      if (fonts.serifBold.widthOfTextAtSize(test, titleSize) > iw - 28 && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);

    let ty = iy + ih * 0.68;
    for (const line of lines.slice(0, 4)) {
      pdfPage.drawText(line, {
        x: ix + 14,
        y: ty,
        size: titleSize,
        font: fonts.serifBold,
        color: INK,
      });
      ty -= titleSize * 1.18;
    }

    if (specs.coverSubtitle) {
      pdfPage.drawText(specs.coverSubtitle.slice(0, 44), {
        x: ix + 14,
        y: ty - 6,
        size: 8.5,
        font: fonts.sans,
        color: INK_MUTED,
      });
    }

    if (embeddedCoverImage) {
      const maxBoxW = Math.max(24, iw - 28);
      const maxBoxH = Math.max(24, ih * 0.34);
      const scale = Math.min(
        maxBoxW / embeddedCoverImage.width,
        maxBoxH / embeddedCoverImage.height
      );
      const drawW = embeddedCoverImage.width * scale;
      const drawH = embeddedCoverImage.height * scale;
      const centerX = ix + (iw - drawW) / 2;
      const centerY = iy + ih * 0.31 - drawH / 2;
      pdfPage.drawImage(embeddedCoverImage, {
        x: centerX,
        y: Math.max(iy + 26, centerY),
        width: drawW,
        height: drawH,
      });
    } else {
      // Default geometric press emblem near lower center
      const cx = ix + iw / 2;
      const cy = iy + ih * 0.28;
      const r = Math.min(iw, ih) * 0.14;
      pdfPage.drawRectangle({
        x: cx - r,
        y: cy - r,
        width: r * 2,
        height: r * 2,
        borderColor: ACCENT,
        borderWidth: 0.9,
      });
      pdfPage.drawCircle({
        x: cx,
        y: cy,
        size: r * 0.62,
        borderColor: INK,
        borderWidth: 0.7,
      });
    }

    const footerStr = `${specs.widthIn.toFixed(2)}" x ${specs.heightIn.toFixed(2)}" · ${compilation.stats.paddedTotalPages} PAGES`;
    pdfPage.drawText(footerStr, {
      x: ix + 14,
      y: iy + 14,
      size: 6.5,
      font: fonts.mono,
      color: INK_MUTED,
    });
    return;
  }

  if (page.kind === 'back-cover') {
    pdfPage.drawText('POCKET PUZZLE PRESS', {
      x: ix + 8,
      y: iy + ih * 0.55,
      size: 8,
      font: fonts.mono,
      color: INK,
    });
    pdfPage.drawText(
      `Signature: ${compilation.stats.paddedTotalPages} pp · ${compilation.stats.duplexSheets} US Letter sheets`,
      {
        x: ix + 8,
        y: iy + ih * 0.55 - 14,
        size: 6.5,
        font: fonts.sans,
        color: INK_MUTED,
      }
    );
    pdfPage.drawText(`Edition: ${specs.editionString || 'Standard'}`, {
      x: ix + 8,
      y: iy + ih * 0.55 - 26,
      size: 6.5,
      font: fonts.sans,
      color: INK_MUTED,
    });
    pdfPage.drawText(`p.${page.pageNumber}`, {
      x: ix + iw - 20,
      y: iy + 4,
      size: 6.5,
      font: fonts.mono,
      color: INK_MUTED,
    });
    return;
  }

  // Header & Footer folio for interior pages
  pdfPage.drawText((page.headerLabel || '').toUpperCase(), {
    x: ix,
    y: iy + ih - 8,
    size: 6.5,
    font: fonts.mono,
    color: INK_MUTED,
  });
  pdfPage.drawLine({
    start: { x: ix, y: iy + ih - 12 },
    end: { x: ix + iw, y: iy + ih - 12 },
    thickness: 0.4,
    color: INK_FAINT,
  });

  const pgStr = String(page.pageNumber);
  const pgW = fonts.mono.widthOfTextAtSize(pgStr, 6.5);
  pdfPage.drawText(pgStr, {
    x: ix + (iw - pgW) / 2,
    y: iy + 2,
    size: 6.5,
    font: fonts.mono,
    color: INK_MUTED,
  });

  const bodyX = ix;
  const bodyY = iy + 12;
  const bodyW = iw;
  const bodyH = ih - 28;

  if (page.kind === 'dot-grid-filler') {
    // Draw subtle dot grid notes frame
    const step = 13;
    for (let dx = bodyX + 6; dx < bodyX + bodyW - 4; dx += step) {
      for (let dy = bodyY + 6; dy < bodyY + bodyH - 4; dy += step) {
        pdfPage.drawCircle({
          x: dx,
          y: dy,
          size: 0.65,
          color: rgb(0.58, 0.56, 0.52),
        });
      }
    }
    return;
  }

  if (page.kind === 'answer-key' && page.answerEntries) {
    const entries = page.answerEntries;
    const cols = 2;
    const rows = 2;
    const slotW = (bodyW - 8) / cols;
    const slotH = (bodyH - 8) / rows;
    entries.forEach((entry, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const sx = bodyX + col * (slotW + 8);
      const sy = bodyY + bodyH - (row + 1) * slotH - row * 8;
      pdfPage.drawText(entry.label, {
        x: sx,
        y: sy + slotH - 8,
        size: 6,
        font: fonts.mono,
        color: INK,
      });
      drawRenderedPuzzle(
        pdfPage,
        entry.puzzle,
        sx,
        sy,
        slotW,
        slotH - 12,
        fonts,
        true
      );
    });
    return;
  }

  if (page.kind === 'puzzle' && page.puzzles && page.puzzles.length > 0) {
    const items = page.puzzles;
    if (items.length === 1) {
      drawRenderedPuzzle(pdfPage, items[0], bodyX, bodyY, bodyW, bodyH, fonts, false);
    } else {
      const gap = 10;
      const slotH = (bodyH - gap) / 2;
      drawRenderedPuzzle(
        pdfPage,
        items[0],
        bodyX,
        bodyY + slotH + gap,
        bodyW,
        slotH,
        fonts,
        false
      );
      drawRenderedPuzzle(pdfPage, items[1], bodyX, bodyY, bodyW, slotH, fonts, false);
    }
  }
}

export async function generateImposedPdfBytes(
  specs: PrintSpecs,
  compilation: BookletCompilation
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(specs.coverTitle || 'Pocket Puzzle Press Booklet');
  pdfDoc.setCreator('Pocket Puzzle Press');

  const fonts: Fonts = {
    serif: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    serifBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    sans: await pdfDoc.embedFont(StandardFonts.Helvetica),
    sansBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    mono: await pdfDoc.embedFont(StandardFonts.Courier),
  };

  let embeddedCoverImage: PDFImage | undefined;
  if (specs.coverImage?.dataUrl) {
    const pngBytes = dataUrlToUint8Array(specs.coverImage.dataUrl);
    embeddedCoverImage = await pdfDoc.embedPng(pngBytes);
  }

  const panelW = specs.widthIn * PT_PER_IN;
  const panelH = specs.heightIn * PT_PER_IN;

  for (const sheet of compilation.sheets) {
    const sides = [
      { label: 'FRONT', spreads: sheet.frontSpreads },
      { label: 'BACK', spreads: sheet.backSpreads },
    ];

    for (const side of sides) {
      const pdfPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

      // Quiet sheet engineering slug along top margin
      pdfPage.drawText(
        `SHEET ${sheet.sheetNumber} · ${side.label} · ${specs.widthIn.toFixed(2)}"×${specs.heightIn.toFixed(2)}" · ${specs.panelsPerSheetSide}-UP SADDLE-STITCH`,
        {
          x: 18,
          y: LETTER_H - 14,
          size: 6.5,
          font: fonts.mono,
          color: INK_MUTED,
        }
      );

      if (specs.panelsPerSheetSide === 4 && side.spreads.length > 0) {
        // 2 spreads stacked vertically (top & bottom)
        const spreadW = panelW * 2;
        const totalStackH = panelH * 2;
        const startX = Math.max(12, (LETTER_W - spreadW) / 2);
        const startY = Math.max(12, (LETTER_H - totalStackH) / 2);

        // Top spread
        const topSpread = side.spreads[0];
        const topY = startY + panelH;
        drawBookletPage(pdfPage, topSpread.leftPage, startX, topY, panelW, panelH, specs, compilation, fonts, embeddedCoverImage);
        drawBookletPage(pdfPage, topSpread.rightPage, startX + panelW, topY, panelW, panelH, specs, compilation, fonts, embeddedCoverImage);

        if (specs.cropMarks) {
          drawCropMarks(pdfPage, startX, topY, spreadW, panelH);
        }
        if (specs.centerFoldGuides) {
          drawCenterFoldLine(pdfPage, startX + panelW, topY, panelH);
        }

        // Bottom spread
        if (side.spreads[1]) {
          const botSpread = side.spreads[1];
          drawBookletPage(pdfPage, botSpread.leftPage, startX, startY, panelW, panelH, specs, compilation, fonts, embeddedCoverImage);
          drawBookletPage(pdfPage, botSpread.rightPage, startX + panelW, startY, panelW, panelH, specs, compilation, fonts, embeddedCoverImage);
          if (specs.cropMarks) {
            drawCropMarks(pdfPage, startX, startY, spreadW, panelH);
          }
          if (specs.centerFoldGuides) {
            drawCenterFoldLine(pdfPage, startX + panelW, startY, panelH);
          }
        }
      } else if (side.spreads[0]) {
        const spread = side.spreads[0];
        const spreadW = panelW * 2;
        const startX = Math.max(12, (LETTER_W - spreadW) / 2);
        const startY = Math.max(12, (LETTER_H - panelH) / 2);

        drawBookletPage(pdfPage, spread.leftPage, startX, startY, panelW, panelH, specs, compilation, fonts, embeddedCoverImage);
        drawBookletPage(pdfPage, spread.rightPage, startX + panelW, startY, panelW, panelH, specs, compilation, fonts, embeddedCoverImage);

        if (specs.cropMarks) {
          drawCropMarks(pdfPage, startX, startY, spreadW, panelH);
        }
        if (specs.centerFoldGuides) {
          drawCenterFoldLine(pdfPage, startX + panelW, startY, panelH);
        }
      }
    }
  }

  return pdfDoc.save();
}
