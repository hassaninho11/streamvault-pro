// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    id("com.android.application") version "8.9.1" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}

// Fix for RuntimeClasspathCopy configuration issue in Android Studio sync
// This must be applied at the root level to catch configurations created by AGP
subprojects {
    afterEvaluate {
        configurations.matching { it.name.endsWith("RuntimeClasspathCopy") }.configureEach {
            isCanBeResolved = true
            isCanBeConsumed = false
        }
    }
}
