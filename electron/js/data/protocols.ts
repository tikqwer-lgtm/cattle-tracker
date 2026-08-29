/**
 * Protocols adapters over legacy window / __protocols API.
 */
export type ProtocolStep = { day: number; drug: string };
export type Protocol = { id: string; name: string; steps?: ProtocolStep[] };

export function getProtocols(): Protocol[] {
  if (typeof window.getProtocols === 'function') {
    return (window.getProtocols() as Protocol[]) || [];
  }
  return [];
}

export function ensureProtocolsLoaded(): Promise<void> | void {
  if (typeof window.ensureProtocolsLoaded === 'function') {
    return window.ensureProtocolsLoaded();
  }
}

export function addProtocol(data: { name: string; steps: ProtocolStep[] }): Promise<unknown> | unknown {
  if (typeof window.addProtocol === 'function') {
    return window.addProtocol(data);
  }
  return null;
}

export function updateProtocol(
  id: string,
  data: { name: string; steps: ProtocolStep[] }
): Promise<unknown> | unknown {
  if (typeof window.updateProtocol === 'function') {
    return window.updateProtocol(id, data);
  }
  return null;
}

export function deleteProtocol(id: string): Promise<unknown> | unknown {
  if (typeof window.deleteProtocol === 'function') {
    return window.deleteProtocol(id);
  }
  return null;
}

export function getProtocolById(id: string): Protocol | null {
  if (typeof window.getProtocolById === 'function') {
    return (window.getProtocolById(id) as Protocol) || null;
  }
  return null;
}

export function notifyInseminationCodeSelects(): void {
  if (typeof window.notifyInseminationCodeSelects === 'function') {
    window.notifyInseminationCodeSelects();
  } else if (typeof window.fillAllInseminationCodeSelects === 'function') {
    window.fillAllInseminationCodeSelects();
  }
}

export function showConfirmModal(message: string): Promise<boolean> {
  if (typeof window.showConfirmModal === 'function') {
    return window.showConfirmModal(message);
  }
  return Promise.resolve(window.confirm(message));
}
