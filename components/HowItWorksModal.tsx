import React from 'react';

interface HowItWorksModalProps {
  onClose: () => void;
}

const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Hoe werkt het?</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
              aria-label="Sluiten"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 text-gray-700 leading-relaxed space-y-4">
          <p>
            De <strong>Top 2000 Allertijden Lijst</strong> is een ranglijst die wordt berekend op basis van alle historische noteringen in de Radio 2 Top 2000 sinds de eerste editie in 1999.
          </p>
          
          <h3 className="text-lg font-bold text-[#d00018] mt-6">Puntentelling</h3>
          <p>
            De ranglijst wordt samengesteld door punten toe te kennen aan elk nummer voor elk jaar dat het in de lijst heeft gestaan. De puntentelling werkt als volgt:
          </p>
          <ul className="list-disc list-inside bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-2">
            <li>De nummer <strong>1</strong> krijgt <strong>2000</strong> punten.</li>
            <li>De nummer <strong>2000</strong> krijgt <strong>1</strong> punt.</li>
            <li>De formule is: <code>Punten = 2001 - Positie</code>.</li>
          </ul>
          <p>
            Door deze punten over alle jaren (1999 t/m heden) bij elkaar op te tellen, ontstaat er een totaalscore. De nummers met de meeste punten staan bovenaan in deze Allertijden lijst.
          </p>

          <h3 className="text-lg font-bold text-[#d00018] mt-6">Bronvermelding</h3>
          <p>
            De data die gebruikt wordt voor deze berekeningen is afkomstig van <a href="https://nl.wikipedia.org/wiki/Lijst_van_Radio_2-Top_2000%27s" target="_blank" rel="noopener noreferrer" className="text-[#d00018] hover:underline font-bold">Wikipedia</a>. Deze applicatie haalt live de meest recente gegevens op om de lijst samen te stellen.
          </p>
          
          <p className="text-sm text-gray-500 mt-6 italic">
            Disclaimer: Dit is een onofficieel hobby-project en is niet gelieerd aan NPO Radio 2.
          </p>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-[#d00018] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#b00014] transition shadow-lg"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksModal;
