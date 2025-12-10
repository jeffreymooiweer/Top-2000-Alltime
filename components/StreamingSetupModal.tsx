import React, { useState, useEffect, memo } from 'react';
import {
  getSpotifyConfig,
  saveSpotifyConfig,
  getDeezerConfig,
  saveDeezerConfig,
  getYouTubeConfig,
  saveYouTubeConfig,
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
  const [clientId, setClientId] = useState('');
  const [redirectUrl] = useState(`${window.location.origin}${window.location.pathname}#${service}-callback`);
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

    // Load existing config
    let config;
    if (service === 'spotify') {
      config = getSpotifyConfig();
    } else if (service === 'deezer') {
      config = getDeezerConfig();
    } else {
      config = getYouTubeConfig();
    }

    if (config?.clientId) {
      setClientId(config.clientId);
    }
  }, [service]);

  const handleAuthenticate = async () => {
    if (!clientId.trim()) {
      alert('Voer een Client ID in');
      return;
    }

    // Save client ID first
    if (service === 'spotify') {
      saveSpotifyConfig({ clientId: clientId.trim() });
    } else if (service === 'deezer') {
      saveDeezerConfig({ clientId: clientId.trim() });
    } else {
      saveYouTubeConfig({ clientId: clientId.trim() });
    }

    // Then initiate authentication
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
          developerUrl: 'https://developer.spotify.com/dashboard',
          redirectUrl: `${window.location.origin}${window.location.pathname}#spotify-callback`,
          instructions: [
            'Ga naar https://developer.spotify.com/dashboard',
            'Log in met je Spotify account',
            'Klik op "Create app"',
            'Vul de app details in (naam, beschrijving)',
            'Kopieer je Client ID en plak deze hieronder',
          ],
        };
      case 'deezer':
        return {
          name: 'Deezer',
          developerUrl: 'https://developers.deezer.com/myapps',
          redirectUrl: `${window.location.origin}${window.location.pathname}#deezer-callback`,
          instructions: [
            'Ga naar https://developers.deezer.com/myapps',
            'Log in met je Deezer account',
            'Klik op "Create a new Application"',
            'Vul de app details in',
            'Kopieer je Application ID en plak deze hieronder',
          ],
        };
      case 'youtube':
        return {
          name: 'YouTube Music',
          developerUrl: 'https://console.cloud.google.com/apis/credentials',
          redirectUrl: `${window.location.origin}${window.location.pathname}#youtube-callback`,
          instructions: [
            'Ga naar https://console.cloud.google.com/',
            'Maak een nieuw project of selecteer een bestaand project',
            'Ga naar "APIs & Services" > "Credentials"',
            'Klik op "Create Credentials" > "OAuth client ID"',
            'Selecteer "Web application"',
            'Zorg dat YouTube Data API v3 is ingeschakeld',
            'Kopieer je Client ID en plak deze hieronder',
          ],
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
      <div className="relative bg-white w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
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

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Instructions Section */}
            <div>
              <h3 className="text-lg font-bold mb-4">Stap-voor-stap instructies:</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                {info.instructions.map((instruction, idx) => {
                  // Check if this instruction contains the developer URL
                  if (instruction.includes('developer.spotify.com') || instruction.includes('developers.deezer.com') || instruction.includes('console.cloud.google.com')) {
                    return (
                      <li key={idx} className="mb-2">
                        Ga naar{' '}
                        <a
                          href={info.developerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#d00018] hover:underline font-bold"
                        >
                          {info.developerUrl}
                        </a>
                      </li>
                    );
                  }
                  // Skip the redirect URL instruction since we show it separately
                  if (instruction.startsWith('http') && instruction.includes('callback')) {
                    return null;
                  }
                  return (
                    <li key={idx} className="mb-2">
                      {instruction}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Redirect URI Section */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 font-bold mb-1">Redirect URI:</p>
              <p className="text-xs text-yellow-700 font-mono break-all bg-yellow-100 p-2 rounded">
                {redirectUrl}
              </p>
              <p className="text-xs text-yellow-700 mt-2">
                Kopieer deze URL en voeg deze toe aan je {service === 'deezer' ? 'Application' : 'OAuth App'} settings.
              </p>
            </div>

            {/* Input Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {service === 'deezer' ? 'Application ID' : 'Client ID'}
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder={service === 'deezer' ? 'Je Deezer Application ID' : `Je ${info.name} Client ID`}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d00018] focus:border-transparent"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleAuthenticate}
                disabled={!clientId.trim()}
                className="w-full bg-[#d00018] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#b00014] transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Koppel {info.name} Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

StreamingSetupModal.displayName = 'StreamingSetupModal';

export default StreamingSetupModal;
