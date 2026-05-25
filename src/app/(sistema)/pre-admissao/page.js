'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Check, X, CheckCircle2, AlertCircle, FileCheck, Send, Settings2, Circle, Filter, MessageSquareText, MessageSquare, Calendar, ArrowRight, ThumbsDown } from 'lucide-react';

export default function PipelineAdmissaoPage() {
  const [currentUserRole, setCurrentUserRole] = useState('');
  
  const [candidates, setCandidates] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [responsibles, setResponsibles] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState([]);

  // Modal de Transição Manual (Data de Admissão)
  const [admissionModalCandidate, setAdmissionModalCandidate] = useState(null);
  const [admissionDate, setAdmissionDate] = useState('');

  // Modal de Interrupção Direta (Reprovar/Cancelar)
  const [rejectCandidate, setRejectCandidate] = useState(null);
  const [rejectForm, setRejectForm] = useState({ reason: '', notes: '' });

  // Modal de Mensagem / Feedback rápido
  const [feedbackCandidate, setFeedbackCandidate] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');

  // Filtros
  const [filterProcessType, setFilterProcessType] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Descobre quem é o usuário logado e qual o seu perfil (Role)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('users').select('role').eq('id', session.user.id).single();
        setCurrentUserRole(user?.role || '');
      }

      // 2. Busca os dados gerais da tela
      const [candidatesRes, unitsRes, rolesRes, usersRes] = await Promise.all([
        supabase.from('candidates').select(`*, job_roles(name), units(name), users(name)`).in('status', ['Pré-Admissão (Pendente)', 'Pré-Admissão (Pronto)']).order('created_at', { ascending: false }),
        supabase.from('units').select('*'),
        supabase.from('job_roles').select('*'),
        supabase.from('users').select('*')
      ]);
      
      if (candidatesRes.data) setCandidates(candidatesRes.data);
      if (unitsRes.data) setUnits(unitsRes.data);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (usersRes.data) setResponsibles(usersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredCandidates = candidates.filter(c => {
    if (filterProcessType && c.process_type !== filterProcessType) return false;
    if (filterUnit && c.unit_id !== filterUnit) return false;
    if (filterRole && c.job_role_id !== filterRole) return false;
    if (filterResponsible && c.responsible_id !== filterResponsible) return false;
    return true;
  });

  // BLOCO 1: Em Andamento
  const bloco1 = filteredCandidates.filter(c => c.status === 'Pré-Admissão (Pendente)' && !(c.analysis_status === 'Aprovado' && c.docs_status === 'Recebida'));
  // BLOCO 2: Pré-Admissão (Aguardando Médico / Data)
  const bloco2 = filteredCandidates.filter(c => c.status === 'Pré-Admissão (Pendente)' && c.analysis_status === 'Aprovado' && c.docs_status === 'Recebida');
  // BLOCO 3: Prontos para Admitir
  const bloco3 = filteredCandidates.filter(c => c.status === 'Pré-Admissão (Pronto)').sort((a, b) => new Date(a.admission_date) - new Date(b.admission_date));

  const groupedBloco3 = [];
  bloco3.forEach(c => {
    const dateStr = new Date(c.admission_date).toLocaleDateString('pt-BR');
    let group = groupedBloco3.find(g => g.date === dateStr);
    if (!group) {
      group = { date: dateStr, candidates: [] };
      groupedBloco3.push(group);
    }
    group.candidates.push(c);
  });

  const toggleNotes = (id) => {
    if (expandedNotes.includes(id)) setExpandedNotes(expandedNotes.filter(i => i !== id));
    else setExpandedNotes([...expandedNotes, id]);
  };

  async function requestAnalysisBatch() {
    const listToRequest = bloco1.filter(c => c.analysis_status === 'Pendente' && c.process_type !== 'Promoção');
    if (listToRequest.length === 0) return alert('Nenhum candidato no bloco 1 aguardando análise administrativa.');
    
    let htmlContent = `
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="utf-8">
          <style>
            table { border-collapse: collapse; font-family: Arial, sans-serif; }
            th { background-color: #F37137; color: white; font-weight: bold; border: 1px solid #000; padding: 8px; text-align: left; }
            td { border: 1px solid #000; padding: 8px; vertical-align: middle; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <th>Data de Cadastro</th>
              <th>Tipo de Processo</th>
              <th>Nome do Candidato</th>
              <th>Nome da Mãe</th>
              <th>CPF</th>
              <th>RG</th>
              <th>Função (Cargo)</th>
              <th>Unidade</th>
              <th>Telefone</th>
              <th>Data da Entrevista</th>
              <th>Responsável pelo Processo</th>
              <th>Status Atual</th>
            </tr>
    `;

    listToRequest.forEach(c => {
      const createdAt = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '';
      const interviewDate = c.interview_date ? new Date(c.interview_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
      
      htmlContent += `
        <tr>
          <td>${createdAt}</td>
          <td>${c.process_type || ''}</td>
          <td>${c.name || ''}</td>
          <td>${c.mother_name || ''}</td>
          <td>${c.cpf || ''}</td>
          <td>${c.rg || ''}</td>
          <td>${c.job_roles?.name || ''}</td>
          <td>${c.units?.name || ''}</td>
          <td>${c.phone || ''}</td>
          <td>${interviewDate}</td>
          <td>${c.users?.name || ''}</td>
          <td>${c.status || ''}</td>
        </tr>
      `;
    });

    htmlContent += `</table></body></html>`;

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `Analises_Administrativas_Pendentes_${new Date().toISOString().split('T')[0]}.xls`;
    
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`O arquivo Excel (${fileName}) contendo todos os dados dos candidatos foi baixado. O status deles será atualizado para "Solicitada" agora.`);
    
    for (const c of listToRequest) {
      await supabase.from('candidates').update({ 
        analysis_status: 'Solicitada',
        analysis_request_date: new Date().toISOString()
      }).eq('id', c.id);
    }
    
    fetchData();
  }

  const handleDateChange = (val) => val ? new Date(val + 'T12:00:00').toISOString() : null;
  const formatInputDate = (isoString) => isoString ? isoString.split('T')[0] : '';

  async function handleSaveEditing(e) {
    e.preventDefault();
    const c = editingCandidate;
    
    const updates = {
      analysis_status: c.analysis_status,
      medical_status: c.medical_status,
      docs_status: c.docs_status,
      feedback: c.feedback,
      medical_request_date: c.medical_request_date,
      medical_result_date: c.medical_result_date,
      docs_request_date: c.docs_request_date,
      docs_receive_date: c.docs_receive_date
    };

    const oldC = candidates.find(cand => cand.id === c.id);
    
    if (oldC.analysis_status !== c.analysis_status) {
      if (c.analysis_status === 'Solicitada') updates.analysis_request_date = new Date().toISOString();
      else if (c.analysis_status === 'Aprovado' || c.analysis_status === 'Reprovado') updates.analysis_update_date = new Date().toISOString();
    }

    if (c.analysis_status === 'Reprovado' || c.medical_status === 'Inapto') {
      if (confirm('Atenção: A Análise foi Reprovada ou Médico deu Inapto. O candidato será movido para Cancelados/Reprovados. Confirmar?')) {
        updates.status = 'Reprovado';
      } else {
        return;
      }
    }

    const { error } = await supabase.from('candidates').update(updates).eq('id', c.id);
    if (!error) {
      setEditingCandidate(null);
      fetchData();
    } else {
      alert('Erro ao atualizar: ' + error.message);
    }
  }

  async function handleConfirmReject(e) {
    e.preventDefault();
    if (!rejectForm.reason) return alert('Selecione o motivo principal.');

    const rejectionText = `\n[CANCELADO NO PIPELINE] Motivo: ${rejectForm.reason}. ${rejectForm.notes ? `Obs: ${rejectForm.notes}` : ''}`;
    const newFeedback = (rejectCandidate.feedback || '') + rejectionText;

    const { error } = await supabase.from('candidates').update({ 
      status: 'Reprovado',
      feedback: newFeedback
    }).eq('id', rejectCandidate.id);

    if (!error) {
      setRejectCandidate(null);
      setRejectForm({ reason: '', notes: '' });
      fetchData();
    } else {
      alert('Erro ao interromper processo: ' + error.message);
    }
  }

  const handleOpenAdmissionModal = (c) => {
    if (c.medical_status !== 'Apto') {
      alert('O Exame Médico precisa estar marcado como "Apto" para prosseguir com a admissão.');
      return;
    }
    setAdmissionModalCandidate(c);
    setAdmissionDate('');
  };

  const handleGridConfirmAdmission = async (e) => {
    e.preventDefault();
    if (!admissionDate) return;

    const { error } = await supabase.from('candidates').update({ 
      status: 'Pré-Admissão (Pronto)',
      admission_date: new Date(admissionDate + 'T12:00:00').toISOString()
    }).eq('id', admissionModalCandidate.id);

    if (!error) {
      setAdmissionModalCandidate(null);
      fetchData();
    } else {
      alert('Erro ao confirmar data de admissão: ' + error.message);
    }
  };

  async function handleConcluirFinal(id) {
    if (confirm('Deseja concluir todo o processo e mover este candidato para a lista de Concluídos?')) {
      const { error } = await supabase.from('candidates').update({ status: 'Concluído' }).eq('id', id);
      if (!error) fetchData();
    }
  }

  function openFeedbackModal(c) {
    setFeedbackCandidate(c);
    setFeedbackText('');
  }

  async function handleSaveFeedback(e) {
    e.preventDefault();
    if(!feedbackText) return;
    
    const newNote = `\n[${currentUserRole}] ${new Date().toLocaleDateString('pt-BR')}: ${feedbackText}`;
    const updatedFeedback = (feedbackCandidate.feedback || '') + newNote;

    const { error } = await supabase.from('candidates').update({ feedback: updatedFeedback }).eq('id', feedbackCandidate.id);
    
    if (!error) {
      setFeedbackCandidate(null);
      setFeedbackText('');
      fetchData();
    } else {
      alert('Erro ao salvar mensagem: ' + error.message);
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'Aprovado': 
      case 'Apto': 
      case 'Recebida': return '#057a55';
      case 'Reprovado': 
      case 'Inapto': return '#e02424';
      case 'Solicitada': return '#F6D317';
      case 'Pendente': return '#888888';
      default: return '#cccccc';
    }
  };

  const renderCard = (c, isBloco3 = false) => (
    <div key={c.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: isBloco3 ? '3px solid var(--success-color)' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontWeight: '600', fontSize: '0.95rem' }}>{c.name}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.job_roles?.name} • {c.units?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          
          {/* Botão de Ver Mensagens (Liberado para Todos) */}
          <button onClick={() => toggleNotes(c.id)} className="btn-secondary" style={{ padding: '0.3rem', borderRadius: 'var(--radius-sm)' }} title="Ver Histórico/Observações">
            <MessageSquareText size={14} color={expandedNotes.includes(c.id) ? 'var(--saritur-orange)' : 'var(--text-muted)'} />
          </button>
          
          {/* Botão de Adicionar Mensagem (Liberado para Recrutadores, ou para o DP caso esteja no Bloco 3) */}
          {(currentUserRole !== 'DP' || isBloco3) && (
            <button onClick={() => openFeedbackModal(c)} className="btn-secondary" style={{ padding: '0.3rem', borderRadius: 'var(--radius-sm)' }} title="Nova Mensagem/Observação">
              <MessageSquare size={14} color="var(--text-main)" />
            </button>
          )}

          {/* Botão de Editar (Oculto para o DP) */}
          {currentUserRole !== 'DP' && !isBloco3 && (
            <button onClick={() => setEditingCandidate({...c})} className="btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem' }}>
              <Settings2 size={12} /> Editar
            </button>
          )}

          {/* Botão de Interromper Processo (Oculto para o DP) */}
          {currentUserRole !== 'DP' && (
            <button onClick={() => setRejectCandidate(c)} className="btn-secondary" style={{ padding: '0.3rem', borderRadius: 'var(--radius-sm)', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} title="Interromper/Cancelar Processo">
              <ThumbsDown size={12} />
            </button>
          )}
        </div>
      </div>

      {expandedNotes.includes(c.id) && (
        <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>
          <p style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.2rem' }}>Histórico:</p>
          <p style={{ color: 'var(--text-muted)' }}>{c.feedback || 'Nenhuma observação registrada.'}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Circle size={8} fill={getStatusColor(c.analysis_status)} color={getStatusColor(c.analysis_status)} />
          <span style={{ fontWeight: '500' }}>Análise:</span>
          <span style={{ color: 'var(--text-muted)' }}>{c.analysis_status}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Circle size={8} fill={getStatusColor(c.medical_status)} color={getStatusColor(c.medical_status)} />
          <span style={{ fontWeight: '500' }}>Médico:</span>
          <span style={{ color: 'var(--text-muted)' }}>{c.medical_status}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Circle size={8} fill={getStatusColor(c.docs_status)} color={getStatusColor(c.docs_status)} />
          <span style={{ fontWeight: '500' }}>Doc:</span>
          <span style={{ color: 'var(--text-muted)' }}>{c.docs_status}</span>
        </div>
      </div>

      {/* Botão Definir Data Admissão (Oculto para DP) */}
      {currentUserRole !== 'DP' && !isBloco3 && c.analysis_status === 'Aprovado' && c.docs_status === 'Recebida' && (
        <div style={{ marginTop: '0.5rem' }}>
          <button onClick={() => handleOpenAdmissionModal(c)} className="btn-primary" style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem', justifyContent: 'center' }}>
            Definir Data Admissão <ArrowRight size={14} style={{ marginLeft: '4px' }}/>
          </button>
        </div>
      )}

      {/* Botão Concluir Admissão (Apenas ADMIN e DP) */}
      {isBloco3 && ['ADMIN', 'DP'].includes(currentUserRole) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
          <button onClick={() => handleConcluirFinal(c.id)} className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', backgroundColor: 'var(--success-color)' }}>
            <FileCheck size={14} /> Concluir Admissão
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Pipeline de Admissão</h1>
          <p style={{ color: 'var(--text-muted)' }}>Acompanhe os candidatos aprovados em 3 etapas até a efetivação.</p>
        </div>
        
        {['ADMIN', 'RECRUITER_ANALYST'].includes(currentUserRole) && (
          <button className="btn-primary" onClick={requestAnalysisBatch}>
            <Send size={18} />
            Solicitar Análises Pendentes (.XLS)
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', backgroundColor: 'var(--surface-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', alignItems: 'center' }}>
        <Filter size={20} color="var(--text-muted)" />
        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)', marginRight: '0.5rem' }}>Filtros:</span>
        
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', minWidth: '140px' }} value={filterProcessType} onChange={e => setFilterProcessType(e.target.value)}>
          <option value="">Todos os Processos</option>
          <option value="Admissão">Admissão</option>
          <option value="Readmissão">Readmissão</option>
          <option value="Promoção">Promoção</option>
        </select>
        
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', minWidth: '140px' }} value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
          <option value="">Todas as Unidades</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', minWidth: '140px' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">Todas as Funções</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', minWidth: '140px' }} value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}>
          <option value="">Todos os Responsáveis</option>
          {responsibles.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
        </select>
      </div>

      {loading ? (
        <p>Carregando dados...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <AlertCircle size={20} color="var(--saritur-orange)" />
              <h2 style={{ fontSize: '1rem', fontWeight: 'bold' }}>1. Em Andamento ({bloco1.length})</h2>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {bloco1.map(c => renderCard(c, false))}
              {bloco1.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Vazio.</p>}
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Check size={20} color="var(--saritur-yellow)" />
              <h2 style={{ fontSize: '1rem', fontWeight: 'bold' }}>2. Pré-Admissão ({bloco2.length})</h2>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {bloco2.map(c => renderCard(c, false))}
              {bloco2.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Vazio.</p>}
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <CheckCircle2 size={20} color="var(--success-color)" />
              <h2 style={{ fontSize: '1rem', fontWeight: 'bold' }}>3. Prontos para Admitir ({bloco3.length})</h2>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {groupedBloco3.map(group => (
                <div key={group.date}>
                  <div style={{ padding: '0.3rem 0', borderBottom: '2px solid var(--border-color)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={14} color="var(--saritur-orange)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                      Admissão {group.date}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {group.candidates.map(c => renderCard(c, true))}
                  </div>
                </div>
              ))}
              {groupedBloco3.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Vazio.</p>}
            </div>
          </div>

        </div>
      )}

      {/* EDIT MODAL */}
      {editingCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Atualizar Etapas: {editingCandidate.name}</h2>
              <button onClick={() => setEditingCandidate(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <form onSubmit={handleSaveEditing} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Análise Administrativa</label>
                  <select style={{ width: '100%' }} value={editingCandidate.analysis_status || 'Pendente'} onChange={e => setEditingCandidate({...editingCandidate, analysis_status: e.target.value})}>
                    <option value="Pendente">Pendente</option>
                    <option value="Solicitada">Solicitada</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Reprovado">Reprovado</option>
                  </select>
                </div>

                <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Exame Médico</label>
                  <select style={{ width: '100%', marginBottom: '0.5rem' }} value={editingCandidate.medical_status || 'Pendente'} onChange={e => setEditingCandidate({...editingCandidate, medical_status: e.target.value})}>
                    <option value="Pendente">Pendente</option>
                    <option value="Solicitada">Solicitada</option>
                    <option value="Apto">Apto</option>
                    <option value="Inapto">Inapto</option>
                  </select>
                  {['Solicitada', 'Apto', 'Inapto'].includes(editingCandidate.medical_status) && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data da Solicitação:</label>
                      <input type="date" style={{ width: '100%', fontSize: '0.8rem', padding: '0.3rem' }} value={formatInputDate(editingCandidate.medical_request_date)} onChange={e => setEditingCandidate({...editingCandidate, medical_request_date: handleDateChange(e.target.value)})} />
                    </div>
                  )}
                  {['Apto', 'Inapto'].includes(editingCandidate.medical_status) && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data do Resultado:</label>
                      <input type="date" style={{ width: '100%', fontSize: '0.8rem', padding: '0.3rem' }} value={formatInputDate(editingCandidate.medical_result_date)} onChange={e => setEditingCandidate({...editingCandidate, medical_result_date: handleDateChange(e.target.value)})} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Documentação</label>
                <select style={{ width: '100%', marginBottom: '0.5rem' }} value={editingCandidate.docs_status || 'Pendente'} onChange={e => setEditingCandidate({...editingCandidate, docs_status: e.target.value})}>
                  <option value="Pendente">Pendente</option>
                  <option value="Solicitada">Solicitada</option>
                  <option value="Recebida">Recebida</option>
                </select>
                {['Solicitada', 'Recebida'].includes(editingCandidate.docs_status) && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data da Solicitação:</label>
                    <input type="date" style={{ width: '100%', fontSize: '0.8rem', padding: '0.3rem' }} value={formatInputDate(editingCandidate.docs_request_date)} onChange={e => setEditingCandidate({...editingCandidate, docs_request_date: handleDateChange(e.target.value)})} />
                  </div>
                )}
                {['Recebida'].includes(editingCandidate.docs_status) && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data de Recebimento:</label>
                    <input type="date" style={{ width: '100%', fontSize: '0.8rem', padding: '0.3rem' }} value={formatInputDate(editingCandidate.docs_receive_date)} onChange={e => setEditingCandidate({...editingCandidate, docs_receive_date: handleDateChange(e.target.value)})} />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Observações</label>
                <textarea style={{ width: '100%', minHeight: '80px' }} value={editingCandidate.feedback || ''} onChange={e => setEditingCandidate({...editingCandidate, feedback: e.target.value})} placeholder="Digite as observações aqui..."></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingCandidate(null)}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMISSION MODAL */}
      {admissionModalCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Definir Data de Admissão</h2>
              <button onClick={() => setAdmissionModalCandidate(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>O candidato <strong>{admissionModalCandidate.name}</strong> cumpriu todas as exigências. Defina a data da admissão para enviá-lo ao 3º Bloco.</p>
            <form onSubmit={handleGridConfirmAdmission} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Data da Admissão</label>
                <input required type="date" style={{ width: '100%', fontSize: '1rem', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={admissionDate} onChange={e => setAdmissionDate(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setAdmissionModalCandidate(null)}>Cancelar</button>
                <button type="submit" className="btn-primary">Confirmar e Mover</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>Interromper Processo</h2>
              <button onClick={() => setRejectCandidate(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>O candidato <strong>{rejectCandidate.name}</strong> será desclassificado e enviado à lista de Reprovados/Cancelados.</p>
            <form onSubmit={handleConfirmReject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Motivo do Cancelamento/Reprovação *</label>
                <select required style={{ width: '100%' }} value={rejectForm.reason} onChange={e => setRejectForm({...rejectForm, reason: e.target.value})}>
                  <option value="">-- Selecione um motivo --</option>
                  <option value="Reprovado na Análise Administrativa">Reprovado na Análise Administrativa</option>
                  <option value="Inapto no Exame Médico">Inapto no Exame Médico</option>
                  <option value="Desistência do Candidato">Desistência do Candidato</option>
                  <option value="Documentação Pendente/Irregular">Documentação Pendente/Irregular</option>
                  <option value="Erro de Cadastro / Duplicidade">Erro de Cadastro / Duplicidade</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Observações Extras (Opcional)</label>
                <textarea style={{ width: '100%', minHeight: '80px' }} placeholder="Detalhes adicionais sobre a interrupção do processo..." value={rejectForm.notes} onChange={e => setRejectForm({...rejectForm, notes: e.target.value})} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setRejectCandidate(null)}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--danger-color)' }}>Interromper Processo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FEEDBACK (MENSAGEM) MODAL */}
      {feedbackCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Adicionar Mensagem</h2>
              <button onClick={() => setFeedbackCandidate(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            <form onSubmit={handleSaveFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Deixe uma observação no histórico de <strong>{feedbackCandidate.name}</strong> para o restante da equipe.
                </p>
                <textarea 
                  required
                  style={{ width: '100%', minHeight: '100px', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }} 
                  placeholder="Sua mensagem..."
                  value={feedbackText} 
                  onChange={e => setFeedbackText(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setFeedbackCandidate(null)}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar Mensagem</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
