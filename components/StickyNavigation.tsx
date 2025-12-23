import React, { useState } from 'react';

interface StickyNavigationProps {
  currentRank: number;
  totalSongs: number;
  onJump: (rank: number) => void;
  isVisible: boolean;
  className?: string;
}

const StickyNavigation: React.FC<StickyNavigationProps> = ({ 
    currentRank, 
    totalSongs, 
    onJump, 
    isVisible,
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

  // Only render if visible (or use CSS transition for smoother effect)
  if (!isVisible) return null;

  return (
    <div className={`sticky top-16 z-40 bg-[#e60028] shadow-lg border-t border-white/10 transition-all duration-300 ${className} animate-fade-in-down`}>
        <div className="max-w-6xl mx-auto px-2 py-2 flex items-center justify-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
            
            {/* Backward Buttons */}
            <div className="flex gap-1">
                <NavButton delta={-1000} current={currentRank} total={totalSongs} onClick={() => handleJump(-1000)} />
                <NavButton delta={-100} current={currentRank} total={totalSongs} onClick={() => handleJump(-100)} />
                <NavButton delta={-50} current={currentRank} total={totalSongs} onClick={() => handleJump(-50)} />
            </div>

            {/* Input */}
            <form onSubmit={handleInputSubmit} className="flex-shrink-0">
                <input 
                    type="number" 
                    placeholder={currentRank.toString()} 
                    value={targetInput}
                    onChange={handleInputChange}
                    className="w-16 px-2 py-1 text-center rounded text-gray-900 font-bold outline-none border-2 border-transparent focus:border-white bg-white/90 placeholder-gray-500"
                />
            </form>

            {/* Forward Buttons */}
            <div className="flex gap-1">
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
            className={`px-2 py-1 rounded text-xs md:text-sm font-bold transition-colors ${
                disabled 
                    ? 'text-white/30 cursor-not-allowed' 
                    : 'bg-white/10 text-white hover:bg-white/20'
            }`}
        >
            {label}
        </button>
    )
}

export default StickyNavigation;
