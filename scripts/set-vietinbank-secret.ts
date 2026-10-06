import { AppDataSource } from '../src/data-source';
import { VietinBankSecret } from '../src/entities/vietinbank-secret.entity';
import {
  encryptVietinBankSecret,
  parseVietinBankMasterKey,
} from '../src/modules/vietinbank/vietinbank-secret.crypto';

function readRef(): string {
  const index = process.argv.indexOf('--ref');
  const ref = index >= 0 ? process.argv[index + 1]?.trim() : '';
  if (!ref)
    throw new Error('Usage: npm run vietinbank-secret:set -- --ref <ref>');
  return ref;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const value = Buffer.concat(chunks)
    .toString('utf8')
    .replace(/[\r\n]+$/, '');
  if (!value)
    throw new Error('Secret plaintext must be provided through stdin');
  return value;
}

async function main() {
  const ref = readRef();
  const plaintext = await readStdin();
  const encrypted = encryptVietinBankSecret(
    plaintext,
    parseVietinBankMasterKey(process.env.VIETINBANK_SECRET_MASTER_KEY),
  );
  await AppDataSource.initialize();
  try {
    const repository = AppDataSource.getRepository(VietinBankSecret);
    const existing = await repository.findOne({ where: { ref } });
    await repository.save(
      repository.create({
        ...(existing || {}),
        ref,
        ...encrypted,
        updatedBy: 'vietinbank-secret-cli',
        createdBy: existing?.createdBy || 'vietinbank-secret-cli',
      }),
    );
    process.stdout.write(`VietinBank secret stored for ref: ${ref}\n`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`Failed to store VietinBank secret: ${message}\n`);
  process.exitCode = 1;
});
