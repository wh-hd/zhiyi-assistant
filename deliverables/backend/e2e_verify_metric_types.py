"""
验证指标记录新增类型：体脂率、体温、血氧，以及血糖按空腹/餐后分类。
"""
import json, sys, urllib.request, urllib.error

BASE = 'http://localhost:3000/v1'
LOGIN_CODE = 'dev-local-fixed'

def req(method, path, token=None, body=None):
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = f'Bearer {token}'
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

def ensure_member(token, user_id):
    status, data = req('GET', '/families', token=token)
    assert status == 200, f'获取家庭失败: {status} {data}'
    families = data['data']
    assert families, '没有家庭'
    family_id = families[0]['id']

    status, data = req('GET', f'/families/{family_id}/members', token=token)
    assert status == 200, f'获取成员失败: {status} {data}'
    members = data['data']
    if members:
        return family_id, members[0]['id']

    # 添加测试成员
    status, data = req('POST', f'/families/{family_id}/members', token=token, body={
        'nickname': '测试成员', 'relation': 'child', 'age': 30, 'gender': 1
    })
    assert status == 201, f'添加成员失败: {status} {data}'
    return family_id, data['data']['id']

def record_metric(token, member_id, metric_type, value, unit, notes=None):
    status, data = req('POST', '/metrics', token=token, body={
        'memberId': member_id,
        'metricType': metric_type,
        'value': value,
        'unit': unit,
        'notes': notes or '测试记录',
        'inputMethod': 'manual',
    })
    assert status == 201, f'记录 {metric_type} 失败: {status} {data}'
    return data['data']

def verify_metric_list(token, member_id, expected_type):
    status, data = req('GET', f'/metrics?memberId={member_id}&type={expected_type}', token=token)
    assert status == 200, f'获取 {expected_type} 列表失败: {status} {data}'
    items = data['data']
    assert isinstance(items, list) and len(items) > 0, f'{expected_type} 未找到记录'
    assert items[0]['metricType'] == expected_type, f'类型不匹配: {items[0]["metricType"]} != {expected_type}'

if __name__ == '__main__':
    token, user_id = login()
    family_id, member_id = ensure_member(token, user_id)
    print(f'[OK] 登录成功，成员: {member_id}')

    # 记录各种指标
    record_metric(token, member_id, 'body_fat', 22.5, '%')
    print('[OK] 体脂率记录成功')

    record_metric(token, member_id, 'temperature', 36.6, '°C')
    print('[OK] 体温记录成功')

    record_metric(token, member_id, 'spo2', 98, '%')
    print('[OK] 血氧记录成功')

    record_metric(token, member_id, 'blood_glucose_fasting', 5.4, 'mmol/L')
    print('[OK] 空腹血糖记录成功')

    record_metric(token, member_id, 'blood_glucose_postprandial', 6.8, 'mmol/L')
    print('[OK] 餐后血糖记录成功')

    # 验证列表能读取
    verify_metric_list(token, member_id, 'body_fat')
    verify_metric_list(token, member_id, 'temperature')
    verify_metric_list(token, member_id, 'spo2')
    verify_metric_list(token, member_id, 'blood_glucose_fasting')
    verify_metric_list(token, member_id, 'blood_glucose_postprandial')
    print('[OK] 所有指标类型验证通过')
