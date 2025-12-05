/**
 * Utility functions for PDF operations
 */

/**
 * Convert data URL to Uint8Array
 */
export function dataURLToBytes(dataURL: string): Uint8Array {
    const base64 = dataURL.split(',')[1];
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

/**
 * Check if device is mobile based on screen width
 */
export function isMobile(): boolean {
    return window.innerWidth <= 768;
}

/**
 * Check if device is tablet based on screen width
 */
export function isTablet(): boolean {
    return window.innerWidth > 768 && window.innerWidth <= 1024;
}

/**
 * Get device pixel ratio with fallback
 */
export function getDevicePixelRatio(): number {
    return window.devicePixelRatio || 1;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Group items by a key
 */
export function groupBy<T, K extends string | number>(
    items: T[],
    keyFn: (item: T) => K
): Map<K, T[]> {
    const map = new Map<K, T[]>();
    items.forEach(item => {
        const key = keyFn(item);
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)!.push(item);
    });
    return map;
}
