#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智医助手 后端 API 性能基准测试
场景：模拟登录后高并发读取家庭成员（AI 咨询页核心路径）
"""
import concurrent.futures
import json
import statistics
import time
import urllib.request
import urllib.error

BASE = 'http://localhost:3000'
LOGIN_BODY = json.dumps({'code': 'dev-local-fixed'}).encode('utf-8')
CONCURRENCY_LEVELS = [1, 5, 10, 20]
REQUESTS_PER_LEVEL = 30


def login():
    req = urllib.request.Request(
        f'{BASE}/v1/auth/wechat-login',
        data=LOGIN_BODY,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode('utf-8'))
        return data['data']['accessToken']


def fetch_members(token, family_id):
    start = time.perf_counter()
    req = urllib.request.Request(
        f'{BASE}/v1/families/{family_id}/members',
        headers={'Authorization': f'Bearer {token}'},
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        body = res.read().decode('utf-8')
        elapsed_ms = (time.perf_counter() - start) * 1000
        data = json.loads(body)
        members = data.get('data', data) if isinstance(data, dict) else data
        return elapsed_ms, len(members)


def get_or_create_family(token):
    req = urllib.request.Request(
        f'{BASE}/v1/users/me/families',
        headers={'Authorization': f'Bearer {token}'},
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode('utf-8'))
        families = data.get('data', data) if isinstance(data, dict) else data
        if families and len(families):
            # 选择用户实际有成员的家庭；若没有成员，创建新家庭避免 403
            for f in families:
                if f.get('memberCount', 0) > 0 or (f.get('members') and len(f['members'])):
                    return f['id']
        # 无家庭则创建
        create_req = urllib.request.Request(
            f'{BASE}/v1/families',
            data=json.dumps({'name': '性能测试家庭'}).encode('utf-8'),
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(create_req, timeout=30) as cres:
            cdata = json.loads(cres.read().decode('utf-8'))
            return cdata.get('data', cdata)['id']


def run_level(token, family_id, concurrency, count):
    latencies = []
    errors = 0

    def task(_):
        try:
            ms, n = fetch_members(token, family_id)
            return ms, n, None
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8') if e else ''
            return None, 0, f'HTTP {e.code}: {body[:200]}'
        except Exception as e:
            return None, 0, str(e)

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as ex:
        results = list(ex.map(task, range(count)))

    for ms, n, err in results:
        if err:
            errors += 1
        else:
            latencies.append(ms)

    return latencies, errors


def main():
    print('[bench] 登录获取 token...')
    token = login()
    print('[bench] 获取家庭...')
    family_id = get_or_create_family(token)
    print(f'[bench] family_id={family_id}')

    print('\n并发级别 | 总请求 | 成功 | 失败 | min(ms) | p50(ms) | p95(ms) | max(ms) | avg(ms) | rps')
    print('-' * 100)
    for concurrency in CONCURRENCY_LEVELS:
        latencies, errors = run_level(token, family_id, concurrency, REQUESTS_PER_LEVEL)
        total_time = sum(latencies) / 1000 if latencies else 0
        rps = len(latencies) / total_time if total_time > 0 else 0
        if latencies:
            latencies.sort()
            p50 = latencies[len(latencies) // 2]
            p95 = latencies[int(len(latencies) * 0.95)]
            avg = statistics.mean(latencies)
            print(f'{concurrency:8} | {REQUESTS_PER_LEVEL:6} | {len(latencies):6} | {errors:4} | '
                  f'{min(latencies):7.1f} | {p50:7.1f} | {p95:7.1f} | {max(latencies):7.1f} | {avg:7.1f} | {rps:.1f}')
        else:
            print(f'{concurrency:8} | {REQUESTS_PER_LEVEL:6} | 0      | {errors:4} | 全部失败')


if __name__ == '__main__':
    main()
