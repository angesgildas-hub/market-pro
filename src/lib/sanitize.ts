/**
 * Security Input Sanitization Utilities
 * Protects against cross-site scripting (XSS), HTML injections, and resource exhaustion attacks.
 */

/**
 * Strips dangerous HTML tag signatures and trims excessive whitespace.
 */
export function sanitizeString(value: string, maxLength: number = 500): string {
  if (value === null || value === undefined) return "";
  
  // Cast to string
  let str = String(value);

  // Strip common HTML tag tags and script schemes
  str = str.replace(/<[^>]*>/g, ""); // Remove HTML tags
  str = str.replace(/javascript\s*:/gi, ""); // Remove javascript: protocol
  str = str.replace(/vbscript\s*:/gi, "");   // Remove vbscript: protocol
  str = str.replace(/onload\s*=/gi, "");      // Remove inline event handlers
  str = str.replace(/onerror\s*=/gi, "");     // Remove onerror
  str = str.replace(/onclick\s*=/gi, "");     // Remove onclick
  
  // Trim and clamp to maximum allowed length to prevent denial-of-wallet / payload bloating
  return str.trim().slice(0, maxLength);
}

/**
 * Recursively sanitizes an object's string keys to safe inputs.
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;

  const result = { ...obj } as any;
  for (const key in result) {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      const val = result[key];
      if (typeof val === "string") {
        // Enforce a generic safeguard size limit of 1000 characters for general object fields
        result[key] = sanitizeString(val, 1000);
      } else if (val && typeof val === "object" && !Array.isArray(val)) {
        result[key] = sanitizeObject(val);
      }
    }
  }
  return result;
}
