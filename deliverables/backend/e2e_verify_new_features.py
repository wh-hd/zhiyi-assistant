#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""端到端验证：健康状况自定义疾病、家庭成员统计、自评历史"""
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
    # 1. 登录（复用开发身份避免新建用户）
    login = request('/auth/wechat-login', method='POST', body={'code': 'dev-local-fixed'})
    print('login:', login.get('data', {}).get('accessToken', 'ERR')[:20] + '...')
    token = login['data']['accessToken']
    headers = {'Authorization': 'Bearer ' + token}
    user_id = login['data']['user']['id']

    # 2. 获取或创建家庭
    families = request('/families', headers=headers)
    family_list = families.get('data') if isinstance(families, dict) else families
    if not family_list or not len(family_list):
        family = request('/families', method='POST', body={'name': '我的家'}, headers=headers)
        family_id = family['data']['id']
    else:
        family_id = family_list[0]['id']
    print('family_id:', family_id)

    # 3. 记录初始成员数
    members_before = request('/families/' + family_id + '/members', headers=headers)
    members_before_list = members_before.get('data', []) if isinstance(members_before, dict) else members_before
    initial_count = len(members_before_list)
    print('initial members:', initial_count)

    # 4. 添加测试成员（带自定义疾病）
    test_member = request('/families/' + family_id + '/members', method='POST',
                          body={'nickname': '测试自定义病', 'relation': 'parent', 'gender': 1, 'age': 55},
                          headers=headers)
    print('created:', test_member)
    member_id = test_member['data']['id']

    # 5. 更新慢性疾病（字符串数组，模拟前端自定义疾病）
    chronic = request('/health-records/' + member_id + '/chronic-diseases', method='PATCH',
                      body={'diseases': ['高血压', '慢性胃炎', '颈椎病']},
                      headers=headers)
    print('chronic updated:', chronic)
    assert chronic.get('data', {}).get('chronicDiseases') is not None, '慢病更新未返回档案'

    # 6. 验证档案中疾病正确保存
    record = request('/health-records/' + member_id, headers=headers)
    diseases = json.loads(record['data']['chronicDiseases'])
    print('saved diseases:', diseases)
    assert '慢性胃炎' in diseases, '自定义疾病未保存'
    assert '颈椎病' in diseases, '自定义疾病未保存'

    # 7. 验证编辑成员时慢性疾病可被替换（全量替换）
    chronic2 = request('/health-records/' + member_id + '/chronic-diseases', method='PATCH',
                       body={'diseases': ['糖尿病']},
                       headers=headers)
    diseases2 = json.loads(chronic2['data']['chronicDiseases'])
    print('replaced diseases:', diseases2)
    assert diseases2 == ['糖尿病'], '慢病全量替换失败'

    # 8. 验证家庭成员数增加
    members_after = request('/families/' + family_id + '/members', headers=headers)
    members_after_list = members_after.get('data', []) if isinstance(members_after, dict) else members_after
    print('members after add:', len(members_after_list))
    assert len(members_after_list) == initial_count + 1, '添加成员后家庭成员数未增加'

    # 9. 验证自评历史接口（如果成员无历史则返回空列表）
    history = request('/assessments/history?memberId=' + member_id + '&page=1&pageSize=10', headers=headers)
    print('assess history:', history)
    assert 'items' in history.get('data', {}), '自评历史接口未返回 items'
    assert 'pagination' in history.get('data', {}), '自评历史接口未返回 pagination'

    # 10. 完成一次自评并检查历史
    start = request('/assessments/start', method='POST',
                    body={'memberId': member_id, 'type': 'initial', 'questionCount': 6},
                    headers=headers)
    session = start['data']
    print('assess session:', session.get('sessionId'))
    session_id = session['sessionId']
    total_steps = session['totalSteps']

    # 顺序提交每一步答案（每步可能有多题）
    current_step = session['currentStep']
    while True:
        questions = session['questions']
        answers = {}
        for q in questions:
            if q['type'] == 'multiple':
                answers[q['id']] = [q['options'][0]['value']]
            else:
                answers[q['id']] = q['options'][0]['value']
        submit = request('/assessments/answer', method='POST',
                         body={'sessionId': session_id, 'step': current_step, 'answers': answers},
                         headers=headers)
        print('submit step', current_step, 'status', submit.get('status'))
        if submit.get('data') and 'categoryScores' in submit.get('data', {}):
            # 已完成
            break
        session = submit['data']
        current_step = session['currentStep']

    # 11. 再次查询历史，应至少有一条
    history2 = request('/assessments/history?memberId=' + member_id + '&page=1&pageSize=10', headers=headers)
    items = history2['data']['items']
    print('assess history after complete:', len(items))
    assert len(items) >= 1, '自评完成后历史记录未增加'

    # 12. 查询结果详情
    result = request('/assessments/' + session_id + '/result', headers=headers)
    print('assess result:', result['data'].get('totalScore'))
    assert 'totalScore' in result['data'], '自评结果详情缺失 totalScore'

    # 13. 清理测试成员
    deleted = request('/families/' + family_id + '/members/' + member_id, method='DELETE', headers=headers)
    print('deleted:', deleted)

    print('\nPASS: 健康状况自定义疾病、家庭成员统计、自评历史功能均正常')
