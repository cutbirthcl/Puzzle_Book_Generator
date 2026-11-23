import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { PAPER_STYLE_OPTIONS, SIZE_PRESETS } from '../data/presets';
import { PaperStyle, PrintSpecs, SizePresetId } from '../types/booklet';
import { processCoverImageFile, renderLogoToPngDataUrl } from '../utils/imageProcessor';

interface BookletSpecsPanelProps {
  specs: PrintSpecs;
  onChange: (updated: PrintSpecs) => void;
}

export const BookletSpecsPanel: React.FC<BookletSpecsPanelProps> = ({
  specs,
  onChange,
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file) return;
    setLogoError(null);
    setIsProcessingLogo(true);
    try {
      const asset = await processCoverImageFile(file, true);
      onChange({ ...specs, coverImage: asset });
    } catch (err) {
      setLogoError(
        err instanceof Error ? err.message : 'Unable to load cover image.'
      );
    } finally {
      setIsProcessingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleToggleGrayscale = async (grayscale: boolean) => {
    if (!specs.coverImage) return;
    try {
      const updated = await renderLogoToPngDataUrl(
        specs.coverImage.originalDataUrl,
        grayscale
      );
      onChange({
        ...specs,
        coverImage: {
          ...specs.coverImage,
          grayscale,
          dataUrl: updated.dataUrl,
        },
      });
    } catch {
      // ignore
    }
  };

  const selectPreset = (presetId: SizePresetId) => {
    const found = SIZE_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    onChange({
      ...specs,
      presetId: found.id,
      widthIn: found.widthIn,
      heightIn: found.heightIn,
      panelsPerSheetSide: found.panelsPerSheetSide,
    });
  };

  const handleNumberField = (
    key: 'widthIn' | 'heightIn' | 'bleedIn' | 'marginIn',
    raw: string,
    min: number,
    max: number
  ) => {
    const val = parseFloat(raw);
    if (Number.isNaN(val)) return;
    const clamped = Math.max(min, Math.min(max, val));
    onChange({
      ...specs,
      [key]: clamped,
    });
  };

  const activePreset = SIZE_PRESETS.find((p) => p.id === specs.presetId);

  return (
    <section
      id="booklet-specs"
      className="bg-[#18181B] border border-[#27272A] p-6 space-y-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#27272A] pb-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#A1A1AA]">
            01. Size, Cover &amp; Paper
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-[#E4E4E7] mt-1">
            Booklet Configuration
          </h2>
        </div>
        <span className="font-mono text-xs text-[#A1A1AA] tabular-nums">
          {specs.widthIn.toFixed(2)}&Prime; × {specs.heightIn.toFixed(2)}&Prime; · {specs.panelsPerSheetSide} per sheet side
        </span>
      </div>

      {/* Size Presets */}
      <div className="space-y-2.5">
        <label className="block font-mono text-[11px] uppercase tracking-[0.12em] text-[#A1A1AA]">
          Booklet Size Preset
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {SIZE_PRESETS.map((preset) => {
            const isSelected = specs.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset.id)}
                className={`text-left p-3 border transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#F43F5E] bg-[#F43F5E]/10 text-[#E4E4E7]'
                    : 'bg-[#111113] text-[#E4E4E7] border-[#27272A] hover:border-[#52525B]'
                }`}
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#A1A1AA] truncate">
                  {preset.label}
                </div>
                <div className="font-mono text-xs font-medium tabular-nums mt-1 text-[#E4E4E7]">
                  {preset.widthIn.toFixed(2)}&Prime; × {preset.heightIn.toFixed(2)}&Prime;
                </div>
              </button>
            );
          })}
        </div>
        {activePreset && (
          <p className="text-xs text-[#A1A1AA]">{activePreset.description}</p>
        )}
      </div>

      {/* Manual Dimensions + Bleed / Margin */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div>
          <label
            htmlFor="spec-width"
            className="block font-mono text-[11px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1.5"
          >
            Page Width (in)
          </label>
          <input
            id="spec-width"
            type="number"
            step="0.05"
            min="2.0"
            max="5.5"
            value={specs.widthIn}
            onChange={(e) => handleNumberField('widthIn', e.target.value, 2.0, 5.5)}
            className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#111113] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
          />
        </div>

        <div>
          <label
            htmlFor="spec-height"
            className="block font-mono text-[11px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1.5"
          >
            Page Height (in)
          </label>
          <input
            id="spec-height"
            type="number"
            step="0.05"
            min="3.0"
            max="8.5"
            value={specs.heightIn}
            onChange={(e) => handleNumberField('heightIn', e.target.value, 3.0, 8.5)}
            className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#111113] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
          />
        </div>

        <div>
          <label
            htmlFor="spec-bleed"
            className="block font-mono text-[11px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1.5"
          >
            Edge Bleed (in)
          </label>
          <input
            id="spec-bleed"
            type="number"
            step="0.025"
            min="0"
            max="0.375"
            value={specs.bleedIn}
            onChange={(e) => handleNumberField('bleedIn', e.target.value, 0, 0.375)}
            className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#111113] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
          />
        </div>

        <div>
          <label
            htmlFor="spec-margin"
            className="block font-mono text-[11px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1.5"
          >
            Inner Margin (in)
          </label>
          <input
            id="spec-margin"
            type="number"
            step="0.025"
            min="0.1"
            max="0.6"
            value={specs.marginIn}
            onChange={(e) => handleNumberField('marginIn', e.target.value, 0.1, 0.6)}
            className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#111113] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
          />
        </div>
      </div>

      {/* Cover Typography & Metadata */}
      <div className="pt-4 border-t border-[#27272A] grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label
            htmlFor="cover-title"
            className="block font-mono text-[11px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1.5"
          >
            Book Title
          </label>
          <input
            id="cover-title"
            type="text"
            value={specs.coverTitle}
            onChange={(e) => onChange({ ...specs, coverTitle: e.target.value })}
            placeholder="Pocket Puzzle Press"
            className="w-full px-2.5 py-2 text-xs font-mono bg-[#111113] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
          />
        </div>

        <div>
          <label
            htmlFor="cover-subtitle"
            className="block font-mono text-[11px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1.5"
          >
            Subtitle
          </label>
          <input
            id="cover-subtitle"
            type="text"
            value={specs.coverSubtitle}
            onChange={(e) => onChange({ ...specs, coverSubtitle: e.target.value })}
            placeholder="Mixed Logic & Crosswords"
            className="w-full px-2.5 py-2 text-xs font-mono bg-[#111113] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
          />
        </div>

        <div>
          <label
            htmlFor="edition-str"
            className="block font-mono text-[11px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-1.5"
          >
            Edition String
          </label>
          <input
            id="edition-str"
            type="text"
            value={specs.editionString}
            onChange={(e) => onChange({ ...specs, editionString: e.target.value })}
            placeholder="Vol. IV · Nov 2026"
            className="w-full px-2.5 py-2 text-xs font-mono bg-[#111113] border border-[#27272A] text-[#E4E4E7] focus:outline-none focus:border-[#F43F5E]"
          />
        </div>
      </div>

      {/* Front Cover Logo / Image Upload */}
      <div className="pt-4 border-t border-[#27272A]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 shrink-0 border border-[#3F3F46] bg-white flex items-center justify-center overflow-hidden p-1">
              {specs.coverImage ? (
                <img
                  src={specs.coverImage.dataUrl}
                  alt={specs.coverImage.filename}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="w-5 h-5 border border-[#18181B] flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full border border-[#18181B]" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#E4E4E7] font-medium">
                Front Cover Logo or Artwork
              </div>
              {specs.coverImage ? (
                <div className="text-[11px] text-[#A1A1AA] font-mono truncate mt-0.5">
                  {specs.coverImage.filename} · {specs.coverImage.width}×{specs.coverImage.height}px
                </div>
              ) : (
                <div className="text-xs text-[#A1A1AA] mt-0.5">
                  Optional PNG, JPG, SVG, or WebP emblem (replaces default mark)
                </div>
              )}
              {logoError && (
                <div className="text-[11px] text-[#FB7185] mt-0.5">{logoError}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {specs.coverImage && (
              <label className="flex items-center gap-1.5 text-xs text-[#E4E4E7] cursor-pointer px-2.5 py-1.5 border border-[#27272A] bg-[#111113]">
                <input
                  type="checkbox"
                  checked={specs.coverImage.grayscale}
                  onChange={(e) => void handleToggleGrayscale(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#F43F5E] cursor-pointer"
                />
                <span className="font-mono text-[11px]">B&amp;W Grayscale</span>
              </label>
            )}

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => void handleLogoUpload(e.target.files?.[0])}
              className="hidden"
            />
            <button
              type="button"
              disabled={isProcessingLogo}
              onClick={() => logoInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium bg-[#111113] border border-[#3F3F46] text-[#E4E4E7] hover:border-[#E4E4E7] cursor-pointer whitespace-nowrap"
            >
              <ImagePlus className="w-3.5 h-3.5 text-[#F43F5E]" />
              <span>
                {isProcessingLogo
                  ? 'Processing...'
                  : specs.coverImage
                  ? 'Replace Image'
                  : 'Upload Logo / Image'}
              </span>
            </button>

            {specs.coverImage && (
              <button
                type="button"
                onClick={() => onChange({ ...specs, coverImage: undefined })}
                aria-label="Remove front cover image"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono font-medium text-[#FB7185] bg-[#111113] border border-[#3F3F46] hover:border-[#F43F5E] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Paper Style & Binding Toggles */}
      <div className="pt-4 border-t border-[#27272A] grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block font-mono text-[11px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-2">
            Paper Background
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PAPER_STYLE_OPTIONS.map((opt) => {
              const active = specs.paperStyle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange({ ...specs, paperStyle: opt.id as PaperStyle })}
                  className={`flex items-center gap-2.5 p-2.5 text-left border transition-colors cursor-pointer ${
                    active
                      ? 'border-[#F43F5E] bg-[#F43F5E]/10 text-[#E4E4E7]'
                      : 'border-[#27272A] bg-[#111113] text-[#A1A1AA] hover:border-[#52525B] hover:text-[#E4E4E7]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-5 h-5 shrink-0 border border-[#52525B] ${
                      opt.id === 'dot-grid'
                        ? 'bg-white paper-dot-grid'
                        : opt.id === 'graph-grid'
                        ? 'bg-white paper-graph-grid'
                        : 'bg-white'
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-[#E4E4E7] truncate">
                      {opt.label}
                    </span>
                    <span className="block text-[10px] font-mono text-[#A1A1AA] truncate">
                      {opt.spec}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-[#A1A1AA] mb-2">
            Print &amp; Answer Options
          </span>
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-3 px-3 py-2 bg-[#111113] border border-[#27272A] cursor-pointer">
              <span className="text-xs font-medium text-[#E4E4E7]">
                Corner Cut Marks
              </span>
              <input
                type="checkbox"
                checked={specs.cropMarks}
                onChange={(e) => onChange({ ...specs, cropMarks: e.target.checked })}
                className="w-4 h-4 accent-[#F43F5E] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 px-3 py-2 bg-[#111113] border border-[#27272A] cursor-pointer">
              <span className="text-xs font-medium text-[#E4E4E7]">
                Center Fold Line
              </span>
              <input
                type="checkbox"
                checked={specs.centerFoldGuides}
                onChange={(e) =>
                  onChange({ ...specs, centerFoldGuides: e.target.checked })
                }
                className="w-4 h-4 accent-[#F43F5E] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 px-3 py-2 bg-[#111113] border border-[#27272A] cursor-pointer">
              <span className="text-xs font-medium text-[#E4E4E7]">
                Include Answer Key at Back
              </span>
              <input
                type="checkbox"
                checked={specs.includeAnswerKey}
                onChange={(e) =>
                  onChange({ ...specs, includeAnswerKey: e.target.checked })
                }
                className="w-4 h-4 accent-[#F43F5E] cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
};
