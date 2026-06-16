'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Plus, Edit2, Trash2, Check, X, ShieldAlert, Save, Users, Settings2, BarChart3, MessageSquareText, PieChart, Lock, UserCog } from 'lucide-react';

export default function ConfiguracoesPage() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cancellationReasons, setCancellationReasons] = useState([]); 
  const [usersList, setUsersList] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [widgets, setWidgets] = useState([]); 
  const [customRoles, setCustomRoles] = useState([]); // Perfis Dinâmicos

  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState(''); 
  const [newUnit, setNewUnit] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newReason, setNewReason] = useState(''); 
  const [editingUnit, setEditingUnit] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [editingReason, setEditingReason] = useState(null); 
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingTemplateContent, setEditingTemplateContent] = useState('');

  const [dashTargets, setDashTargets] = useState({ targetLeadtime: '15', targetApprovalRate: '60' });

  // CONSTRUTOR DE DASHBOARD
  const [editingWidget, setEditingWidget] = useState(null);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
  const defaultFunnelColors = ['#BDBDBD', '#1976D2', '#FB8C00', '#2E7D32']; 
  const [widgetForm, setWidgetForm] = useState({ 
    title: '', chart_type: 'kpi', metric_type: 'count', status_filter: 'Todos', color: '#F37137', roles_visible: [],
    advanced_config: { format: 'integer', size: 'half', groupBy: 'all', funnelColors: defaultFunnelColors }, visibility_type: 'generic'
  });

  // CONSTRUTOR DE PERFIS E PERMISSÕES (RBAC)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingCustomRole, setEditingCustomRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', permissions: {} });

  // EDIÇÃO MULTI-UNIDADE DE USUÁRIO
  const [isUserAcessModalOpen, setIsUserAcessModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const menusAcessiveis = [
    { path: '/dashboard', label: 'Dashboard' }, 
    { path: '/agendamentos', label: 'Agendamentos' },
    { path: '/pre-admissao', label: 'Pipeline de Admissão' }, 
    { path: '/promocoes', label: 'Gestão de Promoções' },
    { path: '/concluidos', label: 'Processos Concluídos' }, 
    { path: '/configuracoes', label: 'Configurações do Sistema' }
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
      const [unitsRes, rolesRes, reasonsRes, usersRes, templatesRes, widgetsRes, customRolesRes] = await Promise.all([
        api.units.list().catch(() => []), api.jobRoles.list().catch(() => []), api.cancellationReasons.list().catch(() => []),
        api.users.list().catch(() => []), api.messageTemplates.list().catch(() => []),
        api.dashboardWidgets.list().catch(() => []), api.customRoles.list().catch(() => [])
      ]);
      setUnits(unitsRes || []); setRoles(rolesRes || []); setCancellationReasons(reasonsRes || []);
      setUsersList(usersRes || []); setTemplates(templatesRes || []); setWidgets(widgetsRes || []);
      setCustomRoles(customRolesRes || []);
    } catch (err) {}
  }

  // --- MOTOR DO CONSTRUTOR DE PERFIS (RBAC) ---
  const handleToggleModulePermission = (path, action) => {
    const currentPerms = { ...roleForm.permissions };
    if (!currentPerms[path]) currentPerms[path] = { view: false, create: false, edit: false, delete: false };
    
    currentPerms[path][action] = !currentPerms[path][action];
    
    // Regra de Ouro: Se tem direito a criar, editar ou excluir, obrigatoriamente tem que conseguir ver.
    if ((action === 'create' || action === 'edit' || action === 'delete') && currentPerms[path][action]) {
      currentPerms[path].view = true;
    }
    // Regra de Ouro Inversa: Se tirou a permissão de ver, tira todas as outras.
    if (action === 'view' && !currentPerms[path].view) {
      currentPerms[path] = { view: false, create: false, edit: false, delete: false };
    }
    
    setRoleForm({ ...roleForm, permissions: currentPerms });
  };

  const handleSaveCustomRole = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) return alert('Dê um nome para o perfil.');
    try {
      if (editingCustomRole) await api.customRoles.update(editingCustomRole.id, roleForm);
      else await api.customRoles.create({ name: roleForm.name.toUpperCase(), permissions: roleForm.permissions });
      setIsRoleModalOpen(false); setEditingCustomRole(null); fetchAllData();
    } catch (err) { alert('Erro ao salvar Perfil: ' + err.message); }
  };

  const handleDeleteCustomRole = async (id) => {
    if (!confirm('Atenção: Excluir este perfil pode deixar usuários sem acesso. Confirmar?')) return;
    try { await api.customRoles.remove(id); fetchAllData(); } catch (err) { alert('Erro ao excluir perfil.'); }
  };

  // --- MOTOR DE MÚLTIPLAS UNIDADES PARA O USUÁRIO ---
  const openUserAccessModal = (user) => {
    setEditingUser({
      ...user,
      unit_ids: user.unit_ids || (user.unit_id ? [user.unit_id] : []) // Pega o array novo ou converte o antigo
    });
    setIsUserAcessModalOpen(true);
  };

  const toggleUserUnit = (unitId) => {
    const currentUnits = [...(editingUser.unit_ids || [])];
    if (currentUnits.includes(unitId)) {
      setEditingUser({ ...editingUser, unit_ids: currentUnits.filter(id => id !== unitId) });
    } else {
      setEditingUser({ ...editingUser, unit_ids: [...currentUnits, unitId] });
    }
  };

  const handleSaveUserAccess = async (e) => {
    e.preventDefault();
    try {
      await api.users.update(editingUser.id, { 
        role: editingUser.role, 
        unit_ids: editingUser.unit_ids,
        unit_id: editingUser.unit_ids.length > 0 ? editingUser.unit_ids[0] : null // Mantém o primeiro para compatibilidade legada temporária
      });
      setIsUserAcessModalOpen(false);
      fetchAllData();
    } catch (err) { alert('Erro ao salvar acessos do usuário.'); }
  };


  // --- FUNÇÕES BÁSICAS MANTIDAS ---
  function handleVisibilityChange(type) {
    const allRoleNames = customRoles.map(r => r.name);
    const internalRoles = customRoles.filter(r => ['ADMIN', 'RH', 'DP'].some(k => r.name.includes(k))).map(r => r.name);
    if (type === 'generic') setWidgetForm({ ...widgetForm, visibility_type: 'generic', roles_visible: allRoleNames });
    else setWidgetForm({ ...widgetForm, visibility_type: 'internal', roles_visible: internalRoles });
  }

  function handleRoleToggleWidget(role) {
    if (widgetForm.roles_visible.includes(role)) setWidgetForm({ ...widgetForm, roles_visible: widgetForm.roles_visible.filter(r => r !== role) });
    else setWidgetForm({ ...widgetForm, roles_visible: [...widgetForm.roles_visible, role] });
  }

  async function handleSaveWidget(e) { e.preventDefault(); if (widgetForm.roles_visible.length === 0) return alert('Selecione ao menos um perfil.'); try { if (editingWidget) await api.dashboardWidgets.update(editingWidget.id, widgetForm); else await api.dashboardWidgets.create(widgetForm); setIsWidgetModalOpen(false); setEditingWidget(null); fetchAllData(); } catch (err) { alert('Erro ao salvar Indicador: ' + err.message); } }
  async function handleDeleteWidget(id) { if (!confirm('Excluir este indicador?')) return; try { await api.dashboardWidgets.remove(id); fetchAllData(); } catch (err) {} }
  async function handleSaveTemplate(id) { try { await api.messageTemplates.update(id, { content: editingTemplateContent }); alert('Salvo!'); setEditingTemplateId(null); fetchAllData(); } catch (error) {} }
  function startEditingTemplate(template) { setEditingTemplateId(template.id); setEditingTemplateContent(template.content); }
  async function handleAddUnit(e) { e.preventDefault(); if (!newUnit) return; try { await api.units.create({ name: newUnit.toUpperCase() }); setNewUnit(''); fetchAllData(); } catch (error) {} }
  async function handleUpdateUnit() { if (!editingUnit.name) return; try { await api.units.update(editingUnit.id, { name: editingUnit.name.toUpperCase() }); setEditingUnit(null); fetchAllData(); } catch (error) {} }
  async function handleDeleteUnit(id) { if (!confirm('Excluir unidade?')) return; try { await api.units.remove(id); setSelectedUnitId(''); fetchAllData(); } catch (error) { alert('Existem vínculos ativos.'); } }
  async function handleAddRole(e) { e.preventDefault(); if (!newRole) return; try { await api.jobRoles.create({ name: newRole.toUpperCase() }); setNewRole(''); fetchAllData(); } catch (error) {} }
  async function handleUpdateRole() { if (!editingRole.name) return; try { await api.jobRoles.update(editingRole.id, { name: editingRole.name.toUpperCase() }); setEditingRole(null); fetchAllData(); } catch (error) {} }
  async function handleDeleteRole(id) { if (!confirm('Excluir função?')) return; try { await api.jobRoles.remove(id); setSelectedRoleId(''); fetchAllData(); } catch (error) { alert('Existem vínculos ativos.'); } }
  async function handleAddReason(e) { e.preventDefault(); if (!newReason) return; try { await api.cancellationReasons.create({ name: newReason.toUpperCase() }); setNewReason(''); fetchAllData(); } catch (error) {} }
  async function handleUpdateReason() { if (!editingReason.name) return; try { await api.cancellationReasons.update(editingReason.id, { name: editingReason.name.toUpperCase() }); setEditingReason(null); fetchAllData(); } catch (error) {} }
  async function handleDeleteReason(id) { if (!confirm('Excluir motivo?')) return; try { await api.cancellationReasons.remove(id); setSelectedReasonId(''); fetchAllData(); } catch (error) {} }
  async function handleApproveUser(id) { try { await api.users.update(id, { status: 'Aprovado' }); fetchAllData(); } catch (error) {} }
  async function handleDeleteUser(id) { if (!confirm('Deseja bloquear este usuário?')) return; try { await api.users.remove(id); fetchAllData(); } catch (error) {} }
  function handleSaveTargets(e) { e.preventDefault(); localStorage.setItem('portal_rh_targets', JSON.stringify(dashTargets)); alert('Metas atualizadas!'); }

  if (loading) return <p style={{ padding: '2rem' }}>Validando credenciais de Administrador...</p>;
  if (isAdmin === false) return (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><ShieldAlert size={64} color="var(--danger-color)" /><h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Acesso Restrito</h2></div>);

  const currentUnitObj = units.find(u => u.id === selectedUnitId);
  const currentRoleObj = roles.find(r => r.id === selectedRoleId);
  const currentReasonObj = cancellationReasons.find(r => r.id === selectedReasonId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingBottom: '3rem' }}>
      <div><h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Painel de Governança Integrada</h1></div>

      {/* BLOCO 1: GESTÃO AVANÇADA DE PERFIS (RBAC) */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={20} color="var(--saritur-orange)" /> Matriz de Permissões e Perfis (Tipos de Usuários)
          </h2>
          <button onClick={() => { 
            setEditingCustomRole(null); 
            setRoleForm({ name: '', permissions: {} }); 
            setIsRoleModalOpen(true); 
          }} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            <Plus size={16} /> Criar Novo Perfil
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {customRoles.map(role => (
            <div key={role.id} style={{ backgroundColor: 'var(--bg-color)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>{role.name}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {Object.keys(role.permissions || {}).length} Módulo(s) autorizado(s).
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => { setEditingCustomRole(role); setRoleForm({ name: role.name, permissions: role.permissions || {} }); setIsRoleModalOpen(true); }} className="btn-secondary" style={{ padding: '0.4rem' }}><Edit2 size={14}/></button>
                {role.name !== 'ADMIN' && (
                  <button onClick={() => handleDeleteCustomRole(role.id)} className="btn-secondary" style={{ padding: '0.4rem', color: 'var(--danger-color)' }}><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BLOCO 2: GESTÃO DE USUÁRIOS E MULTI-UNIDADES */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={20} color="var(--saritur-orange)" /> Gestão de Acessos de Colaboradores</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem' }}>Colaborador</th>
                <th style={{ padding: '0.75rem' }}>Status</th>
                <th style={{ padding: '0.75rem' }}>Perfil (Tipo)</th>
                <th style={{ padding: '0.75rem' }}>Unidades Vinculadas</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{user.name || 'Sem nome'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</div>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {user.status === 'Pendente' ? <span style={{ backgroundColor: 'var(--saritur-yellow)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Pendente</span> : <span style={{ backgroundColor: 'var(--success-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Aprovado</span>}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{user.role || 'Sem Perfil'}</span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {(user.unit_ids && user.unit_ids.length > 0) ? `${user.unit_ids.length} Unidade(s)` : (user.unit_id ? '1 Unidade (Legado)' : 'Acesso Geral (Todas)')}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button onClick={() => openUserAccessModal(user)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', borderColor: 'var(--saritur-orange)', color: 'var(--saritur-orange)' }}>
                      <UserCog size={14} style={{ marginRight: '4px' }}/> Configurar
                    </button>
                    {user.status === 'Pendente' && <button onClick={() => handleApproveUser(user.id)} className="btn-secondary" style={{ color: 'var(--success-color)', padding: '0.3rem' }} title="Aprovar Usuário"><Check size={14} /></button>}
                    <button onClick={() => handleDeleteUser(user.id)} className="btn-secondary" style={{ color: 'var(--danger-color)', padding: '0.3rem' }} title="Bloquear / Excluir"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOCO 3: CONSTRUTOR DE DASHBOARD AVANÇADO */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><PieChart size={20} color="var(--saritur-orange)" /> Construtor de Dashboard (Avançado)</h2>
          <button onClick={() => { 
            setEditingWidget(null); 
            setWidgetForm({ title: '', chart_type: 'kpi', metric_type: 'count', status_filter: 'Todos', color: '#F37137', roles_visible: customRoles.map(r=>r.name), advanced_config: { format: 'integer', size: 'half', groupBy: 'all', funnelColors: defaultFunnelColors }, visibility_type: 'generic' }); 
            setIsWidgetModalOpen(true); 
          }} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}><Plus size={16} /> Novo Indicador</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {widgets.map(w => (
            <div key={w.id} style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: `4px solid ${w.color}`, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-main)' }}>{w.title}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.chart_type.toUpperCase()} | {w.metric_type}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => { 
                    setEditingWidget(w); 
                    const safeConfig = w.advanced_config || { format: 'integer', size: 'half', groupBy: 'all', funnelColors: defaultFunnelColors };
                    setWidgetForm({...w, advanced_config: safeConfig, visibility_type: w.roles_visible?.length > 4 ? 'generic' : 'internal'}); 
                    setIsWidgetModalOpen(true); 
                  }}><Edit2 size={14} color="var(--text-muted)"/></button>
                  <button onClick={() => handleDeleteWidget(w.id)}><Trash2 size={14} color="var(--danger-color)"/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BLOCO 4: DROPDOWNS */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Settings2 size={20} color="var(--saritur-orange)" /> Tabelas Estruturais</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
          <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Unidades</label>
            <select style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }} value={selectedUnitId} onChange={e => { setSelectedUnitId(e.target.value); setEditingUnit(null); }}><option value="">-- Selecione --</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            {selectedUnitId && currentUnitObj && (<div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>{editingUnit ? <input style={{width: '70%', padding: '0.2rem'}} value={editingUnit.name} onChange={e => setEditingUnit({...editingUnit, name: e.target.value})} /> : <strong style={{ fontSize: '0.85rem' }}>{currentUnitObj.name}</strong>}<div style={{ display: 'flex', gap: '0.5rem' }}>{editingUnit ? (<><button onClick={handleUpdateUnit} style={{ color: 'var(--success-color)' }}><Check size={16} /></button><button onClick={() => setEditingUnit(null)}><X size={16} /></button></>) : (<><button onClick={() => setEditingUnit(currentUnitObj)}><Edit2 size={14} /></button><button onClick={() => handleDeleteUnit(selectedUnitId)} style={{ color: 'var(--danger-color)' }}><Trash2 size={14} /></button></>)}</div></div>)}
            <form onSubmit={handleAddUnit} style={{ display: 'flex', gap: '0.5rem' }}><input type="text" placeholder="Nova Unidade..." style={{ flex: 1, padding: '0.5rem' }} value={newUnit} onChange={e => setNewUnit(e.target.value)} /><button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button></form>
          </div>
          <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Funções</label>
            <select style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }} value={selectedRoleId} onChange={e => { setSelectedRoleId(e.target.value); setEditingRole(null); }}><option value="">-- Selecione --</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            {selectedRoleId && currentRoleObj && (<div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>{editingRole ? <input style={{width: '70%', padding: '0.2rem'}} value={editingRole.name} onChange={e => setEditingRole({...editingRole, name: e.target.value})} /> : <strong style={{ fontSize: '0.85rem' }}>{currentRoleObj.name}</strong>}<div style={{ display: 'flex', gap: '0.5rem' }}>{editingRole ? (<><button onClick={handleUpdateRole} style={{ color: 'var(--success-color)' }}><Check size={16} /></button><button onClick={() => setEditingRole(null)}><X size={16} /></button></>) : (<><button onClick={() => setEditingRole(currentRoleObj)}><Edit2 size={14} /></button><button onClick={() => handleDeleteRole(selectedRoleId)} style={{ color: 'var(--danger-color)' }}><Trash2 size={14} /></button></>)}</div></div>)}
            <form onSubmit={handleAddRole} style={{ display: 'flex', gap: '0.5rem' }}><input type="text" placeholder="Nova Função..." style={{ flex: 1, padding: '0.5rem' }} value={newRole} onChange={e => setNewRole(e.target.value)} /><button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button></form>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Cancelamentos</label>
            <select style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }} value={selectedReasonId} onChange={e => { setSelectedReasonId(e.target.value); setEditingReason(null); }}><option value="">-- Selecione --</option>{cancellationReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            {selectedReasonId && currentReasonObj && (<div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>{editingReason ? <input style={{width: '70%', padding: '0.2rem'}} value={editingReason.name} onChange={e => setEditingReason({...editingReason, name: e.target.value})} /> : <strong style={{ fontSize: '0.85rem' }}>{currentReasonObj.name}</strong>}<div style={{ display: 'flex', gap: '0.5rem' }}>{editingReason ? (<><button onClick={handleUpdateReason} style={{ color: 'var(--success-color)' }}><Check size={16} /></button><button onClick={() => setEditingReason(null)}><X size={16} /></button></>) : (<><button onClick={() => setEditingReason(currentReasonObj)}><Edit2 size={14} /></button><button onClick={() => handleDeleteReason(selectedReasonId)} style={{ color: 'var(--danger-color)' }}><Trash2 size={14} /></button></>)}</div></div>)}
            <form onSubmit={handleAddReason} style={{ display: 'flex', gap: '0.5rem' }}><input type="text" placeholder="Novo Motivo..." style={{ flex: 1, padding: '0.5rem' }} value={newReason} onChange={e => setNewReason(e.target.value)} /><button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button></form>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquareText size={20} color="var(--saritur-orange)" /> Modelos de WhatsApp</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {templates.map(template => (
            <div key={template.id} style={{ padding: '1.25rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{template.title}</strong>
                {editingTemplateId === template.id ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => handleSaveTemplate(template.id)} className="btn-secondary" style={{ color: 'var(--success-color)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><Check size={14} /> Salvar</button>
                    <button onClick={() => setEditingTemplateId(null)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><X size={14} /> Cancelar</button>
                  </div>
                ) : ( <button onClick={() => startEditingTemplate(template)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><Edit2 size={12} /> Editar</button> )}
              </div>
              {editingTemplateId === template.id ? (<textarea style={{ width: '100%', minHeight: '80px', padding: '0.75rem' }} value={editingTemplateContent} onChange={e => setEditingTemplateContent(e.target.value)} />) : (<p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>"{template.content}"</p>)}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart3 size={20} color="var(--saritur-orange)" /> Metas Globais do Dashboard</h2>
        <form onSubmit={handleSaveTargets} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1.5rem', alignItems: 'end' }}>
          <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Meta Leadtime (Dias)</label><input type="number" style={{padding: '0.5rem', width: '100%', borderRadius: '4px', border: '1px solid var(--border-color)'}} placeholder="Ex: 15" value={dashTargets.targetLeadtime} onChange={e => setDashTargets({...dashTargets, targetLeadtime: e.target.value})} /></div>
          <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Taxa de Aprovação (%)</label><input type="number" style={{padding: '0.5rem', width: '100%', borderRadius: '4px', border: '1px solid var(--border-color)'}} placeholder="Ex: 60" value={dashTargets.targetApprovalRate} onChange={e => setDashTargets({...dashTargets, targetApprovalRate: e.target.value})} /></div>
          <button type="submit" className="btn-primary" style={{ padding: '0.65rem 1.5rem' }}><Save size={16} /> Salvar Metas</button>
        </form>
      </div>

      {/* --- MODAL DO CONSTRUTOR DE PERFIS (RBAC) --- */}
      {isRoleModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold' }}>{editingCustomRole ? 'Editar Perfil de Acesso' : 'Criar Novo Perfil'}</h2>
              <button onClick={() => setIsRoleModalOpen(false)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <form onSubmit={handleSaveCustomRole} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.5rem' }}>Nome do Perfil (Ex: AUDITOR, ASSISTENTE DP)</label>
                <input required type="text" style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }} value={roleForm.name} onChange={e => setRoleForm({...roleForm, name: e.target.value.toUpperCase()})} disabled={editingCustomRole?.name === 'ADMIN'} />
                {editingCustomRole?.name === 'ADMIN' && <p style={{ fontSize: '0.75rem', color: 'var(--danger-color)', marginTop: '4px' }}>O nome do perfil de Administrador raiz não pode ser alterado.</p>}
              </div>

              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShieldAlert size={18} color="var(--saritur-orange)"/> Matriz de Permissões Detalhada</h3>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Módulo / Tela do Sistema</th>
                        <th style={{ padding: '0.75rem', color: 'var(--text-main)' }}>👁️ Visualizar</th>
                        <th style={{ padding: '0.75rem', color: 'var(--success-color)' }}>➕ Criar / Incluir</th>
                        <th style={{ padding: '0.75rem', color: 'var(--saritur-orange)' }}>✏️ Editar</th>
                        <th style={{ padding: '0.75rem', color: 'var(--danger-color)' }}>🗑️ Excluir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menusAcessiveis.map(menu => {
                        const p = roleForm.permissions[menu.path] || { view: false, create: false, edit: false, delete: false };
                        return (
                          <tr key={menu.path} style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                            <td style={{ padding: '0.75rem', fontWeight: '600', textAlign: 'left', backgroundColor: 'var(--bg-color)' }}>{menu.label}</td>
                            <td style={{ padding: '0.75rem' }}><input type="checkbox" checked={p.view} onChange={() => handleToggleModulePermission(menu.path, 'view')} style={{ width: '18px', height: '18px', accentColor: 'var(--text-main)', cursor: 'pointer' }} /></td>
                            <td style={{ padding: '0.75rem' }}><input type="checkbox" checked={p.create} onChange={() => handleToggleModulePermission(menu.path, 'create')} style={{ width: '18px', height: '18px', accentColor: 'var(--success-color)', cursor: 'pointer' }} /></td>
                            <td style={{ padding: '0.75rem' }}><input type="checkbox" checked={p.edit} onChange={() => handleToggleModulePermission(menu.path, 'edit')} style={{ width: '18px', height: '18px', accentColor: 'var(--saritur-orange)', cursor: 'pointer' }} /></td>
                            <td style={{ padding: '0.75rem' }}><input type="checkbox" checked={p.delete} onChange={() => handleToggleModulePermission(menu.path, 'delete')} style={{ width: '18px', height: '18px', accentColor: 'var(--danger-color)', cursor: 'pointer' }} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>* O sistema habilita "Visualizar" automaticamente caso você marque criar, editar ou excluir.</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsRoleModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary"><Save size={16} style={{marginRight: '6px'}}/> Salvar Estrutura de Perfil</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE CONFIGURAÇÃO DE USUÁRIO (MÚLTIPLAS UNIDADES) --- */}
      {isUserAcessModalOpen && editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '550px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Configurar Acessos: {editingUser.name?.split(' ')[0]}</h2>
              <button onClick={() => setIsUserAcessModalOpen(false)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <form onSubmit={handleSaveUserAccess} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.5rem' }}>Perfil Base (Tipo de Usuário)</label>
                <select required style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px', fontWeight: 'bold' }} value={editingUser.role || ''} onChange={e => setEditingUser({...editingUser, role: e.target.value})}>
                  <option value="">-- Selecione o Perfil --</option>
                  {customRoles.map(role => <option key={role.id} value={role.name}>{role.name}</option>)}
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Isso define o que a pessoa pode Ver, Criar ou Excluir em cada tela.</p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.5rem' }}>Restrição por Unidades (Múltipla Escolha)</label>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Selecione quais unidades este usuário pode enxergar. Se nenhuma for marcada, ele terá acesso global.</p>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', backgroundColor: 'var(--bg-color)' }}>
                  {units.map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', padding: '0.2rem 0' }}>
                      <input 
                        type="checkbox" 
                        checked={(editingUser.unit_ids || []).includes(u.id)} 
                        onChange={() => toggleUserUnit(u.id)} 
                        style={{ width: '18px', height: '18px', accentColor: 'var(--saritur-orange)', cursor: 'pointer' }} 
                      /> 
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsUserAcessModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar Permissões da Conta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL CONSTRUTOR DE WIDGETS (DASHBOARD) MANTIDO INTACTO --- */}
      {isWidgetModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Construtor de Indicador</h2>
              <button onClick={() => setIsWidgetModalOpen(false)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <form onSubmit={handleSaveWidget} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Título do Indicador</label>
                <input required type="text" style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="Ex: Lead Time de Admissão (SLA)" value={widgetForm.title} onChange={e => setWidgetForm({...widgetForm, title: e.target.value})} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Visualização do Gráfico</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.chart_type} onChange={e => setWidgetForm({...widgetForm, chart_type: e.target.value})}>
                    <option value="kpi">Cartão KPI (Número Solto)</option>
                    <option value="bar">Gráfico de Colunas (Vertical)</option>
                    <option value="bar_horizontal">Gráfico de Barras (Horizontal)</option>
                    <option value="line">Gráfico de Linha (Tendência)</option>
                    <option value="area">Gráfico de Área</option>
                    <option value="pie">Gráfico de Pizza (Proporção)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Tamanho na Tela</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.advanced_config?.size || 'half'} onChange={e => setWidgetForm({...widgetForm, advanced_config: { ...widgetForm.advanced_config, size: e.target.value }})}>
                    <option value="third">Pequeno (1/3 da tela)</option>
                    <option value="half">Médio (Metade da tela)</option>
                    <option value="full">Grande (Largura Total)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Agrupamento (Eixo X / Categorias)</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.advanced_config?.groupBy || 'all'} onChange={e => setWidgetForm({...widgetForm, advanced_config: { ...widgetForm.advanced_config, groupBy: e.target.value }})}>
                    <option value="all">Sem Agrupamento (Total Geral)</option>
                    <option value="month">Por Mês de Admissão/Conclusão</option>
                    <option value="unit">Por Unidade Operacional</option>
                    <option value="role">Por Função (Cargo)</option>
                    <option value="recruiter">Por Responsável/Recrutador</option>
                    <option value="reason">Por Motivo de Reprovação</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Cálculo da Métrica Inteligente</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.metric_type} onChange={e => setWidgetForm({...widgetForm, metric_type: e.target.value})}>
                    <option value="count">Contagem Simples (Qtd de Pessoas)</option>
                    <option value="smart_approval_rate">Índice de Aprovação na Entrevista (%)</option>
                    <option value="smart_stuck">Candidatos Parados a Mais de 2 Dias</option>
                    <option value="smart_funnel">Funil Completo de Recrutamento</option>
                    <option value="date_diff">Lead Time Avançado (Data A - Data B)</option>
                  </select>
                </div>
              </div>

              {/* PAINEL DE CORES DO FUNIL QUE SÓ APARECE SE FOR FUNIL */}
              {widgetForm.metric_type === 'smart_funnel' && (
                <div style={{ backgroundColor: 'rgba(243, 113, 55, 0.05)', border: '1px solid var(--saritur-orange)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--saritur-orange)', marginBottom: '0.75rem' }}>Personalizar Cores do Funil</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem' }}>1. Total</label>
                      <input type="color" value={widgetForm.advanced_config?.funnelColors?.[0] || defaultFunnelColors[0]} onChange={e => {
                        const newColors = [...(widgetForm.advanced_config?.funnelColors || defaultFunnelColors)];
                        newColors[0] = e.target.value;
                        setWidgetForm({...widgetForm, advanced_config: {...widgetForm.advanced_config, funnelColors: newColors}});
                      }} style={{ width: '100%', height: '30px', border: 'none', cursor: 'pointer' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem' }}>2. Entrevista</label>
                      <input type="color" value={widgetForm.advanced_config?.funnelColors?.[1] || defaultFunnelColors[1]} onChange={e => {
                        const newColors = [...(widgetForm.advanced_config?.funnelColors || defaultFunnelColors)];
                        newColors[1] = e.target.value;
                        setWidgetForm({...widgetForm, advanced_config: {...widgetForm.advanced_config, funnelColors: newColors}});
                      }} style={{ width: '100%', height: '30px', border: 'none', cursor: 'pointer' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem' }}>3. Pipeline</label>
                      <input type="color" value={widgetForm.advanced_config?.funnelColors?.[2] || defaultFunnelColors[2]} onChange={e => {
                        const newColors = [...(widgetForm.advanced_config?.funnelColors || defaultFunnelColors)];
                        newColors[2] = e.target.value;
                        setWidgetForm({...widgetForm, advanced_config: {...widgetForm.advanced_config, funnelColors: newColors}});
                      }} style={{ width: '100%', height: '30px', border: 'none', cursor: 'pointer' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem' }}>4. Admitidos</label>
                      <input type="color" value={widgetForm.advanced_config?.funnelColors?.[3] || defaultFunnelColors[3]} onChange={e => {
                        const newColors = [...(widgetForm.advanced_config?.funnelColors || defaultFunnelColors)];
                        newColors[3] = e.target.value;
                        setWidgetForm({...widgetForm, advanced_config: {...widgetForm.advanced_config, funnelColors: newColors}});
                      }} style={{ width: '100%', height: '30px', border: 'none', cursor: 'pointer' }} />
                    </div>
                  </div>
                </div>
              )}

              {widgetForm.metric_type === 'date_diff' && (
                <div style={{ backgroundColor: 'rgba(243, 113, 55, 0.05)', border: '1px solid var(--saritur-orange)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--saritur-orange)', marginBottom: '0.75rem' }}>Configuração do Lead Time</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'center' }}>
                    <select required style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={widgetForm.advanced_config?.dateEnd || ''} onChange={e => setWidgetForm({...widgetForm, advanced_config: {...widgetForm.advanced_config, dateEnd: e.target.value}})}>
                      <option value="">-- Campo Final --</option>
                      <option value="admission_date">Data de Admissão</option>
                      <option value="medical_result_date">Resultado Exame</option>
                    </select>
                    <span style={{ fontWeight: 'bold', fontSize: '1.5rem', color: 'var(--text-muted)' }}>-</span>
                    <select required style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={widgetForm.advanced_config?.dateStart || ''} onChange={e => setWidgetForm({...widgetForm, advanced_config: {...widgetForm.advanced_config, dateStart: e.target.value}})}>
                      <option value="">-- Campo Inicial --</option>
                      <option value="interview_date">Data da Entrevista</option>
                      <option value="created_at">Data de Criação</option>
                    </select>
                  </div>
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>Formato de Saída</label>
                    <select style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={widgetForm.advanced_config?.format || 'decimal'} onChange={e => setWidgetForm({...widgetForm, advanced_config: {...widgetForm.advanced_config, format: e.target.value}})}>
                      <option value="decimal">Decimal (ex: 5.5 dias)</option>
                      <option value="integer">Número Inteiro (ex: 6 dias)</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Filtro de Processo (O que incluir?)</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.status_filter} onChange={e => setWidgetForm({...widgetForm, status_filter: e.target.value})}>
                    <option value="Todos">Todo o Histórico</option>
                    <option value="Concluído">Somente Admitidos (Concluídos)</option>
                    <option value="Reprovado">Somente Reprovados</option>
                    <option value="Agendado">Somente Agendados (Entrevista)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Cor Primária</label>
                  <input type="color" style={{ width: '100%', height: '40px', padding: '0', border: 'none', cursor: 'pointer' }} value={widgetForm.color} onChange={e => setWidgetForm({...widgetForm, color: e.target.value})} />
                </div>
              </div>

              {/* CHAVE DE VISIBILIDADE SIMPLIFICADA */}
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-main)' }}>Visibilidade do Indicador</label>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="radio" name="visibility" checked={widgetForm.visibility_type === 'generic'} onChange={() => handleVisibilityChange('generic')} style={{ accentColor: 'var(--saritur-orange)', width: '18px', height: '18px' }} />
                    <strong>Genérico</strong> (Todos os Usuários)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="radio" name="visibility" checked={widgetForm.visibility_type === 'internal'} onChange={() => handleVisibilityChange('internal')} style={{ accentColor: 'var(--saritur-orange)', width: '18px', height: '18px' }} />
                    <strong>Interno</strong> (Apenas ADMIN e RH/DP)
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsWidgetModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar no Painel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
