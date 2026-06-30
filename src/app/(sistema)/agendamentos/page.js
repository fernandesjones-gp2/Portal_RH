'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Plus, Edit2, MessageSquare, ThumbsUp, ThumbsDown, Database, X, Filter, RotateCcw, Eye } from 'lucide-react';

export default function AgendamentosPage() {
  const [candidates, setCandidates] = useState([]);
  const [allCandidates, setAllCandidates] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cancellationReasons, setCancellationReasons] = useState([]); 
  const [responsibles, setResponsibles] = useState([]);
  const [templates, setTemplates] = useState([]);
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

  const [formData, setFormData] = useState({ process_type: 'Admissão', name: '', mother_name: '', phone: '', cpf: '', rg: '', job_role_id: '', unit_id: '', interview_date: '', gender: '', is_pcd: false });
  const [feedbackText, setFeedbackText] = useState('');
  const [rejectForm, setRejectForm] = useState({ reasonId: '', notes: '' });

  useEffect(() => { 
    fetchData(false); 
    const motorRealTime = setInterval(() => {
      fetchData(true);
    }, 10000);
    return () => clearInterval(motorRealTime);
  }, []);

  async function fetchData(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [allCandsData, unitsRes, rolesRes, usersRes, reasonsRes, templatesRes] = await Promise.all([
        api.candidates.list({ _t: Date.now() }),
        !silent ? api.units.list({ _t: Date.now() }) : Promise.resolve(units),
        !silent ? api.jobRoles.list({ _t: Date.now() }) : Promise.resolve(roles),
        !silent ? api.users.list({ _t: Date.now() }) : Promise.resolve(responsibles),
        !silent ? api.cancellationReasons.list({ _t: Date.now() }).catch(() => []) : Promise.resolve(cancellationReasons),
        !silent ? api.messageTemplates.list({ _t: Date.now() }).catch(() => []) : Promise.resolve(templates)
      ]);

      if (allCandsData) {
        setAllCandidates(allCandsData);
        setCandidates(allCandsData.filter(c => ['Agendado', 'Banco de Talentos', 'Reprovado'].includes(c.status)));
      }
      if (!silent && unitsRes) setUnits(unitsRes);
      if (!silent && rolesRes) setRoles(rolesRes);
      if (!silent && usersRes) setResponsibles(usersRes);
      if (!silent && reasonsRes) setCancellationReasons(reasonsRes);
      if (!silent && templatesRes) setTemplates(templatesRes);

    } catch (error) { 
      console.error('Error fetching data:', error); 
    } finally { 
      if (!silent) setLoading(false); 
    }
  }

  const maskCPF = (val) => {
    return val.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskPhone = (val) => {
    let r = val.replace(/\D/g, "");
    if (r.length > 11) r = r.slice(0, 11);
    if (r.length > 10) return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    if (r.length > 5) return r.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    if (r.length > 2) return r.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    if (r.length > 0) return r.replace(/^(\d{0,2})/, "($1");
    return r;
  };

  const maskName = (val) => {
    return val.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s']/g, "");
  };

  function validateForm(data) {
    if (!data.name || data.name.trim().length < 3) {
      alert('❌ VALIDAÇÃO: O Nome Completo é obrigatório.');
      return false;
    }
    if (!data.mother_name || data.mother_name.trim().length < 3) {
      alert('❌ VALIDAÇÃO: O Nome da Mãe é obrigatório.');
      return false;
    }
    const cleanPhone = (data.phone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      alert('❌ VALIDAÇÃO: O Telefone (WhatsApp) é obrigatório e deve ser válido com DDD (10 a 11 dígitos).');
      return false;
    }
    const cleanCpf = (data.cpf || '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      alert('❌ VALIDAÇÃO: O CPF é obrigatório e deve conter exatamente 11 dígitos.');
      return false;
    }
    if (!data.gender) {
      alert('❌ VALIDAÇÃO: O campo Sexo é obrigatório.');
      return false;
    }
    if (!data.job_role_id) {
      alert('❌ VALIDAÇÃO: O campo Função é obrigatório.');
      return false;
    }
    if (!data.unit_id) {
      alert('❌ VALIDAÇÃO: O campo Unidade é obrigatório.');
      return false;
    }
    return true; 
  }

  function getDuplicateWarning(cpfToCheck, currentCandidateId = null) {
    if (!cpfToCheck) return null;
    const cleanCpf = String(cpfToCheck).replace(/\D/g, '');
    if (cleanCpf.length !== 11) return null;

    const existing = allCandidates.filter(c => 
      c.cpf && 
      String(c.cpf).replace(/\D/g, '') === cleanCpf && 
      c.id !== currentCandidateId
    );

    if (existing.length === 0) return null;

    existing.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

    const latest = existing[0];
    const isClosed = ['Reprovado', 'Concluído', 'Cancelado'].includes(latest.status);
    
    const lastDate = new Date(latest.created_at || new Date());
    const monthsDiff = (new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    const TRAVA_MESES = 6; 
    
    const locationMsg = `Candidato(a): ${latest.name}\nStatus no sistema: ${latest.status}\nFunção: ${latest.job_roles?.name || latest.job_role_name || 'N/A'}\nUnidade: ${latest.units?.name || latest.unit_name || 'N/A'}`;

    if (!isClosed || monthsDiff < TRAVA_MESES) {
      return {
        block: true,
        message: `❌ BLOQUEIO DE SEGURANÇA: CPF JÁ CADASTRADO!\n\nEste CPF já está em uso em um processo ativo ou recente na plataforma:\n\n${locationMsg}\n\nRegra: Apenas processos encerrados há mais de ${TRAVA_MESES} meses podem gerar um novo cadastro.`
      };
    } else {
      return {
        block: false,
        message: `⚠️ AVISO DE DUPLICIDADE (HISTÓRICO ANTIGO)\n\nO sistema identificou um processo antigo para este CPF, encerrado há aprox. ${Math.floor(monthsDiff)} meses:\n\n${locationMsg}\n\nDeseja ignorar o alerta e prosseguir com o processo mesmo assim?`
      };
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
    const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = formatter.formatToParts(d);
    const val = (type) => parts.find(p => p.type === type)?.value;
    return `${val('year')}-${val('month')}-${val('day')}T${val('hour')}:${val('minute')}`;
  };

  const sendWhatsAppMessage = (candidateData, templateId, roleName, unitName, interviewDate) => {
    let textMsg = '';
    const template = templates.find(t => t.id === templateId);
    
    if (template) {
      textMsg = template.content.replace(/\{nome\}/g, candidateData.name || '').replace(/\{funcao\}/g, roleName || '').replace(/\{unidade\}/g, unitName || '');
      if (interviewDate) {
        const dataFormatada = new Date(interviewDate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
        textMsg = textMsg.replace(/\{data_hora\}/g, dataFormatada);
      } else {
         textMsg = textMsg.replace(/\{data_hora\}/g, 'a definir');
      }
    }
    
    if (!textMsg) {
      if (templateId === 'agendamento') textMsg = `Olá ${candidateData.name}, sua entrevista está agendada.`;
      if (templateId === 'aprovacao') textMsg = `Olá ${candidateData.name}, você foi aprovado(a) na nossa entrevista para a função de ${roleName}! Por favor, envie seus documentos.`;
      if (templateId === 'reprovacao') textMsg = `Olá ${candidateData.name}, agradecemos sua participação no processo para ${roleName}. Manteremos seu currículo em nosso banco de reserva.`;
    }
    const msg = encodeURIComponent(textMsg);
    const phone = (candidateData.phone || '').replace(/\D/g, '');
    if(phone) window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
  };

  async function handleSaveCandidate(e) {
    e.preventDefault();

    if (!validateForm(formData)) return;

    if (['Admissão', 'Readmissão'].includes(formData.process_type) && formData.cpf) {
      const warning = getDuplicateWarning(formData.cpf);
      if (warning) {
        if (warning.block) {
          alert(warning.message);
          return; 
        } else {
          if (!confirm(warning.message)) return; 
        }
      }
    }

    let responsible_id = null;
    try {
      const me = await api.me();
      responsible_id = me?.id || null;
    } catch (err) { console.error(err); }

    const interviewIso = getBrazilIsoDate(formData.interview_date);
    const dataToSave = { ...formData, interview_date: interviewIso, responsible_id, gender: formData.gender || null, is_pcd: formData.is_pcd ? true : false };

    try { await api.candidates.create(dataToSave); } catch (e) { return alert('Erro ao salvar candidato: ' + e.message); }

    const roleName = roles.find(r => r.id === formData.job_role_id)?.name || '';
    const unitName = units.find(u => u.id === formData.unit_id)?.name || '';

    if (interviewIso) {
      try {
        const eventTitle = encodeURIComponent(`${formData.process_type} - ${formData.name} - ${roleName} - ${unitName}`);
        const dAgenda = new Date(interviewIso);
        const dateStr = dAgenda.toISOString().replace(/-|:|\.\d\d\d/g, "");
        const dEnd = new Date(dAgenda.getTime() + 60 * 60 * 1000); 
        const dateEndStr = dEnd.toISOString().replace(/-|:|\.\d\d\d/g, "");
        window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${dateStr}/${dateEndStr}&details=Candidato:+${formData.name}%0ATelefone:+${formData.phone}`, '_blank');
      } catch (err) {}
    }

    if (confirm('Deseja enviar o convite de agendamento para o WhatsApp do candidato?')) sendWhatsAppMessage(formData, 'agendamento', roleName, unitName, interviewIso);

    setIsModalOpen(false);
    setFormData({ process_type: 'Admissão', name: '', mother_name: '', phone: '', cpf: '', rg: '', job_role_id: '', unit_id: '', interview_date: '', gender: '', is_pcd: false });
    fetchData(true); 
  }

  async function handleUpdateCandidate(e) {
    e.preventDefault();

    if (!validateForm(editingCandidate)) return;

    const { id, process_type, name, mother_name, phone, cpf, rg, job_role_id, unit_id, interview_date, responsible_id, gender, is_pcd } = editingCandidate;
    
    if (['Admissão', 'Readmissão'].includes(process_type) && cpf) {
      const warning = getDuplicateWarning(cpf, id);
      if (warning) {
        if (warning.block) {
          alert(warning.message);
          return; 
        } else {
          if (!confirm(warning.message)) return; 
        }
      }
    }

    const interviewIso = getBrazilIsoDate(interview_date);

    try { await api.candidates.update(id, { process_type, name, mother_name, phone, cpf, rg, job_role_id, unit_id, interview_date: interviewIso, responsible_id, gender, is_pcd }); } 
    catch (e) { return alert('Erro ao atualizar: ' + e.message); }
    setEditingCandidate(null);
    fetchData(true);
  }

  function openFeedbackModal(c) { setFeedbackCandidate(c); setFeedbackText(''); }

  async function handleSaveFeedback() {
    if (!feedbackText.trim()) return alert('O campo de parecer não pode estar vazio.');
    let userDisplay = 'N/A';
    try { const me = await api.me(); userDisplay = me?.name || 'N/A'; } catch (err) {}

    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const newNote = `\n--- Adicionado em ${timestamp} por ${userDisplay} ---\n${feedbackText}\n`;
    try {
      await api.candidates.update(feedbackCandidate.id, { feedback: (feedbackCandidate.feedback || '') + newNote });
      setFeedbackCandidate(null); setFeedbackText(''); fetchData(true);
    } catch (e) { alert('Erro ao salvar parecer.'); }
  }

  async function handleConfirmReject(e) {
    e.preventDefault();
    if (!rejectForm.reasonId) return alert('Selecione o motivo principal.');

    const selectedReasonObj = cancellationReasons.find(r => r.id === rejectForm.reasonId);
    let userDisplay = 'N/A';
    try { const me = await api.me(); userDisplay = me?.name || 'N/A'; } catch (err) {}

    const cancellationDate = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const auditingBlock = `\n--- AUDITORIA DE CANCELAMENTO ---\n• Data e Hora: ${cancellationDate}\n• Usuário Executor: ${userDisplay}\n• Motivo Principal: ${selectedReasonObj ? selectedReasonObj.name : 'Outros'}\n• Fase/Status no momento: ${rejectCandidate.status}\n${rejectForm.notes ? `• Observações Adicionais: ${rejectForm.notes}\n` : ''}---------------------------------`;
    
    try {
      await api.candidates.update(rejectCandidate.id, { status: 'Reprovado', cancellation_reason_id: rejectForm.reasonId, feedback: (rejectCandidate.feedback || '') + auditingBlock });
      if (confirm('Deseja enviar a mensagem de aviso (Reprovação/Banco) no WhatsApp do candidato?')) sendWhatsAppMessage(rejectCandidate, 'reprovacao', rejectCandidate.job_roles?.name || rejectCandidate.job_role_name, rejectCandidate.units?.name || rejectCandidate.unit_name, rejectCandidate.interview_date);
      setRejectCandidate(null); setRejectForm({ reasonId: '', notes: '' }); fetchData(true);
    } catch (e) { alert('Erro ao arquivar processo.'); }
  }

  async function changeStatus(candidate, newStatus) {
    try {
      await api.candidates.update(candidate.id, { status: newStatus });
      if (newStatus === 'Banco de Talentos' && confirm('Deseja avisar o candidato pelo WhatsApp que ele foi para o Banco de Talentos?')) {
        sendWhatsAppMessage(candidate, 'reprovacao', candidate.job_roles?.name || candidate.job_role_name, candidate.units?.name || candidate.unit_name, candidate.interview_date);
      }
      fetchData(true);
    } catch (e) {}
  }

  async function handleApprove(candidate) {
    if (confirm('Deseja enviar a mensagem de Aprovação no WhatsApp do candidato?')) {
      sendWhatsAppMessage(candidate, 'aprovacao', candidate.job_roles?.name || candidate.job_role_name, candidate.units?.name || candidate.unit_name, candidate.interview_date);
    }
    
    try {
      if (candidate.process_type === 'Promoção') {
        await api.candidates.update(candidate.id, { status: 'Promoção (Em Andamento)' });
      } else {
        await api.candidates.update(candidate.id, { 
          status: 'Pré-Admissão (Pendente)', 
          docs_status: 'Solicitada', 
          docs_request_date: new Date().toISOString() 
        });
      }
      fetchData(true);
    } catch (e) {
      alert('Erro ao aprovar candidato.');
    }
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
    } else if (filterDate && !c.interview_date) return false; 
    return true;
  }).sort((a, b) => {
    if (currentTab === 'Agendado') return (a.interview_date ? new Date(a.interview_date).getTime() : Infinity) - (b.interview_date ? new Date(b.interview_date).getTime() : Infinity);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div><h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Processos Seletivos</h1><p style={{ color: 'var(--text-muted)' }}>Gerencie as entrevistas, banco de talentos e histórico.</p></div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}><Plus size={20} /> Novo Candidato</button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        <button className={currentTab === 'Agendado' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentTab('Agendado')}>Entrevistas (Agendados)</button>
        <button className={currentTab === 'Banco de Talentos' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentTab('Banco de Talentos')} style={{ backgroundColor: currentTab === 'Banco de Talentos' ? 'var(--saritur-brown)' : 'white' }}>Banco de Talentos / Reservas</button>
        <button className={currentTab === 'Reprovado' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentTab('Reprovado')} style={{ backgroundColor: currentTab === 'Reprovado' ? 'var(--danger-color)' : 'white', color: currentTab === 'Reprovado' ? 'white' : 'var(--text-main)' }}>Reprovados / Cancelados</button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap', backgroundColor: 'var(--surface-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', alignItems: 'center' }}>
        <Filter size={20} color="var(--text-muted)" /><span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)', marginRight: '0.5rem' }}>Filtros:</span>
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterProcessType} onChange={e => setFilterProcessType(e.target.value)}><option value="">Todos Processos</option><option value="Admissão">Admissão</option><option value="Readmissão">Readmissão</option><option value="Promoção">Promoção</option></select>
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterUnit} onChange={e => setFilterUnit(e.target.value)}><option value="">Todas Unidades</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}><option value="">Todas Funções</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}><option value="">Todos Responsáveis</option>{responsibles.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select>
        <input type="date" title="Filtrar por data" style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
      </div>

      {loading ? (<p>Carregando candidatos...</p>) : sortedFilteredCandidates.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}><p style={{ color: 'var(--text-muted)' }}>Nenhum candidato encontrado com estes filtros.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {sortedFilteredCandidates.map((c) => (
            <div key={c.id} style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ backgroundColor: c.process_type === 'Promoção' ? 'var(--saritur-yellow)' : 'var(--saritur-orange)', color: c.process_type === 'Promoção' ? 'black' : 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{c.process_type}</span>
                  {c.is_pcd && <span style={{ backgroundColor: '#0284c7', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>PCD</span>}
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{c.name}</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{c.job_roles?.name || c.job_role_name} • {c.units?.name || c.unit_name} • CPF: {c.cpf}</p>
                <p style={{ color: 'var(--text-main)', fontSize: '0.875rem', fontWeight: '500', marginTop: '0.5rem' }}>Entrevista: {c.interview_date ? new Date(c.interview_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : 'N/A'} • Resp: {c.users?.name || c.responsible_name || 'N/A'}</p>
                {currentTab === 'Reprovado' && c.feedback && (<div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--danger-color)', border: '1px solid rgba(239, 68, 68, 0.2)' }}><strong>Histórico / Reprovação:</strong> {c.feedback}</div>)}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => openFeedbackModal(c)} title="Parecer / Histórico"><MessageSquare size={16} /></button>
                
                {/* NOVO: BOTÃO DE DETALHES PARA REPROVADO E BANCO DE TALENTOS */}
                {(currentTab === 'Reprovado' || currentTab === 'Banco de Talentos') && (
                  <button className="btn-secondary" onClick={() => setDetailsCandidate(c)} title="Ver Detalhes Completos">
                    <Eye size={16} style={{ marginRight: '4px' }}/> Ver Detalhes
                  </button>
                )}

                {currentTab === 'Agendado' && (<><button className="btn-secondary" onClick={() => setEditingCandidate(c)} title="Editar Cadastro"><Edit2 size={16} /></button><button className="btn-secondary" onClick={() => changeStatus(c, 'Banco de Talentos')} title="Mover para Banco de Talentos"><Database size={16} /></button><button className="btn-secondary" onClick={() => handleApprove(c)} style={{ color: 'var(--success-color)', borderColor: 'var(--success-color)' }} title="Aprovar (Avançar)"><ThumbsUp size={16} /></button><button className="btn-secondary" onClick={() => setRejectCandidate(c)} style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} title="Reprovar / Cancelar"><ThumbsDown size={16} /></button></>)}
                {(currentTab === 'Banco de Talentos' || currentTab === 'Reprovado') && <button className="btn-primary" onClick={() => changeStatus(c, 'Agendado')} style={{ backgroundColor: 'var(--saritur-orange)' }} title="Retomar Processo"><RotateCcw size={16} style={{ marginRight: '4px' }}/> Retomar Processo</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- NOVO: MODAL DETALHES COMPLETO DO CANDIDATO --- */}
      {detailsCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Detalhamento do Candidato</h2>
              <button onClick={() => setDetailsCandidate(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome Completo</span>
                  <p style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    {detailsCandidate.name}
                    {detailsCandidate.is_pcd && <span style={{ fontSize: '0.7rem', backgroundColor: '#0284c7', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem', verticalAlign: 'middle' }}>PCD</span>}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tipo de Processo</span>
                  <p style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: '500' }}>{detailsCandidate.process_type}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CPF</span>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.cpf}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>RG</span>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.rg || '-'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sexo</span>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.gender || '-'}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Função Designada</span>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.job_roles?.name || detailsCandidate.job_role_name || '-'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unidade de Lotação</span>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.units?.name || detailsCandidate.unit_name || '-'}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Telefone (WhatsApp)</span>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.phone}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome da Mãe</span>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{detailsCandidate.mother_name}</p>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Datas Importantes</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                  <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Data da Entrevista</span>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>{detailsCandidate.interview_date ? new Date(detailsCandidate.interview_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</p>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Histórico Completo</span>
                <div style={{ marginTop: '0.5rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: '1.6' }}>
                  {detailsCandidate.feedback || 'Nenhuma observação registrada neste processo.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button className="btn-secondary" onClick={() => setDetailsCandidate(null)}>Fechar Visualização</button>
            </div>
          </div>
        </div>
      )}

      {(isModalOpen || editingCandidate) && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{editingCandidate ? 'Editar Candidato' : 'Novo Candidato'}</h2><button onClick={() => { setIsModalOpen(false); setEditingCandidate(null); }}><X size={24} color="var(--text-muted)" /></button></div>
            <form onSubmit={editingCandidate ? handleUpdateCandidate : handleSaveCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(() => {
                const data = editingCandidate || formData; const setData = editingCandidate ? setEditingCandidate : setFormData;
                return (
                  <>
                    <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Tipo de Processo</label><select required style={{ width: '100%' }} value={data.process_type} onChange={e => setData({...data, process_type: e.target.value})}><option value="Admissão">Admissão</option><option value="Readmissão">Readmissão</option><option value="Promoção">Promoção</option></select></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Nome Completo</label><input required type="text" style={{ width: '100%' }} value={data.name} onChange={e => setData({...data, name: maskName(e.target.value)})} placeholder="Apenas letras" /></div><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Nome da Mãe</label><input required type="text" style={{ width: '100%' }} value={data.mother_name} onChange={e => setData({...data, mother_name: maskName(e.target.value)})} placeholder="Apenas letras" /></div></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Telefone (WhatsApp)</label><input required type="text" style={{ width: '100%' }} value={data.phone} onChange={e => setData({...data, phone: maskPhone(e.target.value)})} placeholder="(00) 00000-0000" /></div><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>CPF</label><input required type="text" style={{ width: '100%' }} value={data.cpf} onChange={e => setData({...data, cpf: maskCPF(e.target.value)})} placeholder="000.000.000-00" /></div><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>RG (Opcional)</label><input type="text" style={{ width: '100%' }} value={data.rg} onChange={e => setData({...data, rg: e.target.value})} placeholder="Número do RG" /></div></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Sexo *</label><select required style={{ width: '100%' }} value={data.gender || ''} onChange={e => setData({...data, gender: e.target.value})}><option value="">Selecione...</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option></select></div><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}><input type="checkbox" id={`pcd_${data.id || 'new'}`} checked={data.is_pcd || false} onChange={e => setData({...data, is_pcd: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--saritur-orange)' }} /><label htmlFor={`pcd_${data.id || 'new'}`} style={{ fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>Candidato PCD</label></div></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Função</label><select required style={{ width: '100%' }} value={data.job_role_id || ''} onChange={e => setData({...data, job_role_id: e.target.value})}><option value="">-- Selecione a função --</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Unidade</label><select required style={{ width: '100%' }} value={data.unit_id || ''} onChange={e => setData({...data, unit_id: e.target.value})}><option value="">-- Selecione a unidade --</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div></div>
                    <div style={{ display: 'grid', gridTemplateColumns: editingCandidate ? '1fr 1fr' : '1fr', gap: '1rem' }}><div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Data e Hora da Entrevista</label><input required type="datetime-local" style={{ width: '100%' }} value={formatToBrazilDatetimeInput(data.interview_date)} onChange={e => setData({...data, interview_date: e.target.value})} /></div>{editingCandidate && (<div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Responsável pelo Processo</label><select required style={{ width: '100%' }} value={data.responsible_id || ''} onChange={e => setData({...data, responsible_id: e.target.value})}><option value="">Selecione o responsável</option>{responsibles.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}</select></div>)}</div>
                  </>
                );
              })()}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}><button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setEditingCandidate(null); }}>Cancelar</button><button type="submit" className="btn-primary">{editingCandidate ? 'Atualizar Dados' : 'Salvar e Agendar'}</button></div>
            </form>
          </div>
        </div>
      )}

      {feedbackCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Histórico do Processo: {feedbackCandidate.name}</h2><button onClick={() => setFeedbackCandidate(null)}><X size={24} color="var(--text-muted)" /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{feedbackCandidate.feedback && (<div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Histórico Atual</label><div style={{ width: '100%', maxHeight: '180px', overflowY: 'auto', padding: '0.75rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{feedbackCandidate.feedback}</div></div>)}<div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Adicionar Novo Parecer</label><textarea style={{ width: '100%', minHeight: '100px', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} placeholder="Digite as notas..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} /></div></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}><button className="btn-secondary" onClick={() => setFeedbackCandidate(null)}>Cancelar</button><button className="btn-primary" onClick={handleSaveFeedback}>Gravar Parecer</button></div>
          </div>
        </div>
      )}

      {rejectCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}><h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>Reprovar Candidato</h2><button onClick={() => setRejectCandidate(null)}><X size={24} color="var(--text-muted)" /></button></div><p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>O candidato <strong>{rejectCandidate.name}</strong> será movido para o histórico de reprovados.</p>
            <form onSubmit={handleConfirmReject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Motivo da Reprovação *</label><select required style={{ width: '100%', padding: '0.6rem' }} value={rejectForm.reasonId} onChange={e => setRejectForm({...rejectForm, reasonId: e.target.value})}><option value="">-- Selecione o motivo do banco --</option>{cancellationReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Observações (Opcional)</label><textarea style={{ width: '100%', minHeight: '80px', padding: '0.6rem' }} placeholder="Detalhes..." value={rejectForm.notes} onChange={e => setRejectForm({...rejectForm, notes: e.target.value})} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}><button type="button" className="btn-secondary" onClick={() => setRejectCandidate(null)}>Cancelar</button><button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--danger-color)' }}>Confirmar Reprovação</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
