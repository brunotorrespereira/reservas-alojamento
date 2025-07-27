"use client";
import { useState, useRef, useEffect } from "react";

interface UserAvatarMenuProps {
  nome: string;
  email: string;
  onLogout: () => void;
  onShowMinhasReservas: () => void;
}

export default function UserAvatarMenu({ nome, email, onLogout, onShowMinhasReservas }: UserAvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fechar menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Gerar iniciais
  const getInitials = (nome: string) => {
    if (!nome) return "?";
    const partes = nome.trim().split(" ");
    if (partes.length === 1) return partes[0][0].toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="w-11 h-11 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-lg shadow-lg hover:bg-cyan-700 transition-colors focus:outline-none"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir menu do usuário"
      >
        {getInitials(nome)}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-black border border-white/20 rounded-xl shadow-xl z-50 p-4 animate-fade-in">
          <div className="flex flex-col items-center mb-4">
            <div className="w-14 h-14 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-2xl mb-2">
              {getInitials(nome)}
            </div>
            <div className="text-white font-semibold text-lg text-center">{nome}</div>
            <div className="text-gray-300 text-sm text-center break-all">{email}</div>
          </div>
          <button
            className="w-full py-2 mb-2 rounded-lg bg-white/10 text-white hover:bg-cyan-700 transition-colors font-medium"
            onClick={() => { setOpen(false); onShowMinhasReservas(); }}
          >
            Minhas reservas
          </button>
          <button
            className="w-full py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
            onClick={onLogout}
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
} 