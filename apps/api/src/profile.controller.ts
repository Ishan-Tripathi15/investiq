import { BadRequestException, Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}
  @Get() get(@Req() req:AuthenticatedRequest){return this.profile.get(req.user!.id);}
  @Put() async update(@Req() req:AuthenticatedRequest,@Body() body:Record<string,unknown>){try{return await this.profile.update(req.user!.id,body);}catch(error){throw new BadRequestException(error instanceof Error?error.message:'Invalid profile');}}
  @Post('kyc/start') startKyc(@Req() req:AuthenticatedRequest){return this.profile.startKyc(req.user!.id);}
}
