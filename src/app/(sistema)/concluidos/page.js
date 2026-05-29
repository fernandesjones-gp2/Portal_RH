'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Filter, CheckCircle, Calendar, UserCheck, SearchX, ThumbsDown, X } from 'lucide-react';

export default function ConcluidosPage() {
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [responsibles, setResponsibles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal de Cancelamento de Admissão Concluída
  const [cancelCandidate, setCancelCandidate] = useState(null);
  const [cancelForm, setCancelForm] = useState({ reason: '', notes: '' });

  // Filtros
  const [filterProcessType, setFilterProcessType] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Descobre o perfil do usuário logado
      const me = await api.me();
      if (me) {
        setCurrentUserRole(me.role || '');
      }

      // 2. Busca o histórico de concluídos e tabelas base
      const [candidatesData, unitsData, rolesData, usersData] = await Promise.all([
        api.candidates.list({ status: 'Concluído', orderBy: 'admission_date', order: 'desc' }),
        api.units.list(),
        api.jobRoles.list(),
        api.users.list()
      ]);

      if (candidatesData) setCandidates(candidatesData);
      if (unitsData) setUnits(unitsData);
      if (rolesData) setRoles(rolesData);
      if (usersData) setResponsibles(usersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  // --- FUNÇÃO: ENVIAR SOLICITAÇÃO DE CANCELAMENTO AO PIPELINE ---
  async function handleConfirmCancel(e) {
    e.preventDefault();
    if (!cancelForm.reason) return alert('Por favor, selecione o motivo principal.');

    const cancellationText = `\n[SOLICITAÇÃO DE CANCELAMENTO DE ADMISSÃO] Motivo: ${cancelForm.reason}. ${cancelForm.notes ? `Obs: ${cancelForm.notes}` : ''}`;
    const newFeedback = (cancelCandidate.feedback || '') + cancellationText;

    // Altera o status para voltar ao 3º Bloco e joga a flag de "Cancelamento Pendente"
    try {
      await api.candidates.update(cancelCandidate.id, {
        status: 'Pré-Admissão (Pronto)',
        analysis_status: 'Cancelamento Pendente',
        feedback: newFeedback
      });

      alert(`A solicitação de cancelamento de ${cancelCandidate.name} foi enviada para o Bloco 3 do Pipeline para homologação do DP.`);
      setCancelCandidate(null);
      setCancelForm({ reason: '', notes: '' });
      fetchData();
    } catch (error) {
      alert('Erro ao processar solicitação: ' + error.message);
    }
  }

  const filteredCandidates = candidates.filter(c => {
    if (filterProcessType && c.process_type !== filterProcessType) return false;
    if (filterUnit && c.unit_id !== filterUnit) return false;
    if (filterRole && c.job_role_id !== filterRole) return false;
    if (filterResponsible && c.responsible_id !== filterResponsible) return false;

    if (filterDateFrom || filterDateTo) {
      if (!c.admission_date) return false;
      const d = new Date(c.admission_date);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localDateStr = new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
      
      if (filterDateFrom && localDateStr < filterDateFrom) return false;
      if (filterDateTo && localDateStr > filterDateTo) return false;
    }

    return true;
  });

  // Validador de trava de data (Sempre comparando com o dia de hoje)
  const isCandidateCancelable = (admissionDateStr) => {
    if (!admissionDateStr) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    const admDate = new Date(admissionDateStr);
    admDate.setHours(0,0,0,0);
    return admDate >= today;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Processos Concluídos</h1>
          <p style={{ color: 'var(--text-muted)' }}>Histórico completo de candidatos que finalizaram a admissão no sistema.</p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Filter size={20} color="var(--saritur-orange)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Filtros de Pesquisa</h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>Tipo de Processo</label>
            <select style={{ width: '100%', fontSize: '0.85rem' }} value={filterProcessType} onChange={e => setFilterProcessType(e.target.value)}>
              <option value="">Todos</option>
              <option value="Admissão">Admissão</option>
              <option value="Readmissão">Readmissão</option>
              <option value="Promoção">Promoção</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>Unidade</label>
            <select style={{ width: '100%', fontSize: '0.85rem' }} value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
              <option value="">Todas</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>Função</label>
            <select style={{ width: '100%', fontSize: '0.85rem' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">Todas</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>Responsável (Recrutador)</label>
            <select style={{ width: '100%', fontSize: '0.85rem' }} value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}>
              <option value="">Todos</option>
              {responsibles.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>Admissão (De)</label>
              <input type="date" style={{ width: '100%', fontSize: '0.85rem', padding: '0.45rem' }} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>Admissão (Até)</label>
              <input type="date" style={{ width: '100%', fontSize: '0.85rem', padding: '0.45rem' }} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* CARDS */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Buscando o histórico...</p>
      ) : filteredCandidates.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <SearchX size={48} color="var(--border-color)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Nenhuma Admissão Encontrada</h3>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredCandidates.map((c) => {
            const cancelable = isCandidateCancelable(c.admission_date);
            const canUserCancel = ['ADMIN', 'RECRUITER_ANALYST'].includes(currentUserRole);

            return (
              <div key={c.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '4px solid var(--success-color)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle size={20} color="var(--success-color)" />
                      <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        {c.process_type}
                      </span>
                    </div>
                    
                    {/* BOTÃO DE CANCELAR ADMISSÃO FUTURA OU ATUAL */}
                    {canUserCancel && (
                      <button 
                        disabled={!cancelable}
                        onClick={() => setCancelCandidate(c)}
                        style={{ 
                          padding: '0.3rem 0.5rem', 
                          fontSize: '0.7rem', 
                          borderRadius: 'var(--radius-sm)', 
                          border: '1px solid var(--border-color)',
                          color: cancelable ? 'var(--danger-color)' : '#cccccc',
                          borderColor: cancelable ? 'var(--danger-color)' : '#eaeaea',
                          cursor: cancelable ? 'pointer' : 'not-allowed',
                          backgroundColor: 'transparent'
                        }}
                        title={cancelable ? "Solicitar Cancelamento de Admissão" : "Bloqueado: Admissões retroativas não podem ser canceladas."}
                      >
                        <ThumbsDown size={12} style={{ display: 'inline', marginRight: '4px' }} /> Cancelar
                      </button>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{c.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    {c.job_roles?.name} • {c.units?.name}
                  </p>
                </div>

                <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Calendar size={14} color="var(--saritur-orange)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>
                      Admitido em: {new Date(c.admission_date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <UserCheck size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Recrutador: {c.users?.name || 'Sistema'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE SOLICITAÇÃO DE CANCELAMENTO */}
      {cancelCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>Solicitar Cancelamento</h2>
              <button onClick={() => setCancelCandidate(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Iniciando pedido de cancelamento para <strong>{cancelCandidate.name}</strong>. O processo retornará ao Bloco 3 do Pipeline aguardando a homologação final do DP.
            </p>
            <form onSubmit={handleConfirmCancel} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Motivo do Cancelamento *</label>
                <select required style={{ width: '100%' }} value={cancelForm.reason} onChange={e => setCancelForm({...cancelForm, reason: e.target.value})}>
                  <option value="">-- Selecione o motivo --</option>
                  <option value="Desistência do Candidato de Última Hora">Desistência do Candidato de Última Hora</option>
                  <option value="Identificada irregularidade documental tardia">Identificada irregularidade documental tardia</option>
                  <option value="Mudança de estratégia / Vaga congelada">Mudança de estratégia / Vaga congelada</option>
                  <option value="Erro Operacional de Conclusão">Erro Operacional de Conclusão</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Observações / Justificativa</label>
                <textarea style={{ width: '100%', minHeight: '80px' }} placeholder="Insira os detalhes obrigatórios ou notas para o DP..." value={cancelForm.notes} onChange={e => setCancelForm({...cancelForm, notes: e.target.value})} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setCancelCandidate(null)}>Voltar</button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--danger-color)' }}>Enviar para o Pipeline</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
