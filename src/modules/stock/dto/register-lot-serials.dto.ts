import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID, MaxLength } from 'class-validator';

export class RegisterLotSerialsDto {
  @IsUUID() detailId: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10000)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  serials: string[];
}
