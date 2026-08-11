import { useEffect, useState } from 'react';

function getInitialTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || saved === 'light') return saved;
  // Respect the system preference the first time, then remember the choice
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <button
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-indigo-200 hover:bg-indigo-900"
      title="Toggle dark/light theme"
    >
      <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      <span className="text-base leading-none">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  );
}