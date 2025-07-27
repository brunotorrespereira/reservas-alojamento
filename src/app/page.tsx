"use client";
import { useState, useEffect } from "react";
import { 
  collection, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  signOut, 
  onAuthStateChanged,
  User 
} from "firebase/auth";
import { db, auth } from "../firebaseConfig";
import jsPDF from "jspdf";
import "jspdf-autotable";
import Login from "./components/Login";
import Cadastro from "./components/Cadastro";
import UserAvatarMenu from "./components/UserAvatarMenu";
import MinhasReservasModal from "./components/MinhasReservasModal";
import { Metadata } from "next";

interface Reserva {
  id: string;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  auditorio: string;
  solicitante: string;
  evento: string;
  observacoes: string;
  createdAt: any;
  criador?: string;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function ReservaAuditorio() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [formData, setFormData] = useState({
    data: "",
    horarioInicio: "",
    horarioFim: "",
    auditorio: "",
    solicitante: "",
    evento: "",
    observacoes: ""
  });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [filtroData, setFiltroData] = useState("");
  const [filtroAuditorio, setFiltroAuditorio] = useState("");
  const [filtroSolicitante, setFiltroSolicitante] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // Estados de autenticação
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showCadastro, setShowCadastro] = useState(false);
  // Adicionar estado para modal de reservas do usuário
  const [showMinhasReservas, setShowMinhasReservas] = useState(false);

  // Lista de administradores (emails)
  const adminEmails = [
    "w.brunopereiraa@gmail.com"
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAdmin(user ? adminEmails.includes(user.email || "") : false);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "reservas"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const reservasData: Reserva[] = [];
      querySnapshot.forEach((doc) => {
        reservasData.push({ id: doc.id, ...doc.data() } as Reserva);
      });
      setReservas(reservasData);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast("Logout realizado com sucesso!", "success");
    } catch (error: any) {
      showToast("Erro no logout: " + error.message, "error");
    }
  };

  const normalizarData = (data: string) => {
    return data;
  };

  const formatarDataParaExibicao = (data: string) => {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const horarioParaMinutos = (horario: string) => {
    const [hora, minuto] = horario.split(":").map(Number);
    return hora * 60 + minuto;
  };

  const verificarDuplicidade = (data: string, inicio: string, fim: string, auditorio: string, idExcluir?: string) => {
    const inicioReserva = horarioParaMinutos(inicio);
    const fimReserva = horarioParaMinutos(fim);

    return reservas.some(reserva => {
      if (reserva.id === idExcluir) return false;
      if (reserva.data !== data || reserva.auditorio !== auditorio) return false;

      const reservaInicio = horarioParaMinutos(reserva.horarioInicio);
      const reservaFim = horarioParaMinutos(reserva.horarioFim);

      // Sobreposição: (A começa antes de B terminar) && (A termina depois de B começar)
      return (inicioReserva < reservaFim && fimReserva > reservaInicio);
    });
  };

  const addReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      showToast("Você precisa estar logado para criar reservas", "error");
      return;
    }

    if (!formData.data || !formData.horarioInicio || !formData.horarioFim || !formData.auditorio || !formData.solicitante || !formData.evento) {
      showToast("Por favor, preencha todos os campos obrigatórios", "error");
      return;
    }

    if (verificarDuplicidade(formData.data, formData.horarioInicio, formData.horarioFim, formData.auditorio, editandoId || undefined)) {
      showToast("Já existe uma reserva para este horário e auditório nesta data", "error");
      return;
    }

    setLoading(true);
    try {
      const reservaData = {
        ...formData,
        createdAt: serverTimestamp(),
        criador: user.email
      };

      if (editandoId) {
        await updateDoc(doc(db, "reservas", editandoId), reservaData);
        showToast("Reserva atualizada com sucesso!", "success");
        setEditandoId(null);
      } else {
        await addDoc(collection(db, "reservas"), reservaData);
        showToast("Reserva criada com sucesso!", "success");
        setFormData({
          data: "",
          horarioInicio: "",
          horarioFim: "",
          auditorio: "",
          solicitante: "",
          evento: "",
          observacoes: ""
        });
      }
      setEditandoId(null);
    } catch (error: any) {
      showToast("Erro ao salvar reserva: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const editarReserva = (reserva: Reserva) => {
    setFormData({
      data: reserva.data,
      horarioInicio: reserva.horarioInicio,
      horarioFim: reserva.horarioFim,
      auditorio: reserva.auditorio,
      solicitante: reserva.solicitante,
      evento: reserva.evento,
      observacoes: reserva.observacoes
    });
    setEditandoId(reserva.id);
    
    // Scroll para o formulário
    document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" });
  };

  const deleteReserva = async (id: string) => {
    if (!isAdmin) {
      showToast("Apenas administradores podem excluir reservas", "error");
      return;
    }

    setLoading(true);
    try {
      await deleteDoc(doc(db, "reservas", id));
      showToast("Reserva excluída com sucesso!", "success");
      setShowDeleteConfirm(null);
      setEditandoId(null); // Limpa edição após exclusão
    } catch (error: any) {
      showToast("Erro ao excluir reserva: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info") => {
    const newToast: Toast = {
      id: Date.now(),
      message,
      type
    };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => removeToast(newToast.id), 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(20);
    doc.text("Relatório de Reservas de Auditório", 20, 20);
    
    // Filtros aplicados
    doc.setFontSize(12);
    let yPos = 35;
    if (filtroData || filtroAuditorio || filtroSolicitante) {
      doc.text("Filtros aplicados:", 20, yPos);
      yPos += 7;
      if (filtroData) doc.text(`Data: ${filtroData}`, 25, yPos);
      if (filtroAuditorio) doc.text(`Auditório: ${filtroAuditorio}`, 25, yPos + 7);
      if (filtroSolicitante) doc.text(`Solicitante: ${filtroSolicitante}`, 25, yPos + 14);
      yPos += 25;
    }
    
    // Dados da tabela
    const tableData = reservasFiltradas.map(reserva => [
      formatarDataParaExibicao(reserva.data),
      `${reserva.horarioInicio} - ${reserva.horarioFim}`,
      reserva.auditorio,
      reserva.solicitante,
      reserva.evento,
      reserva.observacoes || "-"
    ]);
    
    (doc as any).autoTable({
      startY: yPos,
      head: [["Data", "Horário", "Auditório", "Solicitante", "Evento", "Observações"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [66, 139, 202] },
      styles: { fontSize: 8 }
    });
    
    doc.save("reservas_auditorio.pdf");
    showToast("PDF exportado com sucesso!", "success");
  };

  const reservasFiltradas = reservas.filter(reserva => {
    const matchData = !filtroData || reserva.data === filtroData;
    const matchAuditorio = !filtroAuditorio || reserva.auditorio.toLowerCase().includes(filtroAuditorio.toLowerCase());
    const matchSolicitante = !filtroSolicitante || reserva.solicitante.toLowerCase().includes(filtroSolicitante.toLowerCase());
    return matchData && matchAuditorio && matchSolicitante;
  });

  const totalReservas = reservasFiltradas.length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Carregando...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showCadastro) {
      return (
        <Cadastro 
          onCadastroSuccess={() => setShowCadastro(false)}
          onVoltarParaLogin={() => setShowCadastro(false)}
        />
      );
    }
    
    return (
      <Login 
        onLoginSuccess={() => {}} 
        onShowCadastro={() => setShowCadastro(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg text-white shadow-lg backdrop-blur-lg border ${
              toast.type === "success" ? "bg-green-500/20 border-green-400/30" :
              toast.type === "error" ? "bg-red-500/20 border-red-400/30" :
              "bg-blue-500/20 border-blue-400/30"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <MinhasReservasModal
        open={showMinhasReservas}
        onClose={() => setShowMinhasReservas(false)}
        reservas={reservas}
        userEmail={user?.email || ""}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-40 h-40 mb-6">
            <img
              src="/logo_ece.png"
              alt="Logo ECE"
              className="w-40 h-40 object-cover"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Sistema de Reserva de Auditório
          </h1>
          <p className="text-gray-300 text-lg md:text-xl">
            Gerencie suas reservas de auditório de forma simples e eficiente
          </p>
          
          {/* Avatar do usuário no topo direito */}
          <div className="absolute top-8 right-8">
            <UserAvatarMenu
              nome={user?.displayName || user?.email?.split("@")[0] || "Usuário"}
              email={user?.email || ""}
              onLogout={handleLogout}
              onShowMinhasReservas={() => setShowMinhasReservas(true)}
            />
          </div>
        </div>

        {/* Stats Card */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center border border-white/20 shadow-lg">
            <div className="text-4xl font-bold text-white">{totalReservas}</div>
            <div className="text-gray-300 text-lg">Total de Reservas</div>
          </div>
        </div>

        {/* Form */}
        <div id="formulario" className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">
            {editandoId ? "Editar Reserva" : "Nova Reserva"}
          </h2>
          
          <form onSubmit={addReserva} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-white text-sm font-medium mb-2">Data *</label>
              <input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({...formData, data: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white"
                style={{ colorScheme: 'dark' }}
                required
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">Horário de Início *</label>
              <input
                type="time"
                value={formData.horarioInicio}
                onChange={(e) => setFormData({...formData, horarioInicio: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white"
                style={{ colorScheme: 'dark' }}
                required
              />
            </div>
            <div>
              <label className="block text-white text-sm font-medium mb-2">Horário de Término *</label>
              <input
                type="time"
                value={formData.horarioFim}
                onChange={(e) => setFormData({...formData, horarioFim: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white"
                style={{ colorScheme: 'dark' }}
                required
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">Auditório *</label>
              <select
                value={formData.auditorio}
                onChange={(e) => setFormData({...formData, auditorio: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                required
              >
                <option value="" disabled hidden selected>Selecione um auditório</option>
                <option value="Auditório" className="bg-gray-800">Auditório</option>
                <option value="Laboratório de Informática" className="bg-gray-800">Laboratório de Informática</option>
              </select>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">Solicitante *</label>
              <input
                type="text"
                value={formData.solicitante}
                onChange={(e) => setFormData({...formData, solicitante: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                placeholder="Nome do solicitante"
                required
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">Evento *</label>
              <input
                type="text"
                value={formData.evento}
                onChange={(e) => setFormData({...formData, evento: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                placeholder="Nome do evento"
                required
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">Observações</label>
              <input
                type="text"
                value={formData.observacoes}
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                placeholder="Observações adicionais"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3 flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-cyan-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? "Salvando..." : (editandoId ? "Atualizar Reserva" : "Criar Reserva")}
              </button>
              
              {editandoId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditandoId(null);
                    setFormData({
                      data: "",
                      horarioInicio: "",
                      horarioFim: "",
                      auditorio: "",
                      solicitante: "",
                      evento: "",
                      observacoes: ""
                    });
                  }}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-white text-sm font-medium mb-2">Data</label>
              <input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-white text-sm font-medium mb-2">Salas</label>
              <select
                value={filtroAuditorio}
                onChange={(e) => setFiltroAuditorio(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
              >
                <option value="" disabled hidden selected>Todas as salas</option>
                <option value="Auditório" className="bg-gray-800">Auditório</option>
                <option value="Laboratório de Informática" className="bg-gray-800">Laboratório de Informática</option>
              </select>
            </div>
            
            <div>
              <label className="block text-white text-sm font-medium mb-2">Solicitante</label>
              <input
                type="text"
                value={filtroSolicitante}
                onChange={(e) => setFiltroSolicitante(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                placeholder="Buscar por solicitante"
              />
            </div>
          </div>
          
          <div className="mt-4 flex gap-4">
            <button
              onClick={() => {
                setFiltroData("");
                setFiltroAuditorio("");
                setFiltroSolicitante("");
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Limpar Filtros
            </button>
            
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">
              Reservas {filtroData || filtroAuditorio || filtroSolicitante ? `(${reservasFiltradas.length} encontradas)` : ''}
            </h2>
            <button
              onClick={exportarPDF}
              disabled={reservasFiltradas.length === 0}
              className={`px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2 ${
                reservasFiltradas.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar PDF
            </button>
          </div>
          
          {totalReservas === 0 ? (
            <div className="text-center py-8 text-gray-300">
              Nenhuma reserva encontrada com os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-white">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-3 px-4">Data</th>
                    <th className="text-left py-3 px-4">Horário</th>
                    <th className="text-left py-3 px-4">Auditório</th>
                    <th className="text-left py-3 px-4">Solicitante</th>
                    <th className="text-left py-3 px-4">Evento</th>
                    <th className="text-left py-3 px-4">Observações</th>
                    <th className="text-left py-3 px-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {reservasFiltradas.map((reserva) => {
                    const podeEditar = !!reserva.criador && reserva.criador === user.email;
                    const podeExcluir = isAdmin;
                    return (
                      <tr key={reserva.id} className="border-b border-white/10 hover:bg-white/5">
                        <td className="py-3 px-4">{formatarDataParaExibicao(reserva.data)}</td>
                        <td className="py-3 px-4">{reserva.horarioInicio} - {reserva.horarioFim}</td>
                        <td className="py-3 px-4">{reserva.auditorio}</td>
                        <td className="py-3 px-4">{reserva.solicitante}</td>
                        <td className="py-3 px-4">{reserva.evento}</td>
                        <td className="py-3 px-4">{reserva.observacoes || "-"}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            {podeEditar && (
                              <button
                                onClick={() => editarReserva(reserva)}
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                              >
                                Editar
                              </button>
                            )}
                            {podeExcluir && (
                              <button
                                onClick={() => setShowDeleteConfirm(reserva.id)}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                              >
                                Excluir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 max-w-md w-full border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">Confirmar Exclusão</h3>
            <p className="text-gray-300 mb-6">
              Tem certeza que deseja excluir esta reserva? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => deleteReserva(showDeleteConfirm)}
                disabled={loading}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Excluindo..." : "Excluir"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
