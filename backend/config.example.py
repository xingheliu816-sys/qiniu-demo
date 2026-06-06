# Supabase 配置
SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co"
SUPABASE_SERVICE_KEY = "你的 Supabase service_role key（非 anon key）"

SECRET_KEY = "replace_this_with_a_random_secret_key"

# AI 配置（功能 2 小说提炼）
# AI_PROVIDER: "deepseek" / "openai" 走 OpenAI 兼容接口，"gemini" 走 Google AI Studio
# 切换模型 / provider 只需改下方 4 行，不需要动代码
AI_PROVIDER = "deepseek"
AI_MODEL_NAME = "deepseek-v4-flash"
AI_API_BASE = "https://api.deepseek.com/v1"
AI_API_KEY = "你的 API Key"
