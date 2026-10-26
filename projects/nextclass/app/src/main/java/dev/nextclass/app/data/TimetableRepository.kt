package dev.nextclass.app.data

import android.content.Context
import android.util.AtomicFile
import dev.nextclass.app.domain.Timetable
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

/** Blocking file operations; the UI calls this repository on its IO dispatcher. */
class TimetableRepository(context: Context) {
    private val appContext = context.applicationContext
    private val baseFile = File(appContext.filesDir, "timetable-v1.json")
    private val atomicFile = AtomicFile(baseFile)
    private val initialization = appContext.getSharedPreferences(
        "preset-initialization", Context.MODE_PRIVATE
    )

    fun load(): Timetable = synchronized(processLock) {
        // Read and validate existing data before considering any migration. A
        // damaged file must never be treated as an empty timetable to replace.
        val existing = readExisting()
        if (initialization.getBoolean(PRESET_INITIALIZED, false)) {
            return@synchronized existing ?: Timetable()
        }
        if (existing != null && existing.courses.isNotEmpty()) {
            recordInitialization()
            return@synchronized existing
        }

        val preset = SemesterPreset.load(appContext)
        val bytes = TimetableJson.encode(preset).toByteArray(Charsets.UTF_8)
        // Mark only after a successful automatic install. If the process stops
        // here, the next load sees nonempty data and preserves it without reseeding.
        writeAtomically(bytes)
        recordInitialization()
        preset
    }

    private fun readExisting(): Timetable? {
        // An interrupted first write is not a committed timetable. AtomicFile
        // itself restores the previous .bak file when one is available.
        if (!baseFile.exists() && !File(baseFile.path + ".bak").exists()) return null
        try {
            val bytes = atomicFile.openRead().use { input ->
                val result = ByteArrayOutputStream()
                val block = ByteArray(8192)
                var total = 0
                while (true) {
                    val count = input.read(block)
                    if (count < 0) break
                    total += count
                    require(total <= TimetableJson.MAX_JSON_BYTES) { "本地课表超过2MB。" }
                    result.write(block, 0, count)
                }
                result.toByteArray()
            }
            val text = Charsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes))
                .toString()
            return TimetableJson.decode(text)
        } catch (error: Exception) {
            throw IllegalStateException(
                "无法读取本地课表，原文件已保留。${error.message.orEmpty()}",
                error
            )
        }
    }

    fun save(value: Timetable): Unit = synchronized(processLock) {
        // Complete validation happens before opening the existing data file.
        val bytes = TimetableJson.encode(value).toByteArray(Charsets.UTF_8)
        // An explicit save, including an empty import or deleting the last
        // course, is a user decision. Commit its marker before changing data so
        // an interrupted operation cannot trigger unwanted automatic reseeding.
        recordInitialization()
        writeAtomically(bytes)
    }

    private fun recordInitialization() {
        // Commit synchronously, including on explicit saves, so a failed prior
        // preference write is retried instead of trusting only its in-memory value.
        if (!initialization.edit().putBoolean(PRESET_INITIALIZED, true).commit()) {
            throw IllegalStateException(
                "无法保存课表初始化状态，本次操作尚未完成。请检查剩余存储空间后重试。"
            )
        }
    }

    private fun writeAtomically(bytes: ByteArray) {
        var stream: FileOutputStream? = null
        try {
            stream = atomicFile.startWrite()
            stream.write(bytes)
            atomicFile.finishWrite(stream)
            stream = null
        } catch (error: Exception) {
            atomicFile.failWrite(stream)
            throw IllegalStateException("课表保存失败，原有数据未被替换，请重试。", error)
        }
    }

    private companion object {
        // This marks installation of this particular preset, not every app
        // version. A later update must not undo an intentional empty timetable.
        const val PRESET_INITIALIZED = "semester_2026_autumn_v1_initialized"
        val processLock = Any()
    }
}
