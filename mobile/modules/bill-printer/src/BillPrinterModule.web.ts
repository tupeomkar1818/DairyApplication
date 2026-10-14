import { NativeModule, registerWebModule } from 'expo';

import type { PairedPrinter } from './BillPrinterModule';

/**
 * A browser has no counter printer, so this says so rather than pretending.
 *
 * It matters that it answers at all: the counter screen is the same screen on the web preview, and it has to be
 * able to ask "is there a printer?" and get a plain no.
 */
class BillPrinterModule extends NativeModule<Record<never, never>> {
  isAvailable(): boolean {
    return false;
  }
  pairedPrinters(): PairedPrinter[] {
    return [];
  }
  async connect(): Promise<void> {
    throw new Error('A browser cannot reach a Bluetooth printer.');
  }
  async disconnect(): Promise<void> {}
  connectedPrinter(): string | null {
    return null;
  }
  async write(): Promise<void> {
    throw new Error('A browser cannot reach a Bluetooth printer.');
  }
}

export default registerWebModule(BillPrinterModule, 'BillPrinterModule');
