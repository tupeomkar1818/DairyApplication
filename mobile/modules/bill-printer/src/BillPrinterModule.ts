import { NativeModule, requireNativeModule } from 'expo';

export type PairedPrinter = { id: string; name: string };

/**
 * The native side of the counter's bill printer. Android only — see `index.ts` for why.
 */
declare class BillPrinterModule extends NativeModule<Record<never, never>> {
  isAvailable(): boolean;
  requestPermission(): Promise<boolean>;
  pairedPrinters(): PairedPrinter[];
  connect(address: string): Promise<void>;
  disconnect(): Promise<void>;
  connectedPrinter(): string | null;
  /** The bill as base64, because it is a command stream rather than text. */
  write(base64: string): Promise<void>;
}

export default requireNativeModule<BillPrinterModule>('BillPrinter');
