
export const getLyrics = async (artist: string, title: string): Promise<string> => {
  try {
    // Clean up strings to increase API hit rate
    // Remove content in brackets like (Live), (2000 Remaster), etc.
    // APIs often fail if the query is too specific
    const cleanArtist = artist.split('(')[0].split('-')[0].trim();
    const cleanTitle = title.split('(')[0].split('-')[0].trim();

    const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`);
    
    if (!response.ok) {
        if(response.status === 404) return "Helaas, de songtekst voor dit nummer is niet gevonden in de database.";
        throw new Error("API Error");
    }

    const data = await response.json();
    
    if (!data.lyrics) {
        return "Geen songtekst gevonden.";
    }

    return data.lyrics;
  } catch (error) {
    console.warn("Lyrics fetch error:", error);
    return "Kon de songtekst niet laden. Probeer het later opnieuw.";
  }
};
