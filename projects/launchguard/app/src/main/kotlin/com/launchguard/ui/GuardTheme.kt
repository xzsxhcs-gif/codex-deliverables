package com.launchguard.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.core.graphics.drawable.toBitmap
import com.launchguard.Appearance
import com.launchguard.InstalledApp

private val LightColors = lightColorScheme(
    primary = Color(0xFF294A95),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDEE7FF),
    onPrimaryContainer = Color(0xFF142957),
    background = Color(0xFFF8F9FE),
    surface = Color(0xFFF8F9FE),
    onSurface = Color(0xFF191D2B),
    onSurfaceVariant = Color(0xFF454B5F),
    surfaceContainer = Color(0xFFEBEEF7),
    surfaceContainerHigh = Color(0xFFE4E8F3)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFB5C7FF),
    onPrimary = Color(0xFF112C69),
    primaryContainer = Color(0xFF203D80),
    onPrimaryContainer = Color(0xFFDEE7FF),
    background = Color(0xFF11131C),
    surface = Color(0xFF11131C),
    onSurface = Color(0xFFE3E5F1),
    onSurfaceVariant = Color(0xFFBBC2D8),
    surfaceContainer = Color(0xFF1C202E),
    surfaceContainerHigh = Color(0xFF252A3B)
)

@Composable
internal fun usesDarkColors(appearance: Appearance): Boolean = when (appearance) {
    Appearance.SYSTEM -> isSystemInDarkTheme()
    Appearance.LIGHT -> false
    Appearance.DARK -> true
}

@Composable
internal fun GuardTheme(appearance: Appearance, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (usesDarkColors(appearance)) DarkColors else LightColors,
        content = content
    )
}

@Composable
internal fun AppIcon(app: InstalledApp, size: Dp = 44.dp) {
    val image = remember(app.icon) { app.icon?.toBitmap(128, 128)?.asImageBitmap() }
    Surface(
        modifier = Modifier.size(size),
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainerHigh
    ) {
        if (image != null) {
            Image(image, contentDescription = null, modifier = Modifier.fillMaxSize().padding(5.dp))
        } else {
            Box(contentAlignment = Alignment.Center) {
                Text(app.label.take(1).uppercase(), style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}
