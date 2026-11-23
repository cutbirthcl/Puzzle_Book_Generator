import { GameBlock, PrintSpecs, UploadLogEntry, VaultItem } from '../types/booklet';

export async function checkBackendHealth(timeoutMs = 2000): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return false;
    const data = (await res.json()) as { status?: string };
    return data?.status === 'ok';
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchBackendVault(): Promise<{
  items: VaultItem[];
  logs: UploadLogEntry[];
}> {
  const res = await fetch('/api/vault', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Vault sync failed (${res.status})`);
  }
  const data = (await res.json()) as {
    items?: VaultItem[];
    logs?: UploadLogEntry[];
  };
  return {
    items: Array.isArray(data.items) ? data.items : [],
    logs: Array.isArray(data.logs) ? data.logs : [],
  };
}

export async function uploadFileToBackend(file: File): Promise<{
  status: 'accepted' | 'rejected';
  item: VaultItem | null;
  log: UploadLogEntry;
}> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/vault/upload', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    let detail = `Upload failed (${res.status})`;
    try {
      const err = (await res.json()) as { detail?: string };
      if (err.detail) detail = err.detail;
    } catch {
      // ignore non-json error body
    }
    throw new Error(detail);
  }
  return (await res.json()) as {
    status: 'accepted' | 'rejected';
    item: VaultItem | null;
    log: UploadLogEntry;
  };
}

export async function deleteBackendVaultItem(id: string): Promise<void> {
  await fetch(`/api/vault/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function resetBackendVault(): Promise<void> {
  await fetch('/api/vault/reset', {
    method: 'POST',
  });
}

export async function generateBookletPdfFromBackend(payload: {
  specs: PrintSpecs;
  blocks: GameBlock[];
  generationSeed: number;
  vaultItems: VaultItem[];
}): Promise<Blob> {
  const res = await fetch('/api/generate-booklet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Backend PDF generation failed (${res.status})`);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/pdf')) {
    throw new Error('Backend did not return a PDF stream.');
  }
  return res.blob();
}
