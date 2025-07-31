"use client";
import React from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Reserva {
  id: string;
  nome: string;
  email: string;
  genero: "masculino" | "feminino" | "homem" | "mulher";
  semana: string;
  status: "ativa" | "cancelada";
  criador?: string;
}

interface MinhasReservasModalProps {
  open: boolean;
  onClose: () => void;
  reservas: Reserva[];
  userEmail: string;
}

export default function MinhasReservasModal({ open, onClose, reservas, userEmail }: MinhasReservasModalProps) {
  if (!open) return null;
  const minhasReservas = reservas.filter(r => r.criador && r.criador.toLowerCase() === userEmail.toLowerCase())
    .sort((a, b) => {
      // Ordenar por data (mais recente primeiro)
      return new Date(b.semana).getTime() - new Date(a.semana).getTime();
    });

  // Função para converter gênero para exibição
  const converterGeneroParaExibicao = (genero: string) => {
    if (genero === "homem") return "Masculino";
    if (genero === "mulher") return "Feminino";
    if (genero === "masculino") return "Masculino";
    if (genero === "feminino") return "Feminino";
    return genero;
  };

  const exportarPDF = () => {
    if (minhasReservas.length === 0) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
          doc.text("Minhas Reservas de Alojamento", 20, 20);
    doc.setFontSize(12);
    doc.text(`Data de geração: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30);
    const tableData = minhasReservas.map(reserva => [
      reserva.nome,
      converterGeneroParaExibicao(reserva.genero),
      reserva.semana,
      reserva.status
    ]);
    autoTable(doc, {
      head: [["Nome", "Gênero", "Semana", "Status"]],
      body: tableData,
      startY: 40,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 10 },
    });
    const dataAtual = new Date();
    const dataFormatada = dataAtual.toISOString().slice(0, 10);
    const horaFormatada = dataAtual.toTimeString().slice(0, 8).replace(/:/g, '-');
    const nomeArquivo = `minhas_reservas_${dataFormatada}_${horaFormatada}.pdf`;
    doc.save(nomeArquivo);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-2xl border border-white/20 relative">
        <div className="flex justify-between items-center mb-6">
          <button
            className="text-white bg-green-600 hover:bg-green-700 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-colors"
            onClick={exportarPDF}
            disabled={minhasReservas.length === 0}
          >
            Exportar PDF
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-white">Minhas Reservas</h2>
          <button
            className="text-white text-xl md:text-2xl hover:text-red-400"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        {minhasReservas.length === 0 ? (
          <div className="text-center text-gray-300">Você não possui reservas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-white min-w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="py-2 px-2 md:px-3 text-left text-xs md:text-sm">Nome</th>
                  <th className="py-2 px-1 md:px-3 text-center text-xs md:text-sm">Gênero</th>
                  <th className="py-2 px-1 md:px-3 text-center text-xs md:text-sm">Semana</th>
                  <th className="py-2 px-1 md:px-3 text-center text-xs md:text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {minhasReservas.map((reserva) => (
                  <tr key={reserva.id} className="border-b border-white/10">
                    <td className="py-2 px-2 md:px-3 text-left text-xs md:text-sm truncate max-w-[100px] md:max-w-none">
                      <span title={reserva.nome}>{reserva.nome}</span>
                    </td>
                    <td className="py-2 px-1 md:px-3 text-center text-xs md:text-sm">
                      {converterGeneroParaExibicao(reserva.genero)}
                    </td>
                    <td className="py-2 px-1 md:px-3 text-center text-xs md:text-sm">
                      {reserva.semana}
                    </td>
                    <td className="py-2 px-1 md:px-3 text-center text-xs md:text-sm">
                      {reserva.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 