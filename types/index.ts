export interface User {
  user_id: number;
  username: string;
  fullname: string;
  role: 'admin' | 'reviewer';
  created_at: string;
  updated_at: string;
  assigned_conferences?: string[]; // Conference codes assigned to reviewer (empty/null for admin)
  default_conference?: string | null; // User's preferred default conference for pre-selection
}

export interface Registration {
  batchnum: number | null; // Generated when approved, null otherwise
  regid: string;
  confcode: string | null;
  province: string | null;
  lgu: string | null;
  contactperson: string | null;
  contactnum: string | null;
  email: string | null;
  regdate: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  remarks: string | null;
  payment_proof_url?: string | null; // Payment proof file URL or path in storage
  participant_count?: number; // Derived: number of regD rows for this batchnum
  proof_uploaded_at?: string | null; // Timestamp when proof was last uploaded (from upload_notification table)
  last_viewed_at?: string | null; // Timestamp when registration was last viewed by admin (from upload_notification table)
}

export interface RegistrationDetail extends Registration {
  regd?: RegistrationDetailItem[];
}

export interface RegistrationDetailItem {
  confcode: string | null;
  batchnum: number | null; // Generated when approved, null otherwise
  linenum: number;
  lastname: string | null;
  firstname: string | null;
  middleinit: string | null;
  suffix: string | null;
  designation: string | null;
  brgy: string | null;
  lgu: string | null;
  province: string | null;
  tshirtsize: string | null;
  contactnum: string | null;
  prcnum: string | null;
  expirydate: string | null;
  email: string | null;
}

export interface Conference {
  confcode: string;
  name: string | null;
  date_from: string | null; // ISO date string
  date_to: string | null; // ISO date string
  venue: string | null;
  reg_limit: number | null;
  domain: string | null;
}

export interface Position {
  position_id: number;
  name: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface Bank {
  id: number;
  confcode: string;
  bank_name: string;
  acct_no: string;
  payee: string;
}

export interface Contact {
  id: number;
  confcode: string;
  contact_no: string | null;
}