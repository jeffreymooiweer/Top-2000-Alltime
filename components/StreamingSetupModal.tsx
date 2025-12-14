import React, { useState, useEffect, memo } from 'react';
import {
  isSpotifyAuthenticated,
  isDeezerAuthenticated,
  isYouTubeAuthenticated,
  initiateSpotifyAuth,
  initiateDeezerAuth,
  initiateYouTubeAuth,
} from '../services/streamingService';

interface StreamingSetupModalProps {
  service: 'spotify' | 'deezer' | 'youtube';
  onClose: () => void;
  onAuthenticated: () => void;
}

const StreamingSetupModal: React.FC<StreamingSetupModalProps> = memo(({ service, onClose, onAuthenticated }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    if (service === 'spotify' && isSpotifyAuthenticated()) {
      setIsAuthenticated(true);
    } else if (service === 'deezer' && isDeezerAuthenticated()) {
      setIsAuthenticated(true);
    } else if (service === 'youtube' && isYouTubeAuthenticated()) {
      setIsAuthenticated(true);
    }
  }, [service]);

  const handleAuthenticate = async () => {
    try {
      if (service === 'spotify') {
        await initiateSpotifyAuth();
      } else if (service === 'deezer') {
        initiateDeezerAuth();
      } else {
        await initiateYouTubeAuth();
      }
    } catch (error: any) {
      alert(`Fout bij starten authenticatie: ${error.message}`);
    }
  };

  const getServiceInfo = () => {
    switch (service) {
      case 'spotify':
        return {
          name: 'Spotify',
          description: 'Verbind met je Spotify account om playlists aan te maken.'
        };
      case 'deezer':
        return {
          name: 'Deezer',
          description: 'Verbind met je Deezer account om playlists aan te maken.'
        };
      case 'youtube':
        return {
          name: 'YouTube Music',
          description: 'Verbind met je Google account om playlists aan te maken in YouTube Music.'
        };
    }
  };

  const info = getServiceInfo();

  if (isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
        <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold mb-4">{info.name} is gekoppeld</h2>
          <p className="text-gray-600 mb-6">Je account is succesvol gekoppeld. Je kunt nu playlists aanmaken.</p>
          <button
            onClick={() => {
              onAuthenticated();
              onClose();
            }}
            className="w-full bg-[#d00018] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#b00014] transition"
          >
            Doorgaan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{info.name} Setup</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 text-center">
            <p className="text-gray-600 mb-8 text-lg">
                {info.description}
            </p>

            <button
                onClick={handleAuthenticate}
                className="w-full bg-[#d00018] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#b00014] transition transform hover:scale-105 shadow-lg"
            >
                Verbind met {info.name}
            </button>
            
            <p className="mt-4 text-xs text-gray-400">
                Je wordt doorgestuurd naar de inlogpagina van {info.name}.
            </p>
        </div>
      </div>
    </div>
  );
});

StreamingSetupModal.displayName = 'StreamingSetupModal';

export default StreamingSetupModal;
