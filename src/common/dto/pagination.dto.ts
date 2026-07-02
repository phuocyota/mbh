import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min } from 'class-validator';

export class PaginationRequestDto {
  @ApiPropertyOptional({
    type: 'number',
    example: 1,
    description: 'Số trang hiện tại (mặc định là 1)',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'page phải là một số' })
  @Min(1, { message: 'page phải lớn hơn hoặc bằng 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    type: 'number',
    example: 10,
    description: 'Số mục trên mỗi trang (mặc định là 10)',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'size phải là một số' })
  @Min(1, { message: 'size phải lớn hơn hoặc bằng 1' })
  size?: number = 10;

  //search
  @ApiPropertyOptional({
    type: 'string',
    example: 'search',
    description: 'Từ khóa tìm kiếm',
  })
  @IsOptional()
  search?: string;
}

export class PaginationResponseDto<T> {
  @ApiPropertyOptional({
    type: 'number',
    example: 1,
    description: 'Số trang hiện tại',
  })
  page: number;

  @ApiPropertyOptional({
    type: 'number',
    example: 10,
    description: 'Số mục trên mỗi trang',
  })
  size: number;

  @ApiPropertyOptional({
    type: 'number',
    example: 100,
    description: 'Tổng số mục',
  })
  total: number;

  @ApiPropertyOptional({
    isArray: true,
    description: 'Dữ liệu của trang hiện tại',
  })
  data: T[];
}

export function normalizePagination(page?: number | string, size?: number | string) {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedSize = Math.max(Number(size) || 10, 1);

  return {
    page: normalizedPage,
    size: normalizedSize,
    skip: (normalizedPage - 1) * normalizedSize,
  };
}

export function toPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  size: number,
): PaginationResponseDto<T> {
  return {
    data,
    page,
    size,
    total,
  };
}
