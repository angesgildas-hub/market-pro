import { useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Check, 
  Trash2, 
  Clock, 
  CheckCircle, 
  X, 
  XCircle, 
  ShoppingCart, 
  PlusCircle, 
  MinusCircle, 
  User, 
  FileText, 
  ChevronRight,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy, getDocs, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Product, Client } from '../types';
import { AppContext } from '../App';
import { useNavigate } from 'react-router-dom';

interface CommandeItem {
  productId: string;
  name: string;
  quantity: number;
  priceAtSale: number;
  total: number;
}

interface Commande {
  id: string;
  storeId: string;
  timestamp: any;
  createdBy: string;
  createdByName?: string;
  items: CommandeItem[];
  totalAmount: number;
  status: 'pending' | 'served' | 'completed' | 'cancelled';
  clientName?: string;
  clientId?: string;
  notes?: string;
  number: string;
}

export default function Commandes() {
  const navigate = useNavigate();
  const { userProfile, hasPermission } = useContext(AppContext);
  
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'served' | 'completed' | 'cancelled'>('all');
  
  // Modal state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchText, setClientSearchText] = useState('');
  const [productSearchText, setProductSearchText] = useState('');
  const [orderCart, setOrderCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [customClientName, setCustomClientName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  // Load orders, products & clients
  useEffect(() => {
    if (!userProfile?.storeId) return;

    // Sub to orders
    const qc = query(
      collection(db, 'commandes'),
      where('storeId', '==', userProfile.storeId),
      orderBy('timestamp', 'desc')
    );
    const unsubscribeCommandes = onSnapshot(qc, (snapshot) => {
      setCommandes(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Commande)));
    }, (error) => {
      console.error("Error loading orders:", error);
    });

    // Sub to products
    const qp = query(
      collection(db, 'products'),
      where('storeId', '==', userProfile.storeId),
      orderBy('name')
    );
    const unsubscribeProducts = onSnapshot(qp, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product)));
    }, (error) => {
      console.error("Error loading products:", error);
    });

    // Sub to clients
    const qcl = query(
      collection(db, 'clients'),
      where('storeId', '==', userProfile.storeId)
    );
    const unsubscribeClients = onSnapshot(qcl, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Client)));
    }, (error) => {
      console.error("Error loading clients:", error);
    });

    return () => {
      unsubscribeCommandes();
      unsubscribeProducts();
      unsubscribeClients();
    };
  }, [userProfile?.storeId]);

  // Filters
  const filteredCommandes = commandes.filter(cmd => {
    if (activeTab === 'all') return true;
    return cmd.status === activeTab;
  });

  // Cart operations
  const addToCart = (product: Product) => {
    setOrderCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setOrderCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setOrderCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const orderTotal = orderCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Save new order to Firebase
  const handleSaveOrder = async () => {
    if (orderCart.length === 0) {
      alert("Veuillez ajouter au moins un produit à la commande.");
      return;
    }
    
    setIsSaving(true);
    try {
      const randomId = Math.floor(1000 + Math.random() * 9000);
      const cmdNumber = `CMD-${randomId}`;

      const itemsToSave: CommandeItem[] = orderCart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        priceAtSale: item.product.price,
        total: item.product.price * item.quantity
      }));

      const newOrderData = {
        storeId: userProfile.storeId,
        timestamp: serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'cashier',
        createdByName: userProfile?.displayName || auth.currentUser?.displayName || 'Personnel',
        items: itemsToSave,
        totalAmount: orderTotal,
        status: 'pending',
        clientName: selectedClient ? selectedClient.name : (customClientName || 'Client Passager'),
        clientId: selectedClient ? selectedClient.id : null,
        notes: orderNotes,
        number: cmdNumber
      };

      await addDoc(collection(db, 'commandes'), newOrderData);

      // Reset
      setOrderCart([]);
      setSelectedClient(null);
      setCustomClientName('');
      setOrderNotes('');
      setIsNewOrderModalOpen(false);
    } catch (error) {
      console.error("Error creating order:", error);
      alert("Erreur lors de la création de la commande.");
    } finally {
      setIsSaving(false);
    }
  };

  // Serve the order (Fait passer de 'pending' à 'served')
  const handleServeOrder = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'commandes', orderId);
      await updateDoc(orderRef, { status: 'served' });
    } catch (error) {
      console.error("Error serving order:", error);
    }
  };

  // Cancel order
  const handleCancelOrder = async (orderId: string) => {
    if (confirm("Êtes-vous sûr de vouloir annuler cette commande ?")) {
      try {
        const orderRef = doc(db, 'commandes', orderId);
        await updateDoc(orderRef, { status: 'cancelled' });
      } catch (error) {
        console.error("Error cancelling order:", error);
      }
    }
  };

  // Send to Point of Sale (POS)
  const handleSendToPOS = (order: Commande) => {
    // Generate shopping cart structure compliant with POS CartItem
    const posCartItems = order.items.map(item => {
      // Find full product details from products state if possible
      const fullProduct = products.find(p => p.id === item.productId);
      return {
        id: Math.random().toString(36).substr(2, 9),
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        priceAtSale: item.priceAtSale,
        total: item.total,
        product: fullProduct || {
          id: item.productId,
          storeId: order.storeId,
          name: item.name,
          price: item.priceAtSale,
          stock: 99,
          unit: 'pcs'
        } as any
      };
    });

    // Save to localStorage so Pos.tsx can extract and auto-populate
    const payload = {
      id: order.id,
      items: posCartItems,
      totalAmount: order.totalAmount,
      client: order.clientId ? { id: order.clientId, name: order.clientName } : (order.clientName ? { name: order.clientName } : null),
      number: order.number
    };

    localStorage.setItem('active-preloaded-order', JSON.stringify(payload));
    
    // Redirect to Point of Sale
    navigate('/pos');
  };

  // Filtered lists for modal dropdown selector
  const productFilter = products.filter(p => 
    p.name.toLowerCase().includes(productSearchText.toLowerCase()) || 
    (p.barcode && p.barcode.includes(productSearchText))
  );

  const clientFilter = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearchText.toLowerCase()) || 
    (c.phone && c.phone.includes(clientSearchText))
  );

  return (
    <div className="flex-1 space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="text-orange-500" size={36} />
            Gestion des Commandes
          </h1>
          <p className="text-slate-500 font-medium">
            Saisissez les commandes, préparez les articles et envoyez-les en caisse pour facturation.
          </p>
        </div>

        <button 
          onClick={() => setIsNewOrderModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white font-bold py-4 px-6 rounded-3xl shadow-lg shadow-orange-500/20"
        >
          <Plus size={20} />
          <span>Nouvelle Commande</span>
        </button>
      </div>

      {/* Tabs / Filter Nav */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-3xl w-fit">
        {(['all', 'pending', 'served', 'completed', 'cancelled'] as const).map((tab) => {
          const count = tab === 'all' 
            ? commandes.length 
            : commandes.filter(c => c.status === tab).length;
          
          let tabLabel = "Tous";
          if (tab === 'pending') tabLabel = "En cours";
          if (tab === 'served') tabLabel = "Préparées";
          if (tab === 'completed') tabLabel = "Finalisées";
          if (tab === 'cancelled') tabLabel = "Annulées";

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all
                ${activeTab === tab 
                  ? 'bg-white text-orange-500 shadow-md shadow-black/5' 
                  : 'text-slate-500 hover:text-slate-900'}
              `}
            >
              <span>{tabLabel}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === tab ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders Grid */}
      {filteredCommandes.length === 0 ? (
        <div className="bg-white rounded-[40px] border border-gray-100 p-16 text-center shadow-xl flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-slate-50 rounded-[30px] flex items-center justify-center text-slate-400 mb-6">
            <ClipboardList size={36} />
          </div>
          <h3 className="text-xl font-bold text-slate-700">Aucune commande trouvée</h3>
          <p className="text-slate-400 max-w-sm mt-2 text-sm leading-relaxed">
            Il n'y a pas de commandes correspondant à ce statut. Utilisez le bouton ci-dessus pour lancer une nouvelle commande.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCommandes.map((order) => {
            const dateObj = order.timestamp?.toDate ? order.timestamp.toDate() : new Date();
            
            // Status specifics
            let statusText = "En attente";
            let statusColor = "bg-amber-50 border-amber-100 text-amber-700";
            let statusIcon = <Clock size={14} className="animate-pulse" />;
            
            if (order.status === 'served') {
              statusText = "Préparée";
              statusColor = "bg-orange-50 border-orange-100 text-orange-700";
              statusIcon = <CheckCircle size={14} />;
            } else if (order.status === 'completed') {
              statusText = "Finalisée";
              statusColor = "bg-green-50 border-green-100 text-green-700";
              statusIcon = <CheckCircle size={14} />;
            } else if (order.status === 'cancelled') {
              statusText = "Annulée";
              statusColor = "bg-slate-50 border-slate-100 text-slate-600";
              statusIcon = <XCircle size={14} />;
            }

            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-[32px] border border-slate-100 shadow-md hover:shadow-xl transition-shadow flex flex-col p-6 overflow-hidden relative group"
              >
                {/* Upper stats banner */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-dashed border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-lg text-slate-900 tracking-tight">{order.number}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-black uppercase tracking-wide ${statusColor}`}>
                    {statusIcon}
                    <span>{statusText}</span>
                  </div>
                </div>

                {/* Sender / Client info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                    <User size={14} className="text-slate-400" />
                    <span>Créé par: <strong className="text-slate-700 font-bold">{order.createdByName || 'Serveur'}</strong></span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                    <FileText size={14} className="text-slate-400" />
                    <span>Client: <strong className="text-orange-500 font-black">{order.clientName || 'Passager'}</strong></span>
                  </div>
                  
                  {order.notes && (
                    <div className="mt-1 p-2 bg-amber-50/50 rounded-xl border border-amber-100/40 text-xs text-amber-800 font-medium italic">
                      "{order.notes}"
                    </div>
                  )}
                </div>

                {/* Items preview list */}
                <div className="bg-slate-50/50 rounded-2xl p-3.5 space-y-2 mb-6 flex-1 min-h-[96px]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Articles</p>
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {order.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 max-w-[200px] truncate">{item.name}</span>
                        <span className="text-slate-400 font-medium">
                          x{item.quantity} <span className="text-slate-700 font-bold ml-1">{item.total.toLocaleString()} F</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bottom Total & Actions */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Total</span>
                    <span className="text-xl font-black text-slate-900 tracking-tight">{order.totalAmount.toLocaleString()} FCFA</span>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-2 border-t border-slate-100">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => handleServeOrder(order.id)}
                        className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white rounded-xl font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10"
                      >
                        <Check size={14} />
                        Prête / Servie
                      </button>
                    )}
                    
                    {order.status === 'served' && (
                      <button
                        onClick={() => handleSendToPOS(order)}
                        className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white rounded-xl font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10"
                      >
                        <ShoppingCart size={14} />
                        Facturer (POS)
                        <ArrowRight size={14} className="animate-bounce-horizontal" />
                      </button>
                    )}

                    {(order.status === 'pending' || order.status === 'served') && (
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        className="p-3 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-slate-100"
                        title="Annuler"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Order Modal / Side Sheet */}
      <AnimatePresence>
        {isNewOrderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white h-screen sm:h-[calc(100vh-48px)] w-full max-w-4xl sm:rounded-[40px] shadow-2xl flex flex-col overflow-hidden border border-slate-100"
            >
              {/* Header */}
              <div className="p-6 md:px-8 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-orange-50 text-orange-500 rounded-2xl">
                    <ClipboardList size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Saisir une nouvelle commande</h2>
                    <p className="text-xs text-slate-400 font-medium">Ajoutez les produits et précisez les instructions de service.</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="p-2.5 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body Grid */}
              <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                
                {/* Catalog (Left side) */}
                <div className="flex-1 p-6 md:p-8 flex flex-col overflow-hidden border-b md:border-b-0 md:border-r border-slate-100">
                  {/* Search and Client selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {/* Client Select */}
                    <div className="relative">
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Client</label>
                      <button 
                        onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                        className="flex items-center justify-between gap-2.5 w-full bg-slate-50 hover:bg-slate-100 border border-slate-100 text-left px-4 py-3.5 rounded-2xl text-xs font-bold text-slate-700 transition-all"
                      >
                        <span className="truncate">{selectedClient ? selectedClient.name : 'Sélectionner un client...'}</span>
                        <User size={14} className="text-slate-400 shrink-0" />
                      </button>

                      {isClientDropdownOpen && (
                        <div className="absolute top-18 left-0 right-0 z-50 bg-white border border-slate-100 rounded-2xl shadow-xl p-3 space-y-2.5 max-h-60 overflow-y-auto">
                          <input 
                            type="text" 
                            placeholder="Rechercher un client..."
                            value={clientSearchText}
                            onChange={(e) => setClientSearchText(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-100 p-2.5 rounded-xl focus:outline-none focus:border-orange-500 transition-colors"
                          />
                          <div className="space-y-1">
                            <button
                              onClick={() => {
                                setSelectedClient(null);
                                setIsClientDropdownOpen(false);
                              }}
                              className="w-full text-left text-xs p-2 hover:bg-slate-50 rounded-lg text-slate-500 font-bold"
                            >
                              Client Passager
                            </button>
                            {clientFilter.map(c => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setSelectedClient(c);
                                  setIsClientDropdownOpen(false);
                                  setCustomClientName('');
                                }}
                                className="w-full text-left text-xs p-2 hover:bg-slate-50 rounded-lg font-bold flex justify-between"
                              >
                                <span>{c.name}</span>
                                <span className="text-[10px] text-slate-400">{c.phone}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Custom / Quick Name */}
                    {!selectedClient && (
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Nom libre du client</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Table 3 / Jean M."
                          value={customClientName}
                          onChange={(e) => setCustomClientName(e.target.value)}
                          className="w-full text-xs font-bold bg-slate-50 border border-slate-100 px-4 py-3.5 rounded-2xl focus:outline-none focus:border-orange-500 focus:bg-white transition-all text-slate-700"
                        />
                      </div>
                    )}
                  </div>

                  {/* Search Product Box */}
                  <div className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Filtrer les produits par nom, code-barres..."
                      value={productSearchText}
                      onChange={(e) => setProductSearchText(e.target.value)}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-100 pl-11 pr-4 py-3.5 rounded-2xl focus:outline-none focus:border-orange-500 focus:bg-white transition-all text-slate-700"
                    />
                  </div>

                  {/* Products Catalog Display */}
                  <div className="flex-1 overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                      {productFilter.slice(0, 16).map(p => {
                        const inCartCount = orderCart.find(item => item.product.id === p.id)?.quantity || 0;
                        const isLow = p.stock <= (p.lowStockThreshold || 5);

                        return (
                          <div
                            key={p.id}
                            onClick={() => addToCart(p)}
                            className={`
                              p-4 border rounded-2xl text-left cursor-pointer transition-all active:scale-95 flex flex-col justify-between h-28 relative overflow-hidden group select-none
                              ${inCartCount > 0 
                                ? 'bg-orange-50/50 border-orange-200' 
                                : 'bg-white border-slate-100 hover:border-slate-300'}
                            `}
                          >
                            <div className="space-y-1">
                              <h4 className="font-bold text-xs text-slate-700 group-hover:text-slate-900 line-clamp-1">{p.name}</h4>
                              <p className="font-extrabold text-xs text-slate-900">{p.price.toLocaleString()} F</p>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-bold ${isLow ? 'text-red-500' : 'text-slate-400'}`}>
                                Stock: {p.stock}
                              </span>
                              {inCartCount > 0 && (
                                <span className="bg-orange-500 text-white font-black text-[10px] px-2.5 py-1 rounded-full shadow-lg shadow-orange-500/20 flex items-center gap-1">
                                  <span>{inCartCount}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Cart Order Summary (Right side) */}
                <div className="w-full md:w-80 bg-slate-50/50 p-6 md:p-8 flex flex-col overflow-hidden max-h-[400px] md:max-h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide">Panier Commande</h3>
                    <span className="text-xs bg-slate-200/85 px-2.5 py-0.5 rounded-full text-slate-600 font-bold">
                      {orderCart.length} articles
                    </span>
                  </div>

                  {/* Cart list list */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {orderCart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-slate-100">
                        <AlertCircle className="text-slate-400 mb-3" size={24} />
                        <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                          Sélectionnez des articles à gauche pour démarrer la commande
                        </p>
                      </div>
                    ) : (
                      orderCart.map(item => (
                        <div key={item.product.id} className="bg-white border border-slate-100 rounded-2xl p-3 flex justify-between items-center shadow-sm">
                          <div className="space-y-0.5 max-w-[124px]">
                            <h5 className="font-bold text-xs text-slate-700 truncate">{item.product.name}</h5>
                            <p className="text-[10px] font-black text-slate-900">{(item.product.price * item.quantity).toLocaleString()} F</p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, -1); }}
                              className="text-slate-400 hover:text-slate-800 transition-colors"
                            >
                              <MinusCircle size={18} />
                            </button>
                            <span className="text-xs font-black text-slate-700 min-w-4 text-center">{item.quantity}</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, 1); }}
                              className="text-slate-400 hover:text-slate-800 transition-colors"
                            >
                              <PlusCircle size={18} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeFromCart(item.product.id); }}
                              className="text-slate-300 hover:text-red-500 transition-colors ml-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Form Notes & Total */}
                  <div className="space-y-4 pt-4 mt-4 border-t border-slate-100">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Détails de service / Table...</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Table 5, emballer chaud"
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        className="w-full text-xs bg-white text-slate-700 font-semibold border border-slate-100 p-3 rounded-xl focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
                      />
                    </div>

                    <div className="flex justify-between items-end border-t border-slate-100 pt-3">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Commande</span>
                      <span className="text-xl font-black text-slate-900 tracking-tight">{orderTotal.toLocaleString()} F</span>
                    </div>

                    <button
                      onClick={handleSaveOrder}
                      disabled={isSaving || orderCart.length === 0}
                      className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 active:scale-95 transition-all"
                    >
                      {isSaving ? "Enregistrement..." : "Valider la Commande"}
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
