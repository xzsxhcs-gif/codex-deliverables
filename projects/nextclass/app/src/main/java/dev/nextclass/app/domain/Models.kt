package dev.nextclass.app.domain

import java.time.DateTimeException
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime

enum class WeekPattern {
    ALL,
    ODD,
    EVEN;

    fun includes(week: Int): Boolean = when (this) {
        ALL -> true
        ODD -> week % 2 == 1
        EVEN -> week % 2 == 0
    }
}

data class Semester(
    val startDate: LocalDate? = null,
    val totalWeeks: Int = 20,
)

data class Course(
    val id: String,
    val name: String,
    val room: String,
    val dayOfWeek: DayOfWeek,
    val startTime: LocalTime,
    val endTime: LocalTime,
    val startWeek: Int,
    val endWeek: Int,
    val weekPattern: WeekPattern = WeekPattern.ALL,
)

data class Timetable(
    val semester: Semester = Semester(),
    val courses: List<Course> = emptyList(),
)

data class Occurrence(
    val course: Course,
    val start: ZonedDateTime,
    val end: ZonedDateTime,
    val teachingWeek: Int,
)

data class ScheduleSnapshot(
    val primary: Occurrence?,
    val secondary: Occurrence?,
    val inClass: Boolean,
    val currentWeek: Int?,
    val semesterConfigured: Boolean,
)

/** A semester starts on the Monday of teaching week 1, in the phone's calendar. */
fun semesterValidationError(semester: Semester): String? {
    if (semester.totalWeeks !in 1..60) return "教学周数须为1至60周。"
    // An unconfigured semester is a valid persisted empty-app state.
    val start = semester.startDate ?: return null
    if (start.dayOfWeek != DayOfWeek.MONDAY) return "学期开始日期须为第1周的周一。"
    return try {
        start.plusWeeks(semester.totalWeeks.toLong())
        null
    } catch (_: DateTimeException) {
        "学期日期超出支持范围。"
    } catch (_: ArithmeticException) {
        "学期日期超出支持范围。"
    }
}

fun courseValidationError(course: Course, semester: Semester): String? {
    semesterValidationError(semester)?.let { return it }
    if (semester.startDate == null) return "请先设置学期第1周的周一日期。"
    if (course.id.isBlank() || course.id.length > 128) return "课程标识无效。"
    if (course.name.isBlank()) return "请填写课程名称。"
    if (course.name.length > 100) return "课程名称不能超过100个字符。"
    if (course.room.isBlank()) return "请填写教室或上课地点。"
    if (course.room.length > 120) return "教室信息不能超过120个字符。"
    if (course.startTime == course.endTime) return "上下课时间不能相同。"
    if (course.startWeek < 1 || course.endWeek > semester.totalWeeks ||
        course.startWeek > course.endWeek
    ) {
        return "有效教学周须在1至${semester.totalWeeks}周内，且起始周不晚于结束周。"
    }
    if ((course.startWeek..course.endWeek).none(course.weekPattern::includes)) {
        return "所选周次范围内没有符合单双周设置的教学周。"
    }
    return null
}
