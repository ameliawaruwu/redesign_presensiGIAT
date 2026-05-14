import { AttendanceData, AdminConfig } from '../types';

// REPLACE THIS WITH YOUR DEPLOYED GOOGLE APPS SCRIPT URL
const API_URL = 'https://script.google.com/macros/s/AKfycbyhUuhwlaS6cA9vH3xCQOcpULhQymrErXiye0RV1dzvD0B3Kk9qY2DRzKpUpS-4t14oog/exec';

export const api = {
  async getAdminConfig(): Promise<AdminConfig> {
    try {
      const res = await fetch(`${API_URL}?action=getAdmin`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return { id: 'admin', password: 'admin' }; // Fallback
    }
  },

  async updateAdminConfig(config: AdminConfig) {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'updateAdmin', ...config })
    });
    return await res.json();
  },

  async saveAttendance(data: Partial<AttendanceData>) {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveAttendance', data })
    });
    return await res.json();
  },

  async getAttendanceHistory(): Promise<AttendanceData[]> {
    try {
      const res = await fetch(`${API_URL}?action=getAttendance`);
      const data = await res.json();
      return data;
    } catch (e) {
      console.error(e);
      return [];
    }
  }
};
