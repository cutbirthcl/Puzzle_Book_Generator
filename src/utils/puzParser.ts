import { CrosswordParsedData, GameType, PublicDomainIllustrationData, VaultItem } from '../types/booklet';
import { sha256HexFromBytes } from './hash';

function readNullTerminatedStrings(
  bytes: Uint8Array,
  startOffset: number,
  count: number
): string[] {
  const decoder = new TextDecoder('iso-8859-1');
  const results: string[] = [];
  let offset = startOffset;

  for (let i = 0; i < count && offset < bytes.length; i++) {
    let end = offset;
    while (end < bytes.length && bytes[end] !== 0) {
      end++;
    }
    results.push(decoder.decode(bytes.slice(offset, end)).trim());
    offset = end + 1;
  }

  return results;
}

/**
 * Parses an Across Lite binary .puz file into a structured CrosswordParsedData.
 */
export function parsePuzBinary(
  bytes: Uint8Array,
  fallbackFilename: string
): CrosswordParsedData {
  if (bytes.length < 52) {
    throw new Error('File is too small to be a valid .puz crossword.');
  }

  const magic = new TextDecoder('ascii').decode(bytes.slice(2, 13));
  if (magic !== 'ACROSS&DOWN') {
    throw new Error('Missing ACROSS&DOWN header signature.');
  }

  const width = bytes[0x2c];
  const height = bytes[0x2d];
  const clueCount = bytes[0x2e] | (bytes[0x2f] << 8);

  if (!width || !height || width > 25 || height > 25) {
    throw new Error(`Invalid crossword grid dimensions (${width}x${height}).`);
  }

  const gridSize = width * height;
  const solutionOffset = 0x34;
  const stringsOffset = solutionOffset + gridSize * 2;

  if (stringsOffset > bytes.length) {
    throw new Error('Truncated .puz payload.');
  }

  const decoder = new TextDecoder('iso-8859-1');
  const solutionFlat = decoder.decode(
    bytes.slice(solutionOffset, solutionOffset + gridSize)
  );

  const solutionGrid: string[][] = [];
  for (let r = 0; r < height; r++) {
    const row: string[] = [];
    for (let c = 0; c < width; c++) {
      const ch = solutionFlat[r * width + c] ?? '.';
      row.push(ch === '.' || ch === ':' ? '.' : ch.toUpperCase());
    }
    solutionGrid.push(row);
  }

  const strings = readNullTerminatedStrings(bytes, stringsOffset, 3 + clueCount);
  const title = strings[0] || fallbackFilename.replace(/\.puz$/i, '');
  const author = strings[1] || 'Independent Constructor';
  const copyright = strings[2] || '';
  const rawClues = strings.slice(3);

  const acrossClues: Array<{ number: number; clue: string; answer: string }> = [];
  const downClues: Array<{ number: number; clue: string; answer: string }> = [];

  let clueCursor = 0;
  let cellNum = 1;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (solutionGrid[r][c] === '.') continue;

      const startsAcross =
        (c === 0 || solutionGrid[r][c - 1] === '.') &&
        c + 1 < width &&
        solutionGrid[r][c + 1] !== '.';
      const startsDown =
        (r === 0 || solutionGrid[r - 1][c] === '.') &&
        r + 1 < height &&
        solutionGrid[r + 1][c] !== '.';

      if (startsAcross || startsDown) {
        if (startsAcross) {
          let ans = '';
          let cc = c;
          while (cc < width && solutionGrid[r][cc] !== '.') {
            ans += solutionGrid[r][cc];
            cc++;
          }
          acrossClues.push({
            number: cellNum,
            clue: rawClues[clueCursor] || `Across ${cellNum}`,
            answer: ans,
          });
          clueCursor++;
        }
        if (startsDown) {
          let ans = '';
          let rr = r;
          while (rr < height && solutionGrid[rr][c] !== '.') {
            ans += solutionGrid[rr][c];
            rr++;
          }
          downClues.push({
            number: cellNum,
            clue: rawClues[clueCursor] || `Down ${cellNum}`,
            answer: ans,
          });
          clueCursor++;
        }
        cellNum++;
      }
    }
  }

  return {
    title,
    author,
    copyright,
    width,
    height,
    solutionGrid,
    acrossClues,
    downClues,
  };
}

function parseSvgIllustration(
  svgText: string,
  filename: string
): PublicDomainIllustrationData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) {
    throw new Error('Invalid SVG document.');
  }

  const viewBoxAttr = svgEl.getAttribute('viewBox');
  let vbSize = 100;
  if (viewBoxAttr) {
    const parts = viewBoxAttr
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      vbSize = Math.max(parts[2], parts[3]);
    }
  }

  const paths: string[] = [];
  svgEl.querySelectorAll('path').forEach((p) => {
    const d = p.getAttribute('d')?.trim();
    if (d) paths.push(d);
  });

  if (paths.length === 0) {
    throw new Error('SVG contains no <path d="..."> vector strokes for tracing.');
  }

  return {
    title: filename.replace(/\.svg$/i, '').replace(/[_-]+/g, ' '),
    attribution: 'Custom Public Domain SVG Upload',
    year: 'Uploaded',
    viewBoxSize: vbSize,
    paths,
  };
}

export async function parseUploadedPuzzleFile(file: File): Promise<{
  item: Omit<VaultItem, 'id' | 'addedAt'>;
  sha256: string;
}> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const sha256 = await sha256HexFromBytes(bytes);
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.puz')) {
    const parsed = parsePuzBinary(bytes, file.name);
    return {
      sha256,
      item: {
        filename: file.name,
        gameType: 'crossword',
        source: 'uploaded',
        packOrTheme: 'Custom Upload',
        format: 'puz',
        sha256,
        summary: `${parsed.width}×${parsed.height} crossword · ${parsed.acrossClues.length + parsed.downClues.length} clues · ${parsed.title}`,
        crosswordData: parsed,
      },
    };
  }

  const text = new TextDecoder('utf-8').decode(bytes).trim();

  if (lower.endsWith('.svg')) {
    const ill = parseSvgIllustration(text, file.name);
    return {
      sha256,
      item: {
        filename: file.name,
        gameType: 'line-art',
        source: 'uploaded',
        packOrTheme: 'Uploaded SVG Plates',
        format: 'svg',
        sha256,
        summary: `SVG tracing plate · ${ill.paths.length} vector paths · ${ill.title}`,
        illustrationData: ill,
      },
    };
  }

  if (lower.endsWith('.json')) {
    const json = JSON.parse(text) as Record<string, unknown>;
    const gameType = (['crossword', 'word-grid', 'line-art'].includes(
      String(json.gameType)
    )
      ? String(json.gameType)
      : 'word-grid') as GameType;

    if (
      gameType === 'crossword' &&
      Array.isArray(json.solutionGrid) &&
      Array.isArray(json.acrossClues)
    ) {
      const cw = json as unknown as CrosswordParsedData;
      return {
        sha256,
        item: {
          filename: file.name,
          gameType: 'crossword',
          source: 'uploaded',
          packOrTheme: String(json.pack || 'Custom Upload'),
          format: 'json',
          sha256,
          summary: `${cw.width}×${cw.height} JSON crossword · ${cw.title || file.name}`,
          crosswordData: cw,
        },
      };
    }

    const words = Array.isArray(json.words)
      ? json.words.map((w) => String(w).toUpperCase().replace(/[^A-Z]/g, '')).filter((w) => w.length >= 3)
      : undefined;

    return {
      sha256,
      item: {
        filename: file.name,
        gameType,
        source: 'uploaded',
        packOrTheme: String(json.theme || json.pack || 'Custom Upload'),
        format: 'json',
        sha256,
        summary: words
          ? `JSON pack · ${words.length} custom words`
          : `JSON puzzle pack · ${String(json.title || file.name)}`,
        customWords: words,
        rawNotes: text.slice(0, 400),
      },
    };
  }

  // Plain text (.txt) word list
  const words = text
    .split(/[\s,;]+/)
    .map((w) => w.trim().toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((w) => w.length >= 3 && w.length <= 12);

  const uniqueWords = Array.from(new Set(words));
  if (uniqueWords.length === 0) {
    throw new Error('No valid words or puzzle entries found in text file.');
  }

  return {
    sha256,
    item: {
      filename: file.name,
      gameType: 'word-grid',
      source: 'uploaded',
      packOrTheme: 'Custom Word List',
      format: 'txt',
      sha256,
      summary: `Custom word list · ${uniqueWords.length} unique words`,
      customWords: uniqueWords,
    },
  };
}
