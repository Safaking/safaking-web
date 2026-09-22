package in.safaking.app;

import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.view.View;
import androidx.annotation.NonNull;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Native plugins (Razorpay's Checkout included) are registered from
    // capacitor.plugins.json by `npx cap sync`; nothing to add here.

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        paintSystemBarGaps();
    }

    /**
     * From Android 15 the app runs edge to edge. With a WebView older than 140,
     * Capacitor keeps the page between the phone's bars by padding the page's
     * container — and the padding showed the default light window, so the white
     * clock and battery icons sat on white. Paint those two gaps to match what
     * touches them: the maroon app bar above, the white tab bar below.
     * A current WebView draws behind the bars instead and the page makes room
     * itself (globals.css); the padding is then zero and nothing shows here.
     */
    private void paintSystemBarGaps() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        final View container = (View) getBridge().getWebView().getParent();
        if (container == null) return;
        container.setBackground(new SystemBarGaps(container, 0xFF2D060E, 0xFFFFFFFF));
    }

    /** Fills the container's top padding with one colour and its bottom padding with another. */
    private static final class SystemBarGaps extends Drawable {
        private final View owner;
        private final Paint top = new Paint();
        private final Paint bottom = new Paint();

        SystemBarGaps(View owner, int topColor, int bottomColor) {
            this.owner = owner;
            top.setColor(topColor);
            bottom.setColor(bottomColor);
        }

        @Override
        public void draw(@NonNull Canvas canvas) {
            Rect bounds = getBounds();
            int topGap = owner.getPaddingTop();
            int bottomGap = owner.getPaddingBottom();
            if (topGap > 0) canvas.drawRect(bounds.left, bounds.top, bounds.right, bounds.top + topGap, top);
            if (bottomGap > 0) canvas.drawRect(bounds.left, bounds.bottom - bottomGap, bounds.right, bounds.bottom, bottom);
        }

        @Override
        public void setAlpha(int alpha) {}

        @Override
        public void setColorFilter(ColorFilter colorFilter) {}

        @Override
        public int getOpacity() {
            return PixelFormat.TRANSLUCENT;
        }
    }
}
