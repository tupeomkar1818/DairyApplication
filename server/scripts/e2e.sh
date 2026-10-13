#!/usr/bin/env bash
# Exercises the products and customers routes against a locally running Worker, signed in as the dairy.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
anon() { curl -s -H 'content-type: application/json' "$@"; }
step() { printf '\n=== %s\n' "$1"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }

# A code can only be asked for once a minute, so a run right after another one waits for the cooldown.
sign_in() {
  # Signing in the way the apps do: the number and the PIN. The first time for anybody, their own number is the
  # password and the PIN is chosen on the spot. No codes, so these never queue behind the one-minute cooldown.
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

TOKEN=$(sign_in "$ADMIN_MOBILE") || exit 1
[ -n "$TOKEN" ] || { echo "could not sign in (is SMS_PROVIDER=log with OTP_DEV_ECHO=true?)"; exit 1; }
# Every call below is the dairy’s own.
j() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" "$@"; }

step "create product"
PROD=$(j -X POST "$API/products" -d '{
  "name":"Cow Milk","category":"Milk","productType":"Milk","unit":"ml","price":30,
  "description":"Fresh cow milk","availableStock":100,"availableDays":[],"deliveryTimeSlots":["Morning"],
  "availability":"Available","features":["Fresh Product"],"taxApplicable":false,"variants":[],
  "isVisibleToCustomer":true,"isVisibleOfflineCounter":true,"isActive":true,
  "packs":[{"id":"","label":"500 ml","unit":"ml","quantity":500,"price":30,"isActive":true},
            {"id":"","label":"1 L","unit":"Litre","quantity":1000,"price":58,"discountPrice":55,"isActive":true}]
}')
echo "$PROD" | head -c 400; echo
PROD_ID=$(echo "$PROD" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
PACK_ID=$(echo "$PROD" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).packs[0].id))")

step "duplicate name is refused"
j -o /dev/null -w "status %{http_code}: " -X POST "$API/products" -d '{"name":"cow milk","price":10}'; j -X POST "$API/products" -d '{"name":"cow milk","price":10}'; echo

step "patch price, keep the rest (availableStock, features ride in details)"
j -X PATCH "$API/products/$PROD_ID" -d '{"price":32}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s);console.log({price:p.price,stock:p.availableStock,features:p.features,packs:p.packs.length,name:p.name});})"

step "create customer with a subscription line"
CUST=$(j -X POST "$API/customers" -d "{
  \"name\":\"Asha Patil\",\"mobile\":\"9876500011\",\"address\":\"B-12, Sai Heights\",\"societyName\":\"Sai Heights\",
  \"houseFlatNumber\":\"B-12\",\"streetArea\":\"Paud Road\",\"city\":\"Pune\",\"pincode\":\"411038\",
  \"deliveryTime\":\"Morning\",\"paymentType\":\"Monthly\",\"billingType\":\"Postpaid\",\"billingCycleDate\":30,
  \"status\":\"Active\",\"subscriptionStartDate\":\"2026-10-01\",\"advanceBalance\":250,
  \"subscriptionPlans\":[{\"productName\":\"Cow Milk\",\"quantityLabel\":\"500 ml\",\"packId\":\"$PACK_ID\",
    \"numberOfItems\":2,\"frequency\":\"Daily\",\"deliveryTime\":\"Morning\",\"startDate\":\"2026-10-01\",
    \"openEnded\":true,\"status\":\"Active\",\"originalPrice\":30,\"effectiveFinalPrice\":30}]
}")
echo "$CUST" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const c=JSON.parse(s);console.log({id:c.id,name:c.name,advanceBalance:c.advanceBalance,paymentType:c.paymentType,plans:c.subscriptionPlans.length,planId:c.subscriptionPlans[0].id,boy:c.assignedDeliveryBoyName,deliveries:c.deliveries.length});})"
CUST_ID=$(echo "$CUST" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")

step "duplicate mobile is refused"
j -X POST "$API/customers" -d '{"name":"Someone","mobile":"9876500011","deliveryTime":"Morning","paymentType":"Cash"}'; echo

step "bad mobile is refused"
j -X POST "$API/customers" -d '{"name":"Someone","mobile":"98765","deliveryTime":"Morning","paymentType":"Cash"}'; echo

step "patch the profile only — plans must survive untouched"
j -X PATCH "$API/customers/$CUST_ID" -d '{"routeName":"Kothrud A","discountAmount":50}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const c=JSON.parse(s);console.log({route:c.routeName,discount:c.discountAmount,plans:c.subscriptionPlans.length,planStart:c.subscriptionPlans[0].startDate,advanceBalance:c.advanceBalance});})"

step "replace the plans from the subscription tab"
j -X PATCH "$API/customers/$CUST_ID" -d '{"subscriptionPlans":[{"productName":"Cow Milk","quantityLabel":"1 L","numberOfItems":1,"frequency":"Daily","deliveryTime":"Morning","startDate":"2026-10-05","status":"Active","originalPrice":58,"effectiveFinalPrice":55}]}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const c=JSON.parse(s);console.log({plans:c.subscriptionPlans.map(p=>p.quantityLabel+' x'+p.numberOfItems)});})"

step "lists"
j "$API/products" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('products:',JSON.parse(s).items.length))"
j "$API/customers" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('customers:',JSON.parse(s).items.length))"

step "a product a customer subscribes to cannot be deleted"
j -X DELETE "$API/products/$PROD_ID"; echo

step "unknown customer"
j -o /dev/null -w "status %{http_code}: " "$API/customers/cust_nope"; j "$API/customers/cust_nope"; echo

step "delete the customer, then the product"
j -o /dev/null -w "customer delete %{http_code}\n" -X DELETE "$API/customers/$CUST_ID"
j -o /dev/null -w "product delete %{http_code}\n" -X DELETE "$API/products/$PROD_ID"
j "$API/customers" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('customers left:',JSON.parse(s).items.length))"
j "$API/products" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('products left:',JSON.parse(s).items.length))"
