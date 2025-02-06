import { Type } from 'class-transformer';

export class GetAttorneyDto {
  @Type(() => Number)
  id: number;
}
