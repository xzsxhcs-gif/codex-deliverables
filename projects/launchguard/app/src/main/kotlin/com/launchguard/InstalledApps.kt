package com.launchguard

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.Drawable
import android.provider.Settings
import java.text.Collator
import java.util.Locale

data class InstalledApp(val packageName: String, val label: String, val icon: Drawable?)

class InstalledApps(private val context: Context) {
    private val packages = context.packageManager

    @Suppress("DEPRECATION")
    fun available(): List<InstalledApp> {
        val homes = packages.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)
            .mapTo(mutableSetOf()) { it.activityInfo.packageName }
        val excluded = homes + wifiSettingsPackages() + context.packageName
        val collator = Collator.getInstance(Locale.SIMPLIFIED_CHINESE)
        return packages.queryIntentActivities(
            Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0
        )
            .asSequence()
            .filter { it.activityInfo.exported && it.activityInfo.packageName !in excluded }
            .map { it.activityInfo.applicationInfo }
            .distinctBy { it.packageName }
            .map { InstalledApp(it.packageName, it.loadLabel(packages).toString(), it.loadIcon(packages)) }
            .sortedWith(compareBy(collator) { it.label })
            .toList()
    }

    @Suppress("DEPRECATION")
    private fun wifiSettingsPackages(): Set<String> =
        packages.queryIntentActivities(Intent(Settings.ACTION_WIFI_SETTINGS), PackageManager.MATCH_SYSTEM_ONLY)
            .mapTo(mutableSetOf()) { it.activityInfo.packageName }

    @Suppress("DEPRECATION")
    fun describe(packageName: String): InstalledApp = try {
        val info = packages.getApplicationInfo(packageName, 0)
        InstalledApp(packageName, info.loadLabel(packages).toString(), info.loadIcon(packages))
    } catch (_: PackageManager.NameNotFoundException) {
        InstalledApp(packageName, packageName, null)
    }
}
