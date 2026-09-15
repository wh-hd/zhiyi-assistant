#!/usr/bin/env python3
"""P0 事件总线 + Scheduler 功能验证脚本
验证事件触发后通知记录是否正确写入数据库。
"""
import json
import urllib.request
import urllib.error
import sys

BASE = "http://localhost:3000/v1"
TOKEN = None
USER_ID = None
FAMILY_ID = None
MEMBER_ID = None

def api(method, path, data=None, token=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read().decode())
        # Unwrap {success, data, meta} envelope
        if isinstance(result, dict) and "data" in result and "success" in result:
            return result["data"]
        return result
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"  ❌ {method} {path} → {e.code}: {err_body[:200]}")
        return None
    except Exception as e:
        print(f"  ❌ {method} {path} → {e}")
        return None

def step(n, title):
    print(f"\n{'='*60}")
    print(f"Step {n}: {title}")
    print(f"{'='*60}")

# ============================================================
# Step 1: 登录
# ============================================================
step(1, "登录（开发模式 code=xiaolin）")
result = api("POST", "/auth/wechat-login", {"code": "xiaolin"})
if not result or "accessToken" not in result:
    print("登录失败，退出")
    sys.exit(1)
TOKEN = result["accessToken"]
USER_ID = result.get("user", {}).get("id", "")
print(f"  ✅ 登录成功 userId={USER_ID}")

# ============================================================
# Step 2: 获取家庭 + 成员
# ============================================================
step(2, "获取家庭和成员")
families = api("GET", "/families", token=TOKEN)
if families and isinstance(families, list) and len(families) > 0:
    FAMILY_ID = families[0]["id"]
    print(f"  ✅ 家庭: {FAMILY_ID}")
elif families and isinstance(families, dict) and "items" in families:
    FAMILY_ID = families["items"][0]["id"]
    print(f"  ✅ 家庭: {FAMILY_ID}")
else:
    # Try /families/my
    families = api("GET", "/families/my", token=TOKEN)
    if families:
        FAMILY_ID = families.get("id", "")
        print(f"  ✅ 家庭: {FAMILY_ID}")
    else:
        print("  ⚠️ 未获取到家庭，尝试直接获取成员")

members = api("GET", f"/families/{FAMILY_ID}/members", token=TOKEN) if FAMILY_ID else None
if members:
    if isinstance(members, list):
        MEMBER_ID = members[0]["id"]
    elif isinstance(members, dict) and "items" in members:
        MEMBER_ID = members["items"][0]["id"]
    print(f"  ✅ 成员: {MEMBER_ID}")
else:
    print("  ⚠️ 未获取到成员")
    sys.exit(1)

# ============================================================
# Step 3: 记录通知前基线
# ============================================================
step(3, "记录通知前基线")
before = api("GET", "/notifications?page=1&pageSize=50", token=TOKEN)
before_count = 0
if before and isinstance(before, dict):
    before_count = before.get("pagination", {}).get("total", 0)
    print(f"  ✅ 当前通知数: {before_count}")
elif before and isinstance(before, list):
    before_count = len(before)
    print(f"  ✅ 当前通知数: {before_count}")
else:
    print(f"  ℹ️ 通知列表响应: {before}")

unread_before = api("GET", "/notifications/unread-count", token=TOKEN)
print(f"  ℹ️ 未读计数: {unread_before}")

# ============================================================
# Step 4: 创建用药计划（触发 medication.plan.created 事件）
# ============================================================
step(4, "创建用药计划（触发 medication.plan.created）")
med_data = {
    "memberId": MEMBER_ID,
    "medicineName": "测试降压药",
    "dosage": 1,
    "dosageUnit": "片",
    "frequency": "daily",
    "startDate": "2026-07-10",
}
med_result = api("POST", "/medications", med_data, token=TOKEN)
if med_result:
    PLAN_ID = med_result.get("id", "")
    print(f"  ✅ 用药计划创建成功 planId={PLAN_ID}")
else:
    PLAN_ID = None
    print("  ⚠️ 用药计划创建失败")

# ============================================================
# Step 5: 标记漏服（触发 medication.missed 事件）
# ============================================================
step(5, "标记漏服（触发 medication.missed）")
if PLAN_ID:
    miss_result = api("POST", f"/medications/{PLAN_ID}/adherences", {
        "status": "missed",
        "scheduledAt": "2026-07-10T08:00:00",
    }, token=TOKEN)
    if miss_result:
        print(f"  ✅ 标记漏服成功 adherenceId={miss_result.get('id', '')}")
    else:
        print("  ⚠️ 标记漏服失败")

# ============================================================
# Step 6: 记录异常指标（触发 metric.abnormal 事件）
# ============================================================
step(6, "记录异常指标（触发 metric.abnormal）")
metric_data = {
    "memberId": MEMBER_ID,
    "metricType": "blood_pressure_systolic",
    "value": 180,
    "unit": "mmHg",
    "recordedAt": "2026-07-10T10:00:00",
}
metric_result = api("POST", "/metrics", metric_data, token=TOKEN)
if metric_result:
    print(f"  ✅ 异常指标记录成功 metricId={metric_result.get('id', '')}")
else:
    print("  ⚠️ 异常指标记录失败")

# ============================================================
# Step 7: 验证通知写入
# ============================================================
step(7, "验证通知写入")
import time
print("  ⏳ 等待 2 秒让异步事件处理完成...")
time.sleep(2)

after = api("GET", "/notifications?page=1&pageSize=50", token=TOKEN)
after_count = 0
notifications = []
if after and isinstance(after, dict):
    after_count = after.get("pagination", {}).get("total", 0)
    notifications = after.get("items", [])
elif after and isinstance(after, list):
    after_count = len(after)
    notifications = after

print(f"  📊 通知数: {before_count} → {after_count} (新增 {after_count - before_count})")
print(f"\n  通知列表（最新 10 条）:")
for n in notifications[:10]:
    ntype = n.get("type", "?")
    title = n.get("title", "?")
    status = n.get("status", "?")
    created = n.get("createdAt", "?")[:19]
    print(f"    [{created}] {ntype:20s} | {status:8s} | {title}")

# ============================================================
# Step 8: 结论
# ============================================================
step(8, "结论")
new_count = after_count - before_count
if new_count > 0:
    print(f"  ✅ PASS: 事件触发后新增 {new_count} 条通知")
    print(f"  事件总线订阅链路已打通：publish → @OnEvent → createNotification → DB")
else:
    print(f"  ❌ FAIL: 通知数未增加（{before_count} → {after_count}）")
    print(f"  可能原因:")
    print(f"    1. 事件名不匹配（检查 EVENTS 常量 vs @OnEvent 参数）")
    print(f"    2. NotificationConsumer 未被 NestJS DI 容器加载")
    print(f"    3. 异步事件处理异常（检查服务端日志）")

print(f"\n{'='*60}")
print("测试完成")
