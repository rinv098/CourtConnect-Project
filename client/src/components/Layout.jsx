import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Calendar, ClipboardList, LayoutGrid, Bell, LogOut, Menu, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ProfileDialog from '@/components/ProfileDialog';
import { useNotifications } from '@/context/NotificationContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import logo from '@/assets/logo.png';

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(user);
  const { notifications, unreadCount, markAllRead } = useNotifications();

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth-change'));
    navigate('/login');
  }

  const navItems = [
    { label: 'Bookings', icon: Calendar, path: '/courts' },
    { label: 'My Reservations', icon: ClipboardList, path: '/my-reservations' },
    ...(user.role === 'admin'
      ? [{ label: 'Admin Dashboard', icon: LayoutGrid, path: '/admin' }]
      : []),
  ];

  function NavLinks({ onNavigate }) {
    return navItems.map((item) => {
      const isActive = location.pathname === item.path;
      const Icon = item.icon;
      return (
        <Link
          key={item.path}
          to={item.path}
          onClick={onNavigate}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            isActive
              ? 'bg-white/10 text-white font-medium'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Icon className="h-4 w-4" />
          {item.label}
        </Link>
      );
    });
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Mobile top header */}
      <div className="md:hidden bg-slate-900 text-white flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
                <img src={logo} alt="CourtConnect" className="w-9 h-9 rounded-lg object-cover" />
                  <span className="font-bold text-lg tracking-tight">CourtConnect</span>
              </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 text-white px-3 pb-3 space-y-1">
          <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 w-full"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col shrink-0">
        <div className="p-6 flex items-center gap-2">
           <img src={logo} alt="CourtConnect" className="w-9 h-9 rounded-lg object-cover" />
                  <span className="font-bold text-lg tracking-tight">CourtConnect</span>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          <NavLinks />
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-6 py-4 text-sm text-red-400 hover:text-red-300 border-t border-white/10"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex h-16 bg-white border-b items-center justify-end px-6 shrink-0">
          <div className="flex items-center gap-4">
            <DropdownMenu onOpenChange={(open) => open && markAllRead()}>
              <DropdownMenuTrigger className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {notifications.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">No notifications yet.</div>
                ) : (
                  notifications.map((n) => (
                    <DropdownMenuItem key={n.id} className="flex flex-col items-start whitespace-normal">
                      <p className="text-sm">{n.message}</p>
                      <p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleTimeString()}</p>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-2">
              <button onClick={() => setProfileOpen(true)} className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentUser.avatar_url} />
                  <AvatarFallback>{(currentUser.name || '?').charAt(0)}</AvatarFallback>
                </Avatar>
              </button>
              <div className="text-sm">
                <p className="font-medium leading-none">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{currentUser.role}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onUpdated={(updatedUser) => setCurrentUser(updatedUser)}
      />
    </div>
  );
}

export default Layout;