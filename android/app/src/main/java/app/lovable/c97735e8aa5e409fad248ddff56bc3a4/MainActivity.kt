package app.lovable.c97735e8aa5e409fad248ddff56bc3a4

import android.os.Bundle
import androidx.core.view.WindowCompat
import com.getcapacitor.BridgeActivity

/**
 * MainActivity for StreamVault
 * 
 * CRITICAL: Plugins must be registered in init{} block BEFORE onCreate()
 * is called. In Capacitor 6+, the bridge is initialized in super.onCreate()
 * so registering plugins after that call means they won't be found by JS.
 * 
 * Also disables edge-to-edge mode to prevent UI from rendering
 * behind the system status bar.
 */
class MainActivity : BridgeActivity() {
    
    init {
        // CRITICAL: Register plugins BEFORE the bridge is initialized
        // This is called before onCreate(), ensuring plugins are available to JS
        registerPlugin(NativePlaybackPlugin::class.java)
        registerPlugin(NativeCastPlugin::class.java)
        registerPlugin(VlcPlaybackPlugin::class.java)
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        // Register plugins again for safety (some Capacitor versions need this)
        registerPlugin(NativePlaybackPlugin::class.java)
        registerPlugin(NativeCastPlugin::class.java)
        registerPlugin(VlcPlaybackPlugin::class.java)
        
        super.onCreate(savedInstanceState)
        
        // CRITICAL: Disable edge-to-edge mode
        // This ensures the WebView content respects system bar boundaries
        WindowCompat.setDecorFitsSystemWindows(window, true)
    }
}
