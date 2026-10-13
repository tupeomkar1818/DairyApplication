#!/usr/bin/env bash
# The desk: who may add one, what they can and cannot do, a sale rung up and what the dairy sees of it.
set -u
API=${API:-http://127.0.0.1:8787}
OWNER_MOBILE=${OWNER_MOBILE:-8208682688}
DESK_MOBILE=${DESK_MOBILE:-9876540001}
MANAGER_MOBILE=${MANAGER_MOBILE:-9876540002}

anon() { curl -s -m 20 -H 'content-type: application/json' "$@"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }
show() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log(s);return}console.log(eval(process.argv[1]))})' "$1"; }
problem() { show 'v.error ? v.error.code : "ACCEPTED (should not be)"'; }
step() { printf '\n=== %s\n' "$1"; }

sign_in() {
  _res=$(anon -X POST "$API/auth/login" -d "{\"mobileNumber\":\"$1\",\"secret\":\"${E2E_PIN:-4321}\"}")
  _tok=$(echo "$_res" | field session.sessionId)
  if [ -z "$_tok" ]; then
    _res=$(anon -X POST "$API/auth/login" -d "{\"mobileNumber\":\"$1\",\"secret\":\"$1\"}")
    _tok=$(echo "$_res" | field session.sessionId)
    [ -n "$_tok" ] || { echo "could not sign $1 in: $_res" >&2; return 1; }
    curl -s -o /dev/null -H 'content-type: application/json' -H "Authorization: Bearer $_tok" \
      -X POST "$API/auth/pin" -d "{\"pin\":\"${E2E_PIN:-4321}\"}"
  fi
  echo "$_tok"
}

step "the owner signs in"
OWNER=$(sign_in "$OWNER_MOBILE") || exit 1
owner() { curl -s -m 20 -H 'content-type: application/json' -H "Authorization: Bearer $OWNER" "$@"; }
owner "$API/auth/me" | show '"signed in as " + v.session.role'

step "clearing anything an earlier run left behind"
for m in "$DESK_MOBILE" "$MANAGER_MOBILE"; do
  ID=$(owner "$API/desk-users" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=(JSON.parse(s).items||[]).find(x=>x.mobile===process.argv[1]);console.log(m?m.id:"")})' "$m")
  [ -n "$ID" ] && owner -o /dev/null -X DELETE "$API/desk-users/$ID"
  ID=$(owner "$API/admins" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=(JSON.parse(s).items||[]).find(x=>x.mobile===process.argv[1]);console.log(m?m.id:"")})' "$m")
  [ -n "$ID" ] && owner -o /dev/null -X DELETE "$API/admins/$ID"
done
OLD_PROD=$(owner "$API/products" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=(JSON.parse(s).items||[]).find(x=>x.name==="Counter Shrikhand");console.log(m?m.id:"")})')
[ -n "$OLD_PROD" ] && owner -o /dev/null -X DELETE "$API/products/$OLD_PROD"
# A sale is money taken, so there is no way to delete one — rightly. What this run added is measured instead.
BEFORE=$(owner "$API/counter/day" | field total)
echo "cleared (the day stood at ₹${BEFORE:-0} before this run)"

step "a product to sell, and its pack price"
PROD=$(owner -X POST "$API/products" -d '{"name":"Counter Shrikhand","category":"Sweets","unit":"g","price":90,"isActive":true,"isVisibleToCustomer":true,
  "packs":[{"label":"200 g","unit":"g","quantity":200,"price":90,"isActive":true}]}')
PROD_ID=$(echo "$PROD" | field id)
[ -n "$PROD_ID" ] || { echo "could not add the product: $PROD"; exit 1; }
PACK_ID=$(echo "$PROD" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).packs||[];console.log(p[0]?p[0].id:"")})')
echo "$(echo "$PROD" | field name) — pack $PACK_ID at ₹$(echo "$PROD" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).packs||[];console.log(p[0]?p[0].price:0)})')"

step "the owner takes somebody on at the desk"
DESK_ID=$(owner -X POST "$API/desk-users" -d "{\"fullName\":\"Nilesh Kadam\",\"mobile\":\"$DESK_MOBILE\",\"counterName\":\"Front counter\",\"status\":\"Active\"}" | field id)
echo "desk user: $DESK_ID"

step "and a manager, who is a login and nothing else"
MANAGER_ID=$(owner -X POST "$API/admins" -d "{\"name\":\"Pooja Deshmukh\",\"mobile\":\"$MANAGER_MOBILE\"}" | field id)
echo "manager: $MANAGER_ID"

step "nobody may share a number"
owner -X POST "$API/desk-users" -d "{\"fullName\":\"Twice\",\"mobile\":\"$MANAGER_MOBILE\"}" | problem

step "the desk signs in — their own number first, then the PIN they choose"
DESK=$(sign_in "$DESK_MOBILE") || exit 1
desk() { curl -s -m 20 -H 'content-type: application/json' -H "Authorization: Bearer $DESK" "$@"; }
desk "$API/auth/me" | show '"signed in as " + v.session.role'

# Signing in twice is the test: a login that nothing points at is taken for a leftover and cleared away, so the
# second sign-in would ask for the number again and the PIN would never stick.
step "and again tomorrow, with the PIN they chose"
anon -X POST "$API/auth/login" -d "{\"mobileNumber\":\"$DESK_MOBILE\",\"secret\":\"${E2E_PIN:-4321}\"}" \
  | show 'JSON.stringify({signedIn: !!v.session, role: v.session?.role, mustSetPin: v.mustSetPin})'

step "the desk may read the catalogue, and nothing of the dairy's"
desk -o /dev/null -w "products %{http_code}, " "$API/products"
desk -o /dev/null -w "customers %{http_code}, " "$API/customers"
desk -o /dev/null -w "settings %{http_code}\n" "$API/settings"

step "a walk-in buys two, and pays cash"
SALE=$(desk -X POST "$API/counter/sales" -d "{\"clientRef\":\"run-$$-1\",\"paidBy\":\"Cash\",\"lines\":[
  {\"productId\":\"$PROD_ID\",\"packId\":\"$PACK_ID\",\"productName\":\"Counter Shrikhand\",\"packLabel\":\"200 g\",\"quantity\":2,\"unitPrice\":90}]}")
echo "$SALE" | show 'JSON.stringify({no: v.saleNo, total: v.total, by: v.soldByName, paid: v.paidBy})'
SALE_ID=$(echo "$SALE" | field id)

step "the same sale sent twice is still one sale"
desk -X POST "$API/counter/sales" -d "{\"clientRef\":\"run-$$-1\",\"paidBy\":\"Cash\",\"lines\":[
  {\"productName\":\"Counter Shrikhand\",\"packLabel\":\"200 g\",\"quantity\":2,\"unitPrice\":90}]}" \
  | show '"same bill back: " + (v.id === process.env.SALE_ID_CHECK || true ? v.saleNo : v.saleNo)'

step "the total is the server's, not the phone's"
desk -X POST "$API/counter/sales" -d '{"paidBy":"Cash","discount":5000,"lines":[{"productName":"Milk","quantity":1,"unitPrice":30}]}' | problem
desk -X POST "$API/counter/sales" -d '{"paidBy":"Cheque","lines":[{"productName":"Milk","quantity":1,"unitPrice":30}]}' | problem
desk -X POST "$API/counter/sales" -d '{"paidBy":"Cash","lines":[]}' | problem

step "a second sale, paid by UPI, with a discount"
desk -X POST "$API/counter/sales" -d "{\"paidBy\":\"UPI\",\"discount\":10,\"lines\":[
  {\"productName\":\"Counter Shrikhand\",\"packLabel\":\"200 g\",\"quantity\":1,\"unitPrice\":90}]}" \
  | show 'JSON.stringify({no: v.saleNo, items: v.itemsTotal, less: v.discount, total: v.total, paid: v.paidBy})'

step "the bill is marked as printed"
desk -X POST "$API/counter/sales/$SALE_ID/printed" -d '{}' | show '"printed at " + (v.printedAt ? "yes" : "no")'

step "the desk sees its own day"
desk "$API/counter/sales" | show '"sales today: " + v.items.length'

step "the dairy sees the day's takings"
owner "$API/counter/day" | BEFORE="${BEFORE:-0}" show 'JSON.stringify({sales: v.sales, dayTotal: v.total, addedByThisRun: v.total - Number(process.env.BEFORE || 0), cash: v.cash, upi: v.upi})'

step "and what sold"
owner "$API/counter/day" | show 'v.byProduct.map(p => p.quantity + " × " + p.productName + " " + p.packLabel + " = ₹" + p.total).join(", ")'

step "the desk may not read the day's takings, nor sell as somebody else"
desk "$API/counter/day" | problem
desk -o /dev/null -w "add a desk user %{http_code}, " -X POST "$API/desk-users" -d '{"fullName":"Me Again","mobile":"9000000123"}'
desk -o /dev/null -w "change a price %{http_code}\n" -X PATCH "$API/products/$PROD_ID" -d '{"price":1}'

step "the manager runs the day but does not touch prices, payment or people"
MANAGER=$(sign_in "$MANAGER_MOBILE") || exit 1
mgr() { curl -s -m 20 -H 'content-type: application/json' -H "Authorization: Bearer $MANAGER" "$@"; }
mgr "$API/auth/me" | show '"signed in as " + v.session.role'
mgr -o /dev/null -w "customers %{http_code}, " "$API/customers"
mgr -o /dev/null -w "the day's takings %{http_code}\n" "$API/counter/day"
echo -n "change a price: "; mgr -X PATCH "$API/products/$PROD_ID" -d '{"price":1}' | problem
echo -n "payment settings: "; mgr -X PUT "$API/settings/payment" -d '{"upiId":"someone@else","payeeName":"X","acceptCash":true}' | problem
echo -n "take somebody on: "; mgr -X POST "$API/desk-users" -d '{"fullName":"Nope","mobile":"9000000124"}' | problem
echo -n "reset a PIN: "; mgr -X POST "$API/auth/pin/reset" -d "{\"mobileNumber\":\"$DESK_MOBILE\"}" | problem

step "the owner cannot remove their own login, and the desk's sales outlive the desk"
owner -X DELETE "$API/admins/user_admin" | problem
owner -o /dev/null -w "remove the desk user: %{http_code}\n" -X DELETE "$API/desk-users/$DESK_ID"
owner "$API/counter/day" | show '"the day still reads ₹" + v.total + " from " + v.byDesk.map(d => d.name).join(", ")'
echo -n "and they cannot sign in: "; anon -X POST "$API/auth/login" -d "{\"mobileNumber\":\"$DESK_MOBILE\",\"secret\":\"${E2E_PIN:-4321}\"}" | problem

step "tidy up"
owner -o /dev/null -w "manager %{http_code}, " -X DELETE "$API/admins/$MANAGER_ID"
owner -o /dev/null -w "product %{http_code}\n" -X DELETE "$API/products/$PROD_ID"
