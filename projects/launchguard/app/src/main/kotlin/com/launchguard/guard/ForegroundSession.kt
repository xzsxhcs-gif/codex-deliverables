package com.launchguard.guard

/** A confirmation is valid only for one continuously observed foreground visit. */
internal class ForegroundSession {
    var packageName: String? = null
        private set
    private var confirmed = false

    fun observe(packageName: String) {
        if (this.packageName != packageName) {
            this.packageName = packageName
            confirmed = false
        }
    }

    fun pending(rules: Set<String>): String? =
        packageName?.takeIf { !confirmed && it in rules }

    fun confirm(expected: String): Boolean {
        if (packageName != expected || confirmed) return false
        confirmed = true
        return true
    }

    fun reset() {
        packageName = null
        confirmed = false
    }
}
