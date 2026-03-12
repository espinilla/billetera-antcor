import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Search, Home, PieChart, ArrowUpRight, ArrowDownLeft, Trash2, X, Cloud, CloudOff, Loader2, LogIn, UserCircle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
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
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('ingreso'); 
  const [isSyncing, setIsSyncing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({ amount: '', entity: '', concept: '', method: 'YAPE' });

  // 1. AUTENTICACIÓN
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof window !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Error de Auth:", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoadingApp(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. BASE DE DATOS
  useEffect(() => {
    if (!user) return;
    setIsSyncing(true);
    const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'billetera_antcor');
    const unsubscribe = onSnapshot(txRef, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
      setLoadingApp(false);
      setIsSyncing(false);
    }, (error) => {
      console.error("Error de Firestore:", error);
      setIsSyncing(false);
      setLoadingApp(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Lógica de Búsqueda y Estadísticas
  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions;
    return transactions.filter(tx => 
      tx.entity.toLowerCase().includes(searchTerm.toLowerCase()) || 
      tx.concept.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [transactions, searchTerm]);

  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'ingreso').reduce((acc, c) => acc + c.amount, 0);
    const expense = transactions.filter(t => t.type === 'gasto').reduce((acc, c) => acc + c.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  // --- ACCIONES ---
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

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setShowProfile(false);
    } catch (error) {
      alert(`Error de Google: ${error.message}`);
    }
  };

  if (loadingApp) {
    return <div className="flex h-screen items-center justify-center bg-[#002A8D]"><Loader2 className="animate-spin text-white" size={48} /></div>;
  }

  return (
    <div className="flex justify-center bg-gray-900 min-h-screen font-sans">
      <div className="w-full max-w-md bg-white shadow-2xl relative flex flex-col h-screen overflow-hidden">
        
        {/* HEADER */}
        <div className="bg-[#002A8D] text-white p-5 pb-6 rounded-b-[2rem] shadow-lg z-10 shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="flex justify-between items-center mb-6 relative">
            <h1 className="text-base font-bold tracking-widest flex items-center gap-2">
              <Wallet size={18} className="text-orange-400" /> ANTCOR WALLET
            </h1>
            <div className="flex items-center gap-3">
              {isSyncing ? <Loader2 size={16} className="animate-spin text-blue-300" /> : <Cloud size={16} className="text-blue-300" />}
              <button onClick={() => setShowProfile(true)} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center border border-white/20 hover:bg-white/20 transition-colors">
                <UserCircle size={20} />
              </button>
            </div>
          </div>
          
          <div className="relative">
            <p className="text-xs text-blue-200 font-medium uppercase tracking-wider mb-1">Saldo Disponible</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light text-blue-300">S/</span>
              <span className="text-5xl font-bold tracking-tight">{stats.balance.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="flex gap-3 mt-8 relative">
            <button onClick={() => { setFormType('ingreso'); setShowForm(true); }} className="flex-1 bg-white/10 hover:bg-white/20 border border-white/10 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95">
              <ArrowDownLeft size={20} className="text-green-400" /> <span className="text-sm">Recibir</span>
            </button>
            <button onClick={() => { setFormType('gasto'); setShowForm(true); }} className="flex-1 bg-white text-[#002A8D] shadow-lg py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95">
              <ArrowUpRight size={20} className="text-red-500" /> <span className="text-sm">Pagar</span>
            </button>
          </div>
        </div>

        {/* BUSCADOR */}
        <div className="px-4 pt-4 bg-gray-50">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#002A8D] transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Buscar cliente o concepto..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#002A8D]/10 focus:border-[#002A8D] transition-all"
            />
          </div>
        </div>

        {/* LISTA DE MOVIMIENTOS */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 pb-24">
          <div className="flex justify-between items-end mb-4 px-1">
            <h2 className="text-[#002A8D] font-bold text-sm uppercase tracking-wider">
              {searchTerm ? 'Resultados de búsqueda' : 'Últimos Movimientos'}
            </h2>
            <span className="text-gray-400 text-xs">{filteredTransactions.length} registros</span>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center text-gray-400 mt-16 flex flex-col items-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <PieChart size={32} className="text-gray-300" />
              </div>
              <p className="font-medium text-gray-600">No se encontraron datos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((tx) => (
                <div key={tx.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group relative">
                  <div className="flex items-center gap-3 shrink-1 overflow-hidden">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm
                      ${tx.method === 'YAPE' ? 'bg-[#742384]' : tx.method === 'PLIN' ? 'bg-[#00D1FF]' : tx.method === 'EFECTIVO' ? 'bg-emerald-600' : 'bg-[#002A8D]'}`}>
                      {tx.method.substring(0,3)}
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-bold text-gray-800 text-sm leading-tight uppercase truncate">
                        {tx.type === 'gasto' ? 'A: ' : 'DE: '} {tx.entity}
                      </p>
                      <p className="text-xs text-gray-500 capitalize truncate">{tx.concept}</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={`font-bold text-lg tracking-tight ${tx.type === 'gasto' ? 'text-gray-800' : 'text-green-600'}`}>
                      {tx.type === 'gasto' ? '- ' : '+ '}{formatMoney(tx.amount)}
                    </p>
                  </div>
                  <button onClick={() => deleteTransaction(tx.id)} className="absolute -right-1 -top-1 bg-white rounded-full p-1.5 text-red-400 shadow-md md:opacity-0 group-hover:opacity-100 transition-opacity border border-gray-100">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MODAL ESTADÍSTICAS */}
        {showStats && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <button onClick={() => setShowStats(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-800"><X size={24}/></button>
              
              <div className="w-16 h-16 bg-[#002A8D] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 text-white">
                <PieChart size={32} />
              </div>
              
              <h3 className="text-2xl font-black text-center text-gray-900 mb-8 uppercase tracking-tighter">Resumen Antcor</h3>
              
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-2xl flex items-center justify-between border border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg text-green-600"><TrendingUp size={20}/></div>
                    <span className="text-sm font-bold text-green-800 uppercase">Ingresos</span>
                  </div>
                  <span className="text-lg font-black text-green-700">{formatMoney(stats.income)}</span>
                </div>

                <div className="bg-red-50 p-4 rounded-2xl flex items-center justify-between border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-lg text-red-600"><TrendingDown size={20}/></div>
                    <span className="text-sm font-bold text-red-800 uppercase">Gastos</span>
                  </div>
                  <span className="text-lg font-black text-red-700">{formatMoney(stats.expense)}</span>
                </div>

                <div className="bg-[#002A8D] p-5 rounded-2xl flex flex-col items-center mt-6 shadow-xl shadow-blue-100">
                  <span className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mb-1">Balance de Caja</span>
                  <span className="text-2xl font-black text-white">{formatMoney(stats.balance)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODALES DE FORMULARIO Y PERFIL (Sin cambios, omitidos por brevedad pero deben estar en tu archivo) */}
        {/* ... código del modal formulario y perfil ... */}

        {/* NAVEGACIÓN INFERIOR */}
        <div className="bg-white border-t border-gray-100 flex justify-around py-3 pb-6 shrink-0 absolute bottom-0 w-full z-20">
          <button onClick={() => setSearchTerm('')} className={`flex flex-col items-center gap-1 ${!searchTerm ? 'text-[#002A8D]' : 'text-gray-400'}`}>
            <Home size={22} className={!searchTerm ? 'drop-shadow-sm' : ''} />
            <span className="text-[10px] font-bold">Inicio</span>
          </button>
          <button onClick={() => setShowStats(true)} className="flex flex-col items-center gap-1 text-gray-400 hover:text-[#002A8D] transition-colors">
            <PieChart size={22} />
            <span className="text-[10px] font-medium">Estadísticas</span>
          </button>
          <button onClick={() => document.querySelector('input')?.focus()} className="flex flex-col items-center gap-1 text-gray-400 hover:text-[#002A8D] transition-colors">
            <Search size={22} />
            <span className="text-[10px] font-medium">Buscar</span>
          </button>
        </div>

        {/* SECCIÓN DE FORMULARIO REUTILIZADA (Para que no falte nada al copiar) */}
        {showForm && (
          <div className="absolute inset-0 z-50 flex items-end bg-[#00174f]/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full rounded-t-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className={`text-lg font-black uppercase tracking-wider flex items-center gap-2 ${formType === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                  {formType === 'ingreso' ? <ArrowDownLeft size={20}/> : <ArrowUpRight size={20}/>}
                  Nuevo {formType === 'ingreso' ? 'Ingreso' : 'Pago'}
                </h3>
                <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-full p-2 transition-colors"><X size={20}/></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Monto (S/)</label>
                  <input type="number" step="0.01" required autoFocus value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full border-b-2 border-gray-200 focus:border-[#002A8D] outline-none text-4xl font-light py-2 text-gray-800 transition-colors" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{formType === 'ingreso' ? '¿Quién pagó?' : '¿A quién pagas?'}</label>
                  <input type="text" required value={formData.entity} onChange={(e) => setFormData({...formData, entity: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#002A8D]/20 focus:border-[#002A8D] transition-all" placeholder={formType === 'ingreso' ? 'Ej. Cliente X' : 'Ej. Proveedor Y'} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Concepto</label>
                  <input type="text" required value={formData.concept} onChange={(e) => setFormData({...formData, concept: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#002A8D]/20 focus:border-[#002A8D] transition-all" placeholder="Ej. Adelanto mochilas..." />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Método de Pago</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['YAPE', 'PLIN', 'TRANSFERENCIA', 'EFECTIVO'].map(method => (
                      <button key={method} type="button" onClick={() => setFormData({...formData, method})} className={`py-3 rounded-xl border text-xs font-bold transition-all ${formData.method === method ? 'bg-[#002A8D] text-white border-[#002A8D]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" className={`w-full py-4 mt-2 rounded-2xl font-black text-white text-base tracking-widest uppercase shadow-lg active:scale-95 transition-all ${formType === 'ingreso' ? 'bg-green-500 shadow-green-500/30' : 'bg-red-500 shadow-red-500/30'}`}>
                  Guardar Registro
                </button>
              </form>
            </div>
          </div>
        )}

        {showProfile && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#00174f]/60 backdrop-blur-md p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center relative">
              <button onClick={() => setShowProfile(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><X size={20}/></button>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                {user?.isAnonymous ? <CloudOff size={32} /> : <Cloud size={32} />}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Sincronización Cloud</h3>
              {user?.isAnonymous ? (
                <>
                  <p className="text-sm text-gray-500 mb-6">Actualmente estás como invitado. Inicia sesión para vincular tu PC y Celular.</p>
                  <button onClick={loginWithGoogle} className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-sm">
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                    Vincular con Google
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-4">Datos sincronizados en:</p>
                  <div className="bg-blue-50 text-[#002A8D] font-mono text-xs py-2 px-4 rounded-lg mb-6 truncate border border-blue-100">
                    {user?.email || user?.uid}
                  </div>
                  <button onClick={() => { signOut(auth); window.location.reload(); }} className="text-red-500 font-bold text-sm uppercase tracking-wider hover:underline">
                    Cerrar Sesión
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}