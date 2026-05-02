import { plainToInstance } from 'class-transformer';
import { IsNumber, IsString, Max, Min, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  AUTH0_JWKS_URI!: string;

  @IsString()
  AUTH0_AUDIENCE!: string;

  @IsString()
  AUTH0_ISSUER!: string;

  @IsString()
  AUTH0_NAMESPACE!: string;

  @IsString()
  WEBHOOK_SECRET!: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(
    EnvironmentVariables,
    config,
    { enableImplicitConversion: true }, // Pitfall 5: "3000" string -> 3000 number
  );

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString()); // crashes process before any request (D-05)
  }

  return validatedConfig;
}
