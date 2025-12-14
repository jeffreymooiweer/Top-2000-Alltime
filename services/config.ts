export const API_BASE = 'https://api.top2000allertijden.nl';

export const normalizeString = (input: string): string => {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/['’‘`´]/g, "") // Remove apostrophes
    .trim()
    .replace(/\s+/g, " "); // Reduce double spaces
};
