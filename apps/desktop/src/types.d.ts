import type { InscribeAPI } from './types/ipc';

declare global {
  interface Window {
    inscribeAPI: InscribeAPI;
  }
}

export {};
