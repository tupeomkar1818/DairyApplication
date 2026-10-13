#!/usr/bin/env bash
# Signing in with a PIN: the first time with your own mobile number, then with the four digits you chose.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
MOBILE=${MOBILE:-9876588888}

anon() { curl -s -H 'content-type: application/json' "$@"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n=== %s\n' "$1"; }
show() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log(s);return}console.log(eval(process.argv[1]))})' "$1"; }
problem() { show 'v.error ? v.error.code : "ACCEPTED (should not be)"'; }
login() { anon -X POST "$API/auth/login" -d "{\"mobileNumber\":\"$1\",\"secret\":\"$2\"}"; }
find_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const list=(JSON.parse(s).items)||[];const m=list.find(x=>(x.mobile||x.mobileNumber)===process.argv[1]);console.log(m?m.id:"")})' "$1"; }

step "the dairy signs in with its own PIN (or its number, the first time)"
ADMIN_TOKEN=$(login "$ADMIN_MOBILE" "$ADMIN_MOBILE" | field session.sessionId)
if [ -z "$ADMIN_TOKEN" ]; then
  ADMIN_TOKEN=$(login "$ADMIN_MOBILE" "${ADMIN_PIN:-4321}" | field session.sessionId)
fi
[ -n "$ADMIN_TOKEN" ] || { echo "could not sign the dairy in — has its PIN been set to something else?"; exit 1; }
admin() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $ADMIN_TOKEN" "$@"; }
echo "signed in"
# Whatever the dairy's own PIN is, this walk-through leaves it as it found it.
admin -o /dev/null -X POST "$API/auth/pin" -d '{"pin":"4321","currentPin":"4321"}' 2>/dev/null || true

step "clearing anything an earlier run left behind"
OLD=$(admin "$API/customers" | find_id "$MOBILE")
[ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/customers/$OLD"
admin -o /dev/null -X POST "$API/auth/pin/reset" -d "{\"mobileNumber\":\"$MOBILE\"}"
echo "cleared"

step "the dairy adds a customer — nothing is sent to them"
CUST_ID=$(admin -X POST "$API/customers" -d "{\"name\":\"Sunita Pawar\",\"mobile\":\"$MOBILE\",\"address\":\"E-5\",
  \"societyName\":\"Shivneri\",\"deliveryTime\":\"Morning\",\"status\":\"Active\",\"routeName\":\"Kothrud A\"}" | field id)
echo "customer: $CUST_ID"

step "a number the dairy does not know cannot sign in"
login "9000000000" "9000000000" | problem

step "the first time, the customer's password is their own number"
FIRST=$(login "$MOBILE" "$MOBILE")
echo "$FIRST" | show 'JSON.stringify({signedIn: !!v.session, role: v.session?.role, mustSetPin: v.mustSetPin})'
CUST_TOKEN=$(echo "$FIRST" | field session.sessionId)
cust() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $CUST_TOKEN" "$@"; }

step "until they choose a PIN there is nothing else they can do"
cust "$API/me/customer" | problem

step "so they choose one"
cust -X POST "$API/auth/pin" -d '{"pin":"2580"}' | show 'JSON.stringify(v)'

step "and now the app works"
cust "$API/me/customer" | show '"their record: " + (v.name ?? JSON.stringify(v))'

step "their number is no longer a password — that window is closed"
login "$MOBILE" "$MOBILE" | problem

step "the PIN is"
login "$MOBILE" "2580" | show 'JSON.stringify({signedIn: !!v.session, mustSetPin: v.mustSetPin})'

step "a wrong PIN says how many tries are left, and then closes the account for a while"
for i in 1 2 3 4; do login "$MOBILE" "1111" | show '"try: " + (v.error ? v.error.message : "ACCEPTED (should not be)")'; done
login "$MOBILE" "1111" | show '"fifth: " + (v.error ? v.error.code + " — " + v.error.message : "ACCEPTED (should not be)")'
echo "even the right PIN has to wait now:"
login "$MOBILE" "2580" | problem

step "the dairy forgets the PIN for them, which also opens the account again"
admin -X POST "$API/auth/pin/reset" -d "{\"mobileNumber\":\"$MOBILE\"}" | show 'JSON.stringify(v)'
login "$MOBILE" "$MOBILE" | show 'JSON.stringify({signedIn: !!v.session, mustSetPin: v.mustSetPin})'

step "a customer cannot reset anybody's PIN"
CUST_TOKEN=$(login "$MOBILE" "$MOBILE" | field session.sessionId)
cust -X POST "$API/auth/pin" -d '{"pin":"1357"}' > /dev/null
cust -X POST "$API/auth/pin/reset" -d "{\"mobileNumber\":\"$ADMIN_MOBILE\"}" | problem

step "changing a PIN needs the one in use"
cust -X POST "$API/auth/pin" -d '{"pin":"2468","currentPin":"0000"}' | problem
cust -X POST "$API/auth/pin" -d '{"pin":"2468","currentPin":"1357"}' | show 'JSON.stringify(v)'
login "$MOBILE" "2468" | show '"signs in with the new PIN: " + !!v.session'

step "and a PIN has to be four digits"
cust -X POST "$API/auth/pin" -d '{"pin":"123","currentPin":"2468"}' | problem

step "the dairy removes them, and the login goes too"
admin -o /dev/null -w "removed: %{http_code}\n" -X DELETE "$API/customers/$CUST_ID"
echo "the PIN they chose:"
login "$MOBILE" "2468" | problem
echo "and their own number:"
login "$MOBILE" "$MOBILE" | problem
