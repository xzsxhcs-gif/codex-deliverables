package dev.nextclass.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.nextclass.app.domain.Occurrence
import dev.nextclass.app.domain.ScheduleSnapshot
import dev.nextclass.app.domain.Timetable
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

private val HomeBackground = Color(0xFF08090B)
private val HomeWhite = Color(0xFFF4F4F5)
private val HomeMuted = Color(0xFF96999F)
private val HomeFaint = Color(0xFF63676E)
private val HomeDivider = Color(0xFF292C31)
private val ClockFormat = DateTimeFormatter.ofPattern("HH:mm:ss", Locale.ROOT)
private val TimeFormat = DateTimeFormatter.ofPattern("HH:mm", Locale.ROOT)
private val DateFormat = DateTimeFormatter.ofPattern("yyyy年M月d日", Locale.CHINA)

@Composable
fun HomeScreen(
    timetable: Timetable,
    now: ZonedDateTime,
    snapshot: ScheduleSnapshot,
    isLoading: Boolean,
    error: String?,
    onManage: () -> Unit,
    onRetry: () -> Unit,
) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(HomeBackground)
            .windowInsetsPadding(WindowInsets.safeDrawing),
    ) {
        val compact = maxHeight < 610.dp || LocalDensity.current.fontScale > 1.25f
        val veryShort = maxHeight < 440.dp
        val horizontal = if (maxWidth < 350.dp) 22.dp else 28.dp
        val vertical = if (compact) 12.dp else 24.dp

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = horizontal, vertical = vertical),
        ) {
            ClockHeader(now = now, compact = compact)
            Spacer(Modifier.height(if (compact) 16.dp else 30.dp))

            when {
                isLoading -> {
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.CenterStart) {
                        Text("正在读取课表", color = HomeMuted, fontSize = 16.sp)
                    }
                }
                error != null -> {
                    Column(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.Center) {
                        Text("暂时无法读取课表", color = HomeWhite, fontSize = 25.sp)
                        Spacer(Modifier.height(12.dp))
                        Text(error, color = HomeMuted, fontSize = 15.sp)
                        Spacer(Modifier.height(12.dp))
                        TextButton(onClick = onRetry) {
                            Text("重新读取", color = HomeWhite)
                        }
                    }
                }
                snapshot.primary == null -> {
                    EmptyHome(
                        configured = snapshot.semesterConfigured,
                        hasCourses = timetable.courses.isNotEmpty(),
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        compact = compact,
                    )
                }
                else -> {
                    CourseSection(
                        occurrence = snapshot.primary,
                        label = when {
                            snapshot.inClass -> "正在上课"
                            snapshot.primary.start.toLocalDate() == now.toLocalDate() -> "即将开始"
                            else -> "下一次上课"
                        },
                        today = now.toLocalDate(),
                        primary = true,
                        compact = compact,
                        veryShort = veryShort,
                        modifier = Modifier.weight(if (veryShort) 1f else 1.12f).fillMaxWidth(),
                    )
                    Spacer(Modifier.height(if (compact) 12.dp else 23.dp))
                    HorizontalDivider(color = HomeDivider, thickness = 0.5.dp)
                    Spacer(Modifier.height(if (compact) 14.dp else 24.dp))
                    if (snapshot.secondary != null) {
                        CourseSection(
                            occurrence = snapshot.secondary,
                            label = "下一节课",
                            today = now.toLocalDate(),
                            primary = false,
                            compact = compact,
                            veryShort = veryShort,
                            modifier = Modifier.weight(1f).fillMaxWidth(),
                        )
                    } else {
                        Column(
                            modifier = Modifier.weight(1f).fillMaxWidth(),
                            verticalArrangement = Arrangement.Center,
                        ) {
                            Text("下一节课", color = HomeMuted, fontSize = 13.sp)
                            Spacer(Modifier.height(12.dp))
                            Text("没有后续课程", color = HomeWhite, fontSize = if (compact) 22.sp else 25.sp)
                            Spacer(Modifier.height(8.dp))
                            Text("当前学期内没有更多安排", color = HomeFaint, fontSize = 13.sp)
                        }
                    }
                }
            }

            Spacer(Modifier.height(if (compact) 8.dp else 15.dp))
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = snapshot.currentWeek?.let { "第 $it 教学周" } ?: "NextClass",
                    color = HomeFaint,
                    fontSize = 12.sp,
                )
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onManage, enabled = !isLoading) {
                    Text("课表设置", color = HomeMuted, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
private fun ClockHeader(now: ZonedDateTime, compact: Boolean) {
    Text(
        text = "${now.format(DateFormat)}  ${weekday(now.dayOfWeek)}",
        color = HomeMuted,
        fontSize = if (compact) 13.sp else 14.sp,
    )
    Spacer(Modifier.height(if (compact) 5.dp else 8.dp))
    Text(
        text = now.format(ClockFormat),
        color = HomeWhite,
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Light,
        fontSize = if (compact) 34.sp else 44.sp,
        lineHeight = if (compact) 38.sp else 48.sp,
        letterSpacing = (-1).sp,
    )
}

@Composable
private fun CourseSection(
    occurrence: Occurrence,
    label: String,
    today: LocalDate,
    primary: Boolean,
    compact: Boolean,
    veryShort: Boolean,
    modifier: Modifier,
) {
    val roomHeight = when {
        veryShort -> 25.dp
        occurrence.course.room.length > 14 -> if (compact) 43.dp else 51.dp
        else -> if (compact) 27.dp else 31.dp
    }
    Column(modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(label, color = HomeMuted, fontSize = if (compact) 12.sp else 13.sp)
            Spacer(Modifier.width(10.dp))
            Text(
                dateLabel(occurrence.start.toLocalDate(), today),
                modifier = Modifier.weight(1f),
                color = HomeMuted,
                fontSize = if (compact) 12.sp else 13.sp,
                maxLines = 2,
            )
        }
        Spacer(Modifier.height(if (compact) 6.dp else 10.dp))
        FittedText(
            text = occurrence.course.name,
            preferredSize = when {
                veryShort -> if (primary) 24.sp else 21.sp
                compact -> if (primary) 29.sp else 24.sp
                else -> if (primary) 35.sp else 28.sp
            },
            minimumSize = if (veryShort) 12.sp else 15.sp,
            color = HomeWhite,
            weight = if (primary) FontWeight.Medium else FontWeight.Normal,
            modifier = Modifier.weight(1f).fillMaxWidth(),
        )
        Spacer(Modifier.height(if (compact) 5.dp else 9.dp))
        Text(
            text = timeRange(occurrence),
            color = HomeWhite,
            fontFamily = FontFamily.Monospace,
            fontSize = when {
                veryShort -> 17.sp
                compact -> if (primary) 21.sp else 19.sp
                else -> if (primary) 25.sp else 22.sp
            },
            fontWeight = FontWeight.Normal,
            maxLines = 2,
        )
        Spacer(Modifier.height(if (compact) 3.dp else 5.dp))
        FittedText(
            text = occurrence.course.room,
            preferredSize = if (compact) 18.sp else if (primary) 21.sp else 19.sp,
            minimumSize = 12.sp,
            color = HomeMuted,
            weight = FontWeight.Normal,
            modifier = Modifier.fillMaxWidth().height(roomHeight),
        )
    }
}

@Composable
private fun EmptyHome(configured: Boolean, hasCourses: Boolean, compact: Boolean, modifier: Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.Center) {
        Text(
            text = when {
                !configured -> "还没有课表"
                !hasCourses -> "还没有课程"
                else -> "没有未来课程"
            },
            color = HomeWhite,
            fontSize = if (compact) 29.sp else 34.sp,
            fontWeight = FontWeight.Light,
        )
        Spacer(Modifier.height(14.dp))
        Text(
            text = when {
                !configured -> "在课表设置中填写学期，再添加课程。"
                !hasCourses -> "添加课程后，这里会自动显示当前和下一节课。"
                else -> "当前学期的课程已经结束，或没有后续安排。"
            },
            color = HomeMuted,
            fontSize = 15.sp,
            lineHeight = 24.sp,
        )
    }
}

/** Fits full course names into each block instead of hiding them behind an ellipsis. */
@Composable
private fun FittedText(
    text: String,
    preferredSize: TextUnit,
    minimumSize: TextUnit,
    color: Color,
    weight: FontWeight,
    modifier: Modifier,
) {
    BoxWithConstraints(modifier = modifier, contentAlignment = Alignment.CenterStart) {
        val density = LocalDensity.current
        val measurer = rememberTextMeasurer()
        val width = with(density) { maxWidth.roundToPx() }.coerceAtLeast(1)
        val height = with(density) { maxHeight.roundToPx() }.coerceAtLeast(1)
        val fittedSize = remember(text, width, height, density.fontScale, preferredSize, minimumSize, weight) {
            var size = preferredSize.value
            while (size > minimumSize.value) {
                val measured = measurer.measure(
                    text = text,
                    style = TextStyle(fontSize = size.sp, lineHeight = (size * 1.24f).sp, fontWeight = weight),
                    constraints = Constraints(maxWidth = width, maxHeight = height),
                )
                if (!measured.hasVisualOverflow) break
                size = (size - 1f).coerceAtLeast(minimumSize.value)
            }
            size.sp
        }
        Text(
            text = text,
            color = color,
            fontSize = fittedSize,
            lineHeight = (fittedSize.value * 1.24f).sp,
            fontWeight = weight,
            overflow = TextOverflow.Visible,
        )
    }
}

private fun dateLabel(date: LocalDate, today: LocalDate): String {
    val relation = when (date) {
        today -> "今天"
        today.plusDays(1) -> "明天"
        today.minusDays(1) -> "昨天"
        else -> ""
    }
    val dateText = if (date.year == today.year) "${date.monthValue}月${date.dayOfMonth}日" else "${date.year}年${date.monthValue}月${date.dayOfMonth}日"
    return listOf(relation, dateText, weekday(date.dayOfWeek)).filter { it.isNotEmpty() }.joinToString(" ")
}

private fun timeRange(occurrence: Occurrence): String {
    val endDay = if (occurrence.end.toLocalDate() != occurrence.start.toLocalDate()) "次日 " else ""
    return "${occurrence.start.format(TimeFormat)}–$endDay${occurrence.end.format(TimeFormat)}"
}

private fun weekday(day: DayOfWeek): String = when (day) {
    DayOfWeek.MONDAY -> "星期一"
    DayOfWeek.TUESDAY -> "星期二"
    DayOfWeek.WEDNESDAY -> "星期三"
    DayOfWeek.THURSDAY -> "星期四"
    DayOfWeek.FRIDAY -> "星期五"
    DayOfWeek.SATURDAY -> "星期六"
    DayOfWeek.SUNDAY -> "星期日"
}
