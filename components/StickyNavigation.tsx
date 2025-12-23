import React, { useState } from 'react';

interface StickyNavigationProps {
  currentRank: number;
  totalSongs: number;
  onJump: (rank: number) => void;
  className?: string;
}

const StickyNavigation: React.FC<StickyNavigationProps> = ({ 
    currentRank, 
    totalSongs, 
    onJump, 
    className = ''
}) => {
  const [targetInput, setTargetInput] = useState('');

  const handleJump = (delta: number) => {
      onJump(currentRank + delta);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setTargetInput(e.target.value);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const rank = parseInt(targetInput);
      if (!isNaN(rank)) {
          onJump(rank);
          setTargetInput('');
      }
  };

  return (
    <div className={`sticky top-16 z-40 bg-[#9a1a1a]/90 backdrop-blur-md shadow-lg border-y border-white/10 transition-all duration-300 py-2 mb-4 ${className}`}>
        <div className="max-w-6xl mx-auto px-2 flex items-center justify-start md:justify-center gap-1 md:gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
            
            {/* Backward Buttons */}
            <div className="flex gap-1 md:gap-2">
                <NavButton delta={-1000} current={currentRank} total={totalSongs} onClick={() => handleJump(-1000)} />
                <NavButton delta={-100} current={currentRank} total={totalSongs} onClick={() => handleJump(-100)} />
                <NavButton delta={-50} current={currentRank} total={totalSongs} onClick={() => handleJump(-50)} />
            </div>

            {/* Input */}
            <form onSubmit={handleInputSubmit} className="flex-shrink-0 mx-1 md:mx-2">
                <input 
                    type="number" 
                    placeholder={currentRank.toString()} 
                    value={targetInput}
                    onChange={handleInputChange}
                    className="w-16 md:w-20 px-1 md:px-2 py-1.5 text-center rounded text-gray-900 font-bold outline-none border-2 border-transparent focus:border-white bg-white/90 placeholder-gray-500"
                />
            </form>

            {/* Forward Buttons */}
            <div className="flex gap-1 md:gap-2">
                <NavButton delta={50} current={currentRank} total={totalSongs} onClick={() => handleJump(50)} />
                <NavButton delta={100} current={currentRank} total={totalSongs} onClick={() => handleJump(100)} />
                <NavButton delta={1000} current={currentRank} total={totalSongs} onClick={() => handleJump(1000)} />
            </div>
        </div>
    </div>
  );
};

const NavButton = ({ delta, current, total, onClick }: { delta: number, current: number, total: number, onClick: () => void }) => {
    const target = current + delta;
    const disabled = target < 1 || target > total;
    const label = delta > 0 ? `+${delta}` : `${delta}`;

    return (
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`px-2 md:px-3 py-1.5 rounded font-bold text-xs md:text-sm uppercase tracking-wider border transition-all ${
                disabled 
                    ? 'border-gray-500/50 text-gray-400 cursor-not-allowed bg-black/10' 
                    : 'bg-transparent text-white border-white hover:bg-white/10'
            }`}
        >
            {label}
        </button>
    )
}

export default StickyNavigation;
