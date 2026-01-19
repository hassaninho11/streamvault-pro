package app.lovable.c97735e8aa5e409fad248ddff56bc3a4

import android.content.Context
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.LaunchOptions
import com.google.android.gms.cast.framework.CastOptions
import com.google.android.gms.cast.framework.OptionsProvider
import com.google.android.gms.cast.framework.SessionProvider
import com.google.android.gms.cast.framework.media.CastMediaOptions
import com.google.android.gms.cast.framework.media.MediaIntentReceiver
import com.google.android.gms.cast.framework.media.NotificationOptions

/**
 * CastOptionsProvider - Provides Cast SDK configuration
 * 
 * This class is referenced in AndroidManifest.xml and configures:
 * - Default Media Receiver App ID (for basic media playback)
 * - Launch options (auto-join, relaunch if running)
 * - Notification options for cast controls
 * - Media control intents
 */
class CastOptionsProvider : OptionsProvider {

    override fun getCastOptions(context: Context): CastOptions {
        // Notification options for ongoing cast session
        val notificationOptions = NotificationOptions.Builder()
            .setActions(
                listOf(
                    MediaIntentReceiver.ACTION_TOGGLE_PLAYBACK,
                    MediaIntentReceiver.ACTION_STOP_CASTING
                ),
                intArrayOf(0, 1) // Button indices to show in compact view
            )
            .build()

        // Media options with notification
        val mediaOptions = CastMediaOptions.Builder()
            .setNotificationOptions(notificationOptions)
            .build()

        // Launch options - auto join existing session, relaunch if running
        val launchOptions = LaunchOptions.Builder()
            .setRelaunchIfRunning(false)
            .build()

        return CastOptions.Builder()
            // Use default media receiver for HLS/MP4 streaming
            .setReceiverApplicationId(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)
            .setLaunchOptions(launchOptions)
            .setCastMediaOptions(mediaOptions)
            .setEnableReconnectionService(true)
            .setResumeSavedSession(true)
            .setStopReceiverApplicationWhenEndingSession(true)
            .build()
    }

    override fun getAdditionalSessionProviders(context: Context): List<SessionProvider>? {
        return null
    }
}
