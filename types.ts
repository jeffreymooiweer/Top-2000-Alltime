
export interface RankingHistory {
  [year: string]: number | null; // null represents not in list (x)
}

export interface SongData {
  id: string;
  artist: string;
  title: string;
  releaseYear: number;
  rankings: RankingHistory;
  // Dynamic fields fetched from iTunes/Calculated
  totalScore?: number;
  coverUrl?: string | null; // null = tried to fetch but failed/not found. undefined = not yet fetched.
  previewUrl?: string | null;
  allTimeRank?: number;
  previousAllTimeRank?: number; // Calculated based on score excluding the latest year
}

export interface ChartDataPoint {
  year: string;
  rank: number | null;
}

export interface ITunesResponse {
  results: {
    artworkUrl100: string;
    previewUrl: string;
    artistName: string;
    trackName: string;
  }[];
}
