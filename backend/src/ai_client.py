import json
import time
import requests
import config

TASK_TYPE = "novel_extraction"


def get_provider():
    return getattr(config, "AI_PROVIDER", "deepseek").lower()


def get_model_name():
    return getattr(config, "AI_MODEL_NAME", "deepseek-chat")


def get_api_base():
    return getattr(config, "AI_API_BASE", "https://api.deepseek.com/v1")


def call_ai(prompt, timeout=120, max_retries=2):
    provider = get_provider()
    if provider == "gemini":
        return _call_gemini(prompt, timeout, max_retries)
    return _call_openai_compatible(prompt, timeout, max_retries)


def _call_openai_compatible(prompt, timeout, max_retries):
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
            {"role": "system", "content": "你是资深小说改编顾问，擅长从小说中提炼角色、关系、关键事件、戏剧冲突、伏笔、世界观规则等结构化信息。请严格按用户要求输出合法 JSON，不要添加任何解释或 Markdown 围栏。宁可让数组只有 1-2 项，也不要为了凑数编造原文里没有的情节。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 8000,
        "response_format": {"type": "json_object"},
    }

    last_error = ""
    last_summary = ""
    for attempt in range(max_retries + 1):
        try:
            resp = requests.post(url, headers=headers, json=body, timeout=timeout)
        except requests.RequestException as e:
            last_error = f"AI 请求异常: {e}"
            last_summary = ""
            if attempt < max_retries:
                time.sleep(2)
                continue
            return False, last_error, last_summary

        if resp.status_code == 200:
            try:
                data = resp.json()
            except ValueError:
                last_error = "AI 返回非 JSON 响应"
                last_summary = (resp.text or "")[:500]
                continue
            choices = data.get("choices") or []
            text = ""
            if choices:
                text = (choices[0].get("message") or {}).get("content", "")
            if not text:
                text = choices[0].get("text", "") if choices else ""
            if text:
                return True, text.strip(), (resp.text or "")[:500]
            last_error = "AI 返回内容为空"
            last_summary = json.dumps(data)[:500]
        elif resp.status_code in (429, 502, 503, 504):
            # 频率限制或服务临时不可用 → 等一会重试
            last_error = f"AI 服务繁忙 HTTP {resp.status_code}"
            last_summary = (resp.text or "")[:500]
            if attempt < max_retries:
                time.sleep(3)
                continue
        else:
            last_error = f"AI 调用失败 HTTP {resp.status_code}: {resp.text[:300]}"
            last_summary = (resp.text or "")[:500]
            break  # 4xx 认证/参数错误不重试

    return False, last_error, last_summary


def _call_gemini(prompt, timeout, max_retries):
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
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 8000},
    }

    last_error = ""
    last_summary = ""
    for attempt in range(max_retries + 1):
        try:
            resp = requests.post(url, headers=headers, json=body, timeout=timeout)
        except requests.RequestException as e:
            last_error = f"AI 请求异常: {e}"
            if attempt < max_retries:
                time.sleep(2)
                continue
            return False, last_error, ""

        if resp.status_code != 200:
            last_error = f"AI 调用失败 HTTP {resp.status_code}: {resp.text[:300]}"
            last_summary = (resp.text or "")[:500]
            if resp.status_code in (429, 502, 503, 504) and attempt < max_retries:
                time.sleep(3)
                continue
            break

        try:
            data = resp.json()
        except ValueError:
            return False, "AI 返回非 JSON 响应", (resp.text or "")[:500]

        candidates = data.get("candidates") or []
        text = ""
        if candidates:
            parts = (candidates[0].get("content") or {}).get("parts") or []
            if parts:
                text = parts[0].get("text", "")
        if text:
            return True, text.strip(), (resp.text or "")[:500]
        last_error = "AI 返回内容为空"
        last_summary = json.dumps(data)[:500]

    return False, last_error, last_summary
