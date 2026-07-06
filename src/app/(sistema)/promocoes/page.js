'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { TrendingUp, SearchX, Plus, X, CheckCircle, FileText, AlertTriangle, Calendar, ThumbsUp, ThumbsDown, PenTool, MessageSquare, RotateCcw, LayoutGrid, Archive, Users, Filter, Clock, Eye } from 'lucide-react';

export default function PromocoesPage() {
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [loading, setLoading] = useState(true);

  const [promotions, setPromotions] = useState([]);
  const [approvedCandidates, setApprovedCandidates] = useState([]); 
  const [units, setUnits] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState(null); 
  const [detailsPromotion, setDetailsPromotion] = useState(null); // <-- NOVO: Controle do modal de detalhes
  
  // VISTAS E FILTROS
  const [currentView, setCurrentView] = useState('pipeline'); 
  const [filterUnit, setFilterUnit] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterOnlyMine, setFilterOnlyMine] = useState(false);
  
  const [actionModal, setActionModal] = useState(null); 
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
      fetchData();
    } catch (err) {
      alert('Erro ao gravar solicitação: ' + err.message);
    }
  }

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

  const roleSafe = (currentUserRole || '').toUpperCase();
  const isUserLeadership = ['ADMIN', 'SUPERINTENDENT', 'MANAGER'].includes(roleSafe);
  const isUserGP2 = ['ADMIN', 'GP²', 'GP2', 'RECRUITER', 'RECRUITER_ANALYST'].includes(roleSafe);
  const isUserDP = ['ADMIN', 'DP'].includes(roleSafe);

  // --- LÓGICA DE FILTROS ---
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

  // --- RENDERIZAÇÃO DO CARD KANBAN/HISTÓRICO ---
  const renderPromoCard = (p) => (
    <div key={p.id} className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', borderTop: p.type === 'Vertical' ? '4px solid #0284c7' : '4px solid var(--saritur-orange)', backgroundColor: 'var(--surface-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={16} color={p.type === 'Vertical' ? '#0284c7' : 'var(--saritur-orange)'} />
          <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>{p.type}</span>
        </div>
        <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: currentView === 'historico' ? 'var(--text-muted)' : 'var(--saritur-orange)' }}>{p.status}</span>
      </div>
      
      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>{p.collaborator_name}</h3>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
        <strong>De:</strong> {p.current_role} <br/>
        <strong>Para:</strong> {p.proposed_role}
      </div>

      <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
        <Calendar size={14} color="var(--text-muted)" />
        <span>Efetivação: 01/{p.promotion_month_year}</span>
      </div>

      {/* NOVO: Botão de Detalhes sempre visível */}
      <div style={{ marginTop: '0.25rem' }}>
        <button onClick={() => setDetailsPromotion(p)} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem', padding: '0.4rem' }}>
          <Eye size={14} style={{ marginRight: '4px' }} /> Ver Detalhes Completos
        </button>
      </div>

      {currentView === 'pipeline' && (
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {p.status === 'Aguardando Liderança' && isUserLeadership && (
            <>
              <button onClick={() => executeWorkflowAction(p.id, 'Aguardando GP2', { leadership_approver_id: currentUserId, leadership_signature_date: new Date().toISOString() })} className="btn-primary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem', backgroundColor: '#057a55', justifyContent: 'center' }}>
                <PenTool size={14} style={{ marginRight: '4px' }}/> Assinar/Aprovar
              </button>
              <button onClick={() => executeWorkflowAction(p.id, 'Reprovado pela Liderança')} className="btn-secondary" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)', fontSize: '0.75rem', padding: '0.4rem' }}>Reprovar</button>
            </>
          )}

          {p.status === 'Aguardando GP2' && isUserGP2 && (
            <>
              <button onClick={() => executeWorkflowAction(p.id, 'Aguardando DP', { gp2_approver_id: currentUserId, gp2_signature_date: new Date().toISOString() })} className="btn-primary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem', justifyContent: 'center' }}>
                <CheckCircle size={14} style={{ marginRight: '4px' }}/> Validar
              </button>
              <button onClick={() => setActionModal({ type: 'reject_gp2', promo: p })} className="btn-secondary" style={{ color: 'var(--saritur-orange)', borderColor: 'var(--saritur-orange)', fontSize: '0.75rem', padding: '0.4rem' }}>Ajustes</button>
            </>
          )}

          {p.status === 'Aguardando DP' && isUserDP && (
            <button onClick={() => executeWorkflowAction(p.id, 'Concluído', { dp_approver_id: currentUserId, dp_signature_date: new Date().toISOString() })} className="btn-primary" style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem', backgroundColor: '#057a55', justifyContent: 'center' }}>
              <CheckCircle size={16} style={{ marginRight: '6px' }}/> Efetivar no DP
            </button>
          )}

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
                className="btn-primary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem', justifyContent: 'center', backgroundColor: 'var(--saritur-orange)' }}
              >
                <RotateCcw size={14} style={{ marginRight: '4px' }}/> Corrigir
              </button>
              <button onClick={() => executeWorkflowAction(p.id, 'Cancelado')} className="btn-secondary" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)', fontSize: '0.75rem', padding: '0.4rem' }}>Cancelar</button>
            </>
          )}
        </div>
      )}
    </div>
  );

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
          <button className={currentView === 'pipeline' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentView('pipeline')}>
            <LayoutGrid size={16} style={{ marginRight: '6px' }}/> Quadro (Kanban)
          </button>
          <button className={currentView === 'historico' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentView('historico')} style={{ backgroundColor: currentView === 'historico' ? 'var(--text-main)' : '' }}>
            <Archive size={16} style={{ marginRight: '6px' }}/> Histórico
          </button>
          <button className={currentView === 'banco' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCurrentView('banco')} style={{ backgroundColor: currentView === 'banco' ? 'var(--saritur-orange)' : '', color: currentView === 'banco' ? 'white' : '' }}>
            <Users size={16} style={{ marginRight: '6px' }}/> Banco do Psicólogo
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Filter size={18} color="var(--saritur-orange)" />
          <input type="date" title="Data da Solicitação" style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
            <option value="">Todas Unidades</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '500' }}>
            <input type="checkbox" checked={filterOnlyMine} onChange={e => setFilterOnlyMine(e.target.checked)} style={{ accentColor: 'var(--saritur-orange)', width: '16px', height: '16px' }}/> Minhas
          </label>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Sincronizando fluxo...</p>
      ) : (
        <>
          {currentView === 'pipeline' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
              
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <PenTool size={20} color="var(--saritur-orange)" />
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>1. Em Aprovação (Liderança) ({blocoLideranca.length})</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {blocoLideranca.map(renderPromoCard)}
                  {blocoLideranca.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>Vazio.</p>}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <CheckCircle size={20} color="var(--saritur-yellow)" />
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>2. Em Validação (GP²) ({blocoGP2.length})</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {blocoGP2.map(renderPromoCard)}
                  {blocoGP2.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>Vazio.</p>}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <CheckCircle size={20} color="var(--success-color)" />
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>3. À Efetivar (DP) ({blocoDP.length})</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {blocoDP.map(renderPromoCard)}
                  {blocoDP.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>Vazio.</p>}
                </div>
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
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {historyPromos.map(renderPromoCard)}
                </div>
              )}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {filteredPsi.map(c => (
                    <div key={c.id} className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', borderTop: '4px solid var(--saritur-yellow)', backgroundColor: 'var(--surface-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle size={18} color="var(--success-color)" />
                        <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Apto na Avaliação</span>
                      </div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-main)' }}>{c.name}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
                        <strong>Destino:</strong> {c.job_roles?.name || c.job_role_name || 'N/A'} <br/>
                        <strong>Unidade:</strong> {c.units?.name || c.unit_name || 'N/A'} <br/>
                        <strong>CPF:</strong> {c.cpf}
                      </p>
                      <button 
                        onClick={() => {
                          setFormData({ ...initialForm, type: 'Vertical', collaborator_name: c.name || '', collaborator_cpf: c.cpf || '', proposed_role: c.job_roles?.name || c.job_role_name || '', proposed_unit_id: c.unit_id || '', candidate_id: c.id });
                          setEditingPromotionId(null);
                          setIsModalOpen(true);
                        }}
                        className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem', marginTop: 'auto' }}
                      >
                        Iniciar Formulário Vertical
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* --- NOVO MODAL DE DETALHES COMPLETOS (RAIO-X) --- */}
      {detailsPromotion && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                  <SearchX size={24} color={detailsPromotion.type === 'Vertical' ? '#0284c7' : 'var(--saritur-orange)'} style={{ display: 'none' }}/> 
                  Detalhes da Solicitação
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ backgroundColor: detailsPromotion.type === 'Vertical' ? 'rgba(2, 132, 199, 0.1)' : 'rgba(243, 113, 55, 0.1)', color: detailsPromotion.type === 'Vertical' ? '#0284c7' : 'var(--saritur-orange)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', border: `1px solid ${detailsPromotion.type === 'Vertical' ? '#0284c7' : 'var(--saritur-orange)'}` }}>
                    {detailsPromotion.type}
                  </span>
                  <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid var(--border-color)' }}>
                    Status: {detailsPromotion.status}
                  </span>
                </div>
              </div>
              <button onClick={() => setDetailsPromotion(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* SESSÃO 1: DADOS BÁSICOS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', backgroundColor: 'var(--bg-color)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Colaborador</span>
                  <p style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '0.2rem' }}>{detailsPromotion.collaborator_name}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CPF</span>
                  <p style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-main)', marginTop: '0.2rem' }}>{detailsPromotion.collaborator_cpf}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Data Admissão</span>
                  <p style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                    {detailsPromotion.admission_date ? detailsPromotion.admission_date.split('T')[0].split('-').reverse().join('/') : 'N/A'}
                  </p>
                </div>
              </div>

              {/* SESSÃO 2: COMPARATIVO */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Situação Atual</h4>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Cargo:</strong> {detailsPromotion.current_role}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Salário:</strong> {Number(detailsPromotion.current_salary).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Setor:</strong> {detailsPromotion.current_sector}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0' }}><strong>Unidade:</strong> {detailsPromotion.current_unit_name || 'N/A'}</p>
                </div>

                <div style={{ border: '1px solid var(--success-color)', borderRadius: 'var(--radius-md)', padding: '1rem', backgroundColor: 'rgba(5, 122, 85, 0.03)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--success-color)', marginBottom: '1rem', borderBottom: '1px solid rgba(5, 122, 85, 0.2)', paddingBottom: '0.5rem' }}>Situação Proposta</h4>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Cargo:</strong> {detailsPromotion.proposed_role}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Salário:</strong> {Number(detailsPromotion.proposed_salary).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Setor:</strong> {detailsPromotion.proposed_sector}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0' }}><strong>Unidade:</strong> {detailsPromotion.proposed_unit_name || 'N/A'}</p>
                </div>
              </div>

              {/* SESSÃO 3: AUDITORIA / HISTÓRICO */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  Auditoria e Linha do Tempo
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'var(--bg-color)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <Plus size={16} color="var(--text-muted)" />
                    <span><strong>Solicitação aberta por:</strong> {detailsPromotion.requester_name || 'Gestor'} em {detailsPromotion.created_at ? new Date(detailsPromotion.created_at).toLocaleString('pt-BR') : 'N/A'}</span>
                  </div>

                  {detailsPromotion.leadership_signature_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#057a55' }}>
                      <PenTool size={16} />
                      <span><strong>Aprovado pela Liderança em:</strong> {new Date(detailsPromotion.leadership_signature_date).toLocaleString('pt-BR')}</span>
                    </div>
                  )}

                  {detailsPromotion.gp2_signature_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#057a55' }}>
                      <CheckCircle size={16} />
                      <span><strong>Validado pelo GP² em:</strong> {new Date(detailsPromotion.gp2_signature_date).toLocaleString('pt-BR')}</span>
                    </div>
                  )}

                  {detailsPromotion.dp_signature_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#057a55' }}>
                      <CheckCircle size={16} />
                      <span><strong>Efetivado no DP em:</strong> {new Date(detailsPromotion.dp_signature_date).toLocaleString('pt-BR')}</span>
                    </div>
                  )}

                  {/* CAIXA DE LOGS E PARECERES */}
                  {detailsPromotion.feedback && (
                    <div style={{ marginTop: '0.75rem', padding: '1rem', backgroundColor: 'var(--surface-color)', border: '1px dashed var(--border-color)', borderRadius: '4px', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                      <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Logs e Interações (Recusas/Ajustes):</strong>
                      <span style={{ color: 'var(--text-muted)' }}>{detailsPromotion.feedback}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <button className="btn-secondary" onClick={() => setDetailsPromotion(null)}>Fechar Raio-X</button>
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

      {/* MODAL RECUSA / AJUSTES */}
      {actionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '450px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--saritur-orange)', marginBottom: '1rem' }}>Recusar para Ajustes</h2>
            <textarea required style={{ width: '100%', minHeight: '100px', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }} placeholder="Descreva os motivos..." value={feedbackText} onChange={e => setFeedbackText(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn-secondary" onClick={() => setActionModal(null)}>Voltar</button>
              <button onClick={() => { if (!feedbackText.trim()) return alert('Insira uma justificativa.'); const note = `\n❌ [RECUSADO GP²] Por: ${currentUserName} em ${new Date().toLocaleString('pt-BR')}:\n"${feedbackText}"\n`; executeWorkflowAction(actionModal.promo.id, 'Recusado pelo GP2 (Ajustes)', { feedback: (actionModal.promo.feedback || '') + note }); }} className="btn-primary" style={{ backgroundColor: 'var(--saritur-orange)' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
