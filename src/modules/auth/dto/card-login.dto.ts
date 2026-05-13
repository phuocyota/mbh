import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CardLoginDto {
  @ApiProperty({
    description: 'Card ID for login (RFID card number)',
    example: '0089280076',
  })
  @IsNotEmpty()
  @IsString()
  cardId: string;
}
