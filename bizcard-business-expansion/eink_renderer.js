/**
 * E-ink Bitmap Renderer (Offscreen Renderer)
 * 
 * In the BizCard 2.0 architecture, the heavy lifting of rendering UI for the E-ink display
 * is done on the App side (iOS/Android/Web) rather than on the low-power hardware.
 * 
 * This module uses an Offscreen Canvas (or DOM Canvas in the browser) to draw text, shapes, 
 * and AI results into a pure black and white bitmap, which is then serialized to be sent 
 * over BLE to the hardware.
 */

class EinkRenderer {
    constructor(width = 250, height = 122) { // Example typical e-ink resolution
        this.width = width;
        this.height = height;
        
        // Initialize Canvas
        if (typeof OffscreenCanvas !== 'undefined') {
            this.canvas = new OffscreenCanvas(width, height);
        } else {
            this.canvas = document.createElement('canvas');
            this.canvas.width = width;
            this.canvas.height = height;
        }
        
        this.ctx = this.canvas.getContext('2d');
        // E-ink screens usually only support true black (0) and white (1)
        this.ctx.imageSmoothingEnabled = false; 
    }

    /**
     * Clear the screen with white
     */
    clear() {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Render a textual notification (e.g., AI Summary, Copilot Action)
     * @param {string} title 
     * @param {string} body 
     */
    renderNotification(title, body) {
        this.clear();

        // Draw top bar
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.width, 24);

        // Draw title (White text on Black bar)
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 14px "Courier New", monospace';
        this.ctx.fillText(title, 8, 16);

        // Draw Body Text (Black text on White background)
        this.ctx.fillStyle = '#000000';
        this.ctx.font = '16px "Courier New", monospace';
        
        // Simple word wrap
        this._wrapText(body, 8, 45, this.width - 16, 20);
    }

    /**
     * Render Contact Info (e.g., Result of a command "Search for Feng")
     */
    renderContact(name, title, phone) {
        this.clear();

        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 20px "Courier New", monospace';
        this.ctx.fillText(name, 10, 30);

        this.ctx.font = '14px "Courier New", monospace';
        this.ctx.fillText(title, 10, 55);

        // Draw a separator line
        this.ctx.fillRect(10, 70, this.width - 20, 2);

        this.ctx.font = 'bold 18px "Courier New", monospace';
        this.ctx.fillText(phone, 10, 100);
    }

    /**
     * Internal text wrapper for canvas
     */
    _wrapText(text, x, y, maxWidth, lineHeight) {
        const words = text.split(''); // simple char split for CJK/English demo
        let line = '';
        let currentY = y;

        for(let n = 0; n < words.length; n++) {
            const testLine = line + words[n];
            const metrics = this.ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                this.ctx.fillText(line, x, currentY);
                line = words[n];
                currentY += lineHeight;
            }
            else {
                line = testLine;
            }
        }
        this.ctx.fillText(line, x, currentY);
    }

    /**
     * Dither the canvas to pure 1-bit black and white
     * Uses a simple thresholding for the demo
     */
    dither() {
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const threshold = avg < 128 ? 0 : 255;
            data[i]     = threshold; // R
            data[i + 1] = threshold; // G
            data[i + 2] = threshold; // B
            // Alpha remains the same
        }
        this.ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Get the final image buffer to send via BLE
     * @returns {Promise<Blob>}
     */
    async getBitmapBuffer() {
        this.dither();
        if (this.canvas.convertToBlob) {
            return await this.canvas.convertToBlob({ type: 'image/png' }); // Ideally RAW format, using PNG for mock
        } else {
            return new Promise((resolve) => {
                this.canvas.toBlob(resolve, 'image/png');
            });
        }
    }

    /**
     * For debugging in a browser environment
     * @returns {string} Data URL
     */
    toDataURL() {
        this.dither();
        return this.canvas.toDataURL();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EinkRenderer;
}
