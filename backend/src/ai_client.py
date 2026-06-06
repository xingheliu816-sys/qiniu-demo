import json
import requests
import config

TASK_TYPE = "novel_extraction"


def get_provider():
    return getattr(config, "AI_PROVIDER", "deepseek").lower()


def get_model_name():
    return getattr(config, "AI_MODEL_NAME", "deepseek-v4-flash")


def get_api_base():
    return getattr(config, "AI_API_BASE", "https://api.deepseek.com/v1")


def call_ai(prompt, timeout=120):
    provider = get_provider()
    if provider == "gemini":
        return _call_gemini(prompt, timeout)
    return _call_openai_compatible(prompt, timeout)


def _call_openai_compatible(prompt, timeout):
    api_key = getattr(config, "AI_API_KEY", "")
    if not api_key:
        return False, "未配置 AI_API_KEY，请在 backend/config.py 中填入。", ""

    url = f"{get_api_base().rstrip('/')}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    body = {
        "model": get_model_name(),
        "messages": [
            {"role": "system", "content": "你是资深小说改编顾问。请严格按用户要求输出合法 JSON，不要添加任何解释或 Markdown 围栏。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "max_tokens": 8192,
        "response_format": {"type": "json_object"},
    }
    try:
        resp = requests.post(url, headers=headers, json=body, timeout=timeout)
    except requests.RequestException as e:
        return False, f"AI 请求异常: {e}", ""

    response_summary = (resp.text or "")[:500]
    if resp.status_code != 200:
        return False, f"AI 调用失败 HTTP {resp.status_code}: {resp.text[:300]}", response_summary

    try:
        data = resp.json()
    except ValueError:
        return False, "AI 返回非 JSON 响应", response_summary

    choices = data.get("choices") or []
    text = ""
    if choices:
        text = (choices[0].get("message") or {}).get("content", "")
    if not text:
        return False, "AI 返回内容为空", json.dumps(data)[:500]
    return True, text, response_summary


def _call_gemini(prompt, timeout):
    api_key = getattr(config, "AI_API_KEY", "")
    if not api_key:
        return False, "未配置 AI_API_KEY，请在 backend/config.py 中填入。", ""

    url = f"{get_api_base().rstrip('/')}/models/{get_model_name()}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key,
    }
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 8192},
    }
    try:
        resp = requests.post(url, headers=headers, json=body, timeout=timeout)
    except requests.RequestException as e:
        return False, f"AI 请求异常: {e}", ""

    response_summary = (resp.text or "")[:500]
    if resp.status_code != 200:
        return False, f"AI 调用失败 HTTP {resp.status_code}: {resp.text[:300]}", response_summary

    try:
        data = resp.json()
    except ValueError:
        return False, "AI 返回非 JSON 响应", response_summary

    candidates = data.get("candidates") or []
    text = ""
    if candidates:
        parts = (candidates[0].get("content") or {}).get("parts") or []
        if parts:
            text = parts[0].get("text", "")
    if not text:
        return False, "AI 返回内容为空", json.dumps(data)[:500]
    return True, text, response_summary
