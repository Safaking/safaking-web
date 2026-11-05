/**
 * The address label that goes on a parcel.
 *
 * Staff were copying the address off the screen onto the box by hand, which is
 * how a digit goes missing from a pincode and a safa spends a week in the
 * wrong town. This prints what the customer actually typed.
 *
 * Sized 4x6in for a thermal label printer, but it prints perfectly well on
 * ordinary paper cut to size, which is what most people will do.
 *
 * Two things on here are not decoration:
 *
 *  - the **pincode**, set large and on its own line, because that is the one
 *    field a sorting hub reads and the one a handwritten label gets wrong;
 *  - **PREPAID vs COLLECT**, because getting it wrong means either the money
 *    is never collected or the customer pays twice.
 *
 * The markup is kept as a plain string rather than a React page so the API
 * route can hand it straight to a printer window, and so this file can be
 * rendered on its own when somebody wants to see a change before shipping it.
 */

export type LabelBusiness = {
  legal_name?: string | null;
  address?: string | null;
  phone?: string | null;
};

export type LabelOrder = {
  id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  shipping_address?: string | null;
  pincode?: string | null;
  payment_status?: string | null;
  balance_amount?: number | null;
  total_amount?: number | null;
  wedding_date?: string | null;
  created_at?: string | null;
};

export type LabelItem = { product_name?: string | null; quantity?: number | null };

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const day = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN');
};

/**
 * A six-digit pincode sitting at the end of the address, if the order does not
 * carry one in its own column. Written addresses nearly always end in one, and
 * a label without it is the one a hub sends back.
 */
export function pincodeOf(order: LabelOrder): string {
  if (order.pincode && /\d{6}/.test(order.pincode)) return order.pincode.match(/\d{6}/)![0];
  const found = String(order.shipping_address ?? '').match(/\b(\d{6})\b/g);
  return found ? found[found.length - 1] : '';
}

export function labelHtml(
  order: LabelOrder,
  items: LabelItem[],
  business: LabelBusiness
): string {
  const short = String(order.id).slice(0, 8).toUpperCase();
  const pin = pincodeOf(order);

  // Addresses arrive as one blob, typed with commas or newlines. Split so the
  // courier reads lines rather than a paragraph, and drop the pincode from the
  // tail because it gets its own line below, in a size you can read at arm's
  // length.
  const lines = String(order.shipping_address ?? '')
    .split(/\n|,\s*/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (pin ? l.replace(new RegExp(`\\b${pin}\\b`), '').trim() : l))
    .filter(Boolean);

  const contents = items
    .map((i) => {
      const q = Number(i.quantity ?? 1);
      return q > 1 ? `${i.product_name} x${q}` : String(i.product_name ?? '');
    })
    .filter(Boolean)
    .join(', ');

  const paid = order.payment_status === 'fully_paid';
  const due = Number(order.balance_amount ?? 0);
  // Anything still owed is collected on delivery. "Paid in full" is the only
  // state where the courier takes nothing, so that is the only state that
  // prints PREPAID.
  const money = paid || due <= 0
    ? { cls: 'prepaid', cap: 'PREPAID', note: 'Do not collect any money' }
    : { cls: 'cod', cap: `COLLECT ${rupees(due)}`, note: 'Cash on delivery' };

  const wedding = day(order.wedding_date);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Label ${esc(short)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 12px; background: #e5e7eb; font-family: system-ui, "Segoe UI", Arial, sans-serif; color: #000; }
  .toolbar { width: 4in; margin: 0 auto 10px; display: flex; justify-content: flex-end; gap: 8px; }
  .toolbar button { padding: 8px 18px; font-weight: bold; cursor: pointer; border: 1px solid #94a3b8; background: #fff; border-radius: 6px; }
  .label { width: 4in; height: 6in; margin: 0 auto; background: #fff; border: 2px solid #000;
           padding: 12px 14px; display: flex; flex-direction: column; overflow: hidden; }

  .from { font-size: 9.5px; line-height: 1.35; border-bottom: 1px solid #000; padding-bottom: 7px; }
  .from b { font-size: 11.5px; }

  /* The label is a fixed 4x6 and an address is whatever length somebody
     typed, so something has to give when one is unusually long. The address
     block is the only part allowed to shrink; the pincode, the phone and the
     money band below are pinned, because those are the three things that must
     never be the ones cut off. */
  .to { flex: 1; min-height: 0; padding-top: 10px; display: flex; flex-direction: column; }
  .cap { font-size: 9.5px; font-weight: bold; letter-spacing: 2px; }
  .name { font-size: 19px; font-weight: bold; margin-top: 3px; line-height: 1.15; }
  .addr { font-size: 14px; line-height: 1.4; margin-top: 5px; flex: 1 1 auto; min-height: 0; overflow: hidden; }
  .pin { font-size: 25px; font-weight: bold; letter-spacing: 3px; margin-top: 6px; line-height: 1; flex: none; }
  .phone { font-size: 15px; font-weight: bold; margin-top: 7px; flex: none; }
  .items { font-size: 9.5px; margin-top: 7px; color: #333; line-height: 1.35; flex: none; max-height: 40px; overflow: hidden; }
  .wed { font-size: 10px; font-weight: bold; margin-top: 5px; flex: none; }

  .money { margin-top: 9px; border: 2px solid #000; padding: 6px 8px; }
  .money .big { font-size: 17px; font-weight: 900; letter-spacing: 1px; }
  .money .note { font-size: 9px; letter-spacing: 1px; }
  .money.cod { background: #000; color: #fff; }

  .foot { border-top: 1px solid #000; padding-top: 7px; margin-top: 9px; font-size: 9.5px;
          display: flex; justify-content: space-between; align-items: flex-end; }
  .ord { font-family: "Courier New", monospace; font-size: 14px; font-weight: bold; }
  .brand { text-align: right; }
  .brand b { display: block; font-size: 11px; letter-spacing: 1px; }

  @media print {
    body { background: #fff; padding: 0; }
    .label { border: 0; margin: 0; }
    .toolbar { display: none; }
    .money.cod { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: 4in 6in; margin: 0; }
  }
</style></head><body>

<div class="toolbar"><button onclick="window.print()">Print label</button></div>

<div class="label">
  <div class="from">
    FROM<br>
    <b>${esc(business.legal_name)}</b><br>
    ${esc(business.address)}<br>
    ${esc(business.phone)}
  </div>

  <div class="to">
    <span class="cap">DELIVER TO</span>
    <div class="name">${esc(order.customer_name)}</div>
    <div class="addr">${lines.map((l) => esc(l)).join('<br>')}</div>
    ${pin ? `<div class="pin">${esc(pin)}</div>` : ''}
    <div class="phone">${esc(order.customer_phone)}</div>
    ${contents ? `<div class="items">Contents: ${esc(contents)}</div>` : ''}
    ${wedding ? `<div class="wed">Wedding ${esc(wedding)} — must arrive before</div>` : ''}
  </div>

  <div class="money ${money.cls}">
    <div class="big">${esc(money.cap)}</div>
    <div class="note">${esc(money.note)}</div>
  </div>

  <div class="foot">
    <div>ORDER<br><span class="ord">${esc(short)}</span></div>
    <div class="brand"><b>SAFAKING</b>${esc(day(order.created_at))}</div>
  </div>
</div>
</body></html>`;
}
