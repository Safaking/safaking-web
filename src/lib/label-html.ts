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
 * The delivery address is first and largest. That is the way round a courier
 * reads a parcel, and on the first printed labels the return address was on
 * top, which puts the wrong town under their thumb.
 *
 * Three things on here are not decoration:
 *
 *  - the **pincode**, set large and on its own line, because that is the one
 *    field a sorting hub reads and the one a handwritten label gets wrong;
 *  - **PREPAID vs COLLECT**, because getting it wrong means either the money
 *    is never collected or the customer pays twice;
 *  - the **return address**, which has to be the place the parcel actually
 *    left. See `labelsFor` below.
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

/** Whoever the parcel is actually posted by. */
export type LabelSender = {
  /** Always SafaKing's. A customer ordered from SafaKing, whoever packs it. */
  name: string;
  /** The place it is posted from, so a failed delivery comes back there. */
  address: string;
  /** SafaKing's own number: a courier with a question rings the shop. */
  phone: string;
};

/** One parcel: who sends it, and what is in it. */
export type LabelParcel = {
  sender: LabelSender;
  items: LabelItem[];
  /** "Parcel 2 of 3" when an order is split across suppliers. */
  partOf?: { index: number; total: number } | null;
};

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

/**
 * The address as lines a courier can read down.
 *
 * Checkout stores the address with the pincode appended in brackets —
 * `"<what they typed> (Pincode: 327024)"` — and the pincode gets its own big
 * line below, so the bracket is removed whole. Taking out only the digits is
 * what printed `R (Pincode: )` on the first real label.
 */
export function addressLines(order: LabelOrder, pin: string): string[] {
  return String(order.shipping_address ?? '')
    .replace(/\(\s*pin\s*code\s*:?[^)]*\)/gi, ' ')
    .split(/\n|,\s*/)
    .map((l) => l.trim())
    .map((l) => (pin ? l.replace(new RegExp(`\\b${pin}\\b`), '').trim() : l))
    // A line that was nothing but the pincode, or nothing but punctuation
    // left behind by removing it.
    .filter((l) => l && /[A-Za-z0-9ऀ-ॿ]/.test(l));
}

function labelPage(order: LabelOrder, parcel: LabelParcel): string {
  const short = String(order.id).slice(0, 8).toUpperCase();
  const pin = pincodeOf(order);
  const lines = addressLines(order, pin);

  const contents = parcel.items
    .map((i) => {
      const q = Number(i.quantity ?? 1);
      return q > 1 ? `${i.product_name} x${q}` : String(i.product_name ?? '');
    })
    .filter(Boolean)
    .join(', ');

  const paid = order.payment_status === 'fully_paid';
  const due = Number(order.balance_amount ?? 0);
  const part = parcel.partOf;
  // An order owes its balance once, not once per box. A split order printing
  // COLLECT on both labels is a courier taking the money twice, so the
  // balance rides on the first parcel and the rest say so in as many words.
  const carriesMoney = !part || part.index === 1;
  const money =
    paid || due <= 0
      ? { cls: 'prepaid', cap: 'PREPAID', note: 'Do not collect any money' }
      : carriesMoney
        ? { cls: 'cod', cap: `COLLECT ${rupees(due)}`, note: part ? `Cash on delivery — this parcel only, not parcel 2${part.total > 2 ? `-${part.total}` : ''}` : 'Cash on delivery' }
        : { cls: 'prepaid', cap: 'COLLECT NOTHING', note: `The ${rupees(due)} is collected on parcel 1 of ${part!.total}` };

  const wedding = day(order.wedding_date);

  return `<div class="label">
  <div class="to">
    <div class="caprow">
      <span class="cap">DELIVER TO</span>
      ${part ? `<span class="part">Parcel ${part.index} of ${part.total}</span>` : ''}
    </div>
    <div class="name">${esc(order.customer_name)}</div>
    <div class="addr">${lines.map((l) => esc(l)).join('<br>')}</div>
    ${pin ? `<div class="pin">${esc(pin)}</div>` : ''}
    <div class="phone">${esc(order.customer_phone)}</div>
    ${contents ? `<div class="items">Contents: ${esc(contents)}</div>` : ''}
    ${wedding ? `<div class="wed">Wedding ${esc(wedding)} — must arrive before</div>` : ''}
    <div class="slack"></div>
  </div>

  <div class="money ${money.cls}">
    <div class="big">${esc(money.cap)}</div>
    <div class="note">${esc(money.note)}</div>
  </div>

  <div class="from">
    <span class="cap small">RETURN TO</span>
    <b>${esc(parcel.sender.name)}</b>
    ${esc(parcel.sender.address)}<br>
    ${esc(parcel.sender.phone)}
  </div>

  <div class="foot">
    <div>ORDER<br><span class="ord">${esc(short)}</span></div>
    <div class="brand"><b>SAFAKING</b>${esc(day(order.created_at))}</div>
  </div>
</div>`;
}

export function labelHtml(order: LabelOrder, parcels: LabelParcel[]): string {
  const short = String(order.id).slice(0, 8).toUpperCase();

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Label ${esc(short)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 12px; background: #e5e7eb; font-family: system-ui, "Segoe UI", Arial, sans-serif; color: #000; }
  .toolbar { width: 4in; margin: 0 auto 10px; display: flex; justify-content: flex-end; gap: 8px; }
  .toolbar button { padding: 8px 18px; font-weight: bold; cursor: pointer; border: 1px solid #94a3b8; background: #fff; border-radius: 6px; }
  .label { width: 4in; height: 6in; margin: 0 auto 14px; background: #fff; border: 2px solid #000;
           padding: 12px 14px; display: flex; flex-direction: column; overflow: hidden; }

  /* The address a courier delivers to, first and largest: it is the way
     round they read a parcel. The return address sits below, small. */
  .to { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .caprow { display: flex; justify-content: space-between; align-items: baseline; }
  .cap { font-size: 9.5px; font-weight: bold; letter-spacing: 2px; }
  .cap.small { letter-spacing: 1.5px; }
  .part { font-size: 9.5px; font-weight: bold; }
  .name { font-size: 20px; font-weight: bold; margin-top: 3px; line-height: 1.15; }
  .addr { font-size: 14.5px; line-height: 1.4; margin-top: 5px; flex: 0 1 auto; min-height: 0; overflow: hidden; }
  /* Takes up whatever is left over, so a short address does not leave a
     hole between itself and its own pincode. */
  .slack { flex: 1 1 auto; min-height: 0; }
  .pin { font-size: 26px; font-weight: bold; letter-spacing: 3px; margin-top: 6px; line-height: 1; flex: none; }
  .phone { font-size: 15px; font-weight: bold; margin-top: 7px; flex: none; }
  .items { font-size: 9.5px; margin-top: 7px; color: #333; line-height: 1.35; flex: none; max-height: 40px; overflow: hidden; }
  .wed { font-size: 10px; font-weight: bold; margin-top: 5px; flex: none; }

  .money { margin-top: 9px; border: 2px solid #000; padding: 6px 8px; flex: none; }
  .money .big { font-size: 17px; font-weight: 900; letter-spacing: 1px; }
  .money .note { font-size: 9px; letter-spacing: 1px; }
  .money.cod { background: #000; color: #fff; }

  .from { margin-top: 9px; border-top: 1px solid #000; padding-top: 7px; font-size: 9.5px; line-height: 1.35; flex: none; }
  .from b { display: block; font-size: 11.5px; }

  .foot { border-top: 1px solid #000; padding-top: 7px; margin-top: 7px; font-size: 9.5px; flex: none;
          display: flex; justify-content: space-between; align-items: flex-end; }
  .ord { font-family: "Courier New", monospace; font-size: 14px; font-weight: bold; }
  .brand { text-align: right; }
  .brand b { display: block; font-size: 11px; letter-spacing: 1px; }

  @media print {
    body { background: #fff; padding: 0; }
    .label { border: 0; margin: 0; break-after: page; page-break-after: always; }
    .label:last-of-type { break-after: auto; page-break-after: auto; }
    .toolbar { display: none; }
    .money.cod { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: 4in 6in; margin: 0; }
  }
</style></head><body>

<div class="toolbar"><button onclick="window.print()">Print label</button></div>

${parcels.map((p) => labelPage(order, p)).join('\n')}
</body></html>`;
}
