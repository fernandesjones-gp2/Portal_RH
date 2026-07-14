'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Filter, CheckCircle, Calendar, UserCheck, SearchX, ThumbsDown, X, Download, Eraser, ChevronDown } from 'lucide-react';

// --- COMPONENTE CUSTOMIZADO: DROPDOWN COM CHECKBOX CORRIGIDO ---
const MultiSelect = ({ label, options, selectedValues, onChange, placeholder = "Todas..." }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (val) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>{label}</label>
      
      {/* CORREÇÃO DO CADEADO DE POSIÇÃO: Ancorado estritamente ao redor do botão */}
      <div style={{ position: 'relative', width: '100%' }}>
        <div 
          onClick={() => setIsOpen(!isOpen)}
          style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', cursor: 'pointer', display: 'flex', justify: 'space-between', alignItems: 'center' }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedValues.length > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
            {selectedValues.length === 0 ? placeholder : `${selectedValues.length} selecionada(s)`}
          </span>
          <ChevronDown size={14} color="var(--text-muted)" />
        </div>
        
        {isOpen && (
          <>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} onClick={() => setIsOpen(false)} />
            
            {/* Menu suspenso agora colado perfeitamente embaixo do botão */}
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '2px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '4px', boxShadow: 'var(--shadow-md)', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
              {options.map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', gap: '0.5rem', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={selectedValues.includes(opt.value)} 
                    onChange={() => handleToggle(opt.value)} 
                    style={{ accentColor: 'var(--saritur-orange)', width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                  />
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default function ConcluidosPage() {
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [userPermissions, setUserPermissions] = useState({}); 

  const [candidates, setCandidates] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [responsibles, setResponsibles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [cancelCandidate, setCancelCandidate] = useState(null);
  const [cancelForm, setCancelForm] = useState({ reason: '', notes: '' });

  // ESTADOS DE FILTRO
  const [filterProcessType, setFilterProcessType] = useState([]);
  const [filterUnit, setFilterUnit] = useState([]);
  const [filterRole, setFilterRole] = useState([]);
  const [filterResponsible, setFilterResponsible] = useState([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    fetchData(false);
    const interval = setInterval(() => fetchData(true), 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData(silent = false) {
    if (!silent) setLoading(true);
    try {
      if (!silent) {
        const me = await api.me();
        let roleName = '';
        if (me) {
          roleName = me.role || '';
          setCurrentUserRole(roleName);
        }

        const [candidatesData, unitsData, rolesData, usersData, customRolesData] = await Promise.all([
          api.candidates.list({ status: 'Concluído', orderBy: 'admission_date', order: 'desc' }),
          api.units.list(),
          api.jobRoles.list(),
          api.users.list(),
          api.customRoles.list().catch(() => [])
        ]);

        if (me && customRolesData) {
          const myRoleObj = customRolesData.find(r => r.name === roleName);
          if (myRoleObj && myRoleObj.permissions) setUserPermissions(myRoleObj.permissions);
        }

        if (candidatesData) setCandidates(candidatesData.filter(c => c.status === 'Concluído'));
        if (unitsData) setUnits(unitsData);
        if (rolesData) setRoles(rolesData);
        if (usersData) setResponsibles(usersData);
      } else {
        const candidatesData = await api.candidates.list({ status: 'Concluído', orderBy: 'admission_date', order: 'desc', _t: Date.now() }).catch(() => null);
        if (candidatesData) setCandidates(candidatesData.filter(c => c.status === 'Concluído'));
      }
    } catch (error) {
      if (!silent) console.error('Error fetching data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const maskCPF = (val) => {
    if (!val) return '';
    return val.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  async function handleConfirmCancel(e) {
    e.preventDefault();
    if (!cancelForm.reason) return alert('Por favor, selecione o motivo principal.');

    const cancellationText = `\n[SOLICITAÇÃO DE CANCELAMENTO DE ADMISSÃO] Motivo: ${cancelForm.reason}. ${cancelForm.notes ? `Obs: ${cancelForm.notes}` : ''}`;
    const newFeedback = (cancelCandidate.feedback || '') + cancellationText;

    try {
      await api.candidates.update(cancelCandidate.id, {
        status: 'Pré-Admissão (Pronto)',
        analysis_status: 'Cancelamento Pendente',
        feedback: newFeedback
      });
      alert(`A solicitação de cancelamento de ${cancelCandidate.name} foi enviada para o Bloco 3 do Pipeline.`);
      setCancelCandidate(null);
      setCancelForm({ reason: '', notes: '' });
      fetchData();
    } catch(err) {
      alert('Erro ao processar solicitação.');
    }
  }

  const filteredCandidates = candidates.filter(c => {
    if (filterProcessType.length > 0 && !filterProcessType.includes(c.process_type)) return false;
    if (filterUnit.length > 0 && !filterUnit.includes(c.unit_id)) return false;
    if (filterRole.length > 0 && !filterRole.includes(c.job_role_id)) return false;
    if (filterResponsible.length > 0 && !filterResponsible.includes(c.responsible_id)) return false;

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

  const isCandidateCancelable = (admissionDateStr) => {
    if (!admissionDateStr) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    const admDate = new Date(admissionDateStr); admDate.setHours(0,0,0,0);
    return admDate >= today;
  };

  function handleExportExcel() {
    if (filteredCandidates.length === 0) return alert('Nenhum candidato encontrado com os filtros atuais.');
    const exportColumns = [
      { label: 'Nº', value: (c, index) => index + 1 },
      { label: 'Nome Completo', value: (c) => c.name || '' },
      { label: 'CPF', value: (c) => maskCPF(c.cpf) },
      { label: 'Função', value: (c) => roles.find(r => r.id === c.job_role_id)?.name || c.job_role_name || '' },
      { label: 'Unidade', value: (c) => units.find(u => u.id === c.unit_id)?.name || c.unit_name || '' },
      { label: 'Data de Admissão', value: (c) => c.admission_date ? new Date(c.admission_date).toLocaleDateString('pt-BR') : '' },
    ];

    let htmlContent = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>table { border-collapse: collapse; font-family: Arial, sans-serif; } th { background-color: #057a55; color: white; font-weight: bold; border: 1px solid #000; padding: 8px; text-align: left; } td { border: 1px solid #000; padding: 8px; vertical-align: middle; }</style></head><body><table><tr>${exportColumns.map(col => `<th>${col.label}</th>`).join('')}</tr>${filteredCandidates.map((c, index) => `<tr>${exportColumns.map(col => `<td>${col.value(c, index)}</td>`).join('')}</tr>`).join('')}</table></body></html>`;

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `Relatorio_Admissoes_${new Date().toISOString().split('T')[0]}.xls`;
    link.href = url; link.setAttribute('download', fileName); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }

  function clearFilters() {
    setFilterProcessType([]);
    setFilterUnit([]);
    setFilterRole([]);
    setFilterResponsible([]);
    setFilterDateFrom('');
    setFilterDateTo('');
  }

  const canUserCancel = ['ADMIN', 'RECRUITER_ANALYST'].includes(currentUserRole) || userPermissions['/concluidos']?.delete;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Processos Concluídos</h1>
          <p style={{ color: 'var(--text-muted)' }}>Histórico completo de candidatos que finalizaram a admissão no sistema.</p>
        </div>
        
        <button className="btn-primary" onClick={handleExportExcel} style={{ backgroundColor: 'var(--success-color)', padding: '0.6rem 1.25rem' }}>
          <Download size={18} style={{ marginRight: '8px' }} /> Exportar Relatório (.XLS)
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={20} color="var(--saritur-orange)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Filtros Avançados</h2>
          </div>
          <button onClick={clearFilters} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem' }}>
            <Eraser size={14} style={{ marginRight: '4px' }} /> Limpar Filtros
          </button>
        </div>
        
        {/* DESIGN ATUALIZADO: Usando flex row com alinhamento por baixo */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end' }}>
          
          <div style={{ flex: '1 1 180px' }}>
            <MultiSelect 
              label="Tipo de Processo" 
              options={[
                {value: 'Admissão', label: 'Admissão'}, 
                {value: 'Readmissão', label: 'Readmissão'}, 
                {value: 'Promoção', label: 'Promoção'}
              ]}
              selectedValues={filterProcessType}
              onChange={setFilterProcessType}
              placeholder="Todos os Tipos"
            />
          </div>

          <div style={{ flex: '1 1 180px' }}>
            <MultiSelect 
              label="Unidade" 
              options={units.map(u => ({ value: u.id, label: u.name }))}
              selectedValues={filterUnit}
              onChange={setFilterUnit}
              placeholder="Todas as Unidades"
            />
          </div>

          <div style={{ flex: '1 1 180px' }}>
            <MultiSelect 
              label="Função" 
              options={roles.map(r => ({ value: r.id, label: r.name }))}
              selectedValues={filterRole}
              onChange={setFilterRole}
              placeholder="Todas as Funções"
            />
          </div>

          <div style={{ flex: '1 1 180px' }}>
            <MultiSelect 
              label="Responsável" 
              options={responsibles.map(user => ({ value: user.id, label: user.name || user.email }))}
              selectedValues={filterResponsible}
              onChange={setFilterResponsible}
              placeholder="Todos"
            />
          </div>

          {/* CORREÇÃO: SELETORES DE DATA LADO A LADO NUM BLOCO ÚNICO */}
          <div style={{ display: 'flex', gap: '0.75rem', flex: '2 1 320px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>Admissão (De)</label>
              <input type="date" style={{ width: '100%', fontSize: '0.85rem', padding: '0.45rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>Admissão (Até)</label>
              <input type="date" style={{ width: '100%', fontSize: '0.85rem', padding: '0.45rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
          </div>

        </div>
      </div>

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
            const roleName = roles.find(r => r.id === c.job_role_id)?.name || c.job_role_name || 'Função não informada';
            const unitName = units.find(u => u.id === c.unit_id)?.name || c.unit_name || 'Unidade não informada';
            const recruiterObj = responsibles.find(r => r.id === c.responsible_id);
            const recruiterName = recruiterObj?.name || recruiterObj?.email || c.responsible_name || 'Sistema';

            return (
              <div key={c.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '4px solid var(--success-color)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle size={20} color="var(--success-color)" />
                      <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>{c.process_type}</span>
                      {c.is_pcd && <span style={{ backgroundColor: '#0284c7', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>PCD</span>}
                    </div>
                    
                    {canUserCancel && (
                      <button 
                        disabled={!cancelable}
                        onClick={() => setCancelCandidate(c)}
                        style={{ 
                          padding: '0.3rem 0.5rem', fontSize: '0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                          color: cancelable ? 'var(--danger-color)' : '#cccccc', borderColor: cancelable ? 'var(--danger-color)' : '#eaeaea',
                          cursor: cancelable ? 'pointer' : 'not-allowed', backgroundColor: 'transparent'
                        }}
                        title={cancelable ? "Solicitar Cancelamento de Admissão" : "Bloqueado: Admissões retroativas não podem ser canceladas."}
                      >
                        <ThumbsDown size={12} style={{ display: 'inline', marginRight: '4px' }} /> Cancelar
                      </button>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{c.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>{roleName} • {unitName}</p>
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
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recrutador: {recruiterName}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancelCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>Solicitar Cancelamento</h2>
              <button onClick={() => setCancelCandidate(null)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            <form onSubmit={handleConfirmCancel} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Motivo do Cancelamento *</label><select required style={{ width: '100%', padding: '0.6rem' }} value={cancelForm.reason} onChange={e => setCancelForm({...cancelForm, reason: e.target.value})}><option value="">-- Selecione o motivo --</option><option value="Desistência do Candidato de Última Hora">Desistência do Candidato de Última Hora</option><option value="Identificada irregularidade documental tardia">Identificada irregularidade documental tardia</option><option value="Mudança de estratégia / Vaga congelada">Mudança de estratégia / Vaga congelada</option><option value="Erro Operacional de Conclusão">Erro Operacional de Conclusão</option><option value="Outros">Outros</option></select></div>
              <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Observações / Justificativa</label><textarea style={{ width: '100%', minHeight: '80px', padding: '0.6rem' }} value={cancelForm.notes} onChange={e => setCancelForm({...cancelForm, notes: e.target.value})} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}><button type="button" className="btn-secondary" onClick={() => setCancelCandidate(null)}>Voltar</button><button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--danger-color)' }}>Enviar para o Pipeline</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
