import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Settings as SettingsIcon, 
  LogOut, 
  User,
  ShoppingBag,
  History,
  Menu,
  X,
  Globe,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  Package as PackageIcon,
  Lock,
  Smartphone,
  Store,
  MessageSquare
} from 'lucide-react';
import { onSnapshot, collection, doc, getDoc, setDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Pos from './components/Pos';
import SalesHistory from './components/SalesHistory';
import Accounting from './components/Accounting';
import Personnel from './components/Personnel';
import Clients from './components/Clients';
import Settings from './components/Settings';
import SuperAdmin from './components/SuperAdmin';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import Register from './components/Register';
import MobileMoney from './components/MobileMoney';
import Chat from './components/Chat';
import { translations, Language } from './lib/translations';
import { UserRole, StoreSettings, Client, UserProfile } from './types';

// Simple Context for Global Settings
export type Theme = 'default' | 'light-blue' | 'black' | 'dark-blue' | 'white' | 'dark-gray';

export const AppContext = createContext({
  language: 'fr' as Language,
  setLanguage: (l: Language) => {},
  theme: 'default' as Theme,
  setTheme: (t: Theme) => {},
  searchQuery: '',
  setSearchQuery: (q: string) => {},
  userRole: 'admin' as UserRole,
  setUserRole: (r: UserRole) => {},
  settings: null as StoreSettings | null,
  userProfile: null as any | null,
  lowStockCount: 0,
  hasPermission: (module: string, action: 'read' | 'create' | 'update' | 'delete') => false,
  preselectedClient: null as Client | null,
  setPreselectedClient: (client: Client | null) => {},
  verifyAction: (onSuccess: () => void) => {},
});

function UserHeader({ isLicenseValid }: { isLicenseValid: boolean }) {
  const { language, searchQuery, setSearchQuery, userRole, lowStockCount, userProfile, settings } = useContext(AppContext);
  const t = translations[language];
  const user = auth.currentUser;
  const [time, setTime] = useState(new Date());
  const [familyStores, setFamilyStores] = useState<StoreSettings[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!userProfile?.storeId || !settings) {
      setFamilyStores([]);
      return;
    }

    const parentStoreId = settings.parentStoreId || settings.id;

    // Listen to real-time changes in all store settings in the system
    const q = query(collection(db, 'storeSettings'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const allStoresList = snap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as StoreSettings));
      
      const filtered = allStoresList.filter(s => 
        s.id === parentStoreId || (s as any).parentStoreId === parentStoreId
      );
      
      setFamilyStores(filtered);
    }, (error) => {
      console.warn("Error subscribing to family stores:", error);
    });

    return () => unsubscribe();
  }, [userProfile?.storeId, settings?.parentStoreId, settings?.id]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-24 bg-white/80 backdrop-blur-md z-30 px-6 lg:px-12 flex items-center justify-between border-b border-gray-100 print:hidden pl-20 lg:pl-12">
       <div className="flex-1 max-w-sm mr-8">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-6 py-3 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-orange-500/20 transition-all outline-none font-medium text-sm"
            />
          </div>
       </div>

       <div className="flex-1 hidden xl:flex items-center justify-center">
          {familyStores.length > 1 && (userRole === 'admin' || userProfile?.role === 'admin') ? (
            <div className="px-4 py-2 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3 group">
              <Store size={15} className="text-orange-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest leading-none">Boutique Active</span>
                <select
                  value={userProfile.storeId}
                  onChange={async (e) => {
                    const newStoreId = e.target.value;
                    if (newStoreId && user) {
                      try {
                        await updateDoc(doc(db, 'users', user.uid), { storeId: newStoreId });
                      } catch (err) {
                        console.error("Error switching store:", err);
                      }
                    }
                  }}
                  className="text-xs font-black text-slate-900 bg-transparent border-none outline-none cursor-pointer pr-1"
                >
                  {familyStores.map(s => (
                    <option key={`switch-store-header-${s.id}`} value={s.id}>
                      {s.name} {s.id === (settings?.parentStoreId || settings?.id) ? '(Principale)' : '(Sous-boutique)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : settings?.subdomain ? (
            <div className="px-4 py-2 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3 group">
              <Globe size={14} className="text-orange-500" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest leading-none">Votre Instance</span>
                <span className="text-xs font-black text-slate-900 lowercase tracking-tight">{settings.subdomain}</span>
              </div>
            </div>
          ) : null}
       </div>

       <div className="flex items-center gap-6">
          {lowStockCount > 0 && userRole !== 'cashier' && (
            <Link 
              to="/inventory" 
              className="relative p-2.5 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-colors group"
              title={`${lowStockCount} produits en stock critique`}
            >
              <Package size={20} className="group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                {lowStockCount}
              </span>
            </Link>
          )}
          {!isLicenseValid && userRole === 'admin' && (
            <Link 
              to="/settings" 
              className="hidden lg:flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl border border-red-100 animate-pulse group hover:bg-red-600 hover:text-white transition-all shadow-sm"
              title="Cliquer pour activer la licence"
            >
              <ShieldAlert size={14} className="group-hover:rotate-12 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Licence Inactive</span>
            </Link>
          )}
          <div className="text-right hidden md:block">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{formatDate(time)}</p>
             <p className="text-lg font-mono font-black text-gray-900 leading-none">{formatTime(time)}</p>
          </div>
          <div className="w-px h-10 bg-gray-100 hidden md:block" />
          <Link to="/settings?tab=profile" className="flex items-center gap-4 group hover:opacity-80 transition-opacity">
            <div className="text-right hidden sm:block">
               <p className="text-sm font-black text-gray-900">{userProfile?.displayName || user?.displayName}</p>
               <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest leading-none">Connecté</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-gray-100 border-2 border-white shadow-xl shadow-gray-200/50 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform cursor-pointer">
               {userProfile?.photoURL ? (
                 <img src={userProfile.photoURL} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" />
               ) : user?.photoURL ? (
                 <img src={user.photoURL} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" />
               ) : (
                 <User size={22} className="text-gray-400" />
               )}
            </div>
          </Link>
       </div>
    </header>
  );
}

function Sidebar() {
  const { language, userRole, settings, userProfile, hasPermission } = useContext(AppContext);
  const t = translations[language];
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
   const menuItems = [
    { icon: LayoutDashboard, label: t.dashboard, path: '/', id: 'dashboard', module: 'reports' },
    { icon: ShoppingCart, label: t.pos, path: '/pos', id: 'pos', module: 'pos' },
    { icon: Smartphone, label: t.mobile_money || 'Transactions Mobiles', path: '/mobile-money', id: 'mobile_money', module: 'pos' },
    { icon: Package, label: t.inventory, path: '/inventory', id: 'inventory', module: 'inventory' },
    { icon: History, label: t.history, path: '/history', id: 'history', module: 'pos' },
    { icon: BarChart3, label: t.accounting, path: '/accounting', id: 'accounting', module: 'accounting' },
    { icon: Users, label: t.customers, path: '/clients', id: 'clients', module: 'clients' },
    { icon: UserCheck, label: t.personnel, path: '/personnel', id: 'personnel', module: 'personnel' },
    { icon: MessageSquare, label: 'Messagerie', path: '/chat', id: 'chat', module: 'none' },
    { icon: SettingsIcon, label: t.settings, path: '/settings', id: 'settings', module: 'settings' },
  ];

  const privilegedAdmins = ['anges.gildas@gmail.com', 'gildas@gmail.com'];
  if (privilegedAdmins.includes(auth.currentUser?.email || '')) {
    menuItems.push({ icon: ShieldAlert, label: (t as any).super_admin || 'Super Admin', path: '/super-admin', id: 'super-admin', module: 'none' });
  }

  const filteredItems = menuItems.filter(item => {
    if (item.id === 'chat') return true;
    const isSuperAdmin = auth.currentUser?.email === 'anges.gildas@gmail.com' || auth.currentUser?.email === 'gildas@gmail.com';
    if (isSuperAdmin) {
      if (item.id === 'super-admin' || item.id === 'settings') return true;
      let keyToCheck = item.module || item.id;
      if (item.id === 'history') keyToCheck = 'sales';
      if (item.id === 'mobile_money') keyToCheck = 'pos';
      if (item.id === 'dashboard') keyToCheck = 'reports';
      return hasPermission(keyToCheck, 'read');
    }
    
    // Admin always has access
    if (userRole === 'admin') return true;
    
    // Check specific module permission
    return hasPermission(item.module || item.id, 'read');
  });;

  const handleLogout = () => signOut(auth);

  return (
    <>
      <button 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-xl border border-gray-100 text-gray-900 active:scale-90 transition-transform"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={`
        fixed inset-y-0 left-0 bg-[#151619] text-white w-72 lg:w-64 transform transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] z-40 flex flex-col shadow-2xl
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-8 shrink-0">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-orange-500 w-10 h-10 rounded-xl shadow-lg shadow-orange-500/20 overflow-hidden flex items-center justify-center">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ShoppingBag size={22} className="text-white" />
              )}
            </div>
            <span className="text-xl font-black tracking-tight">{t.app_name}</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          {filteredItems.map((item) => (
            <Link
              key={`nav-item-${item.id}`}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`
                flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200
                ${location.pathname === item.path && item.id !== 'profile' 
                  ? 'bg-white/10 text-orange-500 font-black' 
                  : item.id === 'profile' && location.pathname === '/settings'
                    ? 'text-gray-400 hover:text-white hover:bg-white/5'
                    : location.pathname === item.path
                      ? 'bg-white/10 text-orange-500 font-black'
                      : 'text-gray-500 hover:text-white hover:bg-white/5'}
              `}
            >
              <item.icon size={20} className={location.pathname === item.path ? 'text-orange-500' : ''} />
              <span className="text-sm tracking-wide">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 shrink-0">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-gray-500 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all font-black text-[9px] uppercase tracking-widest"
          >
            <LogOut size={14} />
            {t.logout}
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
        />
      )}
    </>
  );
}


const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
  >
    {children}
  </motion.div>
);

function AppRoutes({ 
  user, 
  userRole, 
  userProfile,
  isLicenseValid, 
  theme, 
  loading,
  settings,
  hasPermission
}: { 
  user: any; 
  userRole: UserRole; 
  userProfile: any;
  isLicenseValid: boolean; 
  theme: Theme;
  loading: boolean;
  settings: StoreSettings | null;
  hasPermission: (module: string, action: 'read' | 'create' | 'update' | 'delete') => boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [hasRedirected, setHasRedirected] = useState(false);

  // Redirect to dashboard on fresh login if on public/auth routes
  useEffect(() => {
    const isPublicRoute = location.pathname === '/login' || location.pathname === '/register';
    const isFullyLoggedIn = user && userProfile && userProfile.isActive !== false && !userProfile.pendingApproval;

    if (isFullyLoggedIn && isPublicRoute && !hasRedirected) {
      navigate('/', { replace: true });
      setHasRedirected(true);
    }
    if (!user) {
      setHasRedirected(false);
    }
  }, [user?.uid, userProfile, location.pathname, hasRedirected]);

  const hasAccess = (module: string) => {
    const isSuperAdmin = auth.currentUser?.email === 'anges.gildas@gmail.com' || auth.currentUser?.email === 'gildas@gmail.com';
    if (isSuperAdmin) {
      if (module === 'super-admin' || module === 'settings') return true;
      let keyToCheck = module;
      if (module === 'mobile_money') keyToCheck = 'pos';
      return hasPermission(keyToCheck, 'read');
    }
    
    // Block critical modules if license is invalid
    if (!isLicenseValid && ['pos', 'inventory', 'accounting', 'personnel', 'clients', 'mobile_money'].includes(module)) {
      return false;
    }

    if (userRole === 'admin') return true;
    return userProfile?.permissions?.[module]?.read === true;
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f2f2f2]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full shadow-lg"
        />
      </div>
    );
  }

  if (!user || (!userProfile && !loading)) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }

  if (userProfile?.pendingApproval || userProfile?.isActive === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-[56px] p-12 text-center shadow-2xl relative overflow-hidden">
          <div className="w-24 h-24 bg-orange-100 text-orange-600 rounded-[32px] flex items-center justify-center mx-auto mb-8">
            <ShieldCheck size={48} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-6 italic tracking-tight uppercase">Compte en attente</h2>
          <p className="text-slate-500 font-medium leading-relaxed mb-8">
            Votre boutique <span className="text-orange-500 font-black">"{settings?.name}"</span> est en cours d'activation.
          </p>
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 mb-8 text-left">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Instance attribuée</p>
            <p className="text-slate-900 font-black text-sm">{settings?.subdomain || 'En attente...'}</p>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="w-full py-5 bg-slate-900 text-white rounded-[28px] font-black uppercase tracking-widest text-[11px] hover:bg-black transition-all shadow-xl"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex selection:bg-orange-500 selection:text-white theme-${theme} ${theme === 'black' ? 'bg-black' : theme === 'dark-blue' ? 'bg-[#0a192f]' : theme === 'light-blue' ? 'bg-sky-50' : 'bg-[#f2f2f2]'}`}>
      <Sidebar />
      <div className="flex-1 lg:ml-64 flex flex-col">
        <UserHeader isLicenseValid={isLicenseValid} />
        <main className="flex-1 p-6 lg:p-12 pt-32 lg:pt-36">
          <AnimatePresence mode="wait">
            <Routes location={location}>
              <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
              <Route path="/pos" element={hasAccess('pos') ? <PageTransition><Pos /></PageTransition> : <Navigate to="/" />} />
              <Route path="/inventory" element={hasAccess('inventory') ? <PageTransition><Inventory /></PageTransition> : <Navigate to="/" />} />
              <Route path="/sales" element={hasAccess('sales') ? <PageTransition><SalesHistory /></PageTransition> : <Navigate to="/" />} />
              <Route path="/accounting" element={hasAccess('accounting') ? <PageTransition><Accounting /></PageTransition> : <Navigate to="/" />} />
              <Route path="/mobile-money" element={hasAccess('mobile_money') ? <PageTransition><MobileMoney /></PageTransition> : <Navigate to="/" />} />
              <Route path="/personnel" element={hasAccess('personnel') ? <PageTransition><Personnel /></PageTransition> : <Navigate to="/" />} />
              <Route path="/clients" element={hasAccess('clients') ? <PageTransition><Clients /></PageTransition> : <Navigate to="/" />} />
              <Route path="/settings" element={hasAccess('settings') ? <PageTransition><Settings /></PageTransition> : <Navigate to="/" />} />
              <Route path="/chat" element={<PageTransition><Chat /></PageTransition>} />
              <Route path="/super-admin" element={(auth.currentUser?.email === 'anges.gildas@gmail.com' || auth.currentUser?.email === 'gildas@gmail.com') ? <PageTransition><SuperAdmin /></PageTransition> : <Navigate to="/" />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// Helper to automatically detect subdirectory hosting based on the URL path
const getAutomaticBasename = (): string => {
  const hostname = window.location.hostname;
  if (
    hostname === 'localhost' || 
    hostname === '127.0.0.1' || 
    hostname.includes('ais-dev-') || 
    hostname.includes('ais-pre-') || 
    hostname.includes('run.app') ||
    hostname.includes('googleusercontent.com')
  ) {
    return '/';
  }

  const pathname = window.location.pathname;
  if (!pathname || pathname === '/' || pathname === '/index.html') return '/';
  
  // List of all known React Router path suffixes in this app
  const knownRoutes = [
    'login', 
    'register', 
    'pos', 
    'inventory', 
    'sales', 
    'accounting', 
    'mobile-money', 
    'personnel', 
    'clients', 
    'settings', 
    'super-admin'
  ];
  
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  
  // If the last segment is a known route, remove it to find the subdirectory base
  const lastSegment = segments[segments.length - 1];
  if (knownRoutes.includes(lastSegment)) {
    segments.pop();
  }
  
  if (segments.length === 0) return '/';
  return '/' + segments.join('/');
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('fr');
  const [theme, setTheme] = useState<Theme>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('cashier');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [preselectedClient, setPreselectedClient] = useState<Client | null>(null);
  const [verifyPasswordModal, setVerifyPasswordModal] = useState<{ open: boolean; onSuccess: (() => void) | null }>({ open: false, onSuccess: null });
  const [passwordInput, setPasswordInput] = useState('');
  const [inactiveModal, setInactiveModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const hasPermission = (module: string, action: 'read' | 'create' | 'update' | 'delete'): boolean => {
    const isSuperAdmin = auth.currentUser?.email === 'anges.gildas@gmail.com';
    if (isSuperAdmin) {
      if (module === 'settings' || module === 'super-admin' || module === 'none') return true;
      if (!userProfile?.permissions) return true; // Default to true as they are the administrator
      const perm = userProfile.permissions[module];
      if (perm !== undefined) {
        return perm[action] === true;
      }
      return true; // Default to true if not specified
    }

    if (userRole === 'admin') return true;
    if (!userProfile?.permissions) return false;
    return userProfile.permissions[module]?.[action] === true;
  };

  // Automatic Daily Cloud Backup
  useEffect(() => {
    if (!user || userRole !== 'admin') return;

    const performAutoBackup = async () => {
      if (!userProfile?.storeId) return;
      const today = new Date().toISOString().split('T')[0];
      const lastBackupDate = localStorage.getItem(`last-auto-backup-${userProfile.storeId}`);

      if (lastBackupDate === today) return;

      try {
        const collectionsToExport = ['products', 'categories', 'sales', 'expenses', 'employees', 'leaves', 'payroll'];
        const backupData: any = { date: today, timestamp: new Date().toISOString(), storeId: userProfile.storeId };

        for (const collName of collectionsToExport) {
          const q = query(collection(db, collName), where('storeId', '==', userProfile.storeId));
          const snap = await getDocs(q);
          const items: any[] = [];
          
          for (const d of snap.docs) {
            const data = d.data();
            const item: any = { id: d.id, ...data };
            
            // Handle subcollections for sales
            if (collName === 'sales') {
              const subItemsSnap = await getDocs(collection(db, `sales/${d.id}/items`));
              item.items = subItemsSnap.docs.map(si => ({ id: si.id, ...si.data() }));
            }
            
            items.push(item);
          }
          backupData[collName] = items;
        }

        // Include store settings in backup
        const settingsSnap = await getDoc(doc(db, 'storeSettings', userProfile.storeId));
        if (settingsSnap.exists()) {
          backupData.storeSettings = settingsSnap.data();
        }

        await setDoc(doc(db, 'backups', `${userProfile.storeId}_${today}`), backupData);
        localStorage.setItem(`last-auto-backup-${userProfile.storeId}`, today);
        console.log("Sauvegarde automatique effectuée avec succès.");
      } catch (err) {
        console.error("Erreur sauvegarde auto:", err);
      }
    };

    // Delay slightly to not interfere with initial load
    const timer = setTimeout(performAutoBackup, 10000);
    return () => clearTimeout(timer);
  }, [user, userRole]);

  useEffect(() => {
    if (!user || !userProfile?.storeId) return;
    const q = query(collection(db, 'products'), where('storeId', '==', userProfile.storeId));
    const unsubProducts = onSnapshot(q, (snap) => {
      const lowStock = snap.docs.filter(doc => {
        const data = doc.data();
        return data.stock <= (data.lowStockThreshold || 5);
      });
      setLowStockCount(lowStock.length);
    }, (error) => {
      console.error("Error watching products for low stock alert:", error);
    });
    return () => unsubProducts();
  }, [user, userProfile?.storeId]);

  useEffect(() => {
    if (!user || !userProfile?.storeId) {
      setSettings(null);
      return;
    }

    const unsubscribeSettings = onSnapshot(doc(db, 'storeSettings', userProfile.storeId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings(data);
        
        // Check license expiration
        if (data.licenseExpiry && data.licenseStatus === 'active') {
          const now = new Date();
          const expiry = typeof data.licenseExpiry === 'string' ? new Date(data.licenseExpiry) : data.licenseExpiry.toDate ? data.licenseExpiry.toDate() : new Date(data.licenseExpiry);
          if (now > expiry) {
            updateDoc(doc(db, 'storeSettings', userProfile.storeId), { licenseStatus: 'expired' }).catch(() => {});
          }
        }
      }
    }, (error) => {
      console.error("Error watching store settings:", error);
    });

    return () => unsubscribeSettings();
  }, [user, userProfile?.storeId]);

  const isLicenseValid = settings?.licenseStatus === 'active';

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('app-theme') as Theme;
    if (savedTheme) setTheme(savedTheme);

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // Domain Redirection Logic
    const fetchConfig = async () => {
      // Security: Never redirect if we are inside an iframe or on preview/development environments
      const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' ||
                          window.location.hostname.includes('ais-dev-') ||
                          window.location.hostname.includes('ais-pre-') ||
                          window.location.hostname.includes('run.app');
      
      if (window.self !== window.top || isLocalhost) return;

      try {
        const snap = await getDoc(doc(db, 'systemConfig', 'globals'));
        if (snap.exists()) {
          const config = snap.data();
          try {
            localStorage.setItem('cached_system_config_globals', JSON.stringify(config));
          } catch (_) {}

          if (config.isAutoRedirectEnabled && config.publicAccessUrl) {
            const targetUrl = config.publicAccessUrl;
            const isSuperAdminEmail = auth.currentUser?.email === 'anges.gildas@gmail.com' || auth.currentUser?.email === 'gildas@gmail.com';
            const isSuperAdminPath = window.location.pathname.includes('/super-admin');
            const isLoginPage = window.location.pathname.includes('/login') || window.location.pathname.includes('/auth');
            const isLocalhost = window.location.hostname === 'localhost' || 
                                window.location.hostname === '127.0.0.1' ||
                                window.location.hostname.includes('ais-dev-') ||
                                window.location.hostname.includes('ais-pre-') ||
                                window.location.hostname.includes('run.app');
            const hasNoRedirect = window.location.search.includes('no-redirect=1');
            
            try {
              const target = new URL(targetUrl);
              const current = new URL(window.location.href);
              
              // Only redirect if origins differ or we are not in the target subdirectory
              const originsDiffer = current.origin !== target.origin;
              const pathDiffers = !current.pathname.startsWith(target.pathname);
              
              if ((originsDiffer || pathDiffers) && !isSuperAdminPath && !isSuperAdminEmail && !isLocalhost && !isLoginPage && !hasNoRedirect) {
                console.log("Redirecting to custom domain:", targetUrl);
                window.location.replace(targetUrl);
              }
            } catch (urlErr) {
              console.warn("Invalid publicAccessUrl configuration");
            }
          }
        }
      } catch (e: any) {
        const isOffline = e instanceof Error && (e.message.includes('offline') || e.message.includes('client is offline'));
        if (isOffline) {
          console.warn("Using offline fallback for redirection config check.");
        } else {
          console.error("Error checking redirection config:", e);
        }

        try {
          const cached = localStorage.getItem('cached_system_config_globals');
          if (cached) {
            const config = JSON.parse(cached);
            if (config.isAutoRedirectEnabled && config.publicAccessUrl) {
              const targetUrl = config.publicAccessUrl;
              const isSuperAdminEmail = auth.currentUser?.email === 'anges.gildas@gmail.com' || auth.currentUser?.email === 'gildas@gmail.com';
              const isSuperAdminPath = window.location.pathname.includes('/super-admin');
              const isLoginPage = window.location.pathname.includes('/login') || window.location.pathname.includes('/auth');
              const isLocalhost = window.location.hostname === 'localhost' || 
                                  window.location.hostname === '127.0.0.1' ||
                                  window.location.hostname.includes('ais-dev-') ||
                                  window.location.hostname.includes('ais-pre-') ||
                                  window.location.hostname.includes('run.app');
              const hasNoRedirect = window.location.search.includes('no-redirect=1');
              
              try {
                const target = new URL(targetUrl);
                const current = new URL(window.location.href);
                
                const originsDiffer = current.origin !== target.origin;
                const pathDiffers = !current.pathname.startsWith(target.pathname);
                
                if ((originsDiffer || pathDiffers) && !isSuperAdminPath && !isSuperAdminEmail && !isLocalhost && !isLoginPage && !hasNoRedirect) {
                  console.log("Redirecting to custom domain (cached):", targetUrl);
                  window.location.replace(targetUrl);
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
    };
    fetchConfig();
  }, [user]);

  // Sync role from Firestore
  useEffect(() => {
    if (!user) return;

    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile(data);
        
        // Repair missing storeId
        if (!data.storeId) {
          await updateDoc(doc(db, 'users', user.uid), { storeId: user.uid });
        }
        
        if (data.isActive === false) {
          signOut(auth);
          setInactiveModal({
            isOpen: true,
            title: "VOTRE COMPTE EST EN COURS D'ACTIVATION",
            message: "POUR PLUS D'INFORMATIONS VEUILLER CONTACTER L'ADMINISTRATEUR PRINCIPALE AU +22891033004"
          });
          setLoading(false);
          return;
        }

        let currentRole = data.role as UserRole;

        // Auto-assign roles for specific users
        const adminEmails = ['anges.gildas@gmail.com', 'gildas@gmail.com'];
        if (adminEmails.includes(user.email || '') && currentRole !== 'admin') {
          await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
          currentRole = 'admin';
        }

        setUserRole(currentRole);
        setLoading(false);
      } else {
        // If profile doesn't exist, it's possible it was deleted during a reset or the user is new.
        // We set userProfile to null and let Login.tsx handle the re-creation/sync.
        setUserProfile(null);
        setLoading(false);
      }
    }, (error) => {
       console.error("Error fetching user profile:", error);
       setLoading(false);
    });

    return () => unsubscribeUser();
  }, [user]);

  // Inactivity Auto-Logout (15 minutes)
  useEffect(() => {
    if (!user) return;

    let timeout: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        signOut(auth);
        alert("Session expirée pour cause d'inactivité. Veuillez vous reconnecter.");
      }, 15 * 60 * 1000); // 15 minutes
    };

    const listeners = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    listeners.forEach(l => window.addEventListener(l, resetTimer));
    resetTimer();

    return () => {
      if (timeout) clearTimeout(timeout);
      listeners.forEach(l => window.removeEventListener(l, resetTimer));
    };
  }, [user]);

  const handleSetTheme = (t: Theme) => {
    setTheme(t);
    localStorage.setItem('app-theme', t);
  };

  const handleSetRole = (r: UserRole) => {
    setUserRole(r);
    localStorage.setItem('app-role', r);
  };
  
  const verifyAction = (onSuccess: () => void) => {
    if (!userProfile?.settingsPassword) {
      // If no password set, just show an alert or proceed? 
      // User requested "always ask password". If not set, they should set it.
      alert("Veuillez d'abord définir un mot de passe de sécurité dans les paramètres.");
      return;
    }
    setVerifyPasswordModal({ open: true, onSuccess });
  };
  
  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === userProfile?.settingsPassword) {
      if (verifyPasswordModal.onSuccess) verifyPasswordModal.onSuccess();
      setVerifyPasswordModal({ open: false, onSuccess: null });
      setPasswordInput('');
    } else {
      alert("Mot de passe incorrect.");
    }
  };



  return (
    <AppContext.Provider value={{ 
      language, setLanguage, 
      theme, setTheme: handleSetTheme,
      searchQuery,
      userRole, setUserRole: handleSetRole,
      settings,
      userProfile,
      lowStockCount,
      setSearchQuery: (q: string) => setSearchQuery(q),
      hasPermission,
      preselectedClient,
      setPreselectedClient,
      verifyAction
    }}>
      <Router basename={getAutomaticBasename()}>
        <AppRoutes 
          user={user} 
          userRole={userRole} 
          userProfile={userProfile}
          isLicenseValid={isLicenseValid} 
          theme={theme}
          loading={loading}
          settings={settings}
          hasPermission={hasPermission}
        />
      </Router>

      {/* Global Password Verification Modal */}
      <AnimatePresence>
        {verifyPasswordModal.open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl border border-gray-100"
            >
              <div className="p-8 pb-0 text-center">
                <div className="w-20 h-20 bg-orange-50 rounded-[30px] flex items-center justify-center text-orange-500 mx-auto mb-6 shadow-xl shadow-orange-500/10">
                  <ShieldAlert size={40} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase mb-2">Confirmation Requise</h3>
                <p className="text-gray-500 font-medium text-sm px-4">
                  Veuillez saisir votre mot de passe de sécurité pour confirmer cette suppression.
                </p>
              </div>

              <form onSubmit={handleVerify} className="p-8 space-y-6">
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={20} />
                  <input 
                    autoFocus
                    type="password"
                    placeholder="Mot de passe"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-14 pr-6 py-5 bg-gray-50 border-2 border-transparent rounded-[24px] focus:bg-white focus:border-orange-500/20 transition-all outline-none font-bold text-center tracking-[0.5em]"
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setVerifyPasswordModal({ open: false, onSuccess: null });
                      setPasswordInput('');
                    }}
                    className="flex-1 py-5 bg-gray-100 text-gray-900 rounded-[24px] font-black uppercase tracking-widest text-[11px] hover:bg-gray-200 transition-all active:scale-95"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-5 bg-orange-600 text-white rounded-[24px] font-black uppercase tracking-widest text-[11px] hover:bg-orange-700 transition-all shadow-xl shadow-orange-600/20 active:scale-95"
                  >
                    Confirmer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Beautiful Custom Inactive Modal */}
      <AnimatePresence>
        {inactiveModal.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl border border-gray-100 p-10 text-center font-sans"
            >
              <div className="w-20 h-20 bg-orange-50 rounded-[30px] flex items-center justify-center text-orange-500 mx-auto mb-6 shadow-xl shadow-orange-500/10">
                <ShieldAlert size={40} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight uppercase leading-snug mb-3">
                {inactiveModal.title}
              </h3>
              <p className="text-gray-500 font-bold text-xs leading-relaxed mb-8">
                {inactiveModal.message}
              </p>
              <button 
                type="button"
                onClick={() => {
                  signOut(auth);
                  setInactiveModal({ isOpen: false, title: "", message: "" });
                  const homeUrl = window.location.origin + getAutomaticBasename();
                  window.location.replace(homeUrl);
                }}
                className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest text-[11px] hover:bg-black transition-all shadow-xl active:scale-95"
              >
                OK
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppContext.Provider>
  );
}
