plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.lovable.c97735e8aa5e409fad248ddff56bc3a4"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.lovable.c97735e8aa5e409fad248ddff56bc3a4"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }
}

dependencies {
    // Capacitor
    implementation(project(":capacitor-android"))
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.15.0")
    
    // Media3 ExoPlayer (latest stable)
    val media3Version = "1.4.0"
    implementation("androidx.media3:media3-exoplayer:$media3Version")
    implementation("androidx.media3:media3-exoplayer-hls:$media3Version")
    implementation("androidx.media3:media3-exoplayer-dash:$media3Version")
    implementation("androidx.media3:media3-ui:$media3Version")
    implementation("androidx.media3:media3-datasource:$media3Version")
    implementation("androidx.media3:media3-common:$media3Version")
    
    // Chromecast support with Media3
    implementation("androidx.media3:media3-cast:$media3Version")
    
    // Google Cast Framework
    implementation("com.google.android.gms:play-services-cast-framework:22.0.0")
    
    // For smooth streaming
    implementation("androidx.media3:media3-exoplayer-smoothstreaming:$media3Version")
    
    // libVLC for in-app VLC playback (fallback engine)
    implementation("org.videolan.android:libvlc-all:3.6.0")
    
    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
