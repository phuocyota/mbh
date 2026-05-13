import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User, Customer, StudentProfile, Wallet, Class } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, Customer, StudentProfile, Wallet, Class])],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
