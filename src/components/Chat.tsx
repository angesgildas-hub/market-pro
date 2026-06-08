import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  MessageSquare, 
  Send, 
  Hash, 
  User, 
  Store, 
  Search, 
  ShieldAlert, 
  Megaphone, 
  Trash2, 
  Edit, 
  Check, 
  X,
  Plus,
  Compass,
  Paperclip,
  File,
  Download,
  Image,
  ChevronLeft
} from 'lucide-react';
import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  updateDoc, 
  deleteDoc, 
  where 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { AppContext } from '../App';
import { motion, AnimatePresence } from 'motion/react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Chat Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ChatMessage {
  id: string;
  storeId: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderRole: string;
  message: string;
  timestamp: any;
  type: 'store' | 'broadcast' | 'direct';
  recipientId?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
  attachmentData?: string;
}

interface ChatUser {
  uid: string;
  storeId: string;
  displayName: string;
  email: string;
  role: string;
}

interface ChatStore {
  id: string;
  name: string;
}

export default function Chat() {
  const { userProfile, settings, language } = useContext(AppContext);
  const currentUser = auth.currentUser;
  const isSuperAdmin = currentUser?.email === 'anges.gildas@gmail.com' || currentUser?.email === 'gildas@gmail.com';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [stores, setStores] = useState<ChatStore[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection states
  // We can select: Group channels, User Direct Messages, or Store General Chats (for superadmin)
  const [activeTab, setActiveTab] = useState<'store' | 'broadcast' | 'direct'>('store');
  const [activeRecipient, setActiveRecipient] = useState<ChatUser | null>(null);
  const [activeStoreChat, setActiveStoreChat] = useState<ChatStore | null>(null);

  // Message compose states
  const [inputText, setInputText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File loading/attachment states
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    type: string;
    size: number;
    base64: string;
  } | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<{ src: string; name: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // File handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) { // 1 MB limit
      setErrorMessage("La taille du fichier dépasse la limite autorisée de 1 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        type: file.type,
        size: file.size,
        base64: reader.result as string
      });
      setErrorMessage(null);
    };
    reader.onerror = () => {
      setErrorMessage("Erreur lors de la lecture du fichier.");
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
      setErrorMessage("La taille du fichier dépasse la limite autorisée de 1 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        type: file.type,
        size: file.size,
        base64: reader.result as string
      });
      setErrorMessage(null);
    };
    reader.onerror = () => {
      setErrorMessage("Erreur lors de l'importation du fichier.");
    };
    reader.readAsDataURL(file);
  };

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Read stores (if Super Admin)
  useEffect(() => {
    if (!isSuperAdmin) return;
    const q = query(collection(db, 'storeSettings'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.id
      }));
      setStores(list);
    }, (err) => {
      console.error("Error reading stores settings", err);
    });
    return () => unsubscribe();
  }, [isSuperAdmin]);

  // Read users
  useEffect(() => {
    if (!currentUser) return;
    const storeIdToUse = userProfile?.storeId || settings?.id;
    if (!isSuperAdmin && !storeIdToUse) return;

    const unsubscribes: (() => void)[] = [];

    if (isSuperAdmin) {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snap) => {
        const list = snap.docs.map(doc => {
          const data = doc.data();
          return {
            uid: doc.id,
            storeId: data.storeId || '',
            displayName: data.displayName || 'Utilisateur',
            email: data.email || '',
            role: data.role || 'cashier'
          } as ChatUser;
        });
        setUsers(list);
      }, (err) => {
        console.error("Error reading user profiles for superadmin:", err);
      });
      unsubscribes.push(unsubscribe);
    } else {
      let storeUsersList: ChatUser[] = [];
      let superAdminsList: ChatUser[] = [];

      const handleMergeUsers = () => {
        const seen = new Set<string>();
        const merged: ChatUser[] = [];
        [...storeUsersList, ...superAdminsList].forEach(u => {
          if (!seen.has(u.uid)) {
            seen.add(u.uid);
            merged.push(u);
          }
        });
        setUsers(merged);
      };

      const qStore = query(collection(db, 'users'), where('storeId', '==', storeIdToUse));
      const unsubStore = onSnapshot(qStore, (snap) => {
        storeUsersList = snap.docs.map(doc => {
          const data = doc.data();
          return {
            uid: doc.id,
            storeId: data.storeId || '',
            displayName: data.displayName || 'Utilisateur',
            email: data.email || '',
            role: data.role || 'cashier'
          } as ChatUser;
        });
        handleMergeUsers();
      }, (err) => {
        console.error("Error reading store user profiles", err);
      });
      unsubscribes.push(unsubStore);

      // Only boutique admins (role === 'admin') can view/message super-admins
      if (userProfile?.role === 'admin') {
        const qSuper = query(collection(db, 'users'), where('role', '==', 'super-admin'));
        const unsubSuper = onSnapshot(qSuper, (snap) => {
          superAdminsList = snap.docs.map(doc => {
            const data = doc.data();
            return {
              uid: doc.id,
              storeId: 'global',
              displayName: data.displayName || 'Super Admin',
              email: data.email || '',
              role: 'super-admin'
            } as ChatUser;
          });
          
          // Ensure we have at least virtual entries in case query returns empty
          if (superAdminsList.length === 0) {
            superAdminsList = [
              {
                uid: 'superadmin_gildas',
                storeId: 'global',
                displayName: 'Gildas (Super Admin)',
                email: 'gildas@gmail.com',
                role: 'super-admin'
              },
              {
                uid: 'superadmin_anges',
                storeId: 'global',
                displayName: 'Anges Gildas (Super Admin)',
                email: 'anges.gildas@gmail.com',
                role: 'super-admin'
              }
            ];
          }
          handleMergeUsers();
        }, (err) => {
          console.warn("Could not query super admins, using fallback:", err);
          superAdminsList = [
            {
              uid: 'superadmin_gildas',
              storeId: 'global',
              displayName: 'Gildas (Super Admin)',
              email: 'gildas@gmail.com',
              role: 'super-admin'
            },
            {
              uid: 'superadmin_anges',
              storeId: 'global',
              displayName: 'Anges Gildas (Super Admin)',
              email: 'anges.gildas@gmail.com',
              role: 'super-admin'
            }
          ];
          handleMergeUsers();
        });
        unsubscribes.push(unsubSuper);
      }
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [currentUser, userProfile?.storeId, userProfile?.role, settings?.id, isSuperAdmin]);

  // Subscribe to Chat messages in real time
  useEffect(() => {
    if (!currentUser) return;

    // Local store ID
    const storeIdToUse = userProfile?.storeId || settings?.id || 'none';

    // If not super admin and we don't have storeId yet, wait for it.
    if (!isSuperAdmin && storeIdToUse === 'none') {
      return;
    }

    const unsubscribes: (() => void)[] = [];

    if (isSuperAdmin) {
      // Super admin can get everything in one single query
      const q = query(collection(db, 'chatMessages'), orderBy('timestamp', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ChatMessage));
        setMessages(list);
      }, (err) => {
        console.error("SuperAdmin subscription failed:", err);
        handleFirestoreError(err, OperationType.GET, 'chatMessages');
      });
      return () => unsub();
    } else {
      // Regular user: combine multiple restricted secure streams to comply with granular Security Rules
      let broadcastMsgs: ChatMessage[] = [];
      let storeMsgs: ChatMessage[] = [];
      let sentDMs: ChatMessage[] = [];
      let receivedDMs: ChatMessage[] = [];

      const handleUpdate = () => {
        const mergedMap: Record<string, ChatMessage> = {};
        [...broadcastMsgs, ...storeMsgs, ...sentDMs, ...receivedDMs].forEach(m => {
          mergedMap[m.id] = m;
        });
        const mergedList = Object.values(mergedMap);
        mergedList.sort((a, b) => {
          const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
          const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
          return tA - tB;
        });
        setMessages(mergedList);
      };

      // 1. Broadcast announcements
      const q1 = query(
        collection(db, 'chatMessages'),
        where('type', '==', 'broadcast')
      );
      unsubscribes.push(onSnapshot(q1, (snap) => {
        broadcastMsgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
        handleUpdate();
      }, (err) => {
        console.warn("Query1 Broadcast failed:", err);
      }));

      // 2. Active Store discussion channel
      const q2 = query(
        collection(db, 'chatMessages'),
        where('storeId', '==', storeIdToUse),
        where('type', '==', 'store')
      );
      unsubscribes.push(onSnapshot(q2, (snap) => {
        storeMsgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
        handleUpdate();
      }, (err) => {
        console.warn("Query2 StoreChat failed:", err);
      }));

      // 3. Sent Direct Messages
      const q3 = query(
        collection(db, 'chatMessages'),
        where('type', '==', 'direct'),
        where('senderId', '==', currentUser.uid)
      );
      unsubscribes.push(onSnapshot(q3, (snap) => {
        sentDMs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
        handleUpdate();
      }, (err) => {
        console.warn("Query3 Sent DMs failed:", err);
      }));

      // 4. Received Direct Messages
      const q4 = query(
        collection(db, 'chatMessages'),
        where('type', '==', 'direct'),
        where('recipientId', '==', currentUser.uid)
      );
      unsubscribes.push(onSnapshot(q4, (snap) => {
        receivedDMs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
        handleUpdate();
      }, (err) => {
        console.warn("Query4 Received DMs failed:", err);
      }));
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [currentUser, isSuperAdmin, userProfile?.storeId, settings?.id]);

  // Get current store id to attach message to
  const localStoreId = userProfile?.storeId || settings?.id || 'none';

  // Filter messages based on active selection
  const filteredMessages = messages.filter(msg => {
    // 1. Broadcast channel
    if (activeTab === 'broadcast') {
      return msg.type === 'broadcast';
    }
    
    // 2. Direct message
    if (activeTab === 'direct' && activeRecipient) {
      return msg.type === 'direct' && (
        (msg.senderId === currentUser?.uid && msg.recipientId === activeRecipient.uid) ||
        (msg.senderId === activeRecipient.uid && msg.recipientId === currentUser?.uid)
      );
    }
    
    // 3. Store Group Chat (Général local store channel)
    if (activeTab === 'store') {
      if (isSuperAdmin && activeStoreChat) {
        // Superadmin viewing specific store's general channel
        return msg.type === 'store' && msg.storeId === activeStoreChat.id;
      }
      // General channel of my own store
      return msg.type === 'store' && msg.storeId === localStoreId;
    }

    return false;
  });

  // Users relevant to the view
  const myStoreUsers = users.filter(u => {
    if (u.uid === currentUser?.uid) return false; // hide myself
    if (isSuperAdmin) return true; // super admin can DM anyone
    
    // Is target super admin?
    const isTargetSuperAdmin = u.email === 'gildas@gmail.com' || u.email === 'anges.gildas@gmail.com' || u.role === 'super-admin' || u.storeId === 'global';
    if (isTargetSuperAdmin) {
      // Only boutique admins (role === 'admin') can see/message the super-admin
      return userProfile?.role === 'admin';
    }
    
    return u.storeId === localStoreId; // normal users can only DM their teammates
  });

  // Handlers
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || (!inputText.trim() && !selectedFile)) return;

    setErrorMessage(null);
    try {
      const payload: any = {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || 'Admin',
        senderEmail: currentUser.email || '',
        senderRole: isSuperAdmin ? 'super-admin' : (userProfile?.role || 'cashier'),
        message: inputText.trim() || `Fichier envoyé : ${selectedFile?.name || ''}`,
        timestamp: serverTimestamp(),
        type: activeTab,
      };

      if (selectedFile) {
        payload.attachmentName = selectedFile.name;
        payload.attachmentType = selectedFile.type;
        payload.attachmentSize = selectedFile.size;
        payload.attachmentData = selectedFile.base64;
      }

      if (activeTab === 'broadcast') {
        payload.storeId = 'broadcast';
      } else if (activeTab === 'direct') {
        if (!activeRecipient) return;
        
        // Prevent non-admin users from messaging super admins
        const isTargetSuperAdmin = activeRecipient.email === 'gildas@gmail.com' || activeRecipient.email === 'anges.gildas@gmail.com' || activeRecipient.role === 'super-admin' || activeRecipient.storeId === 'global';
        if (isTargetSuperAdmin && userProfile?.role !== 'admin' && !isSuperAdmin) {
          setErrorMessage("Seul l'administrateur de la boutique est autorisé à envoyer des messages au Super Administrateur.");
          return;
        }

        payload.storeId = localStoreId;
        payload.recipientId = activeRecipient.uid;
      } else {
        // 'store' general channel
        payload.storeId = isSuperAdmin && activeStoreChat ? activeStoreChat.id : localStoreId;
      }

      await addDoc(collection(db, 'chatMessages'), payload);
      setInputText('');
      setSelectedFile(null);
    } catch (err: any) {
      console.error("Error creating chat message", err);
      setErrorMessage("Impossible d'envoyer le message. Droits d'écriture requis.");
    }
  };

  const handleUpdateMessage = async (msgId: string) => {
    if (!editText.trim()) return;
    try {
      const docRef = doc(db, 'chatMessages', msgId);
      await updateDoc(docRef, {
        message: editText.trim(),
        updatedAt: serverTimestamp()
      });
      setEditingMessageId(null);
      setEditText('');
    } catch (err) {
      console.error("Error updating message", err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm("Voulez-vous supprimer ce message ?")) return;
    try {
      await deleteDoc(doc(db, 'chatMessages', msgId));
    } catch (err) {
      console.error("Error deleting message", err);
    }
  };

  // Helper to resolve role badges
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super-admin':
        return 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-red-200';
      case 'admin':
        return 'bg-orange-500 text-white border-orange-200';
      case 'manager':
        return 'bg-[#151619] text-orange-400 border-gray-700';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  // Switch tab trigger helpers
  const selectStoreGeneral = () => {
    setActiveTab('store');
    setActiveRecipient(null);
    setShowMobileSidebar(false);
  };

  const selectBroadcast = () => {
    setActiveTab('broadcast');
    setActiveRecipient(null);
    setActiveStoreChat(null);
    setShowMobileSidebar(false);
  };

  const selectDirectMessage = (user: ChatUser) => {
    setActiveTab('direct');
    setActiveRecipient(user);
    setActiveStoreChat(null);
    setShowMobileSidebar(false);
  };

  return (
    <div id="integrated-chat-system" className="bg-white border text-normal-gray border-slate-200 rounded-2xl md:rounded-[32px] overflow-hidden flex h-[calc(100vh-8rem)] md:h-[calc(100vh-12rem)] shadow-2xl relative">
      
      {/* LEFT SIDEBAR: Channels & Direct Messages */}
      <div className={`w-full lg:w-80 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 h-full ${showMobileSidebar ? 'flex' : 'hidden lg:flex'}`}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-orange-500 animate-pulse" />
            <h2 className="text-sm font-black uppercase text-slate-800 tracking-wider">Messagerie Interne</h2>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input 
              type="text"
              placeholder="Rechercher membre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:border-orange-500 transition-all font-sans"
            />
          </div>
        </div>

        {/* Sidebar Scrollable Sections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Section 1: Public Channels */}
          <div>
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-3 mb-2">Canaux Généraux</h3>
            <div className="space-y-1">
              {/* General Local Chat button */}
              <button 
                onClick={selectStoreGeneral}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all ${
                  activeTab === 'store' && !activeStoreChat ? 'bg-orange-500 text-white font-extrabold shadow-lg shadow-orange-500/10' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 font-bold'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Hash size={14} />
                  <span>Discussion Générale</span>
                </div>
                {!isSuperAdmin && (
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                    activeTab === 'store' && !activeStoreChat ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {settings?.name || 'Local'}
                  </span>
                )}
              </button>

              {/* Broadcast Announcements button */}
              <button 
                onClick={selectBroadcast}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all ${
                  activeTab === 'broadcast' ? 'bg-orange-500 text-white font-extrabold shadow-lg shadow-orange-500/10' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 font-bold'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Megaphone size={14} />
                  <span>Annonces Système</span>
                </div>
                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                  activeTab === 'broadcast' ? 'bg-white/20 text-white' : 'bg-orange-55 shadow-sm text-orange-600 border border-orange-100 bg-orange-50'
                }`}>
                  Global
                </span>
              </button>
            </div>
          </div>

          {/* Section 2: Active Super Admin Store Rooms (Super Admin only) */}
          {isSuperAdmin && (
            <div>
              <div className="flex items-center gap-1.5 justify-between px-3 mb-2">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Fils de Discussions Boutiques
                </h3>
                <Compass size={11} className="text-orange-500" />
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {stores.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic px-3">Aucune boutique disponible</p>
                ) : (
                  stores.map(st => {
                    const isSelected = activeTab === 'store' && activeStoreChat?.id === st.id;
                    return (
                      <button
                        key={`stores-chat-channel-${st.id}`}
                        onClick={() => {
                          setActiveTab('store');
                          setActiveStoreChat(st);
                          setActiveRecipient(null);
                          setShowMobileSidebar(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs transition-all ${
                          isSelected ? 'bg-slate-900 text-white font-black' : 'text-slate-600 hover:bg-slate-200/50 font-bold'
                        }`}
                      >
                        <Store size={12} className={isSelected ? 'text-orange-400' : 'text-slate-400'} />
                        <span className="truncate flex-1">{st.name}</span>
                        <span className="text-[7px] text-slate-400 font-mono scale-90">GO</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Section 3: Members DMs list */}
          <div>
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-3 mb-2">Membres & Messages Directs</h3>
            <div className="space-y-1">
              {myStoreUsers
                .filter(u => u.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(u => {
                  const isSelected = activeTab === 'direct' && activeRecipient?.uid === u.uid;
                  return (
                    <button
                      key={`user-dm-${u.uid}`}
                      onClick={() => selectDirectMessage(u)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-left text-xs transition-all ${
                        isSelected ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 font-black text-[10px] shrink-0 border border-orange-200">
                        {u.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 truncate">
                        <p className="font-extrabold truncate leading-tight">{u.displayName}</p>
                        <p className="text-[8px] text-slate-400 truncate leading-none capitalize">{u.role}</p>
                      </div>
                      {isSuperAdmin && (
                        <span className="text-[7px] font-mono text-gray-400 px-1 py-0.2 bg-slate-100 border rounded font-black max-w-[50px] truncate">
                          {u.storeId.slice(-4)}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

        </div>
      </div>

      {/* RIGHT MESSAGE PANE */}
      <div className={`flex-1 flex flex-col h-full bg-slate-100 relative ${!showMobileSidebar ? 'flex' : 'hidden lg:flex'}`}>
        
        {/* Chat Pane Header */}
        <div className="h-20 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back button for mobile */}
            <button
              type="button"
              onClick={() => setShowMobileSidebar(true)}
              className="lg:hidden p-2 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100 active:scale-95 transition-all shrink-0"
              title="Retour aux conversations"
            >
              <ChevronLeft size={20} />
            </button>

            {activeTab === 'broadcast' ? (
              <>
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 text-white flex items-center justify-center shadow-md shrink-0">
                  <Megaphone size={16} className="md:size-[18px]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-955 text-xs md:text-sm leading-tight truncate">
                    Annonces Système
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-bold text-orange-500 italic truncate">● Chaîne globale d'info</p>
                </div>
              </>
            ) : activeTab === 'direct' && activeRecipient ? (
              <>
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center border border-orange-200 font-black shrink-0 text-xs md:text-sm">
                  {activeRecipient.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-955 text-xs md:text-sm leading-tight truncate">
                    {activeRecipient.displayName}
                  </h3>
                  <p className="text-[9px] md:text-[10px] text-slate-400 capitalize font-medium leading-none truncate mt-0.5">
                    Direct • {activeRecipient.role}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-slate-100 border text-slate-700 flex items-center justify-center shadow-sm shrink-0">
                  <Store size={15} className="md:size-[18px]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-955 text-xs md:text-sm leading-tight truncate">
                    Discussion Générale
                  </h3>
                  <p className="text-[9px] md:text-[10px] text-slate-400 font-bold truncate mt-0.5">
                    Salon: <span className="text-orange-500">{activeStoreChat ? activeStoreChat.name : (settings?.name || "Boutique")}</span>
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            {isSuperAdmin && (
              <span className="px-2 py-1 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <ShieldAlert size={10} /> Mode Super Admin
              </span>
            )}
          </div>
        </div>

        {/* Messaging Area */}
        <div 
          className={`flex-1 overflow-y-auto p-3 md:p-6 space-y-3.5 md:space-y-4 relative transition-all ${isDragging ? 'bg-orange-50/40 opacity-80' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-orange-500/10 backdrop-blur-[2.5px] flex flex-col items-center justify-center border-4 border-dashed border-orange-400 rounded-3xl z-10 p-6 pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-orange-500 shadow-xl mb-3 animate-bounce">
                <Paperclip size={24} />
              </div>
              <p className="text-sm font-black text-slate-800 uppercase tracking-widest">Glissez vos fichiers ici</p>
              <p className="text-[11px] font-bold text-slate-400 mt-1">Limite autorisée : 1 Mo par fichier</p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {filteredMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-60 px-6">
                <MessageSquare size={36} className="text-slate-350 mb-3" />
                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Aucun message pour l'instant</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[280px] font-medium leading-normal">
                  {activeTab === 'broadcast' 
                    ? "Les annonces publiées par le Super Administrateur s'afficheront ici."
                    : "Entamez la conversation en rédigeant votre premier message ou en y glissant un fichier."}
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isMine = msg.senderId === currentUser?.uid;
                const formattedTime = msg.timestamp?.toDate()?.toLocaleTimeString('fr-FR', {
                  hour: '2-digit', minute: '2-digit'
                }) || 'Envoi...';

                const formattedDate = msg.timestamp?.toDate()?.toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'short'
                });

                return (
                  <motion.div 
                    key={`chat-msg-${msg.id}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-1.5 md:gap-3.5 max-w-[95%] sm:max-w-[85%] md:max-w-[80%] ${isMine ? 'ml-auto flex-row-reverse' : ''}`}
                  >
                    {/* User initial avatar */}
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl shrink-0 font-bold flex items-center justify-center text-white bg-slate-400 shadow-md transform text-[10px] md:text-[11px] uppercase tracking-wider">
                      {msg.senderName.slice(0, 2)}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      {/* Message Meta Info */}
                      <div className={`flex flex-wrap items-center gap-1.5 ${isMine ? 'justify-end md:justify-items-end' : ''}`}>
                        <span className="text-xs font-black text-slate-800 max-w-[120px] truncate">{msg.senderName}</span>
                        <span className={`text-[7px] font-black leading-none uppercase px-1.5 py-0.5 rounded-full border shrink-0 ${getRoleBadge(msg.senderRole)}`}>
                          {msg.senderRole === 'super-admin' ? 'Super Admin' : msg.senderRole}
                        </span>
                        <span className="text-[8px] text-slate-400 font-mono shrink-0">{formattedDate ? `${formattedDate}, ` : ''}{formattedTime}</span>
                      </div>

                      {/* Msg text bubble */}
                      <div className={`p-3 md:p-4 rounded-2xl md:rounded-3xl text-xs relative group border shadow-sm ${
                        isMine 
                          ? 'bg-orange-500 text-white border-orange-500/10 rounded-tr-none' 
                          : 'bg-white text-slate-800 border-slate-200/80 rounded-tl-none'
                      }`}>
                        {editingMessageId === msg.id ? (
                          <div className="space-y-2 min-w-[200px]">
                            <textarea 
                              className="w-full text-xs p-2 rounded-xl bg-slate-50 border outline-none text-slate-900 border-slate-300 font-sans focus:border-orange-400 font-medium"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                            <div className="flex gap-1.5 justify-end">
                              <button 
                                onClick={() => {
                                  setEditingMessageId(null);
                                  setEditText('');
                                }}
                                className="px-2 py-1 text-[8px] bg-slate-100 hover:bg-slate-200 rounded font-black text-slate-600 uppercase"
                              >
                                Annuler
                              </button>
                              <button 
                                onClick={() => handleUpdateMessage(msg.id)}
                                className="px-2 py-1 text-[8px] bg-orange-600 hover:bg-orange-700 text-white rounded font-black uppercase"
                              >
                                Sauver
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Attachment rendering */}
                            {msg.attachmentData && msg.attachmentType?.startsWith('image/') && (
                              <div className="mb-2.5 rounded-2xl overflow-hidden border border-slate-250/50 max-w-[280px]">
                                <img 
                                  src={msg.attachmentData} 
                                  alt={msg.attachmentName || 'Attachment'} 
                                  className="max-h-56 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                                  onClick={() => setFullscreenImage({ src: msg.attachmentData!, name: msg.attachmentName || 'Image' })}
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}

                            {msg.attachmentData && !msg.attachmentType?.startsWith('image/') && (
                              <div className={`mb-2.5 p-3 rounded-2xl flex items-center justify-between gap-3 border ${
                                isMine 
                                  ? 'bg-[#c2410c] border-orange-400/20 text-white' 
                                  : 'bg-slate-50 border-slate-200 text-slate-800'
                              }`}>
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className={`p-2.5 rounded-xl shrink-0 ${isMine ? 'bg-[#ea580c] text-white' : 'bg-slate-200 text-slate-600'}`}>
                                    <File size={16} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-extrabold text-[11px] truncate leading-tight">{msg.attachmentName}</p>
                                    <p className={`text-[9px] leading-tight mt-0.5 ${isMine ? 'text-orange-200' : 'text-slate-400'}`}>
                                      {msg.attachmentSize ? `${(msg.attachmentSize / 1024).toFixed(1)} KB` : 'Fichier'}
                                    </p>
                                  </div>
                                </div>
                                
                                <a 
                                  href={msg.attachmentData}
                                  download={msg.attachmentName || 'download'}
                                  className={`p-2 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                                    isMine 
                                      ? 'bg-transparent text-white border-white/20 hover:bg-white/10' 
                                      : 'bg-white text-slate-700 border-slate-250 hover:bg-slate-55'
                                  }`}
                                  title="Télécharger"
                                >
                                  <Download size={13} />
                                </a>
                              </div>
                            )}

                            {(!msg.message.startsWith('Fichier envoyé :') || !msg.attachmentData) && (
                              <p className="whitespace-pre-wrap font-medium leading-relaxed">{msg.message}</p>
                            )}
                            
                            {/* Message actions (Edit / Delete) for owner */}
                            {(isMine || isSuperAdmin) && (
                              <div className={`absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all flex gap-1 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-slate-200 shadow-sm ${
                                isMine ? '-translate-x-3' : 'translate-x-3'
                              }`}>
                                {isMine && (
                                  <button 
                                    onClick={() => {
                                      setEditingMessageId(msg.id);
                                      setEditText(msg.message);
                                    }}
                                    className="p-1 hover:text-orange-500 text-slate-400 transition-colors"
                                    title="Modifier"
                                  >
                                    <Edit size={10} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="p-1 hover:text-red-500 text-slate-400 transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input Composer Panel */}
        <div className="p-3 md:p-6 bg-white border-t border-slate-200 shrink-0">
          {activeTab === 'broadcast' && !isSuperAdmin ? (
            <div className="text-center py-2.5 bg-orange-50 border border-orange-100 rounded-2xl text-[9px] font-black uppercase tracking-widest text-orange-600">
              🔒 Seul le Super Administrateur peut poster des messages globaux.
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="space-y-2">
              {setSelectedFile && selectedFile && (
                <div className="flex items-center justify-between p-2.5 md:p-3.5 bg-orange-50/50 border border-orange-100 rounded-xl md:rounded-2xl mb-2 text-xs">
                  <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
                    {selectedFile.type.startsWith('image/') ? (
                      <img 
                        src={selectedFile.base64} 
                        alt="Preview" 
                        className="w-8 h-8 md:w-10 md:h-10 object-cover rounded-lg md:rounded-xl border border-orange-200/50 shrink-0" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-100 border border-slate-200 flex items-center justify-center rounded-lg md:rounded-xl text-slate-500 shrink-0">
                        <File size={14} className="md:size-[16px]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-800 truncate text-[10px] md:text-[11px] max-w-[150px] md:max-w-[200px]">{selectedFile.name}</p>
                      <p className="text-[8px] md:text-[9px] text-slate-450">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedFile(null)}
                    className="p-1 hover:bg-slate-205 rounded-full text-slate-500 hover:text-slate-700 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="flex gap-2 md:gap-3 items-center">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all active:scale-95 shrink-0 shadow-sm"
                  title="Ajouter un fichier (Tous types)"
                >
                  <Paperclip size={15} className="md:size-[16px]" />
                </button>
                
                <input 
                  type="text"
                  placeholder="Rédigez votre message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 px-3 py-2.5 md:px-4.5 md:py-3.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl text-[11px] md:text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-orange-500 transition-all font-sans"
                />
                <button 
                  type="submit"
                  disabled={!inputText.trim() && !selectedFile}
                  className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all shadow-md shrink-0 ${
                    (inputText.trim() || selectedFile) 
                      ? 'bg-orange-500 hover:bg-orange-600 active:scale-95 text-white' 
                      : 'bg-slate-100 text-slate-450 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <Send size={15} />
                </button>
              </div>
              {errorMessage && (
                <p className="text-[10px] font-bold text-red-500 text-left mt-1 animate-pulse">● {errorMessage}</p>
              )}
            </form>
          )}
        </div>

      </div>

      {/* FULLSCREEN IMAGE LIGHTBOX MODAL */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 z-50 pointer-events-auto"
            onClick={() => setFullscreenImage(null)}
          >
            <button 
              className="absolute top-6 right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-transform active:scale-95 shadow-lg"
              onClick={() => setFullscreenImage(null)}
            >
              <X size={20} />
            </button>

            <motion.div 
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 15 }}
              className="max-w-4xl max-h-[80vh] flex flex-col items-center gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={fullscreenImage.src} 
                alt={fullscreenImage.name} 
                className="max-w-full max-h-[72vh] rounded-2xl shadow-2xl object-contain border border-white/10" 
                referrerPolicy="no-referrer"
              />
              <div className="flex items-center gap-4">
                <span className="text-white text-xs font-black bg-black/40 px-4 py-2 rounded-xl backdrop-blur border border-white/10 shrink max-w-[300px] truncate">
                  {fullscreenImage.name}
                </span>
                <a 
                  href={fullscreenImage.src} 
                  download={fullscreenImage.name}
                  className="bg-orange-500 hover:bg-orange-600 font-extrabold text-xs text-white px-5 py-2 rounded-xl shadow-lg flex items-center gap-2 transition"
                >
                  <Download size={14} /> Télécharger
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
