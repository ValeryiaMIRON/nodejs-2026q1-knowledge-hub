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

class P95LatencyByEndpointDto {
  @ApiProperty({ description: 'p95 latency in ms' })
  summarize: number;

  @ApiProperty({ description: 'p95 latency in ms' })
  translate: number;

  @ApiProperty({ description: 'p95 latency in ms' })
  analyze: number;

  @ApiProperty({ description: 'p95 latency in ms' })
  generate: number;
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

class RecentRequestEntryDto {
  @ApiProperty()
  timestamp: number;

  @ApiProperty()
  endpoint: string;

  @ApiProperty()
  durationMs: number;

  @ApiProperty()
  success: boolean;
}

export class AiUsageResponseDto {
  @ApiProperty()
  totalRequests: number;

  @ApiProperty({ type: EndpointCounterDto })
  requestsByEndpoint: EndpointCounterDto;

  @ApiProperty({
    type: EndpointCounterDto,
    description: 'Error count per endpoint',
  })
  errorsByEndpoint: EndpointCounterDto;

  @ApiProperty({ type: LatencyByEndpointDto })
  latencyByEndpoint: LatencyByEndpointDto;

  @ApiProperty({
    type: P95LatencyByEndpointDto,
    description: 'p95 latency per endpoint (ms)',
  })
  p95LatencyByEndpoint: P95LatencyByEndpointDto;

  @ApiProperty({ type: CacheByEndpointDto })
  cacheByEndpoint: CacheByEndpointDto;

  @ApiProperty({ type: TokenUsageDto })
  tokenUsage: TokenUsageDto;

  @ApiProperty({
    type: [RecentRequestEntryDto],
    description: 'Last 20 requests',
  })
  recentRequests: RecentRequestEntryDto[];

  @ApiProperty({ description: 'Service uptime in milliseconds' })
  uptimeMs: number;
}
