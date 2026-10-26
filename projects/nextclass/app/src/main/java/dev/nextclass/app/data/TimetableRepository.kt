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
    private val baseFile = File(context.applicationContext.filesDir, "timetable-v1.json")
    private val atomicFile = AtomicFile(baseFile)

    @Synchronized
    fun load(): Timetable {
        // An interrupted first write is not a committed timetable. AtomicFile
        // itself restores the previous .bak file when one is available.
        if (!baseFile.exists() && !File(baseFile.path + ".bak").exists()) return Timetable()
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

    @Synchronized
    fun save(value: Timetable) {
        // Complete validation happens before opening the existing data file.
        val bytes = TimetableJson.encode(value).toByteArray(Charsets.UTF_8)
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
}
