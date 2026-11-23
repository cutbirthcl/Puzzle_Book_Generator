import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  FileUp,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { GAME_TYPE_META } from '../data/presets';
import { GameType, UploadLogEntry, VaultItem } from '../types/booklet';
import { shortHash } from '../utils/hash';

interface PuzzleVaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  vaultItems: VaultItem[];
  uploadLogs: UploadLogEntry[];
  onUploadFiles: (files: FileList | File[]) => Promise<void>;
  onDeleteUploadedItem: (id: string) => void;
  onResetVault: () => void;
}

const VAULT_GAME_TYPES: GameType[] = ['crossword', 'word-grid', 'line-art'];

export const PuzzleVaultDrawer: React.FC<PuzzleVaultDrawerProps> = ({
  isOpen,
  onClose,
  vaultItems,
  uploadLogs,
  onUploadFiles,
  onDeleteUploadedItem,
  onResetVault,
}) => {
  const [filterType, setFilterType] = useState<'all' | GameType>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const filteredItems =
    filterType === 'all'
      ? vaultItems
      : vaultItems.filter((item) => item.gameType === filterType);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    try {
      await onUploadFiles(files);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadSampleSvg = () => {
    const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M 50 12 C 38 28, 38 48, 50 64 C 62 48, 62 28, 50 12 Z" />
  <path d="M 50 64 L 50 88 M 36 74 C 42 70, 46 68, 50 70 M 64 74 C 58 70, 54 68, 50 70" />
</svg>`;
    const blob = new Blob([sampleSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'public_domain_leaf_plate.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-drawer-title"
    >
      <div className="w-full max-w-2xl bg-[#111113] h-full border-l border-[#27272A] flex flex-col shadow-2xl text-[#E4E4E7]">
        {/* Drawer Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 bg-[#18181B] border-b border-[#27272A]">
          <div>
            <h2
              id="vault-drawer-title"
              className="font-display text-xl font-bold text-[#E4E4E7]"
            >
              Puzzle Library &amp; Uploads
            </h2>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              Sudoku, Kakuro &amp; Calcudoku generate automatically · Store .puz crosswords, word lists &amp; SVG drawings
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Puzzle Library"
            className="p-2 border border-[#27272A] bg-[#111113] hover:border-[#E4E4E7] text-[#E4E4E7] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              void handleFiles(e.dataTransfer.files);
            }}
            className={`border border-dashed p-5 transition-colors ${
              isDragging
                ? 'border-[#F43F5E] bg-[#F43F5E]/10'
                : 'border-[#3F3F46] bg-[#18181B]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#E4E4E7]">
                  <FileUp className="w-4 h-4 text-[#F43F5E]" />
                  <span>Upload .puz Crosswords, .svg Drawings, or Word Lists</span>
                </div>
                <p className="text-xs text-[#A1A1AA]">
                  Drop Across Lite <code className="font-mono text-[#E4E4E7]">.puz</code> files,{' '}
                  <code className="font-mono text-[#E4E4E7]">.svg</code> line drawings for tracing, or{' '}
                  <code className="font-mono text-[#E4E4E7]">.json</code> / <code className="font-mono text-[#E4E4E7]">.txt</code> word lists. Duplicate files are skipped automatically.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".puz,.svg,.json,.txt"
                  multiple
                  onChange={(e) => void handleFiles(e.target.files)}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 text-xs font-mono font-bold bg-[#F43F5E] text-white hover:bg-[#E11D48] cursor-pointer whitespace-nowrap"
                >
                  {isProcessing ? 'Checking...' : 'Choose Files'}
                </button>
                <button
                  type="button"
                  onClick={downloadSampleSvg}
                  className="px-3 py-2 text-xs font-mono font-medium bg-[#111113] border border-[#27272A] text-[#E4E4E7] hover:border-[#52525B] cursor-pointer whitespace-nowrap"
                >
                  Sample SVG
                </button>
              </div>
            </div>
          </div>

          {/* Upload Verification Log */}
          {uploadLogs.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#A1A1AA]">
                Recent Uploads
              </h3>
              <div className="border border-[#27272A] bg-[#18181B] divide-y divide-[#27272A]">
                {uploadLogs.slice(0, 6).map((entry) => (
                  <div
                    key={entry.id}
                    className="px-3.5 py-2.5 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {entry.status === 'accepted' ? (
                        <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-[#FB7185] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="font-mono font-medium text-[#E4E4E7] truncate">
                          {entry.filename}
                        </div>
                        <div
                          className={`mt-0.5 ${
                            entry.status === 'accepted'
                              ? 'text-[#4ADE80]'
                              : 'text-[#FB7185]'
                          }`}
                        >
                          {entry.status === 'accepted'
                            ? `Accepted (Unique) · ${entry.reason}`
                            : `Rejected (Duplicate of ${entry.duplicateOf})`}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-[#A1A1AA] shrink-0 tabular-nums">
                      sha256:{shortHash(entry.sha256)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Tabs + Vault Inventory */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 flex-wrap p-1 bg-[#18181B] border border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 text-xs font-mono cursor-pointer whitespace-nowrap ${
                    filterType === 'all'
                      ? 'bg-[#E4E4E7] text-[#111113] font-bold'
                      : 'text-[#A1A1AA] hover:text-[#E4E4E7]'
                  }`}
                >
                  All ({vaultItems.length})
                </button>
                {VAULT_GAME_TYPES.map((gt) => {
                  const count = vaultItems.filter((i) => i.gameType === gt).length;
                  return (
                    <button
                      key={gt}
                      type="button"
                      onClick={() => setFilterType(gt)}
                      className={`px-2.5 py-1 text-xs font-mono cursor-pointer whitespace-nowrap ${
                        filterType === gt
                          ? 'bg-[#E4E4E7] text-[#111113] font-bold'
                          : 'text-[#A1A1AA] hover:text-[#E4E4E7]'
                      }`}
                    >
                      {GAME_TYPE_META[gt].shortLabel} ({count})
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={onResetVault}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-[#A1A1AA] hover:text-[#E4E4E7] border border-[#27272A] bg-[#18181B] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Uploads</span>
              </button>
            </div>

            <div className="border border-[#27272A] bg-[#18181B] divide-y divide-[#27272A]">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-[#1F1F23]"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {item.illustrationData && (
                      <div className="w-10 h-10 shrink-0 border border-[#3F3F46] bg-white p-1 flex items-center justify-center">
                        <svg
                          viewBox={`0 0 ${item.illustrationData.viewBoxSize} ${item.illustrationData.viewBoxSize}`}
                          className="w-full h-full"
                        >
                          {item.illustrationData.paths.map((d, i) => (
                            <path
                              key={i}
                              d={d}
                              fill="none"
                              stroke="#71717A"
                              strokeWidth={item.illustrationData!.viewBoxSize * 0.015}
                            />
                          ))}
                        </svg>
                      </div>
                    )}

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                        <span className="font-mono font-medium text-[#FB7185]">
                          {GAME_TYPE_META[item.gameType].shortLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.packOrTheme}</span>
                        <span aria-hidden="true">·</span>
                        <span className="uppercase font-mono text-[10px]">
                          {item.source === 'seeded' ? 'Public / Seeded' : 'Uploaded'}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-[#E4E4E7] truncate font-mono">
                        {item.filename}
                      </div>
                      <div className="text-xs text-[#A1A1AA]">{item.summary}</div>
                      <div className="text-[11px] font-mono text-[#71717A] tabular-nums">
                        sha256:{item.sha256.slice(0, 24)}…
                      </div>
                    </div>
                  </div>

                  {item.source === 'uploaded' && (
                    <button
                      type="button"
                      onClick={() => onDeleteUploadedItem(item.id)}
                      aria-label={`Remove ${item.filename}`}
                      className="p-1.5 text-[#FB7185] hover:bg-[#F43F5E]/10 border border-transparent hover:border-[#F43F5E] cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
