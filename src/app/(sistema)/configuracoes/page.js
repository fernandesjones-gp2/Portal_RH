'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Check, X, ShieldAlert, Save } from 'lucide-react';

export default function ConfiguracoesPage() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);

  // Estados de formulário
  const [newUnit, setNewUnit] = useState('');
  const [newRole, setNewRole] = useState('');

  // Estados de edição
  const [editingUnit, setEditingUnit] = useState(null);
  const [editingRole, setEditingRole] = useState(null);

  useEffect(() => {
    checkAccessAndFetchData();
  }, []);

  async function checkAccessAndFetchData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Verifica se é ADMIN na tabela de usuários
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (user?.role === 'ADMIN') {
        setIsAdmin(true);
        fetchData();
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error(error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  async function fetchData() {
    const [unitsRes, rolesRes] = await Promise.all([
      supabase.from('units').select('*').order('name'),
      supabase.from('job_roles').select('*').order('name')
    ]);
    if (unitsRes.data) setUnits(unitsRes.data);
    if (rolesRes.data) setRoles(rolesRes.data);
  }

  // --- CRUD UNIDADES ---
  async function handleAddUnit(e) {
    e.preventDefault();
    if (!newUnit) return;
    const { error } = await supabase.from('units').insert([{ name: newUnit }]);
    if (error) return alert('Erro ao adicionar unidade: ' + error.message);
    setNewUnit('');
    fetchData();
  }

  async function handleUpdateUnit() {
    if (!editingUnit.name) return;
    const { error } = await supabase.from('units').update({ name: editingUnit.name }).eq('id', editingUnit.id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    setEditingUnit(null);
    fetchData();
  }

  async function handleDeleteUnit(id) {
    if (!confirm('Deseja excluir esta unidade?')) return;
    const { error } = await supabase.from('units').delete().eq('id', id);
    if (error) {
      alert('Não é possível excluir esta unidade pois já existem candidatos vinculados a ela.');
    } else {
      fetchData();
    }
  }

  // --- CRUD FUNÇÕES (CARGOS) ---
  async function handleAddRole(e) {
    e.preventDefault();
    if (!newRole) return;
    const { error } = await supabase.from('job_roles').insert([{ name: newRole }]);
    if (error) return alert('Erro ao adicionar função: ' + error.message);
    setNewRole('');
    fetchData();
  }

  async function handleUpdateRole() {
    if (!editingRole.name) return;
    const { error } = await supabase.from('job_roles').update({ name: editingRole.name }).eq('id', editingRole.id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    setEditingRole(null);
    fetchData();
  }

  async function handleDeleteRole(id) {
    if (!confirm('Deseja excluir esta função?')) return;
    const { error } = await supabase.from('job_roles').delete().eq('id', id);
    if (error) {
      alert('Não é possível excluir esta função pois já existem candidatos vinculados a ela.');
    } else {
      fetchData();
    }
  }

  if (loading) return <p>Verificando permissões...</p>;

  if (isAdmin === false) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
        <ShieldAlert size={64} color="var(--danger-color)" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Acesso Negado</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Apenas usuários com perfil de Administrador podem acessar as configurações.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Configurações do Sistema</h1>
        <p style={{ color: 'var(--text-muted)' }}>Gerencie os dados base do sistema (Acesso restrito).</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* COLUNA DE UNIDADES */}
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Unidades da Empresa
            <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-color)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>{units.length}</span>
          </h2>

          <form onSubmit={handleAddUnit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input required type="text" placeholder="Nova unidade..." style={{ flex: 1 }} value={newUnit} onChange={e => setNewUnit(e.target.value)} />
            <button type="submit" className="btn-primary" style={{ padding: '0.5rem' }} title="Adicionar Unidade"><Plus size={18} /></button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {units.map(u => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                {editingUnit?.id === u.id ? (
                  <input autoFocus type="text" style={{ flex: 1, marginRight: '0.5rem', padding: '0.2rem 0.5rem' }} value={editingUnit.name} onChange={e => setEditingUnit({...editingUnit, name: e.target.value})} />
                ) : (
                  <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{u.name}</span>
                )}
                
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {editingUnit?.id === u.id ? (
                    <>
                      <button onClick={handleUpdateUnit} className="btn-secondary" style={{ padding: '0.3rem', color: 'var(--success-color)' }}><Save size={14} /></button>
                      <button onClick={() => setEditingUnit(null)} className="btn-secondary" style={{ padding: '0.3rem' }}><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditingUnit(u)} className="btn-secondary" style={{ padding: '0.3rem' }}><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteUnit(u.id)} className="btn-secondary" style={{ padding: '0.3rem', color: 'var(--danger-color)' }}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUNA DE FUNÇÕES (CARGOS) */}
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Funções / Cargos
            <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-color)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>{roles.length}</span>
          </h2>

          <form onSubmit={handleAddRole} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input required type="text" placeholder="Nova função..." style={{ flex: 1 }} value={newRole} onChange={e => setNewRole(e.target.value)} />
            <button type="submit" className="btn-primary" style={{ padding: '0.5rem' }} title="Adicionar Função"><Plus size={18} /></button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {roles.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                {editingRole?.id === r.id ? (
                  <input autoFocus type="text" style={{ flex: 1, marginRight: '0.5rem', padding: '0.2rem 0.5rem' }} value={editingRole.name} onChange={e => setEditingRole({...editingRole, name: e.target.value})} />
                ) : (
                  <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{r.name}</span>
                )}
                
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {editingRole?.id === r.id ? (
                    <>
                      <button onClick={handleUpdateRole} className="btn-secondary" style={{ padding: '0.3rem', color: 'var(--success-color)' }}><Save size={14} /></button>
                      <button onClick={() => setEditingRole(null)} className="btn-secondary" style={{ padding: '0.3rem' }}><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditingRole(r)} className="btn-secondary" style={{ padding: '0.3rem' }}><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteRole(r.id)} className="btn-secondary" style={{ padding: '0.3rem', color: 'var(--danger-color)' }}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
