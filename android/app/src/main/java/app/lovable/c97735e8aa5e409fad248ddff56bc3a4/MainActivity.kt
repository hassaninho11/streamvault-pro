package app.lovable.c97735e8aa5e409fad248ddff56bc3a4

import android.os.Bundle
import androidx.core.view.WindowCompat
import com.getcapacitor.BridgeActivity

/**
 * MainActivity for StreamVault
 * 
 * CRITICAL: Disables edge-to-edge mode to prevent UI from rendering
 * behind the system status bar (clock, battery, notifications).
 * 
 * This is the NATIVE fix for Android - CSS safe-area-inset does not
 * work reliably in Android WebViews.
 */
class MainActivity : BridgeActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // CRITICAL: Disable edge-to-edge mode
        // This ensures the WebView content respects system bar boundaries
        // and does not render behind the status bar
        WindowCompat.setDecorFitsSystemWindows(window, true)
        
        // Register native playback plugins
        registerPlugin(NativePlaybackPlugin::class.java)
        registerPlugin(NativeCastPlugin::class.java)
    }
}
