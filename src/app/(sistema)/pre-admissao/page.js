'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Check, X, CheckCircle2, AlertCircle, FileCheck, Send, Settings2, Circle, Filter, MessageSquareText, MessageSquare, Calendar, ArrowRight, ThumbsDown, ShieldAlert } from 'lucide-react';

export default function PipelineAdmissaoPage() {
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cancellationReasons, setCancellationReasons] = useState([]); // Busca os motivos do banco
  const [responsibles, setResponsibles] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState([]);

  const [admissionModalCandidate, setAdmissionModalCandidate] = useState(null);
  const [admissionDate, setAdmissionDate] = useState('');

  const [rejectCandidate, setRejectCandidate] = useState(null);
  const [rejectForm, setRejectForm] = useState({ reasonId: '', notes: '' }); // Agora usa ID

  const [feedbackCandidate, setFeedbackCandidate] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');

  const [filterProcessType, setFilterProcessType] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('users').select('role').eq('id', session.user.id).single();
        setCurrentUserRole(user?.role || '');
      }

      const [candidatesRes, unitsRes, rolesRes, reasonsRes, usersRes] = await Promise.all([
        supabase.from('candidates').select(`*, job_roles(name), units(name), users(name)`).in('status', ['Pré-Admissão (Pendente)', 'Pré-Admissão (Pronto)']).order('created_at', { ascending: false }),
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

  const filteredCandidates = candidates.filter(c => {
    if (filterProcessType && c.process_type !== filterProcessType) return false;
    if (filterUnit && c.unit_id !== filterUnit) return false;
    if (filterRole && c.job_role_id !== filterRole) return false;
    if (filterResponsible && c.responsible_id !== filterResponsible) return false;
    return true;
  });

  const bloco1 = filteredCandidates.filter(c => c.status === 'Pré-Admissão (Pendente)' && !(c.analysis_status === 'Aprovado' && c.docs_status === 'Recebida'));
  const bloco2 = filteredCandidates.filter(c => c.status === 'Pré-Admissão (Pendente)' && c.analysis_status === 'Aprovado' && c.docs_status === 'Recebida');
  const bloco3 = filteredCandidates.filter(c => c.status === 'Pré-Admissão (Pronto)').sort((a, b) => new Date(a.admission_date) - new Date(b.admission_date));

  const groupedBloco3 = [];
  const cancelamentosSolicitados = bloco3.filter(c => c.analysis_status === 'Cancelamento Pendente');
  if (cancelamentosSolicitados.length > 0) {
    groupedBloco3.push({
      date: '🚨 CANCELAMENTO SOLICITADO (AGUARDANDO DP)',
      candidates: cancelamentosSolicitados,
      isCancellationSection: true
    });
  }

  bloco3.filter(c => c.analysis_status !== 'Cancelamento Pendente').forEach(c => {
    const dateStr = new Date(c.admission_date).toLocaleDateString('pt-BR');
    let group = groupedBloco3.find(g => g.date === dateStr && !g.isCancellationSection);
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

  async function handleConfirmReject(e) {
    e.preventDefault();
    if (!rejectForm.reasonId) return alert('Selecione o motivo principal.');

    const selectedReasonObj = cancellationReasons.find(r => r.id === rejectForm.reasonId);
    const reasonText = selectedReasonObj ? selectedReasonObj.name : 'Outros';

    const cancellationText = `\n[CANCELADO NO PIPELINE] Motivo: ${reasonText}. ${rejectForm.notes ? `Obs: ${rejectForm.notes}` : ''}`;
    const newFeedback = (rejectCandidate.feedback || '') + cancellationText;

    const { error } = await supabase.from('candidates').update({ 
      status: 'Reprovado',
      cancellation_reason_id: rejectForm.reasonId, // Salva o Relacionamento Oficial
      feedback: newFeedback
    }).eq('id', rejectCandidate.id);

    if (!error) {
      setRejectCandidate(null);
      setRejectForm({ reasonId: '', notes: '' });
      fetchData();
    } else {
      alert('Erro ao interromper processo: ' + error.message);
    }
  }

  async function handleConfirmCancellationDP(c) {
    if (confirm(`Confirma o cancelamento definitivo da admissão de ${c.name}?`)) {
      const finalNote = `\n[DP HOMOLOGAÇÃO] Cancelamento concluído e arquivado.`;
      const { error } = await supabase.from('candidates').update({
        status: 'Reprovado',
        feedback: (c.feedback || '') + finalNote
      }).eq('id', c.id);
      if (!error) fetchData();
    }
  }

  const handleOpenAdmissionModal = (c) => {
    if (c.medical_status !== 'Apto') return alert('Exame precisa estar Apto.');
    setAdmissionModalCandidate(c);
    setAdmissionDate('');
  };

  const handleGridConfirmAdmission = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('candidates').update({ status: 'Pré-Admissão (Pronto)', admission_date: new Date(admissionDate + 'T12:00:00').toISOString() }).eq('id', admissionModalCandidate.id);
    if (!error) { setAdmissionModalCandidate(null); fetchData(); }
  };

  async function handleConcluirFinal(id) {
    if (confirm('Deseja concluir todo o processo?')) {
      const { error } = await supabase.from('candidates').update({ status: 'Concluído' }).eq('id', id);
      if (!error) fetchData();
    }
  }

  function openFeedbackModal(c) { setFeedbackCandidate(c); setFeedbackText(''); }
  
  async function handleSaveFeedback(e) {
    e.preventDefault();
    const newNote = `\n[${currentUserRole}] ${new Date().toLocaleDateString('pt-BR')}: ${feedbackText}`;
    await supabase.from('candidates').update({ feedback: (feedbackCandidate.feedback || '') + newNote }).eq('id', feedbackCandidate.id);
    setFeedbackCandidate(null); fetchData();
  }

  const getStatusColor = (status) => {
    switch(status) { case 'Aprovado': case 'Apto': case 'Recebida': return '#057a55'; case 'Reprovado': case 'Inapto': return '#e02424'; case 'Solicitada': return '#F6D317'; default: return '#888888'; }
  };

  const renderCard = (c, isBloco3 = false) => {
    const isPendingCancellation = c.analysis_status === 'Cancelamento Pendente';
    return (
      <div key={c.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: isPendingCancellation ? '4px solid var(--danger-color)' : (isBloco3 ? '3px solid var(--success-color)' : 'none'), backgroundColor: isPendingCancellation ? 'rgba(224, 36, 36, 0.03)' : 'var(--surface-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><h3 style={{ fontWeight: '600', fontSize: '0.95rem' }}>{c.name}</h3><p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.job_roles?.name}</p></div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={() => toggleNotes(c.id)} className="btn-secondary" style={{ padding: '0.3rem' }}><MessageSquareText size={14} /></button>
            {(currentUserRole !== 'DP' || isBloco3) && <button onClick={() => openFeedbackModal(c)} className="btn-secondary" style={{ padding: '0.3rem' }}><MessageSquare size={14} /></button>}
            {!isPendingCancellation && ((!isBloco3 && currentUserRole !== 'DP') || (isBloco3 && ['ADMIN', 'RECRUITER_ANALYST'].includes(currentUserRole))) && (
              <button onClick={() => setRejectCandidate(c)} className="btn-secondary" style={{ padding: '0.3rem', color: 'var(--danger-color)' }}><ThumbsDown size={12} /></button>
            )}
          </div>
        </div>
        {expandedNotes.includes(c.id) && <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.6rem', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{c.feedback}</div>}
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
          <div><Circle size={8} fill={getStatusColor(c.analysis_status)} /> Análise: {c.analysis_status}</div>
          <div><Circle size={8} fill={getStatusColor(c.medical_status)} /> Médico: {c.medical_status}</div>
        </div>
        {isBloco3 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            {isPendingCancellation ? (
              ['ADMIN', 'DP'].includes(currentUserRole) && <button onClick={() => handleConfirmCancellationDP(c)} className="btn-primary" style={{ backgroundColor: 'var(--danger-color)', fontSize: '0.75rem' }}><ShieldAlert size={14} /> Confirmar Cancelamento</button>
            ) : (
              ['ADMIN', 'DP'].includes(currentUserRole) && <button onClick={() => handleConcluirFinal(c.id)} className="btn-primary" style={{ backgroundColor: 'var(--success-color)', fontSize: '0.75rem' }}><FileCheck size={14} /> Concluir</button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Pipeline de Admissão</h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
        <div><h2>1. Em Andamento</h2>{bloco1.map(c => renderCard(c, false))}</div>
        <div><h2>2. Pré-Admissão</h2>{bloco2.map(c => renderCard(c, false))}</div>
        <div><h2>3. Prontos para Admitir</h2>{groupedBloco3.map(g => <div key={g.date}><h3>{g.date}</h3>{g.candidates.map(c => renderCard(c, true))}</div>)}</div>
      </div>

      {/* MODAL CANCELAR ADAPTADO AO BANCO */}
      {rejectCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>Cancelar Admissão</h2>
              <button onClick={() => setRejectCandidate(null)}><X size={24} /></button>
            </div>
            <form onSubmit={handleConfirmReject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Motivo do Cancelamento *</label>
                <select required style={{ width: '100%' }} value={rejectForm.reasonId} onChange={e => setRejectForm({...rejectForm, reasonId: e.target.value})}>
                  <option value="">-- Selecione o motivo do banco --</option>
                  {cancellationReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Observações</label>
                <textarea style={{ width: '100%', minHeight: '80px' }} value={rejectForm.notes} onChange={e => setRejectForm({...rejectForm, notes: e.target.value})} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}><button type="button" className="btn-secondary" onClick={() => setRejectCandidate(null)}>Voltar</button><button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--danger-color)' }}>Confirmar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
