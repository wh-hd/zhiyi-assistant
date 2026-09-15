import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE = 'http://localhost:3000/v1'


def request(path, method='GET', body=None, headers=None):
    url = BASE + path
    req = urllib.request.Request(url, method=method, data=body, headers=headers or {})
    if body and isinstance(body, dict):
        req.add_header('Content-Type', 'application/json')
        req.data = json.dumps(body).encode('utf-8')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read().decode('utf-8')
            return json.loads(data) if data else {}
    except urllib.error.HTTPError as e:
        print(f'HTTP {e.code}: {e.read().decode("utf-8")}')
        raise


def sse_post(path, body, token):
    url = BASE + path
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, method='POST', data=data)
    req.add_header('Content-Type', 'application/json')
    req.add_header('Authorization', f'Bearer {token}')
    events = []
    with urllib.request.urlopen(req, timeout=60) as resp:
        buffer = b''
        while True:
            chunk = resp.read(1024)
            if not chunk:
                break
            buffer += chunk
            parts = buffer.split(b'\n\n')
            buffer = parts.pop()
            for block in parts:
                event = 'message'
                payload = None
                for line in block.decode('utf-8', errors='ignore').split('\n'):
                    if line.startswith('event:'):
                        event = line[6:].strip()
                    elif line.startswith('data:'):
                        raw = line[5:].strip()
                        try:
                            payload = json.loads(raw)
                        except Exception:
                            payload = raw
                events.append((event, payload))
    return events


def main():
    # 1. 登录
    login = request('/auth/wechat-login', method='POST', body={'code': 'dev-local-' + str(int(time.time()))})
    token = login['data']['accessToken']
    user_id = login['data']['user']['id']
    print(f'[1] 登录成功 user={user_id}')

    # 2. 获取家庭
    headers = {'Authorization': f'Bearer {token}'}
    families = request('/families', headers=headers)
    families = families.get('data', families)
    if not families:
        print('无家庭，创建默认家庭')
        request('/families', method='POST', body={'name': '我的家'}, headers=headers)
        families = request('/families', headers=headers)
        families = families.get('data', families)
    family = families[0]
    family_id = family['id']
    print(f'[2] 家庭: {family_id}')

    # 3. 添加成员
    member_name = f'大海_{int(time.time())}'
    add_res = request(
        f'/families/{family_id}/members',
        method='POST',
        body={'nickname': member_name, 'relation': 'parent', 'gender': 1, 'age': 48},
        headers=headers,
    )
    add_res = add_res.get('data', add_res)
    member_id = add_res['id']
    print(f'[3] 添加成员成功: {member_id}')

    # 4. 验证成员列表
    members = request(f'/families/{family_id}/members', headers=headers)
    members = members.get('data', members)
    assert any(m['id'] == member_id for m in members), '新成员未在列表中'
    print(f'[4] 成员列表包含新成员，当前共 {len(members)} 人')

    # 5. 发起 AI 咨询（SSE）
    events = sse_post(
        '/consultations',
        {'query': '我有点头痛，应该怎么办？', 'familyId': family_id, 'memberId': member_id, 'inputType': 'text'},
        token,
    )
    done = next((e for e in events if e[0] == 'done'), None)
    consultation_id = done[1].get('consultationId') if done else None
    print(f'[5] AI 咨询完成，consultationId={consultation_id}')

    # 6. 查询历史
    history = request(f'/consultations/history?memberId={member_id}', headers=headers)
    history = history.get('data', history)
    items = history.get('items', [])
    assert any(i['id'] == consultation_id for i in items), '历史记录未找到'
    print(f'[6] 历史记录查询成功，共 {len(items)} 条')

    # 7. 检查本地 JSON 文件
    json_dir = os.path.join('nestjs', 'tmp', 'consultations', user_id, member_id)
    json_path = os.path.join(json_dir, f'{consultation_id}.json')
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            record = json.load(f)
        assert 'queryText' in record and 'responseText' in record
        print(f'[7] 本地 JSON 文件存在且完整: {json_path}')
        print(f'    queryText 长度: {len(record.get("queryText", ""))}')
        print(f'    responseText 长度: {len(record.get("responseText", ""))}')
    else:
        print(f'[7] 警告：本地 JSON 文件未找到: {json_path}')
        sys.exit(1)

    print('\n全部验证通过 ✅')


if __name__ == '__main__':
    main()
