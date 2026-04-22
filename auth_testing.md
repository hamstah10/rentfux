# RentFux Auth Testing

## Credentials
- Admin: admin@rentfux.de / Admin123!

## Quick API Test
```
BASE=https://drive-book-8.preview.emergentagent.com
curl -c cookies.txt -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rentfux.de","password":"Admin123!"}'
curl -b cookies.txt "$BASE/api/auth/me"
```

Expected: login returns user, /me returns same user using cookies. Bcrypt hash starts with `$2b$`.
