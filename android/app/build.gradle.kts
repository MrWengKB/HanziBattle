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
    compileSdk = 36

    defaultConfig {
        applicationId = "com.mrwengkb.hanzibattle"
        minSdk = 26
        targetSdk = 36
        // 每次 GitHub Actions 构建自动递增，方便覆盖安装；也用来判断有没有新版本
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = latestVersionName()
    }

    // 签名：使用 GitHub Secrets 里的上传密钥（打包时由 workflow 解码到 HB_KEYSTORE_FILE）。
    // 密钥不放在仓库里；本机打包时自己设置这四个环境变量即可
    val ksFile = System.getenv("HB_KEYSTORE_FILE")
    signingConfigs {
        create("release") {
            if (!ksFile.isNullOrEmpty()) {
                storeFile = file(ksFile)
                storePassword = System.getenv("HB_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("HB_KEY_ALIAS")
                keyPassword = System.getenv("HB_KEY_PASSWORD")
            }
        }
    }

    // 两个版本：
    //   direct：直接下载安装的 APK，启动时检查 GitHub 上有没有新版本
    //   play：上架 Google Play 的 AAB，不能自己检查/下载更新（Play 政策规定只能由 Play 更新）
    flavorDimensions += "dist"
    productFlavors {
        create("direct") {
            dimension = "dist"
            buildConfigField("boolean", "UPDATE_CHECK", "true")
        }
        create("play") {
            dimension = "dist"
            buildConfigField("boolean", "UPDATE_CHECK", "false")
        }
    }

    buildFeatures {
        buildConfig = true
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
