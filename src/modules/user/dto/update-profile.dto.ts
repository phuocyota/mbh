import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Full name' })
  fullName?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Address' })
  address?: string;

  @ApiPropertyOptional({ description: 'Province/City' })
  province?: string;

  @ApiPropertyOptional({ description: 'District' })
  district?: string;

  @ApiPropertyOptional({ description: 'Birthday (YYYY-MM-DD)' })
  birthday?: string;

  @ApiPropertyOptional({ description: 'Note' })
  note?: string;

  @ApiPropertyOptional({ description: 'Current password (required when changing password)' })
  currentPassword?: string;

  @ApiPropertyOptional({ description: 'New password' })
  newPassword?: string;
}
