import React, { useState, useEffect } from 'react';
import { 
  collection, query, getDocs, doc, updateDoc, setDoc,
  onSnapshot, orderBy, where, deleteDoc, Timestamp,
  serverTimestamp, limit
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, Users, Store, Calendar, 
  CheckCircle2, XCircle, AlertTriangle, 
  Search, RefreshCcw, Power, Trash2, 
  Activity, ArrowRight, Mail, Phone, MapPin, User, Globe, History
} from 'lucide-react';
import { StoreSettings, UserProfile } from '../types';

export default function SuperAdmin() {
  const [stores, setStores] = useState<StoreSettings[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<StoreSettings | null>(null);
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [newStoreData, setNewStoreData] = useState({ name: '', adminEmail: '', address: '', phone: '' });
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [domainUrl, setDomainUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'stores' | 'connections'>('stores');
  const [connectionLogs, setConnectionLogs] = useState<any[]>([]);
  const [logsLimit, setLogsLimit] = useState<number>(100);

  useEffect(() => {
    // Subscription for connectionHistory logs (accessible only by bootstrap admin)
    const logsQuery = query(
      collection(db, 'connectionHistory'), 
      orderBy('timestamp', 'desc'), 
      limit(logsLimit)
    );
    const unsubConnections = onSnapshot(logsQuery, (snap) => {
      console.log("SuperAdmin: Fetched connection logs in real-time:", snap.size);
      const logsList = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setConnectionLogs(logsList);
    }, (err) => {
      console.warn("Unable to fetch connection histories, probably current user is not bootstrap admin or rules not deployed yet:", err);
    });

    return () => {
      unsubConnections();
    };
  }, [logsLimit]);

  useEffect(() => {
    setLoading(true);
    // Real-time listener for system config
    const unsubConfig = onSnapshot(doc(db, 'systemConfig', 'globals'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSystemConfig(data);
        if (data.publicAccessUrl) setDomainUrl(data.publicAccessUrl);
      } else {
        // Initialize if not exists
        setSystemConfig({ isGoogleLoginEnabled: true });
      }
    }, (error) => {
      console.warn("Error subscribing to global system config:", error);
    });

    // Real-time listener for all stores
    const unsubStores = onSnapshot(collection(db, 'storeSettings'), (snap) => {
      console.log("SuperAdmin: Fetched stores:", snap.size);
      const storesList = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as StoreSettings));
      setStores(storesList);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching stores:", err);
      // If we get a permission error, it's a sign that isBootstrapAdmin is false for this user
      if (err.message.includes('permission')) {
        alert("Accès refusé aux boutiques. Vérifiez vos privilèges administrateur (Email: " + auth.currentUser?.email + ")");
      }
      setLoading(false);
    });

    // Real-time listener for all users (global)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      console.log("SuperAdmin: Fetched users:", snap.size);
      const usersList = snap.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
      setAllUsers(usersList);
    }, (err) => {
      console.error("Error fetching global users:", err);
      // If we get a permission error, it's a sign that isBootstrapAdmin is false for this user
      if (err.message.includes('permission')) {
        alert("Accès refusé aux utilisateurs globaux. Vérifiez vos privilèges administrateur.");
      }
    });

    return () => {
      unsubConfig();
      unsubStores();
      unsubUsers();
    };
  }, []);

  const handleToggleGoogleLogin = async () => {
    try {
      const configRef = doc(db, 'systemConfig', 'globals');
      await setDoc(configRef, { 
        isGoogleLoginEnabled: !systemConfig?.isGoogleLoginEnabled,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Error toggling google login:", err);
      alert("Erreur lors de la modification de la configuration.");
    }
  };

  const handleToggleRegistration = async () => {
    try {
      const configRef = doc(db, 'systemConfig', 'globals');
      await setDoc(configRef, { 
        isRegistrationEnabled: systemConfig?.isRegistrationEnabled === false ? true : false,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Error toggling registration:", err);
      alert("Erreur lors de la modification de la configuration.");
    }
  };

  const handleUpdateDomainConfig = async (url: string, enabled: boolean) => {
    try {
      const configRef = doc(db, 'systemConfig', 'globals');
      await setDoc(configRef, { 
        publicAccessUrl: url,
        isAutoRedirectEnabled: enabled,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert("Configuration du domaine mise à jour.");
    } catch (err) {
      console.error("Error updating domain config:", err);
      alert("Erreur lors de la mise à jour.");
    }
  };

  const sendApprovalEmail = async (userEmail: string, userName: string, storeName: string) => {
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'store_approved',
          data: {
            email: userEmail,
            displayName: userName,
            storeName: storeName
          }
        })
      });
      console.log(`Approval email request sent to ${userEmail} for store "${storeName}".`);
    } catch (err) {
      console.error("Failed to send approval email:", err);
    }
  };

  const handleUpdateLicense = async (storeId: string, status: 'active' | 'expired' | 'suspended', months: number = 0) => {
    try {
      const storeRef = doc(db, 'storeSettings', storeId);
      const updates: any = { licenseStatus: status };
      
      if (months > 0) {
        const currentExpiry = new Date();
        currentExpiry.setMonth(currentExpiry.getMonth() + months);
        updates.licenseExpiry = currentExpiry.toISOString();
      }

      await updateDoc(storeRef, updates);

      // If approving, also activate the store admin users
      if (status === 'active') {
        const storeUsers = allUsers.filter(u => u.storeId === storeId && u.pendingApproval);
        const storeObj = stores.find(s => s.id === storeId);
        const storeName = storeObj?.name || 'Ma Boutique';
        for (const user of storeUsers) {
          await updateDoc(doc(db, 'users', user.uid), { 
            isActive: true, 
            pendingApproval: false,
            updatedAt: serverTimestamp()
          });
          // Send approval email directly to user's mailbox
          await sendApprovalEmail(user.email, user.displayName || 'Utilisateur', storeName);
        }
      }

      alert("Licence mise à jour avec succès.");
    } catch (error) {
      console.error("Error updating license:", error);
      alert("Erreur lors de la mise à jour.");
    }
  };

  const handleApproveStore = async (storeId: string) => {
    if (!confirm("Voulez-vous approuver cette boutique et activer son administrateur ?")) return;
    await handleUpdateLicense(storeId, 'active', 12);
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isActive: !currentStatus });
    } catch (error) {
      console.error("Error toggling user status:", error);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreData.name || !newStoreData.adminEmail) {
      alert("Le nom et l'email admin sont requis.");
      return;
    }

    setLoading(true);
    try {
      // Generate a unique store ID
      const storeId = 'store_' + Math.random().toString(36).substring(2, 10);
      
      // 1. Create Store Settings
      await setDoc(doc(db, 'storeSettings', storeId), {
        name: newStoreData.name,
        address: newStoreData.address,
        phone: newStoreData.phone,
        licenseStatus: 'active',
        licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'FCFA',
        updatedAt: serverTimestamp()
      });

      // 2. Create/Reserve the Admin User Profile
      // Note: We don't create the Firebase Auth user here (security), 
      // but we prepare the profile so when they log in/sign up with this email, they get the role.
      // We use a temporary UID based on email or a prefix if they don't have one yet.
      // Actually, it's better to just wait for them to log in, but we can't easily link them.
      // So we'll use a placeholder UID or just advise the super admin.
      
      // Best approach for this app's architecture: create a user doc with the email as ID 
      // or wait for them. Let's use the email as a temporary identifier or a random one.
      const userId = 'user_' + Math.random().toString(36).substring(2, 10);
      await setDoc(doc(db, 'users', userId), {
        email: newStoreData.adminEmail.toLowerCase(),
        displayName: 'Admin ' + newStoreData.name,
        role: 'admin',
        storeId: storeId,
        isActive: true,
        pendingApproval: false,
        createdAt: serverTimestamp()
      });

      alert(`Boutique "${newStoreData.name}" créée avec succès. L'administrateur (${newStoreData.adminEmail}) peut maintenant se connecter.`);
      setIsCreatingStore(false);
      setNewStoreData({ name: '', adminEmail: '', address: '', phone: '' });
    } catch (err: any) {
      console.error("Error creating store:", err);
      alert("Erreur lors de la création: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStore = async (storeId: string, storeName: string) => {
    // Only the main admin can delete
    if (auth.currentUser?.email !== 'anges.gildas@gmail.com') {
      alert("Accès non autorisé.");
      return;
    }

    if (!confirm(`⚠️ ATTENTION: Vous allez supprimer DÉFINITIVEMENT la boutique "${storeName}".\n\nTous les comptes utilisateurs liés à cette boutique seront révoqués.\n\nCette action est irréversible. Continuer ?`)) return;
    
    setLoading(true);
    try {
      // 1. Delete associated users
      const storeUsers = allUsers.filter(u => u.storeId === storeId);
      for (const u of storeUsers) {
        await deleteDoc(doc(db, 'users', u.uid));
      }
      
      // 2. Delete the store settings
      await deleteDoc(doc(db, 'storeSettings', storeId));
      
      alert(`Boutique "${storeName}" et ses ${storeUsers.length} utilisateur(s) ont été supprimés.`);
    } catch (err: any) {
      console.error("Error deleting store:", err);
      alert("Erreur lors de la suppression: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const pendingStores = stores.filter(s => s.licenseStatus === 'pending');
  const pendingUsers = allUsers.filter(u => u.pendingApproval);

  const filteredStores = stores.filter(s => 
    s.licenseStatus !== 'pending' && (
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.id?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const filteredLogs = connectionLogs.filter(log => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.userName?.toLowerCase().includes(q) ||
      log.userEmail?.toLowerCase().includes(q) ||
      log.storeName?.toLowerCase().includes(q) ||
      log.storeId?.toLowerCase().includes(q)
    );
  });

  const stats = {
    totalStores: stores.length,
    activeLicenses: stores.filter(s => {
      const isExpired = s.licenseExpiry ? new Date(s.licenseExpiry) < new Date() : false;
      return s.licenseStatus === 'active' && !isExpired;
    }).length,
    expiredLicenses: stores.filter(s => {
      const isExpiredByDate = s.licenseExpiry ? new Date(s.licenseExpiry) < new Date() : false;
      return s.licenseStatus === 'expired' || (s.licenseStatus === 'active' && isExpiredByDate);
    }).length,
    suspendedLicenses: stores.filter(s => s.licenseStatus === 'suspended').length,
    totalUsers: allUsers.length
  };

  const handleSystemReset = async () => {
    if (!confirm("ATTENTION: Vous allez réinitialiser le système COMPLET (toutes les boutiques). Cette action est IRRÉVERSIBLE. Voulez-vous continuer ?")) return;
    
    setLoading(true);
    try {
      const collectionsToEmpty = ['products', 'sales', 'expenses', 'auditLogs', 'employees', 'leaves', 'payroll', 'clients', 'storeSettings', 'users'];
      
      for (const collName of collectionsToEmpty) {
        const snap = await getDocs(collection(db, collName));
        for (const d of snap.docs) {
          // Don't delete ourself!
          if (collName === 'users' && d.id === auth.currentUser?.uid) continue;
          // Don't delete the main store settings if we want to keep it
          // if (collName === 'storeSettings' && d.id === 'main') continue;

          if (collName === 'sales') {
            const itemsSnap = await getDocs(collection(db, `sales/${d.id}/items`));
            for (const idoc of itemsSnap.docs) {
              await deleteDoc(idoc.ref);
            }
          }
          await deleteDoc(d.ref);
        }
      }
      
      alert("Application réinitialisée avec succès !");
      window.location.reload();
    } catch (err: any) {
      console.error("Global Reset Error:", err);
      alert("Erreur lors de la réinitialisation: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3 italic">
            <ShieldAlert className="text-orange-500" size={36} />
            CONTRÔLE GLOBAL
          </h1>
          <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">Administration Système & Abonnements</p>
        </div>

        <div className="flex items-center gap-4">
           {/* Google Login Toggle */}
           <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm group relative">
             <div className="flex flex-col">
               <span className="text-[9px] font-black uppercase text-gray-400">Google Auth</span>
               <span className={`text-[10px] font-bold ${systemConfig?.isGoogleLoginEnabled ? 'text-green-500' : 'text-red-500'}`}>
                 {systemConfig?.isGoogleLoginEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
               </span>
             </div>
             <button 
               onClick={handleToggleGoogleLogin}
               className={`w-12 h-6 rounded-full transition-all relative ${systemConfig?.isGoogleLoginEnabled ? 'bg-green-500' : 'bg-gray-200'}`}
             >
               <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${systemConfig?.isGoogleLoginEnabled ? 'left-7' : 'left-1'}`} />
             </button>
             
             {/* Tooltip */}
             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
               {systemConfig?.isGoogleLoginEnabled ? 'Désactiver la connexion Google' : 'Activer la connexion Google'}
               <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
             </div>
           </div>

           {/* Registration Toggle */}
           <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm group relative">
             <div className="flex flex-col">
               <span className="text-[9px] font-black uppercase text-gray-400">Inscription</span>
               <span className={`text-[10px] font-bold ${systemConfig?.isRegistrationEnabled !== false ? 'text-green-500' : 'text-red-500'}`}>
                 {systemConfig?.isRegistrationEnabled !== false ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
               </span>
             </div>
             <button 
               onClick={handleToggleRegistration}
               className={`w-12 h-6 rounded-full transition-all relative ${systemConfig?.isRegistrationEnabled !== false ? 'bg-green-500' : 'bg-gray-200'}`}
             >
               <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${systemConfig?.isRegistrationEnabled !== false ? 'left-7' : 'left-1'}`} />
             </button>

             {/* Tooltip */}
             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
               {systemConfig?.isRegistrationEnabled !== false ? "Désactiver l'auto-inscription" : "Activer l'auto-inscription"}
               <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
             </div>
           </div>

           {/* Domain Redirection Config */}
           <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-6 shadow-sm min-w-[450px]">
             <div className="flex flex-col flex-1">
               <span className="text-[9px] font-black uppercase text-gray-400 mb-1">Redirection Domaine</span>
               <div className="flex items-center gap-2">
                 <input 
                   type="text" 
                   placeholder="https://angesgildas-hub.github.io/market/"
                   value={domainUrl}
                   onChange={(e) => setDomainUrl(e.target.value)}
                   className="text-[10px] font-bold bg-gray-50 px-3 py-1.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-orange-500/20 w-full"
                 />
                 <div className="group relative">
                   <button 
                     onClick={() => handleUpdateDomainConfig(domainUrl, systemConfig?.isAutoRedirectEnabled)}
                     className="p-1.5 bg-orange-500 text-white rounded-lg hover:bg-black transition-all shadow-sm"
                   >
                     <RefreshCcw size={14} />
                   </button>
                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
                     Enregistrer l'URL de redirection
                     <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
                   </div>
                 </div>
               </div>
             </div>
             <div className="flex items-center gap-3 border-l border-gray-100 pl-4 group relative">
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black uppercase text-gray-400">Auto-Redirect</span>
                  <span className={`text-[10px] font-bold ${systemConfig?.isAutoRedirectEnabled ? 'text-orange-500' : 'text-gray-400'}`}>
                    {systemConfig?.isAutoRedirectEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <button 
                  onClick={() => handleUpdateDomainConfig(domainUrl, !systemConfig?.isAutoRedirectEnabled)}
                  className={`w-10 h-5 rounded-full transition-all relative ${systemConfig?.isAutoRedirectEnabled ? 'bg-orange-500' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${systemConfig?.isAutoRedirectEnabled ? 'left-6' : 'left-1'}`} />
                </button>

                {/* Tooltip */}
                <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-black text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
                   {systemConfig?.isAutoRedirectEnabled ? 'Désactiver la redirection automatique' : 'Activer la redirection automatique'}
                   <div className="absolute top-full right-4 border-4 border-transparent border-t-black" />
                </div>
             </div>
             {systemConfig?.publicAccessUrl && (
               <div className="group relative">
                 <a 
                  href={systemConfig.publicAccessUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 bg-gray-50 text-gray-400 hover:text-orange-600 rounded-xl transition-all block"
                 >
                   <Globe size={18} />
                 </a>
                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
                   Ouvrir le site public
                   <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
                 </div>
               </div>
             )}
           </div>
           
           <div className="group relative">
             <button 
               onClick={handleSystemReset}
               className="px-6 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 shadow-sm"
             >
               <Trash2 size={18} />
               Réinitialiser Système
             </button>
             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-red-600 text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
               EFFACER TOUTES LES DONNÉES (DANGEREUX)
               <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-600" />
             </div>
           </div>

           <div className="group relative">
             <button 
                onClick={() => setIsCreatingStore(true)}
                className="px-6 py-4 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20 whitespace-nowrap"
              >
                <Store size={18} />
                Nouvelle Boutique
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
                 Créer manuellement une boutique
                 <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
              </div>
           </div>

           <div className="relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
               type="text" 
               placeholder="Rechercher une boutique..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-orange-500/5 outline-none w-full md:w-80 font-bold transition-all"
             />
           </div>
        </div>
      </div>

      {/* Pending Approvals Section */}
      {(pendingStores.length > 0 || pendingUsers.length > 0) && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-orange-50 p-8 rounded-[40px] border border-orange-100 shadow-xl shadow-orange-500/5 transition-all"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-orange-500 shadow-sm border border-orange-100">
                  <User size={24} />
               </div>
               <div>
                  <h2 className="text-xl font-black text-orange-950 tracking-tight uppercase italic">Nouvelles Demandes ({pendingStores.length + pendingUsers.length})</h2>
                  <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest">En attente d'approbation système</p>
               </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Stores Pending */}
            {pendingStores.map(store => {
               const adminUser = allUsers.find(u => u.storeId === store.id && u.role === 'admin' && u.pendingApproval);
               return (
                <div key={`pending-store-${store.id}`} className="bg-white p-6 rounded-[32px] border border-orange-200 shadow-sm hover:shadow-xl transition-all group">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100">
                      {store.logoUrl ? <img src={store.logoUrl} alt="" className="w-full h-full object-cover" /> : <Store size={24} className="text-gray-300" />}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-[8px] font-black uppercase tracking-widest mb-2">Nouvelle Boutique</span>
                      <p className="text-[9px] font-mono text-gray-400">Ref: {store.id.slice(0, 8)}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-black text-gray-900 text-lg mb-1">{store.name || 'Boutique en attente'}</h3>
                    <div className="flex flex-col gap-1">
                      {adminUser && (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Mail size={12} />
                          <span className="text-xs font-bold">{adminUser.email}</span>
                        </div>
                      )}
                      {store.subdomain && (
                        <div className="flex items-center gap-2 text-orange-600">
                          <Globe size={12} />
                          <span className="text-[10px] font-black uppercase tracking-tight">{store.subdomain}</span>
                        </div>
                      )}
                      {store.country && (
                        <div className="flex items-center gap-2 text-gray-400">
                          <MapPin size={12} />
                          <span className="text-[10px] font-bold uppercase">{store.country}</span>
                        </div>
                      )}
                      {store.operatorNumbers && Object.keys(store.operatorNumbers).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(store.operatorNumbers).map(([op, num]) => (
                            <div key={op} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[8px] font-black text-slate-500 uppercase">
                              {op.split('_')[0]}: {num}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleApproveStore(store.id)}
                      className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={14} />
                      Approuver Boutique
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm("Voulez-vous rejeter et supprimer cette demande ?")) {
                           deleteDoc(doc(db, 'storeSettings', store.id));
                           if (adminUser) deleteDoc(doc(db, 'users', adminUser.uid));
                        }
                      }}
                      className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
               );
            })}

            {/* Orphaned Users Pending (not covered by pendingStores above) */}
            {pendingUsers.filter(u => !pendingStores.some(s => s.id === u.storeId)).map(user => (
                <div key={`pending-user-${user.uid}`} className="bg-white p-6 rounded-[32px] border border-orange-200 shadow-sm hover:shadow-xl transition-all group">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100">
                      {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <User size={24} className="text-gray-300" />}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-[8px] font-black uppercase tracking-widest mb-2">Nouvel Admin</span>
                      <p className="text-[9px] font-mono text-gray-400">ID: {user.uid.slice(0, 8)}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-black text-gray-900 text-lg mb-1">{user.displayName || 'Utilisateur'}</h3>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Mail size={12} />
                      <span className="text-xs font-bold">{user.email}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">Boutique: {user.storeId}</p>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        if (confirm(`Approuver l'administrateur ${user.email} ?`)) {
                           await updateDoc(doc(db, 'users', user.uid), { 
                             isActive: true, 
                             pendingApproval: false,
                             updatedAt: serverTimestamp()
                           });
                           // Also ensure store is active
                           await updateDoc(doc(db, 'storeSettings', user.storeId), { licenseStatus: 'active' });
                           // Send approval email directly to user's mailbox
                           const storeObj = stores.find(s => s.id === user.storeId);
                           const storeName = storeObj?.name || 'Ma Boutique';
                           await sendApprovalEmail(user.email, user.displayName || 'Utilisateur', storeName);
                        }
                      }}
                      className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={14} />
                      Approuver Admin
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm("Voulez-vous rejeter cet utilisateur ?")) {
                           deleteDoc(doc(db, 'users', user.uid));
                        }
                      }}
                      className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Boutiques Totales', value: stats.totalStores, icon: Store, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Licences Actives', value: stats.activeLicenses, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Utilisateurs Globaux', value: stats.totalUsers, icon: Users, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Alertes Système', value: stats.expiredLicenses + stats.suspendedLicenses, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
        ].map((stat, idx) => (
          <motion.div 
            key={`stat-super-${idx}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-xl hover:shadow-gray-200/50 transition-all"
          >
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <stat.icon size={24} />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-gray-900">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* System Alerts Section */}
      {(stats.expiredLicenses > 0 || stats.suspendedLicenses > 0) && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-red-50 p-8 rounded-[40px] border border-red-100"
        >
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="text-red-600" size={24} />
            <h2 className="text-xl font-black text-red-900 tracking-tight uppercase italic">Alertes Critiques ({stats.expiredLicenses + stats.suspendedLicenses})</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.filter(s => {
              const isExpired = s.licenseExpiry ? new Date(s.licenseExpiry) < new Date() : false;
              return s.licenseStatus === 'suspended' || s.licenseStatus === 'expired' || (s.licenseStatus === 'active' && isExpired);
            }).map(store => (
              <div key={`alert-store-${store.id}`} className="bg-white p-4 rounded-3xl border border-red-200 flex items-center justify-between">
                <div>
                  <p className="font-black text-gray-900 text-sm">{store.name || 'Boutique'}</p>
                  <p className="text-[10px] text-red-500 font-bold uppercase">
                    {store.licenseStatus === 'suspended' ? 'Suspendu' : 'Licence Expirée'}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedStore(store)}
                  className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Dynamic Tab Switchers */}
      <div className="flex items-center gap-3 bg-white/60 p-1.5 border border-gray-100 rounded-2xl w-fit shadow-sm backdrop-blur-md mb-6">
        <button
          onClick={() => setActiveTab('stores')}
          className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
            activeTab === 'stores'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-gray-400 hover:text-slate-900 hover:bg-gray-50'
          }`}
        >
          <Store size={14} />
          Boutiques Abonnées
        </button>
        <button
          onClick={() => setActiveTab('connections')}
          className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
            activeTab === 'connections'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-gray-400 hover:text-slate-900 hover:bg-gray-50'
          }`}
        >
          <History size={14} />
          Historique des Connexions
        </button>
      </div>

      {activeTab === 'stores' ? (
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl shadow-gray-200/30 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase italic flex items-center gap-2">
              <Activity size={20} className="text-orange-500" />
              Liste des boutiques active
            </h2>
            <span className="px-4 py-1.5 bg-gray-50 text-gray-500 rounded-full text-[10px] font-black uppercase tracking-widest">
              {filteredStores.length} Résultats
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Boutique</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Licence</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Expiration</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Utilisateurs</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Actions globales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredStores.map((store) => {
                  const storeUsers = allUsers.filter(u => u.storeId === store.id);
                  const isExpired = new Date(store.licenseExpiry || '') < new Date();
                  
                  return (
                    <tr key={`table-store-${store.id}`} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl border-2 border-gray-50 flex items-center justify-center overflow-hidden shadow-sm">
                            {store.logoUrl ? (
                              <img src={store.logoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Store className="text-gray-300" size={24} />
                            )}
                          </div>
                          <div>
                            <p className="font-black text-gray-900 text-sm tracking-tight">{store.name || 'Sans Nom'}</p>
                            <p className="text-[10px] text-gray-400 font-mono">ID: {store.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 w-fit ${
                          store.licenseStatus === 'active' 
                            ? isExpired ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                            : 'bg-red-50 text-red-600'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                             store.licenseStatus === 'active' 
                              ? isExpired ? 'bg-orange-500 animate-pulse' : 'bg-green-500' 
                              : 'bg-red-500'
                          }`} />
                          {store.licenseStatus === 'active' 
                            ? isExpired ? 'Expiré (Immédiat)' : 'Actif'
                            : store.licenseStatus === 'suspended' ? 'Suspendu' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                          <Calendar size={14} className="text-gray-400" />
                          {store.licenseExpiry ? new Date(store.licenseExpiry).toLocaleDateString('fr-FR') : 'Non définie'}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex -space-x-3">
                          {storeUsers.slice(0, 4).map((u, i) => (
                             <div key={`store-user-thumb-${u.uid}`} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center overflow-hidden shadow-sm">
                               {u.photoURL ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" /> : <User size={14} className="text-gray-400" />}
                             </div>
                          ))}
                          {storeUsers.length > 4 && (
                            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-900 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                              +{storeUsers.length - 4}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className="group relative">
                            <button 
                              onClick={() => handleUpdateLicense(store.id, 'active', 1)}
                              className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm group/btn"
                            >
                              <RefreshCcw size={16} className="group-hover/btn:rotate-180 transition-transform duration-500" />
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
                              Ajouter 1 mois de licence
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
                            </div>
                          </div>

                          <div className="group relative">
                            <button 
                              onClick={() => handleUpdateLicense(store.id, 'active', 12)}
                              className="p-2.5 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-sm font-black text-[10px] uppercase tracking-widest px-4"
                            >
                              +1 AN
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
                              Ajouter 1 an de licence
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
                            </div>
                          </div>

                          <div className="group relative">
                            <button 
                              onClick={() => handleUpdateLicense(store.id, store.licenseStatus === 'suspended' ? 'active' : 'suspended')}
                              className={`p-2.5 rounded-xl transition-all shadow-sm ${
                                store.licenseStatus === 'suspended' ? 'bg-blue-50 text-blue-600 hover:bg-blue-600' : 'bg-red-50 text-red-600 hover:bg-red-600'
                              } hover:text-white`}
                            >
                              <Power size={16} />
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
                              {store.licenseStatus === 'suspended' ? 'Réactiver la boutique' : 'Suspendre la boutique'}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
                            </div>
                          </div>

                          {auth.currentUser?.email === 'anges.gildas@gmail.com' && (
                            <div className="group relative">
                              <button 
                                onClick={() => handleDeleteStore(store.id, store.name)}
                                className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                              >
                                <Trash2 size={16} />
                              </button>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-red-600 text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
                                Supprimer DEFINITIVEMENT
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-600" />
                              </div>
                            </div>
                          )}

                          <div className="group relative">
                            <button 
                              onClick={() => setSelectedStore(store)}
                              className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-lg"
                            >
                              <ArrowRight size={16} />
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-[10px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
                              Voir les détails
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl shadow-gray-200/30 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase italic flex items-center gap-2">
                <History size={20} className="text-orange-500" />
                Historique de connexion des boutiques
              </h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Événements de connexion en temps réel</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={logsLimit}
                onChange={(e) => setLogsLimit(Number(e.target.value))}
                className="px-4 py-2 bg-gray-50 text-gray-700 font-bold text-xs rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value={50}>Afficher 50 logs</option>
                <option value={100}>Afficher 100 logs</option>
                <option value={200}>Afficher 200 logs</option>
                <option value={500}>Afficher 500 logs</option>
              </select>
              <button
                onClick={async () => {
                  if (confirm("Voulez-vous vider tout l'historique de connexion ?")) {
                    setLoading(true);
                    try {
                      const snap = await getDocs(collection(db, 'connectionHistory'));
                      for (const logDoc of snap.docs) {
                        await deleteDoc(logDoc.ref);
                      }
                      alert("Historique vidé.");
                    } catch (e: any) {
                      alert("Erreur de suppression: " + e.message);
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                className="px-4 py-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest rounded-xl"
              >
                Tout Effacer
              </button>
              <span className="px-4 py-1.5 bg-gray-50 text-gray-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                {filteredLogs.length} Résultats
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Utilisateur</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Boutique</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date & Heure</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Navigateur / Système</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right pr-12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-sm font-bold text-gray-400 italic">
                      Aucun historique de connexion trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const dateVal = log.timestamp instanceof Timestamp 
                      ? log.timestamp.toDate() 
                      : (log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000) : new Date(log.timestamp || Date.now()));
                    
                    const getFriendlyUA = (ua: string) => {
                      if (!ua) return 'Inconnu';
                      if (ua.includes('FxiOS') || ua.includes('Firefox')) return 'Firefox';
                      if (ua.includes('CriOS') || ua.includes('Chrome')) return 'Chrome';
                      if (ua.includes('Safari')) return 'Safari';
                      if (ua.includes('Windows')) return 'Windows Edge/IE';
                      return 'Navigateur Sécurisé';
                    };

                    return (
                      <tr key={log.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-8 py-5">
                          <div>
                            <p className="font-black text-gray-900 text-sm tracking-tight">{log.userName || 'Sans Nom'}</p>
                            <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                              <Mail size={10} />
                              {log.userEmail}
                            </p>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{log.storeName || 'Boutique'}</p>
                            <p className="text-[10px] text-gray-400 font-mono">ID: {log.storeId}</p>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-xs font-bold text-gray-700">
                            {dateVal.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </td>
                        <td className="px-8 py-5">
                          <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 w-fit">
                            <span className="w-1 h-1 rounded-full bg-green-500" />
                            Succès
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-xs font-semibold text-gray-500 max-w-[200px] truncate" title={log.userAgent}>
                            {getFriendlyUA(log.userAgent)}
                          </p>
                        </td>
                        <td className="px-8 py-5 text-right pr-12">
                          <button
                            onClick={async () => {
                              if (confirm("Supprimer ce log ?")) {
                                try {
                                  await deleteDoc(doc(db, 'connectionHistory', log.id));
                                } catch (e: any) {
                                  alert("Erreur: " + e.message);
                                }
                              }
                            }}
                            className="p-2 text-gray-300 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                            title="Supprimer ce log"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Store Detail Modal */}
      <AnimatePresence>
        {selectedStore && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[48px] shadow-2xl border border-white/20 flex flex-col"
            >
              <div className="relative h-48 bg-slate-900 overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-indigo-500" />
                  <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                </div>
                <button 
                  onClick={() => setSelectedStore(null)}
                  className="absolute top-8 right-8 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90"
                >
                  <XCircle size={24} />
                </button>
                <div className="absolute bottom-[-40px] left-12 flex items-end gap-6">
                  <div className="w-32 h-32 bg-white rounded-[40px] p-2 shadow-2xl border-4 border-white overflow-hidden">
                    {selectedStore.logoUrl ? (
                      <img src={selectedStore.logoUrl} alt="" className="w-full h-full object-cover rounded-[32px]" />
                    ) : (
                      <div className="w-full h-full bg-gray-50 flex items-center justify-center rounded-[32px]">
                        <Store size={48} className="text-gray-200" />
                      </div>
                    )}
                  </div>
                  <div className="pb-4">
                    <h2 className="text-3xl font-black text-white tracking-tight">{selectedStore.name || 'Boutique'}</h2>
                    <p className="text-white/60 font-bold uppercase tracking-[0.2em] text-[10px]">Store ID: {selectedStore.id}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-12 pt-16">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-1 space-y-8">
                    <div>
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Informations</h3>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-gray-600 font-bold text-sm">
                          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                             <Phone size={18} />
                          </div>
                          {selectedStore.phone || 'Non renseigné'}
                        </div>
                        <div className="flex items-center gap-3 text-gray-600 font-bold text-sm">
                          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                             <MapPin size={18} />
                          </div>
                          {selectedStore.address || 'Non renseignée'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Statut Système</h3>
                      <div className={`p-6 rounded-3xl border ${selectedStore.licenseStatus === 'active' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                         <div className="flex items-center justify-between mb-4">
                            <span className="font-black text-sm uppercase tracking-tight">Licence PRO</span>
                            <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${selectedStore.licenseStatus === 'active' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                              {selectedStore.licenseStatus}
                            </div>
                         </div>
                         <p className="text-[10px] text-gray-500 font-bold leading-relaxed">
                            Expire le : {selectedStore.licenseExpiry ? new Date(selectedStore.licenseExpiry).toLocaleDateString() : 'N/A'}
                         </p>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Utilisateurs Enregistrés</h3>
                    <div className="space-y-3">
                      {allUsers.filter(u => u.storeId === selectedStore.id).map(user => (
                        <div key={`modal-user-${user.uid}`} className="flex items-center justify-between p-5 bg-gray-50 rounded-3xl group hover:bg-white hover:shadow-xl hover:shadow-gray-200/50 transition-all border border-transparent hover:border-gray-100">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
                              {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <User size={20} className="text-gray-300" />}
                            </div>
                            <div>
                               <p className="font-black text-gray-900 text-sm tracking-tight">{user.displayName || 'Utilisateur'}</p>
                               <div className="flex items-center gap-2">
                                  <Mail size={12} className="text-gray-400" />
                                  <span className="text-[10px] font-bold text-gray-500">{user.email}</span>
                               </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="px-3 py-1 bg-white border border-gray-100 rounded-full text-[8px] font-black uppercase tracking-widest text-gray-500">
                              {user.role}
                            </span>
                            <div className="relative group/user">
                              <button 
                                onClick={() => handleToggleUserStatus(user.uid, user.isActive !== false)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                  user.isActive !== false ? 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white' : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                                }`}
                              >
                                 <Power size={18} />
                              </button>
                              <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-black text-white text-[10px] font-bold rounded-xl opacity-0 group-hover/user:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-50">
                                {user.isActive !== false ? "Désactiver l'utilisateur" : "Activer l'utilisateur"}
                                <div className="absolute top-full right-4 border-4 border-transparent border-t-black" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Store Modal */}
      <AnimatePresence>
        {isCreatingStore && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="bg-white w-full max-w-xl overflow-hidden rounded-[40px] shadow-2xl border border-white/20 flex flex-col"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-orange-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                    <Store size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase italic">Nouvelle Boutique</h2>
                    <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest leading-none">Création manuelle directe</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCreatingStore(false)}
                  className="w-10 h-10 bg-white text-gray-400 hover:text-gray-900 rounded-xl flex items-center justify-center transition-all"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateStore} className="p-8 space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nom de la Boutique *</label>
                    <input 
                      type="text" 
                      required
                      value={newStoreData.name}
                      onChange={(e) => setNewStoreData({...newStoreData, name: e.target.value})}
                      placeholder="Ex: Marché Central"
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-orange-500/10 outline-none font-bold transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Administrateur *</label>
                    <input 
                      type="email" 
                      required
                      value={newStoreData.adminEmail}
                      onChange={(e) => setNewStoreData({...newStoreData, adminEmail: e.target.value})}
                      placeholder="admin@boutique.com"
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-orange-500/10 outline-none font-bold transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Téléphone</label>
                      <input 
                        type="tel" 
                        value={newStoreData.phone}
                        onChange={(e) => setNewStoreData({...newStoreData, phone: e.target.value})}
                        placeholder="+225..."
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-orange-500/10 outline-none font-bold transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Localisation</label>
                      <input 
                        type="text" 
                        value={newStoreData.address}
                        onChange={(e) => setNewStoreData({...newStoreData, address: e.target.value})}
                        placeholder="Abidjan, Cocody"
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-orange-500/10 outline-none font-bold transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsCreatingStore(false)}
                    className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Confirmer la Création
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
