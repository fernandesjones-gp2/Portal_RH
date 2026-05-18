'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, UserCheck, CheckCircle, Settings, LogOut } from 'lucide-react';

export default function SistemaLayout({ children }) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { name: 'Agendamentos', icon: <Users size={20} />, path: '/agendamentos' },
    { name: 'Pipeline de Admissão', icon: <UserCheck size={20} />, path: '/pre-admissao' },
    { name: 'Promoções', icon: <UserCheck size={20} />, path: '/promocoes' },
    { name: 'Concluídos', icon: <CheckCircle size={20} />, path: '/concluidos' },
    { name: 'Configurações', icon: <Settings size={20} />, path: '/configuracoes' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}>
      {/* Sidebar */}
      <aside style={{ width: '250px', backgroundColor: 'var(--surface-color)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: '700', letterSpacing: '-0.02em' }}>Portal RH</h2>
          <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--border-color)', color: 'var(--text-muted)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>SIM</span>
        </div>
        
        <nav style={{ padding: '1rem', flex: 1 }}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <li key={item.path}>
                  <Link href={item.path} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                    backgroundColor: isActive ? 'var(--bg-color)' : 'transparent',
                    fontWeight: isActive ? '500' : '400',
                    fontSize: '0.9rem',
                    transition: 'all 0.1s ease'
                  }}>
                    {item.icon}
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-color)', padding: '0.5rem 1rem', fontWeight: '500' }}>
            <LogOut size={20} />
            Sair da Simulação
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <header style={{ backgroundColor: 'var(--surface-color)', padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: '600' }}>
            {menuItems.find(i => i.path === pathname)?.name || 'Sistema'}
          </h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--text-main)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>
              JF
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-main)' }}>Jones Fernandes</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Administrador</p>
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
