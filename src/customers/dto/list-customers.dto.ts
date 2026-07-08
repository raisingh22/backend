import { IsOptional, IsString } from 'class-validator';
import { BaseListQueryDto } from '../../common/dto/base-list-query.dto';

export class ListCustomersDto extends BaseListQueryDto {
  /** Filter by a specific tag value */
  @IsOptional()
  @IsString()
  tag?: string;

  /** Filter by membership tier (Bronze, Silver, Gold) */
  @IsOptional()
  @IsString()
  membershipTier?: string;
}
