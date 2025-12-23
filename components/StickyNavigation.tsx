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
    <div className={`sticky top-16 z-40 bg-black/60 backdrop-blur-xl shadow-lg border-y border-white/10 transition-all duration-300 py-2 mb-4 ${className}`}>
        <div className="max-w-6xl mx-auto px-2 flex items-center justify-between gap-1 md:gap-2">
            
            {/* Backward Buttons */}
            <div className="flex flex-[3] gap-1 md:gap-2 min-w-0">
                <NavButton delta={-1000} current={currentRank} total={totalSongs} onClick={() => handleJump(-1000)} />
                <NavButton delta={-100} current={currentRank} total={totalSongs} onClick={() => handleJump(-100)} />
                <NavButton delta={-50} current={currentRank} total={totalSongs} onClick={() => handleJump(-50)} />
            </div>

            {/* Input */}
            <form onSubmit={handleInputSubmit} className="flex-[1] min-w-0 mx-1">
                <input 
                    type="number" 
                    placeholder={currentRank.toString()} 
                    value={targetInput}
                    onChange={handleInputChange}
                    className="w-full px-0 py-1.5 text-center rounded text-gray-900 font-bold outline-none border-2 border-transparent focus:border-white bg-white/90 placeholder-gray-500 text-xs md:text-sm"
                />
            </form>

            {/* Forward Buttons */}
            <div className="flex flex-[3] gap-1 md:gap-2 min-w-0">
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
            className={`flex-1 min-w-0 px-1 py-1.5 rounded font-bold text-[10px] md:text-sm uppercase tracking-tight md:tracking-wider border transition-all whitespace-nowrap overflow-hidden text-ellipsis ${
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
