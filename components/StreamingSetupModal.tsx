import React, { memo } from 'react';
import { initiateSpotifyAuth, initiateYouTubeAuth } from '../services/streamingService';

interface StreamingSetupModalProps {
  service: 'spotify' | 'youtube';
  onClose: () => void;
  onAuthenticated: () => void;
}

const StreamingSetupModal: React.FC<StreamingSetupModalProps> = memo(({ service, onClose }) => {
  
  const handleAuthenticate = async () => {
    try {
      if (service === 'spotify') {
        await initiateSpotifyAuth();
      } else {
        await initiateYouTubeAuth();
      }
    } catch (error: any) {
      alert(`Fout bij starten authenticatie: ${error.message}`);
    }
  };

  const info = service === 'spotify' 
    ? { name: 'Spotify', color: '#1DB954' }
    : { name: 'YouTube Music', color: '#FF0000' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col p-8 text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold mb-4">Verbind met {info.name}</h2>
        <p className="text-gray-600 mb-8">
          Om een playlist aan te maken moet je eerst toestemming geven. Klik op de knop hieronder om in te loggen bij {info.name}.
        </p>

        <button
          onClick={handleAuthenticate}
          className="w-full text-white px-6 py-4 rounded-lg font-bold text-lg hover:opacity-90 transition shadow-lg"
          style={{ backgroundColor: info.color }}
        >
          Verbinden met {info.name}
        </button>
      </div>
    </div>
  );
});

StreamingSetupModal.displayName = 'StreamingSetupModal';

export default StreamingSetupModal;
