import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Plus, RefreshCw } from 'lucide-react';
import { BookletSpecsPanel } from './components/BookletSpecsPanel';
import { GameBlockCard } from './components/GameBlockCard';
import { ImpositionPreview } from './components/ImpositionPreview';
import { PuzzleVaultDrawer } from './components/PuzzleVaultDrawer';
import {
  createDefaultGameBlock,
  DEFAULT_PRINT_SPECS,
  GAME_TYPE_META,
  INITIAL_GAME_QUEUE,
} from './data/presets';
import { buildSeededVaultItems } from './data/seededVault';
import {
  GameBlock,
  GameType,
  PrintSpecs,
  UploadLogEntry,
  VaultItem,
} from './types/booklet';
import { shortHash } from './utils/hash';
import { buildExportManifest, compileBooklet } from './utils/imposition';
import { generateImposedPdfBytes } from './utils/pdfGenerator';
import { parseUploadedPuzzleFile } from './utils/puzParser';

const STORAGE_UPLOADS_KEY = 'pocket_puzzle_press_uploads_v1';
const STORAGE_LOGS_KEY = 'pocket_puzzle_press_upload_logs_v1';

export default function App() {
  const [specs, setSpecs] = useState<PrintSpecs>(DEFAULT_PRINT_SPECS);
  const [queue, setQueue] = useState<GameBlock[]>(INITIAL_GAME_QUEUE);
  const [newBlockType, setNewBlockType] = useState<GameType>('sudoku');
  const [generationSeed, setGenerationSeed] = useState<number>(202611);

  const [seededVault, setSeededVault] = useState<VaultItem[]>([]);
  const [uploadedVault, setUploadedVault] = useState<VaultItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_UPLOADS_KEY);
      return raw ? (JSON.parse(raw) as VaultItem[]) : [];
    } catch {
      return [];
    }
  });
  const [uploadLogs, setUploadLogs] = useState<UploadLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_LOGS_KEY);
      return raw ? (JSON.parse(raw) as UploadLogEntry[]) : [];
    } catch {
      return [];
    }
  });

  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    void buildSeededVaultItems().then((items) => {
      setSeededVault(items);
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_UPLOADS_KEY, JSON.stringify(uploadedVault));
    } catch {
      // Ignore storage quota errors
    }
  }, [uploadedVault]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(uploadLogs));
    } catch {
      // Ignore storage quota errors
    }
  }, [uploadLogs]);

  const vaultItems = useMemo(
    () => [...uploadedVault, ...seededVault],
    [uploadedVault, seededVault]
  );

  const compilation = useMemo(
    () => compileBooklet(specs, queue, vaultItems, generationSeed),
    [specs, queue, vaultItems, generationSeed]
  );

  const uploadedCrosswordCount = useMemo(
    () =>
      uploadedVault.filter(
        (v) => v.gameType === 'crossword' && Boolean(v.crosswordData)
      ).length,
    [uploadedVault]
  );

  const uploadedSvgCount = useMemo(
    () =>
      uploadedVault.filter(
        (v) => v.gameType === 'line-art' && Boolean(v.illustrationData)
      ).length,
    [uploadedVault]
  );

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    window.setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const handleRegeneratePuzzles = () => {
    const nextSeed = Math.floor(100000 + Math.random() * 899999);
    setGenerationSeed(nextSeed);
    showNotice(
      `Created new Sudoku, Kakuro, Calcudoku & Word Grid puzzles (Variation #${nextSeed}).`
    );
  };

  // Queue handlers
  const handleAddBlock = () => {
    setQueue((prev) => [...prev, createDefaultGameBlock(newBlockType)]);
  };

  const handleUpdateBlock = (id: string, updated: GameBlock) => {
    setQueue((prev) => prev.map((b) => (b.id === id ? updated : b)));
  };

  const handleMoveBlock = (index: number, delta: -1 | 1) => {
    setQueue((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const handleDuplicateBlock = (index: number) => {
    setQueue((prev) => {
      const source = prev[index];
      const clone: GameBlock = {
        ...source,
        id: `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      };
      const copy = [...prev];
      copy.splice(index + 1, 0, clone);
      return copy;
    });
  };

  const handleRemoveBlock = (id: string) => {
    setQueue((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.id !== id)));
  };

  // Vault upload with SHA-256 duplicate rejection
  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const currentByHash = new Map<string, VaultItem>();
    for (const item of vaultItems) {
      currentByHash.set(item.sha256, item);
    }

    const newlyAccepted: VaultItem[] = [];
    const newLogs: UploadLogEntry[] = [];

    for (const file of fileArray) {
      try {
        const { item, sha256 } = await parseUploadedPuzzleFile(file);
        const existing = currentByHash.get(sha256);
        if (existing) {
          newLogs.push({
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            filename: file.name,
            status: 'rejected',
            sha256,
            duplicateOf: existing.filename,
            reason: `Matches existing content hash`,
            timestamp: new Date().toISOString(),
          });
        } else {
          const fullItem: VaultItem = {
            ...item,
            id: `upl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            addedAt: new Date().toISOString(),
          };
          currentByHash.set(sha256, fullItem);
          newlyAccepted.push(fullItem);
          newLogs.push({
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            filename: file.name,
            status: 'accepted',
            sha256,
            reason: item.summary,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to parse file';
        newLogs.push({
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          filename: file.name,
          status: 'rejected',
          sha256: '0000000000000000',
          duplicateOf: `parse error (${message})`,
          reason: message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (newlyAccepted.length > 0) {
      setUploadedVault((prev) => [...newlyAccepted, ...prev]);
    }
    if (newLogs.length > 0) {
      setUploadLogs((prev) => [...newLogs, ...prev].slice(0, 25));
      const acceptedCount = newLogs.filter((l) => l.status === 'accepted').length;
      const rejectedCount = newLogs.length - acceptedCount;
      showNotice(
        `Vault ingestion: ${acceptedCount} accepted, ${rejectedCount} rejected.`
      );
    }
  };

  const handleDeleteUploadedItem = (id: string) => {
    setUploadedVault((prev) => prev.filter((item) => item.id !== id));
  };

  const handleResetVault = () => {
    setUploadedVault([]);
    setUploadLogs([]);
    localStorage.removeItem(STORAGE_UPLOADS_KEY);
    localStorage.removeItem(STORAGE_LOGS_KEY);
    showNotice('Uploaded files cleared; built-in drawings & puzzle packs restored.');
  };

  // Exports
  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const bytes = await generateImposedPdfBytes(specs, compilation);
      const buffer = new Uint8Array(bytes.byteLength);
      buffer.set(bytes);
      const blob = new Blob([buffer.buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const slug = (specs.coverTitle || 'pocket-puzzle-booklet')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug || 'pocket-puzzle-booklet'}-${compilation.stats.paddedTotalPages}pp.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showNotice(
        `Exported ${compilation.stats.duplexSheets}-sheet imposed PDF (${compilation.stats.paddedTotalPages} pages).`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PDF generation failed';
      showNotice(`Export error: ${msg}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadManifest = () => {
    const manifest = buildExportManifest(
      specs,
      queue,
      vaultItems,
      compilation,
      generationSeed
    );
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const slug = (specs.coverTitle || 'booklet-manifest')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'booklet'}-manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Exported FastAPI-ready build manifest JSON.');
  };

  return (
    <div className="min-h-screen flex flex-col dot-grid-canvas text-[#E4E4E7]">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="bg-[#111113]/95 border-b-2 border-[#27272A] px-6 py-4 sticky top-0 z-30 backdrop-blur-xs">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8">
          <a
            href="#booklet-specs"
            className="font-display text-lg sm:text-xl font-extrabold uppercase tracking-[-0.04em] text-[#E4E4E7] whitespace-nowrap shrink-0"
          >
            Puzzle Book Generator
          </a>

          <nav
            aria-label="Workspace sections"
            className="hidden md:flex items-center gap-6 text-xs font-mono font-medium text-[#A1A1AA]"
          >
            <a
              href="#booklet-specs"
              className="hover:text-[#E4E4E7] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Booklet Configuration
            </a>
            <a
              href="#game-queue"
              className="hover:text-[#E4E4E7] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Puzzle Layout
            </a>
            <button
              type="button"
              onClick={() => setIsVaultOpen(true)}
              className="hover:text-[#E4E4E7] hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Puzzle Library
            </button>
            <a
              href="#sheet-inspector"
              className="hover:text-[#E4E4E7] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Print Preview
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={() => void handleDownloadPdf()}
              className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-[0.04em] text-[#111113] bg-[#E4E4E7] hover:bg-white disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isExportingPdf ? 'Rendering...' : 'Download PDF'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Two-Column Industrial Prepress Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 lg:py-8">
        {statusNotice && (
          <div
            role="status"
            className="mb-5 px-4 py-2.5 bg-[#18181B] border border-[#F43F5E]/50 text-xs font-mono text-[#E4E4E7] flex items-center justify-between gap-4"
          >
            <span>{statusNotice}</span>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              className="text-[#A1A1AA] hover:text-[#E4E4E7] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (60% -> 7/12): Format Specs, Game Queue, Source Vault */}
          <div className="lg:col-span-7 space-y-6">
            <BookletSpecsPanel specs={specs} onChange={setSpecs} />

            {/* Puzzle Layout */}
            <section
              id="game-queue"
              className="bg-[#18181B] border border-[#27272A] p-6 space-y-5"
            >
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#27272A] pb-4">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#A1A1AA]">
                    02. Pages &amp; Games
                  </div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-[#E4E4E7] mt-1">
                    Puzzle Layout
                  </h2>
                  <p className="text-xs text-[#A1A1AA] mt-1">
                    Sudoku, Kakuro &amp; Calcudoku generate automatically · Variation{' '}
                    <span className="font-mono text-[#E4E4E7] tabular-nums">
                      #{generationSeed}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[#A1A1AA] tabular-nums">
                    {queue.length} section{queue.length !== 1 ? 's' : ''} ·{' '}
                    {compilation.stats.puzzlePages} puzzle pages
                  </span>
                  <button
                    type="button"
                    onClick={handleRegeneratePuzzles}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium bg-[#111113] border border-[#E4E4E7] text-[#E4E4E7] hover:bg-[#27272A] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#F43F5E]" />
                    <span>New Puzzles</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {queue.map((block, idx) => (
                  <GameBlockCard
                    key={block.id}
                    block={block}
                    index={idx}
                    totalBlocks={queue.length}
                    uploadedCrosswordCount={uploadedCrosswordCount}
                    uploadedSvgCount={uploadedSvgCount}
                    onUpdate={(updated) => handleUpdateBlock(block.id, updated)}
                    onMoveUp={() => handleMoveBlock(idx, -1)}
                    onMoveDown={() => handleMoveBlock(idx, 1)}
                    onDuplicate={() => handleDuplicateBlock(idx)}
                    onRemove={() => handleRemoveBlock(block.id)}
                  />
                ))}
              </div>

              {/* Add Section Toolbar */}
              <div className="pt-3 border-t border-[#27272A] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                  <select
                    aria-label="Add Puzzle Section Type"
                    value={newBlockType}
                    onChange={(e) => setNewBlockType(e.target.value as GameType)}
                    className="flex-1 max-w-xs px-3 py-2 text-xs font-mono bg-[#111113] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
                  >
                    {(Object.keys(GAME_TYPE_META) as GameType[]).map((gt) => (
                      <option key={gt} value={gt}>
                        {GAME_TYPE_META[gt].label} — {GAME_TYPE_META[gt].subtitle}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddBlock}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold uppercase tracking-[0.04em] bg-[#F43F5E] text-white hover:bg-[#E11D48] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Section</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Puzzle Library & Uploads Summary Card */}
            <section className="bg-[#18181B] border border-[#27272A] p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#A1A1AA]">
                    03. Custom Files
                  </div>
                  <h2 className="font-display text-xl font-bold text-[#E4E4E7] mt-1">
                    Puzzle Library &amp; Uploads
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#A1A1AA] mt-1.5">
                    <span className="font-mono tabular-nums">
                      {seededVault.length} built-in files
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {uploadedVault.length} uploaded files (.puz / .svg / .txt)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Duplicate check enabled</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsVaultOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-mono font-medium bg-[#111113] border border-[#E4E4E7] text-[#E4E4E7] hover:bg-[#27272A] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[#F43F5E]" />
                  <span>Manage Files</span>
                </button>
              </div>

              {uploadLogs.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#27272A] flex items-center justify-between text-xs text-[#A1A1AA]">
                  <span className="truncate">
                    Latest import:{' '}
                    <span className="font-mono text-[#E4E4E7]">
                      {uploadLogs[0].filename}
                    </span>{' '}
                    —{' '}
                    {uploadLogs[0].status === 'accepted'
                      ? 'Accepted (Unique)'
                      : `Rejected (Duplicate of ${uploadLogs[0].duplicateOf})`}
                  </span>
                  <span className="font-mono text-[11px] shrink-0 ml-3">
                    {shortHash(uploadLogs[0].sha256)}
                  </span>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN (40% -> 5/12): Live Imposition Sheet Preview & Exports */}
          <div className="lg:col-span-5">
            <ImpositionPreview
              specs={specs}
              compilation={compilation}
              isExportingPdf={isExportingPdf}
              onDownloadPdf={() => void handleDownloadPdf()}
              onDownloadManifest={handleDownloadManifest}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-[#27272A] bg-[#111113] px-6 py-4 mt-8">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] text-[#A1A1AA]">
          <span>PUZZLE BOOK GENERATOR · FOLD-AND-STAPLE BOOKLET MAKER</span>
          <span>PRINT DOUBLE-SIDED · FLIP ON SHORT EDGE · FOLD &amp; STAPLE AT CENTER</span>
        </div>
      </footer>

      <PuzzleVaultDrawer
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        vaultItems={vaultItems}
        uploadLogs={uploadLogs}
        onUploadFiles={handleUploadFiles}
        onDeleteUploadedItem={handleDeleteUploadedItem}
        onResetVault={handleResetVault}
      />
    </div>
  );
}
