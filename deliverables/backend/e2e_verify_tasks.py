import json
import urllib.request
import urllib.error

BASE = "http://localhost:3000/v1"

def req(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}

def main():
    # 1) 登录
    s, j = req("POST", "/auth/wechat-login", body={"code": "dev-local-fixed"})
    assert s == 200, f"登录失败 {s} {j}"
    token = j["data"]["accessToken"]
    user_id = j["data"].get("userId") or j["data"].get("id")
    print(f"[OK] 登录成功 user={user_id}")

    # 2) 获取家庭
    s, j = req("GET", "/families", token=token)
    assert s == 200, f"获取家庭失败 {s}"
    fams = j.get("data") or j
    fams = fams if isinstance(fams, list) else fams.get("items", [])
    assert fams, "无家庭"
    family_id = fams[0]["id"]
    print(f"[OK] 家庭: {fams[0].get('name')} ({family_id})")

    # 3) 新建待办
    s, j = req("POST", "/tasks", token=token, body={
        "familyId": family_id,
        "title": "提醒爸爸测血压",
        "detail": "晚饭后测量并记录",
        "icon": "heart",
        "dueDate": "2026-08-01T09:00:00.000Z",
    })
    assert s == 201 or s == 200, f"新建待办失败 {s} {j}"
    task = j.get("data") or j
    task_id = task["id"]
    print(f"[OK] 新建待办成功 id={task_id}")

    # 4) 列表查询
    s, j = req("GET", f"/tasks?familyId={family_id}", token=token)
    assert s == 200, f"列表查询失败 {s}"
    items = j.get("data") or j
    items = items if isinstance(items, list) else items.get("items", [])
    assert any(t["id"] == task_id for t in items), "列表中未找到新建待办"
    print(f"[OK] 列表查询成功，共 {len(items)} 条")

    # 5) 更新（完成 + 改标题）
    s, j = req("PATCH", f"/tasks/{task_id}", token=token, body={
        "done": True, "title": "提醒爸爸测血压(已提醒)",
    })
    assert s == 200, f"更新失败 {s} {j}"
    upd = j.get("data") or j
    assert upd.get("done") is True and "已提醒" in upd.get("title", ""), f"更新内容不符 {upd}"
    print(f"[OK] 更新成功 done={upd['done']} title={upd['title']}")

    # 6) 过滤未完成应为空（刚建的已 done）
    s, j = req("GET", f"/tasks?familyId={family_id}&done=false", token=token)
    items = j.get("data") or j
    items = items if isinstance(items, list) else items.get("items", [])
    assert not any(t["id"] == task_id for t in items), "done=false 过滤应包含已完成的该条"
    print(f"[OK] done=false 过滤正确，未完成 {len(items)} 条")

    # 7) 删除
    s, j = req("DELETE", f"/tasks/{task_id}", token=token)
    assert s == 200, f"删除失败 {s} {j}"
    print(f"[OK] 删除成功 id={task_id}")

    # 8) 确认已删除
    s, j = req("GET", f"/tasks?familyId={family_id}", token=token)
    items = j.get("data") or j
    items = items if isinstance(items, list) else items.get("items", [])
    assert not any(t["id"] == task_id for t in items), "删除后仍存在"
    print(f"[OK] 删除后列表确认干净，剩余 {len(items)} 条")

    print("\n✅ 待办事项 CRUD 全链路验证通过")

if __name__ == "__main__":
    main()
