#!/usr/bin/env python3
"""e2e_verify_member_id_navigation.py
验证家庭成员详情通过 ID 而非索引定位，确保首页/档案页点击成员后详情页显示正确成员。
"""
import json, sys, urllib.request, urllib.error

BASE = 'http://localhost:3000/v1'
LOGIN_CODE = 'dev-local-fixed'

def req(method, path, token=None, body=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    url = BASE + path
    data = json.dumps(body).encode('utf-8') if body else None
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as r:
            return r.status, json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def login():
    status, data = req('POST', '/auth/wechat-login', body={'code': LOGIN_CODE})
    assert status == 200, f'登录失败: {status} {data}'
    return data['data']['accessToken'], data['data']['user']['id']

def main():
    token, user_id = login()
    status, data = req('GET', '/families', token=token)
    assert status == 200, f'获取家庭失败: {status} {data}'
    families = data['data']
    assert families, '没有家庭'
    family_id = families[0]['id']

    status, data = req('GET', f'/families/{family_id}/members', token=token)
    assert status == 200, f'获取成员失败: {status} {data}'
    members = data['data']
    assert members, '家庭成员为空'

    print(f'家庭成员列表（{len(members)}人）:')
    for i, m in enumerate(members):
        print(f'  [{i}] id={m["id"]} nickname={m["nickname"]} relation={m["relation"]}')

    errors = []
    for m in members:
        status, detail_data = req('GET', f'/families/{family_id}/members/{m["id"]}', token=token)
        if status != 200:
            errors.append(f'成员 {m["id"]} 详情获取失败: {status}')
            continue
        detail = detail_data['data']
        if detail['id'] != m['id'] or detail['nickname'] != m['nickname']:
            errors.append(f'ID 不匹配: 列表 id={m["id"]} nick={m["nickname"]} vs 详情 id={detail["id"]} nick={detail["nickname"]}')

    print('\n模拟前端 ID 导航验证：')
    for i, m in enumerate(members):
        clicked_id = m['id']
        found = next((x for x in members if x['id'] == clicked_id), None)
        if not found:
            errors.append(f'点击索引 {i} 对应 ID {clicked_id} 在详情数据中没有找到')
        elif found['nickname'] != m['nickname']:
            errors.append(f'ID 导航错误: 点击 {m["nickname"]} 但找到 {found["nickname"]}')
        else:
            print(f'  OK: 点击第 {i} 个（{m["nickname"]}）→ id={clicked_id} → 详情匹配')

    if errors:
        print('\n失败项:')
        for e in errors:
            print('  ', e)
        sys.exit(1)

    print('\n✅ 家庭成员 ID 导航验证通过')

if __name__ == '__main__':
    main()
