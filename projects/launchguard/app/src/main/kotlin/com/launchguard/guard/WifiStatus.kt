package com.launchguard.guard

import android.content.Context
import android.net.wifi.WifiManager

internal enum class WifiStatus {
    OFF, ON, CHANGING, UNAVAILABLE;

    companion object {
        fun read(context: Context): WifiStatus = try {
            when (context.applicationContext.getSystemService(WifiManager::class.java)?.wifiState) {
                WifiManager.WIFI_STATE_DISABLED -> OFF
                WifiManager.WIFI_STATE_ENABLED -> ON
                WifiManager.WIFI_STATE_ENABLING, WifiManager.WIFI_STATE_DISABLING -> CHANGING
                else -> UNAVAILABLE
            }
        } catch (_: SecurityException) {
            UNAVAILABLE
        }
    }
}
