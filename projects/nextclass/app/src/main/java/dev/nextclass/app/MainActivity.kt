package dev.nextclass.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModelProvider
import dev.nextclass.app.domain.ScheduleEngine
import dev.nextclass.app.domain.Timetable
import dev.nextclass.app.ui.HomeScreen
import dev.nextclass.app.ui.SettingsScreen
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZonedDateTime

class MainActivity : ComponentActivity() {
    private var foreground by mutableStateOf(false)
    private var clockSignal by mutableStateOf(0L)
    private var receiverRegistered = false
    private val clockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            clockSignal = System.currentTimeMillis()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(0xFF08090B.toInt()),
            navigationBarStyle = SystemBarStyle.dark(0xFF08090B.toInt()),
        )
        val model = ViewModelProvider(this)[NextClassViewModel::class.java]
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(
                primary = Color.White,
                onPrimary = Color.Black,
                secondary = Color(0xFFCBCDD2),
                background = Color(0xFF08090B),
                onBackground = Color(0xFFF4F4F5),
                surface = Color(0xFF101216),
                onSurface = Color(0xFFF4F4F5),
                surfaceVariant = Color(0xFF1D2025),
                onSurfaceVariant = Color(0xFFB2B5BD),
                outline = Color(0xFF565B64),
            )) {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    NextClassApp(model, foreground, clockSignal)
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        foreground = true
        clockSignal = System.currentTimeMillis()
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_TIME_CHANGED)
            addAction(Intent.ACTION_TIMEZONE_CHANGED)
            addAction(Intent.ACTION_DATE_CHANGED)
            addAction(Intent.ACTION_TIME_TICK)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(clockReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(clockReceiver, filter)
        }
        receiverRegistered = true
    }

    override fun onResume() {
        super.onResume()
        clockSignal = System.currentTimeMillis()
    }

    override fun onStop() {
        foreground = false
        if (receiverRegistered) {
            unregisterReceiver(clockReceiver)
            receiverRegistered = false
        }
        super.onStop()
    }
}

@Composable
private fun NextClassApp(model: NextClassViewModel, foreground: Boolean, clockSignal: Long) {
    val state by model.state.collectAsState()
    var showSettings by rememberSaveable { mutableStateOf(false) }
    var now by remember { mutableStateOf(ZonedDateTime.now()) }
    var pendingImport by remember { mutableStateOf<Timetable?>(null) }
    var importingPreset by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(foreground, clockSignal) {
        now = ZonedDateTime.now()
        if (foreground) {
            while (isActive) {
                // Align to the real phone clock; no accumulated timer drift.
                delay((1000L - System.currentTimeMillis().mod(1000L)).coerceAtLeast(1L))
                now = ZonedDateTime.now()
            }
        }
    }
    // Input times have minute precision. Seconds still redraw the clock, while
    // course selection only recomputes at a boundary, data change or timezone change.
    val snapshot = remember(state.timetable, now.toLocalDate(), now.hour, now.minute, now.zone, now.offset) {
        ScheduleEngine.evaluate(state.timetable, now)
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) scope.launch {
            importingPreset = false
            pendingImport = model.readImport(uri)
        }
    }
    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) scope.launch {
            if (model.exportTo(uri)) notice = "课表备份已保存。"
        }
    }

    BackHandler(enabled = showSettings) { showSettings = false }
    if (showSettings) {
        SettingsScreen(
            timetable = state.timetable,
            busy = state.loading || state.busy,
            error = state.error,
            onBack = { showSettings = false },
            onSaveSemester = model::saveSemester,
            onSaveCourse = model::saveCourse,
            onDeleteCourse = model::deleteCourse,
            onLoadPreset = {
                scope.launch {
                    importingPreset = true
                    pendingImport = model.readSemesterPreset()
                }
            },
            onImport = { importLauncher.launch(arrayOf("application/json", "text/plain", "application/octet-stream")) },
            onExport = { exportLauncher.launch("NextClass-backup-${LocalDate.now()}.json") },
            onDismissError = model::dismissError,
        )
    } else {
        HomeScreen(
            timetable = state.timetable,
            now = now,
            snapshot = snapshot,
            isLoading = state.loading,
            error = if (!state.storageReady && !state.loading) {
                state.error ?: "本地课表尚未恢复，请重新读取或导入备份。"
            } else null,
            onManage = { showSettings = true },
            onRetry = model::reload,
        )
    }
    pendingImport?.let { incoming ->
        AlertDialog(
            onDismissRequest = { if (!state.busy) pendingImport = null },
            title = { Text(if (importingPreset) "载入本学期课表？" else "替换本地课表？") },
            text = {
                val source = if (importingPreset) "内置课表" else "文件"
                Text("${source}包含${incoming.courses.size}条排课。确认后将替换当前${state.timetable.courses.size}条排课；建议先导出备份。")
            },
            confirmButton = {
                TextButton(enabled = !state.busy, onClick = {
                    scope.launch {
                        if (model.importTimetable(incoming)) {
                            pendingImport = null
                            notice = if (importingPreset) "本学期课表已载入。" else "课表已导入。"
                        }
                    }
                }) { Text("确认替换") }
            },
            dismissButton = {
                TextButton(enabled = !state.busy, onClick = { pendingImport = null }) { Text("取消") }
            },
        )
    }
    notice?.let { message ->
        AlertDialog(
            onDismissRequest = { notice = null },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = { notice = null }) { Text("知道了") } },
        )
    }
}
