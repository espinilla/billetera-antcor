import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Search, Home, PieChart, ArrowUpRight, ArrowDownLeft, Trash2, X, Cloud, CloudOff, Loader2, LogIn, UserCircle, TrendingUp, TrendingDown, DollarSign, ShieldCheck, Calendar, History, Lock, Tag, AlertCircle, RotateCcw, Users, Coffee, Briefcase, Ban, Filter, Info, ArrowLeftRight } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  setPersistence,
  browserLocalPersistence 
} from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = typeof window !== 'undefined' && window.__firebase_config 
  ? JSON.parse(window.__firebase_config) 
  : {
      apiKey: "AIzaSyDZdScsyfbFZvJxToBOVatXO42l0kWbRcc",
      authDomain: "todomaletines-cotizar.firebaseapp.com",
      projectId: "todomaletines-cotizar",
      storageBucket: "todomaletines-cotizar.firebasestorage.app",
      messagingSenderId: "992361155942",
      appId: "1:992361155942:web:2cb1d605f3f4e86b8ecca7"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'todomaletines-billetera';

// --- ESTRUCTURA DE BOLSILLOS ---
const BUCKETS = [
  { id: 'NEGOCIO_RAFAEL', label: 'NEGOCIO RAFAEL', color: 'bg-[#002A8D]', icon: <Briefcase size={14}/> },
  { id: 'NEGOCIO_CANO', label: 'NEGOCIO CANO', color: 'bg-orange-500', icon: <Users size={14}/> },
  { id: 'PERSONAL_RAFAEL', label: 'PERSONAL (GASTOS)', color: 'bg-emerald-600', icon: <Coffee size={14}/> }
];

const formatMoney = (amount) => {
  const formatted = Math.abs(amount || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const absVal = `S/ ${formatted}`;
  return amount < 0 ? `- ${absVal}` : absVal;
};

const formatDate = (dateString) => {
  if (!dateString) return '---';
  return new Date(dateString).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
};

export default function BilleteraApp() {
  const [user, setUser] = useState(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('home'); 
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('ingreso'); 
  const [isSyncing, setIsSyncing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBucket, setFilterBucket] = useState('ALL'); 
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [formData, setFormData] = useState({ 
    amount: '', 
    entity: '', 
    concept: '', 
    method: 'YAPE', 
    bucket: 'NEGOCIO_RAFAEL',
    toBucket: 'PERSONAL_RAFAEL' 
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        if (typeof window !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        }
      } catch (e) { console.error(e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoadingApp(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    setIsSyncing(true);
    const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'billetera_antcor');
    return onSnapshot(txRef, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
      setIsSyncing(false);
    }, (error) => {
      console.error(error);
      setIsSyncing(false);
    });
  }, [user]);

  // --- CÁLCULOS DE SALDO ACTUAL ---
  const balances = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      if (tx.status === 'anulado') return acc;
      const amt = parseFloat(tx.amount) || 0;
      const typeAmt = tx.type === 'ingreso' ? amt : -amt;
      const bucket = tx.bucket || 'NEGOCIO_RAFAEL';
      
      if (bucket === 'NEGOCIO_RAFAEL') acc.rafael += typeAmt;
      if (bucket === 'NEGOCIO_CANO') acc.cano += typeAmt;
      if (bucket === 'PERSONAL_RAFAEL') acc.personal += typeAmt;
      
      acc.total += typeAmt;
      return acc;
    }, { rafael: 0, cano: 0, personal: 0, total: 0 });
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let base = transactions;
    if (filterBucket !== 'ALL') base = base.filter(tx => (tx.bucket || 'NEGOCIO_RAFAEL') === filterBucket);
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      base = base.filter(tx => (tx.entity?.toLowerCase() || '').includes(t) || (tx.concept?.toLowerCase() || '').includes(t));
    }
    return searchTerm || filterBucket !== 'ALL' ? base : base.slice(0, 50);
  }, [transactions, searchTerm, filterBucket]);

  // --- AUDITORÍA HISTÓRICA ---
  const auditResult = useMemo(() => {
    const dayEnd = new Date(auditDate + "T23:59:59-05:00");
    const dayStart = new Date(auditDate + "T00:00:00-05:00");
    
    return transactions.reduce((acc, tx) => {
      const txDate = new Date(tx.date);
      const bucket = tx.bucket || 'NEGOCIO_RAFAEL';
      const amt = parseFloat(tx.amount) || 0;
      const typeAmt = tx.type === 'ingreso' ? amt : -amt;

      if (txDate <= dayEnd && tx.status !== 'anulado') {
        if (bucket === 'NEGOCIO_RAFAEL') acc.history.rafael += typeAmt;
        if (bucket === 'NEGOCIO_CANO') acc.history.cano += typeAmt;
        if (bucket === 'PERSONAL_RAFAEL') acc.history.personal += typeAmt;
        acc.history.total += typeAmt;
      }

      if (txDate >= dayStart && txDate <= dayEnd) {
        acc.list.push(tx);
      }

      return acc;
    }, { 
      history: { rafael: 0, cano: 0, personal: 0, total: 0 },
      list: [] 
    });
  }, [transactions, auditDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0 || !user) return;

    if (formType === 'transfer' && formData.bucket === formData.toBucket) {
      alert("Rafael, no puedes transferir al mismo bolsillo de origen.");
      return;
    }

    const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'billetera_antcor');

    try {
      if (formType === 'transfer') {
        await addDoc(txRef, {
          type: 'gasto',
          amount: amt,
          entity: 'TRANSFERENCIA INTERNA',
          concept: `MOVIMIENTO A ${formData.toBucket.split('_')[0]}`,
          method: 'INTERNO',
          bucket: formData.bucket,
          status: 'activo',
          date: new Date().toISOString()
        });
        await addDoc(txRef, {
          type: 'ingreso',
          amount: amt,
          entity: 'TRANSFERENCIA INTERNA',
          concept: `RECIBIDO DE ${formData.bucket.split('_')[0]}`,
          method: 'INTERNO',
          bucket: formData.toBucket,
          status: 'activo',
          date: new Date().toISOString()
        });
      } else {
        await addDoc(txRef, {
          type: formType,
          amount: amt,
          entity: formData.entity.toUpperCase(),
          concept: formData.concept.toUpperCase(),
          method: formData.method,
          bucket: formData.bucket,
          status: 'activo',
          date: new Date().toISOString()
        });
      }
      setFormData({ ...formData, amount: '', entity: '', concept: '' });
      setShowForm(false);
    } catch (error) { alert(error.message); }
  };

  const toggleAnular = async (id, currentStatus) => {
    if (!user) return;
    const msg = currentStatus === 'anulado' ? '¿Reactivar este registro?' : '¿Anular este registro? No se borrará del historial.';
    if (window.confirm(msg)) {
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'billetera_antcor', id), { 
          status: currentStatus === 'anulado' ? 'activo' : 'anulado'
        });
      } catch (error) { alert(error.message); }
    }
  };

  const handleSignOut = async () => {
    setShowProfile(false);
    await signOut(auth);
    window.location.reload();
  };

  if (loadingApp) return <div className="flex h-screen items-center justify-center bg-[#002A8D] text-white"><Loader2 className="animate-spin" /></div>;

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-[#002A8D] p-6 text-center">
      <div className="bg-white p-10 rounded-[3rem] w-full max-w-sm shadow-2xl border-t-8 border-orange-500">
        <Wallet size={64} className="text-[#002A8D] mx-auto mb-4" />
        <h1 className="text-3xl font-black mb-6 uppercase italic tracking-tighter leading-none">Antcor<br/>Auditor Cloud</h1>
        <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full bg-[#002A8D] text-white py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg">Entrar con Google</button>
      </div>
    </div>
  );

  return (
    <div className="flex justify-center bg-gray-900 min-h-screen font-sans select-none">
      <div className="w-full max-w-md bg-white shadow-2xl relative flex flex-col h-screen overflow-hidden">
        
        {/* HEADER: SALDOS VIVOS */}
        <div className="bg-[#002A8D] text-white p-5 pb-6 rounded-b-[2.5rem] shadow-lg shrink-0 relative overflow-hidden transition-all">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="flex justify-between items-center mb-6 relative">
            <span className="text-[10px] font-black tracking-widest uppercase italic flex items-center gap-2">
               <ShieldCheck size={16} className="text-green-400" /> Auditoría Multicaja
            </span>
            <button onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-full border-2 border-white/20 overflow-hidden bg-white/10 flex items-center justify-center">
              {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <UserCircle size={24} />}
            </button>
          </div>

          <div className="space-y-2 mb-4">
             <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/5 shadow-inner">
                <span className="text-[9px] font-black uppercase text-blue-200 flex items-center gap-2 tracking-tighter italic"><Briefcase size={12}/> NEGOCIO RAFAEL</span>
                <span className="text-xl font-black">{formatMoney(balances.rafael)}</span>
             </div>
             <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[8px] font-black uppercase text-blue-200 flex items-center gap-1 mb-1 truncate italic"><Users size={10}/> CANO</span>
                  <span className="text-sm font-black block truncate">{formatMoney(balances.cano)}</span>
                </div>
                <div className={`p-3 rounded-xl border transition-all ${balances.personal < 0 ? 'bg-red-500/30 border-red-400' : 'bg-emerald-500/10 border-white/5'}`}>
                  <span className="text-[8px] font-black uppercase text-blue-200 flex items-center gap-1 mb-1 truncate italic"><Coffee size={10}/> PERSONAL</span>
                  <span className={`text-sm font-black block truncate ${balances.personal < 0 ? 'text-red-200' : 'text-emerald-400'}`}>{formatMoney(balances.personal)}</span>
                </div>
             </div>
          </div>

          <div className="flex justify-between items-center pt-2 relative">
             <div className="text-left opacity-60">
                <p className="text-[8px] font-black uppercase text-blue-300">Total en Banco</p>
                <p className="text-xl font-black">{formatMoney(balances.total)}</p>
             </div>
             <div className="flex gap-2">
                <button onClick={() => { setFormType('transfer'); setShowForm(true); }} className="bg-blue-500/20 hover:bg-blue-500 text-white p-3 rounded-xl border border-blue-400/30 transition-all active:scale-95 shadow-sm">
                  <ArrowLeftRight size={20} />
                </button>
                <button onClick={() => { setFormType('ingreso'); setShowForm(true); }} className="bg-green-500 text-white p-3 rounded-xl shadow-lg active:scale-95">
                  <ArrowDownLeft size={20} />
                </button>
                <button onClick={() => { setFormType('gasto'); setShowForm(true); }} className="bg-red-500 text-white p-3 rounded-xl shadow-lg active:scale-95">
                  <ArrowUpRight size={20} />
                </button>
             </div>
          </div>
        </div>

        {/* LISTADO Y DATA */}
        <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col pb-24 no-scrollbar">
          {activeTab === 'home' && (
            <div className="p-4 space-y-4 animate-in fade-in duration-300">
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sticky top-0 bg-gray-50 z-10 py-1">
                <button onClick={() => setFilterBucket('ALL')} className={`shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${filterBucket === 'ALL' ? 'bg-gray-800 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-100'}`}>TODOS</button>
                {BUCKETS.map(b => (
                  <button key={b.id} onClick={() => setFilterBucket(b.id)} className={`shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase flex items-center gap-2 transition-all ${filterBucket === b.id ? 'bg-[#002A8D] text-white shadow-md' : 'bg-white text-gray-400 border border-gray-100'}`}>
                    {b.icon} {b.label.split(' ')[0]}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative transition-all active:scale-[0.98] ${tx.status === 'anulado' ? 'opacity-20 grayscale' : ''}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${BUCKETS.find(b => b.id === tx.bucket)?.color || 'bg-gray-400'}`}>
                        {BUCKETS.find(b => b.id === tx.bucket)?.icon || <Tag size={14}/>}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-black text-gray-800 text-[11px] uppercase italic truncate leading-tight">{tx.entity}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{tx.concept}</p>
                        <p className="text-[8px] text-blue-500 font-black uppercase mt-1 tracking-tighter leading-none">{formatDate(tx.date)} • {tx.method}</p>
                      </div>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className={`font-black text-sm tracking-tighter ${tx.type === 'gasto' ? 'text-gray-800' : 'text-green-600'}`}>
                        {tx.type === 'gasto' ? '- ' : '+ '}{formatMoney(tx.amount)}
                      </p>
                    </div>
                    <button onClick={() => toggleAnular(tx.id, tx.status)} className="absolute -right-1 -top-1 bg-white rounded-full p-1.5 shadow-md border border-gray-100 text-gray-300 hover:text-red-400 transition-colors">
                      {tx.status === 'anulado' ? <RotateCcw size={10} className="text-blue-500" /> : <Ban size={10} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="p-4 space-y-4 animate-in slide-in-from-right-4 duration-300">
              <input type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} className="w-full p-4 bg-white border-2 border-[#002A8D]/10 rounded-2xl font-black text-sm uppercase text-center outline-none italic" />
              
              <div className="bg-[#002A8D] p-6 rounded-3xl text-white text-center shadow-lg relative overflow-hidden">
                 <p className="text-[10px] font-black uppercase text-blue-200 mb-1 tracking-widest italic">Saldo Total al {formatDate(auditDate)}</p>
                 <p className="text-3xl font-black tracking-tighter">{formatMoney(auditResult.history.total)}</p>
                 <div className="grid grid-cols-3 gap-1 mt-4 border-t border-white/10 pt-4">
                    <div className="text-[8px] font-black uppercase italic">R: {formatMoney(auditResult.history.rafael)}</div>
                    <div className="text-[8px] font-black uppercase italic">C: {formatMoney(auditResult.history.cano)}</div>
                    <div className="text-[8px] font-black uppercase italic">P: {formatMoney(auditResult.history.personal)}</div>
                 </div>
              </div>

              <div className="space-y-2">
                 <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-1 italic">Movimientos del día</h2>
                 {auditResult.list.map(tx => (
                   <div key={tx.id} className={`bg-white p-3 rounded-xl border flex justify-between items-center text-[10px] font-bold uppercase ${tx.status === 'anulado' ? 'opacity-30 line-through' : ''}`}>
                      <span className="truncate pr-2">{tx.entity} ({tx.bucket?.split('_')[0]})</span>
                      <span className={`shrink-0 font-black ${tx.type === 'gasto' ? 'text-red-500' : 'text-green-600'}`}>
                         {tx.type === 'gasto' ? '- ' : '+ '}{formatMoney(tx.amount)}
                      </span>
                   </div>
                 ))}
                 {auditResult.list.length === 0 && <p className="text-center py-10 italic text-[10px] font-black uppercase text-gray-300">Sin actividad hoy</p>}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="p-6 space-y-6 animate-in zoom-in-95 duration-300">
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
                <h3 className="text-2xl font-black text-gray-900 mb-8 uppercase tracking-tighter italic leading-none">Resumen de<br/>Utilidades</h3>
                <div className="space-y-4">
                   <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100">
                      <p className="text-[10px] font-black text-blue-800 uppercase mb-2 tracking-widest italic">Negocio Rafael (Utilidad)</p>
                      <p className="text-2xl font-black text-blue-900 leading-none">{formatMoney(balances.rafael)}</p>
                   </div>
                   <div className="bg-orange-50 p-5 rounded-3xl border border-orange-100">
                      <p className="text-[10px] font-black text-orange-800 uppercase mb-2 tracking-widest italic">Negocio Cano (Capital)</p>
                      <p className="text-2xl font-black text-orange-900 leading-none">{formatMoney(balances.cano)}</p>
                   </div>
                   <div className={`p-5 rounded-3xl border ${balances.personal < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                      <p className="text-[10px] font-black uppercase mb-2 tracking-widest italic">Bolsillo Personal</p>
                      <p className={`text-2xl font-black leading-none ${balances.personal < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatMoney(balances.personal)}</p>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* NAVEGACIÓN INFERIOR */}
        <div className="bg-white border-t border-gray-100 flex justify-around py-4 pb-8 absolute bottom-0 w-full z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-[#002A8D] scale-110' : 'text-gray-400 opacity-50'}`}>
            <Home size={22} /><span className="text-[9px] font-black uppercase italic">Flujo</span>
          </button>
          <button onClick={() => setActiveTab('audit')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'audit' ? 'text-[#002A8D] scale-110' : 'text-gray-400 opacity-50'}`}>
            <History size={22} /><span className="text-[9px] font-black uppercase italic">Data</span>
          </button>
          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'stats' ? 'text-[#002A8D] scale-110' : 'text-gray-400 opacity-50'}`}>
            <PieChart size={22} /><span className="text-[9px] font-black uppercase italic">Utilidad</span>
          </button>
        </div>

        {/* MODAL FORMULARIO */}
        {showForm && (
          <div className="absolute inset-0 z-50 flex items-end bg-[#00174f]/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full overflow-y-auto max-h-[90%]">
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h3 className={`text-xl font-black uppercase italic ${formType === 'ingreso' ? 'text-green-600' : formType === 'gasto' ? 'text-red-600' : 'text-blue-600'}`}>
                  {formType === 'transfer' ? 'Efectuar Transferencia' : `Registrar ${formType === 'ingreso' ? 'Entrada' : 'Salida'}`}
                </h3>
                <button onClick={() => setShowForm(false)} className="bg-gray-100 rounded-full p-2"><X size={24}/></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {formType === 'transfer' ? (
                  <div className="space-y-4">
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 leading-none">¿De qué caja sale?</p>
                     <select value={formData.bucket} onChange={(e) => setFormData({...formData, bucket: e.target.value})} className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl font-black uppercase text-xs outline-none">
                        {BUCKETS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                     </select>
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 leading-none">¿A qué caja entra?</p>
                     <select value={formData.toBucket} onChange={(e) => setFormData({...formData, toBucket: e.target.value})} className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl font-black uppercase text-xs outline-none">
                        {BUCKETS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                     </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {BUCKETS.map(b => (
                      <button key={b.id} type="button" onClick={() => setFormData({...formData, bucket: b.id})} className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all ${formData.bucket === b.id ? 'bg-[#002A8D] text-white border-[#002A8D] shadow-md' : 'bg-gray-50 text-gray-400 border-transparent hover:border-gray-200'}`}>
                         <span className="text-[11px] font-black uppercase tracking-widest">{b.label}</span>
                         {b.icon}
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative pt-2">
                  <span className="absolute left-0 bottom-4 text-3xl font-light text-gray-300">S/</span>
                  <input type="number" step="0.01" required autoFocus value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full border-b-4 border-gray-100 focus:border-[#002A8D] text-5xl font-black py-2 pl-10 outline-none transition-all placeholder-gray-100" placeholder="0.00" />
                </div>

                {formType !== 'transfer' && (
                  <div className="space-y-4">
                    {/* Selector de Método Reintegrado */}
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 leading-none">Medio de Pago:</p>
                       <div className="grid grid-cols-2 gap-2">
                          {['YAPE', 'PLIN', 'TRANSF.', 'EFECTIVO'].map(m => (
                            <button key={m} type="button" onClick={() => setFormData({...formData, method: m})} className={`py-4 rounded-2xl border-2 text-[10px] font-black uppercase transition-all active:scale-95 ${formData.method === m ? 'bg-gray-800 text-white border-gray-800 shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}>{m}</button>
                          ))}
                       </div>
                    </div>
                    <input type="text" required value={formData.entity} onChange={(e) => setFormData({...formData, entity: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-5 text-sm font-bold uppercase italic outline-none focus:border-[#002A8D]" placeholder="Nombre de Cliente / Proveedor / Personal" />
                    <input type="text" required value={formData.concept} onChange={(e) => setFormData({...formData, concept: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-5 text-sm font-bold uppercase italic outline-none focus:border-[#002A8D]" placeholder="Concepto Detallado (Ej. Pago 50 morrales)" />
                  </div>
                )}
                
                <button type="submit" className={`w-full py-6 rounded-[2.5rem] font-black text-white uppercase tracking-widest shadow-xl transition-all active:scale-95 italic ${formType === 'ingreso' ? 'bg-green-500 shadow-green-100' : formType === 'gasto' ? 'bg-red-500 shadow-red-100' : 'bg-blue-600 shadow-blue-100'}`}>
                  {formType === 'transfer' ? 'Efectuar Transferencia' : 'Guardar en Antcor Cloud'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* PERFIL */}
        {showProfile && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#00174f]/70 backdrop-blur-md p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-2xl text-center relative border-b-8 border-[#002A8D] animate-in zoom-in-95 duration-200">
              <button onClick={() => setShowProfile(false)} className="absolute top-8 right-8 text-gray-300 hover:text-gray-800 transition-colors"><X size={24}/></button>
              <div className="w-28 h-28 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 overflow-hidden border-4 border-blue-100 shadow-inner">
                {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <UserCircle size={56} className="text-blue-200" />}
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-1 italic uppercase tracking-tighter leading-none">{user?.displayName || 'Admin Antcor'}</h3>
              <p className="text-[10px] text-green-500 font-black uppercase mb-8 tracking-widest">Sincronización Cloud Activa</p>
              <button onClick={handleSignOut} className="w-full text-red-500 font-black text-xs uppercase tracking-widest py-5 border-2 border-red-50 rounded-2xl hover:bg-red-50 transition-all active:scale-95">Cerrar Sesión</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}