import { useState } from 'react';
import ClearIcon from '@mui/icons-material/Clear';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (value: string) => void;
  className?: string;
}

export default function SearchBar({ placeholder, onSearch, className }: SearchBarProps) {
  const [searchValue, setSearchValue] = useState('');

  const handleClear = () => {
    setSearchValue('');
    onSearch?.('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearch?.(value);
  };

  return (
    <div className={`relative flex w-full items-center ${className || ''}`}>
      <input
        type="text"
        value={searchValue}
        onChange={handleChange}
        placeholder={placeholder || '검색...'}
        className="w-full rounded-lg border border-neutral-300 px-4 py-2 pr-10 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
      />
      {searchValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 flex items-center justify-center text-neutral-400 hover:text-neutral-600"
          aria-label="Clear search"
        >
          <ClearIcon fontSize="small" />
        </button>
      )}
    </div>
  );
}

