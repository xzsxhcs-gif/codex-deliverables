package com.launchguard.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.launchguard.InstalledApp
import com.launchguard.guard.GateState
import com.launchguard.guard.WifiStatus

@Composable
internal fun ConfirmScreen(
    app: InstalledApp,
    gate: GateState,
    onConfirm: () -> Unit,
    onWifiSettings: () -> Unit,
    onCancel: () -> Unit
) {
    val wifiOff = gate.wifi == WifiStatus.OFF
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding()) {
            val usableHeight = maxHeight
            Box(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                    .heightIn(min = usableHeight).padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    modifier = Modifier.widthIn(max = 420.dp).fillMaxWidth(),
                    shape = RoundedCornerShape(28.dp),
                    color = MaterialTheme.colorScheme.surfaceContainer
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        AppIcon(app, 64.dp)
                        Text(
                            "启动确认",
                            modifier = Modifier.semantics { heading() },
                            style = MaterialTheme.typography.headlineSmall
                        )
                        Text(
                            "即将打开：${app.label}",
                            style = MaterialTheme.typography.titleMedium,
                            textAlign = TextAlign.Center
                        )
                        Text(
                            "请确认 Wi-Fi 已经关闭。",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )
                        WifiStateNotice(gate.wifi)
                        gate.message?.let {
                            Text(
                                it,
                                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                        Button(onConfirm, Modifier.fillMaxWidth(), enabled = wifiOff && !gate.busy) {
                            Text("确认并继续")
                        }
                        if (!wifiOff) {
                            OutlinedButton(onWifiSettings, Modifier.fillMaxWidth(), enabled = !gate.busy) {
                                Text("打开 Wi-Fi 设置")
                            }
                        }
                        OutlinedButton(onCancel, Modifier.fillMaxWidth(), enabled = !gate.busy) {
                            Text("取消启动")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WifiStateNotice(wifi: WifiStatus) {
    val title = when (wifi) {
        WifiStatus.OFF -> "Wi-Fi 已关闭"
        WifiStatus.ON -> "Wi-Fi 仍处于开启状态"
        WifiStatus.CHANGING -> "Wi-Fi 正在切换"
        WifiStatus.UNAVAILABLE -> "无法确认 Wi-Fi 状态"
    }
    val explanation = when (wifi) {
        WifiStatus.OFF -> null
        WifiStatus.ON -> "请先关闭 Wi-Fi"
        WifiStatus.CHANGING -> "请等待开关状态更新"
        WifiStatus.UNAVAILABLE -> "请在系统设置检查 Wi-Fi 开关"
    }
    Surface(
        modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        shape = RoundedCornerShape(16.dp),
        color = if (wifi == WifiStatus.OFF) MaterialTheme.colorScheme.primaryContainer
        else MaterialTheme.colorScheme.surfaceContainerHigh
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            explanation?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
        }
    }
}
