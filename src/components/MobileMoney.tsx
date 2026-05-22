import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  TrendingDown, 
  TrendingUp, 
  Smartphone, 
  ArrowRightLeft, 
  Percent, 
  Trash2, 
  Check, 
  X, 
  UserPlus, 
  Phone, 
  PiggyBank, 
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  FileSpreadsheet,
  FileBox,
  Coins,
  Globe,
  Settings
} from 'lucide-react';
import { collection, addDoc, onSnapshot, query, where, doc, getDocs, deleteDoc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { AppContext } from '../App';
import { MobileTransaction, Client } from '../types';
import { handleFirestoreError, OperationType } from '../services/db';
import { logAction, AuditAction } from '../services/audit';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ECOWAS (CEDEAO) Countries definition with flags, currencies and operators
const CEDEAO_COUNTRIES = [
  {
    code: 'SN',
    name: 'Sénégal',
    flag: '🇸🇳',
    currency: 'FCFA',
    operators: [
      { id: 'orange', name: 'Orange Money', color: '#ff6600', bg: 'bg-orange-600', text: 'text-orange-600', logoText: 'OM' },
      { id: 'wave', name: 'Wave', color: '#00a4e4', bg: 'bg-sky-500', text: 'text-sky-500', logoText: 'W' },
      { id: 'free', name: 'Free Money', color: '#e4002b', bg: 'bg-red-600', text: 'text-red-600', logoText: 'FM' },
      { id: 'wizall', name: 'Wizall Money', color: '#4c1d95', bg: 'bg-purple-700', text: 'text-purple-700', logoText: 'WM' }
    ]
  },
  {
    code: 'CI',
    name: 'Côte d’Ivoire',
    flag: '🇨🇮',
    currency: 'FCFA',
    operators: [
      { id: 'orange', name: 'Orange Money', color: '#ff6600', bg: 'bg-orange-600', text: 'text-orange-600', logoText: 'OM' },
      { id: 'mtn', name: 'MTN MoMo', color: '#ffcc00', bg: 'bg-yellow-500', text: 'text-yellow-600', logoText: 'MTN' },
      { id: 'moov', name: 'Moov Money', color: '#006633', bg: 'bg-green-700', text: 'text-green-700', logoText: 'MV' },
      { id: 'wave', name: 'Wave', color: '#00a4e4', bg: 'bg-sky-500', text: 'text-sky-500', logoText: 'W' }
    ]
  },
  {
    code: 'ML',
    name: 'Mali',
    flag: '🇲🇱',
    currency: 'FCFA',
    operators: [
      { id: 'orange', name: 'Orange Money', color: '#ff6600', bg: 'bg-orange-600', text: 'text-orange-600', logoText: 'OM' },
      { id: 'moov', name: 'Moov Flooz', color: '#006633', bg: 'bg-green-700', text: 'text-green-700', logoText: 'MF' },
      { id: 'wave', name: 'Wave', color: '#00a4e4', bg: 'bg-sky-500', text: 'text-sky-500', logoText: 'W' }
    ]
  },
  {
    code: 'BF',
    name: 'Burkina Faso',
    flag: '🇧🇫',
    currency: 'FCFA',
    operators: [
      { id: 'orange', name: 'Orange Money', color: '#ff6600', bg: 'bg-orange-600', text: 'text-orange-600', logoText: 'OM' },
      { id: 'moov', name: 'Moov Flooz', color: '#006633', bg: 'bg-green-700', text: 'text-green-700', logoText: 'MF' },
      { id: 'sank', name: 'Sank Money', color: '#ed1c24', bg: 'bg-red-500', text: 'text-red-500', logoText: 'SM' }
    ]
  },
  {
    code: 'TG',
    name: 'Togo',
    flag: '🇹🇬',
    currency: 'FCFA',
    operators: [
      { id: 'tmoney', name: 'T-Money', color: '#005b94', bg: 'bg-blue-850', text: 'text-blue-800', logoText: 'TM' },
      { id: 'moov', name: 'Moov Flooz', color: '#006633', bg: 'bg-green-700', text: 'text-green-700', logoText: 'MF' }
    ]
  },
  {
    code: 'BJ',
    name: 'Bénin',
    flag: '🇧🇯',
    currency: 'FCFA',
    operators: [
      { id: 'mtn', name: 'MTN MoMo', color: '#ffcc00', bg: 'bg-yellow-500', text: 'text-yellow-600', logoText: 'MTN' },
      { id: 'moov', name: 'Moov Money', color: '#006633', bg: 'bg-green-700', text: 'text-green-700', logoText: 'MV' },
      { id: 'celtiis', name: 'Celtiis Cash', color: '#a21caf', bg: 'bg-purple-700', text: 'text-purple-700', logoText: 'CC' }
    ]
  },
  {
    code: 'NE',
    name: 'Niger',
    flag: '🇳🇪',
    currency: 'FCFA',
    operators: [
      { id: 'airtel', name: 'Airtel Money', color: '#ff0000', bg: 'bg-red-600', text: 'text-red-600', logoText: 'AM' },
      { id: 'moov', name: 'Moov Money', color: '#006633', bg: 'bg-green-700', text: 'text-green-700', logoText: 'MV' },
      { id: 'orange', name: 'Orange Money', color: '#ff6600', bg: 'bg-orange-600', text: 'text-orange-600', logoText: 'OM' }
    ]
  },
  {
    code: 'GN',
    name: 'Guinée',
    flag: '🇬🇳',
    currency: 'GNF',
    operators: [
      { id: 'orange', name: 'Orange Money', color: '#ff6600', bg: 'bg-orange-600', text: 'text-orange-600', logoText: 'OM' },
      { id: 'mtn', name: 'MTN MoMo', color: '#ffcc00', bg: 'bg-yellow-500', text: 'text-yellow-600', logoText: 'MTN' }
    ]
  },
  {
    code: 'GW',
    name: 'Guinée-Bissau',
    flag: '🇬🇼',
    currency: 'FCFA',
    operators: [
      { id: 'orange', name: 'Orange Money', color: '#ff6600', bg: 'bg-orange-600', text: 'text-orange-600', logoText: 'OM' },
      { id: 'mtn', name: 'MTN MoMo', color: '#ffcc00', bg: 'bg-yellow-500', text: 'text-yellow-600', logoText: 'MTN' }
    ]
  },
  {
    code: 'GH',
    name: 'Ghana',
    flag: '🇬🇭',
    currency: 'GHS',
    operators: [
      { id: 'mtn', name: 'MTN MoMo', color: '#ffcc00', bg: 'bg-yellow-500', text: 'text-yellow-600', logoText: 'MTN' },
      { id: 'vodafone', name: 'Telecel Cash', color: '#e60000', bg: 'bg-red-600', text: 'text-red-600', logoText: 'TC' },
      { id: 'airteltigo', name: 'AT Money', color: '#005a9c', bg: 'bg-sky-700', text: 'text-sky-700', logoText: 'AT' }
    ]
  },
  {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    currency: 'NGN',
    operators: [
      { id: 'opay', name: 'OPay', color: '#00bfa5', bg: 'bg-teal-500', text: 'text-teal-500', logoText: 'OP' },
      { id: 'palmpay', name: 'PalmPay', color: '#4a148c', bg: 'bg-indigo-900', text: 'text-indigo-900', logoText: 'PP' },
      { id: 'mtn', name: 'MTN MoMo PSB', color: '#ffcc00', bg: 'bg-yellow-500', text: 'text-yellow-600', logoText: 'MTN' },
      { id: 'paga', name: 'Paga', color: '#ff6f00', bg: 'bg-amber-600', text: 'text-amber-600', logoText: 'PG' }
    ]
  },
  {
    code: 'LR',
    name: 'Libéria',
    flag: '🇱🇷',
    currency: 'LRD',
    operators: [
      { id: 'mtn', name: 'Lonestar MTN', color: '#ffcc00', bg: 'bg-yellow-500', text: 'text-yellow-600', logoText: 'MTN' },
      { id: 'orange', name: 'Orange Money', color: '#ff6600', bg: 'bg-orange-600', text: 'text-orange-600', logoText: 'OM' }
    ]
  },
  {
    code: 'SL',
    name: 'Sierra Leone',
    flag: '🇸🇱',
    currency: 'SLE',
    operators: [
      { id: 'orange', name: 'Orange Money', color: '#ff6600', bg: 'bg-orange-600', text: 'text-orange-600', logoText: 'OM' },
      { id: 'afrimoney', name: 'AfriMoney', color: '#ff3d00', bg: 'bg-orange-650', text: 'text-orange-600', logoText: 'AM' }
    ]
  },
  {
    code: 'GM',
    name: 'Gambie',
    flag: '🇬🇲',
    currency: 'GMD',
    operators: [
      { id: 'qmoney', name: 'QMoney', color: '#2e7d32', bg: 'bg-green-800', text: 'text-green-800', logoText: 'QM' },
      { id: 'afrimoney', name: 'AfriMoney', color: '#ff3d00', bg: 'bg-orange-600', text: 'text-orange-600', logoText: 'AM' }
    ]
  },
  {
    code: 'CV',
    name: 'Cap-Vert',
    flag: '🇨🇻',
    currency: 'CVE',
    operators: [
      { id: 'vinti4', name: 'Vinti4', color: '#1a237e', bg: 'bg-blue-900', text: 'text-blue-900', logoText: 'V4' }
    ]
  }
];

export default function MobileMoney() {
  const { userProfile, userRole } = useContext(AppContext);
  const [selectedCountry, setSelectedCountry] = useState<string>('SN');
  const [transactions, setTransactions] = useState<MobileTransaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFloatModalOpen, setIsFloatModalOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dynamic Country Settings & Merchant configuration
  const [merchantNumbers, setMerchantNumbers] = useState<{ [key: string]: string }>({});

  // Floats/Starting Balances
  const [floats, setFloats] = useState<{ [key: string]: number }>({});

  // Combined Form states for adjustments
  const [adjustFormData, setAdjustFormData] = useState<{
    balances: { [key: string]: number };
    merchants: { [key: string]: string };
  }>({
    balances: {},
    merchants: {}
  });

  // New Transaction Form states
  const [formData, setFormData] = useState({
    operator: '',
    type: 'deposit' as 'deposit' | 'withdrawal',
    amount: '',
    commission: '',
    feesPaid: '',
    clientPhone: '',
    clientName: '',
    referenceId: '',
    status: 'completed' as 'completed' | 'pending' | 'failed',
    notes: ''
  });

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Active ECOWAS Country configuration
  const currentCountry = CEDEAO_COUNTRIES.find(c => c.code === selectedCountry) || CEDEAO_COUNTRIES[0];
  const operators = currentCountry.operators;

  // Auto select first operator when country or modal changes
  useEffect(() => {
    if (operators.length > 0 && !operators.some(op => op.id === formData.operator)) {
      setFormData(prev => ({
        ...prev,
        operator: operators[0].id
      }));
    }
  }, [selectedCountry, operators]);

  // Listen to mobile transactions and dynamic settings
  useEffect(() => {
    if (!userProfile?.storeId) return;

    // Load country settings & merchant numbers
    const settingsRef = doc(db, 'mobileMoneySettings', userProfile.storeId);
    const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.selectedCountry) {
          setSelectedCountry(data.selectedCountry);
        }
        if (data.merchantNumbers) {
          setMerchantNumbers(data.merchantNumbers);
          setAdjustFormData(prev => ({
            ...prev,
            merchants: data.merchantNumbers || {}
          }));
        }
      }
    }, (error) => {
      console.warn("Error watching mobile Money settings, user might not have rights yet:", error);
    });

    // Sub to transactions helper
    const q = query(
      collection(db, 'mobileTransactions'),
      where('storeId', '==', userProfile.storeId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MobileTransaction));
      // Sort desc by order of timestamp
      const sorted = list.sort((a,b) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
        return timeB - timeA;
      });
      setTransactions(sorted);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to mobile transactions:", error);
      setLoading(false);
    });

    // Sub to clients to pre-fill phone numbers/names
    const clientsQ = query(
      collection(db, 'clients'),
      where('storeId', '==', userProfile.storeId)
    );
    const unsubClients = onSnapshot(clientsQ, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Client));
      setClients(list);
    }, (error) => {
      console.warn("Error listening to clients list in mobile money:", error);
    });

    // Sub to operator starting floats
    const floatsRef = doc(db, 'mobileMoneyFloats', userProfile.storeId);
    const unsubFloats = onSnapshot(floatsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const baseBalances = data.balances || {};
        setFloats(baseBalances);
        setAdjustFormData(prev => ({
          ...prev,
          balances: baseBalances
        }));
      }
    }, (error) => {
      console.warn("Error listening to floats list in mobile money:", error);
    });

    return () => {
      unsubscribe();
      unsubClients();
      unsubFloats();
      unsubSettings();
    };
  }, [userProfile?.storeId]);

  // Handle CEDEAO country alteration
  const handleCountryChange = async (countryCode: string) => {
    if (!userProfile?.storeId) return;
    try {
      setSelectedCountry(countryCode);
      const settingsRef = doc(db, 'mobileMoneySettings', userProfile.storeId);
      await setDoc(settingsRef, {
        selectedCountry: countryCode
      }, { merge: true });

      const targetCountry = CEDEAO_COUNTRIES.find(c => c.code === countryCode);
      if (targetCountry && targetCountry.operators.length > 0) {
        setFormData(prev => ({
          ...prev,
          operator: targetCountry.operators[0].id
        }));
      }
    } catch (err) {
      console.error("Error setting active country profile:", err);
    }
  };

  // Handle client selection to autofill form
  const handleSelectClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSelectedClient(client);
      setFormData(prev => ({
        ...prev,
        clientPhone: client.phone || '',
        clientName: client.name || ''
      }));
    } else {
      setSelectedClient(null);
      setFormData(prev => ({
        ...prev,
        clientPhone: '',
        clientName: ''
      }));
    }
  };

  // Submit start float adjustments and merchant numbers unified
  const handleSaveAdjustments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.storeId) return;

    try {
      // Save Floats
      await setDoc(doc(db, 'mobileMoneyFloats', userProfile.storeId), {
        balances: adjustFormData.balances,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Save Merchant Settings
      await setDoc(doc(db, 'mobileMoneySettings', userProfile.storeId), {
        merchantNumbers: adjustFormData.merchants,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await logAction(
        userProfile.storeId,
        auth.currentUser?.uid || '',
        userProfile.displayName || '',
        AuditAction.SETTINGS_UPDATE,
        `Mise à jour des caisses et numéros marchands (${currentCountry.name})`,
        { balances: adjustFormData.balances, merchants: adjustFormData.merchants }
      );

      setIsFloatModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'mobileMoneyFloats');
    }
  };

  // Auto calculate commission and fees on amount change
  useEffect(() => {
    const amt = parseFloat(formData.amount);
    if (!amt || isNaN(amt)) return;

    // Standard mobile money rates (approx 1% fee)
    let estFee = 0;
    if (formData.operator === 'wave') {
      estFee = formData.type === 'deposit' ? Math.round(amt * 0.01) : 0;
    } else {
      estFee = Math.round(amt * 0.01);
    }

    const estCommission = Math.round(estFee * 0.3); // standard partner share

    setFormData(prev => ({
      ...prev,
      feesPaid: prev.feesPaid === '' ? String(estFee) : prev.feesPaid,
      commission: prev.commission === '' ? String(estCommission) : prev.commission
    }));
  }, [formData.amount, formData.operator, formData.type]);

  // Handle new transaction submission
  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.storeId) return;

    const parsedAmount = parseFloat(formData.amount);
    const parsedCommission = parseFloat(formData.commission) || 0;
    const parsedFees = parseFloat(formData.feesPaid) || 0;

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Veuillez saisir un montant valide.");
      return;
    }

    // Lookup merchant SIM configured
    const merchantNumKey = `${selectedCountry}_${formData.operator}`;
    const configuredMerchant = merchantNumbers[merchantNumKey] || 'Non spécifié';

    try {
      const txData = {
        storeId: userProfile.storeId,
        timestamp: serverTimestamp(),
        cashierId: auth.currentUser?.uid || '',
        cashierName: userProfile.displayName || '',
        operator: formData.operator,
        type: formData.type,
        amount: parsedAmount,
        commission: parsedCommission,
        feesPaid: parsedFees,
        clientPhone: formData.clientPhone,
        clientName: formData.clientName,
        referenceId: formData.referenceId,
        status: formData.status,
        notes: formData.notes,
        countryCode: selectedCountry,
        merchantNumber: configuredMerchant
      };

      await addDoc(collection(db, 'mobileTransactions'), txData);

      // Log to general audit
      await logAction(
        userProfile.storeId,
        auth.currentUser?.uid || '',
        userProfile.displayName || '',
        AuditAction.STOCK_ADJUSTMENT,
        `Transaction mobile: ${formData.type === 'deposit' ? 'Envoi' : 'Retrait'} de ${parsedAmount} ${currentCountry.currency} via ${formData.operator.toUpperCase()} [Marchand: ${configuredMerchant}]`,
        txData
      );

      // Close modal and reset form
      setIsModalOpen(false);
      setFormData({
        operator: operators[0]?.id || '',
        type: 'deposit',
        amount: '',
        commission: '',
        feesPaid: '',
        clientPhone: '',
        clientName: '',
        referenceId: '',
        status: 'completed',
        notes: ''
      });
      setSelectedClient(null);

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'mobileTransactions');
    }
  };

  // Delete transaction (Admin only)
  const handleDeleteTransaction = async (id: string, currentAmount: number, opType: string) => {
    if (userRole !== 'admin') {
      alert("Permission refusée. Réservé aux administrateurs.");
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette transaction ? Cette action affectera l'historique financier.")) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'mobileTransactions', id));

      await logAction(
        userProfile?.storeId || '',
        auth.currentUser?.uid || '',
        userProfile?.displayName || '',
        AuditAction.SALE_VOID,
        `Suppression de la transaction mobile #${id} (Montant: ${currentAmount} ${currentCountry.currency}, Type: ${opType})`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `mobileTransactions/${id}`);
    }
  };

  // Live Current balance calculation based on: Initial float + Withdrawals - Deposits
  const calculateCurrentBalance = (opId: string, countryCode: string) => {
    const key = `${countryCode}_${opId}`;
    const startingFloat = floats[key] || floats[opId] || 0; // support legacy dynamic keys if any
    
    // Sum completed deposits/withdrawals for this operator & country
    const stats = transactions
      .filter(tx => tx.operator === opId && tx.status === 'completed' && (!tx.countryCode || tx.countryCode === countryCode));

    const totalDeposits = stats
      .filter(tx => tx.type === 'deposit')
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const totalWithdrawals = stats
      .filter(tx => tx.type === 'withdrawal')
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    return startingFloat + totalWithdrawals - totalDeposits;
  };

  // Overall statistics filtered by target country
  const filteredTransactions = transactions.filter(tx => {
    const term = searchQuery.toLowerCase();
    const phoneMatch = tx.clientPhone?.toLowerCase().includes(term);
    const nameMatch = tx.clientName?.toLowerCase().includes(term);
    const refMatch = tx.referenceId?.toLowerCase().includes(term);
    const notesMatch = tx.notes?.toLowerCase().includes(term);
    const searchMatch = !searchQuery || phoneMatch || nameMatch || refMatch || notesMatch;

    const opMatch = operatorFilter === 'all' || tx.operator === operatorFilter;
    const typeMatch = typeFilter === 'all' || tx.type === typeFilter;
    const statusMatch = statusFilter === 'all' || tx.status === statusFilter;

    // Direct filter for active CEDEAO country profile
    const countryMatch = !tx.countryCode || tx.countryCode === selectedCountry;

    return searchMatch && opMatch && typeMatch && statusMatch && countryMatch;
  });

  const totalCommissions = filteredTransactions
    .filter(tx => tx.status === 'completed')
    .reduce((sum, tx) => sum + (tx.commission || 0), 0);

  const totalDepositsAmount = filteredTransactions
    .filter(tx => tx.type === 'deposit' && tx.status === 'completed')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const totalWithdrawalsAmount = filteredTransactions
    .filter(tx => tx.type === 'withdrawal' && tx.status === 'completed')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Exporters
  const handleExportCSV = () => {
    const headers = ['Date', 'Operateur', 'Type', 'Montant', 'Commission', 'Frais Client', 'Client', 'Ref Operateur', 'N° Marchand', 'Statut'];
    const rows = filteredTransactions.map(tx => {
      const date = tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleDateString('fr-FR') : 'N/A';
      const op = operators.find(o => o.id === tx.operator)?.name || tx.operator;
      const typeStr = tx.type === 'deposit' ? 'ENVOI' : 'RETRAIT';
      return [
        date,
        op,
        typeStr,
        tx.amount,
        tx.commission,
        tx.feesPaid,
        `${tx.clientName || ''} (${tx.clientPhone})`,
        tx.referenceId,
        tx.merchantNumber || 'N/A',
        tx.status.toUpperCase()
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${selectedCountry}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportPDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`MARKET PRO - Transactions ${currentCountry.name}`, 15, 20);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Rapport Mobile Money CEDEAO • Date: ${new Date().toLocaleDateString('fr-FR')}`, 15, 26);
    pdf.line(15, 30, 195, 30);

    // Summary block
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text("RECAPITULATIF FINANCIER EN " + currentCountry.currency, 15, 40);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Total Envois (Dépôts): ${totalDepositsAmount.toLocaleString('de-DE')} ${currentCountry.currency}`, 15, 47);
    pdf.text(`Total Retraits: ${totalWithdrawalsAmount.toLocaleString('de-DE')} ${currentCountry.currency}`, 15, 53);
    pdf.text(`Total Commissions Portefeuille: ${totalCommissions.toLocaleString('de-DE')} ${currentCountry.currency}`, 15, 59);

    autoTable(pdf, {
      startY: 70,
      head: [['Date', 'Operateur', 'Type', `Montant (${currentCountry.currency})`, 'Commission', 'Client', 'N° Marchand', 'Statut']],
      body: filteredTransactions.map(tx => [
        tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleDateString('fr-FR') : 'N/A',
        operators.find(o => o.id === tx.operator)?.name || tx.operator,
        tx.type === 'deposit' ? 'ENVOI' : 'RETRAIT',
        tx.amount.toLocaleString('de-DE'),
        tx.commission.toLocaleString('de-DE'),
        `${tx.clientName || 'Inconnu'} (${tx.clientPhone})`,
        tx.merchantNumber || 'Inconnu',
        tx.status.toUpperCase()
      ]),
      headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255] }
    });

    pdf.save(`rapport_mobile_${selectedCountry}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <Smartphone className="text-orange-500 animate-pulse" size={36} />
            Transactions Mobiles CEDEAO
          </h1>
          <p className="text-gray-500 font-medium">Gestion multi-pays des envois, retraits, numéros marchands et commissions.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsFloatModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-white text-gray-900 border border-gray-100 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <PiggyBank size={18} className="text-indigo-600" />
            Caisses & SIM Marchands
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 px-6 py-3 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-wider text-[11px] hover:bg-orange-700 hover:shadow-2xl hover:shadow-orange-600/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            Nouvelle Opération
          </button>
        </div>
      </div>

      {/* CEDEAO Countries row */}
      <div className="bg-slate-50 border border-slate-100 p-5 rounded-[32px]">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1 flex items-center gap-1.5 font-mono">
          <Globe size={14} className="text-indigo-500" />
          Sélecteur de pays CEDEAO (Afrique de l'Ouest)
        </h3>
        <div className="flex flex-wrap gap-2.5">
          {CEDEAO_COUNTRIES.map(country => {
            const isSelected = selectedCountry === country.code;
            const txCount = transactions.filter(t => t.countryCode === country.code).length;
            return (
              <button
                key={`country-chip-${country.code}`}
                onClick={() => handleCountryChange(country.code)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  isSelected 
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20 scale-102' 
                    : 'bg-white hover:bg-slate-100 border border-slate-100 text-slate-700 shadow-sm'
                }`}
              >
                <span className="text-lg">{country.flag}</span>
                <span>{country.name}</span>
                {txCount > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {txCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Operator Float Balances (Grid for selected country) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {operators.map(op => {
          const bal = calculateCurrentBalance(op.id, selectedCountry);
          const merchantKey = `${selectedCountry}_${op.id}`;
          const currentMerchant = merchantNumbers[merchantKey] || '';
          
          return (
            <motion.div 
              key={`float-card-${op.id}`} 
              whileHover={{ y: -4, transition: { duration: 0.15 } }}
              className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between relative group"
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`w-8 h-8 rounded-xl ${op.bg} text-white flex items-center justify-center font-black text-xs shadow-md`}>
                  {op.logoText}
                </span>
                <span className="text-[9px] uppercase font-black tracking-widest text-gray-400 font-mono">Caisses SIM</span>
              </div>
              <div>
                <span className="text-sm font-bold text-gray-700 block leading-tight">{op.name}</span>
                <span className="text-lg font-black font-mono text-gray-900 mt-1 block">
                  {bal.toLocaleString('de-DE')} {currentCountry.currency}
                </span>
                
                {/* Visual merchant simulation identifier */}
                <div className="mt-3.5 pt-3 border-t border-slate-50">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Numéro Marchand</span>
                  {currentMerchant ? (
                    <span className="text-xs font-black text-orange-600 font-mono tracking-wide block mt-0.5 flex items-center gap-1">
                      <Phone size={11} className="text-slate-400" />
                      {currentMerchant}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 italic block mt-0.5">Non configuré</span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {operators.length === 0 && (
          <div className="col-span-full p-8 bg-white border border-dashed rounded-3xl text-center text-slate-400">
            Aucun opérateur mobile disponible pour ce pays.
          </div>
        )}
      </div>

      {/* Stats Summary Cards for selected state */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-500 font-bold tracking-wider uppercase block">Total Envois ({currentCountry.currency})</span>
            <span className="text-2xl font-black text-gray-900 font-mono mt-0.5 block">
              {totalDepositsAmount.toLocaleString('de-DE')} {currentCountry.currency}
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-teal-50 text-teal-600 rounded-2xl">
            <TrendingDown size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-500 font-bold tracking-wider uppercase block">Total Retraits ({currentCountry.currency})</span>
            <span className="text-2xl font-black text-gray-900 font-mono mt-0.5 block">
              {totalWithdrawalsAmount.toLocaleString('de-DE')} {currentCountry.currency}
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Coins size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-500 font-bold tracking-wider uppercase block">Commissions ({currentCountry.currency})</span>
            <span className="text-2xl font-black text-emerald-600 font-mono mt-0.5 block">
              +{totalCommissions.toLocaleString('de-DE')} {currentCountry.currency}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table & Filters */}
      <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
        {/* Header / Search Filters block */}
        <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex-1 max-w-md relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
            <input 
              type="text"
              placeholder="Rechercher par numéro, nom client, opérateur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100/50 transition-all font-sans"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select 
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-700 outline-none cursor-pointer focus:border-orange-500"
            >
              <option value="all">Opérateurs (Tous)</option>
              {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>

            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-700 outline-none cursor-pointer focus:border-orange-500"
            >
              <option value="all">Type (Tous)</option>
              <option value="deposit">Envois</option>
              <option value="withdrawal">Retraits</option>
            </select>

            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-700 outline-none cursor-pointer focus:border-orange-500"
            >
              <option value="all">Statut (Tous)</option>
              <option value="completed">Complété</option>
              <option value="pending">En attente</option>
              <option value="failed">Échoué</option>
            </select>

            <button 
              onClick={handleExportCSV}
              className="p-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              title="Exporter en CSV"
            >
              <FileSpreadsheet size={16} className="text-green-600" />
            </button>
            <button 
              onClick={handleExportPDF}
              className="p-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              title="Exporter en PDF"
            >
              <FileBox size={16} className="text-red-500" />
            </button>
          </div>
        </div>

        {/* Responsive Table of historical records of the selected country */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 text-left">
                <th className="px-8 py-5 text-[10px] font-black tracking-widest text-gray-400 uppercase">Date & Heure</th>
                <th className="px-8 py-5 text-[10px] font-black tracking-widest text-gray-400 uppercase">Client</th>
                <th className="px-8 py-5 text-[10px] font-black tracking-widest text-gray-400 uppercase">Opérateur</th>
                <th className="px-8 py-5 text-[10px] font-black tracking-widest text-gray-400 uppercase">N° Marchand</th>
                <th className="px-8 py-5 text-[10px] font-black tracking-widest text-gray-400 uppercase">Type</th>
                <th className="px-8 py-5 text-[10px] font-black tracking-widest text-gray-400 uppercase text-right">Montant</th>
                <th className="px-8 py-5 text-[10px] font-black tracking-widest text-gray-400 uppercase text-right">Commission</th>
                <th className="px-8 py-5 text-[10px] font-black tracking-widest text-gray-400 uppercase">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black tracking-widest text-gray-400 uppercase">Gestion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTransactions.map(tx => {
                const dateObj = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date(tx.timestamp);
                const isDeposit = tx.type === 'deposit';
                const op = operators.find(o => o.id === tx.operator);

                return (
                  <tr key={`mobile-tx-${tx.id}`} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900">
                          {isNaN(dateObj.getTime()) ? 'À l\'instant' : dateObj.toLocaleDateString('fr-FR')}
                        </span>
                        <span className="text-[10px] font-black text-gray-400 font-mono uppercase mt-0.5">
                          {isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleTimeString('fr-FR')}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900">{tx.clientName || 'Client de passage'}</span>
                        <span className="text-[10px] font-black text-orange-500 font-mono mt-0.5 tracking-wider flex items-center gap-1">
                          <Phone size={10} />
                          {tx.clientPhone || 'Aucun'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg ${op?.bg || 'bg-slate-750'} text-white flex items-center justify-center font-black text-[9px]`}>
                          {op?.logoText || 'M'}
                        </span>
                        <span className="text-xs font-bold text-gray-800">{op?.name || tx.operator}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-black font-mono text-gray-600 bg-slate-50 border border-slate-100 px-2 py-1 rounded-xl">
                        {tx.merchantNumber || 'N/A'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        isDeposit 
                          ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                          : 'bg-teal-50 text-teal-700 border border-teal-100'
                      }`}>
                        <ArrowRightLeft size={10} />
                        {isDeposit ? 'Envoi' : 'Retrait'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right font-black font-mono text-xs text-gray-900">
                      {tx.amount.toLocaleString('de-DE')} {currentCountry.currency[0]}
                    </td>
                    <td className="px-8 py-6 text-right font-black font-mono text-xs text-emerald-600">
                      +{tx.commission.toLocaleString('de-DE')} {currentCountry.currency[0]}
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        tx.status === 'completed' 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : tx.status === 'pending'
                            ? 'bg-orange-50 text-orange-600 animate-pulse'
                            : 'bg-red-50 text-red-600'
                      }`}>
                        {tx.status === 'completed' ? <CheckCircle size={10} /> : tx.status === 'pending' ? <Clock size={10} /> : <XCircle size={10} />}
                        {tx.status === 'completed' ? 'Traité' : tx.status === 'pending' ? 'Attente' : 'Échoué'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        {userRole === 'admin' && (
                          <button 
                            onClick={() => handleDeleteTransaction(tx.id, tx.amount, tx.type)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Supprimer la transaction"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-8 py-16 text-center text-gray-400 opacity-60">
                    <Smartphone size={48} className="mx-auto mb-4 animate-bounce" />
                    <p className="font-bold text-sm">Aucune transaction enregistrée pour {currentCountry.name} ({currentCountry.flag})</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Initial Float & Merchant numbers Modal */}
      <AnimatePresence>
        {isFloatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" 
              onClick={() => setIsFloatModalOpen(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative bg-white w-full max-w-lg rounded-[36px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Settings className="text-indigo-500 animate-spin-slow" size={24} />
                    Configuration de {currentCountry.name} ({currentCountry.flag})
                  </h2>
                  <p className="text-gray-500 font-bold italic text-[10px] mt-1">Configurez le solde de départ SIM et fixez vos numéros marchands.</p>
                </div>
                <button 
                  onClick={() => setIsFloatModalOpen(false)} 
                  className="p-2 hover:bg-white hover:shadow-lg rounded-full transition-all"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSaveAdjustments} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-4">
                  {operators.map(op => {
                    const key = `${selectedCountry}_${op.id}`;
                    return (
                      <div key={`adjust-float-${op.id}`} className="p-4 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-7 h-7 rounded-lg ${op.bg} text-white flex items-center justify-center font-black text-[10px]`}>
                              {op.logoText}
                            </span>
                            <span className="text-xs font-black text-slate-800">{op.name}</span>
                          </div>
                          <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">{currentCountry.currency}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          {/* Float Balance */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Solde Caisse SIM</label>
                            <input 
                              type="number"
                              value={adjustFormData.balances[key] || 0}
                              onChange={(e) => setAdjustFormData({
                                ...adjustFormData,
                                balances: {
                                  ...adjustFormData.balances,
                                  [key]: parseFloat(e.target.value) || 0
                                }
                              })}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            />
                          </div>
                          
                          {/* Merchant Number */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">N° Marchand / Puce / SIM</label>
                            <input 
                              type="text"
                              placeholder="Ex: 771234567"
                              value={adjustFormData.merchants[key] || ''}
                              onChange={(e) => setAdjustFormData({
                                ...adjustFormData,
                                merchants: {
                                  ...adjustFormData.merchants,
                                  [key]: e.target.value
                                }
                              })}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {operators.length === 0 && (
                    <div className="text-center p-6 text-gray-400">
                      Aucun opérateur configurable.
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button 
                    type="button" 
                    onClick={() => setIsFloatModalOpen(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-900 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={14} />
                    Enregistrer {currentCountry.currency}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" 
              onClick={() => setIsModalOpen(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative bg-white w-full h-full sm:h-auto sm:max-w-xl sm:rounded-[36px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
            >
              <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">Opération Mobile • {currentCountry.name} ({currentCountry.flag})</h2>
                  <p className="text-gray-500 font-bold italic text-[10px] mt-1">Saisie d'un envoi ou retrait d'argent avec identification marchand.</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 hover:bg-white hover:shadow-lg rounded-full transition-all group"
                >
                  <X size={20} className="text-gray-300 group-hover:text-gray-900" />
                </button>
              </div>

              <form onSubmit={handleSubmitTransaction} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                {/* Operator Selector for active country */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">Choix de l'opérateur local</label>
                  <div className="grid grid-cols-4 gap-2">
                    {operators.map(op => {
                      const selected = formData.operator === op.id;
                      return (
                        <button
                          key={`btn-op-${op.id}`}
                          type="button"
                          onClick={() => setFormData({ ...formData, operator: op.id })}
                          className={`py-3.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                            selected 
                              ? `${op.bg} text-white shadow-lg scale-102` 
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                            selected ? 'bg-white/20 text-white' : `${op.bg} text-white`
                          }`}>
                            {op.logoText}
                          </span>
                          <span className="text-[9px] font-black mt-1 leading-none">{op.name.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Display/Warn of Merchant Number associated */}
                {(() => {
                  const activeMerchant = merchantNumbers[`${selectedCountry}_${formData.operator}`] || '';
                  return activeMerchant ? (
                    <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone size={16} className="text-emerald-600 animate-pulse" />
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500 block leading-none">Numéro Marchand Fixé</span>
                          <span className="text-xs font-black font-mono mt-0.5 block leading-tight">{activeMerchant}</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg">Prêt</span>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-amber-50 text-amber-800 border border-amber-100 rounded-2xl flex items-center gap-2">
                      <AlertCircle size={16} className="text-amber-600" />
                      <div className="flex-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 block leading-none">Aucun n° marchand</span>
                        <span className="text-xs font-bold mt-0.5 block">Veuillez configurer un numéro marchand via le menu "Caisses & SIM Marchands".</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Operation Type */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 font-mono">Type d'opération</label>
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1.5 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'deposit' })}
                        className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                          formData.type === 'deposit' 
                            ? 'bg-orange-500 text-white shadow-sm' 
                            : 'text-gray-700 hover:text-gray-900'
                        }`}
                      >
                        Envoi (Dépôt)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'withdrawal' })}
                        className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                          formData.type === 'withdrawal' 
                            ? 'bg-teal-600 text-white shadow-sm' 
                            : 'text-gray-700 hover:text-gray-900'
                        }`}
                      >
                        Retrait
                      </button>
                    </div>
                  </div>

                  {/* Flow Status */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 font-mono">Statut Initial</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl text-xs font-bold outline-none text-gray-750 focus:bg-white focus:border-orange-500"
                    >
                      <option value="completed">Complété (Traité)</option>
                      <option value="pending">En attente (Pending)</option>
                      <option value="failed">Échoué</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Amount */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 font-mono">Montant ({currentCountry.currency})</label>
                    <input 
                      required
                      type="number"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      autoFocus
                      placeholder="0"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl font-black text-sm text-gray-900 outline-none focus:bg-white focus:border-orange-500"
                    />
                  </div>

                  {/* Customer Fees paid */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 font-mono">Frais Facturés</label>
                    <input 
                      type="number"
                      value={formData.feesPaid}
                      onChange={e => setFormData({ ...formData, feesPaid: e.target.value })}
                      placeholder="Déduit auto"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl font-bold text-xs text-gray-900 outline-none focus:bg-white focus:border-orange-500"
                    />
                  </div>

                  {/* Operator Commission Earned */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 font-mono">Commission Gérant (+)</label>
                    <input 
                      type="number"
                      value={formData.commission}
                      onChange={e => setFormData({ ...formData, commission: e.target.value })}
                      placeholder="Estimé"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl font-bold text-xs text-emerald-600 outline-none focus:bg-white focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Client Link */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 font-mono">Associer à un client (Optionnel)</label>
                    <span className="text-[9px] text-orange-500 font-bold flex items-center gap-1">
                      <UserPlus size={10} />
                      Fiche client
                    </span>
                  </div>
                  <select
                    onChange={(e) => handleSelectClient(e.target.value)}
                    value={selectedClient?.id || ''}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-orange-500"
                  >
                    <option value="">-- Sélectionner un client de votre boutique --</option>
                    {clients.map(c => (
                      <option key={`client-opt-${c.id}`} value={c.id}>
                        {c.name} ({c.phone || 'Pas de numéro'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone number */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 font-mono">Numéro destinataire / émetteur</label>
                    <input 
                      required
                      type="tel"
                      value={formData.clientPhone}
                      onChange={e => setFormData({ ...formData, clientPhone: e.target.value })}
                      placeholder="Ex: 771234567"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl font-bold text-xs text-gray-900 outline-none focus:bg-white focus:border-orange-500 font-mono"
                    />
                  </div>

                  {/* Client Name manually */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 font-mono">Nom complet du client</label>
                    <input 
                      type="text"
                      value={formData.clientName}
                      onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                      placeholder="Client de passage..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl font-bold text-xs text-gray-900 outline-none focus:bg-white focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Reference Operator transaction ID */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 font-mono">ID Référence Opérateur (Reçu)</label>
                    <input 
                      type="text"
                      value={formData.referenceId}
                      onChange={e => setFormData({ ...formData, referenceId: e.target.value })}
                      placeholder="Ex: TXN1039827..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl font-bold text-xs text-gray-900 outline-none focus:bg-white focus:border-orange-500 font-mono"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 font-mono">Notes d'opération</label>
                    <input 
                      type="text"
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Remarques éventuelles..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl font-bold text-xs text-gray-900 outline-none focus:bg-white focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-100">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-900 rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-gray-200 transition-all active:scale-95 animate-pulse"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-black hover:shadow-2xl hover:shadow-gray-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Check size={16} />
                    Valider {formData.type === 'deposit' ? "L'Envoi" : "Le Retrait"}
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
