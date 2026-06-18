# @mbh/accounting

Shared accounting domain library for MBH.

This package is intentionally independent from NestJS and TypeORM. It contains
accounting constants, source types, voucher types, and posting rule helpers.
Application services should keep database writes and transactions in the app,
then call this package to resolve accounting entries.

## Current Scope

- Money voucher type normalization.
- Money voucher code prefix generation.
- Receipt/payment fund balance calculation.
- Debit/credit account resolution for current voucher purposes.

## Extraction

This folder can be moved to a separate repository later. Keep app-specific
entities, repositories, migrations, and controllers outside this package.
