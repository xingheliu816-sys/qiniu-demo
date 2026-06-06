# Novel2Script AI

## 项目简介

Novel2Script AI 是一个小说转剧本工具。当前阶段实现：用户登录、小说导入与章节识别、小说提炼（AI 辅助）。

用户可以通过粘贴正文或上传 `.txt` 文件导入小说，系统自动识别章节标题、统计字数，并将导入与识别记录保存到 Supabase 云数据库。完成章节识别后，可进一步使用 AI（DeepSeek）从已识别章节中提炼故事骨干（核心故事、角色、关键事件、戏剧冲突、改编风险等 25 个分区），结果以可编辑 JSON 中间层形式保存，为后续 YAML 剧本草稿生成做准备。

## 技术栈

```text
后端：Python + Flask（纯 API，不渲染页面）
数据库：Supabase（PostgreSQL）
前端：React + TypeScript + Next.js
架构：前后端分离
```

## 第三方依赖

| 依赖 | 用途 | 位置 |
|------|------|------|
| Flask | Web 服务、路由、API 接口、session 管理 | 后端 (`backend/`) |
| supabase | Supabase Python 客户端，连接与操作 PostgreSQL | 后端 (`backend/`) |
| requests | HTTP 客户端，调用 DeepSeek / Gemini API | 后端 (`backend/`) |
| Next.js | React 全栈框架，App Router 路由 | 前端 (`frontend/`) |
| React | UI 组件框架 | 前端 (`frontend/`) |
| TypeScript | 类型安全的 JavaScript | 前端 (`frontend/`) |
| Tailwind CSS | 原子化 CSS 样式框架 | 前端 (`frontend/`) |
| concurrently | 同时启动前后端开发服务器 | 前端 (`frontend/`) |

本次「小说提炼」功能新增的第三方依赖只有 `requests`（Python HTTP 客户端），用于调用 DeepSeek Chat Completions API。

## 第三方 API / 服务说明

本项目功能 2「小说提炼」使用以下第三方 API：

| 名称 | 用途 | 使用位置 |
|------|------|---------|
| DeepSeek Chat Completions API (`deepseek-v4-flash`，OpenAI 兼容协议) | 从已识别章节的小说中提炼故事骨干：核心故事、角色、地点、关键事件、时间线、冲突、主题、改编风险等 25 个分区 | `backend/src/ai_client.py` |

- API Key 通过 `backend/config.py` 注入，`config.py` 已在 `.gitignore` 中，不会提交到仓库。参考 `backend/config.example.py` 配置。
- AI 客户端按 `config.AI_PROVIDER` 字段分派，目前支持 `deepseek` / `openai`（OpenAI 兼容）和 `gemini`（Google AI Studio），切换 provider / 模型只需改 `config.py` 的 4 行配置，不需要改动代码。

## 原创功能

本项目当前阶段原创功能包括：

### 功能 0 / 1：登录与导入识别

1. 用户注册、登录、退出登录基础流程
2. 基于登录状态的页面访问保护
3. 我的小说列表页
4. 当前用户小说项目列表展示
5. 创建新小说项目
6. 小说项目与当前登录用户绑定
7. 点击小说标题进入导入与章节识别页面
8. 小说项目访问权限校验
9. 用户只能查看和操作自己的小说项目
10. 小说导入与章节识别流程
11. 小说章节自动识别逻辑
12. 支持常见章节标题格式识别
13. 支持序章、楔子、番外识别
14. 小说总字数统计
15. 每章字数统计
16. 至少 100 字正文校验
17. 章节数量识别与提示
18. 章节识别结果展示
19. 章节正文展开查看
20. 章节标题手动修改
21. 当前用户导入与识别记录保存
22. 章节输入框：用户可手动指定章节标题，识别时直接使用
23. `.txt` 上传自动识别：从文件名提取小说标题，从内容提取首章节标题

### 功能 2：小说提炼（本次新增）

24. 章节识别完成后可一键进入小说提炼流程
25. 小说提炼 JSON 中间层设计：25 个分区（事实层 / 戏剧层 / 改编层）
26. 核心故事、角色、地点、事件、时间线、人物关系、戏剧冲突、主题问题、改编风险等结构化提炼
27. 原文依据 `source_refs` 设计：chapter_id + start_offset + end_offset 可精确定位
28. 不确定项 `uncertain_items` 设计：替代 confidence 字段，明确表达 AI 不确定的内容
29. AI 客户端可切换 provider（DeepSeek / OpenAI 兼容 / Gemini），通过 config 切换不改代码
30. AI 原始结果 (`ai_result_json`) 与用户最终结果 (`user_result_json`) 分离保存
31. 提炼状态机：not_started / extracting / extracted / editing / confirmed / failed
32. AI 调用记录表 `ai_call_records`：保存 provider、model、请求 / 响应摘要、失败原因
33. 提炼结果卡片编辑器：25 张分区卡片，自适应 object / object 数组 / 字符串数组 / 字符串
34. 每张卡片支持表单视图 ↔ JSON 视图切换，便于编辑复杂字段
35. 原文依据查看抽屉：点击「查看依据」按钮打开右侧抽屉显示原文片段
36. 防误触设计：只让「查看依据」按钮可点击，整张卡片或行不可点击跳转
37. 小说列表页显示提炼状态与一键入口，文案根据状态自适应
38. 提炼失败可重试，重试覆盖 ai_result_json
39. parse_ai_response 兜底机制：JSON 直接解析 → Markdown 围栏剥离 → 平衡括号扫描 → 全空结构兜底
40. JSON 中间层为后续 YAML 剧本草稿生成预留数据基础

## 赛题方向

小说转剧本 AI 工具。

## 团队成员与分工

| 成员 | 分工 |
|------|------|
| @xingheliu816-sys | 开发 |

## 前置条件

- Python 3.8+
- Node.js 18+
- 一个 Supabase 项目（免费即可，PostgreSQL 数据库）

## 安装与启动

### 1. 创建 Supabase 项目

1. 前往 [supabase.com](https://supabase.com) 注册并创建一个项目
2. 在项目 Dashboard → **Project Settings → API** 中获取：
   - **Project URL**（即 `SUPABASE_URL`）
   - **service_role key**（即 `SUPABASE_SERVICE_KEY`，⚠️ 不要用 anon key）
3. 进入 **SQL Editor**，粘贴执行 `backend/sql/init.sql` 中的建表语句

### 2. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 3. 配置后端

```bash
cp config.example.py config.py
```

编辑 `config.py`，填入你的 Supabase 信息以及 AI API Key：

```python
SUPABASE_URL = "https://你的项目.supabase.co"
SUPABASE_SERVICE_KEY = "你的 service_role_key"

SECRET_KEY = "一个随机的密钥"

# AI 配置（功能 2 小说提炼）
AI_PROVIDER = "deepseek"                          # deepseek / openai / gemini
AI_MODEL_NAME = "deepseek-v4-flash"
AI_API_BASE = "https://api.deepseek.com/v1"
AI_API_KEY = "你的 DeepSeek API Key"
```

> 切换 provider / 模型只需改上面 4 行，不需要改动后端代码。
> 可通过以下命令生成随机 SECRET_KEY：
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

### 4. 安装前端依赖

```bash
cd frontend
npm install
```

### 5. 启动项目

本项目采用前后端分离架构，需要同时启动两个服务：

**方式一：一键启动（推荐）**

在项目根目录执行：

```bash
npm run dev
```

**方式二：分别启动**

终端 1 — 启动后端（端口 5000）：

```bash
cd backend
python app.py
```

> Windows 用户：若 `python app.py` 报 `exit code 9009`，是因为 PATH 中的 `python.exe` 是 Windows Store 占位符。请改用 `py app.py`（Python 启动器），或在「设置 → 应用 → 应用执行别名」中关闭 `python.exe` / `python3.exe` 的别名。`npm run dev` 已使用 `py`，无此问题。

终端 2 — 启动前端（端口 3000）：

```bash
cd frontend
npm run dev
```

### 6. 访问

浏览器打开 `http://localhost:3000`，注册账号后即可使用。

> 若启动时提示 `Port 3000 is in use` 或 `Another next dev server is already running`，是上一次 dev 未退干净留下的孤儿进程。在 Windows 终端中查 PID 并清理：
>
> ```bash
> netstat -ano | findstr :3000
> taskkill /PID <PID> /F
> ```
>
> 5000 端口同理。清理后重新 `npm run dev`。

## 项目结构

```text
├── README.md
├── docs/
│   └── usage-guide.md         # 详细使用指南
├── backend/                   # Flask API 后端
│   ├── app.py                 # Flask 应用入口，路由注册
│   ├── config.example.py      # 配置示例
│   ├── config.py              # 本地配置（不提交）
│   ├── requirements.txt       # Python 依赖
│   ├── sql/
│   │   └── init.sql           # 数据库初始化脚本
│   ├── src/
│   │   ├── __init__.py
│   │   ├── db.py              # Supabase 客户端封装
│   │   ├── auth.py            # 用户注册、登录、密码哈希
│   │   ├── chapter_parser.py  # 章节识别逻辑
│   │   ├── novel_service.py   # 小说项目服务
│   │   ├── record_service.py  # 数据保存与查询
│   │   ├── ai_client.py       # AI 客户端，provider 可切换
│   │   └── extraction_service.py  # 小说提炼编排
│   └── tests/
│       ├── __init__.py
│       ├── test_chapter_parser.py    # 章节识别测试
│       └── test_extraction_service.py  # 提炼解析与 prompt 测试
├── frontend/                  # Next.js 前端
│   ├── package.json
│   ├── src/app/
│   │   ├── login/             # 登录页
│   │   ├── register/          # 注册页
│   │   ├── novels/            # 我的小说列表页
│   │   │   ├── ConfirmModal.tsx
│   │   │   └── [id]/
│   │   │       ├── import/    # 小说导入与章节识别页
│   │   │       └── extraction/  # 小说提炼页与卡片编辑器
│   │   │           ├── page.tsx
│   │   │           ├── ExtractionCard.tsx
│   │   │           └── SourceRefDrawer.tsx
│   │   ├── history/           # 历史记录页
│   │   ├── layout.tsx         # 根布局
│   │   ├── globals.css        # 全局样式
│   │   └── page.tsx           # 首页（自动跳转）
│   ├── context/
│   │   └── AuthContext.tsx    # 认证上下文
│   └── lib/
│       └── api.ts             # API 客户端封装
└── package.json               # 根目录脚本（转发前后端命令）
```

## 页面路由

| 路由 | 说明 | 登录要求 |
|------|------|:------:|
| `/` | 首页，自动跳转到 `/novels` 或 `/login` | 否 |
| `/register` | 注册 | 否 |
| `/login` | 登录 | 否 |
| `/novels` | 我的小说列表页 | 是 |
| `/novels/[id]/import` | 小说导入与章节识别页面 | 是 |
| `/novels/[id]/extraction` | 小说提炼页面 | 是 |
| `/history` | 我的导入与识别记录 | 是 |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register` | 用户注册 |
| POST | `/api/login` | 用户登录 |
| POST | `/api/logout` | 退出登录 |
| GET  | `/api/session` | 获取当前会话 |
| GET  | `/api/novels` | 获取用户小说列表（含 extraction_status） |
| POST | `/api/novels/create` | 创建新小说项目 |
| GET  | `/api/novels/<id>` | 获取小说详情 |
| POST | `/api/novels/<id>/save` | 保存小说（标记为已保存） |
| DELETE | `/api/novels/<id>` | 删除小说 |
| POST | `/api/parse-chapters` | 章节识别 |
| POST | `/api/chapters/update-title` | 修改章节标题 |
| POST | `/api/novels/<id>/extract` | 触发小说提炼（调用 AI） |
| GET  | `/api/novels/<id>/extraction` | 获取提炼结果 |
| POST | `/api/novels/<id>/extraction/save` | 保存用户编辑后的提炼结果 |
| GET  | `/api/novels/<id>/source-ref` | 按 chapter_id + offset 取原文片段 |
| GET  | `/api/history` | 获取历史记录 |

## 章节识别支持格式

- `第一章` / `第二章` / `第三章`
- `第1章` / `第2章` / `第3章`
- `第001章` / `第002章`
- `Chapter 1` / `Chapter 2`
- `序章` / `楔子` / `番外`

## 运行测试

```bash
cd backend
python -m unittest tests.test_chapter_parser tests.test_extraction_service -v
```

共 27 条测试：
- `test_chapter_parser`：16 条（章节识别、字数统计、内容校验）
- `test_extraction_service`：11 条（25 字段 schema、JSON 解析兜底、prompt 构造）

## 演示视频

> ⚠️ 此项目为参赛作品，演示视频需上传至 bilibili 或其他可公开访问平台，并在 README 中提供可播放链接。

演示视频链接：待补充

## 依赖列表

**后端（Python）：**

- Flask
- supabase
- requests

**前端（Node.js）：**

- next
- react / react-dom
- typescript
- tailwindcss / @tailwindcss/postcss
- concurrently

## 原创功能与复用说明

- 原创内容：用户登录、小说导入、章节识别、字数统计、记录保存、小说提炼流程、25 字段 JSON 中间层设计、AI 客户端封装、卡片编辑器、原文依据抽屉等全部代码
- 复用内容：无
