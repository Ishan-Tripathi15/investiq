import { Pool } from 'pg';

export interface StoredProfile {
  userId: string;
  fields: Record<string, string | undefined>;
  riskProfile?: string;
  kycStatus: string;
  kycProvider?: string;
  kycReference?: string;
  kycVerifiedAt?: string;
}

export class ProfileRepository {
  private readonly pool: Pool | null;
  constructor() { const url = process.env.DATABASE_URL; this.pool = url ? new Pool({ connectionString:url, max:10, idleTimeoutMillis:30_000 }) : null; }
  private async schema() {
    if (!this.pool) return;
    await this.pool.query(`CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY, full_name_ciphertext TEXT, date_of_birth_ciphertext TEXT, email_ciphertext TEXT, phone_ciphertext TEXT, pan_ciphertext TEXT, address_ciphertext TEXT, city_ciphertext TEXT, state_ciphertext TEXT, postal_code_ciphertext TEXT, country_ciphertext TEXT, occupation_ciphertext TEXT, risk_profile TEXT, nominee_ciphertext TEXT, kyc_status TEXT NOT NULL DEFAULT 'not_started', kyc_provider TEXT, kyc_reference TEXT, kyc_verified_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
  }
  async get(userId:string):Promise<StoredProfile|null>{
    if(!this.pool) return null; await this.schema(); const r=await this.pool.query(`SELECT * FROM user_profiles WHERE user_id=$1`,[userId]); const x=r.rows[0]; if(!x) return null;
    const fields:Record<string,string|undefined>={}; for(const key of ['full_name','date_of_birth','email','phone','pan','address','city','state','postal_code','country','occupation','nominee']) fields[key]=x[`${key}_ciphertext`] ?? undefined;
    return {userId,fields,riskProfile:x.risk_profile??undefined,kycStatus:x.kyc_status,kycProvider:x.kyc_provider??undefined,kycReference:x.kyc_reference??undefined,kycVerifiedAt:x.kyc_verified_at?new Date(x.kyc_verified_at).toISOString():undefined};
  }
  async upsert(userId:string, encrypted:Record<string,string|undefined>, riskProfile?:string):Promise<void>{
    if(!this.pool) throw new Error('DATABASE_URL is required for profiles'); await this.schema();
    await this.pool.query(`INSERT INTO user_profiles(user_id,full_name_ciphertext,date_of_birth_ciphertext,email_ciphertext,phone_ciphertext,pan_ciphertext,address_ciphertext,city_ciphertext,state_ciphertext,postal_code_ciphertext,country_ciphertext,occupation_ciphertext,nominee_ciphertext,risk_profile) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(user_id) DO UPDATE SET full_name_ciphertext=COALESCE(EXCLUDED.full_name_ciphertext,user_profiles.full_name_ciphertext),date_of_birth_ciphertext=COALESCE(EXCLUDED.date_of_birth_ciphertext,user_profiles.date_of_birth_ciphertext),email_ciphertext=COALESCE(EXCLUDED.email_ciphertext,user_profiles.email_ciphertext),phone_ciphertext=COALESCE(EXCLUDED.phone_ciphertext,user_profiles.phone_ciphertext),pan_ciphertext=COALESCE(EXCLUDED.pan_ciphertext,user_profiles.pan_ciphertext),address_ciphertext=COALESCE(EXCLUDED.address_ciphertext,user_profiles.address_ciphertext),city_ciphertext=COALESCE(EXCLUDED.city_ciphertext,user_profiles.city_ciphertext),state_ciphertext=COALESCE(EXCLUDED.state_ciphertext,user_profiles.state_ciphertext),postal_code_ciphertext=COALESCE(EXCLUDED.postal_code_ciphertext,user_profiles.postal_code_ciphertext),country_ciphertext=COALESCE(EXCLUDED.country_ciphertext,user_profiles.country_ciphertext),occupation_ciphertext=COALESCE(EXCLUDED.occupation_ciphertext,user_profiles.occupation_ciphertext),nominee_ciphertext=COALESCE(EXCLUDED.nominee_ciphertext,user_profiles.nominee_ciphertext),risk_profile=COALESCE(EXCLUDED.risk_profile,user_profiles.risk_profile),updated_at=NOW()`,[userId,encrypted.full_name,encrypted.date_of_birth,encrypted.email,encrypted.phone,encrypted.pan,encrypted.address,encrypted.city,encrypted.state,encrypted.postal_code,encrypted.country,encrypted.occupation,encrypted.nominee,riskProfile]);
  }
  async startKyc(userId:string):Promise<void>{if(!this.pool) throw new Error('DATABASE_URL is required for KYC');await this.schema();await this.pool.query(`INSERT INTO user_profiles(user_id,kyc_status) VALUES($1,'pending') ON CONFLICT(user_id) DO UPDATE SET kyc_status='pending',updated_at=NOW()`,[userId]);}
  async setKyc(userId:string,status:string,provider?:string,reference?:string,verifiedAt?:string):Promise<void>{if(!this.pool) throw new Error('DATABASE_URL is required for KYC');await this.schema();await this.pool.query(`UPDATE user_profiles SET kyc_status=$2,kyc_provider=$3,kyc_reference=$4,kyc_verified_at=$5,updated_at=NOW() WHERE user_id=$1`,[userId,status,provider??null,reference??null,verifiedAt??null]);}
}
