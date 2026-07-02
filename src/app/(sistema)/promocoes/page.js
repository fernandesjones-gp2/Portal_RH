'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { TrendingUp, Clock, SearchX, Plus, X, CheckCircle, FileText, AlertTriangle } from 'lucide-react';

export default function PromocoesPage() {
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);

  const [promotions, setPromotions] = useState([]);
  const [approvedCandidates, setApprovedCandidates] = useState([]); // Banco de validados
  const [units, setUnits] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('minhas');
  
  // FORMULÁRIO PADRÃO
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
      }

      const [promosRes, candsRes, unitsRes] = await Promise.all([
        api.promotions.list().catch(() => []),
        api.candidates.list({ _t: Date.now() }),
        api.units.list()
      ]);

      setPromotions(promosRes || []);
      setUnits(unitsRes || []);

      // MOTOR DE VALIDAÇÃO: Puxa candidatos de promoção aprovados nos últimos 6 meses
      if (candsRes) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const validados = candsRes.filter(c => 
          c.process_type === 'Promoção' && 
          c.status === 'Promoção (Em Andamento)' && // É o status que definimos na tela de agendamentos
          new Date(c.created_at) >= sixMonthsAgo
        );
        setApprovedCandidates(validados);
      }

    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  }

  // Máscaras
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

    // TRAVA DE SEGURANÇA: FLUXO 2 (PROMOÇÃO VERTICAL)
    let linkedCandidateId = null;
    if (formData.type === 'Vertical') {
      const cleanCpf = formData.collaborator_cpf.replace(/\D/g, '');
      const validCandidate = approvedCandidates.find(c => c.cpf && c.cpf.replace(/\D/g, '') === cleanCpf);
      
      if (!validCandidate) {
        alert('❌ BLOQUEIO: Este colaborador NÃO possui uma entrevista de promoção válida aprovada nos últimos 6 meses pelo psicólogo. Solicite a entrevista antes de prosseguir.');
        return;
      }
      linkedCandidateId = validCandidate.id;
    }

    const payload = {
      ...formData,
      current_salary: parseFloat(formData.current_salary.replace(/\./g, '').replace(',', '.')),
      proposed_salary: parseFloat(formData.proposed_salary.replace(/\./g, '').replace(',', '.')),
      requester_id: currentUserId,
      candidate_id: linkedCandidateId,
      status: 'Aguardando Liderança' // Fluxo 1 inicia aqui
    };

    try {
      await api.promotions.create(payload);
      alert('Solicitação de Promoção aberta com sucesso! Enviada para assinatura da Liderança.');
      setFormData(initialForm);
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert('Erro ao abrir solicitação: ' + err.message);
    }
  }

  // Visibilidade por perfil
  const filteredPromotions = promotions.filter(p => {
    if (activeTab === 'minhas') return p.requester_id === currentUserId;
    if (activeTab === 'lideranca') return p.status === 'Aguardando Liderança';
    if (activeTab === 'gp2') return p.status === 'Aguardando GP2';
    if (activeTab === 'dp') return p.status === 'Aguardando DP';
    if (activeTab === 'concluidas') return p.status === 'Concluído';
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Gestão de Promoções</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Fluxo unificado de solicitações, assinaturas e efetivação no DP.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} style={{ marginRight: '8px' }}/> Abrir Solicitação
        </button>
      </div>

      {/* TABS DE FLUXO */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        <button className={activeTab === 'minhas' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('minhas')}>Minhas Solicitações</button>
        <button className={activeTab === 'lideranca' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('lideranca')}>Pendentes Liderança</button>
        <button className={activeTab === 'gp2' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('gp2')}>Validação GP²</button>
        <button className={activeTab === 'dp' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('dp')}>Efetivação DP</button>
        <button className={activeTab === 'concluidas' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('concluidas')}>Concluídas</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Sincronizando fluxo...</p>
      ) : filteredPromotions.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <SearchX size={48} color="var(--border-color)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Nenhuma solicitação nesta etapa</h3>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {filteredPromotions.map(p => (
            <div key={p.id} className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', borderTop: p.type === 'Vertical' ? '4px solid #0284c7' : '4px solid var(--saritur-orange)', backgroundColor: 'var(--surface-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={18} color={p.type === 'Vertical' ? '#0284c7' : 'var(--saritur-orange)'} />
                  <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                    {p.type}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--saritur-yellow)' }}>{p.status}</span>
              </div>
              
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{p.collaborator_name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                De: {p.current_role} <br/>Para: {p.proposed_role}
              </p>

              <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={14} color="var(--text-muted)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Efetivação: 01/{p.promotion_month_year}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE NOVA SOLICITAÇÃO COM TRAVAS */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={24} color="var(--saritur-orange)"/> Formulário de Solicitação</h2>
              <button onClick={() => setIsModalOpen(false)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <form onSubmit={handleSavePromotion} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ padding: '1rem', backgroundColor: formData.type === 'Vertical' ? 'rgba(2, 132, 199, 0.05)' : 'var(--bg-color)', border: formData.type === 'Vertical' ? '1px solid #0284c7' : '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.5rem' }}>Tipo de Promoção *</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="radio" name="type" checked={formData.type === 'Horizontal'} onChange={() => setFormData({...formData, type: 'Horizontal'})} style={{ accentColor: 'var(--saritur-orange)', width: '18px', height: '18px' }} />
                    <strong>Horizontal</strong> (Aumento Salarial / Manutenção de Cargo)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="radio" name="type" checked={formData.type === 'Vertical'} onChange={() => setFormData({...formData, type: 'Vertical'})} style={{ accentColor: '#0284c7', width: '18px', height: '18px' }} />
                    <strong>Vertical</strong> (Mudança de Cargo)
                  </label>
                </div>
                {formData.type === 'Vertical' && (
                  <p style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle size={14} /> <strong>Atenção:</strong> Ao avançar, o sistema auditará se o CPF informado foi aprovado pelo psicólogo nos últimos 6 meses.
                  </p>
                )}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Criar Solicitação e Assinar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
