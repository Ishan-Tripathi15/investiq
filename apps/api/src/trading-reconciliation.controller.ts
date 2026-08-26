import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { TradingReconciliationService } from './trading-reconciliation.service';

@Controller('trading/reconciliation')
@UseGuards(AuthGuard)
export class TradingReconciliationController {
  constructor(private readonly service: TradingReconciliationService) {}

  @Get()
  reconcile() {
    return this.service.reconcile('current-user');
  }
}
