interface HamburgerMenuProps {
  isOpen: boolean;
  onClick: () => void;
}

export default function HamburgerMenu({ isOpen, onClick }: HamburgerMenuProps) {
  return (
    <button
      onClick={onClick}
      className="p-3 sm:p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 hover:scale-110 active:scale-95 min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center"
      aria-label="Toggle menu"
      aria-expanded={isOpen}
    >
      <div className="w-6 h-6 sm:w-6 sm:h-6 flex flex-col justify-center items-center">
        <span
          className={`block h-0.5 w-6 bg-current transform transition-all duration-300 ${
            isOpen ? 'rotate-45 translate-y-1.5' : '-translate-y-0.5'
          }`}
        />
        <span
          className={`block h-0.5 w-6 bg-current transition-all duration-300 ${
            isOpen ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <span
          className={`block h-0.5 w-6 bg-current transform transition-all duration-300 ${
            isOpen ? '-rotate-45 -translate-y-1.5' : 'translate-y-0.5'
          }`}
        />
      </div>
    </button>
  );
}

