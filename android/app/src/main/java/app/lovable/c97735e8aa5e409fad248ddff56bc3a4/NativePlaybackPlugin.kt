package app.lovable.c97735e8aa5e409fad248ddff56bc3a4

import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.PlayerView
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * NativePlaybackPlugin - Capacitor plugin for ExoPlayer-based native playback
 * 
 * This plugin provides a native Android media player for IPTV streams,
 * VOD content (MKV, MP4, TS), and live streaming channels.
 * 
 * Features:
 * - ExoPlayer with hardware acceleration
 * - HLS, DASH, and progressive media support
 * - Audio/subtitle track selection
 * - Adaptive bitrate streaming
 * - Picture-in-Picture support
 * - Buffer control
 */
@CapacitorPlugin(name = "NativePlayback")
class NativePlaybackPlugin : Plugin() {

    private var exoPlayer: ExoPlayer? = null
    private var playerView: PlayerView? = null
    private var playerContainer: FrameLayout? = null
    private var trackSelector: DefaultTrackSelector? = null
    
    private val mainHandler = Handler(Looper.getMainLooper())
    private var timeUpdateRunnable: Runnable? = null
    
    // Current stream info
    private var currentUrl: String? = null
    private var isLive: Boolean = false
    
    // State tracking
    private var currentStatus = "idle"
    private var lastError: JSObject? = null

    override fun load() {
        super.load()
        // Initialize on main thread
        mainHandler.post {
            initializePlayerView()
        }
    }

    private fun initializePlayerView() {
        val context = context ?: return
        
        // Create container
        playerContainer = FrameLayout(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.BLACK)
        }
        
        // Create PlayerView
        playerView = PlayerView(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
                Gravity.CENTER
            )
            useController = false // We control via web UI
            setBackgroundColor(Color.BLACK)
        }
        
        playerContainer?.addView(playerView)
    }

    @OptIn(UnstableApi::class)
    private fun createExoPlayer(context: Context): ExoPlayer {
        // Track selector for quality/audio/subtitle selection
        trackSelector = DefaultTrackSelector(context).apply {
            setParameters(
                buildUponParameters()
                    .setMaxVideoSizeSd() // Start with SD for faster loading
                    .setPreferredAudioLanguage("und") // Undefined = first track
            )
        }
        
        // Buffer configuration for IPTV
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                15000,  // Min buffer
                50000,  // Max buffer
                2500,   // Buffer for playback
                5000    // Buffer for rebuffer
            )
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()
        
        return ExoPlayer.Builder(context)
            .setTrackSelector(trackSelector!!)
            .setLoadControl(loadControl)
            .build()
            .also { player ->
                player.addListener(createPlayerListener())
                playerView?.player = player
            }
    }

    private fun createPlayerListener(): Player.Listener {
        return object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                val status = when (playbackState) {
                    Player.STATE_IDLE -> "idle"
                    Player.STATE_BUFFERING -> "buffering"
                    Player.STATE_READY -> if (exoPlayer?.isPlaying == true) "playing" else "paused"
                    Player.STATE_ENDED -> "stopped"
                    else -> "idle"
                }
                updateStatus(status)
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                val state = exoPlayer?.playbackState ?: Player.STATE_IDLE
                if (state == Player.STATE_READY) {
                    updateStatus(if (isPlaying) "playing" else "paused")
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                val errorObj = JSObject().apply {
                    put("code", error.errorCode.toString())
                    put("message", error.localizedMessage ?: "Playback error")
                    put("recoverable", error.errorCode != PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED)
                }
                lastError = errorObj
                updateStatus("error")
                notifyListeners("error", JSObject().apply { put("error", errorObj) })
            }

            override fun onTracksChanged(tracks: Tracks) {
                // Notify about available tracks change
                notifyListeners("tracksChanged", JSObject())
            }
        }
    }

    private fun updateStatus(status: String) {
        if (currentStatus != status) {
            currentStatus = status
            notifyListeners("stateChange", JSObject().apply {
                put("state", buildStateObject())
            })
        }
    }

    private fun buildStateObject(): JSObject {
        val player = exoPlayer
        return JSObject().apply {
            put("status", currentStatus)
            put("currentTime", (player?.currentPosition ?: 0L) / 1000.0)
            put("duration", (player?.duration?.takeIf { it != C.TIME_UNSET } ?: 0L) / 1000.0)
            put("bufferedPosition", (player?.bufferedPosition ?: 0L) / 1000.0)
            put("isLive", isLive)
            put("volume", player?.volume ?: 1f)
            put("muted", player?.volume == 0f)
            put("playbackRate", player?.playbackParameters?.speed ?: 1f)
            player?.videoFormat?.let { format ->
                put("videoWidth", format.width)
                put("videoHeight", format.height)
            }
        }
    }

    private fun startTimeUpdates() {
        stopTimeUpdates()
        timeUpdateRunnable = object : Runnable {
            override fun run() {
                exoPlayer?.let { player ->
                    notifyListeners("timeUpdate", JSObject().apply {
                        put("currentTime", player.currentPosition / 1000.0)
                        put("duration", player.duration.takeIf { it != C.TIME_UNSET }?.let { it / 1000.0 } ?: 0.0)
                        put("bufferedPosition", player.bufferedPosition / 1000.0)
                    })
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

    @OptIn(UnstableApi::class)
    @PluginMethod
    fun load(call: PluginCall) {
        val streamObj = call.getObject("stream") ?: run {
            call.reject("Missing stream object")
            return
        }
        
        val url = streamObj.getString("url") ?: run {
            call.reject("Missing stream URL")
            return
        }
        
        val startPosition = call.getDouble("startPosition", 0.0)?.times(1000)?.toLong() ?: 0L
        val autoPlay = call.getBoolean("autoPlay", true) ?: true
        
        currentUrl = url
        isLive = streamObj.getBoolean("isLive", false) ?: false
        
        val headers = mutableMapOf<String, String>()
        streamObj.getJSObject("headers")?.let { headersObj ->
            headersObj.keys().forEach { key ->
                headers[key] = headersObj.getString(key) ?: ""
            }
        }

        mainHandler.post {
            try {
                val context = context ?: run {
                    call.reject("Context not available")
                    return@post
                }

                // Release existing player
                exoPlayer?.release()
                
                // Create new player
                val player = createExoPlayer(context)
                exoPlayer = player

                // Create media source based on URL type
                val uri = Uri.parse(url)
                val mediaItem = MediaItem.Builder()
                    .setUri(uri)
                    .apply {
                        // Set MIME type hint if available
                        streamObj.getString("mimeType")?.let { setMimeType(it) }
                    }
                    .build()

                // HTTP data source with custom headers
                val httpDataSourceFactory = DefaultHttpDataSource.Factory()
                    .setDefaultRequestProperties(headers)
                    .setConnectTimeoutMs(15000)
                    .setReadTimeoutMs(30000)
                    .setAllowCrossProtocolRedirects(true)

                val dataSourceFactory = DefaultDataSource.Factory(context, httpDataSourceFactory)

                // Create appropriate media source
                val mediaSource = when {
                    url.contains(".m3u8", ignoreCase = true) -> {
                        HlsMediaSource.Factory(dataSourceFactory)
                            .setAllowChunklessPreparation(true)
                            .createMediaSource(mediaItem)
                    }
                    else -> {
                        // Progressive for MP4, MKV, TS, etc.
                        ProgressiveMediaSource.Factory(dataSourceFactory)
                            .createMediaSource(mediaItem)
                    }
                }

                player.setMediaSource(mediaSource)
                player.prepare()
                
                if (startPosition > 0) {
                    player.seekTo(startPosition)
                }
                
                player.playWhenReady = autoPlay
                
                startTimeUpdates()
                
                // Show player view
                showPlayerView()
                
                call.resolve(JSObject().apply { put("success", true) })
                
            } catch (e: Exception) {
                call.reject("Failed to load stream: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun play(call: PluginCall) {
        mainHandler.post {
            exoPlayer?.let { player ->
                player.playWhenReady = true
                if (player.playbackState == Player.STATE_ENDED) {
                    player.seekTo(0)
                }
                call.resolve()
            } ?: call.reject("Player not initialized")
        }
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        mainHandler.post {
            exoPlayer?.playWhenReady = false
            call.resolve()
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        mainHandler.post {
            stopTimeUpdates()
            exoPlayer?.stop()
            exoPlayer?.clearMediaItems()
            hidePlayerView()
            updateStatus("stopped")
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
            exoPlayer?.seekTo((position * 1000).toLong())
            call.resolve()
        }
    }

    @PluginMethod
    fun setVolume(call: PluginCall) {
        val volume = call.getFloat("volume") ?: run {
            call.reject("Missing volume")
            return
        }
        
        mainHandler.post {
            exoPlayer?.volume = volume.coerceIn(0f, 1f)
            call.resolve()
        }
    }

    @PluginMethod
    fun setMuted(call: PluginCall) {
        val muted = call.getBoolean("muted") ?: run {
            call.reject("Missing muted")
            return
        }
        
        mainHandler.post {
            exoPlayer?.volume = if (muted) 0f else 1f
            call.resolve()
        }
    }

    @PluginMethod
    fun setPlaybackRate(call: PluginCall) {
        val rate = call.getFloat("rate") ?: run {
            call.reject("Missing rate")
            return
        }
        
        mainHandler.post {
            exoPlayer?.setPlaybackSpeed(rate)
            call.resolve()
        }
    }

    @PluginMethod
    fun getState(call: PluginCall) {
        mainHandler.post {
            call.resolve(buildStateObject())
        }
    }

    @OptIn(UnstableApi::class)
    @PluginMethod
    fun getQualityLevels(call: PluginCall) {
        mainHandler.post {
            val levels = mutableListOf<JSObject>()
            
            exoPlayer?.currentTracks?.groups?.forEach { group ->
                if (group.type == C.TRACK_TYPE_VIDEO) {
                    for (i in 0 until group.length) {
                        val format = group.getTrackFormat(i)
                        levels.add(JSObject().apply {
                            put("id", "${group.type}_$i")
                            put("width", format.width)
                            put("height", format.height)
                            put("bitrate", format.bitrate)
                            put("label", "${format.height}p")
                        })
                    }
                }
            }
            
            call.resolve(JSObject().apply { put("levels", levels) })
        }
    }

    @OptIn(UnstableApi::class)
    @PluginMethod
    fun setQualityLevel(call: PluginCall) {
        val levelId = call.getString("levelId") ?: run {
            call.reject("Missing levelId")
            return
        }
        
        mainHandler.post {
            trackSelector?.let { selector ->
                if (levelId == "auto") {
                    selector.setParameters(
                        selector.buildUponParameters()
                            .clearVideoSizeConstraints()
                            .clearOverrides()
                    )
                } else {
                    // Parse level ID and set constraint
                    val parts = levelId.split("_")
                    if (parts.size == 2) {
                        val trackIndex = parts[1].toIntOrNull() ?: return@post
                        exoPlayer?.currentTracks?.groups?.forEach { group ->
                            if (group.type == C.TRACK_TYPE_VIDEO) {
                                val format = group.getTrackFormat(trackIndex)
                                selector.setParameters(
                                    selector.buildUponParameters()
                                        .setMaxVideoSize(format.width, format.height)
                                        .setMinVideoSize(format.width, format.height)
                                )
                            }
                        }
                    }
                }
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun getAudioTracks(call: PluginCall) {
        mainHandler.post {
            val tracks = mutableListOf<JSObject>()
            
            exoPlayer?.currentTracks?.groups?.forEachIndexed { groupIndex, group ->
                if (group.type == C.TRACK_TYPE_AUDIO) {
                    for (i in 0 until group.length) {
                        val format = group.getTrackFormat(i)
                        tracks.add(JSObject().apply {
                            put("id", "${groupIndex}_$i")
                            put("language", format.language ?: "und")
                            put("label", format.label ?: format.language ?: "Track ${i + 1}")
                        })
                    }
                }
            }
            
            call.resolve(JSObject().apply { put("tracks", tracks) })
        }
    }

    @OptIn(UnstableApi::class)
    @PluginMethod
    fun setAudioTrack(call: PluginCall) {
        val trackId = call.getString("trackId") ?: run {
            call.reject("Missing trackId")
            return
        }
        
        mainHandler.post {
            val parts = trackId.split("_")
            if (parts.size == 2) {
                val groupIndex = parts[0].toIntOrNull() ?: return@post
                val trackIndex = parts[1].toIntOrNull() ?: return@post
                
                exoPlayer?.currentTracks?.groups?.getOrNull(groupIndex)?.let { group ->
                    if (group.type == C.TRACK_TYPE_AUDIO) {
                        trackSelector?.setParameters(
                            trackSelector!!.buildUponParameters()
                                .setOverrideForType(
                                    TrackSelectionOverride(group.mediaTrackGroup, listOf(trackIndex))
                                )
                        )
                    }
                }
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun getSubtitleTracks(call: PluginCall) {
        mainHandler.post {
            val tracks = mutableListOf<JSObject>()
            
            exoPlayer?.currentTracks?.groups?.forEachIndexed { groupIndex, group ->
                if (group.type == C.TRACK_TYPE_TEXT) {
                    for (i in 0 until group.length) {
                        val format = group.getTrackFormat(i)
                        tracks.add(JSObject().apply {
                            put("id", "${groupIndex}_$i")
                            put("language", format.language ?: "und")
                            put("label", format.label ?: format.language ?: "Subtitle ${i + 1}")
                            put("isExternal", false)
                        })
                    }
                }
            }
            
            call.resolve(JSObject().apply { put("tracks", tracks) })
        }
    }

    @OptIn(UnstableApi::class)
    @PluginMethod
    fun setSubtitleTrack(call: PluginCall) {
        val trackId = call.getString("trackId")
        
        mainHandler.post {
            if (trackId == null) {
                // Disable subtitles
                trackSelector?.setParameters(
                    trackSelector!!.buildUponParameters()
                        .setRendererDisabled(C.TRACK_TYPE_TEXT, true)
                )
            } else {
                val parts = trackId.split("_")
                if (parts.size == 2) {
                    val groupIndex = parts[0].toIntOrNull() ?: return@post
                    val trackIndex = parts[1].toIntOrNull() ?: return@post
                    
                    exoPlayer?.currentTracks?.groups?.getOrNull(groupIndex)?.let { group ->
                        if (group.type == C.TRACK_TYPE_TEXT) {
                            trackSelector?.setParameters(
                                trackSelector!!.buildUponParameters()
                                    .setRendererDisabled(C.TRACK_TYPE_TEXT, false)
                                    .setOverrideForType(
                                        TrackSelectionOverride(group.mediaTrackGroup, listOf(trackIndex))
                                    )
                            )
                        }
                    }
                }
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun isPipSupported(call: PluginCall) {
        val supported = android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O
        call.resolve(JSObject().apply { put("supported", supported) })
    }

    @PluginMethod
    fun enterPip(call: PluginCall) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            activity?.enterPictureInPictureMode(
                android.app.PictureInPictureParams.Builder().build()
            )
            call.resolve()
        } else {
            call.reject("PiP not supported on this device")
        }
    }

    @PluginMethod
    fun exitPip(call: PluginCall) {
        // PiP exit is handled by the system
        call.resolve()
    }

    @PluginMethod
    fun getEngineInfo(call: PluginCall) {
        call.resolve(JSObject().apply {
            put("name", "ExoPlayer")
            put("version", "1.4.0") // Media3 version
            put("platform", "android")
        })
    }

    // ==================== View Management ====================

    private fun showPlayerView() {
        activity?.runOnUiThread {
            playerContainer?.let { container ->
                // Add to activity's content view
                val contentView = activity?.findViewById<ViewGroup>(android.R.id.content)
                if (container.parent == null) {
                    contentView?.addView(container)
                }
                container.visibility = android.view.View.VISIBLE
            }
        }
    }

    private fun hidePlayerView() {
        activity?.runOnUiThread {
            playerContainer?.visibility = android.view.View.GONE
        }
    }

    override fun handleOnDestroy() {
        stopTimeUpdates()
        mainHandler.post {
            exoPlayer?.release()
            exoPlayer = null
            playerContainer?.let { container ->
                (container.parent as? ViewGroup)?.removeView(container)
            }
        }
        super.handleOnDestroy()
    }
}
