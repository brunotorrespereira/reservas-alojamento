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
import autoTable from "jspdf-autotable";
import Login from "./components/Login";
import Cadastro from "./components/Cadastro";
import UserAvatarMenu from "./components/UserAvatarMenu";
import MinhasReservasModal from "./components/MinhasReservasModal";
import { Metadata } from "next";

interface Reserva {
  id: string;
  nome: string;
  email: string;
  genero: "masculino" | "feminino" | "homem" | "mulher";
  semana: string; // data da segunda-feira da semana
  status: "ativa" | "cancelada";
  createdAt: any;
  criador?: string;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function ReservaAlojamento() {
  // Função para obter a próxima segunda-feira
  const obterProximaSegunda = () => {
    const hoje = new Date();
    const diaSemana = hoje.getDay(); // 0 = domingo, 1 = segunda, 2 = terça, etc.
    
    // Calcular quantos dias adicionar para chegar na segunda-feira da semana atual
    let diasParaSegunda;
    if (diaSemana === 1) { // Se hoje é segunda
      diasParaSegunda = 0; // Segunda atual
    } else if (diaSemana === 0) { // Se hoje é domingo
      diasParaSegunda = 1; // Próxima segunda (1 dia depois)
    } else { // Se hoje é terça a sábado
      diasParaSegunda = 1 - diaSemana; // Dias até segunda-feira da semana atual
    }
    
    const segundaAtual = new Date(hoje);
    segundaAtual.setDate(hoje.getDate() + diasParaSegunda);
    
    // Formatar manualmente para evitar problemas de timezone
    const ano = segundaAtual.getFullYear();
    const mes = String(segundaAtual.getMonth() + 1).padStart(2, '0');
    const dia = String(segundaAtual.getDate()).padStart(2, '0');
    
    return `${ano}-${mes}-${dia}`;
  };

  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [formData, setFormData] = useState({
    nome: "",
    genero: "" as "masculino" | "feminino" | "homem" | "mulher" | "",
    semana: ""
  });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [filtroData, setFiltroData] = useState("");
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroNome, setFiltroNome] = useState("");
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
    if (!user) {
      console.log("Usuário não está logado, não carregando reservas");
      return;
    }

    console.log("Carregando reservas para usuário:", user.email);
    const q = query(collection(db, "reservas"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const reservasData: Reserva[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log("Documento encontrado:", doc.id, data);
        reservasData.push({ id: doc.id, ...data } as Reserva);
      });
      
      console.log("Total de reservas carregadas:", reservasData.length);
      
      // Ordenar por data (mais recente primeiro)
      reservasData.sort((a, b) => {
        return new Date(b.semana).getTime() - new Date(a.semana).getTime();
      });
      
      setReservas(reservasData);
    }, (error) => {
      console.error("Erro ao carregar reservas:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Limpar formulário quando usuário mudar
  useEffect(() => {
    if (user?.email) {
      // Limpar formulário quando um novo usuário logar
      setFormData({
        nome: "",
        genero: "",
        semana: obterProximaSegunda()
      });
      setEditandoId(null); // Resetar modo de edição
    }
  }, [user?.email]);



  // Monitorar mudanças no estado reservas
  useEffect(() => {
    console.log("Estado reservas atualizado:", reservas.length, "reservas");
    reservas.forEach((reserva, index) => {
      console.log(`Reserva ${index}:`, reserva);
    });
  }, [reservas]);

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

  // Função para verificar se as reservas estão abertas
  const verificarReservasAbertas = () => {
    const agora = new Date();
    const diaSemana = agora.getDay(); // 0 = domingo, 1 = segunda, 2 = terça, 3 = quarta, 4 = quinta, 5 = sexta, 6 = sábado
    const hora = agora.getHours();
    const minuto = agora.getMinutes();
    
    // Sexta-feira após 12h até quinta-feira 23:59 (incluindo fim de semana)
    if (diaSemana === 5) { // Sexta-feira
      return (hora >= 12); // Abre sexta às 12h
    } else if (diaSemana === 4) { // Quinta-feira
      return true; // Aberto até quinta 23:59
    } else if (diaSemana === 6 || diaSemana === 0) { // Sábado e domingo
      return true; // Aberto no fim de semana
    } else if (diaSemana >= 1 && diaSemana <= 3) { // Segunda, terça, quarta
      return true; // Aberto durante a semana
    }
    
    return false;
  };

  // Função para verificar se a data é da próxima semana
  const verificarDataProximaSemana = (data: string) => {
    const hoje = new Date();
    const dataObj = new Date(data);
    
    // Verificar se a data é hoje ou no futuro (não no passado)
    if (dataObj < hoje) {
      return false;
    }
    
    // Verificar se é segunda, terça, quarta, quinta ou sexta (0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado)
    const diaSemana = dataObj.getDay();
    if (diaSemana < 1 || diaSemana > 5) {
      return false; // Não é dia útil
    }
    
    // Calcular a quinta-feira da semana atual
    const hojeObj = new Date();
    const diaSemanaHoje = hojeObj.getDay();
    let diasParaQuinta;
    
    if (diaSemanaHoje === 4) { // Se hoje é quinta
      diasParaQuinta = 0;
    } else if (diaSemanaHoje === 5) { // Se hoje é sexta
      diasParaQuinta = 6; // Próxima quinta (6 dias depois)
    } else if (diaSemanaHoje === 6) { // Se hoje é sábado
      diasParaQuinta = 5; // Próxima quinta (5 dias depois)
    } else if (diaSemanaHoje === 0) { // Se hoje é domingo
      diasParaQuinta = 4; // Próxima quinta (4 dias depois)
    } else { // Se hoje é segunda, terça ou quarta
      diasParaQuinta = 4 - diaSemanaHoje; // Dias até quinta desta semana
    }
    
    const quintaAtual = new Date(hojeObj);
    quintaAtual.setDate(hojeObj.getDate() + diasParaQuinta);
    
    // Verificar se a data selecionada está até quinta-feira da semana atual
    return dataObj <= quintaAtual;
  };

  // Função para verificar se pode criar reserva (horário + lotação + semana)
  const verificarPodeCriarReserva = (data: string, genero: string) => {
    // Primeiro verifica se está no horário permitido
    if (!verificarReservasAbertas()) {
      return { pode: false, motivo: "horario" };
    }
    
    // Depois verifica se é da próxima semana
    if (!verificarDataProximaSemana(data)) {
      return { pode: false, motivo: "semana" };
    }
    
    // Por último verifica se há lotação máxima
    if (verificarLotacaoMaxima(data, genero)) {
      return { pode: false, motivo: "lotacao" };
    }
    
    return { pode: true, motivo: "" };
  };

  // Função para obter mensagem de status das reservas
  const obterMensagemStatusReservas = () => {
    const agora = new Date();
    const diaSemana = agora.getDay();
    const hora = agora.getHours();
    const minuto = agora.getMinutes();
    
    if (diaSemana === 5) { // Sexta-feira
      if (hora < 12) {
        return {
          status: "fechado",
          mensagem: "Reservas abrem hoje às 12h",
          cor: "text-yellow-400"
        };
      } else {
        return {
          status: "aberto",
          mensagem: "Reservas abertas até quinta-feira",
          cor: "text-green-400"
        };
      }
    } else if (diaSemana === 4) { // Quinta-feira
      return {
        status: "aberto",
        mensagem: "Reservas abertas até hoje 23:59",
        cor: "text-green-400"
      };
    } else if (diaSemana === 6 || diaSemana === 0) { // Sábado e domingo
      return {
        status: "aberto",
        mensagem: "Reservas abertas até quinta-feira",
        cor: "text-green-400"
      };
    } else { // Segunda, terça, quarta
      return {
        status: "aberto",
        mensagem: "Reservas abertas até quinta-feira",
        cor: "text-green-400"
      };
    }
  };

  // Função para verificar se é sexta-feira após 12h (mantida para compatibilidade)
  const verificarSexta12h = () => {
    return verificarReservasAbertas();
  };

  // Função para obter a segunda-feira da semana de uma data qualquer
  const obterSegundaFeiraDaSemana = (data: string) => {
    // Criar data no timezone local
    const [ano, mes, dia] = data.split('-').map(Number);
    const dataObj = new Date(ano, mes - 1, dia);
    const diaSemana = dataObj.getDay();
    
    // Calcular quantos dias voltar para chegar na segunda-feira
    let diasParaSegunda;
    if (diaSemana === 0) { // Domingo
      diasParaSegunda = 6;
    } else if (diaSemana === 1) { // Segunda
      diasParaSegunda = 0;
    } else { // Terça a sábado
      diasParaSegunda = diaSemana - 1;
    }
    
    const segundaFeira = new Date(dataObj);
    segundaFeira.setDate(dataObj.getDate() - diasParaSegunda);
    
    // Formatar data no formato YYYY-MM-DD
    const anoResultado = segundaFeira.getFullYear();
    const mesResultado = String(segundaFeira.getMonth() + 1).padStart(2, '0');
    const diaResultado = String(segundaFeira.getDate()).padStart(2, '0');
    
    return `${anoResultado}-${mesResultado}-${diaResultado}`;
  };

  // Função para verificar se a data é uma segunda-feira
  const verificarSegundaFeira = (data: string) => {
    const dataObj = new Date(data);
    return dataObj.getDay() === 1; // 1 = segunda-feira
  };

  // Função para obter a sexta-feira da semana
  const obterSextaSemana = (dataSegunda: string) => {
    // Criar data no timezone local
    const [ano, mes, dia] = dataSegunda.split('-').map(Number);
    const segunda = new Date(ano, mes - 1, dia);
    const sexta = new Date(segunda);
    sexta.setDate(segunda.getDate() + 4); // +4 dias = sexta
    
    // Formatar data no formato YYYY-MM-DD
    const anoResultado = sexta.getFullYear();
    const mesResultado = String(sexta.getMonth() + 1).padStart(2, '0');
    const diaResultado = String(sexta.getDate()).padStart(2, '0');
    const resultado = `${anoResultado}-${mesResultado}-${diaResultado}`;
    
    console.log("Sexta-feira calculada:", resultado);
    
    return resultado;
  };

  // Função para contar reservas por gênero na semana (por usuário único)
  const contarReservasPorGenero = (dataSegunda: string) => {
    const dataSegundaObj = new Date(dataSegunda);
    const dataSextaObj = new Date(dataSegundaObj);
    dataSextaObj.setDate(dataSegundaObj.getDate() + 4); // Segunda + 4 dias = Sexta
    
    // Buscar reservas que estão na mesma semana (entre segunda e sexta)
    const reservasSemana = reservas.filter(reserva => {
      if (reserva.status !== "ativa") return false;
      
      const dataReserva = new Date(reserva.semana);
      const dataSegundaReserva = new Date(dataSegunda);
      const dataSextaReserva = new Date(dataSextaObj);
      
      return dataReserva >= dataSegundaReserva && dataReserva <= dataSextaReserva;
    });
    
    // Contar usuários únicos por gênero (não dias)
    const usuariosMasculinos = new Set();
    const usuariosFemininos = new Set();
    
    reservasSemana.forEach(reserva => {
      const email = reserva.criador || reserva.email;
      if (reserva.genero === "masculino" || reserva.genero === "homem") {
        usuariosMasculinos.add(email);
      } else if (reserva.genero === "feminino" || reserva.genero === "mulher") {
        usuariosFemininos.add(email);
      }
    });
    
    return { 
      masculinos: usuariosMasculinos.size, 
      femininos: usuariosFemininos.size 
    };
  };

  // Função para verificar duplicidade de reserva por dia
  const verificarDuplicidade = (data: string, genero: string, idExcluir?: string) => {
    return reservas.some(reserva => {
      if (reserva.id === idExcluir) return false;
      if (reserva.status !== "ativa") return false;
      if (reserva.criador !== user?.email) return false;
      
      // Verificar se é o mesmo dia
      return reserva.semana === data;
    });
  };

  // Função para verificar se a lotação está máxima para um gênero
  const verificarLotacaoMaxima = (data: string, genero: string) => {
    const { masculinos, femininos } = contarReservasPorGenero(data);
    const totalOcupado = masculinos + femininos;
    
    // Se o sistema está lotado (8 vagas), ninguém pode reservar
    if (totalOcupado >= 8) {
      return true;
    }
    
    // Se não está lotado, verificar por gênero específico
    if (genero === "masculino" || genero === "homem") {
      return masculinos >= 4; // Máximo 4 usuários homens
    } else if (genero === "feminino" || genero === "mulher") {
      return femininos >= 4; // Máximo 4 usuárias mulheres
    }
    
    return false;
  };

  // Função para verificar se há vagas disponíveis para a próxima semana
  const verificarVagasProximaSemana = () => {
    const proximaSegunda = obterProximaSegunda();
    const { masculinos, femininos } = contarReservasPorGenero(proximaSegunda);
    
    return {
      masculino: masculinos < 4,
      feminino: femininos < 4,
      total: masculinos + femininos < 8
    };
  };

  // Função para obter status das vagas
  const obterStatusVagas = (data: string) => {
    const { masculinos, femininos } = contarReservasPorGenero(data);
    
    return {
      masculino: {
        ocupadas: masculinos,
        disponiveis: 4 - masculinos,
        lotado: masculinos >= 4
      },
      feminino: {
        ocupadas: femininos,
        disponiveis: 4 - femininos,
        lotado: femininos >= 4
      },
      total: {
        ocupadas: masculinos + femininos,
        disponiveis: 8 - (masculinos + femininos),
        lotado: (masculinos + femininos) >= 8
      }
    };
  };

  // Função para obter a semana atual (baseada nas reservas existentes)
  const obterSemanaAtual = () => {
    if (reservas.length === 0) return null;
    
    // Pegar a data mais antiga das reservas ativas
    const reservasAtivas = reservas.filter(r => r.status === "ativa");
    if (reservasAtivas.length === 0) return null;
    
    const datas = reservasAtivas.map(r => r.semana).sort();
    return datas[0]; // Retorna a data mais antiga
  };

  const addReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      showToast("Você precisa estar logado para criar reservas", "error");
      return;
    }

    if (!formData.nome || !formData.genero || !formData.semana) {
      showToast("Por favor, preencha todos os campos obrigatórios", "error");
      return;
    }

    // Verificar se pode criar reserva
    const statusReserva = verificarPodeCriarReserva(formData.semana, formData.genero);
    if (!statusReserva.pode) {
      if (statusReserva.motivo === "horario") {
        const statusInfo = obterMensagemStatusReservas();
        showToast(`Reservas fechadas: ${statusInfo.mensagem}`, "error");
      } else if (statusReserva.motivo === "lotacao") {
        const { masculinos, femininos } = contarReservasPorGenero(formData.semana);
        const totalOcupado = masculinos + femininos;
        
        if (totalOcupado >= 8) {
          showToast(`Sistema lotado: Não há vagas disponíveis (${totalOcupado}/8 ocupadas)`, "error");
          // Limpar campos após sistema lotado
          setFormData({
            nome: "",
            genero: "",
            semana: obterProximaSegunda()
          });
        } else {
          showToast(`Lotação máxima: Não há vagas disponíveis para ${formData.genero === "masculino" ? "homens" : "mulheres"} nesta data`, "error");
          // Limpar campos após lotação máxima por gênero
          setFormData({
            nome: "",
            genero: "",
            semana: obterProximaSegunda()
          });
        }
      } else if (statusReserva.motivo === "semana") {
        showToast(`Data inválida: Só é possível reservar para dias úteis até quinta-feira da semana atual`, "error");
        // Limpar campos após data inválida
        setFormData({
          nome: "",
          genero: "",
          semana: obterProximaSegunda()
        });
      }
      return;
    }

    // Verificar se já existe uma reserva para o mesmo dia
    if (verificarDuplicidade(formData.semana, formData.genero, editandoId || undefined)) {
      showToast("Você já possui uma reserva para este dia", "error");
      // Limpar campos após reserva duplicada
      setFormData({
        nome: "",
        genero: "",
        semana: obterProximaSegunda()
      });
      return;
    }

    setLoading(true);
    try {
      // Usar a data selecionada diretamente
      const dataSelecionada = formData.semana;
      
      const reservaData: any = {
        nome: formData.nome,
        email: user.email,
        genero: formData.genero,
        semana: dataSelecionada, // Usar a data selecionada
        status: "ativa",
        criador: user.email
      };

      if (editandoId) {
        await updateDoc(doc(db, "reservas", editandoId), reservaData);
        showToast("Reserva atualizada com sucesso!", "success");
        setEditandoId(null);
        // Limpar formulário após edição
        setFormData({
          nome: "",
          genero: "",
          semana: obterProximaSegunda()
        });
      } else {
        reservaData.createdAt = serverTimestamp();
        await addDoc(collection(db, "reservas"), reservaData);
        showToast("Reserva criada com sucesso!", "success");
        // Limpar formulário após criação
        setFormData({
          nome: "",
          genero: "",
          semana: obterProximaSegunda()
        });
      }
    } catch (error: any) {
      showToast("Erro ao salvar reserva: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const editarReserva = (reserva: Reserva) => {
    setFormData({
      nome: reserva.nome,
      genero: reserva.genero,
      semana: reserva.semana
    });
    setEditandoId(reserva.id);
    
    // Scroll para o formulário
    document.getElementById('formulario')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Função para limpar formulário
  const limparFormulario = () => {
    setFormData({
      nome: "",
      genero: "",
      semana: obterProximaSegunda()
    });
    setEditandoId(null);
  };

  const deleteReserva = async (id: string) => {
    console.log("Iniciando deleteReserva...", id);
    
    if (!isAdmin) {
      showToast("Apenas administradores podem excluir reservas", "error");
      return;
    }

    console.log("Usuário é admin, iniciando exclusão...");
    setLoading(true);
    
    try {
      console.log("Tentando excluir documento...");
      await deleteDoc(doc(db, "reservas", id));
      console.log("Documento excluído com sucesso!");
      showToast("Reserva excluída com sucesso!", "success");
      setShowDeleteConfirm(null);
      setEditandoId(null);
    } catch (error: any) {
      console.error("ERRO na deleteReserva:", error);
      showToast("Erro ao excluir reserva: " + error.message, "error");
    } finally {
      console.log("Desabilitando loading da exclusão...");
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
    console.log("Iniciando exportação PDF...");
    console.log("Reservas filtradas:", reservasFiltradas);
    
    try {
      // Verificar se há dados para exportar
      if (reservasFiltradas.length === 0) {
        showToast("Não há reservas para exportar", "error");
        return;
      }

      const doc = new jsPDF();
      
      // Título
      doc.setFontSize(20);
      doc.text("Relatório de Reservas de Alojamento", 20, 20);
      
      // Data de geração
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 20, 30);
      
      // Filtros aplicados
      doc.setFontSize(12);
      let yPos = 45;
      if (filtroData || filtroGenero || filtroNome) {
        doc.text("Filtros aplicados:", 20, yPos);
        yPos += 7;
        if (filtroData) doc.text(`Data: ${formatarDataParaExibicao(filtroData)}`, 25, yPos);
        if (filtroGenero) doc.text(`Gênero: ${converterGeneroParaExibicao(filtroGenero)}`, 25, yPos + 7);
        if (filtroNome) doc.text(`Nome: ${filtroNome}`, 25, yPos + 14);
        yPos += 25;
      }
      
      // Dados da tabela
      const tableData = reservasFiltradas.map(reserva => [
        reserva.nome,
        converterGeneroParaExibicao(reserva.genero),
        formatarDataParaExibicao(reserva.semana),
        reserva.status === "ativa" ? "Ativa" : "Cancelada"
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [["Nome", "Gênero", "Data", "Status"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [66, 139, 202] },
        styles: { fontSize: 9 },
        margin: { top: 10 }
      });
      
      // Nome do arquivo com data
      const dataAtual = new Date();
      const dataFormatada = dataAtual.toISOString().slice(0, 10);
      const horaFormatada = dataAtual.toTimeString().slice(0, 8).replace(/:/g, '-');
      const nomeArquivo = `reservas_alojamento_${dataFormatada}_${horaFormatada}.pdf`;
      
      doc.save(nomeArquivo);
      showToast("PDF exportado com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      showToast("Erro ao exportar PDF. Tente novamente.", "error");
    }
  };

  const reservasFiltradas = reservas.filter(reserva => {
    const matchData = !filtroData || reserva.semana === filtroData;
    const matchGenero = !filtroGenero || reserva.genero === filtroGenero;
    const matchNome = !filtroNome || reserva.nome.toLowerCase().includes(filtroNome.toLowerCase());
    return matchData && matchGenero && matchNome;
  }).sort((a, b) => {
    // Ordenar por data (mais recente primeiro)
    return new Date(b.semana).getTime() - new Date(a.semana).getTime();
  });

  const totalReservas = reservasFiltradas.length;

  // Função para converter gênero para exibição
  const converterGeneroParaExibicao = (genero: string) => {
    if (genero === "homem") return "Masculino";
    if (genero === "mulher") return "Feminino";
    if (genero === "masculino") return "Masculino";
    if (genero === "feminino") return "Feminino";
    return genero;
  };

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
            Sistema de Reserva de Alojamento
          </h1>
          <p className="text-gray-300 text-lg md:text-xl">
            Gerencie suas reservas de alojamento de forma simples e eficiente
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



        {/* Status das Vagas */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4 text-center">Status das Vagas</h3>
          <p className="text-center text-gray-300 text-sm mb-4">
            Reservas abertas de sexta 12h até quinta-feira (incluindo fim de semana)
          </p>
          
          {(() => {
            const proximaSegunda = obterProximaSegunda();
            const semanaAtual = obterSemanaAtual();
            // Usar a semana atual se existir, senão usar a próxima semana
            const dataParaContar = semanaAtual || proximaSegunda;
            const { masculinos, femininos } = contarReservasPorGenero(dataParaContar);
            const reservasAbertas = verificarReservasAbertas();
            const statusInfo = obterMensagemStatusReservas();
            const totalOcupado = masculinos + femininos;
            const totalDisponivel = 8 - totalOcupado;
            

            
            return (
              <div className="space-y-6">
                {/* Status Geral */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-white mb-2">
                    {reservasAbertas ? "🟢 ABERTO" : "🔴 FECHADO"}
                  </div>
                  <div className={`text-sm ${statusInfo.cor}`}>
                    {statusInfo.mensagem}
                  </div>
                </div>

                {/* Vagas Disponíveis */}
                <div className="text-center mb-3">
                  <p className="text-gray-300 text-sm">
                    Vagas
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-white mb-1">
                      {masculinos}/4 Homens
                    </div>
                    <div className={`text-sm ${masculinos >= 4 ? "text-red-400" : "text-green-400"}`}>
                      {masculinos >= 4 ? "🔴 Lotado" : `🟢 ${4 - masculinos} vagas disponíveis`}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xl font-bold text-white mb-1">
                      {femininos}/4 Mulheres
                    </div>
                    <div className={`text-sm ${femininos >= 4 ? "text-red-400" : "text-green-400"}`}>
                      {femininos >= 4 ? "🔴 Lotado" : `🟢 ${4 - femininos} vagas disponíveis`}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-xl font-bold text-white mb-1">
                      Total
                    </div>
                    <div className={`text-sm ${totalOcupado >= 8 ? "text-red-400" : "text-green-400"}`}>
                      {totalOcupado >= 8 ? "🔴 Sistema Lotado" : `🟢 ${totalDisponivel} vagas disponíveis`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Form */}
        <div id="formulario" className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">
            {editandoId ? "Editar Reserva" : "Nova Reserva"}
          </h2>
          
          <form onSubmit={addReserva} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-white text-sm font-medium mb-2">Nome *</label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white"
                style={{ colorScheme: 'dark' }}
                required
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">Gênero *</label>
              <select
          value={formData.genero}
          onChange={(e) => setFormData({...formData, genero: e.target.value as "masculino" | "feminino"})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                required
              >
          <option value="" disabled hidden selected>Selecione um gênero</option>
          <option value="masculino" className="bg-gray-800">Masculino</option>
          <option value="feminino" className="bg-gray-800">Feminino</option>
              </select>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">Data da Semana *</label>
              <input
                type="date"
                value={formData.semana || obterProximaSegunda()}
                onChange={(e) => setFormData({...formData, semana: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white"
                style={{
                  colorScheme: 'dark',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white'
                }}
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Só é possível reservar para dias úteis até quinta-feira da semana atual
              </p>
            </div>

            <div className="md:col-span-2 lg:col-span-3 flex gap-4">
                              <button
                  type="submit"
                  disabled={loading || (!formData.nome || !formData.genero || !formData.semana)}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-cyan-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                {loading ? "Salvando..." : (editandoId ? "Atualizar Reserva" : "Criar Reserva")}
              </button>
              
              {/* Mensagens de status do botão */}
              {!!formData.genero && !!formData.semana && (() => {
                const status = verificarPodeCriarReserva(formData.semana, formData.genero);
                
                                  if (!status.pode && status.motivo === "lotacao") {
                    const { masculinos, femininos } = contarReservasPorGenero(formData.semana);
                    const totalOcupado = masculinos + femininos;
                    
                    if (totalOcupado >= 8) {
                      return (
                        <div className="flex-1 bg-red-500/20 border border-red-400/30 rounded-lg p-3 text-red-300 text-sm">
                          <div className="font-medium">Sistema Lotado</div>
                          <div>Não há vagas disponíveis ({totalOcupado}/8 ocupadas)</div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex-1 bg-red-500/20 border border-red-400/30 rounded-lg p-3 text-red-300 text-sm">
                          <div className="font-medium">Lotação Máxima</div>
                          <div>Não há vagas disponíveis para {formData.genero === "masculino" ? "homens" : "mulheres"} nesta data</div>
                        </div>
                      );
                    }
                  }
                
                if (!status.pode && status.motivo === "horario") {
                  return (
                    <div className="flex-1 bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-3 text-yellow-300 text-sm">
                      <div className="font-medium">Reservas Fechadas</div>
                      <div>{obterMensagemStatusReservas().mensagem}</div>
                    </div>
                  );
                }

                                  if (!status.pode && status.motivo === "semana") {
                    return (
                      <div className="flex-1 bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 text-blue-300 text-sm">
                        <div className="font-medium">Data Inválida</div>
                        <div>Só é possível reservar para dias úteis até quinta-feira da semana atual</div>
                      </div>
                    );
                  }
                
                return null;
              })()}
              
              {editandoId && (
                <button
                  type="button"
                  onClick={limparFormulario}
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
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                style={{
                  colorScheme: 'dark',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white'
                }}
              />
            </div>
            
            <div>
              <label className="block text-white text-sm font-medium mb-2">Gênero</label>
              <select
                value={filtroGenero}
                onChange={(e) => setFiltroGenero(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
              >
                <option value="" disabled hidden selected>Selecione um gênero</option>
                <option value="masculino" className="bg-gray-800">Masculino</option>
                <option value="feminino" className="bg-gray-800">Feminino</option>
              </select>
            </div>
            
            <div>
              <label className="block text-white text-sm font-medium mb-2">Nome</label>
              <input
                type="text"
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                placeholder="Buscar por nome"
              />
            </div>
          </div>
          
          <div className="mt-4 flex gap-4">
            <button
              onClick={() => {
                setFiltroData("");
                setFiltroGenero("");
                setFiltroNome("");
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
              Reservas {filtroData || filtroGenero || filtroNome ? `(${reservasFiltradas.length} encontradas)` : ''}
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
              <table className="w-full text-white table-fixed">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="py-2 px-3 text-left w-1/4">Nome</th>
                    <th className="py-2 px-3 text-center w-1/6">Gênero</th>
                    <th className="py-2 px-3 text-center w-1/3">Data</th>
                    <th className="py-2 px-3 text-center w-1/6">Status</th>
                    <th className="py-2 px-3 text-center w-1/6">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {reservasFiltradas.map((reserva) => {
                    const podeEditar = !!reserva.criador && reserva.criador === user.email;
                    const podeExcluir = isAdmin;
                    return (
                      <tr key={reserva.id} className="border-b border-white/10 hover:bg-white/5">
                        <td className="py-2 px-3 text-left">{reserva.nome}</td>
                        <td className="py-2 px-3 text-center">{converterGeneroParaExibicao(reserva.genero)}</td>
                        <td className="py-2 px-3 text-center">{formatarDataParaExibicao(reserva.semana)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            reserva.status === "ativa" 
                              ? "bg-green-500/20 text-green-300 border border-green-400/30" 
                              : "bg-red-500/20 text-red-300 border border-red-400/30"
                          }`}>
                            {reserva.status === "ativa" ? "Ativa" : "Cancelada"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex gap-2 justify-center">
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
