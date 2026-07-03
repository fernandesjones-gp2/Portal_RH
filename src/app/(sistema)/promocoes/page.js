'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { TrendingUp, Clock, SearchX, Plus, X, CheckCircle, FileText, AlertTriangle, Calendar, ThumbsUp, ThumbsDown, PenTool, MessageSquare, RotateCcw } from 'lucide-react';

export default function PromocoesPage() {
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [loading, setLoading] = useState(true);

  const [promotions, setPromotions] = useState([]);
  const [approvedCandidates, setApprovedCandidates] = useState([]); 
  const [units, setUnits] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState(null); // Controla se é edição/reajuste
  const [activeTab, setActiveTab] = useState('minhas');
  
  // MODAIS DE PARECER / JUSTIFICATIVA
  const [actionModal, setActionModal] = useState(null); // { type: 'reject_leader' | 'reject_gp2', promo: p }
  const [feedbackText, setFeedbackText] = useState('');

  const initialForm = {
    type: 'Horizontal', collaborator_name: '', collaborator_cpf: '', admission_date: '',
    current_role: '', proposed_role: '', current_salary: '', proposed_salary: '',
    current_sector: '', proposed_sector: '', current_unit_id: '', proposed_unit_id: '',
    promotion_month_year: ''
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const sessionUser = await api.me();
      if (sessionUser) {
        setCurrentUserRole(sessionUser.role || sessionUser.data?.role || '');
        setCurrentUserId(sessionUser.id || sessionUser.data?.id || '');
        setCurrentUserName(sessionUser.name || sessionUser.data?.name || 'Usuário');
      }

      // Faz a listagem usando o fetch nativo para quebrar cache e garantir sincronia real-time
      const resPromo = await fetch('/api/promotions?_t=' + Date.now());
      const promosRes = await resPromo.json();

      const [candsRes, unitsRes] = await Promise.all([
        api.candidates.list({ _t: Date.now() }),
        api.units.list()
      ]);

      const activePromotions = Array.isArray(promosRes) ? promosRes : [];
      setPromotions(activePromotions);
      setUnits(unitsRes || []);

      if (candsRes) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const validados = candsRes.filter(c => 
          c.process_type === 'Promoção' && 
          (c.status === 'Promoção (Em Andamento)' || c.status === 'Promoção (Em Análise)') && 
          new Date(c.created_at) >= sixMonthsAgo &&
          !activePromotions.some(p => p.candidate_id === c.id && ['Concluído', 'Cancelado', 'Reprovado pela Liderança'].includes(p.status))
        );
        setApprovedCandidates(validados);
      }

    } catch (error) {
      console.error('Erro ao sincronizar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  const maskCPF = (val) => val.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
  const maskCurrency = (val) => {
    let v = val.replace(/\D/g, '');
    v = (v / 100).toFixed(2) + '';
    v = v.replace(".", ",");
    v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
    return v;
  };
  const formatMonthYear = (val) => val.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1/$2').slice(0, 7);

  // --- SUBMISSÃO E REINÍCIO DO FLUXO ---
  async function handleSavePromotion(e) {
    e.preventDefault();

    let linkedCandidateId = formData.candidate_id || null;
    if (formData.type === 'Vertical' && !linkedCandidateId) {
      const cleanCpf = formData.collaborator_cpf.replace(/\D/g, '');
      const validCandidate = approvedCandidates.find(c => c.cpf && c.cpf.replace(/\D/g, '') === cleanCpf);
      
      if (!validCandidate) {
        alert('❌ BLOQUEIO: Este colaborador NÃO possui uma entrevista de promoção válida aprovada nos últimos 6 meses pelo psicólogo.');
        return;
      }
      linkedCandidateId = validCandidate.id;
    }

    const payload = {
      ...formData,
      current_salary: String(formData.current_salary).replace(/\./g, '').replace(',', '.'),
      proposed_salary: String(formData.proposed_salary).replace(/\./g, '').replace(',', '.'),
      requester_id: currentUserId,
      candidate_id: linkedCandidateId,
      status: 'Aguardando Liderança',
      feedback: editingPromotionId ? `${formData.feedback || ''}\n🔄 [FLUXO] Processo corrigido e reiniciado por ${currentUserName} em ${new Date().toLocaleString('pt-BR')}` : ''
    };

    try {
      if (editingPromotionId) {
        // Se for reinício de fluxo, atualiza a linha existente usando PUT dinâmico
        await fetch(`/api/promotions/${editingPromotionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Nova solicitação
        await api.promotions.create(payload);
        if (linkedCandidateId) {
          await api.candidates.update(linkedCandidateId, { status: 'Promoção (Em Análise)' });
        }
      }

      alert('Solicitação de Promoção gravada com sucesso! Enviada para análise da Liderança.');
      setFormData(initialForm);
      setEditingPromotionId(null);
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert('Erro ao gravar solicitação: ' + err.message);
    }
  }

  // --- EXECUÇÃO DAS APROVAÇÕES DO FLUXO (PUT) ---
  async function executeWorkflowAction(promoId, statusName, extraPayload = {}) {
    try {
      const response = await fetch(`/api/promotions/${promoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusName, ...extraPayload })
      });

      if (response.ok) {
        alert(`Operação realizada com sucesso! Status atualizado para: ${statusName}`);
        setActionModal(null);
        setFeedbackText('');
        fetchData();
      } else {
        alert('Erro ao processar alteração no servidor.');
      }
    } catch (e) {
      alert('Erro de comunicação.');
    }
  }

  const filteredPromotions = promotions.filter(p => {
    if (activeTab === 'minhas') return p.requester_id === currentUserId;
    if (activeTab === 'lideranca') return p.status === 'Aguardando Liderança';
    if (activeTab === 'gp2') return p.status === 'Aguardando GP2';
    if (activeTab === 'dp') return p.status === 'Aguardando DP';
    if (activeTab === 'concluidas') return p.status === 'Concluído' || p.status === 'Cancelado' || p.status === 'Reprovado pela Liderança';
    return true;
  });

  const isPsiTab = activeTab === 'aprovados_psi';
  const displayList = isPsiTab ? approvedCandidates : filteredPromotions;

  // VERIFICAÇÃO DE PERFIS PARA EXIBIR BOTÕES
  const isUserLeadership = ['ADMIN', 'SUPERINTENDENT', 'MANAGER'].includes(currentUserRole);
  const isUserGP2 = ['ADMIN', 'GP²', 'RECRUITER', 'RECRUITER_ANALYST'].includes(currentUserRole);
  const isUserDP = ['ADMIN', 'DP'].includes(currentUserRole);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Gestão de Promoções</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Acompanhamento, assinaturas digitais e esteira de aprovação unificada.</p>
        </div>
        <button className="btn-primary" onClick={() => { setFormData(initialForm); setEditingPromotionId(null); setIsModalOpen(true); }}>
          <Plus size={20} style={{ marginRight: '8px' }}/> Abrir Solicitação
        </button>
      </div>

      {/* SELETOR DE ABAS */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        <button className={activeTab === 'minhas' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('minhas')}>Minhas Solicitações</button>
        <button className={activeTab === 'aprovados_psi' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('aprovados_psi')} style={{ backgroundColor: activeTab === 'aprovados_psi' ? 'var(--saritur-orange)' : '', color: activeTab === 'aprovados_psi' ? 'white' : '' }}>
          Banco de Aprovados (Psicólogo) ({approvedCandidates.length})
        </button>
        <button className={activeTab === 'lideranca' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('lideranca')}>Pendentes Liderança</button>
        <button className={activeTab === 'gp2' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('gp2')}>Validação GP²</button>
        <button className={activeTab === 'dp' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('dp')}>Efetivação DP</button>
        <button className={activeTab === 'concluidas' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('concluidas')}>Histórico / Concluídas</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Sincronizando fluxo em tempo real...</p>
      ) : displayList.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <SearchX size={48} color="var(--border-color)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            {isPsiTab ? 'Nenhum colaborador aguardando abertura de processo' : 'Nenhuma solicitação nesta etapa'}
          </h3>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          {isPsiTab ? (
            approvedCandidates.map(c => (
              <div key={c.id} className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', borderTop: '4px solid var(--saritur-yellow)', backgroundColor: 'var(--surface-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <CheckCircle size={18} color="var(--success-color)" />
                    <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Apto na Avaliação</span>
                  </div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{c.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                    <strong>Cargo Destino:</strong> {c.job_roles?.name || c.job_role_name || 'N/A'} <br/>
                    <strong>Unidade:</strong> {c.units?.name || c.unit_name || 'N/A'} <br/>
                    <strong>CPF:</strong> {c.cpf}
                  </p>
                </div>
                <div>
                  <button 
                    onClick={() => {
                      setFormData({
                        ...initialForm, type: 'Vertical', collaborator_name: c.name || '', collaborator_cpf: c.cpf || '',
                        proposed_role: c.job_roles?.name || c.job_role_name || '', proposed_unit_id: c.unit_id || '', candidate_id: c.id
                      });
                      setEditingPromotionId(null);
                      setIsModalOpen(true);
                    }}
                    className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}
                  >
                    Iniciar Formulário Vertical
                  </button>
                </div>
              </div>
            ))
          ) : (
            // RENDERIZAÇÃO COMPLETA DOS FORMULÁRIOS COM BOTÕES DE AÇÃO INTERATIVOS
            filteredPromotions.map(p => (
              <div key={p.id} className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', borderTop: p.type === 'Vertical' ? '4px solid #0284c7' : '4px solid var(--saritur-orange)', backgroundColor: 'var(--surface-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={18} color={p.type === 'Vertical' ? '#0284c7' : 'var(--saritur-orange)'} />
                    <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>{p.type}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--saritur-orange)' }}>{p.status}</span>
                </div>
                
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-main)' }}>{p.collaborator_name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  <strong>De:</strong> {p.current_role} (R$ {Number(p.current_salary).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})<br/>
                  <strong>Para:</strong> {p.proposed_role} (R$ {Number(p.proposed_salary).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                </p>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  <strong>Unidade Origem:</strong> {p.current_unit_name || 'N/A'}<br/>
                  <strong>Unidade Destino:</strong> {p.proposed_unit_name || 'N/A'}
                </p>

                <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <Calendar size={14} color="var(--text-muted)" />
                  <span>Mês de Efetivação: 01/{p.promotion_month_year}</span>
                </div>

                {/* HISTÓRICO DE ASSINATURAS COLETADAS NO CARD */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)' }}>
                  <p>👤 Solicitante: {p.requester_name || 'Gestor'} ({p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : ''})</p>
                  {p.leadership_signature_date && <p style={{ color: '#057a55' }}>✍️ Liderança Assinado em: {new Date(p.leadership_signature_date).toLocaleDateString('pt-BR')}</p>}
                  {p.gp2_signature_date && <p style={{ color: '#057a55' }}>✅ Validado GP² em: {new Date(p.gp2_signature_date).toLocaleDateString('pt-BR')}</p>}
                </div>

                {p.feedback && (
                  <div style={{ backgroundColor: 'rgba(243, 113, 55, 0.03)', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                    <strong>Histórico de Pareceres:</strong> {p.feedback}
                  </div>
                )}

                {/* --- DINÂMICA DE BOTÕES DA ESTEIRA DE DECISÃO --- */}
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  
                  {/* 1. AÇÕES DA LIDERANÇA */}
                  {p.status === 'Aguardando Liderança' && isUserLeadership && (
                    <>
                      <button onClick={() => executeWorkflowAction(p.id, 'Aguardando GP2', { leadership_approver_id: currentUserId, leadership_signature_date: new Date().toISOString() })} className="btn-primary" style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem', backgroundColor: '#057a55', justifyContent: 'center' }}>
                        <PenTool size={14} style={{ marginRight: '4px' }}/> Assinar e Aprovar
                      </button>
                      <button onClick={() => executeWorkflowAction(p.id, 'Reprovado pela Liderança')} className="btn-secondary" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)', fontSize: '0.8rem', padding: '0.4rem' }}>
                        <ThumbsDown size={14} /> Reprovar
                      </button>
                    </>
                  )}

                  {/* 2. AÇÕES DO GP2 */}
                  {p.status === 'Aguardando GP2' && isUserGP2 && (
                    <>
                      <button onClick={() => executeWorkflowAction(p.id, 'Aguardando DP', { gp2_approver_id: currentUserId, gp2_signature_date: new Date().toISOString() })} className="btn-primary" style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem', justifyContent: 'center' }}>
                        <CheckCircle size={14} style={{ marginRight: '4px' }}/> Validar e Avançar
                      </button>
                      <button onClick={() => setActionModal({ type: 'reject_gp2', promo: p })} className="btn-secondary" style={{ color: 'var(--saritur-orange)', borderColor: 'var(--saritur-orange)', fontSize: '0.8rem', padding: '0.4rem' }}>
                        <MessageSquare size={14} /> Pedir Ajustes
                      </button>
                    </>
                  )}

                  {/* 3. AÇÕES DO DP */}
                  {p.status === 'Aguardando DP' && isUserDP && (
                    <button onClick={() => executeWorkflowAction(p.id, 'Concluído', { dp_approver_id: currentUserId, dp_signature_date: new Date().toISOString() })} className="btn-primary" style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem', backgroundColor: '#057a55', justifyContent: 'center' }}>
                      <CheckCircle size={16} style={{ marginRight: '6px' }}/> Concluir e Efetivar no Sistema
                    </button>
                  )}

                  {/* 4. REAÇÃO DE AJUSTES DO GESTOR SOLICITANTE */}
                  {p.status === 'Recusado pelo GP2 (Ajustes)' && p.requester_id === currentUserId && (
                    <>
                      <button 
                        onClick={() => {
                          setFormData({
                            type: p.type, collaborator_name: p.collaborator_name, collaborator_cpf: p.collaborator_cpf, admission_date: p.admission_date ? p.admission_date.split('T')[0] : '',
                            current_role: p.current_role, proposed_role: p.proposed_role, current_salary: String(p.current_salary), proposed_salary: String(p.proposed_salary),
                            current_sector: p.current_sector, proposed_sector: p.proposed_sector, current_unit_id: p.current_unit_id, proposed_unit_id: p.proposed_unit_id,
                            promotion_month_year: p.promotion_month_year, feedback: p.feedback, candidate_id: p.candidate_id
                          });
                          setEditingPromotionId(p.id);
                          setIsModalOpen(true);
                        }}
                        className="btn-primary" style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem', justifyContent: 'center', backgroundColor: 'var(--saritur-orange)' }}
                      >
                        <RotateCcw size={14} style={{ marginRight: '4px' }}/> Corrigir e Reiniciar
                      </button>
                      <button onClick={() => executeWorkflowAction(p.id, 'Cancelado')} className="btn-secondary" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)', fontSize: '0.8rem', padding: '0.4rem' }}>
                        Cancelar Processo
                      </button>
                    </>
                  )}

                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL 1: FORMULÁRIO DE CADASTRO / AJUSTE */}
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="radio" name="type" checked={formData.type === 'Horizontal'} onChange={() => setFormData({...formData, type: 'Horizontal'})} disabled={!!editingPromotionId} style={{ accentColor: 'var(--saritur-orange)', width: '18px', height: '18px' }} />
                    <strong>Horizontal</strong> (Aumento Salarial)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="radio" name="type" checked={formData.type === 'Vertical'} onChange={() => setFormData({...formData, type: 'Vertical'})} disabled={!!editingPromotionId} style={{ accentColor: '#0284c7', width: '18px', height: '18px' }} />
                    <strong>Vertical</strong> (Mudança de Cargo)
                  </label>
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
                    <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Cargo Atual *</label><input required style={{ width: '100%', padding: '0.5rem' }} value={formData.current_role} onChange={e => setFormData({...formData, current_role: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Salário Atual (R$) *</label><input required style={{ width: '100%', padding: '0.5rem' }} value={formData.current_salary} onChange={e => setFormData({...formData, current_salary: maskCurrency(e.target.value)})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Setor Atual *</label><input required style={{ width: '100%', padding: '0.5rem' }} value={formData.current_sector} onChange={e => setFormData({...formData, current_sector: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Unidade Atual *</label><select required style={{ width: '100%', padding: '0.5rem' }} value={formData.current_unit_id} onChange={e => setFormData({...formData, current_unit_id: e.target.value})}><option value="">Selecione...</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--success-color)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Nova Situação (Proposta)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Novo Cargo *</label><input required style={{ width: '100%', padding: '0.5rem' }} value={formData.proposed_role} onChange={e => setFormData({...formData, proposed_role: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Novo Salário (R$) *</label><input required style={{ width: '100%', padding: '0.5rem' }} value={formData.proposed_salary} onChange={e => setFormData({...formData, proposed_salary: maskCurrency(e.target.value)})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Novo Setor *</label><input required style={{ width: '100%', padding: '0.5rem' }} value={formData.proposed_sector} onChange={e => setFormData({...formData, proposed_sector: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>Nova Unidade *</label><select required style={{ width: '100%', padding: '0.5rem' }} value={formData.proposed_unit_id} onChange={e => setFormData({...formData, proposed_unit_id: e.target.value})}><option value="">Selecione...</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
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

      {/* MODAL 2: JUSTIFICATIVA DE RECUSA / PEDIDO DE AJUSTES */}
      {actionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '450px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--saritur-orange)', marginBottom: '1rem' }}>Recusar para Ajustes</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Insira abaixo os motivos ou correções necessárias. O processo retornará imediatamente para o painel do Gestor solicitante.</p>
            <textarea 
              required
              style={{ width: '100%', minHeight: '100px', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}
              placeholder="Ex: Salário proposto fora das tabelas de cargos e salários vigentes..."
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn-secondary" onClick={() => setActionModal(null)}>Voltar</button>
              <button 
                onClick={() => {
                  if (!feedbackText.trim()) return alert('Insira uma justificativa.');
                  const note = `\n❌ [RECUSADO GP²] Por: ${currentUserName} em ${new Date().toLocaleString('pt-BR')}:\n"${feedbackText}"\n`;
                  executeWorkflowAction(actionModal.promo.id, 'Recusado pelo GP2 (Ajustes)', { feedback: (actionModal.promo.feedback || '') + note });
                }}
                className="btn-primary" style={{ backgroundColor: 'var(--saritur-orange)' }}
              >
                Confirmar Recusa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
