package dev.nextclass.app.data

import android.content.Context
import dev.nextclass.app.domain.Timetable
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

/** Shared by one-time initialization and the explicit, confirmed reload action. */
object SemesterPreset {
    const val ASSET_NAME = "semester-2026-autumn.json"

    fun load(context: Context): Timetable {
        try {
            val bytes = context.applicationContext.assets.open(ASSET_NAME).use { input ->
                val output = ByteArrayOutputStream()
                val block = ByteArray(8192)
                var total = 0
                while (true) {
                    val count = input.read(block)
                    if (count < 0) break
                    total += count
                    require(total <= TimetableJson.MAX_JSON_BYTES) { "内置课表超过2MB。" }
                    output.write(block, 0, count)
                }
                output.toByteArray()
            }
            val text = Charsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes))
                .toString()
            return TimetableJson.decode(text)
        } catch (error: Exception) {
            throw IllegalStateException(
                "内置学期课表无法读取，现有课表未被替换。${error.message.orEmpty()}",
                error
            )
        }
    }
}
