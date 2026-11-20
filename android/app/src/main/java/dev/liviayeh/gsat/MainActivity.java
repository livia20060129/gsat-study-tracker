package dev.liviayeh.gsat;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) { registerPlugin(StudyLockTimerPlugin.class); super.onCreate(state); }
}
