package app.arkmd

import android.content.Context
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * The update check on Android: read the release's android.json over https. ArkMD doesn't download or install anything
 * itself; when a newer version exists, the app opens its download page in the browser and Android's own installer
 * handles the file.
 */
class UpdateCheck(private val ctx: Context) {

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

    private companion object {
        const val MAX_MANIFEST = 256 * 1024
    }
}
