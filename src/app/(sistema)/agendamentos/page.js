'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, MessageSquare, ThumbsUp, ThumbsDown, Database, X, Filter, RotateCcw } from 'lucide-react';

export default function AgendamentosPage() {
  const [candidates, setCandidates] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cancellationReasons, setCancellationReasons] = useState([]); 
  const [responsibles, setResponsibles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [currentTab, setCurrentTab] = useState('Agendado');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [feedbackCandidate, setFeedbackCandidate] = useState(null);
  const [rejectCandidate, setRejectCandidate] = useState(null);
  const [detailsCandidate, setDetailsCandidate] = useState(null);
  
  const [filterProcessType, setFilterProcessType] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const [formData, setFormData] = useState({ process_type: 'Admissão', name: '', mother_name: '', phone: '', cpf: '', rg: '', job_role_id: '', unit_id: '', interview_date: '' });
  const [feedbackText, setFeedbackText] = useState('');
  const [rejectForm, setRejectForm] = useState({ reasonId: '', notes: '' });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [candidatesRes, unitsRes, rolesRes, reasonsRes, usersRes] = await Promise.all([
        supabase.from('candidates').select(`*, job_roles(name), units(name), users(name)`).in('status', ['Agendado', 'Banco de Talentos', 'Reprovado']),
        supabase.from('units').select('*'),
        supabase.from('job_roles').select('*'),
        supabase.from('cancellation_reasons').select('*').order('name'),
        supabase.from('users').select('*')
      ]);
      
      if (candidatesRes.data) setCandidates(candidatesRes.data);
      if (unitsRes.data) setUnits(unitsRes.data);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (reasonsRes.data) setCancellationReasons(reasonsRes.data);
      if (usersRes.data) setResponsibles(usersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  const getBrazilIsoDate = (val) => {
    if (!val) return null;
    if (val.endsWith('Z') || val.match(/[+-]\d\d:\d\d$/)) return val;
    return `${val}:00-03:00`;
  };

  const formatToBrazilDatetimeInput = (isoString) => {
    if (!isoString) return '';
    if (isoString.length === 16 && !isoString.includes('Z') && !isoString.includes('-')) return isoString; 
    
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = formatter.formatToParts(d);
    const val = (type) => parts.find(p => p.type === type)?.value;
    return `${val('year')}-${val('month')}-${val('day')}T${val('hour')}:${val('minute')}`;
  };

  // --- MOTOR INTELIGENTE DE INTEGRAÇÃO COM WHATSAPP ---
  const sendWhatsAppMessage = (candidateData, templateId, roleName, unitName, interviewDate) => {
    let textMsg = '';
    const savedTemplates = localStorage.getItem('portal_rh_templates');
    
    if (savedTemplates) {
      const templates = JSON.parse(savedTemplates);
      const template = templates.find(t => t.id === templateId);
      
      if (template) {
        textMsg = template.content
          .replace(/\{nome\}/g, candidateData.name || '')
          .replace(/\{funcao\}/g, roleName || '')
          .replace(/\{unidade\}/g, unitName || '');

        if (interviewDate) {
          const dataFormatada = new Date(interviewDate).toLocaleString('pt-BR', { 
            timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' 
          });
          textMsg = textMsg.replace(/\{data_hora\}/g, dataFormatada);
        } else {
           textMsg = textMsg.replace(/\{data_hora\}/g, 'a definir');
        }
      }
    }

    // Fallback de segurança caso os modelos sejam excluídos nas configurações
    if (!textMsg) {
      if (templateId === 'agendamento') textMsg = `Olá ${candidateData.name}, sua entrevista está agendada.`;
      if (templateId === 'aprovacao') textMsg = `Olá ${candidateData.name}, você foi aprovado(a) na nossa entrevista para a função de ${roleName}! Por favor, envie seus documentos.`;
      if (templateId === 'reprovacao') textMsg = `Olá ${candidateData.name}, agradecemos sua participação no processo para ${roleName}. Manteremos seu currículo em nosso banco de reserva.`;
    }

    const msg = encodeURIComponent(textMsg);
    const phone = (candidateData.phone || '').replace(/\D/g, '');
    
    if(phone) {
       window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
    } else {
       alert('Aviso: O candidato não possui um número de telefone válido cadastrado para abrir o WhatsApp.');
    }
  };

  async function handleSaveCandidate(e) {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    const responsible_id = session?.user?.id || null; 

    if (responsible_id) {
      await supabase.from('users').upsert({ id: responsible_id, email: session.user.email, name: session.user.user_metadata?.full_name || session.user.email });
    }

    const interviewIso = getBrazilIsoDate(formData.interview_date);
    const dataToSave = { ...formData, interview_date: interviewIso, responsible_id };

    const { error } = await supabase.from('candidates').insert([dataToSave]);
    if (error) return alert('Erro ao salvar candidato: ' + error.message);

    const roleName = roles.find(r => r.id === formData.job_role_id)?.name || '';
    const unitName = units.find(u => u.id === formData.unit_id)?.name || '';

    // Abertura do Google Agenda
    if (interviewIso) {
      try {
        const eventTitle = encodeURIComponent(`${formData.process_type} - ${formData.name} - ${roleName} - ${unitName}`);
        const dAgenda = new Date(interviewIso);
        const dateStr = dAgenda.toISOString().replace(/-|:|\.\d\d\d/g, "");
        const dEnd = new Date(dAgenda.getTime() + 60 * 60 * 1000); 
        const dateEndStr = dEnd.toISOString().replace(/-|:|\.\d\d\d/g, "");
        
        const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${dateStr}/${dateEndStr}&details=Candidato:+${formData.name}%0ATelefone:+${formData.phone}`;
        window.open(calUrl, '_blank');
      } catch (agendaError) {
        console.error('Erro ao abrir Google Agenda:', agendaError);
      }
    }

    // DISPARO DO WHATSAPP DE CONVITE (AGENDAMENTO)
    if (confirm('Deseja enviar o convite de agendamento para o WhatsApp do candidato?')) {
      sendWhatsAppMessage(formData, 'agendamento', roleName, unitName, interviewIso);
    }

    setIsModalOpen(false);
    setFormData({ process_type: 'Admissão', name: '', mother_name: '', phone: '', cpf: '', rg: '', job_role_id: '', unit_id: '', interview_date: '' });
    fetchData(); 
  }

  async function handleUpdateCandidate(e) {
    e.preventDefault();
    const { id, process_type, name, mother_name, phone, cpf, rg, job_role_id, unit_id, interview_date, responsible_id } = editingCandidate;
    const interviewIso = getBrazilIsoDate(interview_date);

    const { error } = await supabase.from('candidates').update({
      process_type, name, mother_name, phone, cpf, rg, job_role_id, unit_id, interview_date: interviewIso, responsible_id
    }).eq('id', id);

    if (error) return alert('Erro ao atualizar: ' + error.message);
    setEditingCandidate(null);
    fetchData();
  }

  function openFeedbackModal(c) {
    setFeedbackCandidate(c);
    setFeedbackText(''); 
  }

  async function handleSaveFeedback() {
    if (!feedbackText.trim()) return alert('O campo de parecer não pode estar vazio.');

    let userDisplay = 'N/A';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: u } = await supabase.from('users').select('name').eq('id', session.user.id).single();
        userDisplay = u?.name || session.user.email;
      }
    } catch (err) { console.error(err); }

    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const newNote = `\n--- Adicionado em ${timestamp} por ${userDisplay} ---\n${feedbackText}\n`;
    const updatedFeedback = (feedbackCandidate.feedback || '') + newNote;

    const { error } = await supabase.from('candidates').update({ feedback: updatedFeedback }).eq('id', feedbackCandidate.id);
    if (!error) {
      setFeedbackCandidate(null);
      setFeedbackText('');
      fetchData();
    } else {
      alert('Erro ao salvar parecer: ' + error.message);
    }
  }

  async function handleConfirmReject(e) {
    e.preventDefault();
    if (!rejectForm.reasonId) return alert('Selecione o motivo principal.');

    const selectedReasonObj = cancellationReasons.find(r => r.id === rejectForm.reasonId);
    const reasonText = selectedReasonObj ? selectedReasonObj.name : 'Outros';

    let userDisplay = 'N/A';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: u } = await supabase.from('users').select('name').eq('id', session.user.id).single();
        userDisplay = u?.name || session.user.email;
      }
    } catch (err) { console.error(err); }

    const cancellationDate = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const auditingBlock = `\n--- AUDITORIA DE CANCELAMENTO ---\n• Data e Hora: ${cancellationDate}\n• Usuário Executor: ${userDisplay}\n• Motivo Principal: ${reasonText}\n• Fase/Status no momento: ${rejectCandidate.status} (Análise ADM: ${rejectCandidate.analysis_status || 'Pendente'}, Exame Médico: ${rejectCandidate.medical_status || 'Pendente'}, Documentação: ${rejectCandidate.docs_status || 'Pendente'})\n${rejectForm.notes ? `• Observações Adicionais: ${rejectForm.notes}\n` : ''}---------------------------------`;
    
    const newFeedback = (rejectCandidate.feedback || '') + auditingBlock;

    const { error } = await supabase.from('candidates').update({ 
      status: 'Reprovado',
      cancellation_reason_id: rejectForm.reasonId,
      feedback: newFeedback
    }).eq('id', rejectCandidate.id);

    if (!error) {
      // DISPARO DO WHATSAPP DE REPROVAÇÃO / BANCO
      if (confirm('Deseja enviar a mensagem de aviso (Reprovação/Banco) no WhatsApp do candidato?')) {
        sendWhatsAppMessage(rejectCandidate, 'reprovacao', rejectCandidate.job_roles?.name, rejectCandidate.units?.name, rejectCandidate.interview_date);
      }
      
      setRejectCandidate(null);
      setRejectForm({ reasonId: '', notes: '' });
      fetchData();
    } else {
      alert('Erro ao arquivar processo: ' + error.message);
    }
  }

  async function changeStatus(candidate, newStatus) {
    const { error } = await supabase.from('candidates').update({ status: newStatus }).eq('id', candidate.id);
    if (!error) {
      // DISPARO DO WHATSAPP PARA BANCO DE TALENTOS
      if (newStatus === 'Banco de Talentos') {
        if (confirm('Deseja avisar o candidato pelo WhatsApp que ele foi para o Banco de Talentos?')) {
          sendWhatsAppMessage(candidate, 'reprovacao', candidate.job_roles?.name, candidate.units?.name, candidate.interview_date);
        }
      }
      fetchData();
    }
  }

  async function handleApprove(candidate) {
    // DISPARO DO WHATSAPP DE APROVAÇÃO
    if (confirm('Deseja enviar a mensagem de Aprovação e solicitação de documentos no WhatsApp do candidato?')) {
      sendWhatsAppMessage(candidate, 'aprovacao', candidate.job_roles?.name, candidate.units?.name, candidate.interview_date);
    }
    await supabase.from('candidates').update({ status: 'Pré-Admissão (Pendente)', docs_status: 'Solicitada', docs_request_date: new Date().toISOString() }).eq('id', candidate.id);
    fetchData();
  }

  const sortedFilteredCandidates = candidates.filter(c => {
    if (c.status !== currentTab) return false;
    if (filterProcessType && c.process_type !== filterProcessType) return false;
    if (filterUnit && c.unit_id !== filterUnit) return false;
    if (filterRole && c.job_role_id !== filterRole) return false;
    if (filterResponsible && c.responsible_id !== filterResponsible) return false;
    
    if (filterDate && c.interview_date) {
      const localDate = formatToBrazilDatetimeInput(c.interview_date);
      if (localDate && !localDate.startsWith(filterDate)) return false;
    } else if (filterDate && !c.interview_date) {
      return false; 
    }
    return true;
  }).sort((a, b) => {
    if (currentTab === 'Agendado') {
      const timeA = a.interview_date ? new Date(a.interview_date).getTime() : Infinity;
      const timeB = b.interview_date ? new Date(b.interview_date).getTime() : Infinity;
      return timeA - timeB; 
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Processos Seletivos</h1>
          <p style={{ color: 'var(--text-muted)' }}>Gerencie as entrevistas, banco de talentos e histórico.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} /> Novo Candidato
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        <button className={currentTab === 'Agendado' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentTab('Agendado')}>
          Entrevistas (Agendados)
        </button>
        <button className={currentTab === 'Banco de Talentos' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentTab('Banco de Talentos')} style={{ backgroundColor: currentTab === 'Banco de Talentos' ? 'var(--saritur-brown)' : 'white' }}>
          Banco de Talentos / Reservas
        </button>
        <button className={currentTab === 'Reprovado' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentTab('Reprovado')} style={{ backgroundColor: currentTab === 'Reprovado' ? 'var(--danger-color)' : 'white', color: currentTab === 'Reprovado' ? 'white' : 'var(--text-main)' }}>
          Reprovados / Cancelados
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap', backgroundColor: 'var(--surface-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', alignItems: 'center' }}>
        <Filter size={20} color="var(--text-muted)" />
        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)', marginRight: '0.5rem' }}>Filtros:</span>
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterProcessType} onChange={e => setFilterProcessType(e.target.value)}>
          <option value="">Todos Processos</option>
          <option value="Admissão">Admissão</option>
          <option value="Readmissão">Readmissão</option>
          <option value="Promoção">Promoção</option>
        </select>
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
          <option value="">Todas Unidades</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">Todas Funções</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}>
          <option value="">Todos Responsáveis</option>
          {responsibles.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
        </select>
        <input 
          type="date" 
          title="Filtrar por data"
          style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} 
          value={filterDate} 
          onChange={e => setFilterDate(e.target.value)} 
        />
      </div>

      {loading ? (
        <p>Conectando ao banco de dados...</p>
      ) : sortedFilteredCandidates.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}>
          <p style={{ color: 'var(--text-muted)' }}>Nenhum candidato encontrado com estes filtros.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {sortedFilteredCandidates.map((c) => (
            <div key={c.id} style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ backgroundColor: c.process_type === 'Promoção' ? 'var(--saritur-yellow)' : 'var(--saritur-orange)', color: c.process_type === 'Promoção' ? 'black' : 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {c.process_type}
                  </span>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{c.name}</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{c.job_roles?.name} • {c.units?.name} • CPF: {c.cpf}</p>
                <p style={{ color: 'var(--text-main)', fontSize: '0.875rem', fontWeight: '500', marginTop: '0.5rem' }}>
                  Entrevista: {c.interview_date ? new Date(c.interview_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : 'N/A'} • Resp: {c.users?.name || 'N/A'}
                </p>
                
                {currentTab === 'Reprovado' && c.feedback && (
                   <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--danger-color)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                     <strong>Histórico / Reprovação:</strong> {c.feedback}
                   </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => openFeedbackModal(c)} title="Parecer / Histórico"><MessageSquare size={16} /></button>
                
                {currentTab === 'Reprovado' && (
                  <button className="btn-secondary" onClick={() => setDetailsCandidate(c)} style={{ fontWeight: '600', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }} title="Ver Detalhamento do Cancelamento">
                    Ver Detalhes
                  </button>
                )}

                {currentTab === 'Agendado' && (
                  <>
                    <button className="btn-secondary" onClick={() => setEditingCandidate(c)} title="Editar Cadastro"><Edit2 size={16} /></button>
                    {/* Botão de Mover agora passa o objeto C completo para acionar o WhatsApp */}
                    <button className="btn-secondary" onClick={() => changeStatus(c, 'Banco de Talentos')} title="Mover para Banco de Talentos"><Database size={16} /></button>
                    <button className="btn-secondary" onClick={() => handleApprove(c)} style={{ color: 'var(--success-color)', borderColor: 'var(--success-color)' }} title="Aprovar (Avançar)"><ThumbsUp size={16} /></button>
                    <button className="btn-secondary" onClick={() => setRejectCandidate(c)} style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} title="Reprovar / Cancelar"><ThumbsDown size={16} /></button>
                  </>
                )}
                
                {(currentTab === 'Banco de Talentos' || currentTab === 'Reprovado') && (
                  <button className="btn-primary" onClick={() => changeStatus(c, 'Agendado')} style={{ backgroundColor: 'var(--saritur-orange)' }} title="Retomar Processo">
                    <RotateCcw size={16} /> Retomar Processo
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- NOVO MODAL: DETALHAMENTO DO CANCELAMENTO --- */}
      {detailsCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '550px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>Detalhamento do Processo</h2>
              <button onClick={() => setDetailsCandidate(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Candidato</span>
                <p style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>{detailsCandidate.name}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{detailsCandidate.job_roles?.name} • {detailsCandidate.units?.name}</p>
              </div>

              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Histórico e Motivações Registradas</span>
                <div style={{ marginTop: '0.5rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: '1.6' }}>
                  {detailsCandidate.feedback || 'Nenhum histórico detalhado registrado para este cancelamento.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setDetailsCandidate(null)}>Fechar Detalhes</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: NOVO CANDIDATO E EDITAR CANDIDATO --- */}
      {(isModalOpen || editingCandidate) && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{editingCandidate ? 'Editar Candidato' : 'Novo Candidato'}</h2>
              <button onClick={() => { setIsModalOpen(false); setEditingCandidate(null); }}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <form onSubmit={editingCandidate ? handleUpdateCandidate : handleSaveCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(() => {
                const data = editingCandidate || formData;
                const setData = editingCandidate ? setEditingCandidate : setFormData;

                return (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Tipo de Processo</label>
                      <select required style={{ width: '100%' }} value={data.process_type} onChange={e => setData({...data, process_type: e.target.value})}>
                        <option value="Admissão">Admissão</option>
                        <option value="Readmissão">Readmissão</option>
                        <option value="Promoção">Promoção</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Nome Completo</label><input required type="text" style={{ width: '100%' }} value={data.name} onChange={e => setData({...data, name: e.target.value})} /></div>
                      <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Nome da Mãe</label><input required type="text" style={{ width: '100%' }} value={data.mother_name} onChange={e => setData({...data, mother_name: e.target.value})} /></div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Telefone (WhatsApp)</label><input required type="text" style={{ width: '100%' }} value={data.phone} onChange={e => setData({...data, phone: e.target.value})} /></div>
                      <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>CPF</label><input required type="text" style={{ width: '100%' }} value={data.cpf} onChange={e => setData({...data, cpf: e.target.value})} /></div>
                      <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>RG</label><input type="text" style={{ width: '100%' }} value={data.rg} onChange={e => setData({...data, rg: e.target.value})} /></div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Função</label>
                        <select required style={{ width: '100%' }} value={data.job_role_id || ''} onChange={e => setData({...data, job_role_id: e.target.value})}>
                          <option value="">-- Selecione a função --</option>
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Unidade</label>
                        <select required style={{ width: '100%' }} value={data.unit_id || ''} onChange={e => setData({...data, unit_id: e.target.value})}>
                          <option value="">-- Selecione a unidade --</option>
                          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: editingCandidate ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Data e Hora da Entrevista</label>
                        <input required type="datetime-local" style={{ width: '100%' }} value={formatToBrazilDatetimeInput(data.interview_date)} onChange={e => setData({...data, interview_date: e.target.value})} />
                      </div>
                      
                      {editingCandidate && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Responsável pelo Processo</label>
                          <select required style={{ width: '100%' }} value={data.responsible_id || ''} onChange={e => setData({...data, responsible_id: e.target.value})}>
                            <option value="">Selecione o responsável</option>
                            {responsibles.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setEditingCandidate(null); }}>Cancelar</button>
                <button type="submit" className="btn-primary">{editingCandidate ? 'Atualizar Dados' : 'Salvar e Agendar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL ATUALIZADO: PARECER COMO HISTÓRICO COM LOG DE EDIÇÃO --- */}
      {feedbackCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Histórico do Processo: {feedbackCandidate.name}</h2>
              <button onClick={() => setFeedbackCandidate(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {feedbackCandidate.feedback && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Histórico Atual</label>
                  <div style={{ width: '100%', maxHeight: '180px', overflowY: 'auto', padding: '0.75rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {feedbackCandidate.feedback}
                  </div>
                </div>
              )}
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Adicionar Novo Parecer/Observação</label>
                <textarea 
                  style={{ width: '100%', minHeight: '100px', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} 
                  placeholder="Digite as notas da entrevista ou observações do candidato..."
                  value={feedbackText} 
                  onChange={(e) => setFeedbackText(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setFeedbackCandidate(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveFeedback}>Gravar Parecer</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: REPROVAR CANDIDATO --- */}
      {rejectCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>Reprovar Candidato</h2>
              <button onClick={() => setRejectCandidate(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>O candidato <strong>{rejectCandidate.name}</strong> será movido para o histórico de reprovados.</p>
            
            <form onSubmit={handleConfirmReject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Motivo da Reprovação *</label>
                <select required style={{ width: '100%' }} value={rejectForm.reasonId} onChange={e => setRejectForm({...rejectForm, reasonId: e.target.value})}>
                  <option value="">-- Selecione o motivo do banco --</option>
                  {cancellationReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Observações Extras (Opcional)</label>
                <textarea 
                  style={{ width: '100%', minHeight: '80px' }} 
                  placeholder="Detalhes adicionais sobre a reprovação..."
                  value={rejectForm.notes} 
                  onChange={e => setRejectForm({...rejectForm, notes: e.target.value})}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setRejectCandidate(null)}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--danger-color)' }}>Confirmar Reprovação</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
