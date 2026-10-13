#!/usr/bin/env bash
# Somebody's own profile: their name and address, their photo, and the number they sign in with — which takes a
# code on the old number and one on the new, in that order.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
MOBILE=${MOBILE:-9876577777}
NEW_MOBILE=${NEW_MOBILE:-9876577788}
TAKEN_MOBILE=${TAKEN_MOBILE:-9876577799}

anon() { curl -s -H 'content-type: application/json' "$@"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n=== %s\n' "$1"; }
show() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log(s);return}console.log(eval(process.argv[1]))})' "$1"; }
problem() { show 'v.error ? v.error.code : "ACCEPTED (should not be)"'; }
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
find_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const list=(JSON.parse(s).items)||[];const m=list.find(x=>(x.mobile||x.mobileNumber)===process.argv[1]);console.log(m?m.id:"")})' "$1"; }

TOKEN=$(sign_in "$ADMIN_MOBILE") || exit 1
admin() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" "$@"; }

step "clearing anything an earlier run left behind"
for mobile in "$MOBILE" "$NEW_MOBILE" "$TAKEN_MOBILE"; do
  OLD=$(admin "$API/customers" | find_id "$mobile")
  [ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/customers/$OLD"
done
echo "cleared"

step "a customer the dairy added, and a neighbour whose number is taken"
CUST_ID=$(admin -X POST "$API/customers" -d "{\"name\":\"Rina Shah\",\"mobile\":\"$MOBILE\",\"address\":\"C-3, Shivneri\",
  \"societyName\":\"Shivneri\",\"houseFlatNumber\":\"C-3\",\"deliveryTime\":\"Morning\",\"status\":\"Active\",
  \"routeName\":\"Kothrud A\"}" | field id)
admin -o /dev/null -X POST "$API/customers" -d "{\"name\":\"Neighbour\",\"mobile\":\"$TAKEN_MOBILE\",\"address\":\"C-4\",
  \"societyName\":\"Shivneri\",\"deliveryTime\":\"Morning\",\"status\":\"Active\"}"
echo "customer: $CUST_ID"

step "they sign in and read their own profile"
CUST_TOKEN=$(sign_in "$MOBILE") || exit 1
cust() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $CUST_TOKEN" "$@"; }
cust "$API/me/profile" | show 'JSON.stringify(v.profile, null, 1)'

step "changing a detail without the code is refused"
cust -X PATCH "$API/me/profile" -d '{"displayName":"Rina D Shah","otp":"000000"}' | problem

step "so they ask for one, and save with it"
# Waits out the minute between codes, so running this twice in a row reads the same as running it once.
profile_code() {
  _otp=""; _tries=0
  until [ -n "$_otp" ]; do
    _answer=$(cust -X POST "$API$1" ${2:+-d "$2"})
    _otp=$(echo "$_answer" | field demoOtp)
    if [ -z "$_otp" ]; then
      _tries=$((_tries + 1))
      [ "$_tries" -gt 8 ] && { echo "could not get a code from $1: $_answer" >&2; return 1; }
      sleep 9
    fi
  done
  echo "$_otp"
}

SAVE_OTP=$(profile_code "/me/profile/otp")
echo "code sent to their own number"
cust -X PATCH "$API/me/profile" -d "{\"displayName\":\"Rina D Shah\",\"address\":\"C-3, Shivneri, Kothrud\",
  \"houseFlatNumber\":\"C-3\",\"alternateMobile\":\"9876500123\",\"otp\":\"$SAVE_OTP\"}" \
  | show 'JSON.stringify({name: v.profile.displayName, address: v.profile.address, alternate: v.profile.alternateMobile})'

step "the same code cannot be used twice"
cust -X PATCH "$API/me/profile" -d "{\"displayName\":\"Somebody Else\",\"otp\":\"$SAVE_OTP\"}" | problem

step "and the dairy's own screens show what they changed"
admin "$API/customers/$CUST_ID" | show 'JSON.stringify({name: v.name, address: v.address, alternate: v.alternateMobile})'

step "a photo has to be sent to /media first — a record keeps its address"
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ avatarUri: "data:image/png;base64," + "A".repeat(200000) }))' "${TMPDIR:-/tmp}/amrale-avatar.json"
cust -X PUT "$API/me/profile/avatar" -d @"${TMPDIR:-/tmp}/amrale-avatar.json" | problem
cust -X PUT "$API/me/profile/avatar" -d '{"avatarUri":"https://amrale-dairy-api.example.workers.dev/media/2026/10/rina.jpg"}' \
  | show '"photo: " + v.profile.avatarUri'

step "changing their number: the new one cannot be asked for first"
cust -X POST "$API/me/profile/mobile/new/otp" -d "{\"newMobileNumber\":\"$NEW_MOBILE\"}" | problem

step "so the old number answers first"
OLD_OTP=$(profile_code "/me/profile/mobile/old/otp")
cust -X POST "$API/me/profile/mobile/old/verify" -d "{\"otp\":\"$OLD_OTP\"}" | show 'JSON.stringify(v)'

step "a number somebody else uses is refused, and so is the one they already have"
cust -X POST "$API/me/profile/mobile/new/otp" -d "{\"newMobileNumber\":\"$TAKEN_MOBILE\"}" | problem
cust -X POST "$API/me/profile/mobile/new/otp" -d "{\"newMobileNumber\":\"$MOBILE\"}" | problem

step "the new number answers, and the move is made"
NEW_OTP=$(profile_code "/me/profile/mobile/new/otp" "{\"newMobileNumber\":\"$NEW_MOBILE\"}")
cust -X POST "$API/me/profile/mobile/new/verify" -d "{\"newMobileNumber\":\"$NEW_MOBILE\",\"otp\":\"$NEW_OTP\"}" \
  | show 'v.profile ? "they now sign in with " + v.profile.mobileNumberRaw : JSON.stringify(v)'

step "the record the dairy keeps moved with it, and they are still signed in"
admin "$API/customers/$CUST_ID" | show '"the dairy has: " + v.mobile'
cust "$API/me/profile" | show '"their session still reads: " + v.profile.mobileNumberRaw'

step "and the new number is the one that signs in from now on"
anon -X POST "$API/auth/otp/request" -d "{\"mobileNumber\":\"$MOBILE\"}" | problem
# The new number was sent a code a moment ago, so asking again this minute is the cooldown — which is itself
# proof the dairy now knows it (a number it does not know is refused outright).
anon -X POST "$API/auth/otp/request" -d "{\"mobileNumber\":\"$NEW_MOBILE\"}" \
  | show 'v.error ? "the new number: " + v.error.code : "the new number: a code is on its way"'

step "nobody reads a profile without signing in"
anon -o /dev/null -w "no sign-in: %{http_code}\n" "$API/me/profile"

step "tidy up"
admin -o /dev/null -w "customer %{http_code}, " -X DELETE "$API/customers/$CUST_ID"
NEIGHBOUR=$(admin "$API/customers" | find_id "$TAKEN_MOBILE")
admin -o /dev/null -w "neighbour %{http_code}\n" -X DELETE "$API/customers/$NEIGHBOUR"
rm -f "${TMPDIR:-/tmp}/amrale-avatar.json"
