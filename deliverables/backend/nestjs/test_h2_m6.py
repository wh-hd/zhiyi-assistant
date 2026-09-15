#!/usr/bin/env python3
"""
H2 + M6 Security Fix Verification Tests

H2: AdminGuard protects threshold update — normal user gets 403
M6: Refresh token lifecycle — store / refresh / rotate / logout / revoke
"""

import json
import urllib.request
import urllib.error

BASE = "http://localhost:3000/v1"

def api(method, path, data=None, token=None, expect_status=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        status = resp.getcode()
        result = json.loads(resp.read().decode())
        if isinstance(result, dict) and "data" in result and "success" in result:
            result = result["data"]
        if expect_status and status != expect_status:
            print(f"  [UNEXPECTED] {method} {path} -> {status} (expected {expect_status})")
            return None
        return result
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        status = e.code
        if expect_status and status == expect_status:
            print(f"  [OK] {method} {path} -> {status} (expected {expect_status})")
            try:
                return json.loads(err_body)
            except:
                return {"raw": err_body}
        print(f"  [UNEXPECTED] {method} {path} -> {status}: {err_body[:200]}")
        return None


print("=" * 60)
print("H2 + M6 Security Fix Verification")
print("=" * 60)

# ============================================================
# Step 1: Login
# ============================================================
print("\n[1] Login as normal user...")
login = api("POST", "/auth/wechat-login", {"code": "h2m6test"})
if not login:
    print("  FATAL: Login failed")
    exit(1)

accessToken = login.get("accessToken")
refreshToken = login.get("refreshToken")
userId = login.get("user", {}).get("id")
print(f"  userId={userId}")
print(f"  accessToken={'<present>' if accessToken else '<missing>'}")
print(f"  refreshToken={'<present>' if refreshToken else '<missing>'}")

# ============================================================
# H2 Test: Threshold update without admin rights -> 403
# ============================================================
print("\n[H2] Test: Update threshold as non-admin user (expect 403)...")
result = api("PATCH", "/metrics/thresholds/systolic",
             {"minNormal": 90, "maxNormal": 140},
             token=accessToken, expect_status=403)
if result is not None:
    print(f"  PASS: Non-admin user denied threshold update")
else:
    print(f"  FAIL: Non-admin user was able to update threshold!")
    exit(1)

# Also verify GET thresholds still works (read is allowed)
print("\n[H2] Test: GET thresholds as normal user (expect 200)...")
thresholds = api("GET", "/metrics/thresholds", token=accessToken)
if thresholds is not None:
    print(f"  PASS: Normal user can read thresholds ({len(thresholds)} records)")
else:
    print(f"  FAIL: Normal user cannot read thresholds")
    exit(1)

# ============================================================
# M6 Test 1: Refresh token works
# ============================================================
print("\n[M6-1] Test: Refresh token (expect new tokens)...")
refresh_result = api("POST", "/auth/refresh-token",
                     {"refreshToken": refreshToken})
if refresh_result and refresh_result.get("accessToken"):
    newAccessToken = refresh_result["accessToken"]
    newRefreshToken = refresh_result["refreshToken"]
    print(f"  PASS: Refresh succeeded, got new tokens")
    print(f"  New accessToken={'<present>' if newAccessToken else '<missing>'}")
    print(f"  New refreshToken={'<present>' if newRefreshToken else '<missing>'}")
else:
    print(f"  FAIL: Refresh failed")
    exit(1)

# ============================================================
# M6 Test 2: Old refresh token is revoked (token rotation)
# ============================================================
print("\n[M6-2] Test: Old refresh token after rotation (expect 401)...")
old_result = api("POST", "/auth/refresh-token",
                 {"refreshToken": refreshToken},
                 expect_status=401)
if old_result is not None:
    print(f"  PASS: Old refresh token rejected after rotation")
else:
    print(f"  FAIL: Old refresh token still works after rotation!")
    exit(1)

# ============================================================
# M6 Test 3: Logout revokes refresh token
# ============================================================
print("\n[M6-3] Test: Logout revokes refresh token...")
logout_result = api("POST", "/auth/logout",
                    {"refreshToken": newRefreshToken},
                    token=newAccessToken)
if logout_result and logout_result.get("success"):
    print(f"  PASS: Logout succeeded")
else:
    print(f"  FAIL: Logout failed")
    exit(1)

# ============================================================
# M6 Test 4: Refresh after logout -> 401
# ============================================================
print("\n[M6-4] Test: Refresh after logout (expect 401)...")
post_logout = api("POST", "/auth/refresh-token",
                  {"refreshToken": newRefreshToken},
                  expect_status=401)
if post_logout is not None:
    print(f"  PASS: Refresh token rejected after logout")
else:
    print(f"  FAIL: Refresh token still works after logout!")
    exit(1)

# ============================================================
# Summary
# ============================================================
print("\n" + "=" * 60)
print("ALL TESTS PASSED")
print("=" * 60)
print("""
H2: AdminGuard blocks non-admin threshold updates -> 403
    Normal users can still read thresholds -> 200
M6: Refresh token stored in DB on login
    Token rotation on refresh (old token revoked)
    Logout revokes refresh token
    Revoked tokens cannot be used -> 401
""")
