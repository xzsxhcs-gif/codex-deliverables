package com.launchguard.guard

import android.accessibilityservice.AccessibilityService
import android.app.KeyguardManager
import android.content.ActivityNotFoundException
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import androidx.core.content.ContextCompat
import com.launchguard.LaunchGuardApp
import com.launchguard.ServiceStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class GuardService : AccessibilityService() {
    private val app get() = application as LaunchGuardApp
    private val handler = Handler(Looper.getMainLooper())
    private val foreground = ForegroundReader(this)
    private val visit = ForegroundSession()
    private var scope: CoroutineScope? = null
    private var overlay: GuardOverlay? = null
    private var hint: WindowHint? = null
    private var failedVisit: String? = null
    private var action: GateAction? = null
    private var message: String? = null

    private val checkForeground = Runnable { scan(allowFollowUp = true) }
    private val followUp = Runnable { scan(allowFollowUp = false) }
    private val actionTimeout = Runnable {
        scan(allowFollowUp = false)
        val unfinished = action
        action = null
        if (unfinished != null) {
            message = unfinished.failureText
            refreshOverlay()
        }
    }

    private val deviceEvents = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_SCREEN_OFF -> {
                    hint = null
                    handler.removeCallbacks(followUp)
                    clearVisit()
                }
                Intent.ACTION_SCREEN_ON, Intent.ACTION_USER_PRESENT -> queueScan()
                WifiManager.WIFI_STATE_CHANGED_ACTION -> refreshOverlay()
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        if (scope != null) return
        ContextCompat.registerReceiver(
            this,
            deviceEvents,
            IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_OFF)
                addAction(Intent.ACTION_SCREEN_ON)
                addAction(Intent.ACTION_USER_PRESENT)
                addAction(WifiManager.WIFI_STATE_CHANGED_ACTION)
            },
            ContextCompat.RECEIVER_EXPORTED
        )
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate).also { serviceScope ->
            serviceScope.launch {
                app.settings.protectedApps.collect { queueScan() }
            }
        }
        app.serviceStatus.value = ServiceStatus.READY
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (scope == null || app.settings.protectedApps.value.isEmpty()) return
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                val name = event.packageName?.toString()
                if (name != null && name != packageName) {
                    hint = WindowHint(event.windowId, name)
                }
            }
            AccessibilityEvent.TYPE_WINDOWS_CHANGED -> {
                val focusOrStack = AccessibilityEvent.WINDOWS_CHANGE_ADDED or
                    AccessibilityEvent.WINDOWS_CHANGE_REMOVED or AccessibilityEvent.WINDOWS_CHANGE_ACTIVE or
                    AccessibilityEvent.WINDOWS_CHANGE_FOCUSED or AccessibilityEvent.WINDOWS_CHANGE_LAYER or
                    AccessibilityEvent.WINDOWS_CHANGE_PIP
                if (event.windowChanges and focusOrStack == 0) return
            }
            else -> return
        }
        queueScan()
    }

    override fun onInterrupt() = Unit

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        // Recreate the service-owned view so its Compose window uses the new configuration.
        if (overlay != null) {
            overlay?.close()
            overlay = null
            queueScan()
        }
    }

    override fun onUnbind(intent: Intent?): Boolean {
        disconnect()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        disconnect()
        super.onDestroy()
    }

    private fun disconnect() {
        scope?.let {
            it.cancel()
            unregisterReceiver(deviceEvents)
        }
        scope = null
        handler.removeCallbacksAndMessages(null)
        clearVisit()
        app.serviceStatus.value = ServiceStatus.DISCONNECTED
    }

    private fun queueScan() {
        if (!handler.hasCallbacks(checkForeground)) handler.post(checkForeground)
    }

    private fun scan(allowFollowUp: Boolean) {
        val rules = app.settings.protectedApps.value
        if (rules.isEmpty() || isLocked()) {
            clearVisit()
            hint = null
            return
        }

        val reading = foreground.read(hint)
        if (reading == null) {
            // Window-state events can arrive before the window snapshot has been updated.
            if (allowFollowUp && !handler.hasCallbacks(followUp)) {
                handler.postDelayed(followUp, 160)
            }
            return
        }
        val pkg = reading.packageName
        if (pkg == null) {
            clearVisit()
            hint = null
            return
        }
        if (pkg != visit.packageName) {
            visit.observe(pkg)
            failedVisit = null
            dismissOverlay()
        }

        val pending = visit.pending(rules)
        if (pending == null) {
            dismissOverlay()
        } else if (overlay == null && pending != failedVisit) {
            showOverlay(pending)
        }
    }

    private fun isLocked(): Boolean =
        getSystemService(KeyguardManager::class.java).isKeyguardLocked ||
            !getSystemService(PowerManager::class.java).isInteractive

    private fun showOverlay(packageName: String) {
        val next = GuardOverlay(
            this,
            app.catalog.describe(packageName),
            onConfirm = { confirm(packageName) },
            onWifiSettings = { openWifiSettings(packageName) },
            onCancel = { cancelLaunch(packageName) }
        )
        try {
            next.show()
            overlay = next
            app.serviceStatus.value = ServiceStatus.READY
            refreshOverlay()
        } catch (_: WindowManager.BadTokenException) {
            markOverlayFailure(packageName, next)
        } catch (_: WindowManager.InvalidDisplayException) {
            markOverlayFailure(packageName, next)
        } catch (_: SecurityException) {
            markOverlayFailure(packageName, next)
        }
    }

    private fun markOverlayFailure(packageName: String, candidate: GuardOverlay) {
        candidate.close()
        failedVisit = packageName
        app.serviceStatus.value = ServiceStatus.WINDOW_UNAVAILABLE
    }

    private fun confirm(packageName: String) {
        if (!gateStillApplies(packageName)) return
        // The button's displayed state is only an aid. Re-query the real switch at the click.
        if (WifiStatus.read(this) == WifiStatus.OFF && visit.confirm(packageName)) {
            dismissOverlay()
        } else {
            refreshOverlay()
        }
    }

    @Suppress("DEPRECATION")
    private fun openWifiSettings(packageName: String) {
        if (!gateStillApplies(packageName)) return
        val intent = Intent(Settings.ACTION_WIFI_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val match = packageManager.resolveActivity(
            intent, PackageManager.MATCH_SYSTEM_ONLY or PackageManager.MATCH_DEFAULT_ONLY
        )?.activityInfo
        if (match == null) {
            message = GateAction.WIFI_SETTINGS.failureText
            refreshOverlay()
            return
        }
        intent.setClassName(match.packageName, match.name)
        beginAction(GateAction.WIFI_SETTINGS)
        try {
            startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            failAction()
        } catch (_: SecurityException) {
            failAction()
        }
    }

    private fun cancelLaunch(packageName: String) {
        if (!gateStillApplies(packageName)) return
        beginAction(GateAction.HOME)
        if (!performGlobalAction(GLOBAL_ACTION_HOME)) failAction()
    }

    private fun gateStillApplies(packageName: String): Boolean {
        if (isLocked()) {
            clearVisit()
            return false
        }
        if (action != null || overlay?.app?.packageName != packageName ||
            visit.pending(app.settings.protectedApps.value) != packageName
        ) return false

        if (foreground.read(hint)?.packageName == packageName) return true
        scan(allowFollowUp = true)
        return false
    }

    private fun beginAction(value: GateAction) {
        action = value
        message = null
        refreshOverlay()
        queueScan()
        handler.postDelayed(actionTimeout, 1_500)
    }

    private fun failAction() {
        message = action?.failureText
        action = null
        handler.removeCallbacks(actionTimeout)
        refreshOverlay()
    }

    private fun refreshOverlay() {
        overlay?.update(GateState(WifiStatus.read(this), action != null, message))
    }

    private fun clearVisit() {
        foreground.reset()
        visit.reset()
        failedVisit = null
        dismissOverlay()
    }

    private fun dismissOverlay() {
        handler.removeCallbacks(actionTimeout)
        action = null
        message = null
        overlay?.close()
        overlay = null
    }
}

private enum class GateAction(val failureText: String) {
    WIFI_SETTINGS("暂时无法打开 Wi-Fi 设置。你也可以从系统快捷设置关闭 Wi-Fi。"),
    HOME("暂时无法返回桌面。请使用系统主页键或主页手势。")
}
