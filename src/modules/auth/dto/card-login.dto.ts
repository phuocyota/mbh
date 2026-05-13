import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CardLoginDto {
  @ApiProperty({
    description: 'Card ID for login',
    example: 'abc123-def456',
  })
  @IsNotEmpty()
  @IsString()
  cardId: string;
}
