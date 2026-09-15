"""
验证指标看板新功能：
1. 扩展指标类型可正常记录（BMI、步数、睡眠、压力）
2. 指标趋势接口返回 series 和 summary
3. 批量血压记录后，查询血压列表正常
"""
import requests, sys, json

BASE = 'http://localhost:3000/v1'
LOGIN_CODE = 'dev-local-fixed'

def req(method, path, body=None, token=None):
    url = BASE + path
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = f'Bearer {token}'
    r = requests.request(method, url, json=body, headers=headers, timeout=30)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, r.text

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

    status, data = req('POST', f'/families/{family_id}/members', token=token, body={
        'nickname': '测试成员', 'relation': 'child', 'age': 30, 'gender': 1
    })
    assert status == 201, f'添加成员失败: {status} {data}'
    return family_id, data['data']['id']

def record_metric(token, member_id, metric_type, value, unit):
    status, data = req('POST', '/metrics', token=token, body={
        'memberId': member_id,
        'metricType': metric_type,
        'value': value,
        'unit': unit,
        'inputMethod': 'manual',
    })
    assert status == 201, f'记录 {metric_type} 失败: {status} {data}'
    return data['data']

def record_bp_batch(token, member_id, sys, dia):
    status, data = req('POST', '/metrics/batch', token=token, body={
        'memberId': member_id,
        'metrics': [
            {'metricType': 'blood_pressure_systolic', 'value': sys, 'unit': 'mmHg', 'inputMethod': 'manual'},
            {'metricType': 'blood_pressure_diastolic', 'value': dia, 'unit': 'mmHg', 'inputMethod': 'manual'},
        ],
    })
    assert status == 201, f'批量血压失败: {status} {data}'

if __name__ == '__main__':
    token, user_id = login()
    family_id, member_id = ensure_member(token, user_id)
    print(f'[OK] 登录成功，成员: {member_id}')

    # 记录多种新指标
    record_metric(token, member_id, 'bmi', 22.5, '')
    record_metric(token, member_id, 'steps', 8500, '步')
    record_metric(token, member_id, 'sleep', 7.5, '小时')
    record_metric(token, member_id, 'stress', 45, '分')
    print('[OK] 新指标 BMI/步数/睡眠/压力 记录成功')

    # 血压批量
    record_bp_batch(token, member_id, 128, 82)
    record_bp_batch(token, member_id, 125, 80)
    print('[OK] 批量血压记录成功')

    # 验证列表
    for t in ['bmi', 'steps', 'sleep', 'stress', 'blood_pressure_systolic']:
        status, data = req('GET', f'/metrics?memberId={member_id}&type={t}', token=token)
        assert status == 200, f'获取 {t} 列表失败: {status} {data}'
        items = data['data']
        assert isinstance(items, list) and len(items) > 0, f'{t} 没有记录'
        assert items[0]['metricType'] == t, f'{t} 类型不匹配'
    print('[OK] 所有指标列表查询成功')

    # 验证趋势
    for t in ['blood_pressure_systolic', 'bmi', 'steps']:
        status, data = req('GET', f'/metrics/trend?memberId={member_id}&type={t}&days=30', token=token)
        assert status == 200, f'获取 {t} 趋势失败: {status} {data}'
        assert 'series' in data['data'], f'{t} 趋势缺少 series'
        assert len(data['data']['series']) > 0, f'{t} 趋势 series 为空'
        assert 'summary' in data['data'], f'{t} 趋势缺少 summary'
    print('[OK] 指标趋势接口返回正常')

    print('[OK] 指标看板功能验证全部通过')
