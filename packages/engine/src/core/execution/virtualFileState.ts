import { createHash } from 'crypto';

export interface VirtualFileStateItem {
  content: string;
  exists: boolean;
}

export type VirtualFileState = Map<string, VirtualFileStateItem>;

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
