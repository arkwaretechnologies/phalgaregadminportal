export interface User {
  user_id: number;
  username: string;
  fullname: string;
  role: 'admin' | 'reviewer';
  created_at: string;
  updated_at: string;
}

export interface Registration {
  regnum: number;
  transid: string;
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
}

export interface RegistrationDetail extends Registration {
  regd?: RegistrationDetailItem[];
}

export interface RegistrationDetailItem {
  confcode: string | null;
  regnum: number;
  linenum: number;
  lastname: string | null;
  firstname: string | null;
  middleinit: string | null;
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
