package app.lovable.c97735e8aa5e409fad248ddff56bc3a4

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.cast.CastPlayer
import androidx.media3.cast.SessionAvailabilityListener
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaMetadata as CastMediaMetadata
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.CastState
import com.google.android.gms.cast.framework.CastStateListener
import com.google.android.gms.cast.framework.SessionManager
import com.google.android.gms.cast.framework.SessionManagerListener
import com.google.android.gms.common.images.WebImage

/**
 * NativeCastPlugin - Capacitor plugin for Chromecast integration using Media3 Cast
 * 
 * Features:
 * - Device discovery and selection
 * - Media loading (HLS, MP4, etc.)
 * - Playback controls (play, pause, seek, volume)
 * - Session management (connect, disconnect, resume)
 * - Media metadata (title, artwork)
 */
@OptIn(UnstableApi::class)
@CapacitorPlugin(name = "NativeCast")
class NativeCastPlugin : Plugin() {

    private var castContext: CastContext? = null
    private var castPlayer: CastPlayer? = null
    private var sessionManager: SessionManager? = null
    
    private val mainHandler = Handler(Looper.getMainLooper())
    private var timeUpdateRunnable: Runnable? = null
    
    // Current cast state
    private var isCasting = false
    private var currentMediaUrl: String? = null
    private var currentTitle: String? = null
    
    // Cast state listener
    private val castStateListener = CastStateListener { state ->
        val stateString = when (state) {
            CastState.NO_DEVICES_AVAILABLE -> "no_devices"
            CastState.NOT_CONNECTED -> "not_connected"
            CastState.CONNECTING -> "connecting"
            CastState.CONNECTED -> "connected"
            else -> "unknown"
        }
        notifyListeners("castStateChange", JSObject().apply {
            put("state", stateString)
            put("isConnected", state == CastState.CONNECTED)
        })
    }
    
    // Session manager listener
    private val sessionManagerListener = object : SessionManagerListener<CastSession> {
        override fun onSessionStarting(session: CastSession) {
            notifyListeners("sessionEvent", JSObject().apply {
                put("event", "starting")
            })
        }

        override fun onSessionStarted(session: CastSession, sessionId: String) {
            isCasting = true
            initCastPlayer(session)
            notifyListeners("sessionEvent", JSObject().apply {
                put("event", "started")
                put("sessionId", sessionId)
                put("deviceName", session.castDevice?.friendlyName ?: "Chromecast")
            })
        }

        override fun onSessionStartFailed(session: CastSession, error: Int) {
            isCasting = false
            notifyListeners("sessionEvent", JSObject().apply {
                put("event", "startFailed")
                put("errorCode", error)
            })
        }

        override fun onSessionEnding(session: CastSession) {
            notifyListeners("sessionEvent", JSObject().apply {
                put("event", "ending")
            })
        }

        override fun onSessionEnded(session: CastSession, error: Int) {
            isCasting = false
            stopTimeUpdates()
            castPlayer?.release()
            castPlayer = null
            notifyListeners("sessionEvent", JSObject().apply {
                put("event", "ended")
                put("errorCode", error)
            })
        }

        override fun onSessionResuming(session: CastSession, sessionId: String) {
            notifyListeners("sessionEvent", JSObject().apply {
                put("event", "resuming")
                put("sessionId", sessionId)
            })
        }

        override fun onSessionResumed(session: CastSession, wasSuspended: Boolean) {
            isCasting = true
            initCastPlayer(session)
            notifyListeners("sessionEvent", JSObject().apply {
                put("event", "resumed")
                put("wasSuspended", wasSuspended)
            })
        }

        override fun onSessionResumeFailed(session: CastSession, error: Int) {
            isCasting = false
            notifyListeners("sessionEvent", JSObject().apply {
                put("event", "resumeFailed")
                put("errorCode", error)
            })
        }

        override fun onSessionSuspended(session: CastSession, reason: Int) {
            notifyListeners("sessionEvent", JSObject().apply {
                put("event", "suspended")
                put("reason", reason)
            })
        }
    }

    override fun load() {
        super.load()
        mainHandler.post {
            try {
                castContext = CastContext.getSharedInstance(context)
                sessionManager = castContext?.sessionManager
                
                // Add listeners
                castContext?.addCastStateListener(castStateListener)
                sessionManager?.addSessionManagerListener(
                    sessionManagerListener, 
                    CastSession::class.java
                )
                
                // Check if already connected
                sessionManager?.currentCastSession?.let { session ->
                    isCasting = true
                    initCastPlayer(session)
                }
                
            } catch (e: Exception) {
                println("[NativeCast] Failed to initialize: ${e.message}")
            }
        }
    }

    private fun initCastPlayer(session: CastSession) {
        castPlayer?.release()
        castPlayer = CastPlayer(castContext!!).apply {
            setSessionAvailabilityListener(object : SessionAvailabilityListener {
                override fun onCastSessionAvailable() {
                    startTimeUpdates()
                }

                override fun onCastSessionUnavailable() {
                    stopTimeUpdates()
                }
            })
            
            addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    val state = when (playbackState) {
                        Player.STATE_IDLE -> "idle"
                        Player.STATE_BUFFERING -> "buffering"
                        Player.STATE_READY -> if (isPlaying) "playing" else "paused"
                        Player.STATE_ENDED -> "ended"
                        else -> "unknown"
                    }
                    notifyListeners("playbackStateChange", JSObject().apply {
                        put("state", state)
                    })
                }

                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    notifyListeners("playbackStateChange", JSObject().apply {
                        put("state", if (isPlaying) "playing" else "paused")
                    })
                }
            })
        }
        
        startTimeUpdates()
    }

    private fun startTimeUpdates() {
        stopTimeUpdates()
        timeUpdateRunnable = object : Runnable {
            override fun run() {
                castPlayer?.let { player ->
                    if (player.playbackState != Player.STATE_IDLE) {
                        notifyListeners("timeUpdate", JSObject().apply {
                            put("currentTime", player.currentPosition / 1000.0)
                            put("duration", player.duration.takeIf { it != C.TIME_UNSET }?.let { it / 1000.0 } ?: 0.0)
                            put("bufferedPosition", player.bufferedPosition / 1000.0)
                        })
                    }
                }
                mainHandler.postDelayed(this, 1000)
            }
        }
        mainHandler.postDelayed(timeUpdateRunnable!!, 1000)
    }

    private fun stopTimeUpdates() {
        timeUpdateRunnable?.let { mainHandler.removeCallbacks(it) }
        timeUpdateRunnable = null
    }

    // ==================== Plugin Methods ====================

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        mainHandler.post {
            val available = try {
                castContext != null && 
                castContext?.castState != CastState.NO_DEVICES_AVAILABLE
            } catch (e: Exception) {
                false
            }
            call.resolve(JSObject().apply { put("available", available) })
        }
    }

    @PluginMethod
    fun getCastState(call: PluginCall) {
        mainHandler.post {
            val state = castContext?.castState ?: CastState.NO_DEVICES_AVAILABLE
            val stateString = when (state) {
                CastState.NO_DEVICES_AVAILABLE -> "no_devices"
                CastState.NOT_CONNECTED -> "not_connected"
                CastState.CONNECTING -> "connecting"
                CastState.CONNECTED -> "connected"
                else -> "unknown"
            }
            
            val deviceName = sessionManager?.currentCastSession?.castDevice?.friendlyName
            
            call.resolve(JSObject().apply {
                put("state", stateString)
                put("isConnected", state == CastState.CONNECTED)
                put("deviceName", deviceName)
            })
        }
    }

    @PluginMethod
    fun showCastDialog(call: PluginCall) {
        mainHandler.post {
            try {
                // Use Media Router to show cast picker
                val mediaRouteSelector = castContext?.mergedSelector
                if (mediaRouteSelector != null) {
                    // Trigger the cast button - this shows the system cast dialog
                    val intent = android.content.Intent("android.media.action.MEDIA_ROUTE_CHOOSER")
                    activity?.startActivity(intent)
                }
                call.resolve()
            } catch (e: Exception) {
                // Fallback: just resolve as the cast button will handle UI
                call.resolve()
            }
        }
    }

    @PluginMethod
    fun loadMedia(call: PluginCall) {
        val url = call.getString("url") ?: run {
            call.reject("Missing url")
            return
        }
        val title = call.getString("title") ?: "Unknown"
        val subtitle = call.getString("subtitle")
        val posterUrl = call.getString("posterUrl")
        val isLive = call.getBoolean("isLive", false) ?: false
        val startPosition = call.getDouble("startPosition", 0.0)?.times(1000)?.toLong() ?: 0L
        
        currentMediaUrl = url
        currentTitle = title
        
        mainHandler.post {
            val player = castPlayer ?: run {
                call.reject("Cast session not active")
                return@post
            }
            
            try {
                // Build metadata
                val metadata = MediaMetadata.Builder()
                    .setTitle(title)
                    .apply {
                        subtitle?.let { setSubtitle(it) }
                        posterUrl?.let { setArtworkUri(Uri.parse(it)) }
                    }
                    .build()
                
                // Determine MIME type
                val mimeType = when {
                    url.contains(".m3u8", ignoreCase = true) -> MimeTypes.APPLICATION_M3U8
                    url.contains(".mpd", ignoreCase = true) -> MimeTypes.APPLICATION_MPD
                    url.contains(".mp4", ignoreCase = true) -> MimeTypes.VIDEO_MP4
                    url.contains(".ts", ignoreCase = true) -> MimeTypes.VIDEO_MP2T
                    else -> MimeTypes.APPLICATION_M3U8 // Default to HLS for IPTV
                }
                
                // Build media item
                val mediaItem = MediaItem.Builder()
                    .setUri(url)
                    .setMimeType(mimeType)
                    .setMediaMetadata(metadata)
                    .apply {
                        if (isLive) {
                            setLiveConfiguration(
                                MediaItem.LiveConfiguration.Builder()
                                    .setMaxPlaybackSpeed(1.02f)
                                    .build()
                            )
                        }
                    }
                    .build()
                
                // Set and play
                player.setMediaItem(mediaItem, startPosition)
                player.prepare()
                player.play()
                
                call.resolve(JSObject().apply { put("success", true) })
                
            } catch (e: Exception) {
                call.reject("Failed to load media: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun play(call: PluginCall) {
        mainHandler.post {
            castPlayer?.play()
            call.resolve()
        }
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        mainHandler.post {
            castPlayer?.pause()
            call.resolve()
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        mainHandler.post {
            castPlayer?.stop()
            call.resolve()
        }
    }

    @PluginMethod
    fun seek(call: PluginCall) {
        val position = call.getDouble("position") ?: run {
            call.reject("Missing position")
            return
        }
        
        mainHandler.post {
            castPlayer?.seekTo((position * 1000).toLong())
            call.resolve()
        }
    }

    @PluginMethod
    fun setVolume(call: PluginCall) {
        val volume = call.getDouble("volume") ?: run {
            call.reject("Missing volume")
            return
        }
        
        mainHandler.post {
            try {
                sessionManager?.currentCastSession?.let { session ->
                    session.setVolume(volume.coerceIn(0.0, 1.0))
                }
                call.resolve()
            } catch (e: Exception) {
                call.reject("Failed to set volume: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun setMuted(call: PluginCall) {
        val muted = call.getBoolean("muted") ?: run {
            call.reject("Missing muted")
            return
        }
        
        mainHandler.post {
            try {
                sessionManager?.currentCastSession?.let { session ->
                    session.isMute = muted
                }
                call.resolve()
            } catch (e: Exception) {
                call.reject("Failed to set muted: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun getPlaybackState(call: PluginCall) {
        mainHandler.post {
            val player = castPlayer
            val session = sessionManager?.currentCastSession
            
            val state = when (player?.playbackState) {
                Player.STATE_IDLE -> "idle"
                Player.STATE_BUFFERING -> "buffering"
                Player.STATE_READY -> if (player.isPlaying) "playing" else "paused"
                Player.STATE_ENDED -> "ended"
                else -> "idle"
            }
            
            call.resolve(JSObject().apply {
                put("state", state)
                put("currentTime", (player?.currentPosition ?: 0L) / 1000.0)
                put("duration", (player?.duration?.takeIf { it != C.TIME_UNSET } ?: 0L) / 1000.0)
                put("volume", session?.volume ?: 1.0)
                put("isMuted", session?.isMute ?: false)
            })
        }
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        mainHandler.post {
            try {
                sessionManager?.endCurrentSession(true)
                call.resolve()
            } catch (e: Exception) {
                call.reject("Failed to disconnect: ${e.message}", e)
            }
        }
    }

    override fun handleOnDestroy() {
        stopTimeUpdates()
        mainHandler.post {
            castPlayer?.release()
            castPlayer = null
            
            castContext?.removeCastStateListener(castStateListener)
            sessionManager?.removeSessionManagerListener(
                sessionManagerListener,
                CastSession::class.java
            )
        }
        super.handleOnDestroy()
    }
}
