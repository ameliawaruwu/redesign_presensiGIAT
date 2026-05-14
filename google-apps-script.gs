/**
 * GOOGLE APPS SCRIPT - VERSI FINAL (04 April 2026)
 * Fitur: Validasi Check-in/Out Harian, Pencegahan Duplikasi, & Sinkronisasi Real-time
 */

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Inisialisasi Sheet Attendance
  let attendanceSheet = ss.getSheetByName('Attendance');
  if (!attendanceSheet) {
    attendanceSheet = ss.insertSheet('Attendance');
    attendanceSheet.appendRow(['Timestamp', 'Date', 'Name', 'Location', 'Shift', 'TimeIn', 'TimeOut', 'Status', 'Note']);
    attendanceSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#f3f3f3');
  }
  
  // 2. Inisialisasi Sheet Admin
  let adminSheet = ss.getSheetByName('Admin');
  if (!adminSheet) {
    adminSheet = ss.insertSheet('Admin');
    adminSheet.appendRow(['id', 'password']);
    adminSheet.appendRow(['admin', 'giat123']); // Default password
  }
  
  return ss;
}

function doGet(e) {
  const action = e.parameter.action;
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Ambil Konfigurasi Admin
  if (action === 'getAdmin') {
    let sheet = ss.getSheetByName('Admin') || initSheets().getSheetByName('Admin');
    const data = sheet.getRange(2, 1, 1, 2).getValues()[0];
    return jsonResponse({ id: data[0], password: data[1] });
  }
  
  // Ambil Riwayat Presensi
  if (action === 'getAttendance') {
    let sheet = ss.getSheetByName('Attendance') || initSheets().getSheetByName('Attendance');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const rows = data.map(r => {
      let obj = {};
      headers.forEach((h, i) => {
        // Pastikan format tanggal konsisten yyyy-MM-dd untuk React
        if (r[i] instanceof Date && h === 'Date') {
          obj[h] = Utilities.formatDate(r[i], ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
        } else {
          obj[h] = r[i];
        }
      });
      return obj;
    });
    return jsonResponse(rows);
  }

  return ContentService.createTextOutput("Invalid Action").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, message: 'Invalid JSON payload' });
  }
  
  const action = params.action;
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'saveAttendance') {
    let sheet = ss.getSheetByName('Attendance') || initSheets().getSheetByName('Attendance');
    const data = params.data;
    const rows = sheet.getDataRange().getValues();
    
    // Cari baris data untuk Nama & Tanggal yang sama hari ini
    let existingRowIndex = -1;
    const todayStr = data.Date; // Format 'yyyy-MM-dd' dari React
    
    for (let i = rows.length - 1; i >= 1; i--) {
      let rowDate = rows[i][1];
      let rowDateStr = "";
      
      if (rowDate instanceof Date) {
        rowDateStr = Utilities.formatDate(rowDate, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
      } else if (typeof rowDate === 'string') {
        // Handle string date if stored as string
        rowDateStr = rowDate.split('T')[0]; // Simple ISO match
      }
      
      if (rows[i][2] === data.Name && rowDateStr === todayStr) {
        existingRowIndex = i + 1;
        break;
      }
    }

    // --- LOGIKA PULANG (UPDATE TIMEOUT) ---
    if (data.TimeOut) {
      if (existingRowIndex !== -1) {
        // Update kolom TimeOut (Kolom G / index ke-6 dalam array base 0, tapi sheet index data)
        // Header: Timestamp(0), Date(1), Name(2), Location(3), Shift(4), TimeIn(5), TimeOut(6)
        sheet.getRange(existingRowIndex, 7).setValue(data.TimeOut);
        return jsonResponse({ success: true, message: 'Presensi Pulang Berhasil' });
      } else {
        return jsonResponse({ success: false, message: 'Data Masuk tidak ditemukan untuk hari ini' });
      }
    } 
    
    // --- LOGIKA MASUK (APPEND NEW ROW) ---
    else {
      // Validasi: Jangan izinkan double check-in di hari yang sama
      if (existingRowIndex !== -1) {
        return jsonResponse({ success: false, message: 'Anda sudah melakukan Presensi Masuk hari ini' });
      }
      
      sheet.appendRow([
        new Date(), // Timestamp
        data.Date,
        data.Name,
        data.Location,
        data.Shift,
        data.TimeIn,
        '',         // TimeOut (kosong saat check-in)
        data.Status,
        data.Note
      ]);
      return jsonResponse({ success: true, message: 'Presensi Masuk Berhasil' });
    }
  }
  
  // Update Password Admin
  if (action === 'updateAdmin') {
    const sheet = ss.getSheetByName('Admin') || initSheets().getSheetByName('Admin');
    sheet.getRange(2, 1).setValue(params.id);
    sheet.getRange(2, 2).setValue(params.password);
    return jsonResponse({ success: true });
  }

  return jsonResponse({ success: false, message: 'Unknown action' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
