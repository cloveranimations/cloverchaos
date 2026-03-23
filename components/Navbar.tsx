'use client';

import { useState } from 'react';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-purple-700 text-white p-4 flex justify-between items-center">
      <a href="/" className="text-2xl font-bold">
        🍀 Clover Chaos
      </a>
      <button className="md:hidden" onClick={() => setOpen(!open)}>☰</button>
      <div className={`md:flex gap-4 ${open ? 'block' : 'hidden'}`}>
        <a href="https://cloverchaos.com" target="_blank" className="hover:text-yellow-300">Official Show</a>
        <a href="https://youtube.com" target="_blank" className="hover:text-yellow-300">Episodes</a>
        <a href="https://twitter.com/cloverchaos" target="_blank" className="hover:text-yellow-300">Social</a>
      </div>
    </nav>
  );
}