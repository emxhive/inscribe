import { detectInscribeProtocol } from './detectInscribeProtocol';
import { normalizeInscribeInput } from './intake';

export type PreparedInscribeInput =
  | {
      protocol: 'v2';
      rawInput: string;
      parseInput: string;
      normalization: null;
    }
  | {
      protocol: 'v1';
      rawInput: string;
      parseInput: string;
      normalization: ReturnType<typeof normalizeInscribeInput>;
    };

export function prepareInscribeInput(rawInput: string): PreparedInscribeInput {
  const protocol = detectInscribeProtocol(rawInput);
  if (protocol === 'v2') {
    return {
      protocol: 'v2',
      rawInput,
      parseInput: rawInput,
      normalization: null,
    };
  }

  const normalization = normalizeInscribeInput(rawInput);
  return {
    protocol: 'v1',
    rawInput,
    parseInput: normalization.text,
    normalization,
  };
}
