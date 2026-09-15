import json
import urllib.request
import urllib.error

BASE = 'http://localhost:3000'


def request(path, method='GET', body=None, headers=None):
    url = BASE + path
    h = headers or {}
    h['Content-Type'] = 'application/json'
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode('utf-8')
        return json.loads(raw) if raw else None


def main():
    # 1. 使用固定 dev code 登录
    login = request('/v1/auth/wechat-login', method='POST', body={'code': 'dev-local-fixed'})
    print('login:', login)
    data = login['data']
    token = data['accessToken']
    headers = {'Authorization': 'Bearer ' + token}

    # 2. 获取家庭（与前端一致使用 /v1/families，返回家庭对象，id 为真实 familyId）
    families = request('/v1/families', headers=headers)
    print('families:', families)
    family_list = families['data'] if isinstance(families, dict) else families
    if not family_list or not len(family_list):
        print('没有家庭，创建默认家庭')
        family = request('/v1/families', method='POST', body={'name': '我的家'}, headers=headers)
        family_id = family['data']['id']
    else:
        family_id = family_list[0]['id']

    # 3. 获取初始成员
    members_before = request('/v1/families/' + family_id + '/members', headers=headers)
    print('members_before count:', len(members_before) if isinstance(members_before, list) else 0)
    members_before_list = members_before['data'] if isinstance(members_before, dict) else members_before
    count_before = len(members_before_list) if isinstance(members_before_list, list) else 0

    # 4. 添加成员
    new_member = request('/v1/families/' + family_id + '/members', method='POST',
                         body={'nickname': '测试成员', 'relation': 'parent', 'gender': 1, 'age': 48},
                         headers=headers)
    print('new_member:', new_member)

    # 5. 再次获取成员（模拟 syncFromBackend）
    members_after = request('/v1/families/' + family_id + '/members', headers=headers)
    print('members_after:', members_after)
    members_after_list = members_after['data'] if isinstance(members_after, dict) else members_after
    count_after = len(members_after_list) if isinstance(members_after_list, list) else 0

    assert count_after == count_before + 1, f'添加成员失败：期望 {count_before + 1}，实际 {count_after}'
    print('PASS: 添加成员后同一 dev 用户能正确回显')


if __name__ == '__main__':
    main()
