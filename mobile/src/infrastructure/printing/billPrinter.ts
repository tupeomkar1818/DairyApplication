import { Platform } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';

import { bytesToBase64 } from '@/src/infrastructure/printing/base64';

/**
 * The counter's bill printer.
 *
 * A counter printer is a Bluetooth thermal printer that takes ESC/POS bytes (see `domain/counter/receipt.ts`).
 * `react-native-bluetooth-classic` is a plain serial pipe to it — the bytes are ours, the socket is its.
 *
 * **It only works in a build.** The native side of that module is not in Expo Go and not on the web, so the
 * methods are simply missing there. That is checked rather than assumed, and when it is missing a sale is still
 * rung up and saved and the desk is told the bill did not print — losing a sale because a printer is off would be
 * the wrong trade.
 *
 * The printer is paired with the phone once, in Android's own Bluetooth settings; this only lists what is already
 * paired. That is deliberate — pairing is fiddly, it belongs to the phone, and it is done once per printer.
 */

export type PrinterDevice = { id: string; name: string };

export interface BillPrinter {
  /** False on the web and in Expo Go; true in a build that has the native module. */
  isSupported(): boolean;
  /** Printers already paired with this phone. */
  list(): Promise<PrinterDevice[]>;
  connect(device: PrinterDevice): Promise<void>;
  disconnect(): Promise<void>;
  connected(): PrinterDevice | null;
  /** Sends the bill. Throws if it does not go. */
  write(bytes: Uint8Array): Promise<void>;
}

/** The module is there in a build and missing everywhere else; this is the one place that has to know. */
function nativeIsThere(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return typeof RNBluetoothClassic?.getBondedDevices === 'function' && typeof RNBluetoothClassic?.writeToDevice === 'function';
  } catch {
    return false;
  }
}

class BluetoothBillPrinter implements BillPrinter {
  private current: PrinterDevice | null = null;

  isSupported(): boolean {
    return nativeIsThere();
  }

  async list(): Promise<PrinterDevice[]> {
    if (!nativeIsThere()) return [];
    // A printer that is switched off is still paired, so it is listed — connecting is what finds out.
    const bonded = await RNBluetoothClassic.getBondedDevices();
    return bonded.map((d) => ({ id: d.address, name: d.name || d.address }));
  }

  async connect(device: PrinterDevice): Promise<void> {
    if (!nativeIsThere()) throw new Error('NO_PRINTER_MODULE');
    await RNBluetoothClassic.connectToDevice(device.id);
    this.current = device;
  }

  async disconnect(): Promise<void> {
    const device = this.current;
    this.current = null;
    if (!nativeIsThere() || !device) return;
    try {
      await RNBluetoothClassic.disconnectFromDevice(device.id);
    } catch {
      // Already gone — which is what was wanted.
    }
  }

  connected(): PrinterDevice | null {
    return this.current;
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!nativeIsThere()) throw new Error('NO_PRINTER_MODULE');
    const device = this.current;
    if (!device) throw new Error('NO_PRINTER_CONNECTED');
    // Base64 because the bytes are a command stream, not text: anything that tries to read them as characters
    // mangles the control codes and the bill comes out as nonsense.
    const sent = await RNBluetoothClassic.writeToDevice(device.id, bytesToBase64(bytes), 'base64');
    if (!sent) throw new Error('PRINTER_REFUSED');
  }
}

export const billPrinter: BillPrinter = new BluetoothBillPrinter();
