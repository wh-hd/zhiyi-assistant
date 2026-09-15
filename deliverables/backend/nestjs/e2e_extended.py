#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智医助手 后端扩展 E2E 冒烟测试（无外部依赖，仅标准库 urllib）。
覆盖：鉴权安全、家庭/成员/通知/档案、药品、指标、红线、咨询 SSE+持久化、报告。
后端路由使用复数前缀（users/families/medications/metrics/consultations/reports...）。
POST 创建类接口返回 201，红线检测/查询类返回 200。
运行：python e2e_extended.py
"""
import json
import time
import urllib.request
import urllib.error
import socket

BASE = "http://localhost:3000/v1"

passed = 0
failed = 0
lines = []


def print_summary():
    print("\n" + "=" * 56)
    print(f"结果汇总：通过 {passed} / 失败 {failed}")
    print("=" * 56)
    for l in lines:
        print(l)
    print("=" * 56)


def log(name, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
        tag = "PASS"
    else:
        failed += 1
        tag = "FAIL"
    msg = f"[{tag}] {name}" + (f" :: {detail}" if detail else "")
    lines.append(msg)
    print(msg)


def call(method, path, body=None, token=None, timeout=30):
    url = BASE + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        status = e.code
    except Exception as e:  # noqa
        return None, 0, str(e)
    try:
        payload = json.loads(raw) if raw else None
    except Exception:  # noqa
        payload = raw
    return payload, status, raw


def data_of(payload):
    if isinstance(payload, dict):
        return payload.get("data")
    return payload


def created(st):
    return st in (200, 201)


# ---------------------------------------------------------------------------
# 1. 鉴权与安全
# ---------------------------------------------------------------------------
print("\n=== 1. 鉴权与安全 ===")
login, st, _ = call("POST", "/auth/wechat-login", {"code": "xiaolin"})
token = (data_of(login) or {}).get("accessToken") if st == 200 else None
log("登录(种子用户晓琳)返回200+token", st == 200 and bool(token), f"status={st}")

# 安全：refresh-token 用裸 userId 应被拒（修复 A1）
_, st2, _ = call("POST", "/auth/refresh-token", {"userId": "u-001"})
log("refresh-token 拒绝裸userId(400)", st2 == 400, f"status={st2}")

# 401 未授权
_, st3, _ = call("GET", "/users/me")
log("GET /users/me 无token返回401", st3 == 401, f"status={st3}")
_, st4, _ = call("GET", "/medications")
log("GET /medications 无token返回401", st4 == 401, f"status={st4}")

if not token:
    log("后续鉴权接口因缺少token跳过", False, "登录失败，终止")
    print_summary()
    raise SystemExit(1)

# ---------------------------------------------------------------------------
# 2. 家庭 / 成员 / 通知 / 档案
# ---------------------------------------------------------------------------
print("\n=== 2. 家庭/成员/通知/档案 ===")
_, st, _ = call("GET", "/families", token=token)
log("家庭列表(GET /families) 200", st == 200, f"status={st}")
_, st, _ = call("GET", "/families/f-001/members", token=token)
log("家庭成员(GET /families/f-001/members) 200", st == 200, f"status={st}")
_, st, _ = call("GET", "/notifications?pageSize=50", token=token)
log("通知列表(GET /notifications) 200", st == 200, f"status={st}")
_, st, _ = call("GET", "/health-records/m-001", token=token)
log("健康档案(GET /health-records/m-001) 200", st == 200, f"status={st}")
_, st, _ = call("GET", "/knowledge/categories", token=token)
log("健康知识分类(GET /knowledge/categories) 200", st == 200, f"status={st}")

# ---------------------------------------------------------------------------
# 3. 药品管理
# ---------------------------------------------------------------------------
print("\n=== 3. 药品管理 ===")
med_body = {
    "memberId": "m-001", "medicineName": "缬沙坦", "medicineCode": "C09CA03",
    "dosage": "80mg", "dosageUnit": "片", "frequency": "daily",
    "startDate": "2026-07-01", "source": "manual",
}
med, st, _ = call("POST", "/medications", med_body, token)
med_id = (data_of(med) or {}).get("id") if created(st) else None
log("创建药品(POST /medications) 201/200", created(st) and bool(med_id), f"status={st} id={med_id}")

_, st, _ = call("GET", "/medications?memberId=m-001", token=token)
log("药品列表(GET /medications?memberId) 200", st == 200, f"status={st}")
_, st, _ = call("GET", "/medications/today?memberId=m-001", token=token)
log("今日用药(GET /medications/today) 200", st == 200, f"status={st}")

if med_id:
    adh, st, _ = call("POST", f"/medications/{med_id}/adherence", {"status": "taken"}, token=token)
    log("标记服药依从(POST /medications/:id/adherence) 201/200", created(st), f"status={st}")
else:
    log("标记服药依从 跳过(无med_id)", False, "前置失败")

# 校验：缺必填
_, st5, _ = call("POST", "/medications", {"medicineName": "x"}, token=token)
log("创建药品缺字段返回400", st5 == 400, f"status={st5}")

# ---------------------------------------------------------------------------
# 4. 健康指标
# ---------------------------------------------------------------------------
print("\n=== 4. 健康指标 ===")
_, st, _ = call("POST", "/metrics", {
    "memberId": "m-001", "metricType": "blood_pressure_systolic",
    "value": 128, "unit": "mmHg", "inputMethod": "manual",
}, token)
log("记录指标(POST /metrics) 201/200", created(st), f"status={st}")

_, st, _ = call("POST", "/metrics/batch", {
    "memberId": "m-001",
    "metrics": [
        {"metricType": "blood_pressure_systolic", "value": 130, "unit": "mmHg"},
        {"metricType": "blood_pressure_diastolic", "value": 85, "unit": "mmHg"},
    ],
}, token=token)
log("批量记录(POST /metrics/batch) 201/200", created(st), f"status={st}")

_, st, _ = call("GET", "/metrics/trend?memberId=m-001&type=blood_pressure_systolic&days=30", token=token)
log("指标趋势(GET /metrics/trend) 200", st == 200, f"status={st}")
_, st, _ = call("GET", "/metrics/thresholds", token=token)
log("指标阈值(GET /metrics/thresholds) 200", st == 200, f"status={st}")

# 校验：缺 value
_, st6, _ = call("POST", "/metrics", {"memberId": "m-001", "metricType": "x", "unit": "y"}, token=token)
log("记录指标缺value返回400", st6 == 400, f"status={st6}")

# ---------------------------------------------------------------------------
# 5. 红线检测（修复后应为 200）
# ---------------------------------------------------------------------------
print("\n=== 5. 红线检测 ===")
rl_urgent, st, _ = call("POST", "/consultations/redline-check",
                        {"query": "我不想活了，想自杀", "memberId": "m-001"}, token=token)
trig = (data_of(rl_urgent) or {}).get("triggered")
log("红线-危机语句触发(triggered=true) 且 200", st == 200 and trig is True, f"status={st} triggered={trig}")

rl_safe, st, _ = call("POST", "/consultations/redline-check",
                      {"query": "最近有点累，想了解健康饮食建议", "memberId": "m-001"}, token=token)
trig2 = (data_of(rl_safe) or {}).get("triggered")
log("红线-普通语句未触发(triggered=false) 且 200", st == 200 and trig2 is False, f"status={st} triggered={trig2}")

# ---------------------------------------------------------------------------
# 6. 咨询 SSE + 持久化（关键修复 A2/A6）
# ---------------------------------------------------------------------------
print("\n=== 6. 咨询 SSE + 持久化 ===")
sse_events = []
try:
    url = BASE + "/consultations"
    data = json.dumps({
        "query": "我父亲有高血压，平时饮食要注意什么？",
        "familyId": "f-001", "memberId": "m-001",
    }).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }, method="POST")
    resp = urllib.request.urlopen(req, timeout=90)
    start = time.time()
    seen_terminal = False
    while time.time() - start < 90:
        try:
            line = resp.readline().decode("utf-8").rstrip("\n")
        except socket.timeout:
            break
        if not line:
            continue
        if line.startswith("event:"):
            ev = line[6:].strip()
            sse_events.append(ev)
            if ev in ("done", "error"):
                seen_terminal = True
        if seen_terminal:
            break
    log("咨询SSE开始流式返回事件", len(sse_events) > 0, f"events={sse_events[:6]}")
except Exception as e:  # noqa
    log("咨询SSE传输异常", False, str(e)[:120])

# 持久化校验：无论 SSE 成功或优雅失败(error event)，DB 应已创建记录（A2：create 在 done 之前）
hist, st, _ = call("GET", "/consultations/history?memberId=m-001", token=token)
hist_items = (data_of(hist) or {}).get("items") if isinstance(data_of(hist), dict) else None
has_entries = isinstance(hist_items, list) and len(hist_items) > 0
log("咨询历史持久化(GET /consultations/history) 有记录", st == 200 and has_entries,
    f"status={st} count={len(hist_items) if isinstance(hist_items, list) else 'n/a'}")

# ---------------------------------------------------------------------------
# 7. 健康报告
# ---------------------------------------------------------------------------
print("\n=== 7. 健康报告 ===")
rep, st, _ = call("POST", "/reports/generate", {"memberId": "m-001", "type": "periodic"}, token=token)
rep_id = (data_of(rep) or {}).get("id") if created(st) else None
log("生成报告(POST /reports/generate) 201/200", created(st) and bool(rep_id), f"status={st} id={rep_id}")

_, st, _ = call("GET", "/reports?memberId=m-001", token=token)
log("报告列表(GET /reports) 200", st == 200, f"status={st}")

if rep_id:
    one, st, _ = call("GET", f"/reports/{rep_id}", token=token)
    log("报告详情(GET /reports/:id) 200", st == 200, f"status={st}")
else:
    log("报告详情 跳过(无rep_id)", False, "前置失败")

# ---------------------------------------------------------------------------
print_summary()
