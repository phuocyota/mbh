import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDraftCartDto {
  @ApiPropertyOptional({
    description:
      'Anonymous cart session ID. If omitted, the API generates one.',
    example: 'b9f7d090-9f19-4a35-9d91-3f59dc47d75b',
  })
  @Transform(({ value }) => value || undefined)
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Branch ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @Transform(({ value }) => value || undefined)
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
