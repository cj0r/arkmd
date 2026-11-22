package app.arkmd

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Tauri activity plus the ArkMD platform bridge (window.ArkAndroid, see desktop/src/platform.js):
 * Storage Access Framework open/save, read/write of content:// URIs, "Open with" / Share intents,
 * back button, system bar colours and keyboard/system-bar insets.
 */
class MainActivity : TauriActivity() {
    private var webView: WebView? = null
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var launch: Intent? = null
    private var openId = 0
    private var createId = 0
    private var createText = ""
    private var lastInsets = listOf(0, 0, 0, 0)

    private fun pushInsets() {
        val (l, t, r, b) = lastInsets
        webView?.evaluateJavascript(
            "(function(s){s.setProperty('--inset-left','${l}px');s.setProperty('--inset-top','${t}px');" +
                "s.setProperty('--inset-right','${r}px');s.setProperty('--inset-bottom','${b}px')})(document.documentElement.style)", null)
    }

    private val openDoc = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) reply(openId, null) else { persist(uri); reply(openId, fileInfo(uri)) }
    }
    private val createDoc = registerForActivityResult(ActivityResultContracts.CreateDocument("text/markdown")) { uri ->
        if (uri == null) { reply(createId, null); return@registerForActivityResult }
        persist(uri)
        val id = createId
        io.execute {
            runCatching { writeText(uri, createText) }
                .onSuccess { reply(id, fileInfo(uri)) }
                .onFailure { fail(id, it) }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        launch = intent?.takeIf { isDocumentIntent(it) }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val wv = webView ?: return finish()
                wv.evaluateJavascript("window.arkBack ? String(window.arkBack()) : 'false'") { handled ->
                    if (handled?.trim('"') != "true") { isEnabled = false; onBackPressedDispatcher.onBackPressed(); isEnabled = true }
                }
            }
        })
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (isDocumentIntent(intent)) {
            launch = intent
            webView?.evaluateJavascript("window.arkAndroidLaunch && window.arkAndroidLaunch()", null)
        }
    }

    override fun onWebViewCreate(webView: WebView) {
        this.webView = webView
        applyFontScale()
        webView.addJavascriptInterface(Bridge(), "ArkAndroid")
        // Edge-to-edge (enforced from API 35): the page pads itself using --inset-* CSS variables, so the
        // toolbar clears the status bar and the editor stays above the navigation bar and keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val d = resources.displayMetrics.density
            lastInsets = intArrayOf(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom)).map { (it / d).toInt() }
            pushInsets()
            insets
        }
    }

    override fun onDestroy() { io.shutdown(); super.onDestroy() }

    /** Follow Android's font size setting (native text uses sp; the WebView needs textZoom). */
    private fun applyFontScale() {
        webView?.settings?.textZoom = (resources.configuration.fontScale * 100).toInt()
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        applyFontScale()
    }

    // ------------------------------------------------------------------ helpers

    private fun isDocumentIntent(i: Intent) = i.action in setOf(Intent.ACTION_VIEW, Intent.ACTION_EDIT, Intent.ACTION_SEND)

    private fun persist(uri: Uri) {
        runCatching {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        }.recoverCatching { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
    }

    private fun displayName(uri: Uri): String = runCatching {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    }.getOrNull() ?: uri.lastPathSegment?.substringAfterLast('/') ?: "Untitled.md"

    private fun fileInfo(uri: Uri) = JSONObject().put("ref", uri.toString()).put("name", displayName(uri))

    private fun readText(uri: Uri): String =
        contentResolver.openInputStream(uri)!!.use { it.readBytes() }.toString(Charsets.UTF_8)

    private fun writeText(uri: Uri, text: String) =
        contentResolver.openOutputStream(uri, "wt")!!.use { it.write(text.toByteArray(Charsets.UTF_8)) }

    private fun reply(id: Int, value: Any?) = post(id, JSONObject().put("value", value ?: JSONObject.NULL))
    private fun fail(id: Int, e: Throwable) = post(id, JSONObject().put("error", e.message ?: e.javaClass.simpleName))
    private fun post(id: Int, result: JSONObject) = main.post {
        webView?.evaluateJavascript("window.arkAndroidResult($id, ${JSONObject.quote(result.toString())})", null)
    }

    // ------------------------------------------------------------------ bridge (called from platform.js)

    private val updateCheck by lazy { UpdateCheck(this) }

    inner class Bridge {
        /** android.json as text, plus this device's ABIs (best first) so the page can pick its entry. */
        @JavascriptInterface fun updateManifest(id: Int, url: String) = io.execute {
            runCatching { JSONObject().put("manifest", updateCheck.fetchManifest(url)).put("abis", JSONArray(Build.SUPPORTED_ABIS.toList())) }
                .onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }

        @JavascriptInterface fun openDocument(id: Int) = main.post {
            openId = id
            openDoc.launch(arrayOf("text/markdown", "text/x-markdown", "text/plain", "application/octet-stream"))
        }.let { }

        /** The file picker for a theme (.css) file. */
        @JavascriptInterface fun openCss(id: Int) = main.post {
            openId = id
            openDoc.launch(arrayOf("text/css", "text/plain", "application/octet-stream"))
        }.let { }

        @JavascriptInterface fun createDocument(id: Int, name: String, text: String) = main.post {
            createId = id; createText = text
            createDoc.launch(name)
        }.let { }

        @JavascriptInterface fun read(id: Int, ref: String) = io.execute {
            runCatching { readText(Uri.parse(ref)) }.onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }

        @JavascriptInterface fun write(id: Int, ref: String, text: String) = io.execute {
            runCatching { writeText(Uri.parse(ref), text) }.onSuccess { reply(id, true) }.onFailure { fail(id, it) }
        }

        /** The document this activity was opened with (Open with / Share), consumed once. */
        @JavascriptInterface fun takeLaunch(id: Int) {
            val i = launch; launch = null
            if (i == null) { reply(id, null); return }
            io.execute {
                runCatching {
                    @Suppress("DEPRECATION")
                    val uri: Uri? = if (i.action == Intent.ACTION_SEND) i.getParcelableExtra(Intent.EXTRA_STREAM) else i.data
                    if (uri == null) {
                        val subject = i.getStringExtra(Intent.EXTRA_SUBJECT)
                        JSONObject().put("ref", JSONObject.NULL).put("name", subject?.let { "$it.md" } ?: "Untitled.md")
                            .put("text", i.getStringExtra(Intent.EXTRA_TEXT) ?: "")
                    } else {
                        fileInfo(uri).put("text", readText(uri))
                    }
                }.onSuccess { reply(id, it) }.onFailure { fail(id, it) }
            }
        }

        @JavascriptInterface fun confirm(id: Int, title: String, message: String) = main.post {
            AlertDialog.Builder(this@MainActivity).setTitle(title).setMessage(message)
                .setPositiveButton("Discard") { _, _ -> reply(id, true) }
                .setNegativeButton("Cancel") { _, _ -> reply(id, false) }
                .setOnCancelListener { reply(id, false) }
                .show()
        }.let { }

        @JavascriptInterface fun openUrl(url: String) = main.post {
            runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
        }.let { }

        /** Re-send the current insets (the page asks once it has loaded). */
        @JavascriptInterface fun requestInsets() = main.post { pushInsets(); webView?.let { ViewCompat.requestApplyInsets(it) } }.let { }

        /** Match the system bars to the theme: background colour and light/dark icons. */
        @JavascriptInterface fun setChrome(bg: String, dark: Boolean) = main.post {
            val c = runCatching { Color.parseColor(bg) }.getOrDefault(Color.BLACK)
            window.decorView.setBackgroundColor(c)
            (webView?.parent as? View)?.setBackgroundColor(c)
            WindowCompat.getInsetsController(window, window.decorView).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }.let { }
    }
}
