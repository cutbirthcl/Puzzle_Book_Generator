import { VaultItem } from '../types/booklet';
import { sha256HexFromText } from '../utils/hash';
import { PUBLIC_DOMAIN_PLATES } from './publicDomainPlates';
import { SEEDED_CROSSWORDS } from './puzzleGenerators';

interface RawSeedEntry {
  id: string;
  filename: string;
  gameType: VaultItem['gameType'];
  packOrTheme: string;
  summary: string;
  canonicalContent: string;
  crosswordData?: VaultItem['crosswordData'];
  illustrationData?: VaultItem['illustrationData'];
  customWords?: string[];
}

const RAW_SEED_ENTRIES: RawSeedEntry[] = [
  {
    id: 'seed-xword-mini-1',
    filename: 'morning_press_mini.puz',
    gameType: 'crossword',
    packOrTheme: 'Mini 5x5',
    summary: '5×5 mini crossword · 10 clues · Morning Press',
    canonicalContent: JSON.stringify(SEEDED_CROSSWORDS['Mini 5x5'][0]),
    crosswordData: SEEDED_CROSSWORDS['Mini 5x5'][0],
  },
  {
    id: 'seed-xword-everyday-1',
    filename: 'stationery_shop_7x7.puz',
    gameType: 'crossword',
    packOrTheme: 'Everyday',
    summary: '7×7 everyday crossword · 13 clues · Stationery Shop',
    canonicalContent: JSON.stringify(SEEDED_CROSSWORDS['Everyday'][0]),
    crosswordData: SEEDED_CROSSWORDS['Everyday'][0],
  },
  {
    id: 'seed-xword-cryptic-1',
    filename: 'gutenberg_midnight_7x7.puz',
    gameType: 'crossword',
    packOrTheme: 'Cryptic/Tough',
    summary: '7×7 tough crossword · 12 clues · Gutenberg Midnight',
    canonicalContent: JSON.stringify(SEEDED_CROSSWORDS['Cryptic/Tough'][0]),
    crosswordData: SEEDED_CROSSWORDS['Cryptic/Tough'][0],
  },
  {
    id: 'seed-wordgrid-lexicon',
    filename: 'pocket_lexicon_packs.txt',
    gameType: 'word-grid',
    packOrTheme: 'Everyday / Sci-Fi / Nature',
    summary: 'Curated 21-tile anagram pools across 3 themed lexicons',
    canonicalContent: 'POCKET_PUZZLE_PRESS::SEED::WORDGRID_LEXICONS_V1',
    customWords: ['PRESS', 'FOLIO', 'STAMP', 'CEDAR', 'ORBIT', 'RUNE', 'TRAIL', 'PAPER'],
  },
  ...PUBLIC_DOMAIN_PLATES.map((plate) => ({
    id: plate.id,
    filename: plate.filename,
    gameType: 'line-art' as const,
    packOrTheme: plate.theme,
    summary: `${plate.title} · ${plate.attribution} (${plate.year})`,
    canonicalContent: JSON.stringify({
      title: plate.title,
      attribution: plate.attribution,
      paths: plate.paths,
    }),
    illustrationData: {
      title: plate.title,
      attribution: plate.attribution,
      year: plate.year,
      viewBoxSize: plate.viewBoxSize,
      paths: plate.paths,
    },
  })),
];

export async function buildSeededVaultItems(): Promise<VaultItem[]> {
  const results: VaultItem[] = [];
  for (const entry of RAW_SEED_ENTRIES) {
    const sha256 = await sha256HexFromText(entry.canonicalContent);
    results.push({
      id: entry.id,
      filename: entry.filename,
      gameType: entry.gameType,
      source: 'seeded',
      packOrTheme: entry.packOrTheme,
      format: entry.illustrationData ? 'svg' : 'seed',
      sha256,
      addedAt: '2026-11-01T09:00:00.000Z',
      summary: entry.summary,
      crosswordData: entry.crosswordData,
      illustrationData: entry.illustrationData,
      customWords: entry.customWords,
    });
  }
  return results;
}
