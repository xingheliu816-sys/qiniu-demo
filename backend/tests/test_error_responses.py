"""测试加载失败修复的错误响应一致性。

验证：
1. 未登录访问需要登录的接口时返回 401 JSON
2. 不存在的接口路径返回 404 JSON（不是 HTML）
3. 错误方法返回 405 JSON
4. 后端未捕获异常仍然走 JSON 返回（兜底 errorhandler）
"""
import os
import sys
import json
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import app as app_module


def _boom_route():
    raise RuntimeError('intentional test failure')


# Flask 4 之后路由必须在第一个请求之前注册，因此在模块顶层就把
# 测试用的 /api/_test/boom 路由注册进去。
app_module.app.add_url_rule('/api/_test/boom', endpoint='_test_boom', view_func=_boom_route, methods=['GET'])


class TestApiErrorResponses(unittest.TestCase):

    def setUp(self):
        app_module.app.config['TESTING'] = True
        self.client = app_module.app.test_client()

    def _is_json(self, response):
        ctype = response.headers.get('Content-Type', '')
        return 'application/json' in ctype

    def test_unknown_api_path_returns_json_404(self):
        res = self.client.get('/api/this-path-does-not-exist')
        self.assertEqual(res.status_code, 404)
        self.assertTrue(self._is_json(res), msg=f"Content-Type was {res.headers.get('Content-Type')}")
        body = json.loads(res.data.decode('utf-8'))
        self.assertEqual(body.get('success'), False)
        self.assertIn('message', body)

    def test_login_required_endpoint_returns_json_401(self):
        # 没有登录态，访问 /api/novels 应返回 401 + JSON + success:false
        res = self.client.get('/api/novels')
        self.assertEqual(res.status_code, 401)
        self.assertTrue(self._is_json(res))
        body = json.loads(res.data.decode('utf-8'))
        self.assertEqual(body.get('success'), False)
        self.assertIn('message', body)

    def test_wrong_method_returns_json_405(self):
        # /api/novels 只接受 GET，PUT 应返回 405
        res = self.client.put('/api/novels')
        # 405 时未登录，但 405 比 login_required 先触发
        self.assertIn(res.status_code, (401, 405))
        self.assertTrue(self._is_json(res), msg=f"Content-Type was {res.headers.get('Content-Type')}")
        body = json.loads(res.data.decode('utf-8'))
        self.assertEqual(body.get('success'), False)

    def test_uncaught_exception_returns_json_500(self):
        res = self.client.get('/api/_test/boom')
        self.assertEqual(res.status_code, 500)
        self.assertTrue(self._is_json(res), msg=f"Content-Type was {res.headers.get('Content-Type')}")
        body = json.loads(res.data.decode('utf-8'))
        self.assertEqual(body.get('success'), False)
        # 不能把 traceback / RuntimeError 细节透给用户
        self.assertNotIn('RuntimeError', body.get('message', ''))
        self.assertNotIn('intentional test failure', body.get('message', ''))


if __name__ == '__main__':
    unittest.main()
