import React, { useState } from 'react';
import { 
  getPlaylistIdFromUrl, 
  fetchSpotifyPlaylist, 
  fetchYouTubePlaylist, 
  isSpotifyAuthenticated, 
  isYouTubeAuthenticated,
  initiateSpotifyAuth,
  initiateYouTubeAuth
} from '../services/streamingService';
import { SongData } from '../types';

interface ImportPlaylistModalProps {
  onClose: () => void;
  top2000Songs: SongData[];
}

const normalize = (str: string) => {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const ImportPlaylistModal: React.FC<ImportPlaylistModalProps> = ({ onClose, top2000Songs }) => {
  const [url, setUrl] = useState(() => localStorage.getItem('pending_import_url') || '');
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'importing' | 'complete' | 'error'>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [importedSongs, setImportedSongs] = useState<{ title: string, artist: string }[]>([]);
  const [matchedSongs, setMatchedSongs] = useState<SongData[]>([]);

  const handleImport = async () => {
    setStatus('analyzing');
    setError('');
    
    const info = getPlaylistIdFromUrl(url);
    if (!info) {
      setStatus('error');
      setError('Ongeldige URL. Gebruik een Spotify of YouTube playlist URL.');
      return;
    }

    // Check Auth
    if (info.service === 'spotify' && !isSpotifyAuthenticated()) {
      // Save URL to recover state? For now just redirect
      localStorage.setItem('pending_import_url', url);
      initiateSpotifyAuth();
      return;
    }
    if (info.service === 'youtube' && !isYouTubeAuthenticated()) {
      localStorage.setItem('pending_import_url', url);
      initiateYouTubeAuth();
      return;
    }

    setStatus('importing');
    try {
      let tracks: { title: string, artist: string }[] = [];
      if (info.service === 'spotify') {
        tracks = await fetchSpotifyPlaylist(info.id, (count) => setProgress(count));
      } else {
        tracks = await fetchYouTubePlaylist(info.id, (count) => setProgress(count));
      }
      
      setImportedSongs(tracks);
      
      // Match with Top 2000
      const matches: SongData[] = [];
      
      // Create a map for faster lookups? Array.find is O(N), total O(M*N). N=2000-4000. M=Playlist size (maybe 500). 
      // 2M is fine for client side.
      
      tracks.forEach(track => {
         // Try exact title match first
         const trackTitleNorm = normalize(track.title);
         const trackArtistNorm = normalize(track.artist);
         
         const match = top2000Songs.find(s => {
           const sTitleNorm = normalize(s.title);
           const sArtistNorm = normalize(s.artist);
           
           // Check Title + Artist
           if (sTitleNorm === trackTitleNorm && sArtistNorm.includes(trackArtistNorm)) return true;
           if (sTitleNorm === trackTitleNorm && trackArtistNorm.includes(sArtistNorm)) return true;
           
           // If artist match is good, check title fuzzy
           if (sArtistNorm.includes(trackArtistNorm) || trackArtistNorm.includes(sArtistNorm)) {
             if (sTitleNorm.includes(trackTitleNorm) || trackTitleNorm.includes(sTitleNorm)) return true;
           }
           
           return false;
         });
         
         if (match) {
           // Avoid duplicates in result if song already added?
           if (!matches.some(m => m.id === match.id)) {
             matches.push(match);
           }
         }
      });
      
      setMatchedSongs(matches.sort((a,b) => (a.allTimeRank || 9999) - (b.allTimeRank || 9999)));
      setStatus('complete');
      localStorage.removeItem('pending_import_url');
      
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setError(e.message || 'Onbekende fout tijdens importeren.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col p-6 animate-scale-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Playlist Importeren</h2>
        
        {status === 'idle' || status === 'error' ? (
           <>
             <p className="text-gray-600 mb-4">
               Wil je weten hoeveel nummers van je eigen playlist in de Top 2000 Allertijden staan? 
               Plak hieronder de link van je Spotify of YouTube playlist.
             </p>
             <input 
               type="text" 
               className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-[#d00018] focus:border-transparent outline-none transition"
               placeholder="https://open.spotify.com/playlist/..."
               value={url}
               onChange={(e) => setUrl(e.target.value)}
             />
             {status === 'error' && (
               <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm font-medium">
                 {error}
               </div>
             )}
             <button 
               onClick={handleImport} 
               disabled={!url}
               className="bg-[#d00018] text-white font-bold py-3 px-6 rounded-lg hover:bg-[#b00014] transition w-full disabled:opacity-50 disabled:cursor-not-allowed"
             >
               Analyseren
             </button>
           </>
        ) : status === 'importing' || status === 'analyzing' ? (
           <div className="text-center py-10 flex flex-col items-center justify-center h-64">
              <div className="w-16 h-16 border-4 border-[#d00018] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-bold text-gray-900 text-lg">Bezig met ophalen...</p>
              <p className="text-gray-500 mt-2">{progress} nummers gevonden</p>
           </div>
        ) : (
           <div className="flex-1 overflow-hidden flex flex-col h-[60vh]">
              <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="font-bold text-lg text-gray-900 mb-1">Resultaat</p>
                <p className="text-gray-700">
                   Van de <strong>{importedSongs.length}</strong> nummers staan er <strong>{matchedSongs.length}</strong> in de Top 2000 Allertijden.
                </p>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                 {matchedSongs.length > 0 ? (
                    matchedSongs.map(song => (
                       <div key={song.id} className="bg-white border border-gray-100 p-3 mb-2 rounded shadow-sm flex justify-between items-center hover:border-gray-300 transition">
                          <div className="flex-1 min-w-0 pr-4">
                             <div className="font-bold text-gray-900 truncate">{song.title}</div>
                             <div className="text-sm text-gray-600 truncate">{song.artist}</div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Rank</span>
                            <span className="font-bold text-[#d00018] text-xl">#{song.allTimeRank}</span>
                          </div>
                       </div>
                    ))
                 ) : (
                    <div className="text-center py-20 text-gray-400">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Geen overeenkomsten gevonden in de lijst.
                    </div>
                 )}
              </div>
              
              <button 
                onClick={() => setStatus('idle')}
                className="mt-4 w-full border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-50 transition"
              >
                Nog een playlist controleren
              </button>
           </div>
        )}
      </div>
    </div>
  );
};

export default ImportPlaylistModal;
