"use client";
import React from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Reserva {
  id: string;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  auditorio: string;
  solicitante: string;
  evento: string;
  observacoes: string;
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
  const minhasReservas = reservas.filter(r => r.criador && r.criador.toLowerCase() === userEmail.toLowerCase());

  // Função para exportar PDF das reservas do usuário
  const exportarPDF = () => {
    if (minhasReservas.length === 0) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Minhas Reservas de Auditório", 20, 20);
    doc.setFontSize(12);
    doc.text(`Data de geração: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30);
    const tableData = minhasReservas.map(reserva => [
      reserva.data,
      `${reserva.horarioInicio} - ${reserva.horarioFim}`,
      reserva.auditorio,
      reserva.evento,
      reserva.observacoes || "-"
    ]);
    autoTable(doc, {
      head: [["Data", "Horário", "Auditório", "Evento", "Observações"]],
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
        <button
          className="absolute top-4 left-4 text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          onClick={exportarPDF}
          disabled={minhasReservas.length === 0}
        >
          Exportar PDF
        </button>
        <button
          className="absolute top-4 right-4 text-white text-2xl hover:text-red-400"
          onClick={onClose}
          aria-label="Fechar"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Minhas Reservas</h2>
        {minhasReservas.length === 0 ? (
          <div className="text-center text-gray-300">Você não possui reservas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-white">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="py-2 px-3">Data</th>
                  <th className="py-2 px-3">Horário</th>
                  <th className="py-2 px-3">Auditório</th>
                  <th className="py-2 px-3">Evento</th>
                  <th className="py-2 px-3">Observações</th>
                </tr>
              </thead>
              <tbody>
                {minhasReservas.map((reserva) => (
                  <tr key={reserva.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3">{reserva.data}</td>
                    <td className="py-2 px-3">{reserva.horarioInicio} - {reserva.horarioFim}</td>
                    <td className="py-2 px-3">{reserva.auditorio}</td>
                    <td className="py-2 px-3">{reserva.evento}</td>
                    <td className="py-2 px-3">{reserva.observacoes || "-"}</td>
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