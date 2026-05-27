'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, MessageSquare, ThumbsUp, ThumbsDown, Database, X, Filter, RotateCcw } from 'lucide-react';

export default function AgendamentosPage() {
  const [candidates, setCandidates] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [responsibles, setResponsibles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Controle de Abas
  const [currentTab, setCurrentTab] = useState('Agendado'); // 'Agendado', 'Banco de Talentos' ou 'Reprovado'

  // Controle de Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [feedbackCandidate, setFeedbackCandidate] = useState(null);
  const [rejectCandidate, setRejectCandidate] = useState(null);
  
  // Filtros
  const [filterProcessType, setFilterProcessType] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Formulários
  const [formData, setFormData] = useState({ process_type: 'Admissão', name: '', mother_name: '', phone: '', cpf: '', rg: '', job_role_id: '', unit_id: '', interview_date: '' });
  const [feedbackText, setFeedbackText] = useState('');
  const [rejectForm, setRejectForm] = useState({ reason: '', notes: '' });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [candidatesRes, unitsRes, rolesRes, usersRes] = await Promise.all([
        supabase.from('candidates').select(`*, job_roles(name), units(name), users(name)`).in('status', ['Agendado', 'Banco de Talentos', 'Reprovado']),
        supabase.from('units').select('*'),
        supabase.from('job_roles').select('*'),
        supabase.from('users').select('*')
      ]);
      
      if (candidatesRes.data) setCandidates(candidatesRes.data);
      if (unitsRes.data) {
        setUnits(unitsRes.data);
        if (unitsRes.data.length > 0 && !formData.unit_id) setFormData(f => ({ ...f, unit_id: unitsRes.data[0].id }));
      }
      if (rolesRes.data) {
        setRoles(rolesRes.data);
        if (rolesRes.data.length > 0 && !formData.job_role_id) setFormData(f => ({ ...f, job_role_id: rolesRes.data[0].id }));
      }
      if (usersRes.data) setResponsibles(usersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  // --- TRAVA DE FUSO HORÁRIO BRASIL (-03:00) ---
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

  // --- FUNÇÕES DE CADASTRO E EDIÇÃO ---
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

    if (interviewIso) {
      try {
        const roleName = roles.find(r => r.id === formData.job_role_id)?.name || '';
        const unitName = units.find(u => u.id === formData.unit_id)?.name || '';
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

  // --- FUNÇÕES DE PARECER E REPROVAÇÃO ---
  function openFeedbackModal(c) {
    setFeedbackCandidate(c);
    setFeedbackText(c.feedback || '');
  }

  async function handleSaveFeedback() {
    const { error } = await supabase.from('candidates').update({ feedback: feedbackText }).eq('id', feedbackCandidate.id);
    if (!error) {
      setFeedbackCandidate(null);
      fetchData();
    }
  }

  async function handleConfirmReject(e) {
    e.preventDefault();
    if (!rejectForm.reason) return alert('Selecione o motivo principal.');

    const rejectionText = `\n[REPROVADO] Motivo: ${rejectForm.reason}. ${rejectForm.notes ? `Obs: ${rejectForm.notes}` : ''}`;
    const newFeedback = (rejectCandidate.feedback || '') + rejectionText;

    const { error } = await supabase.from('candidates').update({ 
      status: 'Reprovado',
      feedback: newFeedback
    }).eq('id', rejectCandidate.id);

    if (!error) {
      setRejectCandidate(null);
      setRejectForm({ reason: '', notes: '' });
      fetchData();
    }
  }

  async function changeStatus(id, newStatus) {
    const { error } = await supabase.from('candidates').update({ status: newStatus }).eq('id', id);
    if (!error) fetchData();
  }

  // --- APROVAÇÃO COM TEMPLATE DO WHATSAPP ---
  async function handleApprove(candidate) {
    if (confirm('Deseja solicitar a documentação para o candidato no WhatsApp?')) {
      
      // Mensagem padrão caso não encontre no banco local
      let textMsg = `Olá ${candidate.name}, você foi aprovado na entrevista! Por favor, envie sua documentação.`;

      // Busca os templates customizados salvos em Configurações
      const savedTemplates = localStorage.getItem('portal_rh_templates');
      if (savedTemplates) {
        const templates = JSON.parse(savedTemplates);
        const approveTemplate = templates.find(t => t.id === 'aprovacao');
        
        if (approveTemplate) {
          // Substitui as tags pelas informações reais do candidato
          textMsg = approveTemplate.content
            .replace(/\{nome\}/g, candidate.name || '')
            .replace(/\{funcao\}/g, candidate.job_roles?.name || '');
        }
      }

      const msg = encodeURIComponent(textMsg);
      const phone = candidate.phone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
    }
    
    await supabase.from('candidates').update({ status: 'Pré-Admissão (Pendente)', docs_status: 'Solicitada', docs_request_date: new Date().toISOString() }).eq('id', candidate.id);
    fetchData();
  }

  // --- FILTROS E ORDENAÇÃO ---
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

      {/* BARRA DE FILTROS */}
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
                
                {currentTab === 'Agendado' && (
                  <>
                    <button className="btn-secondary" onClick={() => setEditingCandidate(c)} title="Editar Cadastro"><Edit2 size={16} /></button>
                    <button className="btn-secondary" onClick={() => changeStatus(c.id, 'Banco de Talentos')} title="Mover para Banco de Talentos"><Database size={16} /></button>
                    <button className="btn-secondary" onClick={() => handleApprove(c)} style={{ color: 'var(--success-color)', borderColor: 'var(--success-color)' }} title="Aprovar (Avançar)"><ThumbsUp size={16} /></button>
                    <button className="btn-secondary" onClick={() => setRejectCandidate(c)} style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} title="Reprovar / Cancelar"><ThumbsDown size={16} /></button>
                  </>
                )}
                
                {(currentTab === 'Banco de Talentos' || currentTab === 'Reprovado') && (
                  <button className="btn-primary" onClick={() => changeStatus(c.id, 'Agendado')} style={{ backgroundColor: 'var(--saritur-orange)' }} title="Retomar Processo">
                    <RotateCcw size={16} /> Retomar Processo
                  </button>
                )}
              </div>
            </div>
          ))}
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

      {/* --- MODAL: PARECER (FEEDBACK) --- */}
      {feedbackCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Parecer: {feedbackCandidate.name}</h2>
              <button onClick={() => setFeedbackCandidate(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <textarea 
              style={{ width: '100%', minHeight: '150px', padding: '0.75rem' }} 
              placeholder="Digite o parecer, notas da entrevista ou histórico do candidato..."
              value={feedbackText} 
              onChange={(e) => setFeedbackText(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button className="btn-secondary" onClick={() => setFeedbackCandidate(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveFeedback}>Salvar Parecer</button>
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
                <select required style={{ width: '100%' }} value={rejectForm.reason} onChange={e => setRejectForm({...rejectForm, reason: e.target.value})}>
                  <option value="">-- Selecione um motivo --</option>
                  <option value="Falta na Entrevista">Falta na Entrevista</option>
                  <option value="Desistência do Candidato">Desistência do Candidato</option>
                  <option value="Perfil Comportamental Inadequado">Perfil Comportamental Inadequado</option>
                  <option value="Falta de Experiência Técnica">Falta de Experiência Técnica</option>
                  <option value="Exame Médico / Saúde">Exame Médico Inapto</option>
                  <option value="Problemas com Documentação">Problemas com Documentação</option>
                  <option value="Outros">Outros</option>
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
