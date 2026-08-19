import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { MfaService } from './mfa.service';

@Controller('auth/mfa')
@UseGuards(AuthGuard)
export class MfaController {
  constructor(private readonly mfa:MfaService){}
  @Get('status') status(@Req() req:AuthenticatedRequest){return this.mfa.status(req.user!.id);}
  @Post('setup') setup(@Req() req:AuthenticatedRequest){return this.mfa.setup(req.user!.id);}
  @Post('enable') async enable(@Req() req:AuthenticatedRequest,@Body() body:{code?:unknown}){if(typeof body.code!=='string')throw new BadRequestException('code is required');return this.mfa.enable(req.user!.id,body.code);}
  @Post('disable') async disable(@Req() req:AuthenticatedRequest,@Body() body:{code?:unknown}){if(typeof body.code!=='string')throw new BadRequestException('code is required');return this.mfa.disable(req.user!.id,body.code);}
}
