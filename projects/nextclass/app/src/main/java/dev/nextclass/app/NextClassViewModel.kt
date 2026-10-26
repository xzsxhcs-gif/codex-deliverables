package dev.nextclass.app

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import dev.nextclass.app.data.TimetableJson
import dev.nextclass.app.data.TimetableRepository
import dev.nextclass.app.data.SemesterPreset
import dev.nextclass.app.domain.Course
import dev.nextclass.app.domain.Semester
import dev.nextclass.app.domain.Timetable
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

data class NextClassState(
    val timetable: Timetable = Timetable(),
    val loading: Boolean = true,
    val busy: Boolean = false,
    val storageReady: Boolean = false,
    val error: String? = null,
)

class NextClassViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = TimetableRepository(application)
    private val writeMutex = Mutex()
    private val mutableState = MutableStateFlow(NextClassState())
    val state: StateFlow<NextClassState> = mutableState.asStateFlow()

    init { reload() }

    fun reload() {
        viewModelScope.launch {
            writeMutex.withLock {
                mutableState.value = mutableState.value.copy(loading = true, error = null)
                try {
                    val loaded = withContext(Dispatchers.IO) { repository.load() }
                    mutableState.value = NextClassState(timetable = loaded, loading = false, storageReady = true)
                } catch (error: Exception) {
                    if (error is CancellationException) throw error
                    mutableState.value = mutableState.value.copy(
                        loading = false, storageReady = false, error = message(error, "课表读取失败。"),
                    )
                }
            }
        }
    }

    fun dismissError() { mutableState.value = mutableState.value.copy(error = null) }

    suspend fun saveSemester(semester: Semester): Boolean = change { current ->
        requireNotNull(semester.startDate) { "请设置第1周的周一日期。" }
        current.copy(semester = semester)
    }

    suspend fun saveCourse(course: Course): Boolean = change { current ->
        val exists = current.courses.any { it.id == course.id }
        current.copy(courses = if (exists) {
            current.courses.map { if (it.id == course.id) course else it }
        } else {
            current.courses + course
        })
    }

    suspend fun deleteCourse(id: String): Boolean = change { current ->
        current.copy(courses = current.courses.filterNot { it.id == id })
    }

    suspend fun importTimetable(value: Timetable): Boolean = change(allowRecovery = true) { value }

    suspend fun readSemesterPreset(): Timetable? = fileOperation {
        withContext(Dispatchers.IO) { SemesterPreset.load(getApplication()) }
    }

    private suspend fun change(
        allowRecovery: Boolean = false,
        transform: (Timetable) -> Timetable,
    ): Boolean = writeMutex.withLock {
        if (!mutableState.value.storageReady && !allowRecovery) {
            mutableState.value = mutableState.value.copy(error = "请先重新读取课表，或导入备份恢复数据。")
            return@withLock false
        }
        // Rotation can cancel the editor's coroutine. Once a local write begins,
        // finish both the atomic file and the ViewModel update as one operation.
        withContext(NonCancellable) {
            mutableState.value = mutableState.value.copy(busy = true, error = null)
            try {
                val next = transform(mutableState.value.timetable)
                withContext(Dispatchers.IO) { repository.save(next) }
                mutableState.value = mutableState.value.copy(timetable = next, storageReady = true, error = null)
                true
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                mutableState.value = mutableState.value.copy(error = message(error, "保存失败，请重试。"))
                false
            } finally {
                mutableState.value = mutableState.value.copy(busy = false)
            }
        }
    }

    suspend fun readImport(uri: Uri): Timetable? = fileOperation {
        withContext(Dispatchers.IO) {
            val resolver = getApplication<Application>().contentResolver
            val bytes = resolver.openInputStream(uri)?.use { input ->
                val result = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                var total = 0
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    total += count
                    require(total <= TimetableJson.MAX_JSON_BYTES) { "导入文件不能超过2MB。" }
                    result.write(buffer, 0, count)
                }
                result.toByteArray()
            } ?: error("无法打开选择的文件。")
            val text = Charsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes)).toString()
            TimetableJson.decode(text)
        }
    }

    suspend fun exportTo(uri: Uri): Boolean = fileOperation {
        check(mutableState.value.storageReady) { "本地课表尚未成功读取，无法导出。" }
        val value = mutableState.value.timetable
        withContext(Dispatchers.IO) {
            val bytes = TimetableJson.encode(value).toByteArray(Charsets.UTF_8)
            getApplication<Application>().contentResolver.openOutputStream(uri, "wt")?.use {
                it.write(bytes)
                it.flush()
            } ?: error("无法写入选择的位置。")
        }
        true
    } ?: false

    private suspend fun <T> fileOperation(operation: suspend () -> T): T? = writeMutex.withLock {
        mutableState.value = mutableState.value.copy(busy = true, error = null)
        try {
            operation()
        } catch (error: Exception) {
            if (error is CancellationException) throw error
            mutableState.value = mutableState.value.copy(error = message(error, "文件操作失败。"))
            null
        } finally {
            mutableState.value = mutableState.value.copy(busy = false)
        }
    }

    private fun message(error: Exception, fallback: String): String =
        error.message?.takeIf { it.isNotBlank() }?.take(400) ?: fallback
}
