import React, { useState, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Lock, User, ArrowRight, ShieldCheck, Mail, Eye, EyeOff, Loader2, Globe, Home } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { AppContext } from '../App';
import { StoreSettings } from '../types';
import { Link } from 'react-router-dom';

export default function Login() {
  const { language } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [isGoogleLoginEnabled, setIsGoogleLoginEnabled] = useState(true);
  const [isRegistrationEnabled, setIsRegistrationEnabled] = useState(true);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const snap = await getDoc(doc(db, 'storeSettings', 'main'));
        if (snap.exists()) {
          setStoreSettings(snap.data() as StoreSettings);
        }
      } catch (e) {
        console.error("Error fetching store settings for login:", e);
      }
    };

    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'systemConfig', 'globals'));
        if (snap.exists()) {
          setIsGoogleLoginEnabled(snap.data().isGoogleLoginEnabled !== false);
          setIsRegistrationEnabled(snap.data().isRegistrationEnabled !== false);
        }
      } catch (e) {
        console.error("Error fetching system config:", e);
      }
    };

    fetchStore();
    fetchConfig();
  }, []);

  useEffect(() => {
    // Auto-sync profile if user is logged in but profile is missing (handled by App.tsx)
    const checkSync = async () => {
      if (auth.currentUser && !loading) {
        setLoading(true);
        try {
          await syncUserProfile(auth.currentUser);
        } catch (e) {
          console.error("Auto-sync error:", e);
        } finally {
          setLoading(false);
        }
      }
    };
    checkSync();
  }, [auth.currentUser]);

  const syncUserProfile = async (user: any, name?: string) => {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    const privilegedAdmins = ['anges.gildas@gmail.com'];
    const isPrivileged = privilegedAdmins.includes(user.email || '');
    const storeId = isPrivileged ? 'main' : (userDoc.exists() ? (userDoc.data().storeId || user.uid) : user.uid);

    if (userDoc.exists()) {
      const data = userDoc.data();
      if (data.isActive === false) {
        await signOut(auth);
        throw new Error(data.pendingApproval ? "Votre boutique est en attente d'approbation par l'administrateur central." : "Votre compte est suspendu. Veuillez contacter le support.");
      }
      
      // Ensure storeId exists
      const updates: any = {};
      if (isPrivileged && data.role !== 'admin') {
        updates.role = 'admin';
      }
      if (!data.storeId) {
        updates.storeId = isPrivileged ? 'main' : user.uid;
      } else if (isPrivileged && data.storeId !== 'main') {
        // Force privileged admins to main store
        updates.storeId = 'main';
      }
      
      if (Object.keys(updates).length > 0) {
        await setDoc(userDocRef, updates, { merge: true });
      }
    } else {
      // Initialize store settings for the new store (only if not 'main' or if 'main' doesn't exist)
      const storeRef = doc(db, 'storeSettings', storeId);
      const storeExists = isPrivileged ? (await getDoc(storeRef)).exists() : false;
      
      if (!storeExists) {
        await setDoc(storeRef, {
          id: storeId,
          name: isPrivileged ? 'Market Pro Global' : 'Ma Boutique',
          address: '',
          phone: '',
          licenseStatus: isPrivileged ? 'active' : 'pending', // Pending for new non-privileged stores
          licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // Default permissions
      const defaultPerms = {
        pos: { read: true, create: true, update: true, delete: true },
        inventory: { read: true, create: true, update: true, delete: true },
        accounting: { read: true, create: true, update: true, delete: true },
        settings: { read: true, create: true, update: true, delete: true },
        reports: { read: true, create: true, update: true, delete: true },
        personnel: { read: true, create: true, update: true, delete: true },
        clients: { read: true, create: true, update: true, delete: true },
        sales: { read: true, create: true, update: true, delete: true }
      };

      await setDoc(userDocRef, {
        uid: user.uid,
        storeId: storeId,
        email: user.email,
        displayName: name || user.displayName || 'Utilisateur',
        role: 'admin',
        permissions: defaultPerms,
        isActive: isPrivileged, // Deactivated for new non-privileged users
        pendingApproval: !isPrivileged,
        createdAt: serverTimestamp()
      });

      if (!isPrivileged) {
        await signOut(auth);
        alert("Votre demande de création de boutique a été envoyée. Un administrateur doit approuver votre accès. Vous recevrez une notification par email.");
        return;
      }
    }

    // Add Connection History Log
    try {
      const logStoreId = storeId;
      let finalStoreName = isPrivileged ? 'Market Pro Global' : 'Ma Boutique';
      try {
        const storeSettingsSnap = await getDoc(doc(db, 'storeSettings', logStoreId));
        if (storeSettingsSnap.exists()) {
          finalStoreName = storeSettingsSnap.data().name || finalStoreName;
        }
      } catch (err) {
        console.warn("Unable to fetch storeSettings for connection log:", err);
      }

      await addDoc(collection(db, 'connectionHistory'), {
        userId: user.uid,
        userEmail: user.email || '',
        userName: name || user.displayName || userDoc.data()?.displayName || 'Utilisateur',
        storeId: logStoreId,
        storeName: finalStoreName,
        userAgent: navigator.userAgent,
        status: 'success',
        timestamp: serverTimestamp()
      });
    } catch (logErr) {
      console.error("Failed to write connection history log:", logErr);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await syncUserProfile(result.user);
    } catch (error: any) {
      console.error("Google Login error:", error);
      if (error.message.includes('suspendu')) {
        alert(error.message);
      } else {
        alert("Erreur lors de la connexion Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isRegistering && !displayName) {
      alert("Veuillez saisir votre nom.");
      return;
    }

    setLoading(true);
    try {
      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName });
        await syncUserProfile(result.user, displayName);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await syncUserProfile(result.user);
      }
    } catch (error: any) {
      const isAuthError = error.code && error.code.startsWith('auth/');
      if (isAuthError) {
        console.warn("Auth failure:", error.code, error.message);
      } else {
        console.error("Email Auth error:", error);
      }

      if (error.message.includes('suspendu')) {
        alert(error.message);
        setLoading(false);
        return;
      }
      let message = "Erreur d'authentification.";
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = "Identifiants incorrects, veuillez ressaisir.";
      } else if (error.code === 'auth/invalid-email') {
        message = "L'adresse email saisie n'est pas valide.";
      } else if (error.code === 'auth/email-already-in-use') {
        message = "Cette adresse email est déjà associée à un compte.";
      } else if (error.code === 'auth/weak-password') {
        message = "Le mot de passe doit contenir au moins 6 caractères.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Trop de tentatives échouées. Compte temporairement bloqué. Réessayez plus tard.";
      }
      
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Veuillez saisir votre adresse email pour réinitialiser le mot de passe.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Lien de réinitialisation envoyé à : " + email);
    } catch (error: any) {
      alert("Erreur lors de l'envoi de l'email de réinitialisation.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] p-6 font-sans relative overflow-hidden">
      {/* Home Button */}
      <Link 
        to="/" 
        className="fixed top-8 left-8 z-50 flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-all group scale-90 md:scale-100"
      >
        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
          <Home size={18} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100 transition-opacity">Retour à l'accueil</span>
      </Link>

      {/* Designer Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-orange-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse delay-1000" />
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '48px 48px' }} 
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full z-10"
      >
        <div className="bg-white/5 backdrop-blur-3xl p-1 pb-1 rounded-[56px] shadow-2xl border border-white/10 overflow-hidden">
          <div className="bg-white p-8 md:p-10 rounded-[52px] shadow-inner relative overflow-hidden">
            {/* Branding Section */}
            <div className="text-center mb-10 relative">
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", damping: 12 }}
                className="w-24 h-24 bg-gradient-to-tr from-orange-500 to-orange-400 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/30 transform rotate-6 overflow-hidden"
              >
                {storeSettings?.logoUrl ? (
                  <img src={storeSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBag size={44} className="text-white" />
                )}
              </motion.div>
              <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight italic">
                {storeSettings?.name || 'MARKET PRO'}
              </h1>
              <div className="flex items-center justify-center gap-3">
                <div className="h-px w-6 bg-slate-200" />
                <p className="text-slate-400 font-bold text-[9px] uppercase tracking-[0.3em]">Smart Business Hub</p>
                <div className="h-px w-6 bg-slate-200" />
              </div>
            </div>

            {/* Auth Form */}
            <form onSubmit={handleEmailAuth} className="space-y-5">
              <AnimatePresence mode="wait">
                {isRegistering && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-2"
                  >
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-5">Nom d'Utilisateur</label>
                    <div className="relative group">
                      <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={18} />
                      <input 
                        type="text" 
                        placeholder="Jean Dupont"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-14 pr-8 py-4 bg-slate-50 border-2 border-transparent rounded-[24px] focus:bg-white focus:border-orange-500/20 focus:ring-4 focus:ring-orange-500/5 transition-all outline-none font-bold text-slate-700 placeholder:text-slate-200 shadow-sm text-sm"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-5">Adresse Email</label>
                <div className="relative group">
                  <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={18} />
                  <input 
                    type="email" 
                    placeholder="manager@market.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-14 pr-8 py-4 bg-slate-50 border-2 border-transparent rounded-[24px] focus:bg-white focus:border-orange-500/20 focus:ring-4 focus:ring-orange-500/5 transition-all outline-none font-bold text-slate-700 placeholder:text-slate-200 shadow-sm text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-5">Mot de Passe</label>
                <div className="relative group">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-14 pr-14 py-4 bg-slate-50 border-2 border-transparent rounded-[24px] focus:bg-white focus:border-orange-500/20 focus:ring-4 focus:ring-orange-500/5 transition-all outline-none font-bold text-slate-700 placeholder:text-slate-200 shadow-sm text-sm"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-orange-500 transition-all p-2 rounded-full hover:bg-white active:scale-90"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {!isRegistering && (
                  <div className="flex justify-end mt-1">
                    <button 
                      type="button" 
                      onClick={handleForgotPassword}
                      className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-orange-500 transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-slate-900 text-white rounded-[28px] font-black uppercase tracking-[0.2em] text-[11px] hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <span>{isRegistering ? 'Initialiser l\'Accès' : 'S\'authentifier'}</span>
                    <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {isGoogleLoginEnabled && (
              <>
                <div className="mt-6 flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Ou continuer avec</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>

                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="mt-6 w-full py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-[24px] font-black uppercase tracking-[0.1em] text-[11px] hover:bg-slate-50 hover:border-slate-200 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <Globe size={18} className="text-blue-500" />
                  <span>Google Cloud Identity</span>
                </button>
              </>
            )}

            {/* View Switcher */}
            {isRegistrationEnabled && (
              <div className="mt-8 text-center pt-6 border-t border-slate-50">
                <button 
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-[10px] font-black text-slate-400 hover:text-orange-600 transition-colors uppercase tracking-[0.2em] pb-1 border-b-2 border-transparent hover:border-orange-500"
                >
                  {isRegistering ? 'Déjà un compte ? Se Connecter' : 'Nouveau membre ? Créer un accès'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2 opacity-40">
           <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-orange-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Système Core v2.4.0-PRO</span>
           </div>
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">© 2026 G-TECH LAB • Tous droits réservés</p>
        </div>
      </motion.div>
    </div>
  );
}
