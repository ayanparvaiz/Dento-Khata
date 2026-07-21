import { IsString, IsOptional, MinLength } from 'class-validator';

// Tenant submits a manual bKash payment for verification.
export class SubmitPaymentDto {
  @IsString()
  @MinLength(4)
  trxId: string; // bKash transaction id

  @IsOptional()
  @IsString()
  senderMsisdn?: string; // phone the money was sent from

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  plan?: string; // selected package key: '1m' | '6m' | '12m'
}
