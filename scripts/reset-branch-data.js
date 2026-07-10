require('dotenv').config();

const { Client } = require('pg');

const branchId = process.argv[2] || process.env.BRANCH_ID;

if (!branchId) {
  console.error('Usage: node scripts/reset-branch-data.js <branchId>');
  process.exit(1);
}

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'pos_system',
});

const countQueries = [
  ['branches', 'select count(*)::int c from branches where id=$1'],
  ['orders', 'select count(*)::int c from orders where branch_id=$1'],
  [
    'order_items',
    `select count(*)::int c
     from order_items oi
     join orders o on o.id = oi.order_id
     where o.branch_id = $1`,
  ],
  [
    'payments',
    `select count(*)::int c
     from payments p
     join orders o on o.id = p.order_id
     where o.branch_id = $1`,
  ],
  [
    'refunds',
    `select count(*)::int c
     from refunds r
     join orders o on o.id = r.order_id
     where o.branch_id = $1`,
  ],
  [
    'stock_receipt_import',
    'select count(*)::int c from stock_receipt_import where branch_id=$1',
  ],
  [
    'stock_receipt_export',
    'select count(*)::int c from stock_receipt_export where branch_id=$1',
  ],
  [
    'stock_receipt_transfer',
    `select count(*)::int c
     from stock_receipt_transfer
     where from_branch_id = $1 or to_branch_id = $1`,
  ],
  [
    'stock_receipt_detail',
    `select count(*)::int c
     from stock_receipt_detail d
     left join stock_receipt_import i on i.id = d.import_id
     left join stock_receipt_export e on e.id = d.export_id
     left join stock_receipt_transfer t on t.id = d.transfer_id
     where i.branch_id = $1
        or e.branch_id = $1
        or t.from_branch_id = $1
        or t.to_branch_id = $1`,
  ],
  ['stocks', 'select count(*)::int c from stocks where branch_id=$1'],
  [
    'stock_items_nonzero',
    `select count(*)::int c
     from stock_items si
     join stocks s on s.id = si.stock_id
     where s.branch_id = $1 and si.quantity <> 0`,
  ],
  ['stock_takes', 'select count(*)::int c from stock_takes where branch_id=$1'],
  ['funds', 'select count(*)::int c from funds where branch_id=$1'],
  [
    'funds_nonzero',
    `select count(*)::int c
     from funds
     where branch_id = $1 and (balance <> 0 or debit <> 0 or credit <> 0)`,
  ],
  [
    'money_vouchers',
    `select count(*)::int c
     from money_vouchers mv
     join funds f on f.id = mv.fund_id
     where f.branch_id = $1`,
  ],
  [
    'fund_transactions',
    `select count(*)::int c
     from fund_transactions ft
     join funds f on f.id = ft.fund_id
     where f.branch_id = $1`,
  ],
  [
    'fund_receipt_received',
    'select count(*)::int c from fund_receipt_received where branch_id=$1',
  ],
  [
    'fund_receipt_paid',
    'select count(*)::int c from fund_receipt_paid where branch_id=$1',
  ],
  [
    'fund_receipt_transfer',
    `select count(*)::int c
     from fund_receipt_transfer frt
     join funds ff on ff.id = frt.from_fund_id
     join funds tf on tf.id = frt.to_fund_id
     where ff.branch_id = $1 or tf.branch_id = $1`,
  ],
  [
    'fund_detail',
    `select count(*)::int c
     from fund_detail fd
     left join funds f on f.id = fd.fund_id
     left join fund_receipt_received rr on rr.id = fd.received_id
     left join fund_receipt_paid rp on rp.id = fd.paid_id
     left join fund_receipt_transfer rt on rt.id = fd.transfer_id
     left join funds rtf on rtf.id = rt.from_fund_id
     left join funds rtt on rtt.id = rt.to_fund_id
     where f.branch_id = $1
        or rr.branch_id = $1
        or rp.branch_id = $1
        or rtf.branch_id = $1
        or rtt.branch_id = $1`,
  ],
  ['suppliers', 'select count(*)::int c from suppliers where branch_id=$1'],
  [
    'suppliers_nonzero_debt',
    `select count(*)::int c
     from suppliers
     where branch_id = $1 and (debt <> 0 or total_purchase <> 0)`,
  ],
  [
    'debts',
    `select count(*)::int c
     from debts d
     join suppliers s on s.id = d.supplier_id
     where s.branch_id = $1`,
  ],
  [
    'cash_movements',
    `select count(*)::int c
     from cash_movements cm
     join shifts sh on sh.id = cm.shift_id
     where sh.branch_id = $1`,
  ],
  ['carts', 'select count(*)::int c from carts where branch_id=$1'],
];

async function counts() {
  const result = {};
  for (const [name, sql] of countQueries) {
    result[name] = (await client.query(sql, [branchId])).rows[0].c;
  }
  return result;
}

async function run(label, sql) {
  const result = await client.query(sql, [branchId]);
  return [label, result.rowCount];
}

async function main() {
  await client.connect();

  const before = await counts();
  if (before.branches !== 1) {
    throw new Error(`Branch ${branchId} not found`);
  }

  const ops = [];
  await client.query('begin');
  try {
    ops.push(
      await run(
        'refund_items',
        `delete from refund_items ri
         using refunds r, orders o
         where ri.refund_id = r.id
           and r.order_id = o.id
           and o.branch_id = $1`,
      ),
    );
    ops.push(
      await run(
        'refunds',
        `delete from refunds r
         using orders o
         where r.order_id = o.id and o.branch_id = $1`,
      ),
    );
    ops.push(
      await run(
        'payments',
        `delete from payments p
         using orders o
         where p.order_id = o.id and o.branch_id = $1`,
      ),
    );
    ops.push(
      await run(
        'order_status_logs',
        `delete from order_status_logs osl
         using orders o
         where osl.order_id = o.id and o.branch_id = $1`,
      ),
    );

    ops.push(
      await run(
        'fund_detail',
        `delete from fund_detail fd
         where fd.id in (
           select fd2.id
           from fund_detail fd2
           left join funds f on f.id = fd2.fund_id
           left join fund_receipt_received rr on rr.id = fd2.received_id
           left join fund_receipt_paid rp on rp.id = fd2.paid_id
           left join fund_receipt_transfer rt on rt.id = fd2.transfer_id
           left join funds rtf on rtf.id = rt.from_fund_id
           left join funds rtt on rtt.id = rt.to_fund_id
           where f.branch_id = $1
              or rr.branch_id = $1
              or rp.branch_id = $1
              or rtf.branch_id = $1
              or rtt.branch_id = $1
         )`,
      ),
    );
    ops.push(
      await run(
        'fund_receipt_paid',
        'delete from fund_receipt_paid where branch_id=$1',
      ),
    );
    ops.push(
      await run(
        'fund_receipt_received',
        'delete from fund_receipt_received where branch_id=$1',
      ),
    );
    ops.push(
      await run(
        'fund_receipt_transfer',
        `delete from fund_receipt_transfer frt
         using funds ff, funds tf
         where frt.from_fund_id = ff.id
           and frt.to_fund_id = tf.id
           and (ff.branch_id = $1 or tf.branch_id = $1)`,
      ),
    );
    ops.push(
      await run(
        'fund_transactions',
        `delete from fund_transactions ft
         using funds f
         where ft.fund_id = f.id and f.branch_id = $1`,
      ),
    );
    ops.push(
      await run(
        'money_vouchers',
        `delete from money_vouchers mv
         using funds f
         where mv.fund_id = f.id and f.branch_id = $1`,
      ),
    );

    ops.push(
      await run(
        'debts',
        `delete from debts d
         using suppliers s
         where d.supplier_id = s.id and s.branch_id = $1`,
      ),
    );

    ops.push(
      await run(
        'stock_receipt_detail',
        `delete from stock_receipt_detail d
         where d.id in (
           select d2.id
           from stock_receipt_detail d2
           left join stock_receipt_import i on i.id = d2.import_id
           left join stock_receipt_export e on e.id = d2.export_id
           left join stock_receipt_transfer t on t.id = d2.transfer_id
           where i.branch_id = $1
              or e.branch_id = $1
              or t.from_branch_id = $1
              or t.to_branch_id = $1
         )`,
      ),
    );
    ops.push(
      await run(
        'stock_receipt_import',
        'delete from stock_receipt_import where branch_id=$1',
      ),
    );
    ops.push(
      await run(
        'stock_receipt_export',
        'delete from stock_receipt_export where branch_id=$1',
      ),
    );
    ops.push(
      await run(
        'stock_receipt_transfer',
        `delete from stock_receipt_transfer
         where from_branch_id = $1 or to_branch_id = $1`,
      ),
    );
    ops.push(
      await run(
        'stock_take_items',
        `delete from stock_take_items sti
         using stock_takes st
         where sti.stock_take_id = st.id and st.branch_id = $1`,
      ),
    );
    ops.push(
      await run('stock_takes', 'delete from stock_takes where branch_id=$1'),
    );

    ops.push(
      await run(
        'wallet_transactions_order_refs',
        `delete from wallet_transactions wt
         using orders o
         where wt.ref_id = o.id and wt.ref_type = 'ORDER' and o.branch_id = $1`,
      ),
    );
    ops.push(
      await run(
        'cash_movements',
        `delete from cash_movements cm
         using shifts sh
         where cm.shift_id = sh.id and sh.branch_id = $1`,
      ),
    );
    ops.push(
      await run(
        'cart_items',
        `delete from cart_items ci
         using carts c
         where ci.cart_id = c.id and c.branch_id = $1`,
      ),
    );
    ops.push(await run('carts', 'delete from carts where branch_id=$1'));

    ops.push(await run('orders', 'delete from orders where branch_id=$1'));

    ops.push(
      await run(
        'stock_items_zeroed',
        `update stock_items si
         set quantity = 0, updated_at = now()
         from stocks s
         where si.stock_id = s.id and s.branch_id = $1 and si.quantity <> 0`,
      ),
    );
    ops.push(
      await run(
        'funds_zeroed',
        `update funds
         set balance = 0, debit = 0, credit = 0, updated_at = now()
         where branch_id = $1 and (balance <> 0 or debit <> 0 or credit <> 0)`,
      ),
    );
    ops.push(
      await run(
        'suppliers_debt_zeroed',
        `update suppliers
         set debt = 0, total_purchase = 0, updated_at = now()
         where branch_id = $1 and (debt <> 0 or total_purchase <> 0)`,
      ),
    );

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }

  const after = await counts();
  console.log(`Reset branch ${branchId}`);
  console.log('BEFORE');
  console.table(before);
  console.log('OPS');
  console.table(Object.fromEntries(ops));
  console.log('AFTER');
  console.table(after);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {}
  });
