import { useContext, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Check,
  CreditCard,
  Banknote,
  Smartphone,
  Package,
  X,
  ArrowRight,
  Printer,
  FileDown,
  MessageSquare,
  Loader2,
  Lock,
  History
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, orderBy, serverTimestamp, runTransaction, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../services/db';
import { Product, CartItem, PaymentMethod, StoreSettings, Client } from '../types';
import { AppContext } from '../App';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Pos() {
  const navigate = useNavigate();
  const { searchQuery, userProfile, hasPermission, preselectedClient, setPreselectedClient } = useContext(AppContext);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState<number>(0);
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'receipt'>('cart');
  const [lastSaleId, setLastSaleId] = useState('');
  const [lastSaleData, setLastSaleData] = useState<{ 
    items: CartItem[]; 
    total: number; 
    discount: number;
    amountReceived: number;
    change: number;
    id: string; 
    date: Date;
    clientName?: string;
    clientPhone?: string;
    clientMatricule?: string;
  } | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userProfile?.storeId) return;
    const q = query(
      collection(db, 'products'), 
      where('storeId', '==', userProfile.storeId),
      orderBy('name')
    );
    const unsubscribeProducts = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product)));
    }, (error) => {
      console.warn("Error subscribing to products in POS module:", error);
    });

    const unsubscribeStore = onSnapshot(doc(db, 'storeSettings', userProfile.storeId), (snap) => {
      if (snap.exists()) {
        setStoreSettings(snap.data() as StoreSettings);
      }
    }, (error) => {
      console.warn("Error subscribing to storeSettings in POS module:", error);
    });

    const unsubscribeClients = onSnapshot(query(collection(db, 'clients'), where('storeId', '==', userProfile.storeId)), (snap) => {
      setClients(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Client)));
    }, (error) => {
      console.warn("Error subscribing to clients list in POS module:", error);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeStore();
      unsubscribeClients();
    };
  }, [userProfile?.storeId]);

  useEffect(() => {
    if (preselectedClient) {
      setSelectedClient(preselectedClient);
      setPreselectedClient(null); // Clear it after selecting
    }
  }, [preselectedClient, setPreselectedClient]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.priceAtSale } : item
        );
      }
      return [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        productId: product.id,
        name: product.name,
        quantity: 1,
        priceAtSale: product.price,
        total: product.price,
        product
      }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty, total: newQty * item.priceAtSale };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const total = Math.max(0, subtotal - discount);
  const change = paymentMethod === 'cash' ? Math.max(0, amountReceived - total) : 0;

  const handleWhatsAppShare = () => {
    if (!lastSaleData) return;
    const phone = lastSaleData.clientPhone?.replace(/\s+/g, '').replace('+', '');
    if (!phone) {
      alert("Aucun numéro de client associé.");
      return;
    }

    const message = `Bonjour ${lastSaleData.clientName || 'Cher Client'},\nMerci pour votre achat chez ${storeSettings?.name || 'SUPERMARKET'}.\nTotal: ${lastSaleData.total.toLocaleString()} FCFA\nDate: ${lastSaleData.date.toLocaleString()}\nID: #${lastSaleData.id.slice(-8)}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handlePrint = () => {
    const receiptContent = document.getElementById('receipt-print');
    if (!receiptContent) return;

    const printWindow = document.createElement('iframe');
    printWindow.style.position = 'absolute';
    printWindow.style.top = '-1000px';
    printWindow.style.left = '-1000px';
    document.body.appendChild(printWindow);

    const doc = printWindow.contentWindow?.document;
    if (!doc) return;

    doc.write(`
      <html>
        <head>
          <title>Impression Ticket</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
            body { 
              margin: 0; 
              padding: 10px; 
              font-family: 'JetBrains Mono', monospace;
              font-size: 10px;
              width: 72mm;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            .italic { font-style: italic; }
            .border-b { border-bottom: 1px solid #000; }
            .border-t { border-top: 1px solid #000; }
            .border-dashed { border-style: dashed; }
            .my-2 { margin-top: 8px; margin-bottom: 8px; }
            .mt-1 { margin-top: 4px; }
            .mt-2 { margin-top: 8px; }
            .mt-4 { margin-top: 16px; }
            .mt-6 { margin-top: 24px; }
            .mb-2 { margin-bottom: 8px; }
            .mb-4 { margin-bottom: 16px; }
            .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
            .pb-1 { padding-bottom: 4px; }
            .pt-1 { padding-top: 4px; }
            .pt-2 { padding-top: 8px; }
            .pt-4 { padding-top: 16px; }
            .space-y-1 > * + * { margin-top: 4px; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .w-12 { width: 48px; }
            .h-12 { height: 48px; }
            .mx-auto { margin-left: auto; margin-right: auto; }
            .object-contain { object-fit: contain; }
            .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .w-12 { width: 50%; }
            .w-14 { width: 25%; }
            .text-sm { font-size: 12px; }
            .text-xs { font-size: 8px; }
            .opacity-70 { opacity: 0.7; }
          </style>
        </head>
        <body>
          ${receiptContent.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    // Small delay to ensure styles and images (logo) are loaded
    setTimeout(() => {
      printWindow.contentWindow?.focus();
      printWindow.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printWindow);
      }, 500);
    }, 500);
  };

  const handleDownloadPDF = async () => {
    if (!lastSaleData) return;

    const docPDF = new jsPDF({
      unit: 'mm',
      format: [80, 200]
    });

    // POS Style Header
    docPDF.setFontSize(14);
    docPDF.setFont('helvetica', 'bold');
    docPDF.text(storeSettings?.name || "SUPERMARKET PRO", 40, 15, { align: 'center' });
    
    docPDF.setFontSize(8);
    docPDF.setFont('helvetica', 'normal');
    docPDF.text("Reçu de Vente", 40, 20, { align: 'center' });
    docPDF.text(`ID: #${lastSaleData.id.slice(-8).toUpperCase()}`, 40, 24, { align: 'center' });
    docPDF.text(`Date: ${lastSaleData.date?.toLocaleString() || 'N/A'}`, 40, 28, { align: 'center' });
    docPDF.setFont('helvetica', 'bolditalic');
    docPDF.text(`Vendeur: ${userProfile?.displayName || auth.currentUser?.displayName || 'Admin'}`, 40, 32, { align: 'center' });
    
    docPDF.line(5, 34, 75, 34);
    
    // Items Table
    const tableData = lastSaleData.items.map(item => [
      item.name || 'Inconnu',
      (item.quantity || 0).toString(),
      ((item.priceAtSale || 0) * (item.quantity || 0)).toLocaleString('de-DE')
    ]);

    autoTable(docPDF, {
      startY: 36,
      head: [['Article', 'Qté', 'Total']],
      body: tableData,
      theme: 'plain',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fontStyle: 'bold' },
      margin: { left: 5, right: 5 }
    });

    const finalY = (docPDF as any).lastAutoTable.finalY + 5;

    docPDF.line(5, finalY, 75, finalY);
    
    docPDF.setFont('helvetica', 'bold');
    docPDF.text(`SOUS-TOTAL: ${((lastSaleData.total || 0) + (lastSaleData.discount || 0)).toLocaleString('de-DE')} FCFA`, 75, finalY + 5, { align: 'right' });
    if (lastSaleData.discount) {
      docPDF.text(`REMISE: -${(lastSaleData.discount || 0).toLocaleString('de-DE')} FCFA`, 75, finalY + 9, { align: 'right' });
    }
    docPDF.setFontSize(10);
    docPDF.text(`TOTAL: ${(lastSaleData.total || 0).toLocaleString('de-DE')} FCFA`, 75, finalY + 14, { align: 'right' });
    
    docPDF.setFontSize(7);
    docPDF.setFont('helvetica', 'normal');
    const paymentInfoY = finalY + 20;
    docPDF.text(`Paiement: ${paymentMethod.toUpperCase()}`, 5, paymentInfoY);
    docPDF.text(`Reçu: ${(lastSaleData.amountReceived || 0).toLocaleString('de-DE')} FCFA`, 5, paymentInfoY + 4);
    docPDF.text(`Rendu: ${(lastSaleData.change || 0).toLocaleString('de-DE')} FCFA`, 5, paymentInfoY + 8);

    docPDF.text("Merci de votre visite!", 40, paymentInfoY + 16, { align: 'center' });

    // Robust download using Blob
    const pdfOutput = docPDF.output('blob');
    const blobUrl = URL.createObjectURL(pdfOutput);
    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.download = `Recu_${(lastSaleData.id || 'export').slice(-8)}.pdf`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(blobUrl);
  };

  const handleCloseRegister = async () => {
    if (!userProfile?.storeId) return;
    setIsProcessing(true);
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const q = query(
        collection(db, 'sales'),
        where('storeId', '==', userProfile.storeId),
        where('timestamp', '>=', startOfDay),
        orderBy('timestamp', 'desc')
      );
      
      const snap = await getDocs(q);
      const daySales = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const totalSales = daySales.reduce((sum: number, sale: any) => sum + (sale.totalAmount || 0), 0);
      
      const docPDF = new jsPDF({
        unit: 'mm',
        format: [80, 150]
      });

      docPDF.setFontSize(14);
      docPDF.setFont('helvetica', 'bold');
      docPDF.text(storeSettings?.name || "MARKET PRO", 40, 15, { align: 'center' });
      
      docPDF.setFontSize(10);
      docPDF.text("CLÔTURE DE CAISSE", 40, 22, { align: 'center' });
      
      docPDF.setFontSize(8);
      docPDF.setFont('helvetica', 'normal');
      docPDF.text(`Date: ${new Date().toLocaleDateString()}`, 40, 28, { align: 'center' });
      docPDF.text(`Heure: ${new Date().toLocaleTimeString()}`, 40, 32, { align: 'center' });
      docPDF.text(`Vendeur: ${userProfile?.displayName || auth.currentUser?.displayName || 'Admin'}`, 40, 36, { align: 'center' });

      docPDF.line(5, 40, 75, 40);
      
      docPDF.setFontSize(9);
      docPDF.setFont('helvetica', 'bold');
      docPDF.text("RÉSUMÉ DES VENTES", 5, 48);
      
      docPDF.setFontSize(8);
      docPDF.setFont('helvetica', 'normal');
      docPDF.text(`Nombre de ventes: ${daySales.length}`, 5, 54);
      
      docPDF.setFontSize(10);
      docPDF.setFont('helvetica', 'bold');
      docPDF.text(`TOTAL DES ENTRÉES VENTE:`, 5, 65);
      docPDF.setFontSize(12);
      docPDF.text(`${totalSales.toLocaleString('de-DE')} CFA`, 40, 75, { align: 'center' });
      
      docPDF.setFontSize(8);
      docPDF.setFont('helvetica', 'italic');
      docPDF.text("Arrêté la présente caisse à la somme de:", 40, 85, { align: 'center' });
      docPDF.setFont('helvetica', 'bold');
      docPDF.text(`${totalSales.toLocaleString('de-DE')} CFA`, 40, 90, { align: 'center' });

      docPDF.line(5, 100, 75, 100);
      docPDF.text("Signature du Caissier", 40, 110, { align: 'center' });
      
      const pdfOutput = docPDF.output('blob');
      const blobUrl = URL.createObjectURL(pdfOutput);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = `Cloture_Caisse_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);
      
      alert(`Caisse clôturée avec succès !\nTotal: ${totalSales.toLocaleString()} CFA`);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'sales');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (!hasPermission('pos', 'create')) {
      alert("Vous n'avez pas la permission d'effectuer des ventes.");
      return;
    }

    const itemsToSave = [...cart];
    const saleTotal = total;
    const saleDiscount = discount;
    const saleAmountReceived = paymentMethod === 'cash' ? amountReceived : total;
    const saleChange = change;

    setIsProcessing(true);
    try {
      if (!userProfile?.storeId) {
        throw new Error("ID de boutique manquant. Veuillez vous reconnecter.");
      }
      let saleId = '';
      await runTransaction(db, async (transaction) => {
        // ... (read products)
        const productRefs = itemsToSave.map(item => doc(db, 'products', item.productId));
        const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        const saleRef = doc(collection(db, 'sales'));
        saleId = saleRef.id;
        
        const saleData: any = {
          storeId: userProfile.storeId,
          timestamp: serverTimestamp(),
          cashierId: auth.currentUser?.uid,
          cashierName: userProfile?.displayName || auth.currentUser?.displayName || 'Admin',
          totalAmount: saleTotal,
          discount: saleDiscount,
          amountReceived: saleAmountReceived,
          change: saleChange,
          paymentMethod,
          itemsCount: itemsToSave.length
        };

        if (selectedClient) {
          saleData.clientId = selectedClient.id;
          saleData.clientName = selectedClient.name;
          if (selectedClient.matricule) {
            saleData.clientMatricule = selectedClient.matricule;
          }
          
          // Update client stats
          const clientRef = doc(db, 'clients', selectedClient.id);
          const clientSnap = await transaction.get(clientRef);
          if (clientSnap.exists()) {
            transaction.update(clientRef, {
              totalSpent: (clientSnap.data().totalSpent || 0) + saleTotal,
              visitsCount: (clientSnap.data().visitsCount || 0) + 1,
              lastVisit: serverTimestamp(),
            });
          }
        }

        transaction.set(saleRef, saleData);

        // ... (save items)
        itemsToSave.forEach((item, index) => {
          const itemRef = doc(collection(db, `sales/${saleRef.id}/items`));
          transaction.set(itemRef, {
            storeId: userProfile.storeId,
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            priceAtSale: item.priceAtSale,
            total: item.total
          });

          const productSnap = productSnaps[index];
          if (productSnap.exists()) {
            const newStock = (productSnap.data().stock || 0) - item.quantity;
            transaction.update(productSnap.ref, { stock: newStock });
          }
        });

        setLastSaleId(saleId);
        setLastSaleData({
          items: itemsToSave,
          total: saleTotal,
          discount: saleDiscount,
          amountReceived: saleAmountReceived,
          change: saleChange,
          id: saleId,
          date: new Date(),
          clientName: selectedClient?.name,
          clientPhone: selectedClient?.phone,
          clientMatricule: selectedClient?.matricule
        });
      });

      setCheckoutStep('receipt');
      setCart([]);
      setDiscount(0);
      setAmountReceived(0);
      setSelectedClient(null);
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F4 to Focus Search (Home for many POS systems)
      if (e.key === 'F4') {
        e.preventDefault();
        // The search input is in App.tsx typically, but if we have local search:
        // For now, let's focus the common search pattern
        const globalSearch = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (globalSearch) globalSearch.focus();
      }

      // F2 to Pay
      if (e.key === 'F2' && cart.length > 0 && !isCheckoutOpen) {
        e.preventDefault();
        setIsCheckoutOpen(true);
      }

      // Enter to process checkout if open
      if (e.key === 'Enter' && isCheckoutOpen && checkoutStep === 'cart' && !isProcessing) {
        if (paymentMethod !== 'cash' || amountReceived >= total) {
          handleCheckout();
        }
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        setIsCheckoutOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, isCheckoutOpen, checkoutStep, isProcessing, paymentMethod, amountReceived, total]);

  const filteredProducts = products.filter(p => {
    const searchLower = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(searchLower) || 
      (p.barcode && p.barcode.includes(searchQuery)) ||
      (p.sku && p.sku.toLowerCase().includes(searchLower)) ||
      (p.category && p.category.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row gap-6">
      {/* Products Side */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4">
           <h1 className="text-3xl font-black tracking-tighter text-gray-900 uppercase">Point de Vente</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/history')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm active:scale-95"
            >
              <History size={14} className="text-orange-500" />
              Journal
            </button>
            <button 
              onClick={handleCloseRegister}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} className="text-orange-500" />}
              Rapport Journalier
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px] md:min-w-0">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell">SKU</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Article</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Prix</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Stock</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map(product => (
                    <tr 
                      key={product.id} 
                      onClick={() => product.stock > 0 && addToCart(product)}
                      className={`transition-colors group ${product.stock > 0 ? 'hover:bg-orange-50 cursor-pointer' : 'opacity-50 grayscale cursor-not-allowed'}`}
                    >
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="text-xs font-mono font-bold text-gray-400 group-hover:text-orange-500 transition-colors uppercase">
                          {product.sku || '---'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-[150px] sm:max-w-none">
                          <p className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors truncate">{product.name}</p>
                          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{product.category}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-gray-900 whitespace-nowrap">
                        {(product.price || 0).toLocaleString('de-DE')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${product.stock > 10 ? 'bg-green-100 text-green-700' : product.stock > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {product.stock} {product.unit}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          disabled={product.stock <= 0}
                          className={`p-2 rounded-xl transition-all ${product.stock > 0 ? 'bg-gray-100 text-gray-400 group-hover:bg-orange-500 group-hover:text-white' : 'bg-gray-50 text-gray-300'}`}
                        >
                          <Plus size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredProducts.length === 0 && (
              <div className="p-12 text-center text-gray-400">
                <Package size={48} className="mx-auto mb-4 opacity-20" />
                <p>Aucun produit trouvé</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart Side */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-[32px] border border-gray-100 shadow-lg overflow-hidden">
        <div className="p-6 bg-gray-900 text-white">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart size={20} className="text-orange-500" />
            <h2 className="text-xl font-bold">Panier</h2>
          </div>
          <p className="text-xs text-gray-400">{cart.length} articles sélectionnés</p>
        </div>

        <div className="p-4 bg-gray-50 border-b border-gray-100">
           <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Client</label>
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Rechercher un client..."
                    className="w-full bg-white border border-gray-100 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold outline-none focus:border-orange-500"
                  />
                </div>
                <select 
                  value={selectedClient?.id || ''}
                  onChange={(e) => {
                    const client = clients.find(c => c.id === e.target.value);
                    setSelectedClient(client || null);
                  }}
                  className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-orange-500"
                >
                  <option value="">Client de passage</option>
                  {clients
                    .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                </select>
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence initial={false}>
            {cart.map(item => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl"
              >
                <div className="flex-1 overflow-hidden">
                  <h4 className="font-bold text-sm text-gray-900 truncate">{item.name}</h4>
                  <p className="text-xs text-gray-500">{(item.priceAtSale || 0).toLocaleString('de-DE')} FCFA</p>
                </div>
                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-gray-100">
                  <button onClick={() => updateQuantity(item.id, -1)} className="text-gray-400 hover:text-gray-900"><Minus size={14} /></button>
                  <span className="text-xs font-black min-w-[20px] text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="text-gray-400 hover:text-gray-900"><Plus size={14} /></button>
                </div>
                <button 
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 opactiy-50 pt-10">
              <ShoppingCart size={48} className="mb-4" />
              <p className="font-medium text-sm">Le panier est vide</p>
            </div>
          )}
        </div>

        <div className="p-6 pb-12 bg-gray-50 border-t border-gray-100">
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Sous-total</span>
              <span>{(subtotal || 0).toLocaleString('de-DE')} FCFA</span>
            </div>
            <div className="flex flex-col gap-1 py-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Remise (FCFA)</label>
              <input 
                type="number"
                value={discount || ''}
                onChange={(e) => setDiscount(Number(e.target.value))}
                placeholder=""
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-right font-bold outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Taxes (0%)</span>
              <span>0 FCFA</span>
            </div>
            <div className="flex justify-between text-xl font-black text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="text-orange-500">{total.toLocaleString('de-DE')} FCFA</span>
            </div>
          </div>

          {cart.length > 0 && (
            <button 
              disabled={isProcessing}
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-orange-500/20 active:scale-[0.98]"
            >
              Payer Maintenant
              <ArrowRight size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Checkout Modal MODERNIZED */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
              onClick={() => !isProcessing && setIsCheckoutOpen(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative bg-white w-full h-full sm:h-auto sm:max-w-xs sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
              {checkoutStep === 'cart' ? (
                <div className="p-5 sm:p-6 flex flex-col h-full">
                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <h2 className="text-xl font-black text-gray-900 tracking-tight italic uppercase decoration-orange-500 decoration-2 underline-offset-4">RÈGLEMENT</h2>
                      <p className="text-[8px] uppercase font-black tracking-widest text-gray-400 mt-1">Étape finale</p>
                    </div>
                    <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-gray-50 rounded-full transition-all group">
                      <X size={18} className="text-gray-300 group-hover:text-gray-900" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                         {[
                           { id: 'cash', icon: Banknote, label: 'Cash' },
                           { id: 'card', icon: CreditCard, label: 'Carte' },
                           { id: 'mobile', icon: Smartphone, label: 'Mobile' }
                         ].map(method => (
                           <button
                             key={method.id}
                             onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                             className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentMethod === method.id ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-lg shadow-orange-500/10' : 'border-gray-50 hover:border-gray-100 text-gray-400'}`}
                           >
                             <method.icon size={20} />
                             <span className="text-[8px] font-black uppercase tracking-widest">{method.label}</span>
                           </button>
                         ))}
                    </div>

                    <div className="space-y-4">
                      <div className="bg-gray-900 p-5 rounded-[24px] text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 -mr-10 -mt-10 rounded-full" />
                        <div className="relative">
                          <p className="text-[8px] font-black uppercase tracking-[0.3em] opacity-40 mb-1 font-sans">Total à payer</p>
                          <p className="text-2xl font-black italic">{(total || 0).toLocaleString('de-DE')} <span className="text-[9px] opacity-40 font-mono">FCFA</span></p>
                        </div>
                      </div>
                      
                      {paymentMethod === 'cash' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-4"
                        >
                          <div className="space-y-1.5">
                            <label className="text-[8px] font-black uppercase tracking-widest text-gray-400 ml-1">Montant Reçu</label>
                            <input 
                              type="number"
                              value={amountReceived || ''}
                              onChange={(e) => setAmountReceived(Number(e.target.value))}
                              autoFocus
                              placeholder="0"
                              className="w-full bg-gray-50 border-none focus:bg-white focus:ring-2 focus:ring-orange-500/5 rounded-xl py-3.5 px-5 text-xl font-black outline-none transition-all text-gray-900"
                            />
                          </div>
                          
                          <div className="bg-orange-50 p-4 rounded-2xl flex justify-between items-center border border-orange-100 shadow-inner">
                            <div>
                              <p className="text-orange-600 font-black uppercase tracking-[0.2em] text-[8px] mb-0.5">Rendu</p>
                              <p className="text-lg font-black text-orange-600 italic">{(change || 0).toLocaleString('de-DE')} <span className="text-[8px] font-mono opacity-50">FCFA</span></p>
                            </div>
                            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-orange-500 border border-orange-100/20">
                              <Banknote size={16} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className="pt-5 mt-auto flex gap-3">
                    <button 
                      onClick={() => setIsCheckoutOpen(false)}
                      className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={handleCheckout}
                      disabled={isProcessing || (paymentMethod === 'cash' && amountReceived < total)}
                      className="flex-[2] py-4 bg-orange-500 text-white rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <>
                          <Check size={16} />
                          Encaisser
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 sm:p-8 text-center flex flex-col h-full bg-gray-900 text-white">
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <motion.div 
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-20 h-20 bg-green-500 text-white rounded-[28px] flex items-center justify-center mb-6 shadow-2xl shadow-green-500/40 transform rotate-6"
                    >
                      <Check size={40} className="stroke-[3]" />
                    </motion.div>
                    <h2 className="text-3xl font-black mb-1.5 tracking-tight italic uppercase decoration-green-500 decoration-6 underline-offset-6">Terminé !</h2>
                    <p className="text-white/40 font-bold text-[9px] uppercase tracking-widest mb-8">Transaction #{lastSaleId.slice(-8).toUpperCase()}</p>
                    
                    <div className="grid grid-cols-2 gap-3.5 w-full mb-4">
                      <button 
                        onClick={handlePrint}
                        className="flex items-center justify-center gap-2.5 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border border-white/5"
                      >
                        <Printer size={16} className="text-orange-500" />
                        Ticket
                      </button>
                      <button 
                        onClick={handleDownloadPDF}
                        className="flex items-center justify-center gap-2.5 py-4 bg-white text-gray-900 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all hover:bg-gray-100 shadow-2xl"
                      >
                        <FileDown size={16} className="text-blue-600" />
                        PDF
                      </button>
                    </div>

                    {lastSaleData?.clientPhone && (
                      <button 
                         onClick={handleWhatsAppShare}
                         className="w-full flex items-center justify-center gap-2.5 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-emerald-500/20"
                      >
                        <MessageSquare size={16} />
                        Envoyer par WhatsApp
                      </button>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => { setIsCheckoutOpen(false); setCheckoutStep('cart'); }}
                    className="w-full py-5 mt-6 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border border-white/2 font-sans"
                  >
                    Vente Suivante
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    {/* Hidden Receipt for Printing (Thermal Optimized) */}
    <div id="receipt-print" className="fixed left-[-9999px] top-0 print:static print:block font-mono text-[10px] w-[80mm] mx-auto p-4 bg-white text-black leading-tight">
      {lastSaleData && (
        <>
          <div className="text-center mb-4">
            {storeSettings?.logoUrl && (
              <img src={storeSettings.logoUrl} alt="Logo" className="w-12 h-12 mx-auto mb-2 object-contain" />
            )}
            <h1 className="text-sm font-bold uppercase tracking-widest">{storeSettings?.name || 'SUPERMARKET PRO'}</h1>
            <p className="text-[8px] italic">{storeSettings?.address || 'Dakar, Sénégal'}</p>
            <p className="text-[8px]">Tel: {storeSettings?.phone || '+221 33 000 00 00'}</p>
            
            {lastSaleData?.clientName && (
              <div className="mt-2 pt-2 border-t border-dashed border-gray-300">
                <p className="text-[9px] font-bold uppercase">CLIENT: {lastSaleData.clientName}</p>
                {lastSaleData.clientMatricule && <p className="text-[8px] font-black">{lastSaleData.clientMatricule}</p>}
                <p className="text-[8px]">{lastSaleData.clientPhone}</p>
              </div>
            )}

            <p className="text-[8px] italic font-black mt-2 bg-gray-100 py-1 border-y border-dashed border-gray-300 uppercase">VENDEUR: {userProfile?.displayName || auth.currentUser?.displayName || 'Admin'}</p>
            <div className="border-b border-dashed my-2"></div>
            <p className="font-bold underline">REÇU DE VENTE</p>
            <div className="flex justify-between mt-2 font-mono">
               <span>ID: {lastSaleData.id?.slice(-8).toUpperCase()}</span>
               <span>Caisse: {auth.currentUser?.displayName?.split(' ')[0] || '01'}</span>
            </div>
            <p className="text-left mt-1">Date: {lastSaleData.date?.toLocaleString() || 'N/A'}</p>
          </div>

          <div className="space-y-1 mb-4 border-t border-dashed pt-2">
            <div className="flex justify-between font-bold border-b border-dashed pb-1 mb-1 text-[8px]">
              <span className="w-1/2">ARTICLE</span>
              <span className="w-1/4 text-center">QTÉ</span>
              <span className="w-1/4 text-right">TOTAL</span>
            </div>
            {lastSaleData.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between py-0.5 text-[8px]">
                <span className="w-1/2 truncate uppercase">{item.name}</span>
                <span className="w-1/4 text-center">{item.quantity}</span>
                <span className="w-1/4 text-right">{(item.total || 0).toLocaleString('de-DE')}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed pt-2 space-y-1">
            <div className="flex justify-between text-[8px]">
              <span>SOUS-TOTAL</span>
              <span>{((lastSaleData.total || 0) + (lastSaleData.discount || 0)).toLocaleString('de-DE')}</span>
            </div>
            {lastSaleData.discount > 0 && (
              <div className="flex justify-between text-[8px] italic">
                <span>REMISE</span>
                <span>-{(lastSaleData.discount || 0).toLocaleString('de-DE')}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL</span>
              <span>{(lastSaleData.total || 0).toLocaleString('de-DE')} FCFA</span>
            </div>
            <div className="flex justify-between text-[8px] pt-1">
              <span>MONTANT REÇU</span>
              <span>{(lastSaleData.amountReceived || 0).toLocaleString('de-DE')}</span>
            </div>
            <div className="flex justify-between text-[8px] font-bold">
              <span>RENDU</span>
              <span>{(lastSaleData.change || 0).toLocaleString('de-DE')}</span>
            </div>
            <div className="flex justify-between text-[8px] pt-1 uppercase opacity-70">
              <span>PAIEMENT:</span>
              <span className="font-bold">{paymentMethod}</span>
            </div>
          </div>

          <div className="text-center mt-4 border-t border-dashed pt-4 mb-2">
            <p className="text-[8px] font-black uppercase">MERCI DE VOTRE VISITE</p>
          </div>
        </>
      )}
    </div>
    </div>
  );
}
