package com.launchguard

import android.content.Context
import androidx.annotation.MainThread
import androidx.core.content.edit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class Appearance(val label: String) {
    SYSTEM("跟随系统"), LIGHT("浅色"), DARK("深色")
}

class GuardSettings(context: Context) {
    private val storage = context.getSharedPreferences("launch_guard", Context.MODE_PRIVATE)
    private val protectedState = MutableStateFlow(
        storage.getStringSet("protected_apps", emptySet()).orEmpty().toSet()
    )
    private val appearanceState = MutableStateFlow(
        Appearance.entries.firstOrNull { it.name == storage.getString("appearance", null) }
            ?: Appearance.SYSTEM
    )
    val protectedApps = protectedState.asStateFlow()
    val appearance = appearanceState.asStateFlow()

    @MainThread
    fun add(packages: Set<String>) = saveRules(protectedState.value + packages)

    @MainThread
    fun remove(packageName: String) = saveRules(protectedState.value - packageName)

    @MainThread
    fun setAppearance(appearance: Appearance) {
        storage.edit { putString("appearance", appearance.name) }
        appearanceState.value = appearance
    }

    private fun saveRules(packages: Set<String>) {
        storage.edit { putStringSet("protected_apps", packages) }
        protectedState.value = packages
    }
}
