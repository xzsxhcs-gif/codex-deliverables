package dev.nextclass.app.data

import dev.nextclass.app.domain.Course
import dev.nextclass.app.domain.Semester
import dev.nextclass.app.domain.Timetable
import dev.nextclass.app.domain.WeekPattern
import dev.nextclass.app.domain.courseValidationError
import dev.nextclass.app.domain.semesterValidationError
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import org.json.JSONTokener
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * The app's local file and import/export use the same versioned document.
 * Empty document: {"version":1,"semester":{"startDate":null,"totalWeeks":20},"courses":[]}
 * dayOfWeek is ISO 1..7; times are HH:mm; weekPattern is ALL, ODD or EVEN.
 */
object TimetableJson {
    const val MAX_JSON_BYTES: Int = 2 * 1024 * 1024
    const val MAX_COURSES: Int = 1000

    private val minuteFormat = DateTimeFormatter.ofPattern("HH:mm", Locale.ROOT)
    private val datePattern = Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}")
    private val timePattern = Regex("[0-9]{2}:[0-9]{2}")
    private val rootKeys = setOf("version", "semester", "courses")
    private val semesterKeys = setOf("startDate", "totalWeeks")
    private val courseKeys = setOf(
        "id", "name", "room", "dayOfWeek", "startTime", "endTime",
        "startWeek", "endWeek", "weekPattern"
    )

    fun encode(value: Timetable): String {
        validate(value)
        val semester = JSONObject()
            .put("startDate", value.semester.startDate?.toString() ?: JSONObject.NULL)
            .put("totalWeeks", value.semester.totalWeeks)
        val courses = JSONArray()
        value.courses.forEach { course ->
            courses.put(
                JSONObject()
                    .put("id", course.id)
                    .put("name", course.name)
                    .put("room", course.room)
                    .put("dayOfWeek", course.dayOfWeek.value)
                    .put("startTime", course.startTime.format(minuteFormat))
                    .put("endTime", course.endTime.format(minuteFormat))
                    .put("startWeek", course.startWeek)
                    .put("endWeek", course.endWeek)
                    .put("weekPattern", course.weekPattern.name)
            )
        }
        val text = JSONObject()
            .put("version", 1)
            .put("semester", semester)
            .put("courses", courses)
            .toString(2)
        require(text.toByteArray(Charsets.UTF_8).size <= MAX_JSON_BYTES) {
            "课表数据超过2MB，请减少课程数量或字段长度。"
        }
        return text
    }

    fun decode(text: String): Timetable {
        require(text.length <= MAX_JSON_BYTES && text.toByteArray(Charsets.UTF_8).size <= MAX_JSON_BYTES) {
            "导入文件超过2MB。"
        }
        require(text.isNotBlank()) { "导入文件为空。" }
        checkNesting(text)
        try {
            val tokener = JSONTokener(text)
            val root = tokener.nextValue() as? JSONObject
                ?: invalid("文件根节点必须是JSON对象。")
            require(tokener.nextClean() == '\u0000') { "JSON结尾包含多余内容。" }
            requireKeys(root, rootKeys, "课表")
            require(integer(root, "version", "课表") == 1) {
                "不支持此课表版本，请使用version为1的JSON文件。"
            }

            val semesterJson = root.get("semester") as? JSONObject
                ?: invalid("semester必须是对象。")
            requireKeys(semesterJson, semesterKeys, "学期")
            val startDate = if (semesterJson.isNull("startDate")) {
                null
            } else {
                val source = string(semesterJson, "startDate", "学期")
                require(datePattern.matches(source)) { "学期起始日期应为YYYY-MM-DD格式。" }
                try {
                    LocalDate.parse(source)
                } catch (_: Exception) {
                    invalid("学期起始日期不是有效日期。")
                }
            }
            val semester = Semester(
                startDate = startDate,
                totalWeeks = integer(semesterJson, "totalWeeks", "学期")
            )

            val list = root.get("courses") as? JSONArray
                ?: invalid("courses必须是数组。")
            require(list.length() <= MAX_COURSES) { "最多支持1000门课程。" }
            val courses = (0 until list.length()).map { index ->
                val label = "第${index + 1}门课程"
                val item = list.get(index) as? JSONObject
                    ?: invalid("${label}必须是对象。")
                requireKeys(item, courseKeys, label)
                val day = integer(item, "dayOfWeek", label)
                require(day in 1..7) { "${label}的星期必须是1至7。" }
                val pattern = string(item, "weekPattern", label)
                val weekPattern = WeekPattern.entries.firstOrNull { it.name == pattern }
                    ?: invalid("${label}的单双周必须是ALL、ODD或EVEN。")
                Course(
                    id = string(item, "id", label),
                    name = string(item, "name", label),
                    room = string(item, "room", label),
                    dayOfWeek = DayOfWeek.of(day),
                    startTime = readTime(item, "startTime", label),
                    endTime = readTime(item, "endTime", label),
                    startWeek = integer(item, "startWeek", label),
                    endWeek = integer(item, "endWeek", label),
                    weekPattern = weekPattern
                )
            }
            return Timetable(semester = semester, courses = courses).also(::validate)
        } catch (error: JSONException) {
            throw IllegalArgumentException("JSON格式无效，请检查字段和标点。", error)
        }
    }

    private fun validate(value: Timetable) {
        require(value.semester.totalWeeks in 1..60) { "学期长度应为1至60周。" }
        value.semester.startDate?.let { date ->
            require(date.year in 1..9999) { "学期年份应为1至9999。" }
            require(date.dayOfWeek == DayOfWeek.MONDAY) { "学期起始日期应为第1周的周一。" }
        }
        semesterValidationError(value.semester)?.let(::invalid)
        require(value.courses.size <= MAX_COURSES) { "最多支持1000门课程。" }
        require(value.courses.isEmpty() || value.semester.startDate != null) {
            "有课程时必须先设置学期起始日期。"
        }
        val ids = HashSet<String>()
        value.courses.forEachIndexed { index, course ->
            val label = "第${index + 1}门课程"
            requireField(course.id, 128, "${label}的编号")
            requireField(course.name, 100, "${label}的名称")
            requireField(course.room, 120, "${label}的教室")
            require(ids.add(course.id)) { "课程编号重复，无法导入。" }
            require(course.startTime.second == 0 && course.startTime.nano == 0 &&
                course.endTime.second == 0 && course.endTime.nano == 0) {
                "${label}的时间应精确到分钟。"
            }
            courseValidationError(course, value.semester)?.let { invalid("${label}：$it") }
        }
    }

    private fun readTime(item: JSONObject, key: String, label: String): LocalTime {
        val value = string(item, key, label)
        require(timePattern.matches(value)) { "${label}的${key}应为HH:mm格式。" }
        return try {
            LocalTime.parse(value)
        } catch (_: Exception) {
            invalid("${label}的${key}不是有效时间。")
        }
    }

    private fun string(item: JSONObject, key: String, label: String): String =
        item.get(key) as? String ?: invalid("${label}的${key}必须是文字。")

    private fun integer(item: JSONObject, key: String, label: String): Int {
        val value = item.get(key)
        val number = when (value) {
            is Int -> value.toLong()
            is Long -> value
            else -> invalid("${label}的${key}必须是整数。")
        }
        require(number in Int.MIN_VALUE.toLong()..Int.MAX_VALUE.toLong()) {
            "${label}的${key}超出支持范围。"
        }
        return number.toInt()
    }

    private fun requireField(value: String, maximum: Int, label: String) {
        require(value.isNotBlank()) { "${label}不能为空。" }
        require(value.length <= maximum) { "${label}最多${maximum}个字符。" }
        require(value.none { Character.isISOControl(it) }) { "${label}不能包含换行或控制字符。" }
    }

    private fun requireKeys(item: JSONObject, expected: Set<String>, label: String) {
        val keys = item.keys().asSequence().toSet()
        require(keys == expected) {
            val missing = expected - keys
            val extra = keys - expected
            buildString {
                append("${label}字段不完整或不受支持。")
                if (missing.isNotEmpty()) append("缺少：${missing.joinToString("、")}。")
                if (extra.isNotEmpty()) append("未知：${extra.joinToString("、")}。")
            }
        }
    }

    private fun checkNesting(text: String) {
        var depth = 0
        var inString = false
        var escaped = false
        text.forEach { char ->
            if (inString) {
                if (escaped) escaped = false
                else if (char == '\\') escaped = true
                else if (char == '"') inString = false
            } else when (char) {
                '"' -> inString = true
                '{', '[' -> {
                    depth++
                    require(depth <= 16) { "JSON嵌套过深，无法导入。" }
                }
                '}', ']' -> depth--
            }
        }
    }

    private fun invalid(message: String): Nothing = throw IllegalArgumentException(message)
}
