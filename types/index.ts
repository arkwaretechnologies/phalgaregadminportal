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
  status:
    | 'PENDING'
    | 'APPROVED'
    | 'APPROVED REPRESENTATIVE ONLY'
    | 'APPROVED PARTICIPANT AND ACCOMPANYING'
    | 'REJECTED'
    | null;
  remarks: string | null;
  payment_proof_url?: string | null; // Payment proof file URL or path in storage
  participant_count?: number; // Derived: number of regD rows for this batchnum
  proof_uploaded_at?: string | null; // Timestamp when proof was last uploaded (from upload_notification table)
  last_viewed_at?: string | null; // Timestamp when registration was last viewed by admin (from upload_notification table)
}

export interface RegistrationDetail extends Registration {
  regd?: RegistrationDetailItem[];
  /** From `conference.is_anc` when loading detail; 'Y' = ANC (header LGU/Province hidden; participant Province/LGU shown, Barangay hidden). */
  is_anc?: string | null;
  /** From `conference.is_award` when loading detail; 'Y' = award flow (pending UI label vs approval status). */
  is_award?: string | null;
  /** From `conference.reg_fee` when loading detail; normalized to a number on the server. */
  reg_fee?: number | null;
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

/** Matches `public.conference` (see migrations / Supabase). */
export interface Conference {
  confcode: string;
  name: string | null;
  date_from: string | null; // ISO date string
  date_to: string | null; // ISO date string
  venue: string | null;
  /** `bigint` in DB */
  reg_limit: number | null;
  domain: string | null;
  psgc: string | null;
  prefix: string | null;
  reg_alert_count: number | null;
  include_psgc: string | null;
  exclude_psgc: string | null;
  on_maintenance: string | null;
  notification: string | null;
  linked_conference: string | null;
  closed_conference: string | null;
  /** When 'Y', LGU/Province are not used for this conference (ANC flow). */
  is_anc: string | null;
  /** When 'Y', approved registrations use status APPROVED PARTICIPANT AND ACCOMPANYING. */
  is_award: string | null;
  /** `numeric` in DB (per-participant fee). PostgREST often serializes `numeric` as a JSON string. */
  reg_fee: number | string | null;
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