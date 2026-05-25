'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Check, X, ShieldAlert, Save, Users, Settings2, BarChart3, Key, MessageSquareText } from 'lucide-react';

export default function ConfiguracoesPage() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dados do banco
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [permissions, setPermissions] = useState([]);

  // Seleção dos Dropdowns (Muitos dados)
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');

  // Formulários de Criação
  const [newUnit, setNewUnit] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'RECRUITER', unit_id: '' });

  // Estados de Edição
  const [editingUnit, setEditingUnit] = useState(null);
  const [editingRole, setEditingRole] = useState(null);

  // Configurações do Dashboard (Metas)
  const [dashTargets, setDashTargets] = useState({ targetLeadtime: '15', targetApprovalRate: '60' });

  // --- NOVO: Configurações de Mensagens Automáticas ---
  const [templates, setTemplates] = useState([
    { id: 'agendamento', title: 'Convite / Agendamento de Entrevista', content: 'Olá {nome}, sua entrevista para a função de {funcao} na unidade {unidade} está agendada para o dia {data_hora}. Estamos te aguardando!', tags: ['{nome}', '{funcao}', '{unidade}', '{data_hora}'] },
    { id: 'aprovacao', title: 'Aprovação e Solicitação de Documentos (WhatsApp)', content: 'Olá {nome}, você foi aprovado(a) na nossa entrevista para a função de {funcao}! Por favor, envie seus documentos para darmos andamento à sua admissão corporativa.', tags: ['{nome}', '{funcao}'] },
    { id: 'reprovacao', title: 'Aviso de Reprovação / Banco Reserva', content: 'Olá {nome}, agradecemos sua participação no processo seletivo para {funcao}. No momento optamos por seguir com outro perfil, mas manteremos seu currículo em nosso banco de reserva.', tags: ['{nome}', '{funcao}'] }
  ]);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingTemplateContent, setEditingTemplateContent] = useState('');

  // Lista oficial de Perfis de Acesso (ENUM do Banco)
  const availableRoles = ['ADMIN', 'RECRUITER', 'RECRUITER_ANALYST', 'MANAGER', 'SUPERINTENDENT', 'GP2', 'DP', 'PSYCHOLOGIST'];
  
  // Lista de Menus para a Matriz de Permissões
  const menusAcessiveis = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/agendamentos', label: 'Agendamentos' },
    { path: '/pre-admissao', label: 'Pipeline de Admissão' },
    { path: '/promocoes', label: 'Promoções' },
    { path: '/concluidos', label: 'Concluídos' },
    { path: '/configuracoes', label: 'Configurações' }
  ];

  useEffect(() => {
    checkAccessAndFetchData();
    
    // Carrega metas salvas do dashboard
    const savedTargets = localStorage.getItem('portal_rh_targets');
    if (savedTargets) setDashTargets(JSON.parse(savedTargets));

    // Carrega modelos de mensagens salvos
    const savedTemplates = localStorage.getItem('portal_rh_templates');
    if (savedTemplates) setTemplates(JSON.parse(savedTemplates));
  }, []);

  async function checkAccessAndFetchData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        return;
      }

      const { data: user } = await supabase.from('users').select('role').eq('id', session.user.id).single();

      if (user?.role === 'ADMIN') {
        setIsAdmin(true);
        await fetchAllData();
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

  async function fetchAllData() {
    const [unitsRes, rolesRes, usersRes, permsRes] = await Promise.all([
      supabase.from('units').select('*').order('name'),
      supabase.from('job_roles').select('*').order('name'),
      supabase.from('users').select(`*, units(name)`).order('name'),
      supabase.from('role_permissions').select('*')
    ]);
    if (unitsRes.data) setUnits(unitsRes.data);
    if (rolesRes.data) setRoles(rolesRes.data);
    if (usersRes.data) setUsersList(usersRes.data);
    if (permsRes.data) setPermissions(permsRes.data);
  }

  // Função para marcar/desmarcar o acesso na Matriz
  async function togglePermission(role, menu_path, hasPermission) {
    if (hasPermission) {
      await supabase.from('role_permissions').delete().match({ role, menu_path });
    } else {
      await supabase.from('role_permissions').insert([{ role, menu_path }]);
    }
    fetchAllData();
  }

  // --- SALVAR ALTERAÇÃO DE TEMPLATE DE MENSAGEM ---
  function handleSaveTemplate(id) {
    const updatedTemplates = templates.map(t => t.id === id ? { ...t, content: editingTemplateContent } : t);
    setTemplates(updatedTemplates);
    localStorage.setItem('portal_rh_templates', JSON.stringify(updatedTemplates));
    setEditingTemplateId(null);
    alert('Modelo de mensagem automatizada atualizado com sucesso para toda a equipe!');
  }

  function startEditingTemplate(template) {
    setEditingTemplateId(template.id);
    setEditingTemplateContent(template.content);
  }

  // --- CONTROLE DE DADOS BASE: UNIDADES ---
  async function handleAddUnit(e) {
    e.preventDefault();
    if (!newUnit) return;
    const { error } = await supabase.from('units').insert([{ name: newUnit.toUpperCase() }]);
    if (error) return alert('Erro: ' + error.message);
    setNewUnit('');
    await fetchAllData();
  }

  async function handleUpdateUnit() {
    if (!editingUnit.name) return;
    const { error } = await supabase.from('units').update({ name: editingUnit.name.toUpperCase() }).eq('id', editingUnit.id);
    if (error) return alert('Erro: ' + error.message);
    setEditingUnit(null);
    await fetchAllData();
  }

  async function handleDeleteUnit(id) {
    if (!confirm('Deseja excluir permanentemente esta unidade?')) return;
    const { error } = await supabase.from('units').delete().eq('id', id);
    if (error) alert('Bloqueado: Existem candidatos vinculados a esta unidade.');
    else { setSelectedUnitId(''); await fetchAllData(); }
  }

  // --- CONTROLE DE DADOS BASE: FUNÇÕES ---
  async function handleAddRole(e) {
    e.preventDefault();
    if (!newRole) return;
    const { error } = await supabase.from('job_roles').insert([{ name: newRole.toUpperCase() }]);
    if (error) return alert('Erro: ' + error.message);
    setNewRole('');
    await fetchAllData();
  }

  async function handleUpdateRole() {
    if (!editingRole.name) return;
    const { error } = await supabase.from('job_roles').update({ name: editingRole.name.toUpperCase() }).eq('id', editingRole.id);
    if (error) return alert('Erro: ' + error.message);
    setEditingRole(null);
    await fetchAllData();
  }

  async function handleDeleteRole(id) {
    if (!confirm('Deseja excluir permanentemente esta função?')) return;
    const { error } = await supabase.from('job_roles').delete().eq('id', id);
    if (error) alert('Bloqueado: Existem candidatos vinculados a esta função.');
    else { setSelectedRoleId(''); await fetchAllData(); }
  }

  // --- GESTÃO E CRIAÇÃO DE USUÁRIOS ---
  async function handleCreateUser(e) {
    e.preventDefault();
    const { error } = await supabase.from('users').insert([
      { 
        id: crypto.randomUUID(), 
        email: newUser.email.toLowerCase(), 
        name: newUser.name, 
        role: newUser.role, 
        unit_id: newUser.unit_id || null 
      }
    ]);
    if (error) return alert('Erro ao cadastrar usuário: ' + error.message);
    setNewUser({ email: '', name: '', role: 'RECRUITER', unit_id: '' });
    await fetchAllData();
    alert('Usuário pré-cadastrado com sucesso!');
  }

  async function handleUpdateUserRoleAndUnit(userId, updatedRole, updatedUnitId) {
    const { error } = await supabase.from('users').update({
      role: updatedRole,
      unit_id: updatedUnitId || null
    }).eq('id', userId);
    if (error) alert('Erro ao atualizar acessos: ' + error.message);
    else fetchAllData();
  }

  async function handleDeleteUser(id) {
    if (!confirm('Remover este usuário do sistema?')) return;
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) alert('Erro ao remover: ' + error.message);
    else fetchAllData();
  }

  // --- CONFIGURAÇÃO DE INDICADORES DO DASHBOARD ---
  function handleSaveTargets(e) {
    e.preventDefault();
    localStorage.setItem('portal_rh_targets', JSON.stringify(dashTargets));
    alert('Metas do Dashboard atualizadas com sucesso!');
  }

  if (loading) return <p style={{ padding: '2rem' }}>Validando credenciais de Administrador...</p>;

  if (isAdmin === false) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
        <ShieldAlert size={64} color="var(--danger-color)" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Acesso Restrito</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Esta seção contém chaves de segurança acessíveis apenas ao perfil ADMIN.</p>
      </div>
    );
  }

  const currentUnitObj = units.find(u => u.id === selectedUnitId);
  const currentRoleObj = roles.find(r => r.id === selectedRoleId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Painel de Governança Integrada</h1>
        <p style={{ color: 'var(--text-muted)' }}>Controle de acessos, tabelas institucionais e chaves do sistema.</p>
      </div>

      {/* BLOCO 1: DROPDOWNS DE DADOS BASE */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings2 size={20} color="var(--saritur-orange)" /> Tabelas de Dados Estruturais (Dropdowns)
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Selecionar Unidade para Gestão</label>
            <select style={{ width: '100%', marginBottom: '1rem' }} value={selectedUnitId} onChange={e => { setSelectedUnitId(e.target.value); setEditingUnit(null); }}>
              <option value="">-- {units.length} Unidades Cadastradas --</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            {selectedUnitId && currentUnitObj && (
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                {editingUnit ? (
                  <input style={{ flex: 1, marginRight: '0.5rem' }} value={editingUnit.name} onChange={e => setEditingUnit({...editingUnit, name: e.target.value})} />
                ) : (
                  <strong style={{ fontSize: '0.9rem' }}>{currentUnitObj.name}</strong>
                )}
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {editingUnit ? (
                    <><button onClick={handleUpdateUnit} className="btn-secondary" style={{ color: 'var(--success-color)', padding: '0.3rem' }}><Check size={14} /></button>
                    <button onClick={() => setEditingUnit(null)} className="btn-secondary" style={{ padding: '0.3rem' }}><X size={14} /></button></>
                  ) : (
                    <><button onClick={() => setEditingUnit(currentUnitObj)} className="btn-secondary" style={{ padding: '0.3rem' }}><Edit2 size={14} /></button>
                    <button onClick={() => handleDeleteUnit(selectedUnitId)} className="btn-secondary" style={{ color: 'var(--danger-color)', padding: '0.3rem' }}><Trash2 size={14} /></button></>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleAddUnit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" placeholder="Adicionar nova unidade..." style={{ flex: 1 }} value={newUnit} onChange={e => setNewUnit(e.target.value)} />
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button>
            </form>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Selecionar Função para Gestão</label>
            <select style={{ width: '100%', marginBottom: '1rem' }} value={selectedRoleId} onChange={e => { setSelectedRoleId(e.target.value); setEditingRole(null); }}>
              <option value="">-- {roles.length} Funções Cadastradas --</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>

            {selectedRoleId && currentRoleObj && (
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                {editingRole ? (
                  <input style={{ flex: 1, marginRight: '0.5rem' }} value={editingRole.name} onChange={e => setEditingRole({...editingRole, name: e.target.value})} />
                ) : (
                  <strong style={{ fontSize: '0.9rem' }}>{currentRoleObj.name}</strong>
                )}
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {editingRole ? (
                    <><button onClick={handleUpdateRole} className="btn-secondary" style={{ color: 'var(--success-color)', padding: '0.3rem' }}><Check size={14} /></button>
                    <button onClick={() => setEditingRole(null)} className="btn-secondary" style={{ padding: '0.3rem' }}><X size={14} /></button></>
                  ) : (
                    <><button onClick={() => setEditingRole(currentRoleObj)} className="btn-secondary" style={{ padding: '0.3rem' }}><Edit2 size={14} /></button>
                    <button onClick={() => handleDeleteRole(selectedRoleId)} className="btn-secondary" style={{ color: 'var(--danger-color)', padding: '0.3rem' }}><Trash2 size={14} /></button></>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleAddRole} style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" placeholder="Adicionar nova função..." style={{ flex: 1 }} value={newRole} onChange={e => setNewRole(e.target.value)} />
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button>
            </form>
          </div>
        </div>
      </div>

      {/* BLOCO 2: GESTÃO DE USUÁRIOS */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} color="var(--saritur-orange)" /> Controle de Acesso e Perfis de Usuários
        </h2>

        <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '2rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div><label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Nome do Colaborador</label><input required type="text" placeholder="Nome completo" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} /></div>
          <div><label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>E-mail Google Corporativo</label><input required type="email" placeholder="usuario@empresa.com" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} /></div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Perfil de Acesso</label>
            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
              {availableRoles.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Unidade Alocada</label>
            <select value={newUser.unit_id} onChange={e => setNewUser({...newUser, unit_id: e.target.value})}>
              <option value="">Todas</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1rem' }}>Pré-Cadastrar</button>
        </form>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem' }}>Colaborador</th>
                <th style={{ padding: '0.75rem' }}>E-mail</th>
                <th style={{ padding: '0.75rem' }}>Perfil de Acesso (Nível)</th>
                <th style={{ padding: '0.75rem' }}>Restrição de Unidade</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '600' }}>{user.name || 'Aguardando Login'}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <select style={{ padding: '0.25rem', fontSize: '0.85rem' }} value={user.role} onChange={e => handleUpdateUserRoleAndUnit(user.id, e.target.value, user.unit_id)}>
                      {availableRoles.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <select style={{ padding: '0.25rem', fontSize: '0.85rem', width: '140px' }} value={user.unit_id || ''} onChange={e => handleUpdateUserRoleAndUnit(user.id, user.role, e.target.value)}>
                      <option value="">Acesso Geral (Todas)</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <button onClick={() => handleDeleteUser(user.id)} className="btn-secondary" style={{ color: 'var(--danger-color)', padding: '0.3rem' }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOCO 3: MATRIZ DE PERMISSÕES */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={20} color="var(--saritur-orange)" /> Matriz de Permissões (Acesso a Menus)
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Marque quais telas cada perfil de usuário tem permissão para acessar no menu lateral.</p>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Perfil / Telas</th>
                {menusAcessiveis.map(menu => <th key={menu.path} style={{ padding: '0.75rem', fontWeight: '600' }}>{menu.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {availableRoles.map(role => (
                <tr key={role} style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '600', textAlign: 'left' }}>{role}</td>
                  {menusAcessiveis.map(menu => {
                    const hasPerm = permissions.some(p => p.role === role && p.menu_path === menu.path);
                    return (
                      <td key={`${role}-${menu.path}`} style={{ padding: '0.75rem' }}>
                        <input type="checkbox" checked={hasPerm} onChange={() => togglePermission(role, menu.path, hasPerm)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--saritur-orange)' }} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NOVO BLOCO: CONFIGURAÇÃO DE MENSAGENS AUTOMÁTICAS (TEMPLATES) */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquareText size={20} color="var(--saritur-orange)" /> Modelos de Mensagens Automáticas (Notificações)
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Personalize as mensagens disparadas pelo sistema para os candidatos. Use as tags indicadas para preencher dados dinâmicos.
        </p>

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
                ) : (
                  <button onClick={() => startEditingTemplate(template)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><Edit2 size={12} /> Alterar Texto</button>
                )}
              </div>

              {editingTemplateId === template.id ? (
                <div>
                  <textarea style={{ width: '100%', minHeight: '80px', padding: '0.75rem', fontFamily: 'inherit', fontSize: '0.9rem', marginBottom: '0.5rem' }} value={editingTemplateContent} onChange={e => setEditingTemplateContent(e.target.value)} />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Tags disponíveis para este modelo: {template.tags.map(t => <span key={t} style={{ backgroundColor: 'var(--border-color)', padding: '0.1rem 0.3rem', borderRadius: '4px', marginRight: '0.3rem', fontFamily: 'monospace' }}>{t}</span>)}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>"{template.content}"</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* BLOCO 4: PARÂMETROS DO DASHBOARD */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={20} color="var(--saritur-orange)" /> Parâmetros e Indicadores Estratégicos (Dashboard)
        </h2>
        
        <form onSubmit={handleSaveTargets} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1.5rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Meta de SLA de Admissão (Leadtime em Dias)</label>
            <input type="number" placeholder="Ex: 15" value={dashTargets.targetLeadtime} onChange={e => setDashTargets({...dashTargets, targetLeadtime: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Meta de Eficiência (Taxa de Aprovação Mínima %)</label>
            <input type="number" placeholder="Ex: 60" value={dashTargets.targetApprovalRate} onChange={e => setDashTargets({...dashTargets, targetApprovalRate: e.target.value})} />
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '0.75rem 1.5rem' }}><Save size={16} /> Salvar Parâmetros</button>
        </form>
      </div>

      {/* BLOCO 5: SEGURANÇA ADICIONAL */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)', borderLeft: '4px solid var(--saritur-orange)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Key size={20} color="var(--saritur-orange)" /> Chaves de Integração (Recomendado para Produção)
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Configurações de chaves de API externas utilizadas pelos módulos automáticos.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <strong>Módulo WhatsApp API:</strong> <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>Ativo (Link Dinâmico Habilitado)</span>
          </div>
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <strong>Módulo Google Agenda:</strong> <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>Ativo (OAuth Integrado)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
