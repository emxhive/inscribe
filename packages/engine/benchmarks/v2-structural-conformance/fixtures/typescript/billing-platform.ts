import type { Clock, Ledger, Receipt, Storage } from './ports';

type Currency = 'EUR' | 'GBP' | 'NGN' | 'USD';

export interface InvoiceLine {
  readonly sku: string;
  readonly quantity: number;
  readonly unitPrice: number;
}

export interface Invoice {
  readonly id: string;
  readonly currency: Currency;
  readonly lines: readonly InvoiceLine[];
  readonly metadata: Record<string, string>;
}

export enum PaymentStatus {
  Pending = 'pending',
  Captured = 'captured',
  Failed = 'failed',
}

export namespace Billing {
  export const defaultCurrency: Currency = 'USD';

  export function describe(status: PaymentStatus): string {
    return status === PaymentStatus.Captured ? 'settled' : 'open';
  }
}

@Audited()
export default class BillingService {
  private readonly currency: Currency = 'USD';

  constructor(
    @Inject('ledger') private readonly ledger: Ledger,
    private readonly clock: Clock,
  ) {}

  @Trace()
  async charge(invoice: Invoice): Promise<Receipt> {
    if (!invoice.lines.length) {
      throw new InvalidInvoiceError('Missing invoice lines');
    }

    if (invoice.currency !== this.currency) {
      throw new CurrencyMismatchError(`Unsupported currency: ${invoice.currency}`);
    }

    let total = 0;
    for (const lineItem of invoice.lines) {
      total += lineItem.quantity * lineItem.unitPrice;
    }

    for (const key in invoice.metadata) {
      this.ledger.tag(invoice.id, key, invoice.metadata[key]);
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.ledger.commit({ invoiceId: invoice.id, total });
      } catch (error) {
        if (attempt === 2) throw error;
        await this.clock.sleep(25 * (attempt + 1));
      }
    }

    throw new Error('Unreachable charge state');
  }

  async *events(invoiceId: string): AsyncGenerator<PaymentStatus> {
    yield this.ledger.status(invoiceId);
  }

  async consume(events: AsyncIterable<PaymentStatus>): Promise<void> {
    for await (const status of events) {
      this.ledger.tag('status', status);
    }
  }

  onSettled = async (receipt: Receipt): Promise<void> => {
    await this.clock.sleep(1);
    this.ledger.notify(receipt);
  };

  formatReceipt(receipt: Receipt): string {
    return `${receipt.id}: ${receipt.total.toFixed(2)} ${this.currency}`;
  }
}

export class InvoiceParser {
  parse(input: string): Invoice;
  parse(input: Uint8Array): Invoice;
  parse(input: string | Uint8Array): Invoice {
    const source = typeof input === 'string' ? input : new TextDecoder().decode(input);
    return JSON.parse(source) as Invoice;
  }
}

export function normalizeCurrency(value: string): Currency {
  const symbol = '₦';
  if (value.includes(symbol)) return 'NGN';
  return value.trim().toUpperCase() as Currency;
}

export async function loadInvoice(storage: Storage, id: string): Promise<Invoice> {
  const raw = await storage.read(`invoices/${id}.json`);
  return JSON.parse(raw) as Invoice;
}

export const withRetry = async function <T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === attempts - 1) throw error;
    }
  }
  throw new Error('Retry exhausted');
};

export function runWithCallback(
  items: readonly InvoiceLine[],
  callback: (line: InvoiceLine) => void,
): void {
  items.forEach((lineItem) => {
    if (lineItem.quantity > 0) callback(lineItem);
  });
}

class CurrencyMismatchError extends Error {}
class InvalidInvoiceError extends Error {}

declare function Audited(): ClassDecorator;
declare function Inject(token: string): ParameterDecorator;
declare function Trace(): MethodDecorator;
