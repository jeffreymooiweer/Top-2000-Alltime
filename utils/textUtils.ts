/**
 * Decodes HTML entities in a string.
 * Handles named entities (e.g., &amp;, &quot;) and numeric entities (e.g., &#39;, &#x27;).
 */
export const decodeHtmlEntities = (text: string): string => {
  if (!text) return text;
  
  // Use DOMParser for robust decoding in browser environment
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    return doc.documentElement.textContent || text;
  }

  // Fallback for non-browser environments (though this app is client-side)
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(dec));
};

/**
 * Clean artist/title strings that might have issues
 */
export const cleanSongText = (text: string): string => {
    if (!text) return text;
    
    // First decode entities
    let cleaned = decodeHtmlEntities(text);
    
    // Fix specific double encoding issues seen in reports if any
    // "Beatles , The The..." -> This looks like a data quality issue from source
    // But we can at least ensure characters are correct.
    
    return cleaned;
};
