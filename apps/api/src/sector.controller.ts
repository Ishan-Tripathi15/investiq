import { Controller, Get } from '@nestjs/common';
import { SectorService } from './sector.service';

@Controller('sector-overview')
export class SectorController {
  constructor(private readonly sectorService: SectorService) {}

  @Get()
  overview() {
    return this.sectorService.overview();
  }
}
