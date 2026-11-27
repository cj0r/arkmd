package app.arkmd

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
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
    private var printView: WebView? = null

    private fun pushInsets() {
        val (l, t, r, b) = lastInsets
        webView?.evaluateJavascript(
            "(function(s){s.setProperty('--inset-left','${l}px');s.setProperty('--inset-top','${t}px');" +
                "s.setProperty('--inset-right','${r}px');s.setProperty('--inset-bottom','${b}px')})(document.documentElement.style)", null)
    }

    private val openDoc = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) reply(openId, null) else { persist(uri); reply(openId, fileInfo(uri)) }
    }
    private var treeId = 0
    private val openTree = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri == null) { reply(treeId, null); return@registerForActivityResult }
        persist(uri)
        reply(treeId, uri.toString())
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

    /** The largest file ArkMD opens: a bigger one would freeze or crash the editor. */
    private val maxBytes = 20 * 1024 * 1024

    private fun readBytes(uri: Uri): ByteArray = contentResolver.openInputStream(uri)!!.use { input ->
        val out = java.io.ByteArrayOutputStream()
        val buf = ByteArray(64 * 1024)
        while (true) {
            val n = input.read(buf)
            if (n < 0) break
            out.write(buf, 0, n)
            // "NOTTEXT:" tells the web layer this is a refusal, not a missing file.
            check(out.size() <= maxBytes) { "NOTTEXT:This file is larger than ArkMD opens (20 MB)." }
        }
        out.toByteArray()
    }

    /**
     * The text of a file. UTF-8 comes back as a String and can be edited and saved safely. Any other encoding comes back
     * as {text, encoding}: reading it as UTF-8 would swap characters for U+FFFD, and saving would write that damage back.
     */
    private fun decodeText(bytes: ByteArray): Any {
        if (bytes.size >= 2 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xFE.toByte())
            return JSONObject().put("text", String(bytes, 2, bytes.size - 2, Charsets.UTF_16LE)).put("encoding", "utf-16le")
        if (bytes.size >= 2 && bytes[0] == 0xFE.toByte() && bytes[1] == 0xFF.toByte())
            return JSONObject().put("text", String(bytes, 2, bytes.size - 2, Charsets.UTF_16BE)).put("encoding", "utf-16be")
        check(bytes.take(8000).none { it == 0.toByte() }) { "NOTTEXT:This doesn't look like a text file." }
        return try {
            Charsets.UTF_8.newDecoder()
                .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
                .decode(java.nio.ByteBuffer.wrap(bytes)).toString()
        } catch (e: java.nio.charset.CharacterCodingException) {
            JSONObject().put("text", String(bytes, charset("windows-1252"))).put("encoding", "windows-1252")
        }
    }

    private fun readText(uri: Uri): Any = decodeText(readBytes(uri))

    /** The bytes are made before the file is opened for writing ("wt" empties it), so a failure here can't leave it empty. */
    private fun writeText(uri: Uri, text: String) {
        val bytes = text.toByteArray(Charsets.UTF_8)
        contentResolver.openOutputStream(uri, "wt")!!.use { it.write(bytes) }
    }

    private fun reply(id: Int, value: Any?) = post(id, JSONObject().put("value", value ?: JSONObject.NULL))
    private fun fail(id: Int, e: Throwable) = post(id, JSONObject().put("error", e.message ?: e.javaClass.simpleName))
    private fun post(id: Int, result: JSONObject) = main.post {
        webView?.evaluateJavascript("window.arkAndroidResult($id, ${JSONObject.quote(result.toString())})", null)
    }

    // ------------------------------------------------------------------ bridge (called from platform.js)

    private val updateCheck by lazy { UpdateCheck(this) }

    /** Store and updater apps ArkMD can hand an update to (the same packages are listed under <queries> in the manifest). */
    private val stores = mapOf(
        "org.fdroid.fdroid" to "F-Droid", "org.fdroid.basic" to "F-Droid", "com.machiav3lli.fdroid" to "Neo Store",
        "com.looker.droidify" to "Droid-ify", "dev.imranr.obtainium" to "Obtainium", "dev.imranr.obtainium.fdroid" to "Obtainium",
        "com.android.vending" to "Google Play",
    )

    /** The package that installed ArkMD, if any. */
    private fun installerPackage(): String? = runCatching {
        if (Build.VERSION.SDK_INT >= 30) packageManager.getInstallSourceInfo(packageName).installingPackageName
        else @Suppress("DEPRECATION") packageManager.getInstallerPackageName(packageName)
    }.getOrNull()

    inner class Bridge {
        /** android.json as text, plus this device's ABIs (best first) so the page can pick its entry. */
        @JavascriptInterface fun updateManifest(id: Int, url: String) = io.execute {
            runCatching { JSONObject().put("manifest", updateCheck.fetchManifest(url)).put("abis", JSONArray(Build.SUPPORTED_ABIS.toList())) }
                .onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }

        /**
         * Download an update with Android's Download Manager. The system shows the progress and a notification; ArkMD
         * never launches the installer, the user opens the finished file from the notification or Downloads.
         */
        @JavascriptInterface fun downloadUpdate(id: Int, url: String, fileName: String) = main.post {
            runCatching {
                val uri = Uri.parse(url)
                require(uri.scheme == "https" && uri.host == "github.com" && (uri.path ?: "").startsWith("/cj0r/arkmd/releases/download/") &&
                    uri.pathSegments.none { it == "." || it == ".." }) {
                    "updates come from ArkMD's releases on github.com over https"
                }
                val name = fileName.replace(Regex("[^A-Za-z0-9._-]"), "-")
                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                val downloadId = dm.enqueue(
                    DownloadManager.Request(uri)
                        .setTitle(name)
                        .setDescription("ArkMD update")
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
                )
                JSONObject().put("id", downloadId)
            }.onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }.let { }

        /** Progress of a download started by downloadUpdate: status, bytes so far and in total. */
        @JavascriptInterface fun downloadStatus(id: Int, downloadId: String) = io.execute {
            runCatching {
                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.query(DownloadManager.Query().setFilterById(downloadId.toLong())).use { c ->
                    if (!c.moveToFirst()) return@use JSONObject().put("status", "gone")
                    val state = when (c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))) {
                        DownloadManager.STATUS_SUCCESSFUL -> "done"
                        DownloadManager.STATUS_FAILED -> "failed"
                        DownloadManager.STATUS_PAUSED -> "paused"
                        DownloadManager.STATUS_PENDING -> "pending"
                        else -> "running"
                    }
                    JSONObject().put("status", state)
                        .put("done", c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)))
                        .put("total", c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)))
                        .put("reason", c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)))
                }
            }.onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }

        /** The app store or updater that installed ArkMD, when it is one we know ({ package, name }). */
        @JavascriptInterface fun installSource(id: Int) = io.execute {
            runCatching {
                val pkg = installerPackage()
                JSONObject().put("package", pkg ?: JSONObject.NULL).put("name", pkg?.let { stores[it] } ?: JSONObject.NULL)
            }.onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }

        /** Open that app at ArkMD's page (its own Update button does the install), or just open the app. */
        @JavascriptInterface fun openStore(id: Int) = main.post {
            runCatching {
                val pkg = installerPackage() ?: error("ArkMD wasn't installed from a store app")
                val tries = listOfNotNull(
                    Intent(Intent.ACTION_VIEW, Uri.parse("fdroid.app:$packageName")).setPackage(pkg),
                    Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$packageName")).setPackage(pkg),
                    packageManager.getLaunchIntentForPackage(pkg),
                )
                val opened = tries.any { runCatching { startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }.isSuccess }
                JSONObject().put("opened", opened)
            }.onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }.let { }

        /** The system's list of downloads. */
        @JavascriptInterface fun openDownloads() = main.post {
            runCatching { startActivity(Intent(DownloadManager.ACTION_VIEW_DOWNLOADS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }.let { }

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

        /** The folder picker for "Add a folder": the answer is a tree address whose access the system keeps across restarts. */
        @JavascriptInterface fun pickFolder(id: Int) = main.post {
            treeId = id
            openTree.launch(null)
        }.let { }

        /** One level of an added folder: Markdown files (with their own document address) and subfolders, hidden ones left out.
         *  rel is "/"-separated folder names below the added folder; each is found by name among the real children,
         *  so a path can never leave the folder. Only a tree ArkMD still holds access to can be read. */
        @JavascriptInterface fun listFolder(id: Int, root: String, rel: String) = io.execute {
            runCatching { listTree(treeUri(root), rel) }.onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }

        /** Give back the saved access when an added folder is removed. */
        @JavascriptInterface fun forgetFolder(id: Int, root: String) = io.execute {
            runCatching {
                val uri = Uri.parse(root)
                contentResolver.persistedUriPermissions.filter { it.uri == uri }.forEach {
                    val flags = (if (it.isReadPermission) Intent.FLAG_GRANT_READ_URI_PERMISSION else 0) or
                        (if (it.isWritePermission) Intent.FLAG_GRANT_WRITE_URI_PERMISSION else 0)
                    contentResolver.releasePersistableUriPermission(uri, flags)
                }
                true
            }.onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }

        private fun treeUri(ref: String): Uri = Uri.parse(ref).also { uri ->
            require(uri.scheme == "content" && DocumentsContract.isTreeUri(uri)) { "not a folder address" }
            require(contentResolver.persistedUriPermissions.any { it.uri == uri && it.isReadPermission }) { "no access to this folder" }
        }

        private val folderExtensions = setOf("md", "markdown", "mdown", "mkd", "txt")
        private val maxFolderEntries = 5000

        private fun children(tree: Uri, parentDocId: String): List<Triple<String, String, String>> {
            val uri = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentDocId)
            val cols = arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE)
            val out = ArrayList<Triple<String, String, String>>()
            contentResolver.query(uri, cols, null, null, null)?.use { c ->
                while (c.moveToNext()) {
                    val docId = c.getString(0)
                    val name = c.getString(1)
                    if (docId != null && name != null) out.add(Triple(docId, name, c.getString(2) ?: ""))
                }
            }
            return out
        }

        private fun listTree(tree: Uri, rel: String): JSONObject {
            val dir = DocumentsContract.Document.MIME_TYPE_DIR
            var docId = DocumentsContract.getTreeDocumentId(tree)
            for (seg in rel.split('/').filter { it.isNotEmpty() }) {
                require(seg != "." && seg != "..") { "not a folder name" }
                docId = children(tree, docId).firstOrNull { it.third == dir && it.second == seg }?.first ?: error("folder not found")
            }
            val entries = JSONArray()
            var truncated = false
            for ((childId, name, mime) in children(tree, docId)) {
                if (name.startsWith(".")) continue
                val isDir = mime == dir
                if (!isDir && name.substringAfterLast('.', "").lowercase() !in folderExtensions) continue
                if (entries.length() >= maxFolderEntries) { truncated = true; break }
                val e = JSONObject().put("name", name).put("is_dir", isDir)
                if (!isDir) e.put("ref", DocumentsContract.buildDocumentUriUsingTree(tree, childId).toString())
                entries.put(e)
            }
            return JSONObject().put("entries", entries).put("truncated", truncated)
        }

        /** Documents come from the system picker or an Open with intent, so they are always content:// addresses. */
        private fun documentUri(ref: String): Uri = Uri.parse(ref).also { require(it.scheme == "content") { "not a document address" } }

        @JavascriptInterface fun read(id: Int, ref: String) = io.execute {
            runCatching { readText(documentUri(ref)) }.onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }

        @JavascriptInterface fun write(id: Int, ref: String, text: String) = io.execute {
            runCatching { writeText(documentUri(ref), text) }.onSuccess { reply(id, true) }.onFailure { fail(id, it) }
        }

        /** Rename a document in place. The provider may give the renamed file a new address, which the page keeps using. */
        @JavascriptInterface fun rename(id: Int, ref: String, name: String) = io.execute {
            runCatching {
                val renamed = DocumentsContract.renameDocument(contentResolver, documentUri(ref), name)
                    ?: error("This location doesn't allow renaming")
                // Some providers (Downloads) give the renamed file an address ArkMD has no access to: say so, so the page
                // doesn't keep a tab it can no longer save
                val usable = runCatching { contentResolver.openInputStream(renamed)!!.close(); true }.getOrDefault(false)
                if (usable) persist(renamed)
                JSONObject().put("ref", renamed.toString()).put("name", if (usable) displayName(renamed) else name).put("access", usable)
            }.onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }

        /** Hand the text to the system share sheet. A very large text is refused: intents are limited to about 1 MB. */
        @JavascriptInterface fun shareText(id: Int, name: String, text: String) = main.post {
            runCatching {
                require(text.length <= 200_000) { "This document is too large to share as text" }
                val send = Intent(Intent.ACTION_SEND).setType("text/plain")
                    .putExtra(Intent.EXTRA_SUBJECT, name).putExtra(Intent.EXTRA_TEXT, text)
                startActivity(Intent.createChooser(send, null))
                true
            }.onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }.let { }

        /**
         * Print a finished HTML page through the system print dialog (which also saves a PDF). The page is drawn by
         * a separate WebView with scripts and file access off, so the document can't run anything.
         */
        @JavascriptInterface fun printHtml(id: Int, name: String, html: String) = main.post {
            runCatching {
                val view = WebView(this@MainActivity)
                view.settings.javaScriptEnabled = false
                view.settings.allowFileAccess = false
                view.settings.allowContentAccess = false
                view.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(v: WebView, url: String?) {
                        val job = name.replace(Regex("[^A-Za-z0-9._ -]"), "-")
                        (getSystemService(Context.PRINT_SERVICE) as PrintManager)
                            .print(job, v.createPrintDocumentAdapter(job), PrintAttributes.Builder().build())
                        reply(id, true)
                    }
                }
                printView = view          // kept until the next print, so the system can finish reading the page
                view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
            }.onFailure { fail(id, it) }
        }.let { }

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
                        require(uri.scheme == "content") { "not a document address" }
                        val read = readText(uri)
                        if (read is String) fileInfo(uri).put("text", read)
                        else fileInfo(uri).put("text", (read as JSONObject).getString("text")).put("notUtf8", read.getString("encoding"))
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

        /** The same question with the positive button named (Delete, rather than Discard). */
        @JavascriptInterface fun confirmWith(id: Int, title: String, message: String, ok: String) = main.post {
            AlertDialog.Builder(this@MainActivity).setTitle(title).setMessage(message)
                .setPositiveButton(ok) { _, _ -> reply(id, true) }
                .setNegativeButton("Cancel") { _, _ -> reply(id, false) }
                .setOnCancelListener { reply(id, false) }
                .show()
        }.let { }

        /** Delete a Markdown file inside a folder the user added. Android has no trash, so it is erased: the page asks first.
         *  Only a file below a folder ArkMD still holds write access to can be deleted, never a folder. */
        @JavascriptInterface fun deleteDocument(id: Int, ref: String) = io.execute {
            runCatching {
                val uri = documentUri(ref)
                require(DocumentsContract.isTreeUri(uri) && DocumentsContract.isDocumentUri(this@MainActivity, uri)) { "only a file in an added folder can be deleted" }
                val tree = DocumentsContract.buildTreeDocumentUri(uri.authority!!, DocumentsContract.getTreeDocumentId(uri))
                require(contentResolver.persistedUriPermissions.any { it.uri == tree && it.isWritePermission }) { "ArkMD can only read this folder, so it can't delete from it" }
                val mime = contentResolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_MIME_TYPE), null, null, null)?.use { if (it.moveToFirst()) it.getString(0) else null }
                require(mime != null && mime != DocumentsContract.Document.MIME_TYPE_DIR) { "not a file" }
                require(displayName(uri).substringAfterLast('.', "").lowercase() in folderExtensions) { "only Markdown files can be deleted here" }
                require(DocumentsContract.deleteDocument(contentResolver, uri)) { "the file could not be deleted" }
                true
            }.onSuccess { reply(id, it) }.onFailure { fail(id, it) }
        }

        @JavascriptInterface fun openUrl(url: String) = main.post {
            runCatching {
                val uri = Uri.parse(url)
                require(uri.scheme?.lowercase() in setOf("http", "https", "mailto")) { "only web and mail addresses can be opened" }
                startActivity(Intent(Intent.ACTION_VIEW, uri))
            }
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
