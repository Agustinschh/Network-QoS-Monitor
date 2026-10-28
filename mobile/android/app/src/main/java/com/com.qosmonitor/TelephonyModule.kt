package com.qosmonitor

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.CellInfo
import android.telephony.CellInfoGsm
import android.telephony.CellInfoLte
import android.telephony.CellInfoNr
import android.telephony.CellInfoWcdma
import android.telephony.PhoneStateListener
import android.telephony.SignalStrength
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Módulo nativo propio para acceder a TelephonyManager en Android.
 * Cumple con RF-01 y las especificaciones técnicas del Trabajo Práctico:
 * - Operador de red (networkOperatorName / simOperatorName).
 * - Tipo de red celular (2G, 3G, 4G/LTE, 5G NR).
 * - Nivel de señal en dBm (RSSI / RSRP), nivel de barras (0-4) y ASU.
 * - Soporte para eventos reactivos en tiempo real (TelephonyCallback / PhoneStateListener).
 */
class TelephonyModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val telephonyManager: TelephonyManager? =
        reactContext.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager

    private var telephonyCallback: Any? = null
    private var phoneStateListener: PhoneStateListener? = null
    private var isListening = false

    override fun getName(): String = "NetworkTelephonyModule"

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            reactContext, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            reactContext, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun mapNetworkType(type: Int): Pair<String, String> {
        return when (type) {
            TelephonyManager.NETWORK_TYPE_GPRS,
            TelephonyManager.NETWORK_TYPE_EDGE,
            TelephonyManager.NETWORK_TYPE_CDMA,
            TelephonyManager.NETWORK_TYPE_1xRTT,
            TelephonyManager.NETWORK_TYPE_IDEN,
            TelephonyManager.NETWORK_TYPE_GSM -> Pair("2g", "GSM/EDGE")

            TelephonyManager.NETWORK_TYPE_UMTS,
            TelephonyManager.NETWORK_TYPE_EVDO_0,
            TelephonyManager.NETWORK_TYPE_EVDO_A,
            TelephonyManager.NETWORK_TYPE_HSDPA,
            TelephonyManager.NETWORK_TYPE_HSUPA,
            TelephonyManager.NETWORK_TYPE_HSPA,
            TelephonyManager.NETWORK_TYPE_EVDO_B,
            TelephonyManager.NETWORK_TYPE_EHRPD,
            TelephonyManager.NETWORK_TYPE_HSPAP,
            TelephonyManager.NETWORK_TYPE_TD_SCDMA -> Pair("3g", "3G/HSPA")

            TelephonyManager.NETWORK_TYPE_LTE,
            TelephonyManager.NETWORK_TYPE_IWLAN,
            19 /* TelephonyManager.NETWORK_TYPE_LTE_CA */ -> Pair("4g", "4G/LTE")

            TelephonyManager.NETWORK_TYPE_NR -> Pair("5g", "5G NR")

            else -> Pair("unknown", "Desconocido")
        }
    }

    private fun buildCellularPayload(): WritableMap {
        val payload = Arguments.createMap()
        val tm = telephonyManager

        if (tm == null) {
            payload.putBoolean("isAvailable", false)
            payload.putString("reason", "TELEPHONY_NOT_AVAILABLE")
            return payload
        }

        payload.putBoolean("isAvailable", true)

        // Operador
        val networkOperator = tm.networkOperatorName.takeIf { !it.isNullOrBlank() }
        val simOperator = tm.simOperatorName.takeIf { !it.isNullOrBlank() }
        val operator = networkOperator ?: simOperator ?: "Sin red celular"
        payload.putString("operator", operator)
        payload.putString("simOperator", simOperator ?: "")
        payload.putString("countryIso", tm.networkCountryIso ?: tm.simCountryIso ?: "")

        // Tipo de red
        val rawNetworkType = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                tm.dataNetworkType
            } else {
                @Suppress("DEPRECATION")
                tm.networkType
            }
        } catch (e: SecurityException) {
            TelephonyManager.NETWORK_TYPE_UNKNOWN
        }

        val (gen, techName) = mapNetworkType(rawNetworkType)
        payload.putString("generation", gen)
        payload.putString("technology", techName)
        payload.putInt("rawNetworkType", rawNetworkType)

        // Nivel de señal y dBm
        var dbm: Int? = null
        var level = 0
        var asuLevel = 0

        if (hasLocationPermission()) {
            try {
                val allCells: List<CellInfo>? = tm.allCellInfo
                val registeredCell = allCells?.firstOrNull { it.isRegistered } ?: allCells?.firstOrNull()

                if (registeredCell != null) {
                    when (registeredCell) {
                        is CellInfoLte -> {
                            val ss = registeredCell.cellSignalStrength
                            dbm = ss.dbm
                            level = ss.level
                            asuLevel = ss.asuLevel
                        }
                        is CellInfoWcdma -> {
                            val ss = registeredCell.cellSignalStrength
                            dbm = ss.dbm
                            level = ss.level
                            asuLevel = ss.asuLevel
                        }
                        is CellInfoGsm -> {
                            val ss = registeredCell.cellSignalStrength
                            dbm = ss.dbm
                            level = ss.level
                            asuLevel = ss.asuLevel
                        }
                        else -> {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && registeredCell is CellInfoNr) {
                                val ss = registeredCell.cellSignalStrength
                                dbm = ss.dbm
                                level = ss.level
                                asuLevel = ss.asuLevel
                            }
                        }
                    }
                }
            } catch (e: SecurityException) {
                // Permiso revocado en runtime
            }
        }

        // Fallback para señal si allCellInfo no devolvió dBm
        if (dbm == null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val signalStrength = tm.signalStrength
                if (signalStrength != null) {
                    val cellSignals = signalStrength.cellSignalStrengths
                    val first = cellSignals.firstOrNull()
                    if (first != null) {
                        dbm = first.dbm
                        level = first.level
                        asuLevel = first.asuLevel
                    }
                }
            } catch (e: Exception) {
                // Ignorar fallback
            }
        }

        if (dbm != null && dbm != Int.MAX_VALUE && dbm < 0) {
            payload.putInt("signalDbm", dbm)
        } else {
            payload.putNull("signalDbm")
        }

        payload.putInt("signalLevel", level) // 0 (pésima) a 4 (excelente)
        payload.putInt("asuLevel", asuLevel)
        payload.putDouble("timestamp", System.currentTimeMillis().toDouble())

        return payload
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    @ReactMethod
    fun getCellularInfo(promise: Promise) {
        try {
            val payload = buildCellularPayload()
            promise.resolve(payload)
        } catch (e: Exception) {
            promise.reject("TELEPHONY_ERROR", e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun startListening() {
        if (isListening || telephonyManager == null) return
        isListening = true

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+ (API 31+) usa TelephonyCallback
            val callback = object : TelephonyCallback(),
                TelephonyCallback.SignalStrengthsListener,
                TelephonyCallback.DisplayInfoListener {
                override fun onSignalStrengthsChanged(signalStrength: SignalStrength) {
                    sendEvent("onCellInfoChanged", buildCellularPayload())
                }
                override fun onDisplayInfoChanged(telephonyDisplayInfo: android.telephony.TelephonyDisplayInfo) {
                    sendEvent("onCellInfoChanged", buildCellularPayload())
                }
            }
            telephonyCallback = callback
            reactContext.currentActivity?.mainExecutor?.let { executor ->
                telephonyManager.registerTelephonyCallback(executor, callback)
            }
        } else {
            // Pre-Android 12
            val listener = object : PhoneStateListener() {
                @Suppress("DEPRECATION")
                override fun onSignalStrengthsChanged(signalStrength: SignalStrength?) {
                    sendEvent("onCellInfoChanged", buildCellularPayload())
                }
            }
            phoneStateListener = listener
            @Suppress("DEPRECATION")
            telephonyManager.listen(listener, PhoneStateListener.LISTEN_SIGNAL_STRENGTHS)
        }
    }

    @ReactMethod
    fun stopListening() {
        if (!isListening || telephonyManager == null) return
        isListening = false

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (telephonyCallback as? TelephonyCallback)?.let {
                telephonyManager.unregisterTelephonyCallback(it)
            }
            telephonyCallback = null
        } else {
            phoneStateListener?.let {
                @Suppress("DEPRECATION")
                telephonyManager.listen(it, PhoneStateListener.LISTEN_NONE)
            }
            phoneStateListener = null
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Requerido por NativeEventEmitter de React Native
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Requerido por NativeEventEmitter de React Native
    }
}
