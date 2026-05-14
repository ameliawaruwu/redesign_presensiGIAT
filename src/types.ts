export type Shift = 'SHIFT OFFICE' | 'SHIFT 1 07.00-15.30' | 'SHIFT 2 10.00-18.30' | 'SHIFT NORMAL 08.00-16.30' | 'SHIFT LEMBUR';

export interface AttendanceData {
  Timestamp?: string;
  Date: string;
  Name: string;
  Location: string;
  Shift: Shift;
  TimeIn: string;
  TimeOut: string;
  Status: 'Tepat Waktu' | 'Terlambat';
  Note: string;
}

export interface AdminConfig {
  id: string;
  password: string;
}

export const EMPLOYEES = [
  'DANNY', 'BUDIMAN', 'DEVY', 'ANGGI', 'ARI', 'FAHMI', 
  'SEPTIANA', 'YUSUF', 'WAWAN', 'JOJO', 'AMEL'
];

export const LOCATIONS = [
  'OFFICE GIAT', 'GIAT MART', 'ARTSHOP', 'FOTOCOPY', 'GIAT EXPRESS'
];

export const SHIFTS: Record<Shift, string> = {
  'SHIFT OFFICE': '08:00',
  'SHIFT 1 07.00-15.30': '07:00',
  'SHIFT 2 10.00-18.30': '10:00',
  'SHIFT NORMAL 08.00-16.30': '08:00',
  'SHIFT LEMBUR': '00:00' // Flexible
};
