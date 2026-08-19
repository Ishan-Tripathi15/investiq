import { Injectable } from '@nestjs/common';
import { decryptField, encryptField } from './security.crypto';
import { ProfileRepository } from './profile.repository';

const FIELDS = ['full_name','date_of_birth','email','phone','pan','address','city','state','postal_code','country','occupation','nominee'] as const;
type ProfileField = typeof FIELDS[number];

@Injectable()
export class ProfileService {
  constructor(private readonly repository: ProfileRepository) {}
  async get(userId:string){
    const profile=await this.repository.get(userId); if(!profile) return {user_id:userId,kyc_status:'not_started'};
    const result:Record<string,unknown>={user_id:userId,kyc_status:profile.kycStatus,risk_profile:profile.riskProfile,kyc_provider:profile.kycProvider,kyc_reference:profile.kycReference,kyc_verified_at:profile.kycVerifiedAt};
    for(const field of FIELDS){const encrypted=profile.fields[field]; if(encrypted){try{result[field]=decryptField(encrypted);}catch{result[field]='[protected]';}}}
    if(typeof result.pan==='string') result.pan=this.maskPan(result.pan);
    return result;
  }
  async update(userId:string,body:Record<string,unknown>){
    const encrypted:Record<string,string|undefined>={};
    for(const field of FIELDS){const value=body[field]; if(value!==undefined){if(typeof value!=='string'||value.length>1000) throw new Error(`${field} must be a string up to 1000 characters`); encrypted[field]=encryptField(value);}}
    const risk=body.risk_profile; if(risk!==undefined && !['conservative','moderate','aggressive'].includes(String(risk))) throw new Error('Invalid risk profile');
    await this.repository.upsert(userId,encrypted,risk===undefined?undefined:String(risk)); return this.get(userId);
  }
  async startKyc(userId:string){await this.repository.startKyc(userId);return this.get(userId);}
  private maskPan(pan:string){const normalized=pan.replace(/\s+/g,'');return normalized.length<=4?'****':`${'*'.repeat(Math.max(0,normalized.length-4))}${normalized.slice(-4)}`;}
}
