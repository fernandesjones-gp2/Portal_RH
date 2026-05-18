'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, MessageSquare, ThumbsUp, ThumbsDown, Database, X, Filter } from 'lucide-react';

export default function AgendamentosPage() {
  const [candidates, setCandidates] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [responsibles, setResponsibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filtros
  const [filterProcessType, setFilterProcessType] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');

  const [formData, setFormData] = useState({
    process_type: 'Admissão',
    name: '',
    mother_name: '',
    phone: '',
    cpf: '',
    rg: '',
    job_role_id: '',
    unit_id: '',
    interview_date: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [candidatesRes, unitsRes, rolesRes, usersRes] = await Promise.all([
        supabase.from('candidates').select(`*, job_roles(name), units(name), users(name)`).eq('status', 'Agendado').order('created_at', { ascending: false }),
        supabase.from('units').select('*'),
        supabase.from('job_roles').select('*'),
        supabase.from('users').select('*')
      ]);
      
      if (candidatesRes.data) setCandidates(candidatesRes.data);
      if (unitsRes.data) {
        setUnits(unitsRes.data);
        if (unitsRes.data.length > 0) setFormData(f => ({ ...f, unit_id: unitsRes.data[0].id }));
      }
      if (rolesRes.data) {
        setRoles(rolesRes.data);
        if (rolesRes.data.length > 0) setFormData(f => ({ ...f, job_role_id: rolesRes.data[0].id }));
      }
      if (usersRes.data) setResponsibles(usersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCandidate(e) {
    e.preventDefault();
    
    const { data: { session } } = await supabase.auth.getSession();
    const responsible_id = session?.user?.id || null; 

    // NO MOMENTO DO AGENDAMENTO: Se houver uma conta logada real, garante a existência dela na tabela pública antes de criar o vínculo
    if (responsible_id) {
      await supabase.from('users').upsert({
        id: responsible_id,
        email: session.user.email,
        name: session.user.user_metadata?.full_name || session.user.email
      });
    }

    const { data, error } = await supabase.from('candidates').insert([
      { ...formData, responsible_id }
    ]).select();

    if (error) {
      alert('Erro ao salvar candidato: ' + error.message);
      return;
    }

    setIsModalOpen(false);
    fetchData(); 

    const roleName = roles.find(r => r.id === formData.job_role_id)?.name || '';
    const unitName = units.find(u => u.id === formData.unit_id)?.name || '';
    const eventTitle = encodeURIComponent(`${formData.process_type} - ${formData.name} - ${roleName} - ${unitName}`);
    
    const d = new Date(formData.interview_date);
    const dateStr = d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const dEnd = new Date(d.getTime() + 60 * 60 * 1000); 
    const dateEndStr = dEnd.toISOString().replace(/-|:|\.\d\d\d/g, "");
    
    const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${dateStr}/${dateEndStr}&details=Candidato:+${formData.name}%0ATelefone:+${formData.phone}`;
    window.open(calUrl, '_blank');
  }
  async function changeStatus(id, newStatus) {
    const { error } = await supabase.from('candidates').update({ status: newStatus }).eq('id', id);
    if (!error) fetchData();
  }

  async function handleApprove(candidate) {
    if (confirm('Deseja solicitar a documentação para o candidato no WhatsApp?')) {
      const msg = encodeURIComponent(`Olá ${candidate.name}, você foi aprovado na entrevista! Por favor, envie sua documentação para iniciarmos o processo.`);
      const phone = candidate.phone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
    }
    const { error } = await supabase.from('candidates').update({ 
      status: 'Pré-Admissão (Pendente)',
      docs_status: 'Solicitada',
      docs_request_date: new Date().toISOString()
    }).eq('id', candidate.id);
    if (!error) fetchData();
  }

  const filteredCandidates = candidates.filter(c => {
    if (filterProcessType && c.process_type !== filterProcessType) return false;
    if (filterUnit && c.unit_id !== filterUnit) return false;
    if (filterRole && c.job_role_id !== filterRole) return false;
    if (filterResponsible && c.responsible_id !== filterResponsible) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Agendamentos</h1>
          <p style={{ color: 'var(--text-muted)' }}>Gerencie as entrevistas e os candidatos em andamento.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} />
          Novo Candidato
        </button>
      </div>

      {/* BARRA DE FILTROS */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', backgroundColor: 'var(--surface-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', alignItems: 'center' }}>
        <Filter size={20} color="var(--text-muted)" />
        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)', marginRight: '0.5rem' }}>Filtros:</span>
        
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', minWidth: '140px' }} value={filterProcessType} onChange={e => setFilterProcessType(e.target.value)}>
          <option value="">Todos os Processos</option>
          <option value="Admissão">Admissão</option>
          <option value="Readmissão">Readmissão</option>
          <option value="Promoção">Promoção</option>
        </select>
        
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', minWidth: '140px' }} value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
          <option value="">Todas as Unidades</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', minWidth: '140px' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">Todas as Funções</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', minWidth: '140px' }} value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}>
          <option value="">Todos os Responsáveis</option>
          {responsibles.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
        </select>
      </div>

      {loading ? (
        <p>Conectando ao banco de dados...</p>
      ) : filteredCandidates.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}>
          <p style={{ color: 'var(--text-muted)' }}>Nenhum candidato encontrado.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {filteredCandidates.map((c) => (
            <div key={c.id} style={{ 
              backgroundColor: 'var(--surface-color)', 
              padding: '1.5rem', 
              borderRadius: 'var(--radius-lg)', 
              boxShadow: 'var(--shadow-sm)', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ backgroundColor: c.process_type === 'Promoção' ? 'var(--saritur-yellow)' : 'var(--saritur-orange)', color: c.process_type === 'Promoção' ? 'black' : 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {c.process_type}
                  </span>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{c.name}</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{c.job_roles?.name} • {c.units?.name}</p>
                <p style={{ color: 'var(--text-main)', fontSize: '0.875rem', fontWeight: '500', marginTop: '0.5rem' }}>
                  Entrevista: {new Date(c.interview_date).toLocaleString('pt-BR')} • Responsável: {c.users?.name || 'N/A'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" title="Editar"><Edit2 size={16} /></button>
                <button className="btn-secondary" title="Parecer"><MessageSquare size={16} /></button>
                <button className="btn-secondary" onClick={() => changeStatus(c.id, 'Banco de Talentos')} title="Banco de Talentos"><Database size={16} /></button>
                <button className="btn-secondary" onClick={() => handleApprove(c)} style={{ color: 'var(--success-color)', borderColor: 'var(--success-color)' }} title="Aprovar"><ThumbsUp size={16} /></button>
                <button className="btn-secondary" onClick={() => changeStatus(c.id, 'Reprovado')} style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} title="Reprovar"><ThumbsDown size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL (continua o mesmo) */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Novo Candidato</h2>
              <button onClick={() => setIsModalOpen(false)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <form onSubmit={handleSaveCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Tipo de Processo</label>
                <select required style={{ width: '100%' }} value={formData.process_type} onChange={e => setFormData({...formData, process_type: e.target.value})}>
                  <option value="Admissão">Admissão</option>
                  <option value="Readmissão">Readmissão</option>
                  <option value="Promoção">Promoção</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Nome Completo</label>
                  <input required type="text" style={{ width: '100%' }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Nome da Mãe</label>
                  <input required type="text" style={{ width: '100%' }} value={formData.mother_name} onChange={e => setFormData({...formData, mother_name: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Telefone (WhatsApp)</label>
                  <input required type="text" style={{ width: '100%' }} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>CPF</label>
                  <input required type="text" style={{ width: '100%' }} value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>RG</label>
                  <input required type="text" style={{ width: '100%' }} value={formData.rg} onChange={e => setFormData({...formData, rg: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Função</label>
                  <select required style={{ width: '100%' }} value={formData.job_role_id} onChange={e => setFormData({...formData, job_role_id: e.target.value})}>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Unidade</label>
                  <select required style={{ width: '100%' }} value={formData.unit_id} onChange={e => setFormData({...formData, unit_id: e.target.value})}>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Data e Hora da Entrevista</label>
                <input required type="datetime-local" style={{ width: '100%' }} value={formData.interview_date} onChange={e => setFormData({...formData, interview_date: e.target.value})} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar e Agendar no Google</button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
