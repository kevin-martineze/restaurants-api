import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'caja@laparrilla.test' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'demo-parrilla-2026' })
  @IsString()
  @Length(1, 200)
  password!: string;
}
