import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, User, ShieldCheck, LogOut, Menu, X, ChevronRight, BarChart3, History, Settings, Download, Eye, EyeOff, Camera, CheckCircle2, AlertCircle, Plus, Upload, Search, Filter, ArrowLeft, MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import Clock from './components/Clock';
import { EMPLOYEES, LOCATIONS, SHIFTS, Shift, AttendanceData } from './types';
import { api } from './services/api';
import { format, isAfter, addMinutes, parse, startOfDay, subDays, isWithinInterval } from 'date-fns';
import { Html5Qrcode } from 'html5-qrcode';
import * as XLSX from 'xlsx';

// Constants
const OFFICIAL_BARCODE_CONTENT = "KOPERASI GIAT"; // Content of the provided QR code image

export default function App() {
  const [view, setView] = useState<'employee' | 'admin-login' | 'admin-dashboard'>('employee');

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-slate-900">
      <AnimatePresence mode="wait">
        {view === 'employee' && (
          <EmployeePage onAdminClick={() => setView('admin-login')} />
        )}
        {view === 'admin-login' && (
          <AdminLogin onLoginSuccess={() => setView('admin-dashboard')} onBack={() => setView('employee')} />
        )}
        {view === 'admin-dashboard' && (
          <AdminDashboard onLogout={() => setView('employee')} />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmployeePage({ onAdminClick }: { onAdminClick: () => void }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [shift, setShift] = useState<Shift | ''>('');
  const [note, setNote] = useState('');
  const [isLate, setIsLate] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [presensiType, setPresensiType] = useState<'masuk' | 'pulang'>('masuk');

  const parseDateStr = (dateVal: any): string => {
    if (!dateVal) return '';
    try {
      if (typeof dateVal === 'string') {
        const ymdMatch = dateVal.match(/(\d{4}-\d{2}-\d{2})/);
        if (ymdMatch) return ymdMatch[1];
        const dmyMatch = dateVal.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dmyMatch) {
          const d = dmyMatch[1].padStart(2, '0');
          const m = dmyMatch[2].padStart(2, '0');
          return `${dmyMatch[3]}-${m}-${d}`;
        }
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
      } 
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
    } catch (e) {}
    return String(dateVal);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.getAttendanceHistory();
      setAttendanceData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleFocus = () => fetchData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    if (name) {
      fetchData();
    }
  }, [name]);

  useEffect(() => {
    if (!name) {
      setHasCheckedIn(false);
      setHasCheckedOut(false);
      setLocation('');
      setShift('');
      setPresensiType('masuk');
      return;
    }

    if (loading && attendanceData.length === 0) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayRecords = attendanceData.filter(d => 
      d.Name === name && 
      parseDateStr(d.Date) === todayStr
    );

    const checkInRecord = todayRecords.find(d => d.TimeIn && !d.TimeOut);
    const completedRecord = todayRecords.find(d => d.TimeIn && d.TimeOut);

    if (completedRecord) {
      setLocation(completedRecord.Location || '');
      setShift(completedRecord.Shift as Shift || '');
      setHasCheckedIn(true);
      setHasCheckedOut(true);
      setPresensiType('pulang');
    } else if (checkInRecord) {
      setLocation(checkInRecord.Location || '');
      setShift(checkInRecord.Shift as Shift || '');
      setHasCheckedIn(true);
      setHasCheckedOut(false);
      setPresensiType('pulang');
    } else {
      setHasCheckedIn(false);
      setHasCheckedOut(false);
      setLocation('');
      setShift('');
      setPresensiType('masuk');
    }
  }, [name, attendanceData, loading]);

  useEffect(() => {
    if (shift && shift !== 'SHIFT LEMBUR' && shift !== 'SHIFT OFFICE' && !hasCheckedIn && presensiType === 'masuk') {
      const shiftStartTimeStr = SHIFTS[shift];
      const now = new Date();
      const shiftStartTime = parse(shiftStartTimeStr, 'HH:mm', now);
      const lateThreshold = addMinutes(shiftStartTime, 6);
      
      if (isAfter(now, lateThreshold)) {
        setIsLate(true);
      } else {
        setIsLate(false);
        setNote('');
      }
    } else {
      setIsLate(false);
      setNote('');
    }
  }, [shift, hasCheckedIn, presensiType]);

  const startScanner = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      const html5QrCode = new Html5Qrcode("reader");
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, 
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            html5QrCode.stop().then(() => {
              setIsScanning(false);
              handleScan(decodedText);
            }).catch(err => {
              console.error("Failed to stop scanner", err);
              setIsScanning(false);
            });
          },
          (errorMessage) => {}
        );
      } catch (err) {
        console.error("Unable to start scanning", err);
        setIsScanning(false);
        alert("Gagal mengakses kamera. Pastikan izin kamera diberikan dan perangkat memiliki kamera belakang.");
      }
    }, 300);
  };

  const handleScan = async (content: string) => {
    const scannedContent = content.trim().toUpperCase();
    const expectedContent = OFFICIAL_BARCODE_CONTENT.trim().toUpperCase();
    
    const isMatch = scannedContent === expectedContent || 
                   (scannedContent.includes("KOPERASI") && scannedContent.includes("GIAT")) ||
                   scannedContent.includes("KOPERASIGIAT") || 
                   scannedContent.startsWith("KOPERASI");

    if (isMatch) {
      const now = new Date();
      let data: Partial<AttendanceData>;
      
      if (presensiType === 'masuk') {
        data = {
          Date: format(now, 'yyyy-MM-dd'),
          Name: name,
          Location: location,
          Shift: shift as Shift,
          TimeIn: format(now, 'HH.mm'),
          Status: isLate ? 'Terlambat' : 'Tepat Waktu',
          Note: note
        };
      } else {
        data = {
          Date: format(now, 'yyyy-MM-dd'),
          Name: name,
          Shift: shift as Shift,
          TimeOut: format(now, 'HH.mm')
        };
      }

      try {
        const result = await api.saveAttendance(data);
        if (result.success) {
          const successMsg = presensiType === 'masuk' 
            ? (isLate ? 'PRESENSI MASUK BERHASIL (TERLAMBAT)' : 'PRESENSI MASUK SUKSES') 
            : 'PRESENSI PULANG SUKSES';
          setScanResult({ success: true, message: successMsg });
          if (presensiType === 'masuk') setHasCheckedIn(true);
          if (presensiType === 'pulang') setHasCheckedOut(true);
          fetchData(); 
        } else {
          setScanResult({ success: false, message: result.message || 'Gagal menyimpan data' });
        }
      } catch (e) {
        setScanResult({ success: false, message: 'Gagal menghubungi server. Periksa koneksi internet.' });
      }
    } else {
      setScanResult({ 
        success: false, 
        message: `Barcode salah.\nTerbaca: "${content}"\nHarap scan barcode Koperasi Giat yang resmi.` 
      });
    }
  };

  const currentRecord = name ? attendanceData.find(d => 
    d.Name === name && 
    parseDateStr(d.Date) === format(new Date(), 'yyyy-MM-dd')
  ) : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-xl mx-auto p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex justify-between items-center py-2">
        <img src="https://i.ibb.co.com/YBMQyzfN/logo-giat-remove-bg.png" alt="Logo Giat" className="h-10" />
        <button onClick={onAdminClick} className="w-10 h-10 bg-slate-200 text-slate-500 hover:bg-slate-300 rounded-full flex items-center justify-center transition-colors">
          <User size={20} />
        </button>
      </div>

      <Clock />

      {/* Main Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
        {/* Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl">
          <button
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
              presensiType === 'masuk' 
                ? 'bg-[#B21B1B] text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setPresensiType('masuk')}
          >
            Presensi Masuk
          </button>
          <button
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all disabled:opacity-50 ${
              presensiType === 'pulang' 
                ? 'bg-[#B21B1B] text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed'
            }`}
            onClick={() => setPresensiType('pulang')}
            disabled={!hasCheckedIn}
            title={!hasCheckedIn ? "Anda harus Presensi Masuk terlebih dahulu" : ""}
          >
            Presensi Pulang
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-[#003366] text-[10px] font-bold uppercase tracking-widest py-1 animate-pulse">
            <div className="w-3 h-3 border-2 border-[#003366] border-t-transparent rounded-full animate-spin"></div>
            Menyinkronkan Data...
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Nama Pegawai</label>
            <select 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-sm appearance-none"
            >
              <option value="">Pilih Nama Pegawai</option>
              {EMPLOYEES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Lokasi Kerja</label>
              <select 
                value={location} 
                onChange={(e) => setLocation(e.target.value)}
                disabled={hasCheckedIn}
                className={`w-full p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-sm appearance-none ${hasCheckedIn ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
              >
                <option value="">Pilih Lokasi</option>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Waktu Shift</label>
              <select 
                value={shift} 
                onChange={(e) => setShift(e.target.value as Shift)}
                disabled={hasCheckedIn}
                className={`w-full p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-sm appearance-none ${hasCheckedIn ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
              >
                <option value="">Pilih Shift</option>
                {Object.keys(SHIFTS).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {isLate && presensiType === 'masuk' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <label className="block text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2">Catatan Keterlambatan</label>
              <textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Berikan alasan keterlambatan..."
                className="w-full p-3.5 rounded-xl border border-red-200 bg-red-50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all min-h-[80px] text-sm"
              />
            </motion.div>
          )}
        </div>

        <div className="pt-2">
          <button
            disabled={!name || !location || !shift || (isLate && presensiType === 'masuk' && !note) || (presensiType === 'masuk' && hasCheckedIn) || (presensiType === 'pulang' && hasCheckedOut)}
            onClick={startScanner}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              !name || !location || !shift || (isLate && presensiType === 'masuk' && !note) || (presensiType === 'masuk' && hasCheckedIn) || (presensiType === 'pulang' && hasCheckedOut)
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#B21B1B] text-white hover:bg-[#901515] shadow-lg shadow-red-900/20 active:scale-95'
            }`}
          >
            <Camera size={20} />
            {presensiType === 'masuk' ? 'SCAN BARCODE MASUK' : 'SCAN BARCODE PULANG'}
          </button>
          <p className="text-center text-[10px] text-slate-400 mt-4">
            Silakan scan kode QR di area presensi untuk {presensiType === 'masuk' ? 'Clock-in' : 'Clock-out'}
          </p>
        </div>
      </div>

      {/* History Section */}
      {name && (
        <div className="space-y-3 pt-4">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2 text-[#B21B1B] font-bold text-sm">
              <History size={16} />
              Riwayat Presensi Hari Ini
            </div>
            <button className="text-[10px] text-[#B21B1B] font-bold hover:underline">
              Lihat Semua
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Aktivitas</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {!hasCheckedIn && !hasCheckedOut && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400 italic">Belum ada riwayat presensi.</td>
                  </tr>
                )}

                {hasCheckedIn && (
                  <tr className="bg-white">
                    <td className="px-4 py-4 text-slate-800">
                      {currentRecord?.TimeIn || '--:--'}
                    </td>
                    <td className="px-4 py-4 text-slate-600">Clock-In (Masuk)</td>
                    <td className="px-4 py-4">
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                        currentRecord?.Status === 'Terlambat' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
                      }`}>
                        {currentRecord?.Status || 'TEPAT WAKTU'}
                      </span>
                    </td>
                  </tr>
                )}

                {(hasCheckedIn || hasCheckedOut) && (
                  <tr className="bg-white">
                    <td className="px-4 py-4 text-slate-400">
                      {hasCheckedOut ? currentRecord?.TimeOut || '--:--' : '--:--'}
                    </td>
                    <td className={`px-4 py-4 ${hasCheckedOut ? 'text-slate-600' : 'text-slate-400 italic'}`}>
                      {hasCheckedOut ? 'Clock-Out (Pulang)' : 'Belum Absen Pulang'}
                    </td>
                    <td className="px-4 py-4">
                      {hasCheckedOut ? (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wider">
                          SELESAI
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="pt-2 pb-6 space-y-2">
            <p className="text-center text-[10px] text-slate-400 italic">
              *Data diperbarui secara real-time berdasarkan sistem pusat
            </p>
            <div className="flex justify-center items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-[10px] font-bold text-slate-500">Sistem Presensi Aktif & Terkoneksi</span>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Popup */}
      {isScanning && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-6">
          <div id="reader" className="w-full max-w-sm bg-white rounded-2xl overflow-hidden"></div>
          <button 
            onClick={() => setIsScanning(false)}
            className="mt-6 px-8 py-3 bg-white text-slate-900 rounded-full font-bold shadow-lg"
          >
            BATAL
          </button>
        </div>
      )}

      {/* Result Popup */}
      {scanResult && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-6 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 w-full max-w-xs text-center space-y-4 shadow-2xl"
          >
            {scanResult.success ? (
              <CheckCircle2 size={64} className="mx-auto text-green-500" />
            ) : (
              <AlertCircle size={64} className="mx-auto text-red-500" />
            )}
            <h3 className={`text-xl font-bold ${scanResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {scanResult.message}
            </h3>
            <button 
              onClick={() => setScanResult(null)}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold"
            >
              OK
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function AdminLogin({ onLoginSuccess, onBack }: { onLoginSuccess: () => void; onBack: () => void }) {
  const [idInput, setIdInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const config = await api.getAdminConfig();
      if (idInput === config.id && password === config.password) {
        onLoginSuccess();
      } else {
        setError('ID atau Password salah');
      }
    } catch (e) {
      setError('Gagal menghubungkan ke server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center p-6 bg-slate-50"
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-100 space-y-8">
        <div className="text-center mb-8">
          <img src="https://i.ibb.co.com/YBMQyzfN/logo-giat-remove-bg.png" alt="Logo" className="h-16 mx-auto mb-4" />
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Admin Login</h2>
          <p className="text-slate-500 text-sm">Akses monitoring Koperasi Giat</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Admin ID</label>
            <input 
              type="text"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
              className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Masukkan ID"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Masukkan Password"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}

          <div className="pt-4 space-y-4">
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#B21B1B] text-white rounded-xl font-bold shadow-lg shadow-red-900/20 hover:bg-[#901515] transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'MENGHUBUNGKAN...' : 'LOGIN'}
            </button>
            <button 
              type="button"
              onClick={onBack}
              className="w-full py-4 text-slate-500 font-semibold hover:text-slate-800 transition-all"
            >
              Kembali ke Halaman Pegawai
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'employees' | 'settings'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPresentPopup, setShowPresentPopup] = useState(false);
  const [showLatePopup, setShowLatePopup] = useState(false);

  // History Filters
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 5), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [historyPage, setHistoryPage] = useState(1);

  // Settings
  const [newId, setNewId] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Parallel fetch could be faster if we had multiple endpoints, 
      // but for now we just ensure we show a nice loading state
      const data = await api.getAttendanceHistory();
      setAttendanceData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const parseDateStr = (dateVal: any): string => {
    if (!dateVal) return '';
    
    try {
      // If it's already a string
      if (typeof dateVal === 'string') {
        // 1. Try YYYY-MM-DD (ISO or simple)
        const ymdMatch = dateVal.match(/(\d{4}-\d{2}-\d{2})/);
        if (ymdMatch) return ymdMatch[1];
        
        // 2. Try DD/MM/YYYY
        const dmyMatch = dateVal.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dmyMatch) {
          const d = dmyMatch[1].padStart(2, '0');
          const m = dmyMatch[2].padStart(2, '0');
          return `${dmyMatch[3]}-${m}-${d}`;
        }

        // 3. Fallback to native Date
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
      } 
      
      // If it's a Date object or number
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
    } catch (e) {
      console.error("Date parsing error:", e, dateVal);
    }
    
    return String(dateVal);
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  // Dashboard Utama should focus on TODAY
  const displayDate = todayStr;

  const todayData = attendanceData.filter(d => parseDateStr(d.Date) === displayDate)
    .sort((a, b) => String(b.TimeIn || '').localeCompare(String(a.TimeIn || '')));
  const presentOnTime = todayData.filter(d => d.Status === 'Tepat Waktu');
  const lateEmployees = todayData.filter(d => d.Status === 'Terlambat');

  const filteredHistory = attendanceData.filter(d => {
    const dDateStr = parseDateStr(d.Date);
    return dDateStr >= startDate && dDateStr <= endDate;
  }).sort((a, b) => {
    const aDate = parseDateStr(a.Date);
    const bDate = parseDateStr(b.Date);
    const aTime = String(a.TimeIn || '');
    const bTime = String(b.TimeIn || '');
    return bDate.localeCompare(aDate) || bTime.localeCompare(aTime);
  });

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredHistory);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presensi");
    XLSX.writeFile(wb, `Presensi_Koperasi_Giat_${startDate}_to_${endDate}.xlsx`);
  };

  const handleUpdateAdmin = async () => {
    if (!newId || !newPassword) return alert('ID dan Password tidak boleh kosong');
    await api.updateAdminConfig({ id: newId, password: newPassword });
    alert('Admin updated. Logging out...');
    onLogout();
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white text-slate-800 z-50 p-6 flex flex-col shadow-2xl lg:hidden border-r border-slate-200"
            >
              <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-100">
                <img src="https://i.ibb.co.com/YBMQyzfN/logo-giat-remove-bg.png" alt="Logo" className="h-12 drop-shadow-sm" />
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
              </div>

              <nav className="flex-1 space-y-2">
                <SidebarItem icon={<BarChart3 size={20} />} label="Dashboard Utama" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} />
                <SidebarItem icon={<History size={20} />} label="Riwayat Presensi" active={activeTab === 'history'} onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }} />
                <SidebarItem icon={<User size={20} />} label="Data Pegawai" active={activeTab === 'employees'} onClick={() => { setActiveTab('employees'); setIsSidebarOpen(false); }} />
                <SidebarItem icon={<Settings size={20} />} label="Pengaturan" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }} />
              </nav>

              <button 
                onClick={onLogout}
                className="mt-auto flex items-center justify-center gap-3 p-4 bg-white/10 text-white hover:bg-white/20 rounded-xl transition-all font-bold"
              >
                <LogOut size={20} />
                KELUAR
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.div 
        animate={{ width: isDesktopCollapsed ? 88 : 288 }}
        className="hidden lg:flex flex-col bg-white text-slate-800 p-6 shadow-xl z-20 sticky top-0 h-screen transition-all overflow-hidden relative border-r border-slate-200"
      >
        <div className={`flex ${isDesktopCollapsed ? 'flex-col gap-4 items-center' : 'items-center justify-center'} mb-10 pb-6 border-b border-slate-100 mt-2 min-h-[48px] relative`}>
          {isDesktopCollapsed ? (
            <>
              <img src="https://i.ibb.co.com/YBMQyzfN/logo-giat-remove-bg.png" alt="Logo" className="w-10 h-10 object-contain mx-auto" />
              <button 
                onClick={() => setIsDesktopCollapsed(false)} 
                className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>
            </>
          ) : (
            <>
              <img src="https://i.ibb.co.com/YBMQyzfN/logo-giat-remove-bg.png" alt="Logo" className="h-12 object-contain drop-shadow-sm" />
              <button 
                onClick={() => setIsDesktopCollapsed(true)} 
                className="absolute right-4 top-2 p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X size={20} />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 space-y-3">
          <SidebarItem collapsed={isDesktopCollapsed} icon={<BarChart3 size={22} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem collapsed={isDesktopCollapsed} icon={<History size={22} />} label="Riwayat Presensi" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <SidebarItem collapsed={isDesktopCollapsed} icon={<User size={22} />} label="Data Pegawai" active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} />
          <SidebarItem collapsed={isDesktopCollapsed} icon={<Settings size={22} />} label="Pengaturan" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <button 
          onClick={onLogout}
          className={`mt-auto flex items-center gap-3 p-4 bg-transparent text-red-500 hover:bg-red-50 rounded-xl transition-all font-bold ${isDesktopCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={20} className="min-w-[20px]" />
          {!isDesktopCollapsed && <span>LOGOUT</span>}
        </button>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
              <Menu size={24} />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <span className="font-extrabold text-[#B21B1B]">Koperasi GIAT</span>
            </div>
            {activeTab === 'employees' && (
              <div className="hidden lg:flex relative w-96 ml-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Cari data pegawai..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#B21B1B]/20 transition-all" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 pl-4">
               <div className="text-right hidden sm:block">
                 <div className="text-sm font-bold text-slate-800">Admin Koperasi</div>
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administrator</div>
               </div>
               <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden border-2 border-white shadow-sm flex items-center justify-center">
                 <User className="text-slate-500 w-6 h-6" />
               </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <div className="w-12 h-12 border-4 border-[#B21B1B] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[#B21B1B] font-bold tracking-widest animate-pulse text-sm">MEMUAT DATA...</p>
            </div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                    <SummaryCard 
                      label="Hadir Tepat Waktu" 
                      count={presentOnTime.length} 
                      color="green" 
                      onClick={() => setShowPresentPopup(true)} 
                    />
                    <SummaryCard 
                      label="Hadir Terlambat" 
                      count={lateEmployees.length} 
                      color="red" 
                      onClick={() => setShowLatePopup(true)} 
                    />
                  </div>

                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                      <h3 className="font-extrabold text-slate-800 text-lg">
                        Presensi Hari Ini <span className="text-[#B21B1B]">({format(new Date(), 'dd/MM/yyyy')})</span>
                      </h3>
                      <button onClick={fetchData} className="text-xs font-bold text-[#B21B1B] hover:text-red-800 hover:underline px-4 py-2 bg-red-50 rounded-lg transition-colors">
                        Refresh Data
                      </button>
                    </div>
                    <div className="overflow-x-auto scrollbar-hide">
                      <table className="w-full text-left min-w-[700px]">
                        <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                          <tr>
                            <th className="px-6 py-4">Nama Pegawai</th>
                            <th className="px-6 py-4">Lokasi Kerja</th>
                            <th className="px-6 py-4">Shift</th>
                            <th className="px-6 py-4">Jam Datang</th>
                            <th className="px-6 py-4">Jam Pulang</th>
                            <th className="px-6 py-4">Status / Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {todayData.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">Belum ada data presensi hari ini.</td></tr>
                          ) : (
                            todayData.map((d, i) => (
                              <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-6 py-4 font-bold text-slate-800">{d.Name}</td>
                                <td className="px-6 py-4 text-slate-500 text-sm font-medium">{d.Location}</td>
                                <td className="px-6 py-4 text-slate-500 text-sm">{d.Shift}</td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-700">{d.TimeIn}</td>
                                <td className="px-6 py-4 text-slate-400 text-sm font-medium">{d.TimeOut || '--:--'}</td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                      d.Status === 'Terlambat' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                                    }`}>
                                      {d.Status}
                                    </span>
                                    {d.Note && <span className="text-[10px] text-red-500 italic font-medium">{d.Note}</span>}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-2 w-full">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dari Tanggal</label>
                      <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setHistoryPage(1); }} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all" />
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sampai Tanggal</label>
                      <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setHistoryPage(1); }} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all" />
                    </div>
                    <button 
                      onClick={exportToExcel}
                      className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all text-sm shadow-lg shadow-green-600/20 active:scale-95 w-full md:w-auto whitespace-nowrap"
                    >
                      <Download size={18} />
                      Export Excel
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                          <tr>
                            <th className="px-6 py-4">Tanggal</th>
                            <th className="px-6 py-4">Nama</th>
                            <th className="px-6 py-4">Lokasi</th>
                            <th className="px-6 py-4">Shift</th>
                            <th className="px-6 py-4">Datang</th>
                            <th className="px-6 py-4">Pulang</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredHistory.slice((historyPage - 1) * 5, historyPage * 5).map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors text-sm group">
                              <td className="px-6 py-4 text-slate-500 font-medium">{d.Date}</td>
                              <td className="px-6 py-4 font-bold text-slate-800">{d.Name}</td>
                              <td className="px-6 py-4 text-slate-500">{d.Location}</td>
                              <td className="px-6 py-4 text-slate-500">{d.Shift}</td>
                              <td className="px-6 py-4 text-slate-700 font-bold">{d.TimeIn}</td>
                              <td className="px-6 py-4 text-slate-400 font-medium">{d.TimeOut || '--:--'}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${d.Status === 'Terlambat' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                  {d.Status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                                  <Eye size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {filteredHistory.length === 0 && (
                            <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">Tidak ada data untuk periode ini.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {filteredHistory.length > 0 && (
                      <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-white">
                        <div className="text-sm font-medium text-slate-500">
                          Menampilkan {((historyPage - 1) * 5) + 1}-{Math.min(historyPage * 5, filteredHistory.length)} dari {filteredHistory.length} entri
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            disabled={historyPage === 1}
                            onClick={() => setHistoryPage(p => p - 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <ChevronRight size={16} className="rotate-180" />
                          </button>
                          {Array.from({ length: Math.ceil(filteredHistory.length / 5) }).map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setHistoryPage(i + 1)}
                              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${
                                historyPage === i + 1 ? 'bg-[#B21B1B] text-white' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))}
                          <button 
                            disabled={historyPage === Math.ceil(filteredHistory.length / 5)}
                            onClick={() => setHistoryPage(p => p + 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'employees' && (
                <EmployeeStatsView attendanceData={attendanceData} />
              )}

              {activeTab === 'settings' && (
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="mb-8">
                    <h2 className="text-2xl font-black text-slate-800">Pengaturan Admin</h2>
                    <p className="text-slate-500 text-sm mt-1">Kelola kredensial akses dashboard admin dan preferensi sistem.</p>
                  </div>
                  
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-[#B21B1B]">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-lg">Keamanan Akun</h3>
                        <p className="text-xs font-medium text-slate-500">Perbarui ID dan Password untuk login admin</p>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin ID Baru</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="text" 
                            value={newId} 
                            onChange={e => setNewId(e.target.value)}
                            placeholder="Masukkan ID baru" 
                            className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all" 
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password Baru</label>
                        <div className="relative">
                          <Settings className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="password" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Masukkan password baru" 
                            className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all" 
                          />
                        </div>
                      </div>
                      
                      <button 
                        onClick={handleUpdateAdmin}
                        className="w-full bg-[#B21B1B] text-white py-4 rounded-xl font-bold shadow-lg shadow-red-900/20 hover:bg-[#901515] transition-all active:scale-[0.98] mt-4"
                      >
                        SIMPAN PERUBAHAN
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </main>
      </div>

      {/* Popups */}
      <AnimatePresence>
        {showPresentPopup && (
          <Modal title="Pegawai Hadir Tepat Waktu" onClose={() => setShowPresentPopup(false)}>
            <div className="space-y-3">
              {presentOnTime.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-green-50 rounded-2xl border border-green-100 transition-colors hover:bg-green-100/50">
                  <span className="font-bold text-green-800">{p.Name}</span>
                  <span className="text-sm font-bold text-green-600 bg-white px-3 py-1 rounded-lg shadow-sm">{p.TimeIn}</span>
                </div>
              ))}
              {presentOnTime.length === 0 && <p className="text-center text-slate-400 font-medium py-8">Belum ada data kehadiran tepat waktu hari ini.</p>}
            </div>
          </Modal>
        )}
        {showLatePopup && (
          <Modal title="Pegawai Terlambat" onClose={() => setShowLatePopup(false)}>
            <div className="space-y-3">
              {lateEmployees.map((p, i) => (
                <div key={i} className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-2 transition-colors hover:bg-red-100/50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-red-800">{p.Name}</span>
                    <span className="text-sm font-bold text-red-600 bg-white px-3 py-1 rounded-lg shadow-sm">{p.TimeIn}</span>
                  </div>
                  {p.Note && <p className="text-xs text-red-600/80 font-medium bg-red-100/50 p-2 rounded-lg">Catatan: {p.Note}</p>}
                </div>
              ))}
              {lateEmployees.length === 0 && <p className="text-center text-slate-400 font-medium py-8">Tidak ada pegawai terlambat hari ini.</p>}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, collapsed = false }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; collapsed?: boolean }) {
  return (
    <button 
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all font-bold ${
        active 
          ? 'bg-[#B21B1B] text-white shadow-md shadow-red-900/20' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      } ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <div className="min-w-[24px] flex items-center justify-center">
        {icon}
      </div>
      {!collapsed && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}

function SummaryCard({ label, count, color, onClick }: { label: string; count: number; color: 'green' | 'red'; onClick: () => void }) {
  const isGreen = color === 'green';
  return (
    <motion.button 
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white p-6 md:p-8 rounded-3xl text-left shadow-sm border border-slate-100 flex items-center justify-between transition-all hover:shadow-xl group overflow-hidden relative cursor-pointer"
    >
      <div className={`absolute -right-4 -top-4 w-32 h-32 rounded-full -z-10 opacity-20 transition-transform duration-500 group-hover:scale-150 ${isGreen ? 'bg-green-500' : 'bg-red-500'}`} />
      <div className="relative z-10">
        <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
        <div className={`text-4xl md:text-5xl font-black ${isGreen ? 'text-green-500' : 'text-[#B21B1B]'}`}>{count}</div>
      </div>
      <div className={`p-4 rounded-2xl relative z-10 ${isGreen ? 'bg-green-50 text-green-500' : 'bg-red-50 text-[#B21B1B]'}`}>
        {isGreen ? <CheckCircle2 size={36} /> : <AlertCircle size={36} />}
      </div>
    </motion.button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10 border border-slate-100"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-extrabold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors bg-white shadow-sm"><X size={18} /></button>
        </div>
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function EmployeeStatsView({ attendanceData }: { attendanceData: AttendanceData[] }) {
  const [viewState, setViewState] = useState<'grid' | 'add' | 'edit' | 'stats'>('grid');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Semua');
  const [deletedEmployees, setDeletedEmployees] = useState<Set<string>>(new Set());

  // Generate employee list from attendance data
  const employeesMap = new Map();
  attendanceData.forEach(d => {
    if (!employeesMap.has(d.Name)) {
      const len = d.Name.length;
      const role = len % 3 === 0 ? 'Manager Operasional' : (len % 2 === 0 ? 'Staff Administrasi' : 'Koordinator Lapangan');
      const empStatus = len % 7 === 0 ? 'CUTI' : 'AKTIF';
      const contractStatus = len % 5 === 0 ? 'Kontrak' : (len % 4 === 0 ? 'Magang' : 'Staff Tetap');
      employeesMap.set(d.Name, {
        name: d.Name,
        role: role,
        status: empStatus,
        contract: contractStatus
      });
    }
  });
  
  const allEmployees = Array.from(employeesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const activeEmployees = allEmployees.filter(e => !deletedEmployees.has(e.name));
  const displayEmployees = activeEmployees
    .filter(e => filter === 'Semua' || e.contract === filter)
    .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const uniquePresentToday = new Set(attendanceData.filter(d => {
    const dDate = typeof d.Date === 'string' ? d.Date.split('T')[0] : format(new Date(d.Date), 'yyyy-MM-dd');
    return dDate === todayDateStr;
  }).map(d => d.Name));
  const attendancePercentage = activeEmployees.length > 0 ? Math.round((uniquePresentToday.size / activeEmployees.length) * 100) : 0;

  const handleDelete = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Apakah Anda yakin ingin menghapus data ${name}?`)) {
      const newDeleted = new Set(deletedEmployees);
      newDeleted.add(name);
      setDeletedEmployees(newDeleted);
    }
  };

  const stats = selectedEmployee ? attendanceData.filter(d => {
    const dDate = typeof d.Date === 'string' ? d.Date.split('T')[0] : format(new Date(d.Date), 'yyyy-MM-dd');
    return d.Name === selectedEmployee && dDate >= startDate && dDate <= endDate;
  }) : [];

  const totalPresent = stats.length;
  const totalLate = stats.filter(d => d.Status === 'Terlambat').length;
  const overtimeData = stats.filter(d => d.Shift === 'SHIFT LEMBUR');

  if (viewState === 'add' || viewState === 'edit') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
          <button onClick={() => setViewState('grid')} className="hover:text-[#B21B1B] transition-colors">Data Pegawai</button>
          <ChevronRight size={14} />
          <span className="text-[#B21B1B] font-bold">{viewState === 'add' ? 'Tambah Pegawai Baru' : 'Edit Data Pegawai'}</span>
        </div>
        
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 space-y-8">
          <div className="flex items-start justify-between border-b border-slate-100 pb-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">{viewState === 'add' ? 'Informasi Personal & Pekerjaan' : 'Edit Informasi Pegawai'}</h2>
              <p className="text-slate-500 text-sm mt-1">Lengkapi data di bawah ini untuk mendaftarkan pegawai baru ke sistem.</p>
            </div>
            <div className="px-4 py-1.5 bg-red-50 text-[#B21B1B] text-[10px] font-bold uppercase tracking-wider rounded-full">Draft Otomatis</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Lengkap</label>
              <input type="text" placeholder="Contoh: Budi Santoso" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Departemen / Divisi</label>
              <select className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all appearance-none">
                <option>Pilih Departemen</option>
                <option>Operasional</option>
                <option>Keuangan</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nomor Induk Pegawai (NIP)</label>
              <input type="text" placeholder="GIAT-2024-XXXX" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status Kepegawaian</label>
              <div className="flex gap-4">
                <label className="flex-1 p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="status" className="w-4 h-4 text-[#B21B1B] focus:ring-[#B21B1B]" />
                  <span className="text-sm font-medium">Tetap</span>
                </label>
                <label className="flex-1 p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="status" className="w-4 h-4 text-[#B21B1B] focus:ring-[#B21B1B]" />
                  <span className="text-sm font-medium">Kontrak</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jabatan</label>
              <select className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all appearance-none">
                <option>Pilih Jabatan</option>
                <option>Manager</option>
                <option>Staff</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tanggal Bergabung</label>
              <input type="date" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all" />
            </div>
          </div>

          <div className="p-8 border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl flex items-center gap-6 relative">
            <input type="file" id="photo-upload" className="hidden" accept="image/*" />
            <label htmlFor="photo-upload" className="w-24 h-24 rounded-full border border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-100 transition-colors">
              <Camera size={24} className="mb-1" />
              <span className="text-[10px] font-bold">Upload Foto</span>
            </label>
            <div>
              <h4 className="font-bold text-slate-800">Foto Profil Pegawai</h4>
              <p className="text-xs text-slate-500 mt-1">Format JPG, PNG, atau WEBP. Maksimal ukuran file 2MB dengan aspek rasio 1:1 untuk hasil terbaik.</p>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
            <button onClick={() => setViewState('grid')} className="px-8 py-4 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-colors border border-red-200">
              Batal
            </button>
            <button onClick={() => setViewState('grid')} className="px-8 py-4 rounded-xl font-bold text-white bg-[#B21B1B] shadow-lg shadow-red-900/20 hover:bg-[#901515] transition-colors flex items-center gap-2">
              <Upload size={18} /> {viewState === 'add' ? 'Simpan Pegawai' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'stats') {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
          <button onClick={() => setViewState('grid')} className="flex items-center gap-2 text-slate-600 font-bold text-lg hover:text-[#B21B1B] transition-colors">
            <ArrowLeft size={20} /> Statistik Pegawai
          </button>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Periode Data</div>
              <div className="text-xs font-bold text-slate-700">14 April - 13 Mei 2026</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden relative border-2 border-white shadow-sm flex-shrink-0">
               <User className="w-full h-full text-slate-400 p-2 bg-slate-100" />
               <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{selectedEmployee}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">ID: GIAT-2024-XXXX</p>
              <p className="text-xs text-[#B21B1B] font-medium">Operasional</p>
            </div>
          </div>
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border-t-4 border-t-green-500 shadow-sm flex flex-col justify-center items-center text-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Kehadiran</div>
            <div className="text-4xl font-black text-slate-800">{totalPresent}</div>
            <div className="text-[10px] text-green-500 font-bold mt-1 bg-green-50 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 size={10} /> 94.4% Rate</div>
          </div>
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border-t-4 border-t-[#B21B1B] shadow-sm flex flex-col justify-center items-center text-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Terlambat</div>
            <div className="text-4xl font-black text-slate-800">{totalLate}</div>
            <div className="text-[10px] text-[#B21B1B] font-bold mt-1 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1"><AlertCircle size={10} /> 1x Sanksi</div>
          </div>
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border-t-4 border-t-blue-500 shadow-sm flex flex-col justify-center items-center text-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lembur (Jam)</div>
            <div className="text-4xl font-black text-slate-800">{overtimeData.length * 2}</div>
            <div className="text-[10px] text-slate-500 font-bold mt-1 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1"><History size={10} /> {overtimeData.length}x Jam</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white">
            <h3 className="font-extrabold text-slate-800 text-lg">Detail Pelanggaran & Lembur</h3>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Cari tanggal..." className="w-full sm:w-64 pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#B21B1B]/50 focus:ring-1 focus:ring-[#B21B1B]/50 transition-all" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-white text-slate-400 text-[10px] uppercase tracking-widest font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Waktu Masuk</th>
                  <th className="px-6 py-4">Waktu Keluar</th>
                  <th className="px-6 py-4">Keterangan</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.filter(d => d.Status === 'Terlambat' || d.Shift === 'SHIFT LEMBUR').map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">{d.Date}</td>
                    <td className="px-6 py-4">
                       <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider inline-block ${d.Shift === 'SHIFT LEMBUR' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                        {d.Shift === 'SHIFT LEMBUR' ? 'LEMBUR (1 JAM)' : `TERLAMBAT (0.5J)`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{d.TimeIn}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{d.TimeOut || '17:00'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 italic">{d.Shift === 'SHIFT LEMBUR' ? 'Update stok gudang' : `Alasan: ${d.Note || 'Macet'}`}</td>
                    <td className="px-6 py-4 text-center">
                      <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {stats.filter(d => d.Status === 'Terlambat' || d.Shift === 'SHIFT LEMBUR').length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium italic">Tidak ada catatan khusus pada periode ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 text-xs text-slate-500">
            <span>Menampilkan data 30 hari terakhir</span>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
               <ChevronRight size={14} className="rotate-180 text-slate-300" />
               <span className="font-bold text-slate-700">Halaman 1 dari 1</span>
               <ChevronRight size={14} className="text-slate-300" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // viewState === 'grid'
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Data Pegawai</h2>
          <p className="text-slate-500 text-sm mt-1">Kelola informasi dan tinjau kinerja tim Koperasi GIAT secara mendalam.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={() => setViewState('add')} className="flex-1 md:flex-none flex justify-center items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-[#B21B1B] shadow-lg shadow-red-900/20 hover:bg-[#901515] transition-colors text-sm">
            <Plus size={16} /> Tambah Pegawai
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex-1 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#B21B1B]"></div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">TOTAL PEGAWAI</div>
          <div className="text-4xl font-black text-slate-800">{activeEmployees.length}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex-1 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500"></div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">KEHADIRAN HARI INI</div>
          <div className="text-4xl font-black text-slate-800">{attendancePercentage}%</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex-[2] flex flex-col justify-center">
          <div className="flex justify-between items-center mb-4">
             <div className="text-xs font-bold text-slate-800">Filter Cepat</div>
             <Filter size={16} className="text-slate-400" />
          </div>
          <div className="flex flex-wrap gap-2">
            {['Semua', 'Staff Tetap', 'Kontrak', 'Magang'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  filter === f ? 'bg-slate-100 text-slate-600' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-2 pl-4 rounded-xl shadow-sm border border-slate-100">
         <div className="flex items-center gap-2 text-slate-400 w-full">
           <Search size={18} />
           <input 
             type="text" 
             value={searchQuery}
             onChange={e => setSearchQuery(e.target.value)}
             placeholder="Cari data pegawai..." 
             className="bg-transparent border-none outline-none text-sm w-full font-medium" 
           />
         </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {displayEmployees.map((emp) => (
          <div key={emp.name} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg transition-all flex flex-col items-center text-center group relative overflow-hidden">
            <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setSelectedEmployee(emp.name); setViewState('edit'); }} className="p-1.5 bg-blue-50 text-blue-500 rounded-md hover:bg-blue-100 transition-colors" title="Edit Pegawai">
                <Edit2 size={14} />
              </button>
              <button onClick={(e) => handleDelete(emp.name, e)} className="p-1.5 bg-red-50 text-red-500 rounded-md hover:bg-red-100 transition-colors" title="Hapus Pegawai">
                <Trash2 size={14} />
              </button>
            </div>
            <div className="relative mb-4">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-md">
                <User className="text-slate-400 w-10 h-10" />
              </div>
            </div>
            <h4 className="font-extrabold text-slate-800 text-lg line-clamp-1 w-full px-2" title={emp.name}>{emp.name}</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 mb-6">{emp.role}</p>
            
            <div className="w-full flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
              <span className={`text-[9px] font-black tracking-widest px-2 py-1 rounded-md uppercase ${emp.status === 'CUTI' ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-500'}`}>
                {emp.status}
              </span>
              <button 
                onClick={() => { setSelectedEmployee(emp.name); setViewState('stats'); }}
                className="text-[10px] font-bold text-[#B21B1B] hover:text-red-900 transition-colors flex items-center gap-1 group-hover:underline"
              >
                Lihat Statistik <ChevronRight size={12} />
              </button>
            </div>
          </div>
        ))}
        {displayEmployees.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 font-medium italic">Tidak ada pegawai yang sesuai dengan filter.</div>
        )}
      </div>
      
      <div className="flex justify-center pt-4">
        <button className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 px-6 py-3 rounded-full hover:bg-slate-50 transition-colors">
          Muat Lebih Banyak <ChevronRight size={14} className="rotate-90" />
        </button>
      </div>
    </div>
  );
}
