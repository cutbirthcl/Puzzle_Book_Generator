import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  Layers,
  Scissors,
} from 'lucide-react';
import { ImpositionSpread, PrintSpecs } from '../types/booklet';
import { BookletCompilation } from '../utils/imposition';
import { PageContentPreview } from './PageContentPreview';

interface ImpositionPreviewProps {
  specs: PrintSpecs;
  compilation: BookletCompilation;
  isExportingPdf: boolean;
  onDownloadPdf: () => void;
  onDownloadManifest: () => void;
}

const SpreadFrame: React.FC<{
  spread: ImpositionSpread;
  specs: PrintSpecs;
  compilation: BookletCompilation;
  sideLabel: string;
}> = ({ spread, specs, compilation, sideLabel }) => {
  const panelRatio = specs.widthIn / specs.heightIn;
  const spreadAspect = `${(panelRatio * 2).toFixed(3)} / 1`;

  return (
    <div className="relative flex flex-col items-center w-full">
      <div className="w-full flex items-center justify-between text-[11px] font-mono text-[#A1A1AA] mb-1.5 tabular-nums">
        <span>{sideLabel}</span>
        <span>
          L p.{String(spread.leftPage.pageNumber).padStart(2, '0')} · R p.
          {String(spread.rightPage.pageNumber).padStart(2, '0')}
        </span>
      </div>

      {/* Trim + crop mark stage */}
      <div className="relative p-3 w-full flex items-center justify-center">
        {specs.cropMarks && (
          <>
            <span className="pointer-events-none absolute top-1 left-1 w-2.5 h-2.5 border-t border-l border-[#E4E4E7]/65" />
            <span className="pointer-events-none absolute top-1 right-1 w-2.5 h-2.5 border-t border-r border-[#E4E4E7]/65" />
            <span className="pointer-events-none absolute bottom-1 left-1 w-2.5 h-2.5 border-b border-l border-[#E4E4E7]/65" />
            <span className="pointer-events-none absolute bottom-1 right-1 w-2.5 h-2.5 border-b border-r border-[#E4E4E7]/65" />
          </>
        )}

        <div
          className="relative w-full max-w-[380px] grid grid-cols-2 border border-[#3F3F46] bg-white text-[#111113] overflow-hidden"
          style={{ aspectRatio: spreadAspect }}
        >
          <div className="relative h-full overflow-hidden">
            <PageContentPreview
              page={spread.leftPage}
              specs={specs}
              stats={compilation.stats}
            />
          </div>

          <div className="relative h-full overflow-hidden">
            <PageContentPreview
              page={spread.rightPage}
              specs={specs}
              stats={compilation.stats}
            />
          </div>

          {specs.centerFoldGuides && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-dashed border-[#F43F5E]/80"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const ImpositionPreview: React.FC<ImpositionPreviewProps> = ({
  specs,
  compilation,
  isExportingPdf,
  onDownloadPdf,
  onDownloadManifest,
}) => {
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [sideView, setSideView] = useState<'duplex' | 'front' | 'back'>('duplex');

  const safeSheetIdx = Math.min(
    selectedSheetIndex,
    Math.max(0, compilation.sheets.length - 1)
  );
  const activeSheet = compilation.sheets[safeSheetIdx];
  const { stats } = compilation;

  const signatureSlots = Array.from({ length: stats.paddedTotalPages }, (_, idx) => {
    const page = compilation.pages[idx];
    return {
      num: idx + 1,
      kind: page?.kind ?? 'dot-grid-filler',
    };
  });

  return (
    <aside
      id="sheet-inspector"
      className="lg:sticky lg:top-6 flex flex-col gap-5"
    >
      {/* Page Count & Sheet Breakdown */}
      <section className="bg-[#18181B] border border-[#27272A] p-5">
        <div className="flex items-start justify-between gap-4 border-b border-[#27272A] pb-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#A1A1AA]">
              Page Count
            </div>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Booklets print in multiples of 4 pages
            </p>
          </div>
          <div className="text-right tabular-nums">
            <div className="font-display text-4xl font-extrabold leading-none text-[#E4E4E7]">
              {stats.paddedTotalPages}
              <span className="font-mono text-xs font-medium text-[#A1A1AA] ml-1.5">
                PAGES
              </span>
            </div>
            <div className="font-mono text-[11px] text-[#A1A1AA] mt-1">
              {stats.duplexSheets} US Letter sheet{stats.duplexSheets > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Breakdown ledger */}
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3.5 border-b border-[#27272A] text-xs">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA]">
              Covers
            </dt>
            <dd className="font-mono font-medium text-[#E4E4E7] tabular-nums mt-0.5">
              {stats.coverPages + stats.backCoverPages} pp
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA]">
              Puzzles
            </dt>
            <dd className="font-mono font-medium text-[#E4E4E7] tabular-nums mt-0.5">
              {stats.puzzlePages} pp · {stats.totalPuzzles}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA]">
              Answers
            </dt>
            <dd className="font-mono font-medium text-[#E4E4E7] tabular-nums mt-0.5">
              {stats.answerPages} pp
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1A1AA]">
              Blank Notes
            </dt>
            <dd className="font-mono font-medium text-[#E4E4E7] tabular-nums mt-0.5">
              {stats.fillerPages} pp
            </dd>
          </div>
        </dl>

        {/* Visual 4-page signature map */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#A1A1AA] mb-2">
            <span>
              Page Order ({stats.rawPages} content → {stats.paddedTotalPages} total)
            </span>
            <span className="tabular-nums">{stats.panelsPerSheetSide} per side</span>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
            {signatureSlots.map((slot) => {
              const tone =
                slot.kind === 'front-cover' || slot.kind === 'back-cover'
                  ? 'bg-[#27272A] text-[#E4E4E7] border-[#3F3F46]'
                  : slot.kind === 'answer-key'
                  ? 'bg-[#111113] text-[#E4E4E7] border-[#52525B]'
                  : slot.kind === 'dot-grid-filler'
                  ? 'bg-[#F43F5E]/10 text-[#FB7185] border-[#F43F5E]'
                  : 'bg-[#111113] text-[#A1A1AA] border-[#27272A]';
              return (
                <div
                  key={slot.num}
                  title={`Page ${slot.num}: ${slot.kind.replace(/-/g, ' ')}`}
                  className={`h-7 border text-[10px] font-mono tabular-nums flex items-center justify-center ${tone}`}
                >
                  {String(slot.num).padStart(2, '0')}
                </div>
              );
            })}
          </div>
        </div>

        {/* Padding alert */}
        {stats.fillerPages > 0 ? (
          <div className="mt-3.5 flex items-start gap-2.5 p-3 bg-[#F43F5E]/10 border border-[#F43F5E]/40 text-xs text-[#FECDD3]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#FB7185]" />
            <div>
              <span className="font-mono font-semibold text-[#FDA4AF]">
                +{stats.fillerPages} dot-grid notes page{stats.fillerPages > 1 ? 's' : ''} added.
              </span>{' '}
              Rounded from {stats.rawPages} to {stats.paddedTotalPages} pages to fold evenly.
            </div>
          </div>
        ) : (
          <div className="mt-3.5 flex items-center gap-2 p-2.5 bg-[#111113] border border-[#27272A] text-xs text-[#A1A1AA]">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#4ADE80]" />
            <span>
              Exact {stats.paddedTotalPages}-page booklet fit — no blank filler pages needed.
            </span>
          </div>
        )}
      </section>

      {/* Live Print Sheet Preview */}
      <section className="bg-[#18181B] border border-[#27272A] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] pb-3.5">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#A1A1AA]">
              Print Preview
            </div>
            <div className="flex items-center gap-2 text-xs text-[#E4E4E7] mt-1 font-mono tabular-nums">
              <span>US Letter 11&Prime;×8.5&Prime;</span>
              <span aria-hidden="true" className="text-[#71717A]">·</span>
              <span>{specs.panelsPerSheetSide} pages/side</span>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#111113] border border-[#27272A]">
            {([
              { id: 'duplex', label: 'Both' },
              { id: 'front', label: 'Front' },
              { id: 'back', label: 'Back' },
            ] as const).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSideView(mode.id)}
                className={`px-2.5 py-1 text-[11px] font-mono uppercase transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sideView === mode.id
                    ? 'bg-[#E4E4E7] text-[#111113] font-bold'
                    : 'text-[#A1A1AA] hover:text-[#E4E4E7]'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sheet Selector Bar */}
        <div className="flex items-center justify-between gap-2 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {compilation.sheets.map((sheet, idx) => (
              <button
                key={sheet.sheetNumber}
                type="button"
                onClick={() => setSelectedSheetIndex(idx)}
                className={`px-2.5 py-1 text-xs font-mono tabular-nums border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  safeSheetIdx === idx
                    ? 'bg-[#F43F5E] text-white border-[#F43F5E]'
                    : 'bg-[#111113] text-[#A1A1AA] border-[#27272A] hover:border-[#52525B] hover:text-[#E4E4E7]'
                }`}
              >
                S{sheet.sheetNumber}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-mono text-[#A1A1AA] tabular-nums">
            {safeSheetIdx + 1} / {compilation.sheets.length}
          </span>
        </div>

        {/* Cutting Mat Preview Stage */}
        {activeSheet && (
          <div className="cutting-mat-dark border border-[#27272A] p-3.5 space-y-4">
            {(sideView === 'duplex' || sideView === 'front') && (
              <div className="bg-[#18181B] border border-[#3F3F46] p-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#A1A1AA] pb-2 mb-2 border-b border-[#27272A]">
                  <span className="font-bold text-[#E4E4E7]">
                    SHEET {activeSheet.sheetNumber} · FRONT
                  </span>
                  <span className="flex items-center gap-1">
                    <Scissors className="w-3 h-3 text-[#F43F5E]" />
                    {specs.cropMarks ? 'Crop marks ON' : 'Crop marks OFF'}
                  </span>
                </div>
                <div className="space-y-4">
                  {activeSheet.frontSpreads.map((spread, idx) => (
                    <SpreadFrame
                      key={idx}
                      spread={spread}
                      specs={specs}
                      compilation={compilation}
                      sideLabel={
                        activeSheet.frontSpreads.length > 1
                          ? idx === 0
                            ? 'Top Spread'
                            : 'Bottom Spread'
                          : 'Front Spread'
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {(sideView === 'duplex' || sideView === 'back') && (
              <div className="bg-[#18181B] border border-[#3F3F46] p-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#A1A1AA] pb-2 mb-2 border-b border-[#27272A]">
                  <span className="font-bold text-[#E4E4E7]">
                    SHEET {activeSheet.sheetNumber} · BACK (FLIP SHORT EDGE)
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-[#F43F5E]" />
                    Flip on short edge
                  </span>
                </div>
                <div className="space-y-4">
                  {activeSheet.backSpreads.map((spread, idx) => (
                    <SpreadFrame
                      key={idx}
                      spread={spread}
                      specs={specs}
                      compilation={compilation}
                      sideLabel={
                        activeSheet.backSpreads.length > 1
                          ? idx === 0
                            ? 'Top Spread'
                            : 'Bottom Spread'
                          : 'Back Spread'
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Export Controls */}
        <div className="mt-5 pt-4 border-t border-[#27272A] flex flex-col gap-2.5">
          <button
            type="button"
            disabled={isExportingPdf}
            onClick={onDownloadPdf}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#E4E4E7] hover:bg-white disabled:opacity-60 text-[#111113] font-mono text-xs font-bold uppercase tracking-[0.06em] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>
              {isExportingPdf
                ? 'Creating Printable PDF...'
                : 'Download Printable PDF'}
            </span>
          </button>

          <button
            type="button"
            onClick={onDownloadManifest}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#111113] hover:bg-[#27272A] border border-[#27272A] text-[#E4E4E7] font-mono text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileJson className="w-3.5 h-3.5 shrink-0 text-[#A1A1AA]" />
            <span>Download Settings (JSON)</span>
          </button>
        </div>
      </section>
    </aside>
  );
};
