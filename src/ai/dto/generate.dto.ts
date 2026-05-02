import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GenerateDto {
  @ApiProperty({
    description: 'Prompt text for Gemini to process',
    example: 'Explain what NestJS is in one short paragraph.',
  })
  @IsString()
  @MinLength(1)
  prompt: string;
}
