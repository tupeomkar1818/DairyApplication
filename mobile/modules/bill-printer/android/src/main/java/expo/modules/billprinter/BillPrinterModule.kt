package expo.modules.billprinter

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException
import java.util.UUID

/**
 * The counter's bill printer, over Bluetooth.
 *
 * A thermal counter printer is a serial device: open a socket, push ESC/POS bytes, close it. That is the whole of
 * what this does — the bill is laid out in TypeScript (`domain/counter/receipt.ts`) and arrives here as bytes.
 *
 * Written as a module of our own rather than taken off the shelf: the libraries for this are built for the old
 * React Native architecture, which 0.86 no longer has. Four operations are not worth depending on an unmaintained
 * package for.
 *
 * Pairing is Android's job, done once in its own Bluetooth settings. This only lists what is already paired —
 * which also means a printer that is switched off still appears, and connecting is what finds out.
 */

private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

class BillPrinterModule : Module() {
  private var socket: BluetoothSocket? = null
  private var connectedAddress: String? = null

  private val adapter: BluetoothAdapter?
    get() = BluetoothAdapter.getDefaultAdapter()

  /**
   * Android 12 renamed the permissions for this, so which one to ask for depends on the phone. Without it, listing
   * paired devices throws a SecurityException rather than returning nothing, which would be a crash at the counter.
   */
  private fun mayUseBluetooth(): Boolean {
    val context = appContext.reactContext ?: return false
    val needed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      Manifest.permission.BLUETOOTH_CONNECT
    } else {
      Manifest.permission.BLUETOOTH
    }
    return ContextCompat.checkSelfPermission(context, needed) == PackageManager.PERMISSION_GRANTED
  }

  private fun closeQuietly() {
    try {
      socket?.close()
    } catch (_: IOException) {
      // Already gone, which is what was wanted.
    }
    socket = null
    connectedAddress = null
  }

  override fun definition() = ModuleDefinition {
    Name("BillPrinter")

    /** Whether this phone can talk to a printer at all: hardware present, switched on, and allowed. */
    Function("isAvailable") {
      adapter != null && adapter?.isEnabled == true && mayUseBluetooth()
    }

    /** Printers already paired with this phone, as {id, name}. */
    Function("pairedPrinters") {
      if (!mayUseBluetooth()) throw PermissionMissing()
      val bonded: Set<BluetoothDevice> = adapter?.bondedDevices ?: emptySet()
      bonded.map { mapOf("id" to it.address, "name" to (it.name ?: it.address)) }
    }

    /** Opens the socket. Any previous one is closed first — two sockets to one printer prints two halves of a bill. */
    AsyncFunction("connect") { address: String ->
      if (!mayUseBluetooth()) throw PermissionMissing()
      closeQuietly()

      val device = adapter?.getRemoteDevice(address) ?: throw NoSuchPrinter(address)
      // Discovery and a socket at the same time make the connection fail more often than not.
      try {
        adapter?.cancelDiscovery()
      } catch (_: SecurityException) {
      }

      try {
        val fresh = device.createRfcommSocketToServiceRecord(SPP_UUID)
        fresh.connect()
        socket = fresh
        connectedAddress = address
      } catch (e: IOException) {
        closeQuietly()
        throw CouldNotConnect(address, e)
      } catch (e: SecurityException) {
        closeQuietly()
        throw PermissionMissing()
      }
    }

    AsyncFunction("disconnect") {
      closeQuietly()
    }

    /** The address of the printer this phone is talking to, or null. */
    Function("connectedPrinter") {
      if (socket?.isConnected == true) connectedAddress else null
    }

    /**
     * Sends a bill. The bytes arrive base64-encoded because they are a command stream, not text — anything that
     * reads them as characters mangles the control codes and the bill comes out as nonsense.
     */
    AsyncFunction("write") { base64: String ->
      val live = socket
      if (live == null || !live.isConnected) throw NotConnected()
      val bytes = try {
        Base64.decode(base64, Base64.DEFAULT)
      } catch (e: IllegalArgumentException) {
        throw BadPayload()
      }
      try {
        live.outputStream.write(bytes)
        live.outputStream.flush()
      } catch (e: IOException) {
        // A printer switched off mid-bill leaves a socket that looks open; drop it so the next print reconnects.
        closeQuietly()
        throw WriteFailed(e)
      }
    }
  }
}

internal class PermissionMissing :
  CodedException("BLUETOOTH_PERMISSION", "Allow Bluetooth so the app can reach the printer.", null)

internal class NoSuchPrinter(address: String) :
  CodedException("PRINTER_NOT_FOUND", "No paired printer at $address.", null)

internal class CouldNotConnect(address: String, cause: Throwable) :
  CodedException("PRINTER_UNREACHABLE", "Could not reach the printer at $address. Is it switched on?", cause)

internal class NotConnected :
  CodedException("PRINTER_NOT_CONNECTED", "No printer is connected.", null)

internal class BadPayload :
  CodedException("PRINTER_BAD_PAYLOAD", "The bill could not be read as bytes.", null)

internal class WriteFailed(cause: Throwable) :
  CodedException("PRINTER_WRITE_FAILED", "The bill did not reach the printer.", cause)
