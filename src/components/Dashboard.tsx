import { useState, useEffect, useContext } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Users, 
  Package, 
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Zap,
  Trophy,
  Target,
  Edit3,
  Clock,
  Sparkles,
  ShieldCheck,
  FileDown,
  Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
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
  
  const navigate = useNavigate();
  
  // Interactive Sales Goal per shop (persisted locally)
  const [salesGoal, setSalesGoal] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(`sales-goal-${userProfile?.storeId || 'common'}`);
      return stored ? parseInt(stored, 10) : 2500000;
    } catch (_) {
      return 2500000;
    }
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoalInput, setNewGoalInput] = useState(salesGoal.toString());

  const handleSaveGoal = () => {
    const num = parseInt(newGoalInput, 10);
    if (!isNaN(num) && num > 0) {
      setSalesGoal(num);
      try {
        localStorage.setItem(`sales-goal-${userProfile?.storeId || 'common'}`, num.toString());
      } catch (_) {}
      setIsEditingGoal(false);
    }
  };

  const handleExportDashboardPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900 / dark-blue
      doc.rect(0, 0, 210, 38, 'F');

      // Decorative orange separator
      doc.setFillColor(249, 115, 22); // orange-500
      doc.rect(0, 38, 210, 1.5, 'F');

      // Header Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text(userProfile?.storeName || "MARKET PRO", 14, 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(226, 232, 240); // slate-200
      doc.text("RAPPORT COMPTABLE ET D'ACTIVITÉ DU COMPTOIR", 14, 23);
      doc.text(`Propulsé par G-TECH LAB • Lomé, Togo`, 14, 27);

      // Metadata Info Box
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`GÉNÉRÉ LE : ${new Date().toLocaleDateString('fr-TG')} à ${new Date().toLocaleTimeString('fr-TG')}`, 196, 15, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text(`Rôle actif : ${userRole?.toUpperCase() || 'ADMINISTRATEUR'}`, 196, 20, { align: 'right' });
      doc.text(`Licence G-Tech Cloud : ACTIVE`, 196, 25, { align: 'right' });

      // Body Titles
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text("1. Indicateurs Réels de Performance (KPIs)", 14, 52);
      
      // Grid separator
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.5);
      doc.line(14, 55, 196, 55);

      // Grid helper cards
      const drawKpiCard = (x: number, y: number, w: number, h: number, title: string, val: string) => {
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(250, 251, 252);
        doc.roundedRect(x, y, w, h, 3, 3, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(title.toUpperCase(), x + 4, y + 6);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(val, x + 4, y + 13);
      };

      if (isSuperAdmin) {
        drawKpiCard(14, 59, 42, 17, "Total Boutiques", `${stats.totalStores || 0}`);
        drawKpiCard(60, 59, 42, 17, "Boutiques Actives", `${stats.activeStores || 0}`);
        drawKpiCard(106, 59, 42, 17, "Boutiques Suspendues", `${stats.suspendedStores || 0}`);
        drawKpiCard(152, 59, 44, 17, "Utilisateurs Système", `${stats.totalUsers || 0}`);
      } else {
        drawKpiCard(14, 59, 42, 17, "Ventes Totales", canViewReports ? `${stats.totalSales.toLocaleString('de-DE')} F` : "N/A (Privé)");
        drawKpiCard(60, 59, 42, 17, "Nombre Commandes", `${stats.orders || 0}`);
        drawKpiCard(106, 59, 42, 17, "Nombre Produits", `${stats.products || 0}`);
        drawKpiCard(152, 59, 44, 17, "Clients Enregistrés", canViewReports ? `${stats.customers || 0}` : "N/A (Privé)");
      }

      // Progression / Budget target
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text("2. Suivi et Progression de l'Objectif Mensuel", 14, 91);
      doc.line(14, 94, 196, 94);

      doc.setFillColor(254, 243, 199); // amber-100
      doc.setDrawColor(252, 211, 77); // amber-300
      doc.roundedRect(14, 98, 182, 22, 3, 3, 'FD');

      doc.setTextColor(146, 64, 14); // amber-800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`OBJECTIF PRINCIPAL DU COMPTOIR :  ${salesGoal.toLocaleString('de-DE')} FCFA`, 19, 105);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 113, 108);
      const remainingToGoal = Math.max(0, salesGoal - stats.totalSales);
      const progressText = `Ventes actuelles accumulées : ${stats.totalSales.toLocaleString('de-DE')} FCFA. Progression : ${Math.min(100, Math.round((stats.totalSales / salesGoal) * 100))}% du but ciblé.`;
      const remainText = remainingToGoal > 0 
        ? `Écart à combler pour atteindre l'objectif fixé : ${remainingToGoal.toLocaleString('de-DE')} FCFA.`
        : `Félicitations ! Votre boutique a dépassé l'objectif mensuel de +${Math.abs(stats.totalSales - salesGoal).toLocaleString('de-DE')} FCFA !`;
      
      doc.text(progressText, 19, 110);
      doc.text(remainText, 19, 114);

      // Inventory alerts
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text("3. Niveau d'Alerte & Inventaire Critique", 14, 134);
      doc.line(14, 137, 196, 137);

      let currentY = 143;
      if (alerts && alerts.length > 0) {
        alerts.forEach((alert, index) => {
          if (currentY + 12 < 280) {
            doc.setFillColor(249, 115, 22);
            doc.circle(17, currentY - 1, 1, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.text(`${index + 1}. ${alert.name || 'Produit'}`, 21, currentY);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            const alertDetail = alert.alertType === 'expiry' 
              ? `État de validité de service : Expire le ${new Date(alert.expiryDate).toLocaleDateString()}`
              : `Alerte niveau de stockage : Plus que ${alert.stock || 0} unité(s) restante(s). Seuil minimum configuré : ${alert.lowStockThreshold || 5}.`;
            doc.text(alertDetail, 21, currentY + 4.5);
            
            currentY += 14;
          }
        });
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("Aucune alerte critique enregistrée pour le moment. Votre boutique est entièrement optimisée !", 18, 144);
      }

      // Sign-off
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 275, 196, 275);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Rapport administratif confidentiel édité par MARKET PRO sous l'infrastructure G-TECH CLOUD SECURE.`, 105, 281, { align: 'center' });
      doc.text(`Conforme au decret N° 2019-014 sur la protection des données et transactions du commerce électronique en vigueur au Togo.`, 105, 285, { align: 'center' });

      const cleanStoreName = (userProfile?.storeName || 'MarketPro').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Rapport_Activite_${cleanStoreName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de la génération du rapport PDF : " + e.message);
    }
  };

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
    <div className="space-y-8 text-left">
      {/* Premium Localized Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 bg-white p-6 sm:p-8 rounded-[32px] border border-gray-100 shadow-sm">
        <div className="space-y-1.5 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-200/50">
              <ShieldCheck size={12} className="text-green-600 shrink-0" />
              <span>G-Tech Cloud Certifié</span>
            </span>
            <span className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-mono">
              <Clock size={11} className="text-slate-500 shrink-0" />
              <span>GMT+0 Lomé</span>
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2 pt-0.5">
            <span>
              {(() => {
                const hr = new Date().getHours();
                if (hr < 12) return "Bonjour";
                if (hr < 18) return "Bon après-midi";
                return "Bonsoir";
              })()}
            </span>
            {userProfile?.displayName ? (
              <span className="text-orange-500 italic font-black">, {userProfile.displayName}</span>
            ) : null}
            <span className="animate-pulse">👋</span>
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            Tableau de bord de <span className="text-slate-800 font-extrabold">{userProfile?.storeName || 'votre boutique'}</span>.
          </p>
        </div>

        {/* Global Instant PDF Downloader */}
        <div className="flex shrink-0">
          <button
            onClick={handleExportDashboardPDF}
            className="flex items-center justify-center gap-2.5 px-6 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-orange-500/20 w-full sm:w-auto"
            title="Exporter l'activité consolidée au format PDF"
          >
            <FileDown size={16} />
            <span>Rapport d'Activité (PDF)</span>
          </button>
        </div>
      </div>

      {/* Fast Shortcuts & Command Center Banner */}
      {!isSuperAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/pos')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-slate-50 border border-gray-100 rounded-2xl transition-all shadow-sm group text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Zap size={18} className="fill-orange-500" />
            </div>
            <span className="text-[10px] font-black uppercase text-gray-800 tracking-wider">Faire une vente</span>
          </button>

          <button
            onClick={() => navigate('/inventory')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-slate-50 border border-gray-100 rounded-2xl transition-all shadow-sm group text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Package size={18} />
            </div>
            <span className="text-[10px] font-black uppercase text-gray-800 tracking-wider">Ajouter Produit</span>
          </button>

          <button
            onClick={() => navigate('/accounting')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-slate-50 border border-gray-100 rounded-2xl transition-all shadow-sm group text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Activity size={18} />
            </div>
            <span className="text-[10px] font-black uppercase text-gray-800 tracking-wider">Comptabilité</span>
          </button>

          <button
            onClick={() => navigate('/personnel')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-slate-50 border border-gray-100 rounded-2xl transition-all shadow-sm group text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users size={18} />
            </div>
            <span className="text-[10px] font-black uppercase text-gray-800 tracking-wider">Gérer Personnel</span>
          </button>
        </div>
      )}

      {/* Interactive Monthly Revenue Goal Tracker */}
      {!isSuperAdmin && canViewReports && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-[32px] p-6 sm:p-8 border border-white/5 shadow-xl relative overflow-hidden">
          {/* Accent decoration overlay */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-orange-500/10 to-transparent pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 text-left">
              <div className="flex items-center gap-2 text-orange-400">
                <Trophy size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Suivi d'objectif mensuel</span>
              </div>
              
              <div className="flex items-center gap-3.5 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-black">
                  Objectif : {salesGoal.toLocaleString('de-DE')} FCFA
                </h3>
                
                {isEditingGoal ? (
                  <div className="flex items-center gap-2 bg-white/10 p-1 rounded-xl border border-white/10">
                    <input
                      type="number"
                      value={newGoalInput}
                      onChange={(e) => setNewGoalInput(e.target.value)}
                      className="bg-transparent text-white placeholder-white/30 text-xs font-bold outline-none px-2 w-28 text-left border-none"
                      placeholder="Nouveau but"
                    />
                    <button
                      onClick={handleSaveGoal}
                      className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors"
                    >
                      Enregistrer
                    </button>
                    <button
                      onClick={() => setIsEditingGoal(false)}
                      className="text-white/50 hover:text-white text-[11px] font-bold px-1"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setNewGoalInput(salesGoal.toString()); setIsEditingGoal(true); }}
                    className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all"
                  >
                    <Edit3 size={11} className="text-orange-400" />
                    <span>Modifier le but</span>
                  </button>
                )}
              </div>

              <p className="text-slate-300 text-xs font-semibold leading-relaxed max-w-xl">
                {stats.totalSales >= salesGoal ? (
                  <span className="text-green-400 font-bold">✨ Incroyable ! Vous avez franchi votre objectif de vente de ce mois-ci ! Continuez ainsi.</span>
                ) : (
                  <span>Il vous reste <strong className="text-orange-400">{(salesGoal - stats.totalSales).toLocaleString('de-DE')} F</strong> à comptabiliser pour atteindre l'objectif ciblé de ce mois.</span>
                )}
              </p>
            </div>

            <div className="flex flex-col items-center md:items-end gap-1.5 min-w-[120px]">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Progression</span>
              <span className="text-3xl sm:text-4xl font-black text-white italic tracking-tighter">
                {Math.min(100, Math.round((stats.totalSales / salesGoal) * 100))}%
              </span>
            </div>
          </div>

          {/* Progress bar alignment */}
          <div className="mt-6 w-full h-3 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (stats.totalSales / salesGoal) * 100)}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full shadow-lg"
            />
          </div>
        </div>
      )}

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
