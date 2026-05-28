'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Filter, CheckCircle, Calendar, UserCheck, SearchX } from 'lucide-react';

export default function ConcluidosPage() {
  const [candidates, setCandidates] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [responsibles, setResponsibles] = useState([]);
  const [loading, setLoading] = useState(true);

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
      const [candidatesRes, unitsRes, rolesRes, usersRes] = await Promise.all([
        supabase.from('candidates').select(`*, job_roles(name), units(name), users(name)`).eq('status', 'Concluído').order('admission_date', { ascending: false }),
        supabase.from('units').select('*').order('name'),
        supabase.from('job_roles').select('*').order('name'),
        supabase.from('users').select('*').order('name')
      ]);

      if (candidatesRes.data) setCandidates(candidatesRes.data);
      if (unitsRes.data) setUnits(unitsRes.data);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (usersRes.data) setResponsibles(usersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  // --- Lógica de Filtragem ---
  const filteredCandidates = candidates.filter(c => {
    if (filterProcessType && c.process_type !== filterProcessType) return false;
    if (filterUnit && c.unit_id !== filterUnit) return false;
    if (filterRole && c.job_role_id !== filterRole) return false;
    if (filterResponsible && c.responsible_id !== filterResponsible) return false;

    // Filtro por Período de Data de Admissão
    if (filterDateFrom || filterDateTo) {
      if (!c.admission_date) return false;
      
      // Extrai apenas a parte da data "YYYY-MM-DD" com base no fuso horário do Brasil
      const d = new Date(c.admission_date);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localDateStr = new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
      
      if (filterDateFrom && localDateStr < filterDateFrom) return false;
      if (filterDateTo && localDateStr > filterDateTo) return false;
    }

    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Processos Concluídos</h1>
          <p style={{ color: 'var(--text-muted)' }}>Histórico completo de candidatos que finalizaram a admissão no sistema.</p>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
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

      {/* LISTA DE RESULTADOS */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Buscando o histórico de admissões...</p>
      ) : filteredCandidates.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <SearchX size={48} color="var(--border-color)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Nenhuma Admissão Encontrada</h3>
          <p style={{ color: 'var(--text-muted)' }}>Nenhum candidato atende aos filtros selecionados acima.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {filteredCandidates.map((c) => (
            <div key={c.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '4px solid var(--success-color)' }}>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={20} color="var(--success-color)" />
                    <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                      {c.process_type}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    CPF: {c.cpf}
                  </span>
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
          ))}
        </div>
      )}
    </div>
  );
}
