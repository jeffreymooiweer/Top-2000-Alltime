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

// Helper to get consistent redirect URI (same as in streamingService)
const getRedirectUri = (callbackHash: string, useQueryParam: boolean = false): string => {
  let basePath = import.meta.env.BASE_URL;
  
  if (!basePath || basePath === '/') {
    const pathname = window.location.pathname;
    basePath = pathname.replace(/\/[^/]+\.(html|htm)$/, '/');
    if (basePath === '' || basePath === '/') {
      basePath = '/';
    } else if (!basePath.endsWith('/')) {
      basePath = `${basePath}/`;
    }
  } else if (!basePath.endsWith('/')) {
    basePath = `${basePath}/`;
  }
  
  const origin = window.location.origin.replace(/\/$/, '');
  
  // For Google OAuth (YouTube), use base URL without hash (Google doesn't accept hash in redirect URIs)
  if (useQueryParam) {
    return `${origin}${basePath}`.replace(/\/$/, '') || `${origin}/`;
  }
  
  // For other services (Spotify, Deezer), use hash fragment
  const hash = callbackHash.startsWith('#') ? callbackHash : `#${callbackHash}`;
  return `${origin}${basePath}${hash}`;
};

const StreamingSetupModal: React.FC<StreamingSetupModalProps> = memo(({ service, onClose, onAuthenticated }) => {
  const [clientId, setClientId] = useState('');
  const [redirectUrl] = useState(() => {
    // For YouTube, use query parameter approach (Google doesn't accept hash in redirect URIs)
    return getRedirectUri(`#${service}-callback`, service === 'youtube');
  });
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
          redirectUrl: getRedirectUri('#spotify-callback'),
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
          redirectUrl: getRedirectUri('#deezer-callback'),
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
          redirectUrl: getRedirectUri('#youtube-callback', true),
          instructions: [
            'Ga naar https://console.cloud.google.com/',
            'Maak een nieuw project of selecteer een bestaand project',
            'Ga naar "APIs & Services" > "Library" en zoek "YouTube Data API v3"',
            'Klik op "Enable" om de API in te schakelen',
            'Ga naar "APIs & Services" > "OAuth consent screen"',
            'Configureer de OAuth consent screen (App naam, gebruikersondersteuning email)',
            'Voeg jezelf toe als test gebruiker als de app in "Testing" mode staat',
            'Ga naar "APIs & Services" > "Credentials"',
            'Klik op "Create Credentials" > "OAuth client ID"',
            'Selecteer "Web application"',
            'Voeg de Redirect URI toe (zie hieronder) - ZONDER hashtag',
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
                {service === 'youtube' && (
                  <>
                    <span className="block mt-1 font-bold text-yellow-900">
                      ⚠️ Belangrijk: Gebruik deze URL ZONDER hashtag (#) in Google Console!
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* OAuth Consent Screen Warning for YouTube */}
            {service === 'youtube' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 font-bold mb-2">⚠️ Belangrijk: OAuth Consent Screen</p>
                <p className="text-xs text-blue-700 mb-2">
                  Voordat je kunt verbinden, moet je de OAuth consent screen configureren:
                </p>
                <ol className="text-xs text-blue-700 list-decimal list-inside space-y-1 mb-2">
                  <li>Ga naar <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer" className="text-blue-900 underline font-bold">OAuth consent screen</a></li>
                  <li>Vul minimaal de App naam en gebruikersondersteuning email in</li>
                  <li>Als de app in "Testing" mode staat, voeg jezelf toe als test gebruiker</li>
                  <li>Zorg dat YouTube Data API v3 is ingeschakeld in de API Library</li>
                </ol>
                <p className="text-xs text-blue-700 font-bold">
                  Zonder deze configuratie krijg je een "access_denied" fout!
                </p>
              </div>
            )}

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
