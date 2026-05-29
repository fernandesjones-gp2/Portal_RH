'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, MessageSquare, ThumbsUp, ThumbsDown, Database, X, Filter, RotateCcw } from 'lucide-react';

export default function AgendamentosPage() {
  const [candidates, setCandidates] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cancellationReasons, setCancellationReasons] = useState([]); // NOVO
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
  const [rejectForm, setRejectForm] = useState({ reasonId: '', notes: '' }); // Alterado para reasonId

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [candidatesRes, unitsRes, rolesRes, reasonsRes, usersRes] = await Promise.all([
        supabase.from('candidates').select(`*, job_roles(name), units(name), users(name)`).in('status', ['Agendado', 'Banco de Talentos', 'Reprovado']),
        supabase.from('units').select('*'),
        supabase.from('job_roles').select('*'),
        supabase.from('cancellation_reasons').select('*').order('name'), // NOVO
        supabase.from('users').select('*')
      ]);
      
      if (candidatesRes.data) setCandidates(candidatesRes.data);
      if (unitsRes.data) setUnits(unitsRes.data);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (reasonsRes.data) setCancellationReasons(reasonsRes.data); // NOVO
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
    if (!rejectForm.reasonId) return alert('Selecione o motivo principal.');

    // Localiza o objeto de motivo pelo ID para extrair o texto
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

    // ATUALIZADO: Salva o ID do relacionamento oficial
    const { error } = await supabase.from('candidates').update({ 
      status: 'Reprovado',
      cancellation_reason_id: rejectForm.reasonId, // SALVA O RELACIONAMENTO
      feedback: newFeedback
    }).eq('id', rejectCandidate.id);

    if (!error) {
      setRejectCandidate(null);
      setRejectForm({ reasonId: '', notes: '' });
      fetchData();
    } else {
      alert('Erro ao arquivar processo: ' + error.message);
    }
  }

  async function changeStatus(id, newStatus) {
    const { error } = await supabase.from('candidates').update({ status: newStatus }).eq('id', id);
    if (!error) fetchData();
  }

  async function handleApprove(candidate) {
    if (confirm('Deseja solicitar a documentação para o candidato no WhatsApp?')) {
      let textMsg = `Olá ${candidate.name}, você foi aprovado na entrevista! Por favor, envie sua documentação.`;
      const savedTemplates = localStorage.getItem('portal_rh_templates');
      if (savedTemplates) {
        const templates = JSON.parse(savedTemplates);
        const approveTemplate = templates.find(t => t.id === 'aprovacao');
        if (approveTemplate) {
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
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>Novo Candidato</button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        <button className={currentTab === 'Agendado' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentTab('Agendado')}>Entrevistas</button>
        <button className={currentTab === 'Banco de Talentos' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentTab('Banco de Talentos')} style={{ backgroundColor: currentTab === 'Banco de Talentos' ? 'var(--saritur-brown)' : 'white' }}>Banco de Talentos</button>
        <button className={currentTab === 'Reprovado' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentTab('Reprovado')} style={{ backgroundColor: currentTab === 'Reprovado' ? 'var(--danger-color)' : 'white', color: currentTab === 'Reprovado' ? 'white' : 'var(--text-main)' }}>Reprovados / Cancelados</button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap', backgroundColor: 'var(--surface-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', alignItems: 'center' }}>
        <Filter size={20} color="var(--text-muted)" />
        <select value={filterProcessType} onChange={e => setFilterProcessType(e.target.value)}><option value="">Todos Processos</option><option value="Admissão">Admissão</option><option value="Readmissão">Readmissão</option><option value="Promoção">Promoção</option></select>
        <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}><option value="">Todas Unidades</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}><option value="">Todas Funções</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}><option value="">Todos Responsáveis</option>{responsibles.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {sortedFilteredCandidates.map((c) => (
          <div key={c.id} style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ backgroundColor: 'var(--saritur-orange)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{c.process_type}</span>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{c.name}</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{c.job_roles?.name} • {c.units?.name}</p>
              <p style={{ color: 'var(--text-main)', fontSize: '0.875rem', fontWeight: '500', marginTop: '0.5rem' }}>Entrevista: {c.interview_date ? new Date(c.interview_date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'N/A'}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => openFeedbackModal(c)}><MessageSquare size={16} /></button>
              {currentTab === 'Reprovado' && <button className="btn-secondary" onClick={() => setDetailsCandidate(c)} style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}>Ver Detalhes</button>}
              {currentTab === 'Agendado' && (
                <><button className="btn-secondary" onClick={() => setEditingCandidate(c)}><Edit2 size={16} /></button><button className="btn-secondary" onClick={() => changeStatus(c.id, 'Banco de Talentos')}><Database size={16} /></button><button className="btn-secondary" onClick={() => handleApprove(c)} style={{ color: 'var(--success-color)' }}><ThumbsUp size={16} /></button><button className="btn-secondary" onClick={() => setRejectCandidate(c)} style={{ color: 'var(--danger-color)' }}><ThumbsDown size={16} /></button></>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DETALHES */}
      {detailsCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '550px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>Detalhamento do Processo</h2>
              <button onClick={() => setDetailsCandidate(null)}><X size={24} /></button>
            </div>
            <p style={{ fontWeight: '700' }}>{detailsCandidate.name}</p>
            <div style={{ marginTop: '1rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {detailsCandidate.feedback}
            </div>
          </div>
        </div>
      )}

      {/* MODAL REJEITAR COM MAP DINÂMICO */}
      {rejectCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>Reprovar Candidato</h2>
              <button onClick={() => setRejectCandidate(null)}><X size={24} /></button>
            </div>
            <form onSubmit={handleConfirmReject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Motivo da Reprovação *</label>
                <select required style={{ width: '100%' }} value={rejectForm.reasonId} onChange={e => setRejectForm({...rejectForm, reasonId: e.target.value})}>
                  <option value="">-- Selecione o motivo do banco --</option>
                  {cancellationReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Observações</label>
                <textarea style={{ width: '100%', minHeight: '80px' }} value={rejectForm.notes} onChange={e => setRejectForm({...rejectForm, notes: e.target.value})} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setRejectCandidate(null)}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--danger-color)' }}>Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FORMULÁRIO DE CADASTRO ADAPTADO */}
      {(isModalOpen || editingCandidate) && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px' }}>
            <form onSubmit={editingCandidate ? handleUpdateCandidate : handleSaveCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(() => {
                const data = editingCandidate || formData;
                const setData = editingCandidate ? setEditingCandidate : setFormData;
                return (
                  <>
                    <div><label>Nome Completo</label><input required type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} /></div>
                    <div><label>Nome da Mãe</label><input required type="text" value={data.mother_name} onChange={e => setData({...data, mother_name: e.target.value})} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <div><label>Telefone</label><input required type="text" value={data.phone} onChange={e => setData({...data, phone: e.target.value})} /></div>
                      <div><label>CPF</label><input required type="text" value={data.cpf} onChange={e => setData({...data, cpf: e.target.value})} /></div>
                      <div><label>RG</label><input type="text" value={data.rg} onChange={e => setData({...data, rg: e.target.value})} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div><label>Função</label><select required value={data.job_role_id || ''} onChange={e => setData({...data, job_role_id: e.target.value})}><option value="">Selecione...</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                      <div><label>Unidade</label><select required value={data.unit_id || ''} onChange={e => setData({...data, unit_id: e.target.value})}><option value="">Selecione...</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                    </div>
                    <div><label>Data Entrevista</label><input required type="datetime-local" value={formatToBrazilDatetimeInput(data.interview_date)} onChange={e => setData({...data, interview_date: e.target.value})} /></div>
                  </>
                );
              })()}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}><button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setEditingCandidate(null); }}>Cancelar</button><button type="submit" className="btn-primary">Salvar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
