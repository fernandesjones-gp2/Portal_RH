'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LayoutDashboard, Users, UserCheck, CheckCircle, Settings, LogOut } from 'lucide-react';

export default function SistemaLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowedPaths, setAllowedPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Carregando...');
  const [userRole, setUserRole] = useState('');

  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { name: 'Agendamentos', icon: <Users size={20} />, path: '/agendamentos' },
    { name: 'Pipeline de Admissão', icon: <UserCheck size={20} />, path: '/pre-admissao' },
    { name: 'Promoções', icon: <UserCheck size={20} />, path: '/promocoes' },
    { name: 'Concluídos', icon: <CheckCircle size={20} />, path: '/concluidos' },
    { name: 'Configurações', icon: <Settings size={20} />, path: '/configuracoes' },
  ];

  useEffect(() => {
    async function loadPermissions() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/');
          return;
        }

        // Busca as informações do usuário logado
        let { data: user } = await supabase.from('users').select('name, role').eq('id', session.user.id).single();

        // SE O USUÁRIO NÃO EXISTIR NA TABELA, CADASTRA ELE AUTOMATICAMENTE COM OS DADOS DO GOOGLE
        if (!user) {
          const { data: newUser, error } = await supabase.from('users').insert([{
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.email,
            role: 'RECRUITER' // Dá o acesso mais baixo por padrão
          }]).select('name, role').single();
          
          if (!error) user = newUser;
        }

        if (user) {
          setUserName(user.name || session.user.email);
          setUserRole(user.role);

          const { data: perms } = await supabase.from('role_permissions').select('menu_path').eq('role', user.role);

          if (perms) {
            setAllowedPaths(perms.map(p => p.menu_path));
          }
        } else {
          setUserName(session.user.email);
          setUserRole('RECRUITER');
          setAllowedPaths(['/dashboard', '/agendamentos']);
        }
      } catch (error) {
        console.error('Erro ao carregar permissões:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPermissions();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/'); 
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: 'sans-serif' }}>
        <p style={{ fontWeight: '500' }}>Carregando ambiente seguro...</p>
      </div>
    );
  }

  const filteredMenuItems = menuItems.filter(item => allowedPaths.includes(item.path));

  const isAllowed = allowedPaths.includes(pathname);
  if (!isAllowed && allowedPaths.length > 0 && pathname !== '/') {
    router.push(allowedPaths[0]);
    return null;
  }

  const initials = userName ? userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'RH';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}>
      {/* Sidebar */}
      <aside style={{ width: '250px', backgroundColor: 'var(--surface-color)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: '700', letterSpacing: '-0.02em' }}>Portal RH</h2>
          <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--saritur-orange)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>
            {userRole}
          </span>
        </div>
        
        <nav style={{ padding: '1rem', flex: 1 }}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredMenuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <li key={item.path}>
                  <Link href={item.path} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', color: isActive ? 'var(--text-main)' : 'var(--text-muted)', backgroundColor: isActive ? 'var(--bg-color)' : 'transparent', fontWeight: isActive ? '500' : '400', fontSize: '0.9rem', transition: 'all 0.1s ease' }}>
                    {item.icon}
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.75rem', color: 'var(--danger-color)', padding: '0.75rem 1rem', fontWeight: '500', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', borderRadius: 'var(--radius-md)' }}>
            <LogOut size={20} />
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <header style={{ backgroundColor: 'var(--surface-color)', padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: '600' }}>
            {menuItems.find(i => i.path === pathname)?.name || 'Sistema'}
          </h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--saritur-orange)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>
              {initials}
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-main)' }}>{userName}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{userRole}</p>
            </div>
          </div>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
