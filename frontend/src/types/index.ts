// Common types for the Duty Chart Management System

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'employee';
  department: string;
  employeeId: string;
}

export interface DutyShift {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  assignedTo: string;
  status: 'scheduled' | 'completed' | 'missed' | 'swapped';
  location: string;
  notes?: string;
}

export interface NavItem {
  title: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}