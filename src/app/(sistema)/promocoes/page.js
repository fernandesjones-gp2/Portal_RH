'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { TrendingUp, SearchX, Plus, X, CheckCircle, FileText, AlertTriangle, Calendar, PenTool, MessageSquare, RotateCcw, LayoutGrid, Archive, Users, Filter, Clock, Eye, Download } from 'lucide-react';

export default function PromocoesPage() {
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [loading, setLoading] = useState(true);

  const [promotions, setPromotions] = useState([]);
  const [approvedCandidates, setApprovedCandidates] = useState([]); 
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState(null); 
  const [detailsPromotion, setDetailsPromotion] = useState(null); 
  
  const [currentView, setCurrentView] = useState('pipeline'); 
  const [filterUnit, setFilterUnit] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterOnlyMine, setFilterOnlyMine] = useState(false);
  
  const [actionModal, setActionModal] = useState(null); 
  const [feedbackText, setFeedbackText] = useState('');
  const [observations, setObservations] = useState({});

  const initialForm = {
    type: 'Horizontal', collaborator_name: '', collaborator_cpf: '', admission_date: '',
    current_role: '', proposed_role: '', current_salary: '', proposed_salary: '',
    current_sector: '', proposed_sector: '', current_unit_id: '', proposed_unit_id: '',
    promotion_month_year: ''
  };
  const [formData, setFormData] = useState(initialForm);

  // --- ATUALIZAÇÃO AUTOMÁTICA (10 SEGUNDOS) ---
  useEffect(() => { 
    fetchData(false); // Primeira carga com loading na tela
    
    const intervalId = setInterval(() => {
      fetchData(true); // Cargas subsequentes em background (silenciosas)
    }, 3000);
    
    return () => clearInterval(intervalId); // Limpa o intervalo ao sair da tela
  }, []);

  async function fetchData(isBackground = false) {
    if (!isBackground) setLoading(true);
    try {
      const sessionUser = await api.me();
      if (sessionUser) {
        setCurrentUserRole(sessionUser.role || sessionUser.data?.role || '');
        setCurrentUserId(sessionUser.id || sessionUser.data?.id || '');
        setCurrentUserName(sessionUser.name || sessionUser.data?.name || 'Usuário');
      }

      const resPromo = await fetch('/api/promotions?_t=' + Date.now());
      const promosRes = await resPromo.json();

      const [candsRes, unitsRes, rolesRes] = await Promise.all([
        api.candidates.list({ _t: Date.now() }).catch(() => []),
        api.units.list().catch(() => []),
        api.jobRoles.list().catch(() => []) 
      ]);

      const activePromotions = Array.isArray(promosRes) ? promosRes : [];
      setPromotions(activePromotions);
      setUnits(unitsRes || []);
      setRoles(rolesRes || []); 

      if (candsRes && Array.isArray(candsRes)) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        // --- FILTRO DO BANCO DO PSICÓLOGO AJUSTADO ---
        const validados = candsRes.filter(c => {
          // 1. Deve ser processo de Promoção
          if (c.process_type !== 'Promoção') return false;
          
          // 2. O candidato só fica no Banco se estiver "Em Andamento". 
          // Assim que vira "Em Análise" (entra no Kanban), ele sai do banco.
          if (c.status !== 'Promoção (Em Andamento)') return false;
          
          // 3. Validade do laudo (6 meses)
          if (new Date(c.created_at) < sixMonthsAgo) return false;
          
          // 4. Não pode ter uma promoção ativa atrelada a ele
          const hasActivePromo = activePromotions.some(p => p.candidate_id === c.id && !['Cancelado', 'Reprovado pela Liderança'].includes(p.status));
          if (hasActivePromo) return false;
          
          return true;
        });
        setApprovedCandidates(validados);
      }
    } catch (error) {
      console.error('Erro ao sincronizar dados:', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }

  const maskCPF = (val) => val.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
  const maskCurrency = (val) => {
    let v = String(val).replace(/\D/g, '');
    v = (v / 100).toFixed(2) + '';
    v = v.replace(".", ",");
    v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
    return v;
  };
  const formatMonthYear = (val) => val.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1/$2').slice(0, 7);

  const uniqueRoleNames = [...new Set(roles.map(r => r.name))].sort();

  const getSectorsForRole = (roleName) => {
    const matchingRoles = roles.filter(r => r.name === roleName);
    const sectors = matchingRoles.map(r => r.sector).filter(Boolean);
    return [...new Set(sectors)].sort(); 
  };

  const currentAvailableSectors = getSectorsForRole(formData.current_role);
  const proposedAvailableSectors = getSectorsForRole(formData.proposed_role);

  const handleCurrentRoleChange = (e) => {
    const newRole = e.target.value;
    const sectors = getSectorsForRole(newRole);
    setFormData({ ...formData, current_role: newRole, current_sector: sectors.length === 1 ? sectors[0] : '' });
  };

  const handleProposedRoleChange = (e) => {
    const newRole = e.target.value;
    const sectors = getSectorsForRole(newRole);
    setFormData({ ...formData, proposed_role: newRole, proposed_sector: sectors.length === 1 ? sectors[0] : '' });
  };

  async function handleSavePromotion(e) {
    e.preventDefault();

    let linkedCandidateId = formData.candidate_id || null;
    if (formData.type === 'Vertical' && !linkedCandidateId) {
      const cleanCpf = formData.collaborator_cpf.replace(/\D/g, '');
      const validCandidate = approvedCandidates.find(c => c.cpf && String(c.cpf).replace(/\D/g, '') === cleanCpf);
      if (!validCandidate) {
        alert('❌ BLOQUEIO: Este colaborador NÃO possui uma entrevista de promoção válida aprovada nos últimos 6 meses pelo psicólogo.');
        return;
      }
      linkedCandidateId = validCandidate.id;
    }

    const cRoleObj = roles.find(r => r.name === formData.current_role && (r.sector || '') === (formData.current_sector || ''));
    const pRoleObj = roles.find(r => r.name === formData.proposed_role && (r.sector || '') === (formData.proposed_sector || ''));

    const payload = {
      ...formData,
      current_salary: String(formData.current_salary).replace(/\./g, '').replace(',', '.'),
      proposed_salary: String(formData.proposed_salary).replace(/\./g, '').replace(',', '.'),
      requester_id: currentUserId,
      candidate_id: linkedCandidateId,
      status: 'Aguardando Liderança',
      current_role_id: cRoleObj ? cRoleObj.id : null,
      proposed_role_id: pRoleObj ? pRoleObj.id : null,
      feedback: editingPromotionId ? `${formData.feedback || ''}\n🔄 [FLUXO] Processo corrigido e reiniciado por ${currentUserName} em ${new Date().toLocaleString('pt-BR')}` : ''
    };

    try {
      if (editingPromotionId) {
        await fetch(`/api/promotions/${editingPromotionId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await api.promotions.create(payload);
        if (linkedCandidateId) {
          await api.candidates.update(linkedCandidateId, { status: 'Promoção (Em Análise)' });
        }
      }

      alert('Solicitação de Promoção gravada com sucesso!');
      setFormData(initialForm);
      setEditingPromotionId(null);
      setIsModalOpen(false);
      fetchData(false);
    } catch (err) {
      alert('Erro ao gravar solicitação: ' + err.message);
    }
  }

  const [obsModal, setObsModal] = useState(null);
  const [obsText, setObsText] = useState('');

  async function handleSaveObservation(e) {
    e.preventDefault();
    if (!obsText.trim()) return alert("Digite um parecer válido.");

    const promo = obsModal;
    const note = `\n💬 [PARECER] Por ${currentUserName} em ${new Date().toLocaleString('pt-BR')}:\n"${obsText}"\n`;
    const newFeedback = (promo.feedback || '') + note;

    try {
      const response = await fetch(`/api/promotions/${promo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: newFeedback })
      });

      if (response.ok) {
        alert('Parecer adicionado ao histórico do processo!');
        setObsModal(null);
        setObsText('');
        fetchData(false);
      } else {
        alert('Erro ao salvar parecer no servidor.');
      }
    } catch (err) {
      alert('Erro de comunicação.');
    }
  }

  async function executeWorkflowAction(promo, statusName, extraPayload = {}) {
    try {
      const obs = observations[promo.id];
      let newFeedback = promo.feedback || '';
      if (extraPayload.feedback) { newFeedback = extraPayload.feedback; delete extraPayload.feedback; }
      if (obs && obs.trim()) { newFeedback += `\n💬 [OBSERVAÇÃO] Por ${currentUserName} em ${new Date().toLocaleString('pt-BR')}:\n"${obs}"\n`; }

      const payload = { status: statusName, feedback: newFeedback, ...extraPayload };

      const response = await fetch(`/api/promotions/${promo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert(`Operação realizada com sucesso! Status atualizado para: ${statusName}`);
        setActionModal(null);
        setFeedbackText('');
        setObservations(prev => ({ ...prev, [promo.id]: '' }));
        fetchData(false);
      } else {
        alert('Erro ao processar alteração no servidor.');
      }
    } catch (e) {
      alert('Erro de comunicação.');
    }
  }

  const handleExportPDF = (p) => {
    const printWindow = window.open('', '', 'width=900,height=700');
    const logoUrl = window.location.origin + '/logo.png'; 
    const html = `
      <html><head><title>Relatório de Promoção - ${p.collaborator_name}</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; margin: 0 auto; color: #333; line-height: 1.3; font-size: 0.85rem; max-width: 100%; background-color: #ffffff; }
        @media print { body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        .header-container { display: flex; align-items: center; border-bottom: 2px solid #057a55; padding-bottom: 0.5rem; margin-bottom: 1rem; }
        .logo { max-height: 45px; margin-right: 1rem; object-fit: contain; }
        h1 { color: #057a55; font-size: 1.25rem; text-transform: uppercase; margin: 0; }
        h2 { color: #444; font-size: 1rem; margin-top: 1rem; margin-bottom: 0.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.2rem; }
        .grid { display: flex; gap: 1rem; margin-bottom: 1rem; }
        .col { flex: 1; }
        p { margin: 0.25rem 0; font-size: 0.85rem; }
        .label { font-weight: bold; color: #555; display: inline-block; width: 125px; }
        table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.8rem; }
        th, td { border: 1px solid #ddd; padding: 0.4rem; text-align: left; }
        th { background-color: #f9fafb; font-weight: bold; color: #333; }
        .audit-timeline { background: #f9fafb; padding: 0.8rem; border-radius: 6px; border: 1px solid #eee; }
        .audit-item { margin-bottom: 0.4rem; font-size: 0.8rem; }
        .obs-box { background: #fffbeb; border: 1px solid #fde68a; padding: 0.8rem; border-radius: 6px; white-space: pre-wrap; font-size: 0.8rem; margin-top: 0.5rem; line-height: 1.4; max-height: 180px; overflow: hidden; }
        .footer { margin-top: 1.5rem; text-align: center; color: #999; font-size: 0.7rem; border-top: 1px solid #eee; padding-top: 0.5rem; }
      </style>
      </head><body>
      
      <div class="header-container">
        <img src="${logoUrl}" class="logo" alt="Logo" onerror="this.style.display='none'" />
        <h1>Documento de Promoção - ${p.type}</h1>
      </div>
      
      <div class="grid">
        <div class="col">
          <p><span class="label">Colaborador:</span> ${p.collaborator_name}</p>
          <p><span class="label">CPF:</span> ${p.collaborator_cpf}</p>
          <p><span class="label">Admissão Original:</span> ${p.admission_date ? new Date(p.admission_date).toLocaleDateString('pt-BR') : 'N/A'}</p>
        </div>
        <div class="col">
          <p><span class="label">Status Final:</span> <strong>${p.status}</strong></p>
          <p><span class="label">Mês de Efetivação:</span> 01/${p.promotion_month_year}</p>
          <p><span class="label">Emitido em:</span> ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
      </div>
      
      <h2>Comparativo de Mudança</h2>
      <table>
        <tr><th>Campo</th><th>Situação Anterior</th><th>Situação Proposta/Aprovada</th></tr>
        <tr><td><strong>Cargo</strong></td><td>${p.current_role}</td><td>${p.proposed_role}</td></tr>
        <tr><td><strong>Salário</strong></td><td>R$ ${Number(p.current_salary || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td>R$ ${Number(p.proposed_salary || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td></tr>
        <tr><td><strong>Setor</strong></td><td>${p.current_sector}</td><td>${p.proposed_sector}</td></tr>
        <tr><td><strong>Unidade</strong></td><td>${p.current_unit_name || 'N/A'}</td><td>${p.proposed_unit_name || 'N/A'}</td></tr>
      </table>
      
      <h2>Linha do Tempo de Auditoria e Assinaturas</h2>
      <div class="audit-timeline">
        <div class="audit-item">➕ <strong>Abertura do Processo:</strong> ${p.requester_name || 'Gestor'} - ${p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : 'N/A'}</div>
        ${p.leadership_signature_date ? `<div class="audit-item">✍️ <strong>Assinatura Liderança:</strong> ${p.leadership_approver_name || 'Aprovador'} - ${new Date(p.leadership_signature_date).toLocaleString('pt-BR')}</div>` : ''}
        ${p.gp2_signature_date ? `<div class="audit-item">✅ <strong>Validação GP²:</strong> ${p.gp2_approver_name || 'Aprovador'} - ${new Date(p.gp2_signature_date).toLocaleString('pt-BR')}</div>` : ''}
        ${p.dp_signature_date ? `<div class="audit-item">✅ <strong>Efetivação DP:</strong> ${p.dp_approver_name || 'Aprovador'} - ${new Date(p.dp_signature_date).toLocaleString('pt-BR')}</div>` : ''}
      </div>
      
      <h2>Histórico Completo de Observações e Pareceres</h2>
      <div class="obs-box">${p.feedback || 'Nenhuma observação extra registrada neste processo.'}</div>
      
      <div class="footer">Portal RH - Gestão de Promoções | Documento gerado e validado eletronicamente</div>
      <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
      </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  const roleSafe = (currentUserRole || '').toUpperCase();
  const isUserLeadership = ['ADMIN', 'SUPERINTENDENT', 'MANAGER'].includes(roleSafe);
  const isUserGP2 = ['ADMIN', 'GP²', 'GP2', 'RECRUITER', 'RECRUITER_ANALYST'].includes(roleSafe);
  const isUserDP = ['ADMIN', 'DP'].includes(roleSafe);

  const filteredAll = promotions.filter(p => {
    if (filterUnit && p.current_unit_id !== filterUnit && p.proposed_unit_id !== filterUnit) return false;
    if (filterOnlyMine && p.requester_id !== currentUserId) return false;
    if (filterDate && p.created_at) {
      const d = new Date(p.created_at);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localStr = new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
      if (localStr !== filterDate) return false;
    }
    return true;
  });

  const historyPromos = filteredAll.filter(p => ['Concluído', 'Cancelado', 'Reprovado pela Liderança'].includes(p.status));
  const activePromos = filteredAll.filter(p => !['Concluído', 'Cancelado', 'Reprovado pela Liderança'].includes(p.status));

  const blocoLideranca = activePromos.filter(p => p.status === 'Aguardando Liderança' || p.status === 'Recusado pelo GP2 (Ajustes)');
  const blocoGP2 = activePromos.filter(p => p.status === 'Aguardando GP2');
  const blocoDP = activePromos.filter(p => p.status === 'Aguardando DP');

  const filteredPsi = approvedCandidates.filter(c => {
    if (filterUnit && c.unit_id !== filterUnit) return false;
    if (filterDate && c.created_at) {
      const d = new Date(c.created_at);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localStr = new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
      if (localStr !== filterDate) return false;
    }
    return true;
  });

  const renderPromoCard = (p) => {
    const canActOnLideranca = p.status === 'Aguardando Liderança' && isUserLeadership;
    const canActOnGP2 = p.status === 'Aguardando GP2' && isUserGP2;
    const canActOnDP = p.status === 'Aguardando DP' && isUserDP;
    const canActOnAjustes = p.status === 'Recusado pelo GP2 (Ajustes)' && p.requester_id === currentUserId;
    const hasActions = canActOnLideranca || canActOnGP2 || canActOnDP || canActOnAjustes;

    return (
      <div key={p.id} className="glass-panel" style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', borderTop: p.type === 'Vertical' ? '4px solid #0284c7' : '4px solid var(--saritur-orange)', backgroundColor: 'var(--surface-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <TrendingUp size={14} color={p.type === 'Vertical' ? '#0284c7' : 'var(--saritur-orange)'} />
            <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold' }}>{p.type}</span>
          </div>
          <span style={{ fontSize: '0.6rem', fontWeight: 'bold', color: currentView === 'historico' ? 'var(--text-muted)' : 'var(--saritur-orange)' }}>{p.status}</span>
        </div>
        
        <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', margin: '0.2rem 0' }}>{p.collaborator_name}</h3>
        
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: '1.3' }}>
          <div><strong>Cargo:</strong> {p.current_role} ➔ {p.proposed_role}</div>
          <div><strong>Unid:</strong> {p.current_unit_name || 'N/A'} ➔ {p.proposed_unit_name || 'N/A'}</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.4rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem' }}>
          <Calendar size={12} color="var(--text-muted)" />
          <span>Efetivação: 01/{p.promotion_month_year}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.25rem' }}>
          <button onClick={() => setDetailsPromotion(p)} className="btn-secondary" style={{ padding: '0.3rem', fontSize: '0.7rem', justifyContent: 'center' }}>
            <Eye size={12} style={{ marginRight: '4px' }} /> Raio-X
          </button>
          <button onClick={() => setObsModal(p)} className="btn-secondary" style={{ padding: '0.3rem', fontSize: '0.7rem', justifyContent: 'center' }}>
            <MessageSquare size={12} style={{ marginRight: '4px' }} /> Parecer
          </button>
        </div>

        {currentView === 'pipeline' && hasActions && (
          <div style={{ marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {canActOnLideranca && (
              <>
                <button onClick={() => executeWorkflowAction(p, 'Aguardando GP2', { leadership_approver_id: currentUserId, leadership_signature_date: new Date().toISOString() })} className="btn-primary" style={{ flex: 1, fontSize: '0.7rem', padding: '0.3rem', backgroundColor: '#057a55', justifyContent: 'center' }}><PenTool size={12} style={{ marginRight: '4px' }}/> Aprovar</button>
                <button onClick={() => executeWorkflowAction(p, 'Reprovado pela Liderança')} className="btn-secondary" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)', fontSize: '0.7rem', padding: '0.3rem' }}>Reprovar</button>
              </>
            )}
            {canActOnGP2 && (
              <>
                <button onClick={() => executeWorkflowAction(p, 'Aguardando DP', { gp2_approver_id: currentUserId, gp2_signature_date: new Date().toISOString() })} className="btn-primary" style={{ flex: 1, fontSize: '0.7rem', padding: '0.3rem', justifyContent: 'center' }}><CheckCircle size={12} style={{ marginRight: '4px' }}/> Validar</button>
                <button onClick={() => setActionModal({ type: 'reject_gp2', promo: p })} className="btn-secondary" style={{ color: 'var(--saritur-orange)', borderColor: 'var(--saritur-orange)', fontSize: '0.7rem', padding: '0.3rem' }}>Ajustes</button>
              </>
            )}
            {canActOnDP && (
              <button onClick={() => executeWorkflowAction(p, 'Concluído', { dp_approver_id: currentUserId, dp_signature_date: new Date().toISOString() })} className="btn-primary" style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem', backgroundColor: '#057a55', justifyContent: 'center' }}><CheckCircle size={14} style={{ marginRight: '4px' }}/> Efetivar no DP</button>
            )}
            {canActOnAjustes && (
              <>
                <button onClick={() => { setFormData({ type: p.type, collaborator_name: p.collaborator_name, collaborator_cpf: p.collaborator_cpf, admission_date: p.admission_date ? String(p.admission_date).split('T')[0] : '', current_role: p.current_role, proposed_role: p.proposed_role, current_salary: String(p.current_salary), proposed_salary: String(p.proposed_salary), current_sector: p.current_sector, proposed_sector: p.proposed_sector, current_unit_id: p.current_unit_id, proposed_unit_id: p.proposed_unit_id, promotion_month_year: p.promotion_month_year, feedback: p.feedback, candidate_id: p.candidate_id }); setEditingPromotionId(p.id); setIsModalOpen(true); }} className="btn-primary" style={{ flex: 1, fontSize: '0.7rem', padding: '0.3rem', justifyContent: 'center', backgroundColor: 'var(--saritur-orange)' }}><RotateCcw size={12} style={{ marginRight: '4px' }}/> Corrigir</button>
                <button onClick={() => executeWorkflowAction(p, 'Cancelado')} className="btn-secondary" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)', fontSize: '0.7rem', padding: '0.3rem' }}>Cancelar</button>
              </>
            )}
          </div>
        )}

        {['Concluído', 'Cancelado', 'Reprovado pela Liderança'].includes(p.status) && (
          <div style={{ marginTop: '0.25rem' }}>
            <button onClick={() => handleExportPDF(p)} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.7rem', padding: '0.4rem', color: '#057a55', borderColor: '#057a55' }}><Download size={12} style={{ marginRight: '4px' }} /> Gerar Relatório PDF</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Pipeline de Promoções</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Acompanhamento, assinaturas e esteira de aprovação.</p>
        </div>
        <button className="btn-primary" onClick={() => { setFormData(initialForm); setEditingPromotionId(null); setIsModalOpen(true); }}>
          <Plus size={20} style={{ marginRight: '8px' }}/> Abrir Solicitação
        </button>
      </div>

      <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', backgroundColor: 'var(--surface-color)', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
          <button className={currentView === 'pipeline' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentView('pipeline')}><LayoutGrid size={16} style={{ marginRight: '6px' }}/> Quadro (Kanban)</button>
          <button className={currentView === 'historico' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentView('historico')} style={{ backgroundColor: currentView === 'historico' ? 'var(--text-main)' : '' }}><Archive size={16} style={{ marginRight: '6px' }}/> Histórico e Finalizados</button>
          <button className={currentView === 'banco' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentView('banco')} style={{ backgroundColor: currentView === 'banco' ? 'var(--saritur-orange)' : '', color: currentView === 'banco' ? 'white' : '' }}><Users size={16} style={{ marginRight: '6px' }}/> Banco do Psicólogo</button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Filter size={18} color="var(--saritur-orange)" />
          <input type="date" title="Data da Solicitação" style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterUnit} onChange={e => setFilterUnit(e.target.value)}><option value="">Todas Unidades</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '500' }}><input type="checkbox" checked={filterOnlyMine} onChange={e => setFilterOnlyMine(e.target.checked)} style={{ accentColor: 'var(--saritur-orange)', width: '16px', height: '16px' }}/> Minhas</label>
        </div>
      </div>

      {loading ? ( <p style={{ color: 'var(--text-muted)' }}>Sincronizando fluxo...</p> ) : (
        <>
          {currentView === 'pipeline' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}><PenTool size={18} color="var(--saritur-orange)" /><h2 style={{ fontSize: '1rem', fontWeight: 'bold' }}>1. Em Aprovação (Liderança) ({blocoLideranca.length})</h2></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{blocoLideranca.map(renderPromoCard)}{blocoLideranca.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>Vazio.</p>}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}><CheckCircle size={18} color="var(--saritur-yellow)" /><h2 style={{ fontSize: '1rem', fontWeight: 'bold' }}>2. Em Validação (GP²) ({blocoGP2.length})</h2></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{blocoGP2.map(renderPromoCard)}{blocoGP2.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>Vazio.</p>}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}><CheckCircle size={18} color="var(--success-color)" /><h2 style={{ fontSize: '1rem', fontWeight: 'bold' }}>3. À Efetivar (DP) ({blocoDP.length})</h2></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{blocoDP.map(renderPromoCard)}{blocoDP.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>Vazio.</p>}</div>
              </div>
            </div>
          )}

          {currentView === 'historico' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Archive size={20}/> Histórico (Concluídas e Canceladas)</h2>
              {historyPromos.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}>
                  <SearchX size={48} color="var(--border-color)" style={{ marginBottom: '1rem', margin: '0 auto' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Nenhum histórico encontrado.</h3>
                </div>
              ) : ( <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>{historyPromos.map(renderPromoCard)}</div> )}
            </div>
          )}

          {currentView === 'banco' && (
            <div>
               <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={20}/> Aguardando Formulário Vertical</h2>
               {filteredPsi.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}>
                  <SearchX size={48} color="var(--border-color)" style={{ marginBottom: '1rem', margin: '0 auto' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Nenhum colaborador na fila.</h3>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                  {filteredPsi.map(c => (
                    <div key={c.id} className="glass-panel" style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', borderTop: '4px solid var(--saritur-yellow)', backgroundColor: 'var(--surface-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={16} color="var(--success-color)" /><span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>Apto na Avaliação</span></div>
                      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>{c.name}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4', margin: 0 }}><strong>Destino:</strong> {c.job_roles?.name || c.job_role_name || 'N/A'} <br/><strong>Unidade:</strong> {c.units?.name || c.unit_name || 'N/A'} <br/><strong>CPF:</strong> {c.cpf}</p>
                      <button onClick={() => { setFormData({ ...initialForm, type: 'Vertical', collaborator_name: c.name || '', collaborator_cpf: c.cpf || '', proposed_role: c.job_roles?.name || c.job_role_name || '', proposed_unit_id: c.unit_id || '', candidate_id: c.id }); setEditingPromotionId(null); setIsModalOpen(true); }} className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem', marginTop: 'auto', padding: '0.4rem' }}>Iniciar Formulário Vertical</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL DE RAIO-X DETALHADO */}
      {detailsPromotion && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>Detalhes da Solicitação</h2>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ backgroundColor: detailsPromotion.type === 'Vertical' ? 'rgba(2, 132, 199, 0.1)' : 'rgba(243, 113, 55, 0.1)', color: detailsPromotion.type === 'Vertical' ? '#0284c7' : 'var(--saritur-orange)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', border: `1px solid ${detailsPromotion.type === 'Vertical' ? '#0284c7' : 'var(--saritur-orange)'}` }}>{detailsPromotion.type}</span>
                  <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid var(--border-color)' }}>Status: {detailsPromotion.status}</span>
                </div>
              </div>
              <button onClick={() => setDetailsPromotion(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', backgroundColor: 'var(--bg-color)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Colaborador</span><p style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '0.2rem' }}>{detailsPromotion.collaborator_name}</p></div>
                <div><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CPF</span><p style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-main)', marginTop: '0.2rem' }}>{detailsPromotion.collaborator_cpf}</p></div>
                <div><span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Data Admissão</span><p style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-main)', marginTop: '0.2rem' }}>{detailsPromotion.admission_date ? String(detailsPromotion.admission_date).split('T')[0].split('-').reverse().join('/') : 'N/A'}</p></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Situação Atual</h4>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Cargo:</strong> {detailsPromotion.current_role}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Salário:</strong> {Number(detailsPromotion.current_salary || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Setor:</strong> {detailsPromotion.current_sector}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0' }}><strong>Unidade:</strong> {detailsPromotion.current_unit_name || 'N/A'}</p>
                </div>
                <div style={{ border: '1px solid var(--success-color)', borderRadius: 'var(--radius-md)', padding: '1rem', backgroundColor: 'rgba(5, 122, 85, 0.03)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--success-color)', marginBottom: '1rem', borderBottom: '1px solid rgba(5, 122, 85, 0.2)', paddingBottom: '0.5rem' }}>Situação Proposta</h4>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Cargo:</strong> {detailsPromotion.proposed_role}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Salário:</strong> {Number(detailsPromotion.proposed_salary || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Setor:</strong> {detailsPromotion.proposed_sector}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0' }}><strong>Unidade:</strong> {detailsPromotion.proposed_unit_name || 'N/A'}</p>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Auditoria e Linha do Tempo</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'var(--bg-color)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}><Plus size={16} color="var(--text-muted)" /><span><strong>Solicitado por:</strong> {detailsPromotion.requester_name || 'Gestor'} em {detailsPromotion.created_at ? new Date(detailsPromotion.created_at).toLocaleString('pt-BR') : 'N/A'}</span></div>
                  {detailsPromotion.leadership_signature_date && (<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#057a55' }}><PenTool size={16} /><span><strong>Aprovado na Liderança por:</strong> {detailsPromotion.leadership_approver_name || 'Usuário'} em {new Date(detailsPromotion.leadership_signature_date).toLocaleString('pt-BR')}</span></div>)}
                  {detailsPromotion.gp2_signature_date && (<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#057a55' }}><CheckCircle size={16} /><span><strong>Validado no GP² por:</strong> {detailsPromotion.gp2_approver_name || 'Usuário'} em {new Date(detailsPromotion.gp2_signature_date).toLocaleString('pt-BR')}</span></div>)}
                  {detailsPromotion.dp_signature_date && (<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#057a55' }}><CheckCircle size={16} /><span><strong>Efetivado no DP por:</strong> {detailsPromotion.dp_approver_name || 'Usuário'} em {new Date(detailsPromotion.dp_signature_date).toLocaleString('pt-BR')}</span></div>)}

                  {detailsPromotion.feedback && (
                    <div style={{ marginTop: '0.75rem', padding: '1rem', backgroundColor: 'var(--surface-color)', border: '1px dashed var(--border-color)', borderRadius: '4px', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                      <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Logs e Observações Registradas:</strong>
                      <span style={{ color: 'var(--text-muted)' }}>{detailsPromotion.feedback}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {['Concluído', 'Cancelado', 'Reprovado pela Liderança'].includes(detailsPromotion.status) && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1.5rem' }}>
                <button onClick={() => handleExportPDF(detailsPromotion)} className="btn-secondary" style={{ color: '#057a55', borderColor: '#057a55', fontSize: '0.85rem' }}><Download size={16} style={{ marginRight: '6px' }} /> Baixar Documento PDF</button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <button className="btn-secondary" onClick={() => setDetailsPromotion(null)}>Fechar Raio-X</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PARECER AVULSO */}
      {obsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '450px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '1rem' }}>Adicionar Parecer</h2>
            <textarea required style={{ width: '100%', minHeight: '100px', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', fontFamily: 'inherit' }} placeholder="Digite sua observação sobre o processo..." value={obsText} onChange={e => setObsText(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn-secondary" onClick={() => { setObsModal(null); setObsText(''); }}>Cancelar</button>
              <button onClick={handleSaveObservation} className="btn-primary" style={{ backgroundColor: 'var(--saritur-orange)' }}>Salvar no Histórico</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORMULÁRIO */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={24} color="var(--saritur-orange)"/> {editingPromotionId ? 'Corrigir Solicitação' : 'Formulário de Solicitação'}</h2>
              <button onClick={() => setIsModalOpen(false)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <form onSubmit={handleSavePromotion} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ padding: '1rem', backgroundColor: formData.type === 'Vertical' ? 'rgba(2, 132, 199, 0.05)' : 'var(--bg-color)', border: formData.type === 'Vertical' ? '1px solid #0284c7' : '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.5rem' }}>Tipo de Promoção *</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}><input type="radio" name="type" checked={formData.type === 'Horizontal'} onChange={() => setFormData({...formData, type: 'Horizontal'})} disabled={!!editingPromotionId} style={{ accentColor: 'var(--saritur-orange)', width: '18px', height: '18px' }} /><strong>Horizontal</strong> (Aumento Salarial)</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}><input type="radio" name="type" checked={formData.type === 'Vertical'} onChange={() => setFormData({...formData, type: 'Vertical'})} disabled={!!editingPromotionId} style={{ accentColor: '#0284c7', width: '18px', height: '18px' }} /><strong>Vertical</strong> (Mudança de Cargo)</label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.4rem' }}>Nome do Colaborador *</label><input required type="text" style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.collaborator_name} onChange={e => setFormData({...formData, collaborator_name: e.target.value.toUpperCase()})} /></div>
                <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.4rem' }}>CPF *</label><input required type="text" style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.collaborator_cpf} onChange={e => setFormData({...formData, collaborator_cpf: maskCPF(e.target.value)})} placeholder="000.000.000-00" /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.4rem' }}>Data de Admissão Atual *</label><input required type="date" style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.admission_date} onChange={e => setFormData({...formData, admission_date: e.target.value})} /></div>
                <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.4rem' }}>Data da Promoção (Mês/Ano) *</label><div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}><span style={{ padding: '0.6rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)', fontSize: '0.85rem' }}>Dia 01/</span><input required type="text" style={{ width: '100%', padding: '0.6rem', border: 'none' }} placeholder="MM/AAAA" value={formData.promotion_month_year} onChange={e => setFormData({...formData, promotion_month_year: formatMonthYear(e.target.value)})} /></div></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Situação Atual</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Cargo Atual *</label>
                      <select required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.current_role} onChange={handleCurrentRoleChange}>
                        <option value="">Selecione o Cargo...</option>
                        {uniqueRoleNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Salário Atual (R$) *</label><input required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.current_salary} onChange={e => setFormData({...formData, current_salary: maskCurrency(e.target.value)})} /></div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Setor Atual *</label>
                      {currentAvailableSectors.length > 0 ? (
                        <select required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.current_sector} onChange={e => setFormData({...formData, current_sector: e.target.value})}>
                          <option value="">Selecione o Setor...</option>
                          {currentAvailableSectors.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <input required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.current_sector} onChange={e => setFormData({...formData, current_sector: e.target.value})} placeholder="Digite o setor..." disabled={!formData.current_role} />
                      )}
                    </div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Unidade Atual *</label><select required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.current_unit_id} onChange={e => setFormData({...formData, current_unit_id: e.target.value})}><option value="">Selecione...</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--success-color)', marginBottom: '1rem', borderBottom: '1px solid rgba(5, 122, 85, 0.2)', paddingBottom: '0.5rem' }}>Nova Situação (Proposta)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Novo Cargo *</label>
                      <select required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.proposed_role} onChange={handleProposedRoleChange}>
                        <option value="">Selecione o Cargo...</option>
                        {uniqueRoleNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Novo Salário (R$) *</label><input required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.proposed_salary} onChange={e => setFormData({...formData, proposed_salary: maskCurrency(e.target.value)})} /></div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Novo Setor *</label>
                      {proposedAvailableSectors.length > 0 ? (
                        <select required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.proposed_sector} onChange={e => setFormData({...formData, proposed_sector: e.target.value})}>
                          <option value="">Selecione o Setor...</option>
                          {proposedAvailableSectors.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <input required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.proposed_sector} onChange={e => setFormData({...formData, proposed_sector: e.target.value})} placeholder="Digite o setor..." disabled={!formData.proposed_role} />
                      )}
                    </div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Nova Unidade *</label><select required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} value={formData.proposed_unit_id} onChange={e => setFormData({...formData, proposed_unit_id: e.target.value})}><option value="">Selecione...</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Gravar e Iniciar Fluxo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RECUSA / AJUSTES */}
      {actionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '450px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--saritur-orange)', marginBottom: '1rem' }}>Recusar para Ajustes</h2>
            <textarea required style={{ width: '100%', minHeight: '100px', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }} placeholder="Descreva os motivos..." value={feedbackText} onChange={e => setFeedbackText(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn-secondary" onClick={() => setActionModal(null)}>Voltar</button>
              <button onClick={() => { if (!feedbackText.trim()) return alert('Insira uma justificativa.'); const note = `\n❌ [RECUSADO GP²] Por: ${currentUserName} em ${new Date().toLocaleString('pt-BR')}:\n"${feedbackText}"\n`; executeWorkflowAction(actionModal.promo, 'Recusado pelo GP2 (Ajustes)', { feedback: (actionModal.promo.feedback || '') + note }); }} className="btn-primary" style={{ backgroundColor: 'var(--saritur-orange)' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
