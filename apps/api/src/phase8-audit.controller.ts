import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { Phase8AuditService } from './phase8-audit.service';

@Controller('system/phase8')
@UseGuards(AuthGuard)
export class Phase8AuditController {
  constructor(private readonly service: Phase8AuditService) {}

  @Get('readiness')
  readiness() {
    return this.service.summary();
  }
}
