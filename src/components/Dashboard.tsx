import { useState, useEffect, useContext } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Users, 
  Package, 
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Lock
} from 'lucide-react';
import { AppContext } from '../App';
import { collection, query, getDocs, limit, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../services/db';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const data = [
  { day: 'Lun', sales: 4000 },
  { day: 'Mar', sales: 3000 },
  { day: 'Mer', sales: 2000 },
  { day: 'Jeu', sales: 2780 },
  { day: 'Ven', sales: 1890 },
  { day: 'Sam', sales: 2390 },
  { day: 'Dim', sales: 3490 },
];

function StatCard({ title, value, icon: Icon, trend, trendValue }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-gray-50 rounded-2xl">
          <Icon size={24} className="text-gray-900" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trendValue}%
            {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-bold tracking-tight text-gray-900">{value}</h3>
    </motion.div>
  );
}

export default function Dashboard() {
  const { userRole, hasPermission, userProfile } = useContext(AppContext);
  const isSuperAdmin = auth.currentUser?.email === 'anges.gildas@gmail.com' || auth.currentUser?.email === 'gildas@gmail.com';
  
  const [stats, setStats] = useState({
    totalSales: 0,
    orders: 0,
    products: 0,
    customers: 0,
    dailyProfit: 0,
    // Super Admin Stats
    totalStores: 0,
    activeStores: 0,
    suspendedStores: 0,
    totalUsers: 0
  });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>(data);

  useEffect(() => {
    let unsubStores: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;
    let unsubSales: (() => void) | undefined;

    function fetchSuperAdminData() {
      unsubStores = onSnapshot(collection(db, 'storeSettings'), (storesSnap) => {
        const storesList = storesSnap.docs.map(doc => doc.data());
        const total = storesList.length;
        const activeDef = storesList.filter(s => s.licenseStatus === 'active').length;
        const suspendedDef = storesList.filter(s => s.licenseStatus === 'suspended').length;

        setStats(prev => ({
          ...prev,
          totalStores: total,
          activeStores: activeDef,
          suspendedStores: suspendedDef
        }));

        // System alerts for expiring soon
        const expiryAlerts = storesList
          .filter(s => {
            if (!s.licenseExpiry) return false;
            const now = new Date();
            const exp = new Date(s.licenseExpiry);
            const diffTime = exp.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 30; // Expiring in next 30 days
          })
          .map(s => ({
            name: s.name || 'Boutique',
            alertType: 'expiry',
            expiryDate: s.licenseExpiry,
            unit: 'jours'
          }));
        
        setAlerts(expiryAlerts);
      }, (err) => {
        console.error("Super Admin real-time stores fetch issue:", err);
      });

      unsubUsers = onSnapshot(collection(db, 'users'), (usersSnap) => {
        setStats(prev => ({
          ...prev,
          totalUsers: usersSnap.size
        }));
      }, (err) => {
        console.error("Super Admin real-time users fetch issue:", err);
      });

      // Realtime aggregate sales for chart
      const startOfWeek = new Date();
      startOfWeek.setDate(today.getDate() - 7);
      startOfWeek.setHours(0, 0, 0, 0);

      unsubSales = onSnapshot(query(
        collection(db, 'sales'),
        where('timestamp', '>=', startOfWeek)
      ), (salesSnap) => {
        const daySales: { [key: string]: number } = {};
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        
        for(let i=0; i<7; i++) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          daySales[days[d.getDay()]] = 0;
        }

        salesSnap.forEach(doc => {
          const data = doc.data();
          const date = data.timestamp?.toDate();
          if (date) {
            const dayName = days[date.getDay()];
            if (daySales[dayName] !== undefined) {
              daySales[dayName] += data.totalAmount || 0;
            }
          }
        });

        const formattedChartData = Object.entries(daySales)
          .map(([day, sales]) => ({ day, sales }))
          .reverse();
        
        setChartData(formattedChartData);
      }, (err) => {
        console.error("Super Admin real-time sales fetch issue:", err);
      });
    }

    const today = new Date();

    if (isSuperAdmin) {
      fetchSuperAdminData();
      return () => {
        if (unsubStores) unsubStores();
        if (unsubUsers) unsubUsers();
        if (unsubSales) unsubSales();
      };
    }

    if (!userProfile?.storeId) return;
    async function fetchDashboardData() {
      try {
        // Fetch real sales data for the chart
        const startOfWeek = new Date();
        startOfWeek.setDate(today.getDate() - 7);
        startOfWeek.setHours(0, 0, 0, 0);

        const salesSnap = await getDocs(query(
          collection(db, 'sales'),
          where('storeId', '==', userProfile.storeId),
          where('timestamp', '>=', startOfWeek)
        ));

        const daySales: { [key: string]: number } = {};
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        
        // Initialize days
        for(let i=0; i<7; i++) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          daySales[days[d.getDay()]] = 0;
        }

        let total = 0;
        salesSnap.forEach(doc => {
          const data = doc.data();
          const date = data.timestamp?.toDate();
          if (date) {
            const dayName = days[date.getDay()];
            if (daySales[dayName] !== undefined) {
              daySales[dayName] += data.totalAmount || 0;
            }
          }
          total += data.totalAmount || 0;
        });

        const formattedChartData = Object.entries(daySales)
          .map(([day, sales]) => ({ day, sales }))
          .reverse();
        
        setChartData(formattedChartData);
        setStats(prev => ({ 
          ...prev, 
          totalSales: total,
          orders: salesSnap.size
        }));

        // Rest of the fetch...
        try {
          const productsSnap = await getDocs(query(collection(db, 'products'), where('storeId', '==', userProfile.storeId)));
          const allProducts = productsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
          const stockAlerts = allProducts
            .filter((p: any) => (p.stock || 0) <= (p.lowStockThreshold || 5))
            .map((p: any) => ({ ...p, alertType: 'stock' }));
          setAlerts(stockAlerts.slice(0, 5));
          setStats(prev => ({ ...prev, products: productsSnap.size }));
        } catch(e) {}

        try {
          const clientsSnap = await getDocs(query(collection(db, 'clients'), where('storeId', '==', userProfile.storeId)));
          setStats(prev => ({ ...prev, customers: clientsSnap.size }));
        } catch (e) {}

      } catch (error) {
        console.error("Dashboard fetch error:", error);
      }
    }
    fetchDashboardData();
  }, [userProfile?.storeId]);

  const canViewReports = hasPermission('reports', 'read');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-gray-500 font-medium">Bon retour, voici un aperçu de votre activité.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isSuperAdmin ? (
          <>
            <StatCard 
              title="Total Boutiques" 
              value={stats.totalStores?.toLocaleString() || '0'} 
              icon={ShoppingBag} 
            />
            <StatCard 
              title="Boutiques Actives" 
              value={stats.activeStores?.toLocaleString() || '0'} 
              icon={TrendingUp} 
              trend="up" 
              trendValue={stats.totalStores > 0 ? ((stats.activeStores / stats.totalStores) * 100).toFixed(1) : '0'} 
            />
            <StatCard 
              title="Boutiques Suspendues" 
              value={stats.suspendedStores?.toLocaleString() || '0'} 
              icon={Lock} 
            />
            <StatCard 
              title="Utilisateurs Système" 
              value={stats.totalUsers?.toLocaleString() || '0'} 
              icon={Users} 
            />
          </>
        ) : (
          <>
            {canViewReports ? (
              <StatCard 
                title="Ventes Totales" 
                value={`${(stats.totalSales || 0).toLocaleString('de-DE')} FCFA`} 
                icon={TrendingUp} 
                trend="up" 
                trendValue="12.5" 
              />
            ) : (
              <div className="bg-gray-50 p-6 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center opacity-50">
                 <Lock size={20} className="text-gray-400 mb-2" />
                 <p className="text-[10px] font-black uppercase text-gray-400">Stats Privées</p>
              </div>
            )}
            <StatCard 
              title="Commandes" 
              value={stats.orders?.toLocaleString() || '0'} 
              icon={ShoppingBag} 
              trend={canViewReports ? "up" : undefined} 
              trendValue={canViewReports ? "8.2" : undefined} 
            />
            <StatCard 
              title="Produits" 
              value={stats.products?.toLocaleString() || '0'} 
              icon={Package} 
            />
            {canViewReports ? (
              <StatCard 
                title="Clients" 
                value={stats.customers?.toLocaleString() || '0'} 
                icon={Users} 
                trend="down" 
                trendValue="3.1" 
              />
            ) : (
              <div className="bg-gray-50 p-6 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center opacity-50">
                 <Lock size={20} className="text-gray-400 mb-2" />
                 <p className="text-[10px] font-black uppercase text-gray-400">Stats Privées</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
          {!isSuperAdmin && !canViewReports && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
               <div className="bg-white p-6 rounded-3xl shadow-xl flex flex-col items-center gap-2 border border-gray-100">
                  <Lock size={24} className="text-orange-500" />
                  <p className="text-sm font-black uppercase tracking-widest text-gray-900">Accès Reservé</p>
               </div>
            </div>
          )}
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-bold text-gray-900">Activité des Ventes</h3>
            <select className="bg-gray-50 border-none rounded-xl px-4 py-2 text-sm font-medium outline-none">
              <option>7 derniers jours</option>
              <option>30 derniers jours</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#6B7280' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#6B7280' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#111827', 
                    border: 'none', 
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#f97316" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col">
          <h3 className="text-xl font-bold text-gray-900 mb-6 font-mono uppercase tracking-tighter">Alertes Critiques</h3>
          <div className="flex-1 space-y-4">
            {alerts.length > 0 ? alerts.map((alert, i) => (
              <div key={`dashboard-alert-${i}-${alert.name}`} className={`flex items-center justify-between p-4 rounded-2xl border ${alert.alertType === 'expiry' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${alert.alertType === 'expiry' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                    <Package size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900 truncate max-w-[120px]">{alert.name}</h4>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${alert.alertType === 'expiry' ? 'text-red-500' : 'text-orange-500'}`}>
                      {alert.alertType === 'expiry' ? `Expire: ${new Date(alert.expiryDate).toLocaleDateString()}` : `Stock: ${alert.stock} ${alert.unit}`}
                    </p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4">
                   <TrendingUp size={32} />
                </div>
                <p className="text-sm font-bold text-gray-900">Tout est sous contrôle</p>
                <p className="text-xs text-gray-500">Aucune alerte pour le moment.</p>
              </div>
            )}
          </div>
          <button className="mt-8 w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-colors">
            Gérer l'inventaire
          </button>
        </div>
      </div>
    </div>
  );
}
