package dev.nextclass.app.domain

import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit

/**
 * No clock or Android dependency: every decision uses the caller's current time.
 * Teaching weeks are calendar weeks from the configured Monday, not 168-hour
 * durations, so changing the phone's timezone cannot move a weekday assignment.
 */
object ScheduleEngine {
    fun evaluate(timetable: Timetable, now: ZonedDateTime): ScheduleSnapshot {
        val semester = timetable.semester
        if (semester.startDate == null || semesterValidationError(semester) != null) {
            return ScheduleSnapshot(
                primary = null,
                secondary = null,
                inClass = false,
                currentWeek = null,
                semesterConfigured = false,
            )
        }

        val firstMonday = requireNotNull(semester.startDate)
        val dayOffset = ChronoUnit.DAYS.between(firstMonday, now.toLocalDate())
        val calendarWeek = if (dayOffset >= 0L && dayOffset < semester.totalWeeks * 7L) {
            (dayOffset / 7L).toInt() + 1
        } else {
            null
        }

        val remaining = timetable.courses.asSequence()
            .filter { courseValidationError(it, semester) == null }
            .flatMap { course ->
                (course.startWeek..course.endWeek).asSequence()
                    .filter(course.weekPattern::includes)
                    .mapNotNull { week ->
                        val date = firstMonday.plusWeeks(week - 1L)
                            .plusDays(course.dayOfWeek.value - 1L)
                        val endDate = if (course.endTime < course.startTime) {
                            date.plusDays(1)
                        } else {
                            date
                        }
                        val start = date.atTime(course.startTime).atZone(now.zone)
                        val end = endDate.atTime(course.endTime).atZone(now.zone)
                        // A DST gap can shift an impossible local start forward.
                        // Never show a negative or already-finished interval.
                        if (!end.isAfter(start) || !end.isAfter(now)) {
                            null
                        } else {
                            Occurrence(course, start, end, week)
                        }
                    }
            }
            .sortedWith(
                compareBy<Occurrence> { it.start.toInstant() }
                    .thenBy { it.end.toInstant() }
                    .thenBy { it.course.id },
            )
            .take(2)
            .toList()

        val primary = remaining.firstOrNull()
        return ScheduleSnapshot(
            primary = primary,
            secondary = remaining.getOrNull(1),
            inClass = primary != null && !now.isBefore(primary.start),
            currentWeek = calendarWeek,
            semesterConfigured = true,
        )
    }
}
