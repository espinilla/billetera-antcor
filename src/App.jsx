import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Search, Home, PieChart, ArrowUpRight, ArrowDownLeft, Trash2, X, Cloud, CloudOff, Loader2, LogIn, UserCircle, TrendingUp, TrendingDown, DollarSign, ShieldCheck, Calendar, History, Lock } from 'lucide-react';
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
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';

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

// --- UTILIDADES ---
const formatMoney = (amount) => `S/ ${Math.abs(amount).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${date.getDate()} ${meses[date.getMonth()]}`;
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
  
  const [formData, setFormData] = useState({ amount: '', entity: '', concept: '', method: 'YAPE' });

  useEffect(() => {
    const initAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        if (typeof window !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        }
      } catch (e) {
        console.error("Error persistencia:", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingApp(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      return;
    }
    setIsSyncing(true);
    const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'billetera_antcor');
    const unsubscribe = onSnapshot(txRef, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
      setIsSyncing(false);
    }, (error) => {
      console.error("Error Firestore:", error);
      setIsSyncing(false);
    });
    return () => unsubscribe();
  }, [user]);

  const totalBalance = useMemo(() => {
    return transactions.reduce((acc, tx) => tx.type === 'ingreso' ? acc + tx.amount : acc - tx.amount, 0);
  }, [transactions]);

  const auditResult = useMemo(() => {
    const selectedDate = new Date(auditDate);
    selectedDate.setHours(23, 59, 59, 999);
    const historicalTxs = transactions.filter(tx => new Date(tx.date) <= selectedDate);
    const balanceAtDate = historicalTxs.reduce((acc, tx) => 
      tx.type === 'ingreso' ? acc + tx.amount : acc - tx.amount, 0
    );
    return { transactions: historicalTxs, balance: balanceAtDate };
  }, [transactions, auditDate]);

  const filteredHomeTransactions = useMemo(() => {
    if (!searchTerm) return transactions.slice(0, 50);
    return transactions.filter(tx => 
      tx.entity.toLowerCase().includes(searchTerm.toLowerCase()) || 
      tx.concept.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [transactions, searchTerm]);

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setShowProfile(false);
    } catch (error) {
      alert(`Error Google: ${error.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.entity || !formData.concept || !user) return;
    const newTransaction = {
      type: formType,
      amount: parseFloat(formData.amount),
      entity: formData.entity,
      concept: formData.concept,
      method: formData.method,
      date: new Date().toISOString()
    };
    try {
      const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'billetera_antcor');
      await addDoc(txRef, newTransaction);
      setFormData({ amount: '', entity: '', concept: '', method: 'YAPE' });
      setShowForm(false);
    } catch (error) {
      alert(`Error guardando: ${error.message}`);
    }
  };

  const deleteTransaction = async (id) => {
    if (!user) return;
    if (window.confirm("¿Eliminar este movimiento?")) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'billetera_antcor', id));
      } catch (error) {
        alert(`Error: ${error.message}`);
      }
    }
  };

  if (loadingApp) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#002A8D] text-white p-6 text-center">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="font-bold tracking-widest text-sm uppercase italic">Sincronizando Antcor Cloud...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center bg-gray-900 min-h-screen font-sans">
        <div className="w-full max-w-md bg-[#002A8D] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          <div className="bg-white/10 p-6 rounded-[2.5rem] mb-8 border border-white/20 backdrop-blur-sm shadow-2xl">
            <Wallet size={80} className="text-orange-400 mb-4 mx-auto" />
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">Antcor<br/>Wallet</h1>
          </div>
          <div className="bg-white rounded-[2rem] p-8 w-full shadow-2xl relative z-10">
            <h2 className="text-gray-800 font-black text-xl mb-6 uppercase tracking-tight italic">Panel de Auditoría</h2>
            <button onClick={loginWithGoogle} className="w-full bg-white border-2 border-gray-100 hover:border-[#002A8D] text-gray-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-sm group">
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6 group-hover:scale-110 transition-transform" alt="Google" />
              <span>Acceder con Google</span>
            </button>
          </div>
          <p className="mt-8 text-blue-300 text-[10px] font-bold uppercase tracking-[0.2em]">Multiservicios Antcor 2026</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-gray-900 min-h-screen font-sans">
      <div className="w-full max-w-md bg-white shadow-2xl relative flex flex-col h-screen overflow-hidden">
        
        {/* HEADER */}
        <div className="bg-[#002A8D] text-white p-5 pb-6 rounded-b-[2rem] shadow-lg z-10 shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="flex justify-between items-center mb-6 relative">
            <h1 className="text-xs font-black tracking-[0.2em] flex items-center gap-2 uppercase italic">
               <ShieldCheck size={14} className="text-green-400" /> Antcor Cloud
            </h1>
            <div className="flex items-center gap-3">
              {isSyncing && <Loader2 size={14} className="animate-spin text-blue-300" />}
              <button onClick={() => setShowProfile(true)} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center border border-white/20 overflow-hidden">
                {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <UserCircle size={20} />}
              </button>
            </div>
          </div>

          <div className="relative">
            <p className="text-[10px] text-blue-200 font-black uppercase tracking-widest mb-1 italic">
              {activeTab === 'audit' ? `Saldo al ${formatDate(auditDate)}` : 'Saldo Total en Caja'}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-light text-blue-300">S/</span>
              <span className="text-5xl font-black tracking-tighter">
                {(activeTab === 'audit' ? auditResult.balance : totalBalance).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {activeTab !== 'audit' && (
            <div className="flex gap-3 mt-8 relative animate-in fade-in zoom-in">
              <button onClick={() => { setFormType('ingreso'); setShowForm(true); }} className="flex-1 bg-white/10 hover:bg-white/20 border border-white/10 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95">
                <ArrowDownLeft size={20} className="text-green-400" /> <span className="text-xs uppercase font-black italic">Venta</span>
              </button>
              <button onClick={() => { setFormType('gasto'); setShowForm(true); }} className="flex-1 bg-white text-[#002A8D] shadow-lg py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95">
                <ArrowUpRight size={20} className="text-red-500" /> <span className="text-xs uppercase font-black italic">Gasto</span>
              </button>
            </div>
          )}
          
          {activeTab === 'audit' && (
            <div className="mt-6 p-4 bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4 italic">
              <Lock size={16} className="text-orange-400 shrink-0" />
              <p className="text-[10px] font-bold text-blue-100 leading-tight uppercase tracking-wider">
                Modo Auditoría: Solo lectura de historial.
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col pb-24">
          {activeTab === 'home' && (
            <div className="p-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar cliente o concepto..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-10 pr-4 text-sm font-medium outline-none focus:border-[#002A8D] transition-all"
                />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-[#002A8D] font-black text-[10px] uppercase tracking-[0.2em] px-1 italic">Movimientos Recientes</h2>
                {filteredHomeTransactions.map((tx) => (
                  <div key={tx.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group relative transition-transform active:scale-95">
                    <div className="flex items-center gap-3 shrink-1 overflow-hidden">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-[9px] shrink-0
                        ${tx.method === 'YAPE' ? 'bg-[#742384]' : tx.method === 'PLIN' ? 'bg-[#00D1FF]' : tx.method === 'EFECTIVO' ? 'bg-emerald-600' : 'bg-[#002A8D]'}`}>
                        {tx.method.substring(0,3)}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-black text-gray-800 text-xs truncate uppercase italic leading-tight">{tx.entity}</p>
                        <p className="text-[10px] text-gray-500 capitalize truncate">{tx.concept}</p>
                        <p className="text-[9px] text-gray-400 font-bold mt-0.5 uppercase tracking-tighter">{formatDate(tx.date)}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={`font-black text-base tracking-tighter ${tx.type === 'gasto' ? 'text-gray-800' : 'text-green-600'}`}>
                        {tx.type === 'gasto' ? '- ' : '+ '}{formatMoney(tx.amount)}
                      </p>
                    </div>
                    <button onClick={() => deleteTransaction(tx.id)} className="absolute -right-1 -top-1 bg-white rounded-full p-2 text-red-400 shadow-md border border-red-50 hover:bg-red-50 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="flex flex-col h-full animate-in fade-in">
              <div className="p-4 bg-white border-b border-gray-100 sticky top-0 z-20">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Ver saldo hasta:</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[#002A8D]" size={18} />
                  <input 
                    type="date" 
                    value={auditDate}
                    onChange={(e) => setAuditDate(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-black text-gray-700 outline-none focus:border-[#002A8D] transition-all uppercase italic"
                  />
                </div>
              </div>

              <div className="p-4 space-y-3">
                <h2 className="text-gray-400 font-black text-[10px] uppercase tracking-[0.2em] px-1 italic">Historial al {formatDate(auditDate)}</h2>
                {auditResult.transactions.length === 0 ? (
                  <div className="py-20 text-center text-gray-300">
                    <History size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest italic">Sin registros</p>
                  </div>
                ) : (
                  auditResult.transactions.map((tx) => (
                    <div key={tx.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between opacity-80 grayscale-[0.5]">
                      <div className="flex items-center gap-3 shrink-1 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-400 font-black text-[8px] shrink-0 uppercase">
                          {tx.method.substring(0,3)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-bold text-gray-600 text-xs truncate uppercase leading-tight italic">{tx.entity}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">{formatDate(tx.date)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-sm ${tx.type === 'gasto' ? 'text-gray-400' : 'text-green-800'}`}>
                          {tx.type === 'gasto' ? '- ' : '+ '}{formatMoney(tx.amount)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="p-6">
               <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
                <h3 className="text-2xl font-black text-gray-900 mb-8 uppercase tracking-tighter italic">Balance General</h3>
                <div className="space-y-4">
                  <div className="bg-green-50 p-5 rounded-2xl flex items-center justify-between border border-green-100">
                    <TrendingUp className="text-green-600" size={20} />
                    <span className="text-xl font-black text-green-700">{formatMoney(transactions.filter(t => t.type === 'ingreso').reduce((a,c) => a+c.amount, 0))}</span>
                  </div>
                  <div className="bg-red-50 p-5 rounded-2xl flex items-center justify-between border border-red-100">
                    <TrendingDown className="text-red-600" size={20} />
                    <span className="text-xl font-black text-red-700">{formatMoney(transactions.filter(t => t.type === 'gasto').reduce((a,c) => a+c.amount, 0))}</span>
                  </div>
                  <div className="bg-[#002A8D] p-8 rounded-[2rem] flex flex-col items-center mt-6 shadow-xl shadow-blue-200 text-white italic">
                    <span className="text-[10px] text-blue-200 font-black uppercase tracking-[0.4em] mb-2">Neto Antcor</span>
                    <span className="text-4xl font-black">{formatMoney(totalBalance)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border-t border-gray-100 flex justify-around py-3 pb-8 shrink-0 absolute bottom-0 w-full z-20 shadow-[0_-10px_25px_rgba(0,0,0,0.05)]">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-[#002A8D] scale-110' : 'text-gray-400 opacity-50'}`}>
            <Home size={24} />
            <span className="text-[9px] font-black uppercase tracking-tighter italic">Inicio</span>
          </button>
          
          <button onClick={() => setActiveTab('audit')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'audit' ? 'text-[#002A8D] scale-110' : 'text-gray-400 opacity-50'}`}>
            <History size={24} />
            <span className="text-[9px] font-black uppercase tracking-tighter italic">Data</span>
          </button>

          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'stats' ? 'text-[#002A8D] scale-110' : 'text-gray-400 opacity-50'}`}>
            <PieChart size={24} />
            <span className="text-[9px] font-black uppercase tracking-tighter italic">Balance</span>
          </button>
        </div>

        {showForm && (
          <div className="absolute inset-0 z-50 flex items-end bg-[#00174f]/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full">
              <div className="flex justify-between items-center mb-6 border-b pb-4 italic">
                <h3 className={`text-xl font-black uppercase ${formType === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                  {formType === 'ingreso' ? 'Registrar Venta' : 'Registrar Gasto'}
                </h3>
                <button onClick={() => setShowForm(false)} className="bg-gray-100 rounded-full p-2"><X size={20}/></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="relative">
                  <span className="absolute left-0 bottom-3 text-2xl font-light text-gray-400">S/</span>
                  <input type="number" step="0.01" required autoFocus value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full border-b-2 border-gray-100 focus:border-[#002A8D] text-4xl font-black py-2 pl-8 outline-none transition-all" placeholder="0.00" />
                </div>
                <input type="text" required value={formData.entity} onChange={(e) => setFormData({...formData, entity: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-bold uppercase italic" placeholder="Cliente / Proveedor" />
                <input type="text" required value={formData.concept} onChange={(e) => setFormData({...formData, concept: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-bold uppercase italic" placeholder="Concepto Detallado" />
                <div className="grid grid-cols-2 gap-2">
                  {['YAPE', 'PLIN', 'TRANSFERENCIA', 'EFECTIVO'].map(m => (
                    <button key={m} type="button" onClick={() => setFormData({...formData, method: m})} className={`py-4 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${formData.method === m ? 'bg-[#002A8D] text-white border-[#002A8D]' : 'bg-white text-gray-400 border-gray-100'}`}>{m}</button>
                  ))}
                </div>
                <button type="submit" className={`w-full py-5 rounded-[1.5rem] font-black text-white uppercase tracking-widest shadow-xl active:scale-95 transition-all italic ${formType === 'ingreso' ? 'bg-green-500 shadow-green-100' : 'bg-red-500 shadow-red-100'}`}>Guardar en Cloud</button>
              </form>
            </div>
          </div>
        )}

        {showProfile && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#00174f]/60 backdrop-blur-md p-4">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl text-center relative">
              <button onClick={() => setShowProfile(false)} className="absolute top-6 right-6 text-gray-400"><X size={20}/></button>
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 overflow-hidden border-4 border-blue-50">
                {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <UserCircle size={48} className="text-blue-200" />}
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-1 italic uppercase tracking-tighter">{user?.displayName || 'Admin Antcor'}</h3>
              <p className="text-[10px] text-green-500 mb-6 uppercase font-black tracking-[0.2em]">Conexión Activa ✅</p>
              <div className="bg-gray-50 text-gray-400 font-mono text-[9px] py-4 px-4 rounded-2xl mb-8 break-all border border-gray-100 italic">
                {user?.email}
              </div>
              <button onClick={() => { signOut(auth); window.location.reload(); }} className="w-full text-red-500 font-black text-xs uppercase tracking-widest py-4 border-2 border-red-50 rounded-2xl hover:bg-red-50 transition-all">Cerrar Sesión</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}