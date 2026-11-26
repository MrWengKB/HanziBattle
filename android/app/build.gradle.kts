plugins {
    id("com.android.application")
}

// 把仓库根目录的网页文件复制进 App 的 assets/www，网页更新后重新打包即可同步
// （不复制 sw.js：App 本身就是离线的，不需要 Service Worker）
val webRoot = rootProject.projectDir.parentFile
val webAssetsDir = layout.buildDirectory.dir("webassets")

val copyWeb by tasks.registering(Sync::class) {
    from(webRoot) {
        include(
            "index.html", "style.css", "hanzilist.csv", "manifest.webmanifest",
            "favicon.svg", "favicon.ico", "js/**", "fonts/**", "audio/**", "icons/**",
            "README.md", "version-history.md"
        )
    }
    into(webAssetsDir.map { it.dir("www") })
}

// 从 version-history.md 第一个带版本号的标题读出版本，例如「## v1.5.0（2026-11-26）」→「1.5.0」
fun latestVersionName(): String {
    val historyFile = webRoot.resolve("version-history.md")
    if (!historyFile.exists()) return "0.0.0"
    val re = Regex("""^\s*#+.*?[vV]\s*(\d+(?:\.\d+)*)""")
    for (line in historyFile.readLines(Charsets.UTF_8)) {
        val m = re.find(line)
        if (m != null) return m.groupValues[1]
    }
    return "0.0.0"
}

android {
    namespace = "com.mrwengkb.hanzibattle"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.mrwengkb.hanzibattle"
        minSdk = 26
        targetSdk = 34
        // 每次 GitHub Actions 构建自动递增，方便覆盖安装；也用来判断有没有新版本
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = latestVersionName()
    }

    // 固定签名：每次构建签名一致，新版才能直接覆盖安装旧版
    signingConfigs {
        create("release") {
            storeFile = file("hanzibattle.keystore")
            storePassword = "android"
            keyAlias = "hanzibattle"
            keyPassword = "android"
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            assets.srcDir(webAssetsDir.get().asFile)
        }
    }

    // 音频是 mp3，本来就压缩过，不要再压缩
    androidResources {
        noCompress.addAll(listOf("mp3", "ttf"))
    }
}

tasks.named("preBuild") { dependsOn(copyWeb) }

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
