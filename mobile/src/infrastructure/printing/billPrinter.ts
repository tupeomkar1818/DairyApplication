import { PermissionsAndroid, Platform } from 'react-native';

import BillPrinterNative from '@/modules/bill-printer/src/BillPrinterModule';
import { bytesToBase64 } from '@/src/infrastructure/printing/base64';

/**
 * The counter's bill printer.
 *
 * A counter printer is a Bluetooth thermal printer that takes ESC/POS bytes (see `domain/counter/receipt.ts`).
 * The socket is `modules/bill-printer`, written for this app: the libraries that do this are built for the old
 * React Native architecture, which 0.86 no longer has, and four operations are not worth an unmaintained
 * dependency for.
 *
 * **It only works in a build**, and only on Android — Expo Go has no native side for it, a browser has no
 * Bluetooth of this kind, and iOS does not let an app talk to a serial accessory that is not MFi-certified, which
 * a ₹2,000 counter printer is not. `isSupported()` says so plainly, and the counter screen tells the desk. A sale
 * is still rung up and saved whatever the printer is doing: losing a sale because a printer is off would be the
 * wrong trade.
 *
 * Pairing is Android's own job, done once in its Bluetooth settings. This lists only what is already paired, so a
 * printer that is switched off still appears — connecting is what finds out.
 */

export type PrinterDevice = { id: string; name: string };

export interface BillPrinter {
  /** False on the web and in Expo Go; true in an Android build with Bluetooth on and allowed. */
  isSupported(): boolean;
  /** Asks Android for the Bluetooth permission, if it has not been given. */
  requestPermission(): Promise<boolean>;
  /** Printers already paired with this phone. */
  list(): Promise<PrinterDevice[]>;
  connect(device: PrinterDevice): Promise<void>;
  disconnect(): Promise<void>;
  connected(): PrinterDevice | null;
  /** Sends the bill. Throws if it does not go. */
  write(bytes: Uint8Array): Promise<void>;
}

class NativeBillPrinter implements BillPrinter {
  /** The name is kept here: the native side knows an address, and the desk reads a name. */
  private current: PrinterDevice | null = null;

  isSupported(): boolean {
    try {
      return BillPrinterNative.isAvailable();
    } catch {
      // No native side at all — Expo Go, or a platform without the module.
      return false;
    }
  }

  /**
   * Asks Android for Bluetooth.
   *
   * Done here rather than natively because React Native already has it, and because which permission to ask for
   * depends on the phone: Android 12 split the old blanket BLUETOOTH into connect and scan, and asking for a
   * permission a phone has never heard of is refused outright.
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      if (Number(Platform.Version) >= 31) {
        const answer = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]);
        // Connecting is what matters; scanning is only for finding a printer that is not paired yet.
        return answer[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
      }
      // Older phones grant the old permission at install time, so there is nothing to ask.
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<PrinterDevice[]> {
    try {
      return BillPrinterNative.pairedPrinters();
    } catch {
      return [];
    }
  }

  async connect(device: PrinterDevice): Promise<void> {
    await BillPrinterNative.connect(device.id);
    this.current = device;
  }

  async disconnect(): Promise<void> {
    this.current = null;
    try {
      await BillPrinterNative.disconnect();
    } catch {
      // Already gone, which is what was wanted.
    }
  }

  connected(): PrinterDevice | null {
    try {
      // The native side is the truth: a printer switched off mid-bill is no longer connected, whatever we think.
      const address = BillPrinterNative.connectedPrinter();
      if (!address) {
        this.current = null;
        return null;
      }
      return this.current?.id === address ? this.current : { id: address, name: address };
    } catch {
      return null;
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    // Base64 because the bytes are a command stream, not text: anything that reads them as characters mangles the
    // control codes and the bill comes out as nonsense.
    await BillPrinterNative.write(bytesToBase64(bytes));
  }
}

export const billPrinter: BillPrinter = new NativeBillPrinter();
