import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Search, Home, PieChart, ArrowUpRight, ArrowDownLeft, Trash2, X, Cloud, CloudOff, Loader2, LogIn, UserCircle, TrendingUp, TrendingDown, DollarSign, ShieldCheck, Calendar, History, Lock, Tag, AlertCircle, RotateCcw, Users, Coffee, Briefcase, Ban } from 'lucide-react';
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

// --- LOS 3 BOLSILLOS ---
const BUCKETS = [
  { id: 'NEGOCIO_RAFAEL', label: 'NEGOCIO RAFAEL', color: 'bg-[#002A8D]', icon: <Briefcase size={14}/> },
  { id: 'NEGOCIO_CANO', label: 'NEGOCIO CANO', color: 'bg-orange-500', icon: <Users size={14}/> },
  { id: 'PERSONAL_RAFAEL', label: 'PERSONAL (PAN/CARRO)', color: 'bg-emerald-600', icon: <Coffee size={14}/> }
];

// Formato de dinero robusto
const formatMoney = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return 'S/ 0.00';
  const formatted = Math.abs(amount).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const absMoney = `S/ ${formatted}`;
  return amount < 0 ? `- ${absMoney}` : absMoney;
};

const formatDate = (dateString) => {
  if (!dateString) return '---';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
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
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [formData, setFormData] = useState({ 
    amount: '', 
    entity: '', 
    concept: '', 
    method: 'YAPE', 
    bucket: 'NEGOCIO_RAFAEL' 
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        if (typeof window !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        }
      } catch (e) { console.error("Error Auth:", e); }
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
      console.error("Error Firestore:", error);
      setIsSyncing(false);
    });
  }, [user]);

  // --- CÁLCULOS DE SALDO ACTUAL (CON DEFENSA) ---
  const currentBalances = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      if (tx.status === 'anulado') return acc;
      const amount = parseFloat(tx.amount) || 0;
      const typeAmount = tx.type === 'ingreso' ? amount : -amount;
      
      // Defensa contra datos sin bucket del pasado
      const bucket = tx.bucket || 'NEGOCIO_RAFAEL'; 
      
      if (bucket === 'NEGOCIO_RAFAEL') acc.rafaelNegocio += typeAmount;
      if (bucket === 'NEGOCIO_CANO') acc.canoNegocio += typeAmount;
      if (bucket === 'PERSONAL_RAFAEL') acc.rafaelPersonal += typeAmount;
      acc.total += typeAmount;
      return acc;
    }, { rafaelNegocio: 0, canoNegocio: 0, rafaelPersonal: 0, total: 0 });
  }, [transactions]);

  // --- MÁQUINA DEL TIEMPO ---
  const auditResult = useMemo(() => {
    const selectedDate = new Date(auditDate + "T23:59:59-05:00");
    const historicalTxs = transactions.filter(tx => new Date(tx.date) <= selectedDate);
    
    return historicalTxs.reduce((acc, tx) => {
      const bucket = tx.bucket || 'NEGOCIO_RAFAEL';
      if (tx.status !== 'anulado') {
        const amount = parseFloat(tx.amount) || 0;
        const typeAmount = tx.type === 'ingreso' ? amount : -amount;
        if (bucket === 'NEGOCIO_RAFAEL') acc.rafaelNegocio += typeAmount;
        if (bucket === 'NEGOCIO_CANO') acc.canoNegocio += typeAmount;
        if (bucket === 'PERSONAL_RAFAEL') acc.rafaelPersonal += typeAmount;
        acc.total += typeAmount;
      }
      acc.list.push(tx);
      return acc;
    }, { rafaelNegocio: 0, canoNegocio: 0, rafaelPersonal: 0, total: 0, list: [] });
  }, [transactions, auditDate]);

  // Búsqueda robusta
  const filteredTransactions = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = transactions.filter(tx => 
      (tx.entity?.toLowerCase() || '').includes(term) || 
      (tx.concept?.toLowerCase() || '').includes(term) ||
      (tx.bucket?.toLowerCase() || '').includes(term)
    );
    return searchTerm ? filtered : filtered.slice(0, 50);
  }, [transactions, searchTerm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0 || !user) {
      alert("Rafael, el monto debe ser un número positivo.");
      return;
    }
    const newTransaction = {
      type: formType,
      amount: amount,
      entity: formData.entity,
      concept: formData.concept,
      method: formData.method,
      bucket: formData.bucket,
      status: 'activo',
      date: new Date().toISOString()
    };
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'billetera_antcor'), newTransaction);
      setFormData({ amount: '', entity: '', concept: '', method: 'YAPE', bucket: 'NEGOCIO_RAFAEL' });
      setShowForm(false);
    } catch (error) { alert(error.message); }
  };

  const toggleAnular = async (id, currentStatus) => {
    if (!user) return;
    const msg = currentStatus === 'anulado' ? '¿Reactivar?' : '¿Anular este registro?';
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
    <div className="flex h-screen items-center justify-center bg-[#002A8D] p-6 text-center text-white">
      <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-gray-800">
        <Wallet size={64} className="text-[#002A8D] mx-auto mb-4" />
        <h1 className="text-2xl font-black mb-6 uppercase italic tracking-tighter">Antcor Auditor Cloud</h1>
        <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full bg-[#002A8D] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
           Acceder con Google
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex justify-center bg-gray-900 min-h-screen font-sans">
      <div className="w-full max-w-md bg-white shadow-2xl relative flex flex-col h-screen overflow-hidden">
        
        {/* HEADER */}
        <div className="bg-[#002A8D] text-white p-5 pb-6 rounded-b-[2.5rem] shadow-lg shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="flex justify-between items-center mb-6 relative">
            <div className="flex items-center gap-2">
               <ShieldCheck size={16} className="text-green-400" />
               <span className="text-[10px] font-black tracking-widest uppercase italic leading-none">
                  {activeTab === 'audit' ? 'MODO AUDITORÍA' : 'ANTCOR CLOUD'}
               </span>
            </div>
            <button onClick={() => setShowProfile(true)} className="w-8 h-8 rounded-full border border-white/20 overflow-hidden bg-white/10 flex items-center justify-center">
              {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <UserCircle size={20} />}
            </button>
          </div>

          <div className="space-y-2 mb-6">
             <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/5">
                <span className="text-[8px] font-black uppercase text-blue-200 flex items-center gap-2"><Briefcase size={10}/> Rafael Negocio</span>
                <span className="text-sm font-black">{formatMoney(activeTab === 'audit' ? auditResult.rafaelNegocio : currentBalances.rafaelNegocio)}</span>
             </div>
             <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/5 opacity-80">
                <span className="text-[8px] font-black uppercase text-blue-200 flex items-center gap-2"><Users size={10}/> Cano Negocio</span>
                <span className="text-sm font-black">{formatMoney(activeTab === 'audit' ? auditResult.canoNegocio : currentBalances.canoNegocio)}</span>
             </div>
             <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/5">
                <span className="text-[8px] font-black uppercase text-blue-200 flex items-center gap-2"><Coffee size={10}/> Rafael Personal</span>
                <span className={`text-sm font-black ${ (activeTab === 'audit' ? auditResult.rafaelPersonal : currentBalances.rafaelPersonal) < 0 ? 'text-red-400' : 'text-emerald-400' }`}>
                  {formatMoney(activeTab === 'audit' ? auditResult.rafaelPersonal : currentBalances.rafaelPersonal)}
                </span>
             </div>
          </div>

          <div className="text-center bg-white/5 py-4 rounded-3xl border border-white/5">
             <p className="text-[9px] font-black uppercase text-blue-300 tracking-[0.4em] mb-1 italic">
               {activeTab === 'audit' ? `Saldo al ${formatDate(auditDate)}` : 'Efectivo Total en Banco'}
             </p>
             <p className="text-4xl font-black tracking-tighter">
               {formatMoney(activeTab === 'audit' ? auditResult.total : currentBalances.total)}
             </p>
          </div>

          {activeTab === 'home' && (
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setFormType('ingreso'); setShowForm(true); }} className="flex-1 bg-green-500 text-white py-3 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-transform">Ingreso</button>
              <button onClick={() => { setFormType('gasto'); setShowForm(true); }} className="flex-1 bg-red-500 text-white py-3 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-transform">Egreso</button>
            </div>
          )}
        </div>

        {/* LISTADO */}
        <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col pb-24">
          {activeTab === 'home' && (
            <div className="p-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Buscar..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-9 pr-4 text-xs font-bold outline-none focus:border-[#002A8D]" 
                />
              </div>
              <div className="space-y-3">
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative transition-all ${tx.status === 'anulado' ? 'opacity-20 grayscale' : ''}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${BUCKETS.find(b => b.id === tx.bucket)?.color || 'bg-gray-400'}`}>
                        {BUCKETS.find(b => b.id === tx.bucket)?.icon || <Tag size={14}/>}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-black text-gray-800 text-xs uppercase italic truncate leading-tight">{tx.entity}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{tx.concept}</p>
                        <p className="text-[8px] text-blue-500 font-black uppercase mt-1 tracking-tighter">{formatDate(tx.date)} • {tx.method}</p>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <p className={`font-black text-sm tracking-tighter ${tx.type === 'gasto' ? 'text-gray-800' : 'text-green-600'}`}>
                        {tx.type === 'gasto' ? '- ' : '+ '}{formatMoney(tx.amount)}
                      </p>
                      <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">{tx.bucket?.split('_')[0] || 'ANTIGUO'}</p>
                    </div>
                    <button onClick={() => toggleAnular(tx.id, tx.status)} className="absolute -right-1 -top-1 bg-white rounded-full p-1.5 shadow-md border border-gray-100 text-gray-400 hover:scale-110 transition-transform">
                      {tx.status === 'anulado' ? <RotateCcw size={10} className="text-blue-500" /> : <Ban size={10} className="text-red-400" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="p-4 space-y-4">
              <div className="bg-white p-4 rounded-2xl border-2 border-[#002A8D]/10">
                <label className="text-[10px] font-black text-[#002A8D] uppercase mb-2 block tracking-widest">Corte de Auditoría:</label>
                <input type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} className="w-full p-4 bg-gray-50 rounded-xl font-black text-sm outline-none uppercase italic" />
              </div>
              <div className="space-y-2">
                 {auditResult.list.map(tx => (
                   <div key={tx.id} className={`bg-white p-3 rounded-xl border flex justify-between items-center text-[10px] font-bold uppercase transition-opacity ${tx.status === 'anulado' ? 'opacity-30 line-through' : ''}`}>
                      <div className="flex gap-2 items-center overflow-hidden">
                         <span className={`w-2 h-2 rounded-full shrink-0 ${BUCKETS.find(b => b.id === tx.bucket)?.color || 'bg-gray-300'}`}></span>
                         <span className="truncate">{tx.entity}</span>
                      </div>
                      <span className={`shrink-0 font-black ${tx.status === 'anulado' ? 'text-gray-300' : tx.type === 'gasto' ? 'text-red-500' : 'text-green-600'}`}>
                         {tx.type === 'gasto' ? '- ' : '+ '}{formatMoney(tx.amount)}
                      </span>
                   </div>
                 ))}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="p-6 space-y-6">
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
                <h3 className="text-2xl font-black text-gray-900 mb-8 uppercase tracking-tighter italic">Cierre Consolidado</h3>
                <div className="space-y-4">
                   <div className="bg-green-50 p-4 rounded-2xl flex justify-between items-center border border-green-100">
                      <span className="text-[10px] font-black text-green-800 uppercase tracking-widest">Ingresos Totales</span>
                      <span className="text-xl font-black text-green-700">{formatMoney(transactions.filter(t => t.type === 'ingreso' && t.status !== 'anulado').reduce((a,c) => a+(parseFloat(c.amount)||0), 0))}</span>
                   </div>
                   <div className="bg-red-50 p-4 rounded-2xl flex justify-between items-center border border-red-100">
                      <span className="text-[10px] font-black text-red-800 uppercase tracking-widest">Gastos Totales</span>
                      <span className="text-xl font-black text-red-700">{formatMoney(transactions.filter(t => t.type === 'gasto' && t.status !== 'anulado').reduce((a,c) => a+(parseFloat(c.amount)||0), 0))}</span>
                   </div>
                   <div className="bg-[#002A8D] p-8 rounded-3xl text-center text-white mt-4 shadow-xl shadow-blue-100 italic">
                      <p className="text-[10px] text-blue-200 font-black uppercase mb-1 tracking-widest">Saldo Real en Banco</p>
                      <p className="text-4xl font-black">{formatMoney(currentBalances.total)}</p>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* NAVEGACIÓN */}
        <div className="bg-white border-t border-gray-100 flex justify-around py-4 pb-8 absolute bottom-0 w-full z-20">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-[#002A8D] scale-110' : 'text-gray-400 opacity-50'}`}>
            <Home size={20} /><span className="text-[8px] font-black uppercase italic">Flujo</span>
          </button>
          <button onClick={() => setActiveTab('audit')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'audit' ? 'text-[#002A8D] scale-110' : 'text-gray-400 opacity-50'}`}>
            <History size={20} /><span className="text-[8px] font-black uppercase italic">Data</span>
          </button>
          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'stats' ? 'text-[#002A8D] scale-110' : 'text-gray-400 opacity-50'}`}>
            <PieChart size={20} /><span className="text-[8px] font-black uppercase italic">Balance</span>
          </button>
        </div>

        {/* FORMULARIO */}
        {showForm && (
          <div className="absolute inset-0 z-50 flex items-end bg-[#00174f]/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full overflow-y-auto max-h-[90%]">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className={`text-xl font-black uppercase italic ${formType === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>Registrar Movimiento</h3>
                <button onClick={() => setShowForm(false)} className="bg-gray-100 rounded-full p-2 hover:bg-gray-200 transition-colors"><X size={20}/></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-2">
                   {BUCKETS.map(b => (
                     <button key={b.id} type="button" onClick={() => setFormData({...formData, bucket: b.id})} className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all ${formData.bucket === b.id ? 'bg-[#002A8D] text-white border-[#002A8D]' : 'bg-gray-50 text-gray-400 border-transparent hover:border-gray-200'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest">{b.label}</span>
                        {b.icon}
                     </button>
                   ))}
                </div>
                <div className="relative">
                  <span className="absolute left-0 bottom-3 text-2xl font-light text-gray-400">S/</span>
                  <input type="number" step="0.01" required autoFocus value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full border-b-2 border-gray-100 focus:border-[#002A8D] text-4xl font-black py-2 pl-8 outline-none" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Medio de Pago:</p>
                   <div className="grid grid-cols-2 gap-2">
                      {['YAPE', 'PLIN', 'TRANSF.', 'EFECTIVO'].map(m => (
                        <button key={m} type="button" onClick={() => setFormData({...formData, method: m})} className={`py-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${formData.method === m ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-400 border-gray-100'}`}>{m}</button>
                      ))}
                   </div>
                </div>
                <input type="text" required value={formData.entity} onChange={(e) => setFormData({...formData, entity: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-xs font-bold uppercase italic outline-none focus:border-[#002A8D]" placeholder="Nombre de Cliente / Proveedor" />
                <input type="text" required value={formData.concept} onChange={(e) => setFormData({...formData, concept: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-xs font-bold uppercase italic outline-none focus:border-[#002A8D]" placeholder="Concepto Detallado" />
                <button type="submit" className={`w-full py-5 rounded-[2rem] font-black text-white uppercase tracking-widest shadow-xl transition-all active:scale-95 italic ${formType === 'ingreso' ? 'bg-green-500' : 'bg-red-500'}`}>Guardar en Cloud</button>
              </form>
            </div>
          </div>
        )}

        {/* PERFIL */}
        {showProfile && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#00174f]/60 backdrop-blur-md p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl text-center relative">
              <button onClick={() => setShowProfile(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-800 transition-colors"><X size={20}/></button>
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 overflow-hidden border-4 border-blue-50 shadow-inner">
                {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <UserCircle size={48} className="text-blue-200" />}
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-1 italic uppercase tracking-tighter">{user?.displayName || 'Admin Antcor'}</h3>
              <p className="text-[10px] text-green-500 mb-6 uppercase font-black tracking-[0.2em]">Sincronización Activa</p>
              <div className="bg-gray-50 text-gray-400 font-mono text-[9px] py-4 px-4 rounded-2xl mb-8 break-all border border-gray-100 italic">
                {user?.email}
              </div>
              <button onClick={handleSignOut} className="w-full text-red-500 font-black text-xs uppercase tracking-widest py-4 border-2 border-red-50 rounded-2xl hover:bg-red-50 transition-all active:scale-95">Cerrar Sesión</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}