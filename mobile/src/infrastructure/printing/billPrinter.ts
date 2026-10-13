import { Platform } from 'react-native';

/**
 * The counter's bill printer.
 *
 * A counter printer is a Bluetooth thermal printer that takes ESC/POS bytes (see `domain/counter/receipt.ts`).
 * Talking to one is native work — a Bluetooth socket — which Expo Go cannot do and a web preview certainly cannot.
 * So the driver is loaded only if it is there, and asked for only when it is.
 *
 * **To turn printing on:** install a Bluetooth classic printer module in the app, build it with EAS (Expo Go will
 * not do), and pair the printer with the counter phone once. Until then `isSupported()` is false everywhere, the
 * sale is still rung up and saved, and the desk is told the bill did not print — which is the honest thing to say,
 * and far better than a sale that fails because a printer was not plugged in.
 */

export type PrinterDevice = { id: string; name: string };

export interface BillPrinter {
  /** False in a web preview, false in Expo Go, true in a build that has the module. */
  isSupported(): boolean;
  /** Printers already paired with this phone. */
  list(): Promise<PrinterDevice[]>;
  connect(device: PrinterDevice): Promise<void>;
  disconnect(): Promise<void>;
  connected(): PrinterDevice | null;
  /** Sends the bill. Throws if it does not go. */
  write(bytes: Uint8Array): Promise<void>;
}

/**
 * The shape the native module has to have, if one is installed.
 *
 * Deliberately small: find the paired printers, open a socket, push bytes. Every Bluetooth printer library can do
 * this much, so swapping one for another is a matter of writing a different adapter, not of changing the counter.
 */
type NativePrinterModule = {
  list: () => Promise<{ address: string; name?: string }[]>;
  connect: (address: string) => Promise<void>;
  disconnect: () => Promise<void>;
  write: (bytes: number[]) => Promise<void>;
};

/** Loaded once, and only if the module is actually in the app. */
let native: NativePrinterModule | null | undefined;

function loadNative(): NativePrinterModule | null {
  if (native !== undefined) return native;
  native = null;
  if (Platform.OS === 'web') return native;
  try {
    // Resolved at run time on purpose: a missing module has to be an absent feature, not a bundle that will not
    // build. Metro leaves a require it cannot see through alone.
    const name = 'react-native-bluetooth-escpos-printer';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = (globalThis as { require?: (id: string) => unknown }).require?.(name) as
      | { BluetoothManager?: unknown; BluetoothEscposPrinter?: unknown }
      | undefined;
    if (!mod) return native;
    native = adaptEscposModule(mod);
  } catch {
    native = null;
  }
  return native;
}

/** Wraps the common Bluetooth ESC/POS module in the small shape above. */
function adaptEscposModule(mod: Record<string, unknown>): NativePrinterModule | null {
  const manager = mod.BluetoothManager as
    | { enableBluetooth?: () => Promise<string[]>; connect?: (address: string) => Promise<void>; disconnect?: () => Promise<void> }
    | undefined;
  const printer = mod.BluetoothEscposPrinter as { printRaw?: (data: unknown) => Promise<void> } | undefined;
  if (!manager?.connect || !printer?.printRaw) return null;

  return {
    async list() {
      const paired = (await manager.enableBluetooth?.()) ?? [];
      return paired
        .map((row) => {
          try {
            return JSON.parse(row) as { address: string; name?: string };
          } catch {
            return null;
          }
        })
        .filter((d): d is { address: string; name?: string } => !!d?.address);
    },
    connect: (address) => manager.connect!(address),
    disconnect: () => manager.disconnect?.() ?? Promise.resolve(),
    write: (bytes) => printer.printRaw!(bytes),
  };
}

class BluetoothBillPrinter implements BillPrinter {
  private current: PrinterDevice | null = null;

  isSupported(): boolean {
    return loadNative() !== null;
  }

  async list(): Promise<PrinterDevice[]> {
    const mod = loadNative();
    if (!mod) return [];
    const found = await mod.list();
    return found.map((d) => ({ id: d.address, name: d.name || d.address }));
  }

  async connect(device: PrinterDevice): Promise<void> {
    const mod = loadNative();
    if (!mod) throw new Error('NO_PRINTER_MODULE');
    await mod.connect(device.id);
    this.current = device;
  }

  async disconnect(): Promise<void> {
    const mod = loadNative();
    this.current = null;
    await mod?.disconnect();
  }

  connected(): PrinterDevice | null {
    return this.current;
  }

  async write(bytes: Uint8Array): Promise<void> {
    const mod = loadNative();
    if (!mod) throw new Error('NO_PRINTER_MODULE');
    // The module takes a plain array of byte values.
    await mod.write(Array.from(bytes));
  }
}

export const billPrinter: BillPrinter = new BluetoothBillPrinter();
