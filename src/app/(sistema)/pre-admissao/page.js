'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Check, X, CheckCircle2, AlertCircle, FileCheck, Send, Settings2, Circle, Filter, MessageSquareText, MessageSquare, Calendar, ArrowRight, ThumbsDown, ShieldAlert, Eye, Edit2, BellRing } from 'lucide-react';

export default function PipelineAdmissaoPage() {
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [userPermissions, setUserPermissions] = useState({}); // RBAC Dinâmico
  
  const [candidates, setCandidates] = useState([]);
  const [allCandidates, setAllCandidates] = useState([]); 
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cancellationReasons, setCancellationReasons] = useState([]);
  const [responsibles, setResponsibles] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [editingCandidate, setEditingCandidate] = useState(null); 
  const [editingBasicData, setEditingBasicData] = useState(null); 
  const [detailsCandidate, setDetailsCandidate] = useState(null); 
  const [expandedNotes, setExpandedNotes] = useState([]);

  const [admissionModalCandidate, setAdmissionModalCandidate] = useState(null);
  const [admissionDate, setAdmissionDate] = useState('');

  const [rejectCandidate, setRejectCandidate] = useState(null);
  const [rejectForm, setRejectForm] = useState({ reasonId: '', notes: '' });

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
      const sessionUser = await api.me();
      let roleName = '';
      if (sessionUser) {
        roleName = sessionUser.data?.role || sessionUser.role || sessionUser[0]?.role || '';
        const name = sessionUser.data?.name || sessionUser.name || sessionUser.email || 'SISTEMA';
        setCurrentUserRole(roleName);
        setCurrentUserName(name);
      }

      const [allCandsData, unitsData, rolesData, reasonsData, usersData, customRolesData] = await Promise.all([
        api.candidates.list({ _t: Date.now() }),
        api.units.list(),
        api.jobRoles.list(),
        api.cancellationReasons.list().catch(() => []),
        api.users.list(),
        api.customRoles.list().catch(() => []) // Busca a Matriz Dinâmica
      ]);
      
      // Associa as permissões da matriz ao usuário logado
      if (sessionUser && customRolesData) {
        const myRoleObj = customRolesData.find(r => r.name === roleName);
        if (myRoleObj && myRoleObj.permissions) {
          setUserPermissions(myRoleObj.permissions);
        }
      }
      
      if (allCandsData) {
        setAllCandidates(allCandsData);
        setCandidates(allCandsData.filter(c => ['Pré-Admissão (Pendente)', 'Pré-Admissão (Pronto)'].includes(c.status)));
      }
      
      if (unitsData) setUnits(unitsData);
      if (rolesData) setRoles(rolesData);
      if (reasonsData) setCancellationReasons(reasonsData);
      if (usersData) setResponsibles(usersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  const maskCPF = (val) => val.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
  const maskPhone = (val) => {
    let r = val.replace(/\D/g, "");
    if (r.length > 11) r = r.slice(0, 11);
    if (r.length > 10) return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    if (r.length > 5) return r.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    if (r.length > 2) return r.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    if (r.length > 0) return r.replace(/^(\d{0,2})/, "($1");
    return r;
  };
  const maskName = (val) => val.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s']/g, "");
  const getBrazilIsoDate = (val) => { if (!val) return null; if (val.endsWith('Z') || val.match(/[+-]\d\d:\d\d$/)) return val; return `${val}:00-03:00`; };
  const formatToBrazilDatetimeInput = (isoString) => { if (!isoString) return ''; if (isoString.length === 16 && !isoString.includes('Z') && !isoString.includes('-')) return isoString; const d = new Date(isoString); if (isNaN(d.getTime())) return isoString; const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); const parts = formatter.formatToParts(d); const val = (type) => parts.find(p => p.type === type)?.value; return `${val('year')}-${val('month')}-${val('day')}T${val('hour')}:${val('minute')}`; };

  function validateForm(data) {
    if (!data.name || data.name.trim().length < 3) return alert('❌ VALIDAÇÃO: O Nome Completo é obrigatório.'), false;
    if (!data.mother_name || data.mother_name.trim().length < 3) return alert('❌ VALIDAÇÃO: O Nome da Mãe é obrigatório.'), false;
    const cleanPhone = (data.phone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) return alert('❌ VALIDAÇÃO: O Telefone é obrigatório (10 a 11 dígitos).'), false;
    const cleanCpf = (data.cpf || '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) return alert('❌ VALIDAÇÃO: O CPF é obrigatório e deve conter 11 dígitos.'), false;
    if (!data.gender) return alert('❌ VALIDAÇÃO: O campo Sexo é obrigatório.'), false;
    if (!data.job_role_id) return alert('❌ VALIDAÇÃO: O campo Função é obrigatório.'), false;
    if (!data.unit_id) return alert('❌ VALIDAÇÃO: O campo Unidade é obrigatório.'), false;
    if (!data.responsible_id) return alert('❌ VALIDAÇÃO: O campo Responsável é obrigatório.'), false;
    return true;
  }

  function getDuplicateWarning(cpfToCheck, currentCandidateId = null) {
    if (!cpfToCheck) return null;
    const cleanCpf = String(cpfToCheck).replace(/\D/g, '');
    if (cleanCpf.length !== 11) return null;
    const existing = allCandidates.filter(c => c.cpf && String(c.cpf).replace(/\D/g, '') === cleanCpf && c.id !== currentCandidateId);
    if (existing.length === 0) return null;
    existing.sort((a, b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0));
    const latest = existing[0];
    const isClosed = ['Reprovado', 'Concluído', 'Cancelado'].includes(latest.status);
    const monthsDiff = (new Date().getTime() - new Date(latest.created_at || new Date()).getTime()) / (1000 * 60 * 60 * 24 * 30);
    const TRAVA_MESES = 6; 
    const locationMsg = `Candidato(a): ${latest.name}\nStatus: ${latest.status}\nFunção: ${latest.job_roles?.name || latest.job_role_name || 'N/A'}\nUnidade: ${latest.units?.name || latest.unit_name || 'N/A'}`;
    if (!isClosed || monthsDiff < TRAVA_MESES) {
      return { block: true, message: `❌ BLOQUEIO DE SEGURANÇA: CPF JÁ CADASTRADO!\n\nEste CPF já está em uso em um processo ativo ou recente na plataforma:\n\n${locationMsg}\n\nRegra: Apenas processos encerrados há mais de ${TRAVA_MESES} meses podem gerar um novo cadastro.` };
    } else {
      return { block: false, message: `⚠️ AVISO DE DUPLICIDADE (HISTÓRICO ANTIGO)\n\nO sistema identificou um processo antigo para este CPF, encerrado há aprox. ${Math.floor(monthsDiff)} meses:\n\n${locationMsg}\n\nDeseja ignorar o alerta e prosseguir mesmo assim?` };
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
  if (cancelamentosSolicitados.length > 0) groupedBloco3.push({ date: '🚨 CANCELAMENTO SOLICITADO (AGUARDANDO DP)', candidates: cancelamentosSolicitados, isCancellationSection: true });

  bloco3.filter(c => c.analysis_status !== 'Cancelamento Pendente').forEach(c => {
    const dateStr = new Date(c.admission_date).toLocaleDateString('pt-BR');
    let group = groupedBloco3.find(g => g.date === dateStr && !g.isCancellationSection);
    if (!group) { group = { date: dateStr, candidates: [] }; groupedBloco3.push(group); }
    group.candidates.push(c);
  });

  async function markAsRead(c) {
    if (c.unread_feedback) {
      try {
        await api.candidates.update(c.id, { unread_feedback: false });
        setCandidates(prev => prev.map(cand => cand.id === c.id ? {...cand, unread_feedback: false} : cand));
      } catch(e) {}
    }
  }

  const toggleNotes = (c) => {
    markAsRead(c); 
    if (expandedNotes.includes(c.id)) setExpandedNotes(expandedNotes.filter(i => i !== c.id));
    else setExpandedNotes([...expandedNotes, c.id]);
  };

  async function requestAnalysisBatch() {
    const listToRequest = bloco1.filter(c => c.analysis_status === 'Pendente' && c.process_type !== 'Promoção');
    if (listToRequest.length === 0) return alert('Nenhum candidato no bloco 1 aguardando análise administrativa.');
    
    let htmlContent = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>table { border-collapse: collapse; font-family: Arial, sans-serif; } th { background-color: #F37137; color: white; font-weight: bold; border: 1px solid #000; padding: 8px; text-align: left; } td { border: 1px solid #000; padding: 8px; vertical-align: middle; }</style></head><body><table><tr><th>Data de Cadastro</th><th>Tipo de Processo</th><th>Nome do Candidato</th><th>Nome da Mãe</th><th>CPF</th><th>RG</th><th>Função (Cargo)</th><th>Unidade</th><th>Telefone</th><th>Data da Entrevista</th><th>Responsável pelo Processo</th><th>Status Atual</th></tr>`;
    listToRequest.forEach(c => {
      const createdAt = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '';
      const interviewDate = c.interview_date ? new Date(c.interview_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
      htmlContent += `<tr><td>${createdAt}</td><td>${c.process_type || ''}</td><td>${c.name || ''}</td><td>${c.mother_name || ''}</td><td>${c.cpf || ''}</td><td>${c.rg || ''}</td><td>${c.job_roles?.name || c.job_role_name || ''}</td><td>${c.units?.name || c.unit_name || ''}</td><td>${c.phone || ''}</td><td>${interviewDate}</td><td>${c.users?.name || c.responsible_name || ''}</td><td>${c.status || ''}</td></tr>`;
    });
    htmlContent += `</table></body></html>`;

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `Analises_Administrativas_Pendentes_${new Date().toISOString().split('T')[0]}.xls`;
    link.href = url; link.setAttribute('download', fileName); document.body.appendChild(link); link.click(); document.body.removeChild(link);

    alert(`O arquivo Excel (${fileName}) foi baixado. O status será alterado para "Solicitada".`);
    
    for (const c of listToRequest) {
      await api.candidates.update(c.id, { analysis_status: 'Solicitada', analysis_request_date: new Date().toISOString() });
    }
    fetchData();
  }

  async function handleSaveEditingStages(e) {
    e.preventDefault();
    const c = editingCandidate;
    const updates = { analysis_status: c.analysis_status, medical_status: c.medical_status, docs_status: c.docs_status, feedback: c.feedback, medical_request_date: c.medical_request_date, medical_result_date: c.medical_result_date, docs_request_date: c.docs_request_date, docs_receive_date: c.docs_receive_date };
    const oldC = candidates.find(cand => cand.id === c.id);
    if (oldC && oldC.analysis_status !== c.analysis_status) {
      if (c.analysis_status === 'Solicitada') updates.analysis_request_date = new Date().toISOString();
      else if (c.analysis_status === 'Aprovado' || c.analysis_status === 'Reprovado') updates.analysis_update_date = new Date().toISOString();
    }
    if (oldC && oldC.feedback !== c.feedback && c.status === 'Pré-Admissão (Pronto)') updates.unread_feedback = true;
    if (c.analysis_status === 'Reprovado' || c.medical_status === 'Inapto') {
      if (confirm('Atenção: A Análise foi Reprovada ou Médico deu Inapto. O candidato será movido para Cancelados/Reprovados. Confirmar?')) updates.status = 'Reprovado';
      else return;
    }
    try { await api.candidates.update(c.id, updates); setEditingCandidate(null); fetchData(); } catch (error) { alert('Erro ao atualizar: ' + error.message); }
  }

  async function handleUpdateBasicData(e) {
    e.preventDefault();
    if (!validateForm(editingBasicData)) return;
    const { id, process_type, name, mother_name, phone, cpf, rg, job_role_id, unit_id, gender, is_pcd, responsible_id, interview_date } = editingBasicData;
    if (['Admissão', 'Readmissão'].includes(process_type) && cpf) {
      const warning = getDuplicateWarning(cpf, id);
      if (warning) { if (warning.block) { alert(warning.message); return; } else { if (!confirm(warning.message)) return; } }
    }
    const interviewIso = getBrazilIsoDate(interview_date);
    try { await api.candidates.update(id, { process_type, name, mother_name, phone, cpf, rg, job_role_id, unit_id, gender, is_pcd, responsible_id, interview_date: interviewIso }); } catch (err) { return alert('Erro ao atualizar: ' + err.message); }
    setEditingBasicData(null); fetchData();
  }

  async function handleConfirmReject(e) {
    e.preventDefault();
    if (!rejectForm.reasonId) return alert('Selecione o motivo principal.');
    const selectedReasonObj = cancellationReasons.find(r => r.id === rejectForm.reasonId);
    const reasonText = selectedReasonObj ? selectedReasonObj.name : 'Outros';
    const cancellationText = `\n[CANCELADO NO PIPELINE] Motivo: ${reasonText}. ${rejectForm.notes ? `Obs: ${rejectForm.notes}` : ''}`;
    try {
      await api.candidates.update(rejectCandidate.id, { status: 'Reprovado', cancellation_reason_id: rejectForm.reasonId, feedback: (rejectCandidate.feedback || '') + cancellationText });
      setRejectCandidate(null); setRejectForm({ reasonId: '', notes: '' }); fetchData();
    } catch (error) { alert('Erro ao interromper processo.'); }
  }

  async function handleConfirmCancellationDP(c) {
    if (confirm(`Confirma o cancelamento definitivo da admissão de ${c.name}?`)) {
      const finalNote = `\n[DP HOMOLOGAÇÃO] Cancelamento concluído e arquivado.`;
      await api.candidates.update(c.id, { status: 'Reprovado', analysis_status: 'Cancelado', feedback: (c.feedback || '') + finalNote });
      fetchData();
    }
  }

  const handleOpenAdmissionModal = (c) => {
    if (c.medical_status !== 'Apto') return alert('Exame precisa estar Apto para definir a data de admissão.');
    setAdmissionModalCandidate(c); setAdmissionDate('');
  };

  const handleGridConfirmAdmission = async (e) => {
    e.preventDefault();
    if (!admissionDate) return;
    const selected = new Date(admissionDate + 'T12:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0); 
    if (selected < today) return alert('❌ BLOQUEIO: A data de admissão não pode ser retroativa (anterior a hoje).');
    try {
      await api.candidates.update(admissionModalCandidate.id, { status: 'Pré-Admissão (Pronto)', admission_date: selected.toISOString() });
      setAdmissionModalCandidate(null); fetchData(); 
    } catch (error) { alert('Erro ao confirmar admissão'); }
  };

  async function handleConcluirFinal(id) {
    if (confirm('Deseja concluir todo o processo e mover este candidato para a lista de Concluídos?')) {
      await api.candidates.update(id, { status: 'Concluído' });
      fetchData();
    }
  }

  function openFeedbackModal(c) { markAsRead(c); setFeedbackCandidate(c); setFeedbackText(''); }
  
  async function handleSaveFeedback(e) {
    e.preventDefault();
    if(!feedbackText) return;
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const newNote = `\n--- Adicionado em ${timestamp} por ${currentUserName} ---\n${feedbackText}\n`;
    const updates = { feedback: (feedbackCandidate.feedback || '') + newNote };
    if (feedbackCandidate.status === 'Pré-Admissão (Pronto)') updates.unread_feedback = true;
    await api.candidates.update(feedbackCandidate.id, updates);
    setFeedbackCandidate(null); fetchData();
  }

  const getStatusColor = (status) => {
    switch(status) { 
      case 'Aprovado': case 'Apto': case 'Recebida': return '#057a55'; 
      case 'Reprovado': case 'Inapto': return '#e02424'; 
      case 'Solicitada': return '#F6D317'; 
      default: return '#888888'; 
    }
  };

  const getTodayISO = () => {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000; 
    return (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
  };

  // REGRAS BLINDADAS (Hardcoded Roles + Matriz de Permissões)
  const canExportXLS = ['ADMIN', 'RECRUITER_ANALYST'].includes(currentUserRole) || userPermissions['/pre-admissao']?.create;

  const renderCard = (c, isBloco3 = false) => {
    const isPendingCancellation = c.analysis_status === 'Cancelamento Pendente';
    
    // Regra Blindada: Apenas ADMIN, RECRUITER_ANALYST ou quem tem permissão 'Delete' na matriz
    const canInterruptProcess = !isPendingCancellation && (
      (!isBloco3 && currentUserRole !== 'DP') || 
      (isBloco3 && (['ADMIN', 'RECRUITER_ANALYST'].includes(currentUserRole) || userPermissions['/pre-admissao']?.delete))
    );

    return (
      <div key={c.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: isPendingCancellation ? '4px solid var(--danger-color)' : (isBloco3 ? '4px solid var(--success-color)' : 'none'), backgroundColor: isPendingCancellation ? 'rgba(224, 36, 36, 0.03)' : 'var(--surface-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {c.name}
              {c.unread_feedback && isBloco3 && (
                <span style={{ backgroundColor: 'var(--danger-color)', color: 'white', fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <BellRing size={10}/> Nova Mensagem
                </span>
              )}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.job_roles?.name || c.job_role_name} • {c.units?.name || c.unit_name}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={() => toggleNotes(c)} className="btn-secondary" style={{ padding: '0.4rem', borderRadius: 'var(--radius-sm)' }} title="Ver Histórico Rápido"><MessageSquareText size={16} color={expandedNotes.includes(c.id) ? 'var(--saritur-orange)' : 'var(--text-muted)'} /></button>
            {(currentUserRole !== 'DP' || isBloco3) && (<button onClick={() => openFeedbackModal(c)} className="btn-secondary" style={{ padding: '0.4rem', borderRadius: 'var(--radius-sm)' }} title="Nova Mensagem"><MessageSquare size={16} color="var(--text-main)" /></button>)}
            {currentUserRole !== 'DP' && !isBloco3 && (
              <>
                <button onClick={() => setEditingCandidate({...c})} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }} title="Atualizar Status das Etapas"><Settings2 size={14} /> Etapas</button>
                <button onClick={() => setEditingBasicData({...c})} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }} title="Editar Dados Cadastrais"><Edit2 size={14} /> Cadastro</button>
              </>
            )}
            {canInterruptProcess && (
              <button onClick={() => setRejectCandidate(c)} className="btn-secondary" style={{ padding: '0.4rem', borderRadius: 'var(--radius-sm)', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} title="Interromper Processo"><ThumbsDown size={14} /></button>
            )}
          </div>
        </div>

        {expandedNotes.includes(c.id) && (
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>
            <p style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.3rem' }}>Histórico / Observações:</p>
            <p style={{ color: 'var(--text-muted)' }}>{c.feedback || 'Nenhuma observação registrada.'}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Circle size={10} fill={getStatusColor(c.analysis_status)} color={getStatusColor(c.analysis_status)} /><span style={{ fontWeight: '600' }}>Análise:</span> <span style={{ color: 'var(--text-muted)' }}>{c.analysis_status}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Circle size={10} fill={getStatusColor(c.medical_status)} color={getStatusColor(c.medical_status)} /><span style={{ fontWeight: '600' }}>Médico:</span> <span style={{ color: 'var(--text-muted)' }}>{c.medical_status}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Circle size={10} fill={getStatusColor(c.docs_status)} color={getStatusColor(c.docs_status)} /><span style={{ fontWeight: '600' }}>Doc:</span> <span style={{ color: 'var(--text-muted)' }}>{c.docs_status}</span></div>
        </div>

        {isBloco3 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => { markAsRead(c); setDetailsCandidate(c); }} className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }} title="Ver Informações Completas"><Eye size={16} style={{ marginRight: '6px' }} /> Ver Detalhes</button>
            {isPendingCancellation ? (
              ['ADMIN', 'DP'].includes(currentUserRole) && (<button onClick={() => handleConfirmCancellationDP(c)} className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', backgroundColor: 'var(--danger-color)' }}><ShieldAlert size={16} style={{ marginRight: '6px' }} /> Confirmar Cancelamento</button>)
            ) : (
              ['ADMIN', 'DP'].includes(currentUserRole) && (<button onClick={() => handleConcluirFinal(c.id)} className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', backgroundColor: 'var(--success-color)' }}><FileCheck size={16} style={{ marginRight: '6px' }} /> Concluir Admissão</button>)
            )}
          </div>
        )}

        {currentUserRole !== 'DP' && !isBloco3 && c.analysis_status === 'Aprovado' && c.docs_status === 'Recebida' && (
          <div style={{ marginTop: '0.75rem' }}><button onClick={() => handleOpenAdmissionModal(c)} className="btn-primary" style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem', justifyContent: 'center' }}>Definir Data de Admissão <ArrowRight size={16} style={{ marginLeft: '6px' }}/></button></div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div><h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Pipeline de Admissão</h1><p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Acompanhe os candidatos aprovados em 3 etapas até a efetivação.</p></div>
        {canExportXLS && (
          <button className="btn-primary" onClick={requestAnalysisBatch} style={{ padding: '0.75rem 1.5rem' }}>
            <Send size={18} style={{ marginRight: '0.5rem' }} /> Solicitar Análises (.XLS)
          </button>
        )}
      </div>

      <div className="glass-panel" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', backgroundColor: 'var(--surface-color)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', alignItems: 'center' }}>
        <Filter size={20} color="var(--saritur-orange)" /><span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', marginRight: '0.5rem' }}>Filtros:</span>
        <select style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', minWidth: '150px' }} value={filterProcessType} onChange={e => setFilterProcessType(e.target.value)}><option value="">Todos Processos</option><option value="Admissão">Admissão</option><option value="Readmissão">Readmissão</option><option value="Promoção">Promoção</option></select>
        <select style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', minWidth: '150px' }} value={filterUnit} onChange={e => setFilterUnit(e.target.value)}><option value="">Todas Unidades</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <select style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', minWidth: '150px' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}><option value="">Todas Funções</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', minWidth: '150px' }} value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}><option value="">Responsáveis</option>{responsibles.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select>
      </div>

      {loading ? (<p style={{ color: 'var(--text-muted)' }}>Carregando Pipeline...</p>) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2rem', alignItems: 'start' }}>
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}><AlertCircle size={24} color="var(--saritur-orange)" /><h2 style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>1. Em Andamento ({bloco1.length})</h2></div>
            <div style={{ display: 'grid', gap: '1rem' }}>{bloco1.map(c => renderCard(c, false))}{bloco1.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem 0' }}>Nenhum candidato.</p>}</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}><Check size={24} color="var(--saritur-yellow)" /><h2 style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>2. Pré-Admissão ({bloco2.length})</h2></div>
            <div style={{ display: 'grid', gap: '1rem' }}>{bloco2.map(c => renderCard(c, false))}{bloco2.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem 0' }}>Nenhum candidato.</p>}</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}><CheckCircle2 size={24} color="var(--success-color)" /><h2 style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>3. Prontos para Admitir ({bloco3.length})</h2></div>
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {groupedBloco3.map(group => (
                <div key={group.date}>
                  <div style={{ padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--border-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: group.isCancellationSection ? 'rgba(224, 36, 36, 0.1)' : 'var(--surface-color)', boxShadow: 'var(--shadow-sm)' }}>
                    <Calendar size={16} color={group.isCancellationSection ? 'var(--danger-color)' : 'var(--saritur-orange)'} />
                    <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: group.isCancellationSection ? 'var(--danger-color)' : 'var(--text-main)' }}>{group.date}</span>
                  </div>
                  <div style={{ display: 'grid', gap: '1rem' }}>{group.candidates.map(c => renderCard(c, true))}</div>
                </div>
              ))}
              {groupedBloco3.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem 0' }}>Nenhum candidato.</p>}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 1: EDITAR ETAPAS (STATUS) --- */}
      {editingCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Atualizar Etapas: {editingCandidate.name}</h2><button onClick={() => setEditingCandidate(null)}><X size={24} color="var(--text-muted)" /></button></div>
            <form onSubmit={handleSaveEditingStages} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-main)' }}>Análise Administrativa</label>
                  <select style={{ width: '100%', padding: '0.6rem' }} value={editingCandidate.analysis_status || 'Pendente'} onChange={e => setEditingCandidate({...editingCandidate, analysis_status: e.target.value})}>
                    <option value="Pendente">Pendente</option><option value="Solicitada">Solicitada</option><option value="Aprovado">Aprovado</option><option value="Reprovado">Reprovado</option>
                  </select>
                </div>
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-main)' }}>Exame Médico</label>
                  <select style={{ width: '100%', padding: '0.6rem', marginBottom: '0.75rem' }} value={editingCandidate.medical_status || 'Pendente'} onChange={e => setEditingCandidate({...editingCandidate, medical_status: e.target.value})}>
                    <option value="Pendente">Pendente</option><option value="Solicitada">Solicitada</option><option value="Apto">Apto</option><option value="Inapto">Inapto</option>
                  </select>
                  {['Solicitada', 'Apto', 'Inapto'].includes(editingCandidate.medical_status) && (<div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data da Solicitação:</label><input type="date" style={{ width: '100%', fontSize: '0.85rem', padding: '0.4rem' }} value={formatInputDate(editingCandidate.medical_request_date)} onChange={e => setEditingCandidate({...editingCandidate, medical_request_date: handleDateChange(e.target.value)})} /></div>)}
                  {['Apto', 'Inapto'].includes(editingCandidate.medical_status) && (<div><label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data do Resultado:</label><input type="date" style={{ width: '100%', fontSize: '0.85rem', padding: '0.4rem' }} value={formatInputDate(editingCandidate.medical_result_date)} onChange={e => setEditingCandidate({...editingCandidate, medical_result_date: handleDateChange(e.target.value)})} /></div>)}
                </div>
              </div>
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-main)' }}>Documentação</label>
                <select style={{ width: '100%', padding: '0.6rem', marginBottom: '0.75rem' }} value={editingCandidate.docs_status || 'Pendente'} onChange={e => setEditingCandidate({...editingCandidate, docs_status: e.target.value})}>
                  <option value="Pendente">Pendente</option><option value="Solicitada">Solicitada</option><option value="Recebida">Recebida</option>
                </select>
                {['Solicitada', 'Recebida'].includes(editingCandidate.docs_status) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data da Solicitação:</label><input type="date" style={{ width: '100%', fontSize: '0.85rem', padding: '0.4rem' }} value={formatInputDate(editingCandidate.docs_request_date)} onChange={e => setEditingCandidate({...editingCandidate, docs_request_date: handleDateChange(e.target.value)})} /></div>
                    {['Recebida'].includes(editingCandidate.docs_status) && (<div><label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data de Recebimento:</label><input type="date" style={{ width: '100%', fontSize: '0.85rem', padding: '0.4rem' }} value={formatInputDate(editingCandidate.docs_receive_date)} onChange={e => setEditingCandidate({...editingCandidate, docs_receive_date: handleDateChange(e.target.value)})} /></div>)}
                  </div>
                )}
              </div>
              <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Observações</label><textarea style={{ width: '100%', minHeight: '80px', padding: '0.75rem' }} value={editingCandidate.feedback || ''} onChange={e => setEditingCandidate({...editingCandidate, feedback: e.target.value})} placeholder="Digite as observações aqui..."></textarea></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}><button type="button" className="btn-secondary" onClick={() => setEditingCandidate(null)}>Cancelar</button><button type="submit" className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>Salvar Alterações</button></div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: EDITAR DADOS BÁSICOS --- */}
      {editingBasicData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Editar Dados Cadastrais</h2><button onClick={() => setEditingBasicData(null)}><X size={24} color="var(--text-muted)" /></button></div>
            <form onSubmit={handleUpdateBasicData} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Tipo de Processo</label><select required style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={editingBasicData.process_type} onChange={e => setEditingBasicData({...editingBasicData, process_type: e.target.value})}><option value="Admissão">Admissão</option><option value="Readmissão">Readmissão</option><option value="Promoção">Promoção</option></select></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Nome Completo</label><input required type="text" style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={editingBasicData.name} onChange={e => setEditingBasicData({...editingBasicData, name: maskName(e.target.value)})} /></div><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Nome da Mãe</label><input required type="text" style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={editingBasicData.mother_name} onChange={e => setEditingBasicData({...editingBasicData, mother_name: maskName(e.target.value)})} /></div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>WhatsApp</label><input required type="text" style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={editingBasicData.phone} onChange={e => setEditingBasicData({...editingBasicData, phone: maskPhone(e.target.value)})} /></div><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>CPF</label><input required type="text" style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={editingBasicData.cpf} onChange={e => setEditingBasicData({...editingBasicData, cpf: maskCPF(e.target.value)})} /></div><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>RG (Opcional)</label><input type="text" style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={editingBasicData.rg} onChange={e => setEditingBasicData({...editingBasicData, rg: e.target.value})} /></div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Sexo *</label><select required style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={editingBasicData.gender || ''} onChange={e => setEditingBasicData({...editingBasicData, gender: e.target.value})}><option value="">Selecione...</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option></select></div><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}><input type="checkbox" id={`pcd_edit_${editingBasicData.id}`} checked={editingBasicData.is_pcd || false} onChange={e => setEditingBasicData({...editingBasicData, is_pcd: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--saritur-orange)' }} /><label htmlFor={`pcd_edit_${editingBasicData.id}`} style={{ fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>Candidato PCD</label></div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Função</label><select required style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={editingBasicData.job_role_id || ''} onChange={e => setEditingBasicData({...editingBasicData, job_role_id: e.target.value})}><option value="">-- Selecione a função --</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Unidade</label><select required style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={editingBasicData.unit_id || ''} onChange={e => setEditingBasicData({...editingBasicData, unit_id: e.target.value})}><option value="">-- Selecione a unidade --</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Data e Hora da Entrevista</label><input required type="datetime-local" style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={formatToBrazilDatetimeInput(editingBasicData.interview_date)} onChange={e => setEditingBasicData({...editingBasicData, interview_date: e.target.value})} /></div><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Responsável pelo Processo</label><select required style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={editingBasicData.responsible_id || ''} onChange={e => setEditingBasicData({...editingBasicData, responsible_id: e.target.value})}><option value="">Selecione o responsável</option>{responsibles.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}</select></div></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}><button type="button" className="btn-secondary" onClick={() => setEditingBasicData(null)}>Cancelar</button><button type="submit" className="btn-primary">Atualizar Dados Pessoais</button></div>
            </form>
          </div>
        </div>
      )}

      {/* --- OUTROS MODAIS (Detalhes, Admissão, Rejeição, Feedback) PERMANECEM IDENTICOS --- */}
      {detailsCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}><h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Detalhamento do Candidato</h2><button onClick={() => setDetailsCandidate(null)}><X size={24} color="var(--text-muted)" /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><div><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome Completo</span><p style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>{detailsCandidate.name}{detailsCandidate.is_pcd && <span style={{ fontSize: '0.7rem', backgroundColor: '#0284c7', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem', verticalAlign: 'middle' }}>PCD</span>}</p></div><div><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tipo de Processo</span><p style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: '500' }}>{detailsCandidate.process_type}</p></div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}><div><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CPF</span><p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.cpf}</p></div><div><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>RG</span><p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.rg || '-'}</p></div><div><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sexo</span><p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.gender || '-'}</p></div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><div><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Função Designada</span><p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.job_roles?.name || detailsCandidate.job_role_name || '-'}</p></div><div><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unidade de Lotação</span><p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.units?.name || detailsCandidate.unit_name || '-'}</p></div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><div><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Telefone (WhatsApp)</span><p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.phone}</p></div><div><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome da Mãe</span><p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.mother_name}</p></div></div>
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Datas Importantes</span><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}><div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data da Entrevista</span><p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>{detailsCandidate.interview_date ? new Date(detailsCandidate.interview_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</p></div><div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--success-color)' }}><span style={{ fontSize: '0.75rem', color: 'var(--success-color)', fontWeight: 'bold' }}>Previsão de Admissão</span><p style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 'bold', marginTop: '0.2rem' }}>{detailsCandidate.admission_date ? new Date(detailsCandidate.admission_date).toLocaleDateString('pt-BR') : '-'}</p></div></div></div>
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Histórico Completo</span><div style={{ marginTop: '0.5rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: '1.6' }}>{detailsCandidate.feedback || 'Nenhuma observação registrada neste processo.'}</div></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}><button className="btn-secondary" onClick={() => setDetailsCandidate(null)}>Fechar Visualização</button></div>
          </div>
        </div>
      )}

      {admissionModalCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Definir Data de Admissão</h2><button onClick={() => setAdmissionModalCandidate(null)}><X size={24} color="var(--text-muted)" /></button></div>
            <form onSubmit={handleGridConfirmAdmission} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Data da Admissão</label><input required type="date" min={getTodayISO()} style={{ width: '100%', fontSize: '1rem', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} value={admissionDate} onChange={e => setAdmissionDate(e.target.value)} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}><button type="button" className="btn-secondary" onClick={() => setAdmissionModalCandidate(null)}>Cancelar</button><button type="submit" className="btn-primary">Confirmar e Mover</button></div>
            </form>
          </div>
        </div>
      )}

      {rejectCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}><h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>Cancelar Admissão / Interromper</h2><button onClick={() => setRejectCandidate(null)}><X size={24} color="var(--text-muted)" /></button></div>
            <form onSubmit={handleConfirmReject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Motivo do Cancelamento *</label><select required style={{ width: '100%', padding: '0.6rem' }} value={rejectForm.reasonId} onChange={e => setRejectForm({...rejectForm, reasonId: e.target.value})}><option value="">-- Selecione --</option>{cancellationReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Observações Extras</label><textarea style={{ width: '100%', minHeight: '80px', padding: '0.6rem' }} value={rejectForm.notes} onChange={e => setRejectForm({...rejectForm, notes: e.target.value})} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}><button type="button" className="btn-secondary" onClick={() => setRejectCandidate(null)}>Voltar</button><button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--danger-color)' }}>Confirmar</button></div>
            </form>
          </div>
        </div>
      )}

      {feedbackCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Adicionar Mensagem</h2><button onClick={() => setFeedbackCandidate(null)}><X size={24} color="var(--text-muted)" /></button></div>
            <form onSubmit={handleSaveFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><textarea required style={{ width: '100%', minHeight: '100px', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }} placeholder="Sua mensagem..." value={feedbackText} onChange={e => setFeedbackText(e.target.value)} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}><button type="button" className="btn-secondary" onClick={() => setFeedbackCandidate(null)}>Cancelar</button><button type="submit" className="btn-primary">Salvar Mensagem</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
