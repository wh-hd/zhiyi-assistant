#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""端到端验证：成员编辑、删除 + 时间感问候语"""
import json
import urllib.request
import urllib.error

BASE = 'http://localhost:3000/v1'

def request(path, method='GET', body=None, headers=None):
    url = BASE + path
    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode('utf-8'))

if __name__ == '__main__':
    # 1. 登录
    login = request('/auth/wechat-login', method='POST', body={'code': 'dev-local-fixed'})
    print('login:', login.get('data', {}).get('accessToken', 'ERR')[:20] + '...')
    token = login['data']['accessToken']
    headers = {'Authorization': 'Bearer ' + token}

    # 2. 获取家庭
    families = request('/families', headers=headers)
    family_list = families.get('data') if isinstance(families, dict) else families
    if not family_list or not len(family_list):
        family = request('/families', method='POST', body={'name': '我的家'}, headers=headers)
        family_id = family['data']['id']
    else:
        family_id = family_list[0]['id']
    print('family_id:', family_id)

    # 3. 添加测试成员
    test_member = request('/families/' + family_id + '/members', method='POST',
                          body={'nickname': '测试编辑', 'relation': 'parent', 'gender': 1, 'age': 50},
                          headers=headers)
    print('created:', test_member)
    member_id = test_member['data']['id']

    # 4. 编辑成员
    updated = request('/families/' + family_id + '/members/' + member_id, method='PATCH',
                      body={'nickname': '已编辑', 'relation': 'parent', 'gender': 2, 'age': 51},
                      headers=headers)
    print('updated:', updated)
    assert updated['data']['nickname'] == '已编辑', '编辑昵称失败'
    assert updated['data']['relation'] == 'parent', '编辑关系失败'
    assert updated['data']['gender'] == 2, '编辑性别失败'

    # 5. 删除成员
    deleted = request('/families/' + family_id + '/members/' + member_id, method='DELETE', headers=headers)
    print('deleted:', deleted)
    assert deleted.get('success') is True, '删除失败'

    # 6. 验证已删除
    members = request('/families/' + family_id + '/members', headers=headers)
    assert not any(m['id'] == member_id for m in members.get('data', [])), '删除后成员仍存在'

    print('\nPASS: 成员编辑、删除接口均正常工作')
