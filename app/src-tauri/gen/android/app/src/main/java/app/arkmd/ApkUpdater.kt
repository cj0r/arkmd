package app.arkmd

import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * In-app update for Android: read the release's android.json, download the APK, check it, and hand it to the
 * system installer, which asks the user to confirm. Android itself refuses an update signed with a different key;
 * the checks here (SHA-256 from the manifest, same package, same signing certificate, higher version) turn a bad
 * file into a clear message instead of a failed install.
 */
class ApkUpdater(private val ctx: Context) {

    private fun open(url: String): HttpURLConnection {
        val u = URL(url)
        // Updates come over https; test builds may use plain http to a local server.
        require(u.protocol == "https" || (BuildConfig.DEBUG && u.protocol == "http")) { "updates must use https" }
        return (u.openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 30_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "ArkMD/" + (ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: ""))
        }
    }

    private fun readLimited(input: InputStream, limit: Int): ByteArray {
        val out = java.io.ByteArrayOutputStream()
        val buf = ByteArray(8 * 1024)
        while (true) {
            val n = input.read(buf)
            if (n < 0) break
            out.write(buf, 0, n)
            check(out.size() <= limit) { "the update information is too large" }
        }
        return out.toByteArray()
    }

    /** The text of android.json. */
    fun fetchManifest(url: String): String {
        val c = open(url)
        try {
            check(c.responseCode == 200) { "the update server answered ${c.responseCode}" }
            return c.inputStream.use { readLimited(it, MAX_MANIFEST) }.toString(Charsets.UTF_8)
        } finally {
            c.disconnect()
        }
    }

    /** Download the APK into the cache folder, reporting progress, and check it against [sha256]. */
    fun download(url: String, sha256: String, onProgress: (Long, Long) -> Unit): File {
        val dir = File(ctx.cacheDir, "updates").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }          // drop any earlier download
        val out = File(dir, "ArkMD-update.apk")
        val c = open(url)
        try {
            check(c.responseCode == 200) { "the download server answered ${c.responseCode}" }
            val total = c.contentLengthLong
            check(total <= MAX_APK) { "the update is larger than expected" }
            val digest = MessageDigest.getInstance("SHA-256")
            var done = 0L
            var reported = 0L
            c.inputStream.use { input ->
                out.outputStream().use { file ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        file.write(buf, 0, n)
                        digest.update(buf, 0, n)
                        done += n
                        check(done <= MAX_APK) { "the update is larger than expected" }
                        if (done - reported >= 200_000) { onProgress(done, total); reported = done }
                    }
                }
            }
            onProgress(done, total)
            val got = digest.digest().joinToString("") { "%02x".format(it) }
            if (got != sha256.lowercase()) {
                out.delete()
                error("the download doesn't match its checksum")
            }
            return out
        } catch (e: Exception) {
            out.delete()
            throw e
        } finally {
            c.disconnect()
        }
    }

    private fun flags() =
        if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES
        else @Suppress("DEPRECATION") PackageManager.GET_SIGNATURES

    private fun certs(p: PackageInfo): Set<String> {
        val sigs = if (Build.VERSION.SDK_INT >= 28) p.signingInfo?.apkContentsSigners
        else @Suppress("DEPRECATION") p.signatures
        return sigs.orEmpty().map { s -> MessageDigest.getInstance("SHA-256").digest(s.toByteArray()).joinToString("") { "%02x".format(it) } }.toSet()
    }

    @Suppress("DEPRECATION")
    private fun versionCode(p: PackageInfo): Long = if (Build.VERSION.SDK_INT >= 28) p.longVersionCode else p.versionCode.toLong()

    /** The file must be this app, signed with the same certificate as the installed copy, and newer. */
    fun verify(apk: File) {
        val pm = ctx.packageManager
        val archive = pm.getPackageArchiveInfo(apk.path, flags()) ?: error("the download isn't a valid app package")
        check(archive.packageName == ctx.packageName) { "the download isn't an ArkMD update" }
        val installed = pm.getPackageInfo(ctx.packageName, flags())
        check(certs(archive).isNotEmpty() && certs(archive) == certs(installed)) { "the update is signed with a different key" }
        check(versionCode(archive) > versionCode(installed)) { "the update is not newer than the installed version" }
    }

    /** Whether Android already lets ArkMD start installs (a per-app setting, "Install unknown apps"). */
    fun canInstall(): Boolean = Build.VERSION.SDK_INT < 26 || ctx.packageManager.canRequestPackageInstalls()

    /** The settings page where the user allows ArkMD to install updates. */
    fun permissionIntent(): Intent =
        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${ctx.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    /** The system installer's screen for the downloaded APK. */
    fun installIntent(apk: File): Intent {
        val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.fileprovider", apk)
        return Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    private companion object {
        const val MAX_MANIFEST = 256 * 1024
        // release APKs are under 10 MB; debug builds used for testing are far larger
        val MAX_APK = if (BuildConfig.DEBUG) 400L * 1024 * 1024 else 100L * 1024 * 1024
    }
}
