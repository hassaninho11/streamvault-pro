package app.lovable.c97735e8aa5e409fad248ddff56bc3a4

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.SurfaceView
import android.view.ViewGroup
import android.widget.FrameLayout
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.interfaces.IVLCVout
import java.util.ArrayList

/**
 * VlcPlaybackPlugin - Native VLC playback using libVLC in-app
 * 
 * This plugin provides in-app VLC playback for formats not well supported by ExoPlayer.
 * Unlike external player intents, this keeps playback within the app with consistent UI.
 * 
 * Supported formats: MKV, AVI, RMVB, TS, FLV, WMV, and more
 * Codec support: AC3, EAC3, DTS, HEVC, VP9, etc.
 */
@CapacitorPlugin(name = "VlcPlayback")
class VlcPlaybackPlugin : Plugin() {
    
    companion object {
        private const val TAG = "VlcPlayback"
    }
    
    private var libVLC: LibVLC? = null
    private var mediaPlayer: MediaPlayer? = null
    private var playerContainer: FrameLayout? = null
    private var surfaceView: SurfaceView? = null
    
    private var currentStatus = "idle"
    private var currentUrl: String? = null
    
    private val mainHandler = Handler(Looper.getMainLooper())
    private var timeUpdateRunnable: Runnable? = null
    
    // ==================== Lifecycle ====================
    
    override fun load() {
        super.load()
        Log.d(TAG, "VLC Playback Plugin loaded")
        initializeLibVLC()
    }
    
    private fun initializeLibVLC() {
        try {
            val options = ArrayList<String>().apply {
                add("--no-drop-late-frames")
                add("--no-skip-frames")
                add("--rtsp-tcp")
                add("-vvv") // Verbose for debugging
                add("--network-caching=1500")
                add("--file-caching=1500")
                add("--live-caching=1500")
                add("--http-reconnect")
                add("--audio-resampler=soxr")
                add("--avcodec-hw=any") // Hardware acceleration
            }
            
            libVLC = LibVLC(context, options)
            Log.d(TAG, "LibVLC initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize LibVLC", e)
        }
    }
    
    private fun initializePlayerView() {
        activity?.runOnUiThread {
            if (playerContainer != null) return@runOnUiThread
            
            playerContainer = FrameLayout(context).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                setBackgroundColor(android.graphics.Color.BLACK)
            }
            
            surfaceView = SurfaceView(context).apply {
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            }
            
            playerContainer?.addView(surfaceView)
            
            Log.d(TAG, "VLC Player view initialized")
        }
    }
    
    private fun showPlayerView() {
        activity?.runOnUiThread {
            val rootView = activity?.findViewById<ViewGroup>(android.R.id.content)
            if (playerContainer?.parent == null) {
                rootView?.addView(playerContainer)
            }
            playerContainer?.visibility = android.view.View.VISIBLE
        }
    }
    
    private fun hidePlayerView() {
        activity?.runOnUiThread {
            playerContainer?.visibility = android.view.View.GONE
        }
    }
    
    // ==================== Plugin Methods ====================
    
    @PluginMethod
    fun load(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrEmpty()) {
            call.reject("URL is required")
            return
        }
        
        Log.d(TAG, "Loading URL: ${url.take(80)}...")
        
        val headers = call.getObject("headers")
        val startPosition = call.getDouble("startPosition", 0.0)
        val autoPlay = call.getBoolean("autoPlay", true) ?: true
        
        currentUrl = url
        
        activity?.runOnUiThread {
            try {
                // Initialize view if needed
                initializePlayerView()
                
                // Release previous player
                mediaPlayer?.let {
                    it.stop()
                    it.detachViews()
                    it.release()
                }
                
                // Create new media player
                val vlc = libVLC ?: run {
                    call.reject("LibVLC not initialized")
                    return@runOnUiThread
                }
                
                mediaPlayer = MediaPlayer(vlc).apply {
                    // Attach to surface
                    surfaceView?.let { surface ->
                        vlcVout.setVideoView(surface)
                        vlcVout.attachViews()
                    }
                    
                    // Set up event listener
                    setEventListener { event ->
                        handleVlcEvent(event)
                    }
                }
                
                // Create media with options
                val media = Media(vlc, Uri.parse(url)).apply {
                    // Apply headers if provided
                    headers?.let { h ->
                        val userAgent = h.getString("User-Agent")
                        val referer = h.getString("Referer")
                        
                        userAgent?.let { addOption(":http-user-agent=$it") }
                        referer?.let { addOption(":http-referrer=$it") }
                        
                        // Apply any custom headers
                        val iterator = h.keys()
                        while (iterator.hasNext()) {
                            val key = iterator.next()
                            if (key != "User-Agent" && key != "Referer") {
                                val value = h.getString(key)
                                value?.let { addOption(":http-forward-cookies=1") }
                            }
                        }
                    }
                    
                    // Network caching for smoother playback
                    addOption(":network-caching=1500")
                    addOption(":clock-jitter=0")
                    addOption(":clock-synchro=0")
                }
                
                mediaPlayer?.media = media
                media.release()
                
                // Show player
                showPlayerView()
                
                // Seek to start position if provided
                if (startPosition != null && startPosition > 0) {
                    mediaPlayer?.time = (startPosition * 1000).toLong()
                }
                
                // Auto-play
                if (autoPlay) {
                    mediaPlayer?.play()
                    updateStatus("playing")
                } else {
                    updateStatus("paused")
                }
                
                startTimeUpdates()
                
                call.resolve(JSObject().apply {
                    put("success", true)
                })
                
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load media", e)
                updateStatus("error")
                notifyError("LOAD_FAILED", e.message ?: "Failed to load media")
                call.reject("Failed to load: ${e.message}")
            }
        }
    }
    
    @PluginMethod
    fun play(call: PluginCall) {
        activity?.runOnUiThread {
            mediaPlayer?.play()
            updateStatus("playing")
            call.resolve()
        }
    }
    
    @PluginMethod
    fun pause(call: PluginCall) {
        activity?.runOnUiThread {
            mediaPlayer?.pause()
            updateStatus("paused")
            call.resolve()
        }
    }
    
    @PluginMethod
    fun stop(call: PluginCall) {
        activity?.runOnUiThread {
            stopTimeUpdates()
            mediaPlayer?.stop()
            updateStatus("stopped")
            hidePlayerView()
            call.resolve()
        }
    }
    
    @PluginMethod
    fun seek(call: PluginCall) {
        val position = call.getDouble("position", 0.0) ?: 0.0
        
        activity?.runOnUiThread {
            mediaPlayer?.time = (position * 1000).toLong()
            call.resolve()
        }
    }
    
    @PluginMethod
    fun setVolume(call: PluginCall) {
        val volume = call.getDouble("volume", 1.0) ?: 1.0
        
        activity?.runOnUiThread {
            mediaPlayer?.volume = (volume * 100).toInt()
            call.resolve()
        }
    }
    
    @PluginMethod
    fun setMuted(call: PluginCall) {
        val muted = call.getBoolean("muted", false) ?: false
        
        activity?.runOnUiThread {
            mediaPlayer?.volume = if (muted) 0 else 100
            call.resolve()
        }
    }
    
    @PluginMethod
    fun setPlaybackRate(call: PluginCall) {
        val rate = call.getFloat("rate", 1.0f) ?: 1.0f
        
        activity?.runOnUiThread {
            mediaPlayer?.rate = rate
            call.resolve()
        }
    }
    
    @PluginMethod
    fun getState(call: PluginCall) {
        call.resolve(buildStateObject())
    }
    
    @PluginMethod
    fun getAudioTracks(call: PluginCall) {
        activity?.runOnUiThread {
            val tracks = JSObject()
            val trackArray = com.getcapacitor.JSArray()
            
            mediaPlayer?.let { player ->
                val audioTracks = player.audioTracks
                audioTracks?.forEachIndexed { index, track ->
                    val trackObj = JSObject().apply {
                        put("id", track.id.toString())
                        put("label", track.name ?: "Audio $index")
                        put("language", track.name ?: "und")
                        put("selected", player.audioTrack == track.id)
                    }
                    trackArray.put(trackObj)
                }
            }
            
            tracks.put("tracks", trackArray)
            call.resolve(tracks)
        }
    }
    
    @PluginMethod
    fun setAudioTrack(call: PluginCall) {
        val trackId = call.getString("trackId")
        
        activity?.runOnUiThread {
            trackId?.let {
                mediaPlayer?.audioTrack = it.toIntOrNull() ?: -1
            }
            call.resolve()
        }
    }
    
    @PluginMethod
    fun getSubtitleTracks(call: PluginCall) {
        activity?.runOnUiThread {
            val tracks = JSObject()
            val trackArray = com.getcapacitor.JSArray()
            
            mediaPlayer?.let { player ->
                val spuTracks = player.spuTracks
                spuTracks?.forEachIndexed { index, track ->
                    val trackObj = JSObject().apply {
                        put("id", track.id.toString())
                        put("label", track.name ?: "Subtitle $index")
                        put("language", track.name ?: "und")
                        put("selected", player.spuTrack == track.id)
                    }
                    trackArray.put(trackObj)
                }
            }
            
            tracks.put("tracks", trackArray)
            call.resolve(tracks)
        }
    }
    
    @PluginMethod
    fun setSubtitleTrack(call: PluginCall) {
        val trackId = call.getString("trackId")
        
        activity?.runOnUiThread {
            if (trackId == null || trackId == "-1" || trackId == "off") {
                mediaPlayer?.spuTrack = -1
            } else {
                mediaPlayer?.spuTrack = trackId.toIntOrNull() ?: -1
            }
            call.resolve()
        }
    }
    
    @PluginMethod
    fun addExternalSubtitle(call: PluginCall) {
        val url = call.getString("url")
        
        if (url.isNullOrEmpty()) {
            call.reject("Subtitle URL is required")
            return
        }
        
        activity?.runOnUiThread {
            try {
                mediaPlayer?.addSlave(Media.Slave.Type.Subtitle, Uri.parse(url), true)
                call.resolve(JSObject().apply { put("success", true) })
            } catch (e: Exception) {
                Log.e(TAG, "Failed to add subtitle", e)
                call.reject("Failed to add subtitle: ${e.message}")
            }
        }
    }
    
    @PluginMethod
    fun getEngineInfo(call: PluginCall) {
        val info = JSObject().apply {
            put("engine", "vlc")
            put("displayName", "VLC (libVLC)")
            put("version", LibVLC.version())
            put("capabilities", JSObject().apply {
                put("drm", false)
                put("casting", false)
                put("pip", true)
                put("hls", true)
                put("dash", true)
                put("mkv", true)
                put("avi", true)
                put("ac3", true)
                put("hevc", true)
            })
        }
        call.resolve(info)
    }
    
    @PluginMethod
    fun destroy(call: PluginCall) {
        activity?.runOnUiThread {
            cleanup()
            call.resolve()
        }
    }
    
    // ==================== Event Handling ====================
    
    private fun handleVlcEvent(event: MediaPlayer.Event) {
        when (event.type) {
            MediaPlayer.Event.Opening -> {
                updateStatus("opening")
            }
            MediaPlayer.Event.Buffering -> {
                val bufferPercent = event.buffering
                if (bufferPercent < 100) {
                    updateStatus("buffering")
                }
                notifyBuffering(bufferPercent)
            }
            MediaPlayer.Event.Playing -> {
                updateStatus("playing")
            }
            MediaPlayer.Event.Paused -> {
                updateStatus("paused")
            }
            MediaPlayer.Event.Stopped -> {
                updateStatus("stopped")
            }
            MediaPlayer.Event.EndReached -> {
                updateStatus("ended")
            }
            MediaPlayer.Event.EncounteredError -> {
                updateStatus("error")
                notifyError("PLAYBACK_ERROR", "VLC encountered a playback error")
            }
            MediaPlayer.Event.TimeChanged -> {
                // Handled by periodic updates
            }
            MediaPlayer.Event.PositionChanged -> {
                // Handled by periodic updates
            }
        }
    }
    
    private fun updateStatus(status: String) {
        if (currentStatus != status) {
            currentStatus = status
            notifyStateChange()
        }
    }
    
    private fun buildStateObject(): JSObject {
        val player = mediaPlayer
        
        val currentTimeMs = player?.time ?: 0L
        val durationMs = player?.length ?: 0L
        val volume = (player?.volume ?: 100) / 100.0
        val isMuted = player?.volume == 0
        
        return JSObject().apply {
            put("status", currentStatus)
            put("currentTime", currentTimeMs / 1000.0)
            put("duration", durationMs / 1000.0)
            put("buffered", if (currentStatus == "buffering") 0.5 else 1.0)
            put("volume", volume)
            put("isMuted", isMuted)
            put("playbackRate", player?.rate?.toDouble() ?: 1.0)
        }
    }
    
    private fun notifyStateChange() {
        val data = JSObject().apply {
            put("state", buildStateObject())
        }
        notifyListeners("stateChange", data)
    }
    
    private fun notifyError(code: String, message: String) {
        val data = JSObject().apply {
            put("error", JSObject().apply {
                put("code", code)
                put("message", message)
            })
        }
        notifyListeners("error", data)
    }
    
    private fun notifyBuffering(percent: Float) {
        val data = JSObject().apply {
            put("percent", percent.toDouble())
        }
        notifyListeners("buffering", data)
    }
    
    // ==================== Time Updates ====================
    
    private fun startTimeUpdates() {
        stopTimeUpdates()
        
        timeUpdateRunnable = object : Runnable {
            override fun run() {
                val player = mediaPlayer ?: return
                
                val currentTimeMs = player.time
                val durationMs = player.length
                
                val data = JSObject().apply {
                    put("currentTime", currentTimeMs / 1000.0)
                    put("duration", durationMs / 1000.0)
                }
                notifyListeners("timeUpdate", data)
                
                mainHandler.postDelayed(this, 500)
            }
        }
        
        mainHandler.post(timeUpdateRunnable!!)
    }
    
    private fun stopTimeUpdates() {
        timeUpdateRunnable?.let {
            mainHandler.removeCallbacks(it)
        }
        timeUpdateRunnable = null
    }
    
    // ==================== Cleanup ====================
    
    private fun cleanup() {
        Log.d(TAG, "Cleaning up VLC player")
        stopTimeUpdates()
        
        mediaPlayer?.let {
            it.stop()
            it.detachViews()
            it.release()
        }
        mediaPlayer = null
        
        playerContainer?.let { container ->
            (container.parent as? ViewGroup)?.removeView(container)
        }
        playerContainer = null
        surfaceView = null
        
        currentStatus = "idle"
        currentUrl = null
    }
    
    override fun handleOnDestroy() {
        cleanup()
        
        libVLC?.release()
        libVLC = null
        
        super.handleOnDestroy()
    }
}
