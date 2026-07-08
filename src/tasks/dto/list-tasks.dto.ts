import { IsOptional, IsString } from 'class-validator';
import { BaseListQueryDto } from '../../common/dto/base-list-query.dto';

export class ListTasksDto extends BaseListQueryDto {
  /** Filter by task status: TODO, IN_PROGRESS, DONE */
  @IsOptional()
  @IsString()
  status?: string;
}
