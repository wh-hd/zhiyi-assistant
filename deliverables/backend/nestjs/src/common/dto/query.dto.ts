import { Type } from 'class-transformer';
import {
  IsDateString, IsInt, IsOptional, Max, Min, registerDecorator,
  ValidationArguments, ValidationOptions,
} from 'class-validator';

export class PaginationQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page: number = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize: number = 20;
}

export class LimitQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(500) limit: number = 100;
}

export class DaysQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(365) days: number = 30;
}

function IsRangeEndAfterStart(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isRangeEndAfterStart',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const range = args.object as DateRangeQueryDto;
          if (!range.from || !value || typeof value !== 'string') return true;
          return new Date(range.from).getTime() <= new Date(value).getTime();
        },
      },
    });
  };
}

export class DateRangeQueryDto {
  @IsOptional() @IsDateString() from?: string;

  @IsOptional()
  @IsDateString()
  @IsRangeEndAfterStart({ message: 'to 必须晚于或等于 from' })
  to?: string;
}
