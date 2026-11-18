package com.launchguard.guard

import android.accessibilityservice.AccessibilityService
import android.os.Build
import android.view.accessibility.AccessibilityWindowInfo

internal data class WindowHint(val id: Int, val packageName: String)
internal data class ForegroundReading(val packageName: String?)

/** Reads window identity only. Input methods, bubble overlays and PiP are not foreground apps. */
internal class ForegroundReader(private val service: AccessibilityService) {
    private var lastWindow: WindowHint? = null

    fun read(hint: WindowHint?): ForegroundReading? {
        val windows = service.windows
        val focused = windows.firstOrNull { it.isFocused }
        val apps = windows.filter {
            it.type == AccessibilityWindowInfo.TYPE_APPLICATION && !it.isInPictureInPictureMode
        }
        val app = apps.firstOrNull { it.isFocused } ?: when (focused?.type) {
            null, AccessibilityWindowInfo.TYPE_INPUT_METHOD -> apps.firstOrNull { it.isActive }
            AccessibilityWindowInfo.TYPE_ACCESSIBILITY_OVERLAY -> {
                // A focusable guard can take input focus. Android still exposes the app underneath.
                apps.firstOrNull()
            }
            else -> null
        }
        if (app == null) {
            // Preserve the visit over transient system surfaces, such as the notification shade,
            // if the underlying application window is still present.
            if (apps.isEmpty() && focused?.type == AccessibilityWindowInfo.TYPE_SYSTEM) {
                reset()
                return ForegroundReading(null)
            }
            return null
        }

        val id = app.id
        val node = if (Build.VERSION.SDK_INT >= 33) app.getRoot(0) else app.root
        val packageName = node?.packageName?.toString()
            ?: hint?.takeIf { it.id == id }?.packageName
            ?: lastWindow?.takeIf { it.id == id }?.packageName
            ?: return null
        lastWindow = WindowHint(id, packageName)
        return ForegroundReading(packageName)
    }

    fun reset() {
        lastWindow = null
    }
}
