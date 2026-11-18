package com.launchguard

import android.app.Application
import kotlinx.coroutines.flow.MutableStateFlow

enum class ServiceStatus { DISCONNECTED, READY, WINDOW_UNAVAILABLE }

class LaunchGuardApp : Application() {
    val settings by lazy { GuardSettings(this) }
    val catalog by lazy { InstalledApps(this) }
    val serviceStatus = MutableStateFlow(ServiceStatus.DISCONNECTED)
}
