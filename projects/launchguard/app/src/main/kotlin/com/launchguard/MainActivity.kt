package com.launchguard

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.ActivityNotFoundException
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.launchguard.guard.GuardService
import com.launchguard.ui.LaunchGuardScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    private val guard get() = application as LaunchGuardApp
    private val installed = MutableStateFlow<List<InstalledApp>?>(null)
    private val serviceEnabled = MutableStateFlow(false)
    private var loadCatalog: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            LaunchGuardScreen(
                activity = this,
                installed = installed.collectAsStateWithLifecycle().value,
                rules = guard.settings.protectedApps.collectAsStateWithLifecycle().value,
                appearance = guard.settings.appearance.collectAsStateWithLifecycle().value,
                status = guard.serviceStatus.collectAsStateWithLifecycle().value,
                enabledInSettings = serviceEnabled.collectAsStateWithLifecycle().value,
                onOpenPermissions = ::openPermissions,
                onAdd = guard.settings::add,
                onRemove = guard.settings::remove,
                onAppearance = guard.settings::setAppearance
            )
        }
    }

    override fun onResume() {
        super.onResume()
        serviceEnabled.value = getSystemService(AccessibilityManager::class.java)
            .getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            .any {
                val service = it.resolveInfo.serviceInfo
                service.packageName == packageName && service.name == GuardService::class.java.name
            }
        loadCatalog?.cancel()
        loadCatalog = lifecycleScope.launch {
            installed.value = withContext(Dispatchers.IO) { guard.catalog.available() }
        }
    }

    private fun openPermissions() {
        try {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, "请在系统设置中搜索「无障碍」", Toast.LENGTH_LONG).show()
        }
    }
}
