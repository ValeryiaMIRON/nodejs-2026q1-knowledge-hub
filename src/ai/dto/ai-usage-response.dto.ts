import { ApiProperty } from '@nestjs/swagger';

class EndpointCounterDto {
  @ApiProperty()
  summarize: number;

  @ApiProperty()
  translate: number;

  @ApiProperty()
  analyze: number;

  @ApiProperty()
  generate: number;
}

class EndpointLatencyDto {
  @ApiProperty()
  avgMs: number;

  @ApiProperty()
  lastMs: number;
}

class LatencyByEndpointDto {
  @ApiProperty({ type: EndpointLatencyDto })
  summarize: EndpointLatencyDto;

  @ApiProperty({ type: EndpointLatencyDto })
  translate: EndpointLatencyDto;

  @ApiProperty({ type: EndpointLatencyDto })
  analyze: EndpointLatencyDto;

  @ApiProperty({ type: EndpointLatencyDto })
  generate: EndpointLatencyDto;
}

class CacheStatsDto {
  @ApiProperty()
  hits: number;

  @ApiProperty()
  misses: number;

  @ApiProperty()
  hitRatio: number;
}

class CacheByEndpointDto {
  @ApiProperty({ type: CacheStatsDto })
  summarize: CacheStatsDto;

  @ApiProperty({ type: CacheStatsDto })
  translate: CacheStatsDto;
}

class TokenUsageDto {
  @ApiProperty()
  promptTokenCount: number;

  @ApiProperty()
  candidatesTokenCount: number;

  @ApiProperty()
  totalTokenCount: number;
}

export class AiUsageResponseDto {
  @ApiProperty()
  totalRequests: number;

  @ApiProperty({ type: EndpointCounterDto })
  requestsByEndpoint: EndpointCounterDto;

  @ApiProperty({ type: LatencyByEndpointDto })
  latencyByEndpoint: LatencyByEndpointDto;

  @ApiProperty({ type: CacheByEndpointDto })
  cacheByEndpoint: CacheByEndpointDto;

  @ApiProperty({ type: TokenUsageDto })
  tokenUsage: TokenUsageDto;
}
