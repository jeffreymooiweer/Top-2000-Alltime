import { SongData, RankingHistory } from '../types';

const WIKI_API_URL = "https://nl.wikipedia.org/w/api.php";
// Using the encoded title ensures we hit the right page
const PAGE_TITLE = "Lijst_van_Radio_2-Top_2000's";

export const scrapeWikipediaData = async (): Promise<SongData[]> => {
  try {
    console.log("Starting Wikipedia Scrape...");
    
    const params = new URLSearchParams({
      action: 'parse',
      page: PAGE_TITLE,
      prop: 'text',
      format: 'json',
      origin: '*'
    });

    const response = await fetch(`${WIKI_API_URL}?${params.toString()}`);
    const data = await response.json();
    
    if (!data.parse || !data.parse.text) {
      throw new Error("Invalid Wikipedia response structure");
    }

    const htmlContent = data.parse.text['*'];
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // Strategy: Find the table with the MOST columns (likely the main data table)
    // and check if it contains year-like headers.
    const tables = Array.from(doc.querySelectorAll('table'));
    let targetTable: HTMLTableElement | null = null;
    let maxCols = 0;

    for (const table of tables) {
        // Count max columns in first few rows
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 5) continue; // Too short to be the list

        let currentMax = 0;
        // Check first 3 rows for max cells (headers can be complex)
        for(let r=0; r<Math.min(3, rows.length); r++) {
             currentMax = Math.max(currentMax, rows[r].querySelectorAll('th, td').length);
        }

        // The Top 2000 table has Artist, Title, Release, + 25 years (1999-2023) = ~28 columns
        if (currentMax > 20 && currentMax > maxCols) {
            maxCols = currentMax;
            targetTable = table;
        }
    }

    if (!targetTable) {
        console.error("No suitable table found");
        return [];
    }

    console.log(`Found target table with ${maxCols} columns.`);

    // Map columns
    const rows = Array.from(targetTable.querySelectorAll('tr'));
    
    let yearColumnMap: { [colIndex: number]: string } = {};
    let artistIdx = -1;
    let titleIdx = -1;
    let releaseYearIdx = -1;
    let headerRowIndex = 0;

    // Scan for headers
    for(let r=0; r < Math.min(rows.length, 5); r++) {
        const cells = Array.from(rows[r].querySelectorAll('th'));
        cells.forEach((cell, idx) => {
            // Aggressive cleaning: remove soft hyphens, nbsp, invisible chars
            const text = (cell.textContent || '').toLowerCase().replace(/[\u00AD\u00A0\u200B]/g, ' ').trim();
            
            if (text.includes('artiest')) artistIdx = idx;
            if (text.includes('titel') || text === 'nummer') titleIdx = idx;
            
            // Check for specific release year column (usually just "jaar")
            // We check length < 6 to avoid confusing it with long sentences, though unlikely in header
            if (text === 'jaar' && !text.match(/\d/)) { 
                releaseYearIdx = idx;
            }
            
            // Year Detection: Check for 1999..2024 or '99..'24 for Rankings
            // Wikipedia headers can be "1999", "'99", "’99", "2000"
            const yearMatch = text.match(/(?:'|’|^)?(\d{2,4})\b/);
            if (yearMatch) {
                let y = parseInt(yearMatch[1]);
                // Convert 2 digit to 4 digit
                if (y < 100) {
                    y = y >= 90 ? 1900 + y : 2000 + y;
                }
                
                // Validate reasonable range
                if (y >= 1999 && y <= 2030) {
                    yearColumnMap[idx] = y.toString();
                }
            }
        });

        if (Object.keys(yearColumnMap).length > 5) {
            headerRowIndex = r;
            break;
        }
    }

    // Fallbacks if detection failed (Standard Wikipedia layout)
    if (artistIdx === -1) artistIdx = 2; 
    if (titleIdx === -1) titleIdx = 1;

    console.log(`Mapped indices: Artist=${artistIdx}, Title=${titleIdx}, ReleaseYear=${releaseYearIdx}, RankingYears=${Object.keys(yearColumnMap).length}`);

    const songs: SongData[] = [];

    // Process Rows
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = Array.from(row.querySelectorAll('td'));
        
        // Skip rows that don't have enough cells
        if (cells.length < Math.max(artistIdx, titleIdx)) continue;

        const cleanCell = (idx: number) => {
            if (!cells[idx]) return '';
            // Clone to safely remove garbage tags
            const el = cells[idx].cloneNode(true) as HTMLElement;
            el.querySelectorAll('sup, .reference, .sortkey, style, script').forEach(n => n.remove());
            // Replace NBSP with normal space, trim
            return (el.textContent || '').replace(/[\u00A0\u200B]/g, ' ').trim();
        };

        const artist = cleanCell(artistIdx);
        const title = cleanCell(titleIdx);

        if (!artist || !title) continue;

        // Parse Release Year
        let releaseYear = 0;
        if (releaseYearIdx !== -1) {
            const val = cleanCell(releaseYearIdx);
            const y = parseInt(val);
            if (!isNaN(y) && y > 1900 && y < 2100) {
                releaseYear = y;
            }
        }

        const rankings: RankingHistory = {};
        let hasData = false;

        Object.keys(yearColumnMap).forEach((colIdxStr) => {
            const colIdx = parseInt(colIdxStr);
            const year = yearColumnMap[colIdx];
            const val = cleanCell(colIdx);
            
            // Remove dots (1.000 -> 1000) and check if number
            const num = parseInt(val.replace(/\./g, ''));
            if (!isNaN(num) && num > 0) {
                rankings[year] = num;
                hasData = true;
            } else {
                rankings[year] = null;
            }
        });

        // Only add if we actually found ranking data (filters out spacer rows)
        if (hasData) {
            const id = `${artist}-${title}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
            songs.push({
                id,
                artist,
                title,
                releaseYear, 
                rankings
            });
        }
    }

    return songs;

  } catch (error) {
    console.error("Scraping fatal error:", error);
    return [];
  }
};