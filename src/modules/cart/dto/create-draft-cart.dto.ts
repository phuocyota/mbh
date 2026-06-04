import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { DEFAULT_BRANCH_ID } from '../../../common/constant/default-branch.constant';

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
    example: DEFAULT_BRANCH_ID,
    default: DEFAULT_BRANCH_ID,
  })
  @Transform(({ value }) => value || undefined)
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
