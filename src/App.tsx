import React, { useState, useEffect } from "react";
import { 
  User, Lock, ShieldCheck, LogIn, Fingerprint, Calendar, Clock, MapPin, 
  CheckCircle2, AlertCircle, LayoutDashboard, Users, FileText, Settings, 
  Key, Search, Filter, Download, MoreVertical, Plus, Database, Info, 
  Cpu, Activity, X, ChevronRight, Bell, Zap, ShieldAlert, Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { db, auth } from "./lib/firebase";
import { 
  collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, addDoc, 
  updateDoc, deleteDoc, serverTimestamp, where, getDocs 
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, onAuthStateChanged, signOut, 
  createUserWithEmailAndPassword 
} from "firebase/auth";

// Mock CAPTCHA generation
const generateCaptcha = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length)); 
  }
  return result;
};

type TabType = "dashboard" | "employees" | "reports" | "hardware" | "security" | "performance";

export default function App() {
  const [view, setView] = useState<"login" | "dashboard">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState("Karyawan");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch user role from Firestore with a short retry for bootstrap race conditions
        const userDocRef = doc(db, "systemUsers", firebaseUser.uid);
        let userDocSnapshot = await getDoc(userDocRef);
        
        if (!userDocSnapshot.exists() && (firebaseUser.email === "admin@ehonor.dki.go.id" || firebaseUser.email === "user@ehonor.dki.go.id")) {
          // Wait for bootstrap setDoc to finish
          await new Promise(resolve => setTimeout(resolve, 2000));
          userDocSnapshot = await getDoc(userDocRef);
        }

        if (userDocSnapshot.exists()) {
          const data = userDocSnapshot.data();
          setUserRole(data.role);
          
          // Emergency fix: Ensure the bootstrap admin always has the correct role
          if (firebaseUser.email === "admin@ehonor.dki.go.id" && data.role !== "Super Admin") {
            await updateDoc(userDocRef, { role: "Super Admin" });
            setUserRole("Super Admin");
          }
        } else {
          // Default role if not found
          setUserRole("Karyawan");
        }
        setView("dashboard");
      } else {
        setUser(null);
        setView("login");
        
        // Bootstrap: Create default admin if no users exist
        const bootstrapAdmin = async () => {
          try {
            // Check if app is already initialized via public flag
            // to avoid permission errors on protected collections
            const statusDoc = await getDoc(doc(db, "public", "status"));
            if (!statusDoc.exists()) {
              const email = "admin@ehonor.dki.go.id";
              const pass = "admin123";
              try {
                const cred = await createUserWithEmailAndPassword(auth, email, pass);
                await setDoc(doc(db, "systemUsers", cred.user.uid), {
                  uid: cred.user.uid,
                  email: email,
                  displayName: "Administrator",
                  role: "Super Admin",
                  createdAt: serverTimestamp()
                });
                
                // Set initialized flag
                await setDoc(doc(db, "public", "status"), {
                  isInitialized: true,
                  createdAt: serverTimestamp()
                }, { merge: true });

                console.log("Bootstrap Admin created: admin / admin123");

                // Also create a default employee for testing
                const empEmail = "user@ehonor.dki.go.id";
                const empPass = "user123";
                try {
                  const empCred = await createUserWithEmailAndPassword(auth, empEmail, empPass);
                  await setDoc(doc(db, "systemUsers", empCred.user.uid), {
                    uid: empCred.user.uid,
                    email: empEmail,
                    displayName: "Budi Karyawan",
                    role: "Karyawan",
                    createdAt: serverTimestamp()
                  });
                } catch (e) {}
              } catch (e: any) {
                if (e.code === 'auth/operation-not-allowed') {
                  setError("Firebase Error: Email/Password login harus diaktifkan di Firebase Console.");
                }
                // If user already exists in Auth but we're trying to bootstrap again (due to missing status doc)
                if (e.code === 'auth/email-already-in-use') {
                  // Mark as initialized so we don't keep trying and failing
                  await setDoc(doc(db, "public", "status"), {
                    isInitialized: true,
                    updatedAt: serverTimestamp()
                  }, { merge: true });
                }
              }
            }
          } catch (err) {
            console.error("Bootstrap error:", err);
          }
        };
        bootstrapAdmin();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const isCaptchaCorrect = securityCode.toUpperCase() === captcha.toUpperCase();
    if (!isCaptchaCorrect) {
      setError("Kode keamanan tidak sesuai.");
      setCaptcha(generateCaptcha());
      setSecurityCode("");
      setIsLoading(false);
      return;
    }

    try {
      // Check for e-Honor legacy style login vs email
      const normalizedUsername = username.trim().toLowerCase();
      const email = normalizedUsername.includes("@") ? normalizedUsername : `${normalizedUsername}@ehonor.dki.go.id`;
      await signInWithEmailAndPassword(auth, email, password.trim());
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setError("Kredensial tidak valid. Password salah atau akun belum terdaftar.");
      } else {
        setError("Email/Username atau password salah.");
      }
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView("login");
    } catch (err) {
      console.error(err);
    }
  };

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setSecurityCode("");
  };

  if (view === "dashboard" && user) {
    return <Dashboard onLogout={handleLogout} username={user.displayName || user.email?.split('@')[0]} role={userRole} userId={user.uid} />;
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center font-sans overflow-hidden bg-bg">
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=2070")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-sidebar-bg/40 backdrop-blur-[2px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[420px] mx-4 bg-white rounded-xl shadow-2xl p-8 border border-border"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-accent rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-accent/20">
            <Fingerprint className="text-white w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-sidebar-bg text-center leading-tight tracking-tight">e-Honor</h1>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-widest">Biometric Attendance</p>
          <div className="w-full flex items-center gap-3 my-5">
            <div className="h-[1px] flex-1 bg-border"></div>
            <span className="text-[10px] font-bold text-text-muted tracking-widest uppercase whitespace-nowrap">SMP Negeri 248 Jakarta</span>
            <div className="h-[1px] flex-1 bg-border"></div>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input type="text" required className="block w-full pl-10 pr-3 py-2.5 bg-bg/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm font-medium" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input type="password" required className="block w-full pl-10 pr-3 py-2.5 bg-bg/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm font-medium" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div onClick={refreshCaptcha} className="relative w-full h-12 bg-bg/80 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden border border-border group">
              <span className="text-xl font-black text-sidebar-bg tracking-[0.4em] select-none italic font-mono relative z-10 transition-transform group-hover:scale-105">{captcha}</span>
            </div>
            <input type="text" required placeholder="Kode Keamanan" className="block w-full px-3 py-2.5 bg-bg/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm font-medium" value={securityCode} onChange={(e) => setSecurityCode(e.target.value.toUpperCase())} />
          </div>
          {error && (
            <div className="bg-danger/10 text-danger px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-2 border border-danger/20">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <button type="submit" disabled={isLoading} className="w-full bg-accent hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98] shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-70 uppercase tracking-widest text-xs">
            {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><LogIn size={16} /> Login ke Sistem</>}
          </button>
        </form>
        <p className="mt-8 text-center text-[9px] text-text-muted font-bold uppercase tracking-widest">Portal Presensi © 2026 DKI Jakarta</p>
      </motion.div>
    </div>
  );
}

function Dashboard({ onLogout, username, role, userId }: { onLogout: () => void, username: string, role: string, userId: string }) {
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState<TabType>(role === "Karyawan" ? "performance" : "dashboard");
  const [attendanceStatus, setAttendanceStatus] = useState<"not_yet" | "success">("not_yet");
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' | 'error' } | null>(null);

  // Sync active tab if role changes significantly (e.g. login finished late)
  useEffect(() => {
    if (role === "Super Admin" && activeTab === "performance") {
      setActiveTab("dashboard");
    }
  }, [role]);

  // Firestore States
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);

  useEffect(() => {
    // Real-time Employees
    const qEmployees = query(collection(db, "employees"), orderBy("name", "asc"));
    const unsubEmployees = onSnapshot(qEmployees, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Real-time Attendance
    const qAttendance = query(collection(db, "attendance"), orderBy("timestamp", "desc"));
    const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
      setAttendanceLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Real-time Performance (Role-based)
    let qPerformance;
    if (role === "Karyawan") {
      qPerformance = query(collection(db, "performance"), where("employeeId", "==", userId), orderBy("date", "desc"));
    } else {
      qPerformance = query(collection(db, "performance"), orderBy("status", "desc"), orderBy("date", "desc"));
    }
    const unsubPerformance = onSnapshot(qPerformance, (snapshot) => {
      setPerformanceData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Real-time System Users (Admin only)
    let unsubUsers = () => {};
    if (role === "Super Admin") {
      const qUsers = query(collection(db, "systemUsers"), orderBy("role", "asc"));
      unsubUsers = onSnapshot(qUsers, (snapshot) => {
        setSystemUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    }

    return () => {
      unsubEmployees();
      unsubAttendance();
      unsubPerformance();
      unsubUsers();
    };
  }, [role, userId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const notify = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ message, type });
  };

  const handleClockIn = async () => {
    setIsLoading(true);
    try {
      await addDoc(collection(db, "attendance"), {
        employeeId: userId,
        employeeName: username,
        timestamp: serverTimestamp(),
        action: "Fingerprint IN",
        ip: "10.224.12.88",
        status: "Success",
        scannerId: "DKI-SCAN-042-PRO"
      });
      setAttendanceStatus("success");
      notify("Absensi Masuk Berhasil dicatat", "success");
    } catch (err) {
      console.error(err);
      notify("Gagal mencatat absensi", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidation = async (id: string, action: 'approve' | 'reject') => {
    const status = action === 'approve' ? 'Verified' : 'Rejected';
    try {
      await updateDoc(doc(db, "performance", id), { status });
      notify(`Laporan ${action === 'approve' ? 'Disetujui' : 'Ditolak'}`, action === 'approve' ? 'success' : 'error');
    } catch (err) {
      console.error(err);
      notify("Gagal memperbarui status", "error");
    }
  };

  const handleExport = (format: 'PDF' | 'EXCEL') => {
    setIsLoading(true);
    notify(`Generating ${format} report...`, "info");
    setTimeout(() => {
      setIsLoading(false);
      notify(`${format} Report: April_2026_${username}.zip has been downloaded`, "success");
    }, 2000);
  };

  const handleTestConnection = () => {
    setIsLoading(true);
    notify("Pinging hardware terminal DKI-SCAN-042-PRO...", "info");
    setTimeout(() => {
      setIsLoading(false);
      notify("Hardware link stable. Latency: 42ms", "success");
    }, 1500);
  };

  const handleUpdateSettings = () => {
    setIsLoading(true);
    notify("Pushing configuration to hardware...", "info");
    setTimeout(() => {
      setIsLoading(false);
      notify("Configuration synced successfully", "success");
    }, 2000);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Kehadiran" value="142" color="accent" />
              <StatCard label="Terlambat" value="08" color="warning" />
              <StatCard label="Izin / Sakit" value="03" color="success" />
              <StatCard label="Alpha" value="12" color="danger" />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 flex flex-col bg-white rounded-xl border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-white sticky top-0 z-10">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-sidebar-bg flex items-center gap-2">
                    <Fingerprint size={14} className="text-accent" /> Log Absensi Real-time
                  </h3>
                  <span className="text-[10px] font-black text-accent uppercase bg-accent/10 px-2 py-0.5 rounded tracking-widest animate-pulse">Live Feed</span>
                </div>
                <div className="overflow-x-auto min-h-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-bg border-b border-border">
                        <th className="px-6 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Waktu</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Pegawai</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Scanner</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {attendanceLogs.slice(0, 10).map((log, i) => (
                        <AttendanceRow 
                          key={log.id || i}
                          time={log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString('id-id') : "..."} 
                          name={log.employeeName} 
                          dept="Unit Kerja" 
                          scanner={log.scannerId} 
                          status={log.status === "Success" ? "Hadir" : "Error"} 
                          color={log.status === "Success" ? "success" : "warning"} 
                        />
                      ))}
                      {attendanceLogs.length === 0 && (
                        <tr><td colSpan={4} className="py-20 text-center text-[10px] font-bold text-text-muted uppercase">Belum ada data absensi</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-border p-6 flex flex-col items-center">
                  <h3 className="text-[10px] font-black uppercase text-text-muted tracking-[0.2em] mb-6">Device Interface</h3>
                  <div className="text-4xl font-black text-sidebar-bg font-mono mb-6">{now.toLocaleTimeString('id-ID', { hour12: false })}</div>
                  <AnimatePresence mode="wait">
                    {attendanceStatus === "not_yet" ? (
                      <motion.button onClick={handleClockIn} disabled={isLoading} className="w-full h-40 bg-bg hover:bg-white border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-4 transition-all group active:scale-95 disabled:opacity-50">
                        {isLoading ? <div className="w-10 h-10 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div> : <>
                          <div className="w-14 h-14 bg-sidebar-bg text-white rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"><Fingerprint size={28} /></div>
                          <p className="text-xs font-black uppercase text-sidebar-bg tracking-widest">Scan Fingerprint</p>
                        </>}
                      </motion.button>
                    ) : (
                      <div className="w-full bg-success/5 border border-success/30 rounded-2xl p-8 flex flex-col items-center justify-center gap-4">
                        <div className="w-14 h-14 bg-success text-white rounded-full flex items-center justify-center"><CheckCircle2 size={32} /></div>
                        <p className="text-sm font-black uppercase text-success tracking-widest text-center">Presensi Sukses</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        );
      case "employees":
        return (
          <div className="bg-white rounded-xl border border-border flex flex-col h-full overflow-hidden">
             <div className="px-8 py-5 border-b border-border flex items-center justify-between bg-white">
                <div>
                   <h2 className="text-sm font-bold text-sidebar-bg uppercase tracking-widest flex items-center gap-2"><Users size={16} className="text-accent" /> Database Pegawai</h2>
                   <p className="text-[10px] font-semibold text-text-muted uppercase mt-0.5 tracking-wider">Total: 482 Personel Terdaftar</p>
                </div>
                <div className="flex gap-2">
                   <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input type="text" placeholder="Cari Pegawai..." className="pl-9 pr-4 py-2 bg-bg border border-border rounded-lg text-xs outline-none w-64 focus:ring-1 focus:ring-accent" /></div>
                   <button onClick={() => setIsModalOpen('add_employee')} className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-all uppercase tracking-widest shadow-lg shadow-accent/10 active:scale-95">
                      <Plus size={14} /> Tambah Pegawai
                   </button>
                </div>
             </div>
             <div className="overflow-x-auto flex-1 h-full">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-bg/50 border-b border-border sticky top-0 z-10 backdrop-blur-md">
                         <th className="px-8 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Identity / NIP</th>
                         <th className="px-8 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Jabatan</th>
                         <th className="px-8 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Tipe Kontrak</th>
                         <th className="px-8 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Unit Kerja</th>
                         <th className="px-8 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-border">
                      {employees.map((emp, i) => (
                        <EmployeeRow 
                           key={emp.id || i}
                           nip={emp.nip} 
                           name={emp.name} 
                           jabatan={emp.jabatan} 
                           type={emp.type} 
                           unit={emp.unit} 
                           active={emp.active} 
                        />
                      ))}
                      {employees.length === 0 && (
                        <tr><td colSpan={5} className="py-20 text-center text-[10px] font-black text-text-muted uppercase tracking-widest leading-relaxed">Database Pegawai Kosong<br/><span className="text-[10px] opacity-40">Mohon Tunggu...</span></td></tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        );
      case "reports":
        return (
          <div className="space-y-6 flex flex-col h-full">
            <div className="grid grid-cols-3 gap-6 shrink-0">
               <SummaryCard label="Total Presensi" value="12,482" trend="+12%" icon={<FileText size={20} />} />
               <SummaryCard label="Rerata Lambat" value="14 Menit" trend="-2%" icon={<Activity size={20} />} />
               <SummaryCard label="Tingkat Hadir" value="97.8%" trend="+0.5%" icon={<CheckCircle2 size={20} />} />
            </div>
            <div className="bg-white rounded-xl border border-border flex flex-col flex-1 overflow-hidden">
               <div className="px-8 py-5 border-b border-border flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-sidebar-bg">Laporan Bulanan: April 2026</h3>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('PDF')} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-sidebar-bg text-white rounded-lg text-[10px] font-bold hover:bg-black transition-all uppercase active:scale-95 disabled:opacity-50">
                       <Download size={12} /> Export PDF
                    </button>
                    <button onClick={() => handleExport('EXCEL')} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-success text-white rounded-lg text-[10px] font-bold hover:bg-green-600 transition-all uppercase active:scale-95 disabled:opacity-50">
                       <Database size={12} /> Export EXCEL
                    </button>
                  </div>
               </div>
               <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-bg border-b border-border sticky top-0 z-10">
                           <th className="px-8 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest">NIP / Nama</th>
                           <th className="px-8 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Hadir</th>
                           <th className="px-8 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Izin</th>
                           <th className="px-8 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Sakit</th>
                           <th className="px-8 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Lambat</th>
                           <th className="px-8 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Efektif (%)</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border">
                        <ReportRow name="Faisal Ferdiansyah" nip="199201..." hadir={22} izin={0} sakit={0} lambat={1} effective={99} />
                        <ReportRow name="Budi Darmawan" nip="198805..." hadir={20} izin={1} sakit={0} lambat={3} effective={92} />
                     </tbody>
                  </table>
               </div>
            </div>
          </div>
        );
      case "hardware":
        return (
          <div className="grid grid-cols-2 gap-6 h-full">
             <div className="bg-white rounded-xl border border-border p-8 flex flex-col">
                <div className="flex items-center gap-3 mb-8"><div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent"><Cpu size={24} /></div><h3 className="text-sm font-bold text-sidebar-bg uppercase tracking-widest">Konfigurasi Scanner</h3></div>
                <div className="space-y-6 flex-1">
                   <div className="space-y-2"><label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Scanner ID</label><input type="text" defaultValue="DKI-SCAN-042-PRO" className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-sm font-mono outline-none focus:ring-1 focus:ring-accent" /></div>
                   <div className="space-y-2"><label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Server IP</label><input type="text" defaultValue="10.224.12.88" className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-sm font-mono outline-none focus:ring-1 focus:ring-accent" /></div>
                </div>
                <div className="pt-8 mt-8 border-t border-border flex justify-end gap-3">
                   <button onClick={handleTestConnection} disabled={isLoading} className="px-6 py-2.5 border border-border rounded-lg text-[10px] font-bold text-text-muted uppercase hover:bg-bg active:scale-95 disabled:opacity-50">Test Connection</button>
                   <button onClick={handleUpdateSettings} disabled={isLoading} className="px-6 py-2.5 bg-accent text-white rounded-lg text-[10px] font-bold uppercase hover:bg-blue-600 shadow-lg shadow-accent/20 active:scale-95 disabled:opacity-50">Update Settings</button>
                </div>
             </div>
             <div className="space-y-6">
                <div className="bg-white rounded-xl border border-border p-8 text-center flex flex-col items-center">
                   <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center text-success mb-4 relative"><Fingerprint size={40} /><div className="absolute top-0 right-0 w-3 h-3 bg-success rounded-full animate-ping"></div></div>
                   <h3 className="text-sm font-bold text-sidebar-bg uppercase tracking-widest mb-1">Scanner Online</h3>
                   <div className="mt-8 grid grid-cols-2 gap-3 w-full"><div className="bg-bg p-4 rounded-xl border border-border"><p className="text-[9px] font-black text-text-muted uppercase">Health</p><p className="text-xl font-black text-success">98.4%</p></div><div className="bg-bg p-4 rounded-xl border border-border"><p className="text-[9px] font-black text-text-muted uppercase">Uptime</p><p className="text-xl font-black text-sidebar-bg">124D</p></div></div>
                </div>
             </div>
          </div>
        );
      case "security":
        return (
          <div className="bg-white rounded-xl border border-border flex flex-col h-full overflow-hidden">
             <div className="px-8 py-6 border-b border-border flex items-center justify-between">
                <div><h2 className="text-sm font-bold text-sidebar-bg uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={18} className="text-accent" /> Akses Kontrol</h2><p className="text-[10px] font-semibold text-text-muted uppercase mt-0.5">Kelola Hak Akses Pengguna</p></div>
                <div className="flex gap-2">
                   <button onClick={() => setIsModalOpen('add_user')} className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-[10px] font-bold hover:bg-blue-600 uppercase tracking-widest shadow-lg shadow-accent/10 active:scale-95">
                      <Plus size={14} /> Tambah User
                   </button>
                   <button onClick={() => setIsModalOpen('audit_log')} className="flex items-center gap-2 px-4 py-2 bg-sidebar-bg text-white rounded-lg text-[10px] font-bold hover:bg-black uppercase tracking-widest active:scale-95">
                      <Key size={14} /> Audit Log
                   </button>
                </div>
             </div>
             <div className="p-8 grid grid-cols-3 gap-8 overflow-y-auto">
                <div className="col-span-2 space-y-8">
                   <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest">Role Management</h4>
                      <div className="grid grid-cols-2 gap-4">
                         <RoleCard name="Super Administrator" desc="Akses penuh sistem Disdik DKI" />
                         <RoleCard name="Operator Sekolah" desc="Kelola data unit masing-masing" />
                      </div>
                   </div>

                   <div className="space-y-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                         <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest">Manajemen User Sistem</h4>
                      </div>
                      <div className="bg-bg/50 rounded-xl border border-border overflow-hidden">
                         <table className="w-full text-left">
                            <thead className="bg-bg border-b border-border">
                               <tr>
                                  <th className="px-6 py-3 text-[9px] font-black text-text-muted uppercase">Nama / ID</th>
                                  <th className="px-6 py-3 text-[9px] font-black text-text-muted uppercase">Email</th>
                                  <th className="px-6 py-3 text-[9px] font-black text-text-muted uppercase">Role</th>
                                  <th className="px-6 py-3 text-[9px] font-black text-text-muted uppercase text-center">Akses</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                               {systemUsers.map((u, i) => (
                                 <SystemUserRow key={u.id || i} name={u.displayName || u.email?.split('@')[0]} email={u.email} role={u.role} active />
                               ))}
                            </tbody>
                         </table>
                      </div>
                   </div>
                </div>
                <div className="space-y-6">
                   <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest">Keamanan Global</h4>
                   <div className="space-y-4">
                      <SecurityToggle label="2FA Authentication" active />
                      <SecurityToggle label="IP Access Filter" active={false} />
                      <SecurityToggle label="Device Encryption" active />
                      <SecurityToggle label="Auto Hardware Locking" active />
                   </div>
                   <div className="bg-accent/5 p-6 rounded-2xl border border-accent/20">
                      <Info size={20} className="text-accent mb-3" />
                      <p className="text-[11px] text-sidebar-bg font-bold uppercase tracking-wider mb-2">Notice Hak Akses</p>
                      <p className="text-[11px] text-text-muted leading-relaxed font-medium">Perubahan Role akan berdampak langsung pada izin menu dan fitur yang dapat diakses oleh user yang bersangkutan.</p>
                   </div>
                </div>
             </div>
          </div>
        );
      case "performance":
        if (role === "Karyawan") {
          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-success/5 border border-success/20 rounded-xl p-6 flex items-center gap-4">
                   <div className="w-10 h-10 bg-success text-white rounded-full flex items-center justify-center"><CheckCircle2 size={24} /></div>
                   <div>
                      <p className="text-[10px] font-black uppercase text-success tracking-widest">Role: {role}</p>
                      <p className="text-xs font-bold text-sidebar-bg">Akses Khusus E-Kinerja Aktif</p>
                   </div>
                </div>
                <div className="bg-white rounded-xl border border-border p-8">
                   <div className="flex items-center gap-3 mb-8">
                      <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent"><Zap size={24} /></div>
                      <h3 className="text-sm font-bold text-sidebar-bg uppercase tracking-widest">Input Aktivitas</h3>
                   </div>
                   <form className="space-y-5" onSubmit={async (e) => { 
                      e.preventDefault(); 
                      const form = e.target as HTMLFormElement;
                      const data = {
                        employeeId: userId,
                        employeeName: username,
                        date: (form.elements.namedItem('date') as HTMLInputElement).value,
                        activityName: (form.elements.namedItem('activity') as HTMLInputElement).value,
                        qty: Number((form.elements.namedItem('qty') as HTMLInputElement).value),
                        unit: (form.elements.namedItem('unit') as HTMLSelectElement).value,
                        description: (form.elements.namedItem('desc') as HTMLTextAreaElement).value,
                        status: 'Pending',
                        createdAt: serverTimestamp()
                      };
                      try {
                        await addDoc(collection(db, "performance"), data);
                        form.reset();
                        notify("Kinerja berhasil dikirim untuk verifikasi", "success");
                      } catch (err) {
                        notify("Gagal mengirim laporan", "error");
                      }
                   }}>
                      <div className="space-y-1.5 leading-none">
                         <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Tanggal Kegiatan</label>
                         <input type="date" name="date" className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-sm" defaultValue={new Date().toISOString().split('T')[0]} />
                      </div>
                      <div className="space-y-1.5 leading-none">
                         <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Nama Aktivitas</label>
                         <input type="text" name="activity" required className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-sm" placeholder="Contoh: Menyusun Laporan Bulanan" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1.5 leading-none">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Volume/Qty</label>
                            <input type="number" name="qty" required className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-sm" placeholder="0" />
                         </div>
                         <div className="space-y-1.5 leading-none">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Satuan</label>
                            <select name="unit" className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-sm outline-none">
                               <option>Laporan</option>
                               <option>Berkas</option>
                               <option>Kegiatan</option>
                               <option>Jam</option>
                            </select>
                         </div>
                      </div>
                      <div className="space-y-1.5 leading-none">
                         <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Keterangan / Deskripsi</label>
                         <textarea name="desc" rows={4} className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-sm resize-none" placeholder="Detail aktivitas yang dikerjakan..."></textarea>
                      </div>
                      <button type="submit" className="w-full py-3 bg-accent text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-accent/20 hover:bg-blue-600 active:scale-95 transition-all">Submit Kinerja</button>
                   </form>
                </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl border border-border flex flex-col h-full overflow-hidden">
                 <div className="px-8 py-6 border-b border-border bg-white sticky top-0 z-10">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-sidebar-bg flex items-center gap-2">
                       <Clock size={16} className="text-accent" />
                       Riwayat Kinerja Minggu Ini
                    </h3>
                 </div>
                 <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left">
                       <thead className="bg-bg border-b border-border sticky top-0">
                          <tr>
                             <th className="px-8 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Tanggal</th>
                             <th className="px-8 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Aktivitas</th>
                             <th className="px-8 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Volume</th>
                             <th className="px-8 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Status</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-border">
                          {performanceData.map((perf, i) => (
                             <PerformanceRow 
                                key={perf.id || i}
                                date={perf.date} 
                                activity={perf.activityName} 
                                qty={`${perf.qty} ${perf.unit}`} 
                                status={perf.status} 
                             />
                          ))}
                          {performanceData.length === 0 && (
                            <tr><td colSpan={4} className="py-20 text-center text-[10px] font-black text-text-muted uppercase tracking-widest">Belum ada riwayat kinerja</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
            </div>
          );
        } else {
          // Admin Validation View
          return (
            <div className="bg-white rounded-xl border border-border flex flex-col h-full overflow-hidden">
               <div className="px-8 py-6 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-sidebar-bg uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={18} className="text-accent" /> Validasi E-Kinerja</h2>
                    <p className="text-[10px] font-semibold text-text-muted uppercase mt-0.5">Verifikasi Laporan Aktivitas Karyawan</p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                     <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-warning"></div> 1 Pending</span>
                     <span className="flex items-center gap-1.5 text-success"><div className="w-2 h-2 rounded-full bg-success"></div> 12 Terverifikasi</span>
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left">
                     <thead className="bg-bg border-b border-border sticky top-0 z-10">
                        <tr>
                           <th className="px-8 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Karyawan</th>
                           <th className="px-8 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Detail Aktivitas</th>
                           <th className="px-8 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Volume</th>
                           <th className="px-8 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Tindakan</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border">
                        {performanceData.map((perf, i) => (
                           <ValidationRow 
                              key={perf.id || i}
                              name={perf.employeeName || "Karyawan"} 
                              nip={perf.employeeId?.substring(0, 8) || "..."} 
                              date={perf.date} 
                              activity={perf.activityName} 
                              qty={`${perf.qty} ${perf.unit}`} 
                              status={perf.status} 
                              onAction={(action) => handleValidation(perf.id, action)} 
                           />
                        ))}
                        {performanceData.length === 0 && (
                           <tr><td colSpan={4} className="py-20 text-center text-[10px] font-bold text-text-muted uppercase">Tidak ada laporan masuk</td></tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
          );
        }
    }
  };

  return (
    <div className="min-h-screen bg-bg flex font-sans overflow-hidden">
      <aside className="w-64 bg-sidebar-bg text-white flex flex-col shrink-0">
        <div className="p-6">
          <div className="text-xl font-extrabold flex items-center gap-3 tracking-tighter mb-10"><div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center"><Fingerprint size={20} /></div><span>PRESENSI+</span></div>
          <nav className="space-y-1">
            {(role === "Super Admin" || role === "Operator") && <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} />}
            <NavItem icon={<Zap size={18} />} label="Input Kinerja" active={activeTab === "performance"} onClick={() => setActiveTab("performance")} />
            {(role === "Super Admin" || role === "Operator") && (
              <>
                <NavItem icon={<Users size={18} />} label="Data Pegawai" active={activeTab === "employees"} onClick={() => setActiveTab("employees")} />
                <NavItem icon={<FileText size={18} />} label="Laporan" active={activeTab === "reports"} onClick={() => setActiveTab("reports")} />
                <NavItem icon={<Settings size={18} />} label="Config" active={activeTab === "hardware"} onClick={() => setActiveTab("hardware")} />
              </>
            )}
            {role === "Super Admin" && <NavItem icon={<Key size={18} />} label="Security" active={activeTab === "security"} onClick={() => setActiveTab("security")} />}
          </nav>
        </div>
        <div className="mt-auto p-4 m-4 bg-black/20 rounded-xl border border-white/5"><div className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-success"></div>Device Online</div><p className="text-[11px] text-white/60 font-medium mt-1 uppercase font-mono tracking-tighter">ID: #042 | SYNC: {now.toLocaleTimeString('id-id')}</p></div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        <header className="h-16 bg-white border-b border-border px-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold tracking-tight uppercase text-sidebar-bg">
              {activeTab === "dashboard" ? "Dashboard Utama" : 
               activeTab === "employees" ? "Database Pegawai" :
               activeTab === "reports" ? "Laporan Presensi" :
               activeTab === "performance" ? (role === "Karyawan" ? "Input Kinerja Harian" : "Validasi Kinerja Pegawai") :
               activeTab === "hardware" ? "Konfigurasi Alat" : "Akses Kontrol"}
            </h1>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.3em]">{now.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block"><p className="text-[11px] font-bold text-sidebar-bg leading-none uppercase">{username || "KKI ADMINISTRATOR"}</p><p className="text-[9px] font-bold text-success uppercase mt-1">Role: {role}</p></div>
            <button onClick={onLogout} className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/5 rounded-full transition-colors"><LogIn size={18} className="rotate-180" /></button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 relative">
          <AnimatePresence mode="wait"><motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }} className="h-full">{renderContent()}</motion.div></AnimatePresence>
        </main>

        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-8 right-8 z-[100]">
              <div className={`px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-4 ${toast.type === 'success' ? 'bg-success text-white border-success' : toast.type === 'error' ? 'bg-danger text-white border-danger' : 'bg-sidebar-bg text-white border-white/20'}`}>
                {toast.type === 'success' ? <CheckCircle2 size={24} /> : toast.type === 'error' ? <ShieldAlert size={24} /> : <Info size={24} />}
                <p className="text-sm font-bold tracking-wide">{toast.message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
           {isModalOpen === 'add_employee' && <AddEmployeeModal onClose={() => setIsModalOpen(null)} onSave={() => { setIsModalOpen(null); notify("Pegawai baru berhasil didaftarkan", "success"); }} />}
           {isModalOpen === 'add_user' && <AddUserModal onClose={() => setIsModalOpen(null)} onSave={() => { setIsModalOpen(null); notify("User sistem baru berhasil ditambahkan", "success"); }} />}
           {isModalOpen === 'audit_log' && <AuditLogModal logs={attendanceLogs} onClose={() => setIsModalOpen(null)} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AddUserModal({ onClose, onSave }: { onClose: () => void, onSave: () => void }) {
  const [formData, setFormData] = useState({ name: '', email: '', role: 'Karyawan', password: 'password123' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      
      // Store additional profile in Firestore
      await setDoc(doc(db, "systemUsers", user.uid), {
        uid: user.uid,
        displayName: formData.name,
        email: formData.email,
        role: formData.role,
        createdAt: serverTimestamp()
      });
      
      onSave();
    } catch (err: any) {
      console.error(err);
      alert("Gagal menambahkan user: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-sidebar-bg/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border">
        <div className="px-8 py-6 border-b border-border flex items-center justify-between">
           <h3 className="text-sm font-black uppercase text-sidebar-bg tracking-widest flex items-center gap-2"><User className="text-accent" /> Tambah User Sistem</h3>
           <button onClick={onClose} className="text-text-muted hover:text-danger"><X size={20} /></button>
        </div>
        <div className="p-8 space-y-4">
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-text-muted">Nama Pengguna</label>
              <input type="text" className="w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-sm" placeholder="Contoh: Admin Server" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
           </div>
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-text-muted">Email / Username</label>
              <input type="text" className="w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-sm" placeholder="admin@dki.go.id" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
           </div>
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-text-muted">Role / Hak Akses</label>
              <select className="w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-accent" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                 <option>Karyawan</option>
                 <option>Super Administrator</option>
                 <option>Operator Unit Sekolah</option>
                 <option>Security Monitor</option>
                 <option>Data Manager</option>
              </select>
           </div>
           <div className="p-4 bg-bg rounded-xl border border-border flex items-start gap-4">
              <ShieldCheck size={20} className="text-success shrink-0" />
              <p className="text-[10px] text-text-muted font-medium leading-relaxed uppercase">User baru akan otomatis terdaftar dengan email dan role yang ditentukan. Password default adalah: password123</p>
           </div>
        </div>
        <div className="px-8 py-6 bg-bg flex justify-end gap-3 border-t border-border">
           <button onClick={onClose} className="px-6 py-2.5 text-[10px] font-bold uppercase text-text-muted hover:text-danger">Batal</button>
           <button onClick={handleSubmit} disabled={loading} className="px-8 py-2.5 bg-accent text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-accent/20">
             {loading ? "Memproses..." : "Daftarkan User"}
           </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AddEmployeeModal({ onClose, onSave }: { onClose: () => void, onSave: () => void }) {
  const [formData, setFormData] = useState({ nip: '', name: '', jabatan: '', unit: '', type: 'KKI' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, "employees", formData.nip), {
        ...formData,
        active: true,
        registeredAt: serverTimestamp()
      });
      onSave();
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan data pegawai");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-sidebar-bg/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border">
        <div className="px-8 py-6 border-b border-border flex items-center justify-between">
           <h3 className="text-sm font-black uppercase text-sidebar-bg tracking-widest flex items-center gap-2"><Plus className="text-accent" /> Registrasi Pegawai Baru</h3>
           <button onClick={onClose} className="text-text-muted hover:text-danger"><X size={20} /></button>
        </div>
        <div className="p-8 space-y-4">
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-text-muted">NIP / NUPTK</label><input type="text" className="w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-sm" placeholder="Contoh: 1992..." value={formData.nip} onChange={e => setFormData({...formData, nip: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-text-muted">Nama Lengkap</label><input type="text" className="w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-sm" placeholder="Masukkan nama..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
           </div>
           <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-text-muted">Jabatan</label><input type="text" className="w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-sm" placeholder="Contoh: Staff IT" value={formData.jabatan} onChange={e => setFormData({...formData, jabatan: e.target.value})} /></div>
           <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-text-muted">Unit Kerja</label><input type="text" className="w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-sm" placeholder="Contoh: SMPN 12 Jakarta" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} /></div>
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-text-muted">Tipe Kontrak</label>
              <select className="w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-sm outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option>KKI</option>
                <option>PPPK</option>
              </select>
           </div>
        </div>
        <div className="px-8 py-6 bg-bg flex justify-end gap-3 border-t border-border">
           <button onClick={onClose} className="px-6 py-2.5 text-[10px] font-bold uppercase text-text-muted hover:text-danger">Batal</button>
           <button onClick={handleSubmit} disabled={loading} className="px-8 py-2.5 bg-accent text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-accent/20">
             {loading ? "Menyimpan..." : "Simpan Data Pegawai"}
           </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AuditLogModal({ onClose, logs }: { onClose: () => void, logs: any[] }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-sidebar-bg/70 backdrop-blur-md z-[200] flex items-center justify-center p-4 font-sans text-sidebar-bg">
       <motion.div initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 30 }} className="bg-white w-full max-w-4xl max-h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <div className="px-10 py-8 border-b border-border flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-danger/10 text-danger rounded-2xl flex items-center justify-center"><ShieldAlert size={28} /></div>
                <div><h3 className="text-lg font-black tracking-tight uppercase">Audit Log Keamanan</h3><p className="text-xs font-bold text-text-muted uppercase tracking-widest">Aktivitas Sistem Real-time</p></div>
             </div>
             <button onClick={onClose} className="p-3 bg-bg hover:bg-danger/10 hover:text-danger rounded-full transition-all"><X size={24} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-10">
             <table className="w-full text-left">
                <thead>
                   <tr className="border-b-2 border-border"><th className="pb-4 text-[10px] font-black uppercase tracking-widest text-text-muted">Time</th><th className="pb-4 text-[10px] font-black uppercase tracking-widest text-text-muted">User / Subject</th><th className="pb-4 text-[10px] font-black uppercase tracking-widest text-text-muted">Action</th><th className="pb-4 text-[10px] font-black uppercase tracking-widest text-text-muted">Terminal IP</th><th className="pb-4 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">Result</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                   {logs.map((log, i) => (
                     <tr key={log.id || i} className="hover:bg-bg/50 transition-colors">
                        <td className="py-5 font-mono text-xs font-bold">{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString('id-id') : '...'}</td>
                        <td className="py-5 font-bold text-xs">{log.employeeName || 'System'}</td>
                        <td className="py-5 text-xs font-medium">{log.action || 'Fingerprint Scan'}</td>
                        <td className="py-5 font-mono text-xs text-text-muted">{log.ip || '10.224.12.88'}</td>
                        <td className="py-5 text-center"><span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${log.status === 'Success' ? 'bg-success text-white' : 'bg-danger text-white'}`}>{log.status}</span></td>
                     </tr>
                   ))}
                   {logs.length === 0 && (
                     <tr><td colSpan={5} className="py-20 text-center text-xs font-black text-text-muted uppercase tracking-widest">No logs available at this time</td></tr>
                   )}
                </tbody>
             </table>
          </div>
          <div className="px-10 py-6 bg-bg flex justify-between items-center border-t border-border">
             <p className="text-[10px] font-bold text-text-muted uppercase italic tracking-widest">Auto-deleted every 30 days based on security policy.</p>
             <button className="flex items-center gap-2 px-6 py-2.5 bg-sidebar-bg text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg"><Download size={14} /> Export Audit Archive</button>
          </div>
       </motion.div>
    </motion.div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold cursor-pointer transition-all ${active ? 'bg-white/10 text-white shadow-inner' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>{icon}<span>{label}</span></div>
  );
}

function EmployeeRow({ nip, name, jabatan, unit, type, active }: { nip: string, name: string, jabatan: string, unit: string, type: string, active: boolean, key?: any }) {
  return (
    <tr className="hover:bg-bg/50 transition-colors">
      <td className="px-8 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-bg rounded-lg flex items-center justify-center border border-border"><User size={14} /></div><div><p className="text-xs font-bold text-sidebar-bg">{name}</p><p className="text-[10px] font-mono text-text-muted">{nip}</p></div></div></td>
      <td className="px-8 py-4 text-xs font-bold text-sidebar-bg uppercase tracking-tight">{jabatan}</td>
      <td className="px-8 py-4">
         <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${type === 'KKI' ? 'bg-accent/10 text-accent' : 'bg-sidebar-bg/10 text-sidebar-bg'}`}>
            {type}
         </span>
      </td>
      <td className="px-8 py-4 text-xs font-semibold text-text-muted">{unit}</td>
      <td className="px-8 py-4 text-center"><div className={`w-2.5 h-2.5 rounded-full mx-auto ${active ? 'bg-success shadow-lg shadow-success/30' : 'bg-danger shadow-lg shadow-danger/30'}`}></div></td>
    </tr>
  );
}

function SummaryCard({ label, value, trend, icon }: { label: string, value: string, trend: string, icon: React.ReactNode }) {
  const isUp = trend.startsWith('+');
  return (
    <div className="bg-white p-6 rounded-xl border border-border flex items-center gap-5 hover:shadow-lg transition-all group">
       <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all transform group-hover:rotate-6">{icon}</div>
       <div><p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{label}</p><p className="text-2xl font-black text-sidebar-bg">{value} <span className={`text-[10px] tracking-widest ${isUp ? 'text-success' : 'text-danger'}`}>{trend}</span></p></div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: string, color: 'accent' | 'warning' | 'success' | 'danger' }) {
  const colorMap = { accent: "text-accent", warning: "text-warning", success: "text-success", danger: "text-danger" };
  return (
    <div className="bg-white p-6 rounded-xl border border-border hover:border-accent transition-colors">
      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">{label}</p>
      <div className={`text-4xl font-black ${colorMap[color]}`}>{value}</div>
    </div>
  );
}

function ReportRow({ name, nip, hadir, izin, sakit, lambat, effective }: { name: string, nip: string, hadir: number, izin: number, sakit: number, lambat: number, effective: number }) {
  return (
    <tr className="hover:bg-bg transition-colors">
       <td className="px-8 py-4"><p className="text-xs font-bold font-sans">{name}</p><p className="text-[9px] font-mono text-text-muted tracking-tight">{nip}</p></td>
       <td className="px-8 py-4 text-center text-xs font-black text-sidebar-bg">{hadir}</td>
       <td className="px-8 py-4 text-center text-xs font-black text-sidebar-bg">{izin}</td>
       <td className="px-8 py-4 text-center text-xs font-black text-sidebar-bg">{sakit}</td>
       <td className="px-8 py-4 text-center text-xs font-black text-warning">{lambat}</td>
       <td className="px-8 py-4 text-center"><div className="flex items-center justify-center gap-2"><div className="w-12 h-1.5 bg-bg rounded-full overflow-hidden"><div className={`h-full rounded-full ${effective > 90 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${effective}%` }}></div></div><span className="text-[10px] font-black font-mono">{effective}%</span></div></td>
    </tr>
  );
}

function PerformanceRow({ date, activity, qty, status }: { date: string, activity: string, qty: string, status: string, key?: any }) {
  return (
    <tr className="hover:bg-bg/50 transition-colors">
       <td className="px-8 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">{date}</td>
       <td className="px-8 py-4 text-xs font-bold text-sidebar-bg">{activity}</td>
       <td className="px-8 py-4 text-center text-[10px] font-black text-sidebar-bg uppercase tracking-widest">{qty}</td>
       <td className="px-8 py-4 text-center">
          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${status === 'Verified' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
             {status}
          </span>
       </td>
    </tr>
  );
}

function ValidationRow({ name, nip, date, activity, qty, status, onAction }: { name: string, nip: string, date: string, activity: string, qty: string, status: string, onAction: (type: 'approve' | 'reject') => void, key?: any }) {
  return (
    <tr className="hover:bg-bg transition-colors">
       <td className="px-8 py-4">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-bg rounded-lg border border-border flex items-center justify-center font-bold text-xs text-sidebar-bg uppercase">
                {name.split(' ').map(n => n[0]).join('')}
             </div>
             <div>
                <p className="text-xs font-bold text-sidebar-bg leading-none mb-1">{name}</p>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{nip}</p>
             </div>
          </div>
       </td>
       <td className="px-8 py-4">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{date}</div>
          <p className="text-xs font-bold text-sidebar-bg">{activity}</p>
       </td>
       <td className="px-8 py-4 text-center text-[10px] font-black text-sidebar-bg uppercase tracking-widest">{qty}</td>
       <td className="px-8 py-4">
          {status === 'Pending' ? (
             <div className="flex items-center justify-center gap-2">
                <button onClick={() => onAction('approve')} className="w-8 h-8 rounded-lg bg-success/10 text-success hover:bg-success hover:text-white transition-all flex items-center justify-center" title="Setujui"><Check size={16} /></button>
                <button onClick={() => onAction('reject')} className="w-8 h-8 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-all flex items-center justify-center" title="Tolak"><X size={16} /></button>
             </div>
          ) : (
             <div className="flex items-center justify-center">
                <span className="px-2.5 py-1 rounded-lg bg-success text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><ShieldCheck size={10} /> Verified</span>
             </div>
          )}
       </td>
    </tr>
  );
}

function RoleCard({ name, desc }: { name: string, desc: string }) {
  return (
    <div className="bg-bg/30 border border-border rounded-xl p-5 hover:border-accent transition-colors cursor-pointer group flex items-start gap-4">
       <div className="w-10 h-10 rounded-lg bg-white border border-border flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-all transform group-hover:-rotate-3"><ShieldCheck size={20} /></div>
       <div><h5 className="text-xs font-black uppercase text-sidebar-bg tracking-widest mb-1">{name}</h5><p className="text-[11px] text-text-muted font-medium leading-relaxed">{desc}</p></div>
    </div>
  );
}

function SystemUserRow({ name, email, role, active }: { name: string, email: string, role: string, active: boolean, key?: any }) {
  return (
    <tr className="hover:bg-bg transition-colors">
       <td className="px-6 py-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-sidebar-bg text-white rounded-lg flex items-center justify-center text-[10px] font-black">
                {name.split(' ').map(n => n[0]).join('')}
             </div>
             <div>
                <p className="text-xs font-bold text-sidebar-bg">{name}</p>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">ID: SYS-{Math.floor(Math.random() * 1000)}</p>
             </div>
          </div>
       </td>
       <td className="px-6 py-4 text-xs font-medium text-text-muted">{email}</td>
       <td className="px-6 py-4">
          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${role === 'Super Admin' ? 'bg-accent/10 text-accent' : 'bg-sidebar-bg/10 text-sidebar-bg'}`}>
             {role}
          </span>
       </td>
       <td className="px-6 py-4 text-center">
          <div className={`w-2 h-2 rounded-full mx-auto ${active ? 'bg-success' : 'bg-danger'}`}></div>
       </td>
    </tr>
  );
}

function SecurityToggle({ label, active }: { label: string, active: boolean }) {
  const [isOn, setIsOn] = useState(active);
  return (
    <div className="flex items-center justify-between bg-bg/50 border border-border p-4 rounded-xl">
       <span className="text-[10px] font-bold text-sidebar-bg uppercase tracking-widest">{label}</span>
       <button onClick={() => setIsOn(!isOn)} className={`w-10 h-5 rounded-full relative transition-colors ${isOn ? 'bg-success' : 'bg-text-muted/30'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isOn ? 'left-6' : 'left-1'}`}></div></button>
    </div>
  );
}

function AttendanceRow({ time, name, dept, scanner, status, color }: { time: string, name: string, dept: string, scanner: string, status: string, color: 'success' | 'warning', key?: any }) {
  const badgeMap = { success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning" };
  return (
    <tr className="hover:bg-bg/50 transition-colors">
      <td className="px-6 py-4 text-xs font-mono font-bold text-sidebar-bg">{time}</td>
      <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-7 h-7 bg-bg rounded-full flex items-center justify-center text-[10px] font-black text-text-muted border border-border uppercase">{name[0] + (name.includes(' ') ? name.split(' ')[1][0] : '')}</div><div><p className="text-xs font-bold text-sidebar-bg">{name}</p><p className="text-[9px] font-bold text-text-muted uppercase tracking-widest leading-none mt-1">{dept}</p></div></div></td>
      <td className="px-6 py-4 text-center text-[10px] font-black text-text-muted uppercase tracking-widest">{scanner}</td>
      <td className="px-6 py-4 text-center"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${badgeMap[color]}`}>{status}</span></td>
    </tr>
  );
}

function StatusProgress({ label, count, percent, color }: { label: string, count: string, percent: number, color: 'success' | 'warning' | 'danger' }) {
  const colorMap = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" };
  return (
    <div className="space-y-1.5"><div className="flex justify-between items-end"><span className="text-[10px] font-bold text-sidebar-bg uppercase tracking-widest">{label}</span><span className="text-[11px] font-black text-sidebar-bg leading-none font-mono">{count}</span></div><div className="h-1.5 bg-bg rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${colorMap[color]}`} style={{ width: `${percent}%` }}></div></div></div>
  );
}
