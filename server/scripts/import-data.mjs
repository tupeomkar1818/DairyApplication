#!/usr/bin/env node
/**
 * Puts the dairy's own data into the server: products with their packs and prices, the delivery team, and the
 * customers with what each of them takes every day.
 *
 * It reads one file — `data/dairy.json`, copied from `data/dairy.example.json` — so the dairy's real prices live
 * somewhere that can be read, corrected and run again, rather than being typed into thirty screens once.
 *
 * Running it twice is safe: products are matched by name and people by their mobile number, so a second run
 * updates what is there instead of making a second copy of it. That is the point — correct a price in the file,
 * run it again.
 *
 *   npm run import              # the local dev server
 *   npm run import -- --live    # the real one
 *   npm run import -- --dry-run # say what would happen, write nothing
 *
 * Signing in uses the dairy's own login. The first time that is the admin's mobile number as the PIN; after a PIN
 * has been chosen, pass it: `npm run import -- --live --pin 1234`.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/** The two the apps understand. Anything else and the salary screens work out to nothing. */
const SALARY_TYPES = ['Fixed Monthly Salary', 'Attendance Based Salary'];

const LIVE = 'https://amrale-dairy-api.amrale-dairy-website.workers.dev';
const LOCAL = 'http://127.0.0.1:8787';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const api = valueOf('--api', has('--live') ? LIVE : LOCAL);
const dry = has('--dry-run');
const file = resolve(ROOT, valueOf('--file', 'data/dairy.json'));
const adminMobile = valueOf('--admin', process.env.ADMIN_MOBILE ?? '8208682688');
const adminSecret = valueOf('--pin', process.env.ADMIN_PIN ?? adminMobile);

const say = (...parts) => console.log(...parts);
const ymd = (value) => String(value ?? '').slice(0, 10);
const today = new Date().toISOString().slice(0, 10);

function die(message) {
  console.error('\n' + message + '\n');
  process.exit(1);
}

// --- talking to the server ---------------------------------------------------------------------------------------

let token = '';

async function call(method, path, body) {
  const res = await fetch(api + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    die(`${method} ${path} answered something that is not JSON:\n${text.slice(0, 400)}`);
  }
  if (!res.ok) {
    const code = parsed?.error?.code ?? res.status;
    die(`${method} ${path} was refused (${code}): ${parsed?.error?.message ?? text.slice(0, 200)}`);
  }
  return parsed;
}

async function signIn() {
  const res = await fetch(api + '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mobileNumber: adminMobile, secret: adminSecret }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const code = body?.error?.code ?? res.status;
    if (code === 'PIN_INVALID' || code === 'PASSWORD_INVALID') {
      die(
        `The dairy's login was refused.\n` +
          `  If a PIN has been chosen already, pass it:  npm run import -- --live --pin 1234\n` +
          `  If it has not, the password is the number itself (${adminMobile}).`,
      );
    }
    die(`Could not sign in (${code}): ${body?.error?.message ?? ''}`);
  }
  token = body.session.sessionId;
  if (body.mustSetPin) {
    die(
      `The dairy's login has no PIN yet, so the server lets it do nothing else.\n` +
        `Open the app, sign in with ${adminMobile} as both the number and the PIN, choose a PIN,\n` +
        `then run this again with:  npm run import -- --live --pin <that PIN>`,
    );
  }
}

// --- the file ----------------------------------------------------------------------------------------------------

function load() {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    die(
      `No data file at ${file}.\n` +
        `Copy the template and fill it in:\n` +
        `  cp data/dairy.example.json data/dairy.json`,
    );
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    die(`${file} is not valid JSON — ${e.message}`);
  }
  return data;
}

/** Everything the dairy would have to fix before any of it is worth writing. */
function complaints(data) {
  const out = [];
  const products = data.products ?? [];
  const customers = data.customers ?? [];

  products.forEach((p, i) => {
    const where = `products[${i}]${p.name ? ` (${p.name})` : ''}`;
    if (!String(p.name ?? '').trim()) out.push(`${where}: needs a name`);
    const packs = p.packs ?? [];
    if (!packs.length) out.push(`${where}: needs at least one pack — the pack's price is what bills are built from`);
    packs.forEach((pack, j) => {
      if (!String(pack.label ?? '').trim()) out.push(`${where} pack[${j}]: needs a label, e.g. "500 ml"`);
      if (!(Number(pack.price) > 0)) out.push(`${where} pack "${pack.label ?? j}": price is still ${pack.price ?? 'missing'}`);
    });
  });

  (data.deliveryBoys ?? []).forEach((b, i) => {
    const where = `deliveryBoys[${i}]${b.fullName ? ` (${b.fullName})` : ''}`;
    if (!String(b.fullName ?? '').trim()) out.push(`${where}: needs a name`);
    if (!/^\d{10}$/.test(String(b.mobileNumber ?? '').trim())) out.push(`${where}: needs a 10-digit mobile number`);
    if (b.salaryType !== undefined && !SALARY_TYPES.includes(b.salaryType)) {
      out.push(`${where}: salaryType is "${b.salaryType}" — it has to be one of ${SALARY_TYPES.map((t) => `"${t}"`).join(' or ')}`);
    }
    if (b.salaryType === 'Attendance Based Salary' ? !(Number(b.perDaySalary) > 0) : !(Number(b.monthlySalary) > 0)) {
      const field = b.salaryType === 'Attendance Based Salary' ? 'perDaySalary' : 'monthlySalary';
      out.push(`${where}: ${field} is still ${b[field] ?? 'missing'} — they would be paid nothing`);
    }
  });

  const seen = new Map();
  customers.forEach((c, i) => {
    const where = `customers[${i}]${c.name ? ` (${c.name})` : ''}`;
    if (!String(c.name ?? '').trim()) out.push(`${where}: needs a name`);
    const mobile = String(c.mobile ?? '').trim();
    if (!/^\d{10}$/.test(mobile)) {
      out.push(`${where}: needs a 10-digit mobile number — it is how they sign in`);
    } else if (seen.has(mobile)) {
      out.push(`${where}: has the same mobile number as ${seen.get(mobile)}`);
    } else {
      seen.set(mobile, where);
    }
    (c.plans ?? []).forEach((plan, j) => {
      const product = products.find((p) => String(p.name).trim() === String(plan.productName ?? '').trim());
      if (!product) {
        out.push(`${where} plan[${j}]: no product called "${plan.productName ?? ''}" in this file`);
        return;
      }
      const pack = (product.packs ?? []).find((p) => String(p.label).trim() === String(plan.quantityLabel ?? '').trim());
      if (!pack) {
        const labels = (product.packs ?? []).map((p) => `"${p.label}"`).join(', ');
        out.push(`${where} plan[${j}]: ${product.name} has no pack "${plan.quantityLabel ?? ''}" — it has ${labels}`);
      }
    });
  });

  return out;
}

// --- writing -------------------------------------------------------------------------------------------------------

async function importProducts(products) {
  const existing = (await call('GET', '/products')).items ?? [];
  const byName = new Map(existing.map((p) => [String(p.name).trim().toLowerCase(), p]));
  const saved = new Map();

  for (const product of products) {
    const key = String(product.name).trim().toLowerCase();
    const was = byName.get(key);
    const packs = (product.packs ?? []).map((pack, i) => ({
      label: String(pack.label).trim(),
      unit: pack.unit ?? product.unit ?? '',
      quantity: Number(pack.quantity ?? 0),
      price: Number(pack.price),
      isActive: true,
      sortOrder: i,
    }));
    // The product's own price is the cheapest pack's, so a list that shows one number shows a true one.
    const body = {
      name: String(product.name).trim(),
      category: product.category ?? '',
      unit: product.unit ?? '',
      description: product.description ?? '',
      availability: product.availability ?? 'In Stock',
      isActive: product.isActive ?? true,
      isVisibleToCustomer: product.isVisibleToCustomer ?? true,
      price: Math.min(...packs.map((p) => p.price)),
      packs,
    };

    if (dry) {
      say(`  ${was ? 'update' : 'add   '} ${body.name} — ${packs.map((p) => `${p.label} ₹${p.price}`).join(', ')}`);
      saved.set(key, { ...body, id: was?.id ?? 'dry' });
      continue;
    }
    const result = was ? await call('PATCH', `/products/${was.id}`, body) : await call('POST', '/products', body);
    say(`  ${was ? 'updated' : 'added  '} ${result.name} — ${packs.map((p) => `${p.label} ₹${p.price}`).join(', ')}`);
    saved.set(key, result);
  }
  return saved;
}

async function importDeliveryBoys(boys) {
  const existing = (await call('GET', '/delivery-boys')).items ?? [];
  const byMobile = new Map(existing.map((b) => [String(b.mobileNumber), b]));

  for (const boy of boys) {
    const mobile = String(boy.mobileNumber).trim();
    const was = byMobile.get(mobile);
    const body = {
      fullName: String(boy.fullName).trim(),
      mobileNumber: mobile,
      primaryRouteName: boy.primaryRouteName ?? '',
      status: boy.status ?? 'Active',
      appAccessEnabled: boy.appAccessEnabled ?? true,
      salaryType: boy.salaryType ?? 'Fixed Monthly Salary',
      monthlySalary: Number(boy.monthlySalary ?? 0),
      perDaySalary: Number(boy.perDaySalary ?? 0),
      joiningDate: ymd(boy.joiningDate) || today,
    };
    if (dry) {
      say(`  ${was ? 'update' : 'add   '} ${body.fullName} (${mobile}) — ${body.primaryRouteName || 'no route'}`);
      continue;
    }
    const result = was ? await call('PATCH', `/delivery-boys/${was.id}`, body) : await call('POST', '/delivery-boys', body);
    say(`  ${was ? 'updated' : 'added  '} ${result.fullName} (${mobile})`);
  }
}

async function importCustomers(customers, products) {
  const existing = (await call('GET', '/customers')).items ?? [];
  const byMobile = new Map(existing.map((c) => [String(c.mobile), c]));
  const boys = (await call('GET', '/delivery-boys')).items ?? [];

  for (const customer of customers) {
    const mobile = String(customer.mobile).trim();
    const was = byMobile.get(mobile);
    const start = ymd(customer.subscriptionStartDate) || today;

    // A plan's price is never written by hand: it is read off the pack it is for, so the two cannot drift apart.
    const plans = (customer.plans ?? []).map((plan) => {
      const product = products.get(String(plan.productName).trim().toLowerCase());
      const pack = (product.packs ?? []).find((p) => String(p.label).trim() === String(plan.quantityLabel).trim());
      const price = Number(pack.price);
      return {
        ...(plan.id ? { id: plan.id } : {}),
        productId: product.id,
        packId: pack.id,
        productName: product.name,
        quantityLabel: pack.label,
        unitType: pack.unit ?? '',
        numberOfItems: Number(plan.numberOfItems ?? 1),
        frequency: plan.frequency ?? 'Daily',
        deliveryTime: plan.deliveryTime ?? customer.deliveryTime ?? 'Morning',
        startDate: ymd(plan.startDate) || start,
        openEnded: plan.endDate ? false : true,
        ...(plan.endDate ? { endDate: ymd(plan.endDate) } : {}),
        status: plan.status ?? 'Active',
        originalPrice: price,
        effectiveFinalPrice: price,
      };
    });

    const route = customer.routeName ?? '';
    const boy = boys.find((b) => String(b.primaryRouteName ?? '') === route && route);
    const body = {
      name: String(customer.name).trim(),
      mobile,
      alternateMobile: customer.alternateMobile ?? '',
      flatNo: customer.flatNo ?? '',
      societyName: customer.societyName ?? '',
      street: customer.street ?? '',
      landmark: customer.landmark ?? '',
      city: customer.city ?? '',
      pincode: customer.pincode ?? '',
      address: customer.address ?? [customer.flatNo, customer.societyName, customer.street].filter(Boolean).join(', '),
      routeName: route,
      ...(boy ? { deliveryBoyId: boy.id } : {}),
      deliveryTime: customer.deliveryTime ?? 'Morning',
      billingType: customer.billingType ?? 'Postpaid',
      billingCycleDate: Number(customer.billingCycleDate ?? 1),
      status: customer.status ?? 'Active',
      appAccessEnabled: customer.appAccessEnabled ?? true,
      subscriptionStartDate: start,
      notes: customer.notes ?? '',
      subscriptionPlans: plans,
    };

    const takes = plans.map((p) => `${p.numberOfItems}× ${p.productName} ${p.quantityLabel}`).join(', ') || 'nothing yet';
    if (dry) {
      say(`  ${was ? 'update' : 'add   '} ${body.name} (${mobile}) — ${takes}`);
      continue;
    }
    const result = was ? await call('PATCH', `/customers/${was.id}`, body) : await call('POST', '/customers', body);
    say(`  ${was ? 'updated' : 'added  '} ${result.name} (${mobile}) — ${takes}`);
  }
}

// --- doing it ------------------------------------------------------------------------------------------------------

const data = load();
const wrong = complaints(data);
if (wrong.length) {
  die(
    `${file}\nis not ready yet:\n\n` +
      wrong.map((line) => '  • ' + line).join('\n') +
      `\n\nNothing was written. Fix those and run it again.`,
  );
}

say(`\n${dry ? 'Would import' : 'Importing'} into ${api}`);
say(`from ${file}\n`);

await signIn();

const products = data.products ?? [];
if (products.length) {
  say(`Products (${products.length})`);
  var saved = await importProducts(products);
  say('');
} else {
  var saved = new Map();
}

const boys = data.deliveryBoys ?? [];
if (boys.length) {
  say(`Delivery team (${boys.length})`);
  await importDeliveryBoys(boys);
  say('');
}

const customers = data.customers ?? [];
if (customers.length) {
  say(`Customers (${customers.length})`);
  await importCustomers(customers, saved);
  say('');
}

say(dry ? 'Nothing was written — that was a dry run.' : 'Done.');
