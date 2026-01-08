import type { InscribeAPI } from './types';


declare global {
    interface Window {
        inscribeAPI: InscribeAPI;
    }
}

export {};
