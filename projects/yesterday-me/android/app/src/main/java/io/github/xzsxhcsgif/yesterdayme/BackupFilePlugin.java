package io.github.xzsxhcsgif.yesterdayme;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Writes only a user-selected JSON document; no storage permission or path API. */
@CapacitorPlugin(name = "BackupFile")
public class BackupFilePlugin extends Plugin {
    private volatile boolean awaitingDocument = false;

    @Override
    protected Bundle saveInstanceState() {
        // Never place a potentially large private backup in Android's 1 MB state bundle.
        // If the OS kills the app while the picker is open, the user exports again.
        return null;
    }

    @PluginMethod
    public void save(PluginCall call) {
        String filename = call.getString("filename");
        String json = call.getString("json");
        if (filename == null || !filename.matches("[A-Za-z0-9._-]{1,160}\\.json") || json == null || json.isEmpty()) {
            call.reject("备份文件格式无效。", "INVALID_BACKUP");
            return;
        }
        if (awaitingDocument) {
            call.reject("请先完成当前保存操作。", "SAVE_IN_PROGRESS");
            return;
        }
        awaitingDocument = true;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        try {
            startActivityForResult(call, intent, "documentSelected");
        } catch (Exception error) {
            awaitingDocument = false;
            call.reject("无法打开系统文件选择器。", "PICKER_UNAVAILABLE", error);
        }
    }

    @ActivityCallback
    private void documentSelected(PluginCall call, ActivityResult result) {
        if (call == null) { awaitingDocument = false; return; }
        if (result.getResultCode() != Activity.RESULT_OK) {
            awaitingDocument = false;
            JSObject response = new JSObject();
            response.put("saved", false);
            call.resolve(response);
            return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        String json = call.getString("json");
        if (uri == null || !"content".equals(uri.getScheme()) || json == null) {
            awaitingDocument = false;
            call.reject("未能取得所选文档的写入权限。", "DOCUMENT_UNAVAILABLE");
            return;
        }
        execute(() -> {
            try {
                try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (output == null) throw new java.io.IOException("No output stream");
                    output.write(json.getBytes(StandardCharsets.UTF_8));
                    output.flush();
                }
                JSObject response = new JSObject();
                response.put("saved", true);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("备份未能保存，请确认所选位置可写入。", "WRITE_FAILED", error);
            } finally {
                awaitingDocument = false;
            }
        });
    }
}
