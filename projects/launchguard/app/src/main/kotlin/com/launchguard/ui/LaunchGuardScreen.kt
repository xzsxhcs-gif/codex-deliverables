package com.launchguard.ui

import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import com.launchguard.Appearance
import com.launchguard.InstalledApp
import com.launchguard.ServiceStatus

private enum class Page(val title: String) {
    HOME("LaunchGuard"), ADD("添加应用"), PERMISSIONS("权限管理"), SETTINGS("设置")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun LaunchGuardScreen(
    activity: ComponentActivity,
    installed: List<InstalledApp>?,
    rules: Set<String>,
    appearance: Appearance,
    status: ServiceStatus,
    enabledInSettings: Boolean,
    onOpenPermissions: () -> Unit,
    onAdd: (Set<String>) -> Unit,
    onRemove: (String) -> Unit,
    onAppearance: (Appearance) -> Unit
) {
    var page by rememberSaveable { mutableStateOf(Page.HOME) }
    BackHandler(enabled = page != Page.HOME) { page = Page.HOME }
    val dark = usesDarkColors(appearance)
    SideEffect {
        WindowCompat.getInsetsController(activity.window, activity.window.decorView).apply {
            isAppearanceLightStatusBars = !dark
            isAppearanceLightNavigationBars = !dark
        }
    }

    GuardTheme(appearance) {
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            topBar = {
                TopAppBar(
                    title = { Text(page.title, Modifier.semantics { heading() }) },
                    navigationIcon = {
                        if (page != Page.HOME) {
                            TextButton(onClick = { page = Page.HOME }) { Text("返回") }
                        }
                    }
                )
            }
        ) { insets ->
            Box(
                Modifier.fillMaxSize().padding(insets),
                contentAlignment = Alignment.TopCenter
            ) {
                val content = Modifier.widthIn(max = 600.dp).fillMaxSize()
                when (page) {
                    Page.HOME -> Dashboard(
                        modifier = content,
                        installed = installed,
                        rules = rules,
                        status = status,
                        enabledInSettings = enabledInSettings,
                        onAdd = { page = Page.ADD },
                        onPermissions = { page = Page.PERMISSIONS },
                        onSettings = { page = Page.SETTINGS },
                        onRemove = onRemove
                    )
                    Page.ADD -> AppPicker(content, installed, rules) {
                        onAdd(it)
                        page = Page.HOME
                    }
                    Page.PERMISSIONS -> Permissions(content, status, enabledInSettings, onOpenPermissions)
                    Page.SETTINGS -> Settings(content, appearance, onAppearance)
                }
            }
        }
    }
}

@Composable
private fun Dashboard(
    modifier: Modifier,
    installed: List<InstalledApp>?,
    rules: Set<String>,
    status: ServiceStatus,
    enabledInSettings: Boolean,
    onAdd: () -> Unit,
    onPermissions: () -> Unit,
    onSettings: () -> Unit,
    onRemove: (String) -> Unit
) {
    val byPackage = remember(installed) { installed.orEmpty().associateBy { it.packageName } }
    val ordered = remember(installed, rules) {
        val available = installed.orEmpty().filter { it.packageName in rules }.map { it.packageName }
        available + (rules - available.toSet()).sorted()
    }
    LazyColumn(
        modifier,
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            ServiceCard(status, enabledInSettings)
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onPermissions) { Text("权限管理") }
                TextButton(onClick = onSettings) { Text("设置") }
            }
        }
        item {
            Text(
                "已保护应用",
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleLarge
            )
        }
        if (rules.isEmpty()) {
            item {
                Text(
                    "添加需要确认 Wi-Fi 状态的应用。",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
        items(ordered, key = { it }) { packageName ->
            val app = byPackage[packageName]
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
                Row(
                    Modifier.fillMaxWidth().padding(start = 12.dp, top = 8.dp, end = 8.dp, bottom = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    AppIcon(app ?: InstalledApp(packageName, packageName, null))
                    Column(Modifier.weight(1f)) {
                        Text(
                            app?.label ?: packageName,
                            style = MaterialTheme.typography.titleMedium,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (app == null && installed != null) {
                            Text("应用当前不可用", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    TextButton(onClick = { onRemove(packageName) }) { Text("移除") }
                }
            }
        }
        item {
            Button(onClick = onAdd, modifier = Modifier.fillMaxWidth()) { Text("添加应用") }
        }
    }
}

@Composable
private fun ServiceCard(status: ServiceStatus, enabledInSettings: Boolean) {
    val title = when (status) {
        ServiceStatus.READY -> "守卫服务已运行"
        ServiceStatus.WINDOW_UNAVAILABLE -> "确认窗口暂不可用"
        ServiceStatus.DISCONNECTED -> "启动保护不可用"
    }
    val description = when (status) {
        ServiceStatus.READY -> "受保护的应用进入前台时会尝试显示启动确认。"
        ServiceStatus.WINDOW_UNAVAILABLE -> "系统未能显示上一次确认窗口。请重新进入受保护应用，并检查无障碍服务。"
        ServiceStatus.DISCONNECTED -> if (enabledInSettings) {
            "无障碍开关已开启，服务尚未连接。请在权限管理中检查系统设置。"
        } else {
            "首次使用，请在权限管理中开启 LaunchGuard 无障碍服务。"
        }
    }
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (status == ServiceStatus.READY) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(description, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun AppPicker(
    modifier: Modifier,
    installed: List<InstalledApp>?,
    rules: Set<String>,
    onAdd: (Set<String>) -> Unit
) {
    var query by rememberSaveable { mutableStateOf("") }
    var checked by rememberSaveable(stateSaver = listSaver(save = { it }, restore = { it })) {
        mutableStateOf(emptyList<String>())
    }
    val candidates = remember(installed, rules) { installed.orEmpty().filter { it.packageName !in rules } }
    val selectablePackages = remember(candidates) { candidates.mapTo(mutableSetOf()) { it.packageName } }
    val selected = remember(checked, selectablePackages) { checked.toSet().intersect(selectablePackages) }
    val matches = remember(candidates, query) {
        val term = query.trim()
        candidates.filter {
            it.label.contains(term, ignoreCase = true) || it.packageName.contains(term, ignoreCase = true)
        }
    }

    Column(modifier.imePadding().padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("搜索应用名称或包名") },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            singleLine = true
        )
        LazyColumn(Modifier.fillMaxWidth().weight(1f)) {
            if (matches.isEmpty()) {
                item {
                    Text(
                        when {
                            installed == null -> "正在读取应用列表…"
                            candidates.isEmpty() -> "没有可添加的应用"
                            else -> "没有找到匹配的应用"
                        },
                        Modifier.padding(vertical = 16.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            items(matches, key = { it.packageName }) { app ->
                val isChecked = app.packageName in selected
                Row(
                    Modifier.fillMaxWidth().toggleable(
                        value = isChecked,
                        role = Role.Checkbox,
                        onValueChange = { choose ->
                            checked = if (choose) checked + app.packageName else checked - app.packageName
                        }
                    ).padding(vertical = 10.dp, horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    AppIcon(app)
                    Column(Modifier.weight(1f)) {
                        Text(app.label, style = MaterialTheme.typography.titleMedium)
                        Text(
                            app.packageName,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Checkbox(checked = isChecked, onCheckedChange = null)
                }
            }
        }
        Button(
            onClick = { onAdd(selected) },
            enabled = selected.isNotEmpty(),
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)
        ) {
            Text(if (selected.isEmpty()) "添加所选应用" else "添加所选应用（${selected.size}）")
        }
    }
}

@Composable
private fun Permissions(
    modifier: Modifier,
    status: ServiceStatus,
    enabledInSettings: Boolean,
    onOpenPermissions: () -> Unit
) {
    LazyColumn(
        modifier,
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { ServiceCard(status, enabledInSettings) }
        item {
            Text(
                "无障碍服务",
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleLarge
            )
        }
        item {
            Text("打开系统无障碍设置，在已安装的应用或已下载的服务中选择「LaunchGuard 启动守卫」，然后开启服务。")
        }
        item {
            Text("服务用前台窗口的包名识别应用。配置仅保存在本机，不保存使用记录，不读取窗口内的文字。")
        }
        item {
            Button(onClick = onOpenPermissions, modifier = Modifier.fillMaxWidth()) {
                Text("打开无障碍设置")
            }
        }
        item {
            Text(
                "如果 Android 13 或更高版本提示「受限设置」，可在可信来源安装后进入 LaunchGuard 的应用信息页面，查看右上角菜单中的「允许受限设置」。",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun Settings(modifier: Modifier, appearance: Appearance, onAppearance: (Appearance) -> Unit) {
    LazyColumn(
        modifier,
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("外观", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
        }
        items(Appearance.entries) { option ->
            Row(
                Modifier.fillMaxWidth().selectable(
                    selected = appearance == option,
                    role = Role.RadioButton,
                    onClick = { onAppearance(option) }
                ).padding(vertical = 12.dp, horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                RadioButton(selected = appearance == option, onClick = null)
                Text(option.label)
            }
        }
        item {
            Text(
                "确认层在应用进入前台后出现。桌面、系统 Wi-Fi 设置和 LaunchGuard 本身不可添加。",
                modifier = Modifier.padding(top = 12.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}
