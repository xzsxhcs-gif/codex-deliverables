package com.launchguard.guard

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.view.KeyEvent
import android.view.WindowManager
import android.widget.FrameLayout
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.launchguard.InstalledApp
import com.launchguard.LaunchGuardApp
import com.launchguard.ui.ConfirmScreen
import com.launchguard.ui.GuardTheme
import kotlinx.coroutines.flow.MutableStateFlow

internal data class GateState(
    val wifi: WifiStatus,
    val busy: Boolean = false,
    val message: String? = null
)

internal class GuardOverlay(
    context: Context,
    val app: InstalledApp,
    onConfirm: () -> Unit,
    onWifiSettings: () -> Unit,
    onCancel: () -> Unit
) {
    private val windows = context.getSystemService(WindowManager::class.java)
    private val owner = OverlayLifecycle()
    private val state = MutableStateFlow(GateState(WifiStatus.read(context)))
    private val appearance = (context.applicationContext as LaunchGuardApp).settings.appearance

    private val root = CancelOnBackLayout(context, onCancel).apply {
        setViewTreeLifecycleOwner(owner)
        setViewTreeSavedStateRegistryOwner(owner)
        addView(ComposeView(context).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                val theme by appearance.collectAsState()
                val gate by state.collectAsState()
                GuardTheme(theme) {
                    ConfirmScreen(app, gate, onConfirm, onWifiSettings, onCancel)
                }
            }
        }, FrameLayout.LayoutParams(-1, -1))
    }

    fun show() {
        val window = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.OPAQUE
        ).apply {
            title = "LaunchGuard"
        }

        owner.lifecycle.currentState = Lifecycle.State.RESUMED
        windows.addView(root, window)
    }

    fun update(value: GateState) {
        state.value = value
    }

    fun close() {
        if (root.parent != null) {
            windows.removeViewImmediate(root)
        }
        owner.lifecycle.currentState = Lifecycle.State.DESTROYED
    }
}

private class OverlayLifecycle : SavedStateRegistryOwner, LifecycleOwner {
    override val lifecycle = LifecycleRegistry(this)
    private val controller = SavedStateRegistryController.create(this)
    override val savedStateRegistry get() = controller.savedStateRegistry

    init {
        controller.performAttach()
        controller.performRestore(null)
        lifecycle.currentState = Lifecycle.State.CREATED
    }
}

@SuppressLint("ViewConstructor") // This view is created by the service, never inflated from XML.
private class CancelOnBackLayout(
    context: Context,
    private val onCancel: () -> Unit
) : FrameLayout(context) {
    private var unregisterBack: (() -> Unit)? = null

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (Build.VERSION.SDK_INT >= 33) {
            val dispatcher = findOnBackInvokedDispatcher()
            if (dispatcher != null) {
                val callback = OnBackInvokedCallback(onCancel)
                dispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback)
                unregisterBack = { dispatcher.unregisterOnBackInvokedCallback(callback) }
            }
        }
    }

    override fun onDetachedFromWindow() {
        unregisterBack?.invoke()
        unregisterBack = null
        super.onDetachedFromWindow()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) onCancel()
            return true
        }
        return super.dispatchKeyEvent(event)
    }
}
