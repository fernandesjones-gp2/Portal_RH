'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Plus, Edit2, Trash2, Check, X, ShieldAlert, Save, Users, Settings2, BarChart3, MessageSquareText, Info } from 'lucide-react';

export default function ConfiguracoesPage() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cancellationReasons, setCancellationReasons] = useState([]); 
  const [usersList, setUsersList] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [templates, setTemplates] = useState([]); // Agora vem do banco

  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState(''); 

  const [newUnit, setNewUnit] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newReason, setNewReason] = useState(''); 

  const [editingUnit, setEditingUnit] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [editingReason, setEditingReason] = useState(null); 

  const [dashTargets, setDashTargets] = useState({ targetLeadtime: '15', targetApprovalRate: '60' });
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingTemplateContent, setEditingTemplateContent] = useState('');

  const availableRoles = ['ADMIN', 'RECRUITER', 'RECRUITER_ANALYST', 'MANAGER', 'SUPERINTENDENT', 'GP2', 'DP', 'PSYCHOLOGIST'];
  const menusAcessiveis = [
    { path: '/dashboard', label: 'Dashboard' }, { path: '/agendamentos', label: 'Agendamentos' },
    { path: '/pre-admissao', label: 'Pipeline' }, { path: '/promocoes', label: 'Promoções' },
    { path: '/concluidos', label: 'Concluídos' }, { path: '/configuracoes', label: 'Configurações' }
  ];

  useEffect(() => {
    checkAccessAndFetchData();
    const savedTargets = localStorage.getItem('portal_rh_targets');
    if (savedTargets) setDashTargets(JSON.parse(savedTargets));
  }, []);

  async function checkAccessAndFetchData() {
    setLoading(true);
    try {
      const sessionUser = await api.me();
      if (!sessionUser) { setIsAdmin(false); return; }
      const role = sessionUser.role || sessionUser.data?.role || sessionUser[0]?.role;
      if (role === 'ADMIN') { setIsAdmin(true); await fetchAllData(); } else { setIsAdmin(false); }
    } catch (error) { setIsAdmin(false); } finally { setLoading(false); }
  }

  async function fetchAllData() {
    try {
      const [unitsRes, rolesRes, reasonsRes, usersRes, permsRes, templatesRes] = await Promise.all([
        api.units.list().catch(() => []),
        api.jobRoles.list().catch(() => []),
        api.cancellationReasons.list().catch(() => []),
        api.users.list().catch(() => []),
        api.rolePermissions.list().catch(() => []),
        api.messageTemplates.list().catch(() => []) // PUXA DO BANCO POSTGRES
      ]);
      setUnits(unitsRes || []); setRoles(rolesRes || []); setCancellationReasons(reasonsRes || []);
      setUsersList(usersRes || []); setPermissions(permsRes || []); setTemplates(templatesRes || []);
    } catch (err) { console.error(err); }
  }

  async function togglePermission(role, menu_path, hasPermission) {
    try {
      if (hasPermission) await api.rolePermissions.remove(role, menu_path);
      else await api.rolePermissions.add(role, menu_path);
      fetchAllData();
    } catch (e) { console.error(e); }
  }

  // SALVA NA NUVEM PARA TODOS OS USUÁRIOS
  async function handleSaveTemplate(id) {
    try {
      await api.messageTemplates.update(id, { content: editingTemplateContent });
      alert('Modelo de mensagem atualizado com sucesso no Servidor!');
      setEditingTemplateId(null);
      fetchAllData(); 
    } catch (error) {
      alert('Erro ao salvar no banco de dados.');
    }
  }

  function startEditingTemplate(template) {
    setEditingTemplateId(template.id);
    setEditingTemplateContent(template.content);
  }

  async function handleAddUnit(e) { e.preventDefault(); if (!newUnit) return; try { await api.units.create({ name: newUnit.toUpperCase() }); setNewUnit(''); fetchAllData(); } catch (error) { alert('Erro: ' + error.message); } }
  async function handleUpdateUnit() { if (!editingUnit.name) return; try { await api.units.update(editingUnit.id, { name: editingUnit.name.toUpperCase() }); setEditingUnit(null); fetchAllData(); } catch (error) { alert('Erro: ' + error.message); } }
  async function handleDeleteUnit(id) { if (!confirm('Excluir unidade?')) return; try { await api.units.remove(id); setSelectedUnitId(''); fetchAllData(); } catch (error) { alert('Existem vínculos ativos.'); } }
  async function handleAddRole(e) { e.preventDefault(); if (!newRole) return; try { await api.jobRoles.create({ name: newRole.toUpperCase() }); setNewRole(''); fetchAllData(); } catch (error) { alert('Erro: ' + error.message); } }
  async function handleUpdateRole() { if (!editingRole.name) return; try { await api.jobRoles.update(editingRole.id, { name: editingRole.name.toUpperCase() }); setEditingRole(null); fetchAllData(); } catch (error) { alert('Erro: ' + error.message); } }
  async function handleDeleteRole(id) { if (!confirm('Excluir função?')) return; try { await api.jobRoles.remove(id); setSelectedRoleId(''); fetchAllData(); } catch (error) { alert('Existem vínculos ativos.'); } }
  async function handleAddReason(e) { e.preventDefault(); if (!newReason) return; try { await api.cancellationReasons.create({ name: newReason.toUpperCase() }); setNewReason(''); fetchAllData(); } catch (error) { alert('Erro: ' + error.message); } }
  async function handleUpdateReason() { if (!editingReason.name) return; try { await api.cancellationReasons.update(editingReason.id, { name: editingReason.name.toUpperCase() }); setEditingReason(null); fetchAllData(); } catch (error) { alert('Erro: ' + error.message); } }
  async function handleDeleteReason(id) { if (!confirm('Excluir motivo?')) return; try { await api.cancellationReasons.remove(id); setSelectedReasonId(''); fetchAllData(); } catch (error) { alert('Existem vínculos ativos.'); } }

  async function handleUpdateUserRoleAndUnit(userId, updatedRole, updatedUnitId) {
    try { await api.users.update(userId, { role: updatedRole, unit_id: updatedUnitId || null }); fetchAllData(); } catch (error) { alert('Erro ao atualizar acessos.'); }
  }
  async function handleApproveUser(id) { try { await api.users.update(id, { status: 'Aprovado' }); fetchAllData(); } catch (error) { alert('Erro ao aprovar usuário.'); } }
  async function handleDeleteUser(id) { if (!confirm('Deseja bloquear este usuário?')) return; try { await api.users.remove(id); fetchAllData(); } catch (error) { alert('Erro ao remover.'); } }

  function handleSaveTargets(e) { e.preventDefault(); localStorage.setItem('portal_rh_targets', JSON.stringify(dashTargets)); alert('Metas atualizadas!'); }

  if (loading) return <p style={{ padding: '2rem' }}>Validando credenciais...</p>;
  if (isAdmin === false) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
        <ShieldAlert size={64} color="var(--danger-color)" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Acesso Restrito</h2>
      </div>
    );
  }

  const currentUnitObj = units.find(u => u.id === selectedUnitId);
  const currentRoleObj = roles.find(r => r.id === selectedRoleId);
  const currentReasonObj = cancellationReasons.find(r => r.id === selectedReasonId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div><h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Painel de Governança Integrada</h1><p style={{ color: 'var(--text-muted)' }}>Controle de acessos, tabelas institucionais e chaves do sistema.</p></div>

      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Settings2 size={20} color="var(--saritur-orange)" /> Tabelas de Dados Estruturais (Dropdowns)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
          
          <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Unidades</label>
            <select style={{ width: '100%', marginBottom: '1rem' }} value={selectedUnitId} onChange={e => { setSelectedUnitId(e.target.value); setEditingUnit(null); }}><option value="">-- {units.length} Unidades --</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            {selectedUnitId && currentUnitObj && (
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                {editingUnit ? <input value={editingUnit.name} onChange={e => setEditingUnit({...editingUnit, name: e.target.value})} /> : <strong style={{ fontSize: '0.85rem' }}>{currentUnitObj.name}</strong>}
                <div style={{ display: 'flex', gap: '0.2rem' }}>{editingUnit ? (<><button onClick={handleUpdateUnit} style={{ color: 'var(--success-color)' }}><Check size={14} /></button><button onClick={() => setEditingUnit(null)}><X size={14} /></button></>) : (<><button onClick={() => setEditingUnit(currentUnitObj)}><Edit2 size={14} /></button><button onClick={() => handleDeleteUnit(selectedUnitId)} style={{ color: 'var(--danger-color)' }}><Trash2 size={14} /></button></>)}</div>
              </div>
            )}
            <form onSubmit={handleAddUnit} style={{ display: 'flex', gap: '0.5rem' }}><input type="text" placeholder="Nova..." style={{ flex: 1 }} value={newUnit} onChange={e => setNewUnit(e.target.value)} /><button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button></form>
          </div>

          <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Funções</label>
            <select style={{ width: '100%', marginBottom: '1rem' }} value={selectedRoleId} onChange={e => { setSelectedRoleId(e.target.value); setEditingRole(null); }}><option value="">-- {roles.length} Funções --</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            {selectedRoleId && currentRoleObj && (
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                {editingRole ? <input value={editingRole.name} onChange={e => setEditingRole({...editingRole, name: e.target.value})} /> : <strong style={{ fontSize: '0.85rem' }}>{currentRoleObj.name}</strong>}
                <div style={{ display: 'flex', gap: '0.2rem' }}>{editingRole ? (<><button onClick={handleUpdateRole} style={{ color: 'var(--success-color)' }}><Check size={14} /></button><button onClick={() => setEditingRole(null)}><X size={14} /></button></>) : (<><button onClick={() => setEditingRole(currentRoleObj)}><Edit2 size={14} /></button><button onClick={() => handleDeleteRole(selectedRoleId)} style={{ color: 'var(--danger-color)' }}><Trash2 size={14} /></button></>)}</div>
              </div>
            )}
            <form onSubmit={handleAddRole} style={{ display: 'flex', gap: '0.5rem' }}><input type="text" placeholder="Nova..." style={{ flex: 1 }} value={newRole} onChange={e => setNewRole(e.target.value)} /><button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button></form>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Cancelamentos</label>
            <select style={{ width: '100%', marginBottom: '1rem' }} value={selectedReasonId} onChange={e => { setSelectedReasonId(e.target.value); setEditingReason(null); }}><option value="">-- {cancellationReasons.length} Motivos --</option>{cancellationReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            {selectedReasonId && currentReasonObj && (
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                {editingReason ? <input value={editingReason.name} onChange={e => setEditingReason({...editingReason, name: e.target.value})} /> : <strong style={{ fontSize: '0.85rem' }}>{currentReasonObj.name}</strong>}
                <div style={{ display: 'flex', gap: '0.2rem' }}>{editingReason ? (<><button onClick={handleUpdateReason} style={{ color: 'var(--success-color)' }}><Check size={14} /></button><button onClick={() => setEditingReason(null)}><X size={14} /></button></>) : (<><button onClick={() => setEditingReason(currentReasonObj)}><Edit2 size={14} /></button><button onClick={() => handleDeleteReason(selectedReasonId)} style={{ color: 'var(--danger-color)' }}><Trash2 size={14} /></button></>)}</div>
              </div>
            )}
            <form onSubmit={handleAddReason} style={{ display: 'flex', gap: '0.5rem' }}><input type="text" placeholder="Novo..." style={{ flex: 1 }} value={newReason} onChange={e => setNewReason(e.target.value)} /><button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button></form>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={20} color="var(--saritur-orange)" /> Perfis de Usuários</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead><tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '0.75rem' }}>Colaborador</th><th style={{ padding: '0.75rem' }}>Status</th><th style={{ padding: '0.75rem' }}>Perfil</th><th style={{ padding: '0.75rem' }}>Unidade</th><th style={{ padding: '0.75rem', textAlign: 'right' }}>Ações</th></tr></thead>
            <tbody>
              {usersList.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem' }}><div style={{ fontWeight: '600' }}>{user.name || 'Sem nome'}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</div></td>
                  <td style={{ padding: '0.75rem' }}>{user.status === 'Pendente' ? <span style={{ backgroundColor: 'var(--saritur-yellow)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Pendente</span> : <span style={{ backgroundColor: 'var(--success-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Aprovado</span>}</td>
                  <td style={{ padding: '0.75rem' }}><select style={{ padding: '0.25rem', fontSize: '0.85rem' }} value={user.role || ''} onChange={e => handleUpdateUserRoleAndUnit(user.id, e.target.value, user.unit_id)}>{availableRoles.map(role => <option key={role} value={role}>{role}</option>)}</select></td>
                  <td style={{ padding: '0.75rem' }}><select style={{ padding: '0.25rem', fontSize: '0.85rem', width: '140px' }} value={user.unit_id || ''} onChange={e => handleUpdateUserRoleAndUnit(user.id, user.role, e.target.value)}><option value="">Acesso Geral (Todas)</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{user.status === 'Pendente' && <button onClick={() => handleApproveUser(user.id)} className="btn-secondary" style={{ color: 'var(--success-color)', padding: '0.3rem', marginRight: '0.5rem' }}><Check size={14} /></button>}<button onClick={() => handleDeleteUser(user.id)} className="btn-secondary" style={{ color: 'var(--danger-color)', padding: '0.3rem' }}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShieldAlert size={20} color="var(--saritur-orange)" /> Matriz de Permissões</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead><tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}><th style={{ padding: '0.75rem', textAlign: 'left' }}>Perfil / Telas</th>{menusAcessiveis.map(menu => <th key={menu.path} style={{ padding: '0.75rem', fontWeight: '600' }}>{menu.label}</th>)}</tr></thead>
            <tbody>
              {availableRoles.map(role => (
                <tr key={role} style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '600', textAlign: 'left' }}>{role}</td>
                  {menusAcessiveis.map(menu => { const hasPerm = permissions.some(p => p.role === role && p.menu_path === menu.path); return <td key={`${role}-${menu.path}`} style={{ padding: '0.75rem' }}><input type="checkbox" checked={hasPerm} onChange={() => togglePermission(role, menu.path, hasPerm)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--saritur-orange)' }} /></td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOCO 4: TEMPLATES 100% NO BANCO DE DADOS */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquareText size={20} color="var(--saritur-orange)" /> Modelos de Mensagens Automáticas (Global)
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {templates.map(template => (
            <div key={template.id} style={{ padding: '1.25rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{template.title}</strong>
                {editingTemplateId === template.id ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => handleSaveTemplate(template.id)} className="btn-secondary" style={{ color: 'var(--success-color)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><Check size={14} /> Salvar Alterações</button>
                    <button onClick={() => setEditingTemplateId(null)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><X size={14} /> Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => startEditingTemplate(template)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><Edit2 size={12} /> Alterar Texto</button>
                )}
              </div>
              {editingTemplateId === template.id ? (
                <div>
                  <textarea style={{ width: '100%', minHeight: '80px', padding: '0.75rem', fontFamily: 'inherit', fontSize: '0.9rem', marginBottom: '0.5rem' }} value={editingTemplateContent} onChange={e => setEditingTemplateContent(e.target.value)} />
                </div>
              ) : (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>"{template.content}"</p>
              )}
            </div>
          ))}
          {templates.length === 0 && <p style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>Nenhum template configurado no banco de dados.</p>}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart3 size={20} color="var(--saritur-orange)" /> Parâmetros do Dashboard</h2>
        <form onSubmit={handleSaveTargets} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1.5rem', alignItems: 'end' }}>
          <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Meta Leadtime (Dias)</label><input type="number" placeholder="Ex: 15" value={dashTargets.targetLeadtime} onChange={e => setDashTargets({...dashTargets, targetLeadtime: e.target.value})} /></div>
          <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Taxa de Aprovação (%)</label><input type="number" placeholder="Ex: 60" value={dashTargets.targetApprovalRate} onChange={e => setDashTargets({...dashTargets, targetApprovalRate: e.target.value})} /></div>
          <button type="submit" className="btn-primary" style={{ padding: '0.75rem 1.5rem' }}><Save size={16} /> Salvar Parâmetros</button>
        </form>
      </div>
    </div>
  );
}
