package dev.nextclass.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dev.nextclass.app.domain.Course
import dev.nextclass.app.domain.Semester
import dev.nextclass.app.domain.Timetable
import dev.nextclass.app.domain.WeekPattern
import java.time.DayOfWeek
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

private val SettingsBackground = Color(0xFF08090B)
private val SettingsPanel = Color(0xFF111316)
private val SettingsMuted = Color(0xFFA2A5AC)
private val SettingsLine = Color(0xFF292C31)
private val SettingsTimeFormat = DateTimeFormatter.ofPattern("HH:mm")

@Composable
fun SettingsScreen(
    timetable: Timetable,
    busy: Boolean,
    error: String?,
    onBack: () -> Unit,
    onSaveSemester: suspend (Semester) -> Boolean,
    onSaveCourse: suspend (Course) -> Boolean,
    onDeleteCourse: suspend (String) -> Boolean,
    onLoadPreset: () -> Unit,
    onImport: () -> Unit,
    onExport: () -> Unit,
    onDismissError: () -> Unit,
) {
    var semesterEditorOpen by rememberSaveable { mutableStateOf(false) }
    var courseEditorOpen by rememberSaveable { mutableStateOf(false) }
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    var deletingId by rememberSaveable { mutableStateOf<String?>(null) }
    var deleting by remember { mutableStateOf(false) }
    var deleteError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val sortedCourses = remember(timetable.courses) {
        timetable.courses.sortedWith(compareBy({ it.dayOfWeek.value }, { it.startTime }, { it.name }))
    }

    BackHandler(enabled = !semesterEditorOpen && !courseEditorOpen && deletingId == null) {
        if (!busy) onBack()
    }

    Column(
        Modifier.fillMaxSize().background(SettingsBackground).safeDrawingPadding(),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            TextButton(onClick = onBack, enabled = !busy && !deleting) { Text("返回") }
            Text("课表设置", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(12.dp))
        }

        if (busy || deleting) {
            LinearProgressIndicator(Modifier.fillMaxWidth().height(2.dp))
        }

        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (error != null && !semesterEditorOpen && !courseEditorOpen && deletingId == null) {
                item(key = "error") {
                    Surface(color = SettingsPanel, shape = MaterialTheme.shapes.medium) {
                        Column(Modifier.fillMaxWidth().padding(16.dp)) {
                            Text(error, color = MaterialTheme.colorScheme.error)
                            TextButton(onClick = onDismissError) { Text("关闭提示") }
                        }
                    }
                }
            }

            item(key = "semester") {
                Surface(
                    color = SettingsPanel,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, SettingsLine),
                ) {
                    Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("学期", style = MaterialTheme.typography.titleMedium)
                        Text(
                            timetable.semester.startDate?.let { "第1周周一：$it" } ?: "尚未设置学期起始日期",
                            color = SettingsMuted,
                        )
                        Text("共 ${timetable.semester.totalWeeks} 个教学周", color = SettingsMuted)
                        Text("按手机本地日期计算教学周。", style = MaterialTheme.typography.bodySmall, color = SettingsMuted)
                        TextButton(
                            onClick = { onDismissError(); semesterEditorOpen = true },
                            enabled = !busy,
                        ) { Text(if (timetable.semester.startDate == null) "设置学期" else "修改学期") }
                        TextButton(onClick = onLoadPreset, enabled = !busy) {
                            Text("载入本学期课表")
                        }
                        Text("内置2026年秋季第8–19周，载入前会确认。", style = MaterialTheme.typography.bodySmall, color = SettingsMuted)
                    }
                }
            }

            item(key = "courses_heading") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("排课 · ${timetable.courses.size}", style = MaterialTheme.typography.titleMedium)
                    Button(
                        onClick = { onDismissError(); editingId = null; courseEditorOpen = true },
                        enabled = !busy && timetable.semester.startDate != null && timetable.courses.size < 1000,
                    ) { Text("新增课程") }
                    if (timetable.semester.startDate == null) {
                        Text("先设置学期第1周的周一，再录入课程。", color = SettingsMuted)
                    }
                }
            }

            if (sortedCourses.isEmpty()) {
                item(key = "empty") {
                    Text(
                        "还没有课程。录入后，首页会自动显示当前与下一节，无需选择日期。",
                        modifier = Modifier.padding(vertical = 12.dp),
                        color = SettingsMuted,
                    )
                }
            }

            items(sortedCourses, key = { it.id }) { course ->
                CourseManagementCard(
                    course = course,
                    enabled = !busy && !deleting,
                    onEdit = { onDismissError(); editingId = course.id; courseEditorOpen = true },
                    onDelete = { onDismissError(); deleteError = null; deletingId = course.id },
                )
            }

            item(key = "files") {
                HorizontalDivider(color = SettingsLine)
                Column(Modifier.fillMaxWidth().padding(top = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("本地备份", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "JSON 可用于备份与后续录入。导入会替换当前课表；取消文件选择不会改变数据。",
                        style = MaterialTheme.typography.bodySmall,
                        color = SettingsMuted,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = onImport, enabled = !busy) { Text("导入 JSON") }
                        OutlinedButton(onClick = onExport, enabled = !busy) { Text("导出 JSON") }
                    }
                    Text("数据只保存在本机，无需登录或联网。", style = MaterialTheme.typography.bodySmall, color = SettingsMuted)
                }
            }
        }
    }

    if (semesterEditorOpen) {
        SemesterEditorDialog(
            semester = timetable.semester,
            courses = timetable.courses,
            busy = busy,
            externalError = error,
            onDismiss = { semesterEditorOpen = false; onDismissError() },
            onSave = onSaveSemester,
        )
    }

    if (courseEditorOpen) {
        CourseEditorDialog(
            initialCourse = editingId?.let { id -> timetable.courses.find { it.id == id } },
            semester = timetable.semester,
            busy = busy,
            externalError = error,
            onDismiss = { courseEditorOpen = false; editingId = null; onDismissError() },
            onSave = onSaveCourse,
        )
    }

    deletingId?.let { id ->
        val course = timetable.courses.find { it.id == id }
        AlertDialog(
            onDismissRequest = { if (!busy && !deleting) deletingId = null },
            title = { Text("删除课程？") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("将删除“${course?.name ?: "此课程"}”的所有排课周次。")
                    (deleteError ?: error)?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !busy && !deleting,
                    onClick = {
                        deleting = true
                        deleteError = null
                        scope.launch {
                            try {
                                if (onDeleteCourse(id)) deletingId = null
                                else deleteError = "删除未完成，请重试。"
                            } catch (cancelled: CancellationException) {
                                throw cancelled
                            } catch (_: Exception) {
                                deleteError = "无法删除课程，请重试。"
                            } finally {
                                deleting = false
                            }
                        }
                    },
                ) { Text(if (deleting) "删除中…" else "确认删除") }
            },
            dismissButton = {
                TextButton(onClick = { deletingId = null }, enabled = !busy && !deleting) { Text("取消") }
            },
        )
    }
}

@Composable
private fun CourseManagementCard(course: Course, enabled: Boolean, onEdit: () -> Unit, onDelete: () -> Unit) {
    Surface(color = SettingsPanel, shape = MaterialTheme.shapes.medium, border = BorderStroke(1.dp, SettingsLine)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(course.name, style = MaterialTheme.typography.titleMedium)
            val time = "${course.startTime.format(SettingsTimeFormat)}–${course.endTime.format(SettingsTimeFormat)}"
            val overnight = if (course.endTime < course.startTime) "（次日结束）" else ""
            Text("${weekdayLabel(course.dayOfWeek)}  $time$overnight", color = SettingsMuted)
            Text(course.room)
            val pattern = when (course.weekPattern) {
                WeekPattern.ALL -> "每周"
                WeekPattern.ODD -> "单周"
                WeekPattern.EVEN -> "双周"
            }
            Text("第${course.startWeek}–${course.endWeek}周 · $pattern", color = SettingsMuted, style = MaterialTheme.typography.bodySmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onEdit, enabled = enabled, modifier = Modifier.semantics { contentDescription = "编辑${course.name}" }) { Text("编辑") }
                TextButton(onClick = onDelete, enabled = enabled, modifier = Modifier.semantics { contentDescription = "删除${course.name}" }) { Text("删除") }
            }
        }
    }
}

internal fun weekdayLabel(day: DayOfWeek): String = when (day) {
    DayOfWeek.MONDAY -> "周一"
    DayOfWeek.TUESDAY -> "周二"
    DayOfWeek.WEDNESDAY -> "周三"
    DayOfWeek.THURSDAY -> "周四"
    DayOfWeek.FRIDAY -> "周五"
    DayOfWeek.SATURDAY -> "周六"
    DayOfWeek.SUNDAY -> "周日"
}
