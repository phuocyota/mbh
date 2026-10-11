import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KitchenService } from './kitchen.service';

@Injectable()
export class KitchenScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(private readonly kitchen: KitchenService) {}

  onModuleInit() {
    if (!this.kitchen.isEnabled()) return;
    void this.run();
    this.timer = setInterval(() => void this.run(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async run() {
    try {
      await this.kitchen.lockDuePlans();
      await this.kitchen.reconcilePaidTickets();
    } catch (error) {
      console.error('Kitchen scheduler failed', error);
    }
  }
}
