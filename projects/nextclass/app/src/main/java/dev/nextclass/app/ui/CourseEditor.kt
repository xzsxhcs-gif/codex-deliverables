package dev.nextclass.app.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import dev.nextclass.app.domain.*
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
internal fun CourseEditorDialog(
    initialCourse: Course?,
    semester: Semester,
    busy: Boolean,
    externalError: String?,
    onDismiss: () -> Unit,
    onSave: suspend (Course) -> Boolean,
) {
    val courseKey = initialCourse?.id
    val courseId = rememberSaveable(courseKey) { initialCourse?.id ?: UUID.randomUUID().toString() }
    var name by rememberSaveable(courseKey) { mutableStateOf(initialCourse?.name.orEmpty()) }
    var room by rememberSaveable(courseKey) { mutableStateOf(initialCourse?.room.orEmpty()) }
    var day by rememberSaveable(courseKey) { mutableStateOf(initialCourse?.dayOfWeek?.value ?: 1) }
    val timeFormat = remember { DateTimeFormatter.ofPattern("HH:mm") }
    var startTime by rememberSaveable(courseKey) { mutableStateOf(initialCourse?.startTime?.format(timeFormat).orEmpty()) }
    var endTime by rememberSaveable(courseKey) { mutableStateOf(initialCourse?.endTime?.format(timeFormat).orEmpty()) }
    var startWeek by rememberSaveable(courseKey) { mutableStateOf((initialCourse?.startWeek ?: 1).toString()) }
    var endWeek by rememberSaveable(courseKey) { mutableStateOf((initialCourse?.endWeek ?: semester.totalWeeks).toString()) }
    var pattern by rememberSaveable(courseKey) { mutableStateOf((initialCourse?.weekPattern ?: WeekPattern.ALL).name) }
    var localError by rememberSaveable(courseKey) { mutableStateOf<String?>(null) }
    var saveFailed by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val disabled = busy || submitting

    fun save() {
        localError = null
        saveFailed = false
        val from = parseEditorTime(startTime)
        val until = parseEditorTime(endTime)
        if (from == null || until == null) {
            localError = "上下课时间请使用24小时制 HH:mm，例如 08:00。"
            return
        }
        val fromWeek = startWeek.toIntOrNull()
        val untilWeek = endWeek.toIntOrNull()
        if (fromWeek == null || untilWeek == null) {
            localError = "请填写有效教学周的起始周与结束周。"
            return
        }
        val course = Course(
            id = courseId,
            name = name.trim(),
            room = room.trim(),
            dayOfWeek = DayOfWeek.of(day),
            startTime = from,
            endTime = until,
            startWeek = fromWeek,
            endWeek = untilWeek,
            weekPattern = WeekPattern.valueOf(pattern),
        )
        courseValidationError(course, semester)?.let { localError = it; return }
        submitting = true
        scope.launch {
            try {
                if (onSave(course)) onDismiss() else saveFailed = true
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                localError = "无法保存课程，请重试。"
            } finally {
                submitting = false
            }
        }
    }

    EditorDialogFrame(
        title = if (initialCourse == null) "新增课程" else "编辑课程",
        busy = disabled,
        onDismiss = onDismiss,
        onSave = ::save,
    ) {
        OutlinedTextField(
            value = name, onValueChange = { name = it; localError = null }, label = { Text("课程名称") },
            enabled = !disabled, modifier = Modifier.fillMaxWidth(), maxLines = 3,
            supportingText = { Text("${name.length}/100") }, isError = name.length > 100,
        )
        OutlinedTextField(
            value = room, onValueChange = { room = it; localError = null }, label = { Text("教室或上课地点") },
            enabled = !disabled, modifier = Modifier.fillMaxWidth(), maxLines = 2,
            isError = room.length > 120,
        )
        Text("星期", style = MaterialTheme.typography.labelLarge)
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DayOfWeek.values().forEach { weekday ->
                FilterChip(
                    selected = day == weekday.value,
                    onClick = { day = weekday.value },
                    label = { Text(weekdayLabel(weekday)) },
                    enabled = !disabled,
                )
            }
        }
        OutlinedTextField(
            value = startTime, onValueChange = { startTime = it; localError = null }, label = { Text("上课时间 · HH:mm") },
            placeholder = { Text("HH:mm") }, singleLine = true, enabled = !disabled, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
        )
        OutlinedTextField(
            value = endTime, onValueChange = { endTime = it; localError = null }, label = { Text("下课时间 · HH:mm") },
            placeholder = { Text("HH:mm") }, singleLine = true, enabled = !disabled, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
        )
        val from = parseEditorTime(startTime)
        val until = parseEditorTime(endTime)
        if (from != null && until != null && until < from) {
            Text("下课时间早于上课时间，按次日结束处理。", style = MaterialTheme.typography.bodySmall)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedTextField(
                value = startWeek, onValueChange = { startWeek = it; localError = null }, label = { Text("起始周") },
                enabled = !disabled, singleLine = true, modifier = Modifier.weight(1f),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
            OutlinedTextField(
                value = endWeek, onValueChange = { endWeek = it; localError = null }, label = { Text("结束周") },
                enabled = !disabled, singleLine = true, modifier = Modifier.weight(1f),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
        }
        Text("有效范围：第1–${semester.totalWeeks}周", style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
            listOf(WeekPattern.ALL to "每周", WeekPattern.ODD to "单周", WeekPattern.EVEN to "双周").forEach { (choice, title) ->
                FilterChip(selected = pattern == choice.name, onClick = { pattern = choice.name }, label = { Text(title) }, enabled = !disabled)
            }
        }
        val message = localError ?: if (saveFailed) externalError ?: "保存未完成，请重试。" else null
        message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
internal fun SemesterEditorDialog(
    semester: Semester,
    courses: List<Course>,
    busy: Boolean,
    externalError: String?,
    onDismiss: () -> Unit,
    onSave: suspend (Semester) -> Boolean,
) {
    var date by rememberSaveable { mutableStateOf(semester.startDate?.toString().orEmpty()) }
    var weeks by rememberSaveable { mutableStateOf(semester.totalWeeks.toString()) }
    var localError by rememberSaveable { mutableStateOf<String?>(null) }
    var saveFailed by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val disabled = busy || submitting

    fun save() {
        localError = null
        saveFailed = false
        val parsedDate = runCatching { LocalDate.parse(date.trim()) }.getOrNull()
        val parsedWeeks = weeks.toIntOrNull()
        if (parsedDate == null) {
            localError = "请输入学期第1周周一的日期，格式为 YYYY-MM-DD。"
            return
        }
        if (parsedWeeks == null) {
            localError = "教学周数须为1至60周。"
            return
        }
        val value = Semester(startDate = parsedDate, totalWeeks = parsedWeeks)
        semesterValidationError(value)?.let { localError = it; return }
        courses.firstNotNullOfOrNull { courseValidationError(it, value) }?.let {
            localError = "现有课程与新学期设置不符：$it 请先调整对应课程。"
            return
        }
        submitting = true
        scope.launch {
            try {
                if (onSave(value)) onDismiss() else saveFailed = true
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                localError = "无法保存学期设置，请重试。"
            } finally {
                submitting = false
            }
        }
    }

    EditorDialogFrame(title = "学期设置", busy = disabled, onDismiss = onDismiss, onSave = ::save) {
        Text("填写第1教学周的周一。课程的单双周与有效周次均以此为基准。", style = MaterialTheme.typography.bodyMedium)
        OutlinedTextField(
            value = date, onValueChange = { date = it; localError = null }, label = { Text("第1周周一 · YYYY-MM-DD") },
            placeholder = { Text("YYYY-MM-DD") }, singleLine = true, enabled = !disabled, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
        )
        OutlinedTextField(
            value = weeks, onValueChange = { weeks = it; localError = null }, label = { Text("教学周数 · 1–60") },
            singleLine = true, enabled = !disabled, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        )
        Text("修改起始日期会移动所有课程的实际日期，不会修改课程名称、时间和教室。", style = MaterialTheme.typography.bodySmall)
        val message = localError ?: if (saveFailed) externalError ?: "保存未完成，请重试。" else null
        message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
private fun EditorDialogFrame(
    title: String,
    busy: Boolean,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    Dialog(
        onDismissRequest = { if (!busy) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Box(
            Modifier.fillMaxSize().safeDrawingPadding().imePadding().padding(horizontal = 18.dp, vertical = 20.dp),
            contentAlignment = Alignment.Center,
        ) {
            Surface(
                modifier = Modifier.widthIn(max = 580.dp).fillMaxWidth().heightIn(max = 740.dp),
                shape = RoundedCornerShape(20.dp), color = Color(0xFF111316),
            ) {
                Column(Modifier.padding(20.dp)) {
                    Text(title, style = MaterialTheme.typography.titleLarge)
                    Column(
                        modifier = Modifier.weight(1f, fill = false).fillMaxWidth().verticalScroll(rememberScrollState()).padding(vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        content = content,
                    )
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = onDismiss, enabled = !busy) { Text("取消") }
                        Spacer(Modifier.width(10.dp))
                        Button(onClick = onSave, enabled = !busy) { Text(if (busy) "保存中…" else "保存") }
                    }
                }
            }
        }
    }
}

private fun parseEditorTime(value: String): LocalTime? {
    val trimmed = value.trim()
    if (!Regex("[0-9]{2}:[0-9]{2}").matches(trimmed)) return null
    return runCatching { LocalTime.parse(trimmed) }.getOrNull()
}
