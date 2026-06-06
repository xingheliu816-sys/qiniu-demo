# Novel2Script AI

## 项目简介

Novel2Script AI 是一个小说转剧本 AI 工具。当前阶段实现了三大功能：**用户登录与小说导入章节识别**、**AI 小说提炼**（故事骨干 JSON 中间层）、**YAML Schema 规则库**（为后续 YAML 剧本草稿生成提供规则约束）。

用户可以通过创建小说项目，在项目内逐章管理章节内容（章节标题与正文绑定），支持单章编辑、单章识别、多章批量识别。完成章节识别后，可进一步使用 AI（DeepSeek）从已识别章节中提炼故事骨干（核心故事、角色、关键事件、戏剧冲突、改编风险等 25 个分区），结果以可编辑 JSON 中间层形式保存。YAML Schema 规则库提供系统默认模板及用户自定义 Schema 管理，为后续 YAML 剧本草稿生成做规则准备。

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
| PyYAML | YAML 格式解析与校验 | 后端 (`backend/`) |
| Next.js | React 全栈框架，App Router 路由 | 前端 (`frontend/`) |
| React | UI 组件框架 | 前端 (`frontend/`) |
| TypeScript | 类型安全的 JavaScript | 前端 (`frontend/`) |
| Tailwind CSS | 原子化 CSS 样式框架 | 前端 (`frontend/`) |
| concurrently | 同时启动前后端开发服务器 | 前端 (`frontend/`) |

功能 2「小说提炼」新增 `requests`（调用 DeepSeek Chat Completions API）；功能 3「YAML Schema 规则库」新增 `PyYAML`（YAML 格式校验）。

## 第三方 API / 服务说明

本项目功能 2「小说提炼」使用以下第三方 API：

| 名称 | 用途 | 使用位置 |
|------|------|---------|
| DeepSeek Chat Completions API (`deepseek-v4-flash`，OpenAI 兼容协议) | 从已识别章节的小说中提炼故事骨干：核心故事、角色、地点、关键事件、时间线、冲突、主题、改编风险等 25 个分区 | `backend/src/ai_client.py` |

- API Key 通过 `backend/config.py` 注入，`config.py` 已在 `.gitignore` 中，不会提交到仓库。参考 `backend/config.example.py` 配置。
- AI 客户端按 `config.AI_PROVIDER` 字段分派，目前支持 `deepseek` / `openai`（OpenAI 兼容）和 `gemini`（Google AI Studio），切换 provider / 模型只需改 `config.py` 的 4 行配置，不需要改动代码。

## 原创功能

本项目当前阶段原创功能包括：

### 功能 0 / 1：用户登录与小说导入章节管理

1. 用户注册、登录、退出登录基础流程
2. 基于登录状态的页面访问保护
3. 我的小说列表页
4. 当前用户小说项目列表展示
5. 创建新小说项目
6. 小说项目与当前登录用户绑定
7. 点击小说标题进入章节管理页面
8. 小说项目访问权限校验
9. 用户只能查看和操作自己的小说项目
10. 小说章节列表式管理：显示章节序号、标题、字数、提炼状态
11. 章节标题与章节正文绑定保存
12. 新增章节功能：自动生成章节序号和默认标题
13. 单章编辑页面：独立的章节标题输入框和正文输入框
14. 章节名称点击进入编辑（hover 下划线效果）
15. 删除独立编辑按钮，简化章节列表操作
16. 每章字数统计
17. 至少 10 字正文校验
18. 删除"三章不足"强制提示逻辑，不判断章节数量是否达到要求
19. 章节右侧"提炼"入口：自动执行识别前置逻辑后跳转 AI 提炼
20. 单章删除（二次确认）
21. 多选模式：勾选多个章节进行操作
22. 多选后对选中章节执行 AI 提炼
23. 多选后批量删除选中章节
24. 识别前置逻辑与 AI 提炼流程合并，用户不感知"识别"独立流程
25. 不再显示"识别成功"提示
26. 不再显示"三章不足"或"不符合提交要求"提示
27. 前端文案统一：已识别→已提炼，未识别→未提炼，识别失败→提炼失败
28. 用户章节权限隔离：每个用户只能查看、编辑、删除、提炼自己的章节
29. 单章提炼合并入口 `/api/chapters/<id>/extract`：自动保存章节标题/正文 → 识别前置 → 进入小说提炼
30. 多章提炼合并入口 `/api/novels/<id>/chapters/extract`：批量识别前置 → 进入小说提炼
31. 小说级提炼入口 `/api/novels/<id>/extract` 在无 parsed 章节时自动跑识别前置，确保用户从任意入口都能直接提炼
32. 提炼前置成功后自动推进 `novels.status` 到 `parsed`，让提炼页面识别"可提炼"状态
33. 章节列表"提炼"、章节编辑页"提炼当前章节"、多选"AI 提炼"三个入口统一跳转 `/novels/<id>/extraction`

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

### 功能 3：YAML Schema 规则库

41. YAML Schema 规则库设计：系统默认 Schema 与用户自定义 Schema 分类管理
42. 系统默认 Schema（小说提炼默认模板）：仅可查看与复制，不可编辑与删除
43. 用户 Schema 完全隔离：每个用户只能查看/编辑/删除自己的 Schema
44. Schema 新建页面：支持手动输入或上传 `.yaml` / `.json` / `.txt` 文件
45. Schema 编辑与删除：编辑保存时进行 YAML/JSON 格式校验，删除需二次确认
46. Schema 复制：支持从系统默认 Schema 或自有 Schema 复制为新 Schema
47. 用户默认 Schema 设置：通过 `user_schema_preferences` 偏好表存储
48. 侧边栏导航：全局统一侧边栏（我的小说 / 历史记录 / YAML Schema 规则库）

### 本次章节提炼结果编辑能力增强（本次新增）

43. 章节提炼结果独立存储，支持逐章保存提炼结果
44. 新增 `chapter_extractions` 表，与小说级提炼结果分离，避免相互覆盖
45. 章节提炼结果保存接口 `POST /api/chapters/<id>/extraction/save`，接收 JSONB 格式的提炼结果
46. 章节提炼结果与章节一一对应（UNIQUE 约束），多次保存自动覆盖
47. 章节提炼结果编辑页面增加保存按钮，保存后状态更新为编辑完成
48. 章节列表页新增每章提炼结果状态显示（已编辑 / 未编辑）
49. 章节提炼结果支持独立查看，不依赖小说级提炼页面
50. 章节提炼编辑保存时校验 JSONB 格式，格式错误返回明确提示
51. 章节提炼结果保存失败时保留前端编辑内容，不丢失用户输入
52. 章节提炼结果编辑与小说级提炼结果编辑互不干扰，各自独立

### 本次新增"查看小说整体提炼"入口（本次新增）

65. 小说详情页新增"查看整体提炼"入口按钮，状态自适应显示
66. 未提炼时显示"开始提炼"入口，已提炼时显示"查看提炼结果"
67. 提炼失败时显示"重新提炼"入口，保留上次失败原因提示
68. 整体提炼入口跳转到 `/novels/<id>/extraction` 页面
69. 与章节级提炼入口并行，用户可选择单章编辑或整体查看
70. 整体提炼入口权限隔离，只能查看当前用户小说的提炼结果
71. 提炼状态变化时（如单章保存后）整体入口状态同步更新

### 本次章节提炼查看错误修复（本次新增）

72. 修复提炼结果查看时页面空白问题，添加通用错误页面组件 `PageError.tsx`
73. 未登录访问提炼页面时重定向到登录页，不展示空白页面
74. API 请求失败时展示友好错误提示而非空白页面
75. 提炼结果 JSON 解析失败时兜底显示原始 JSON，不阻塞页面渲染
76. 修复 HTTP 错误响应一致性：401 / 404 / 405 / 500 均返回 JSON 格式
77. 未捕获异常兜底返回 JSON 错误响应，不暴露服务端内部细节
78. 新增错误响应测试覆盖，确保错误处理路径可靠

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

终端 2 — 启动前端（端口 3000）：

```bash
cd frontend
npm run dev
```

### 6. 访问

浏览器打开 `http://localhost:3000`，注册账号后即可使用。

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
│   │   ├── init.sql           # 数据库初始化脚本
│   │   └── migrate_chapter_extractions.sql  # 章节提炼结果表迁移
│   ├── src/
│   │   ├── __init__.py
│   │   ├── db.py              # Supabase 客户端封装
│   │   ├── auth.py            # 用户注册、登录、密码哈希
│   │   ├── chapter_parser.py  # 章节识别逻辑
│   │   ├── novel_service.py   # 小说项目服务
│   │   ├── record_service.py  # 数据保存与查询
│   │   ├── ai_client.py       # AI 客户端，provider 可切换
│   │   ├── extraction_service.py  # 小说提炼编排
│   │   ├── schema_service.py  # YAML Schema 规则库管理
│   │   └── html_cleaner.py    # 链接导入 HTML 清洗
│   └── tests/
│       ├── __init__.py
│       ├── test_chapter_parser.py         # 章节识别测试
│       ├── test_extraction_service.py     # 提炼解析与 prompt 测试
│       ├── test_html_cleaner.py           # HTML 清洗测试
│       ├── test_link_import_encoding.py   # 链接导入编码测试
│       └── test_error_responses.py        # 错误响应一致性测试
├── frontend/                  # Next.js 前端
│   ├── package.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/             # 登录页
│   │   │   ├── register/          # 注册页
│   │   │   ├── novels/            # 我的小说列表页
│   │   │   │   ├── ConfirmModal.tsx   # 删除确认弹窗
│   │   │   │   └── [id]/
│   │   │   │       ├── import/    # 小说导入与章节识别页
│   │   │   │       └── extraction/  # 小说提炼页与卡片编辑器
│   │   │   │           ├── page.tsx
│   │   │   │           ├── ExtractionCard.tsx
│   │   │   │           └── SourceRefDrawer.tsx
│   │   │   ├── history/           # 历史记录页
│   │   │   ├── schemas/           # YAML Schema 规则库
│   │   │   │   ├── page.tsx       # 列表页
│   │   │   │   ├── new/page.tsx   # 新建页
│   │   │   │   ├── [id]/page.tsx  # 详情页
│   │   │   │   └── [id]/edit/page.tsx  # 编辑页
│   │   │   ├── layout.tsx         # 根布局
│   │   │   ├── globals.css        # 全局样式
│   │   │   └── page.tsx           # 首页（自动跳转）
│   │   ├── components/
│   │   │   ├── Sidebar.tsx        # 全局侧边栏导航
│   │   │   └── PageError.tsx      # 通用错误页面组件
│   │   ├── context/
│   │   │   └── AuthContext.tsx    # 认证上下文
│   │   └── lib/
│   │       └── api.ts             # API 客户端封装（26 个导出函数）

└── package.json               # 根目录脚本（转发前后端命令）
```

## 页面路由

| 路由 | 说明 | 登录要求 |
|------|------|:------:|
| `/` | 首页，自动跳转到 `/novels` 或 `/login` | 否 |
| `/register` | 注册 | 否 |
| `/login` | 登录 | 否 |
| `/novels` | 我的小说列表页 | 是 |
| `/novels/[id]/import` | 小说章节管理页（章节列表） | 是 |
| `/novels/[id]/chapter/[chapterId]` | 章节编辑页 | 是 |
| `/novels/[id]/extraction` | 小说提炼页面 | 是 |
| `/history` | 我的导入与识别记录 | 是 |
| `/schemas` | YAML Schema 规则库列表 | 是 |
| `/schemas/new` | 新建 Schema | 是 |
| `/schemas/[id]` | Schema 详情页 | 是 |
| `/schemas/[id]/edit` | 编辑 Schema | 是 |

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
| GET  | `/api/novels/<id>/chapters` | 获取章节列表 |
| POST | `/api/novels/<id>/chapters` | 新增章节 |
| GET  | `/api/chapters/<id>` | 获取章节详情（含正文） |
| POST | `/api/chapters/<id>/save` | 保存章节标题与正文 |
| POST | `/api/chapters/<id>/parse` | 单章识别（合并入口的内部前置） |
| POST | `/api/chapters/<id>/extract` | 单章合并入口：保存 → 识别前置 → 进入小说提炼 |
| POST | `/api/chapters/<id>/delete` | 删除单章 |
| POST | `/api/chapters/<id>/extraction/save` | 保存章节提炼结果 |
| POST | `/api/novels/<id>/chapters/batch-parse` | 批量识别章节 |
| POST | `/api/novels/<id>/chapters/extract` | 多章合并入口：识别前置 → 进入小说提炼 |
| POST | `/api/novels/<id>/extract` | 触发小说提炼（无 parsed 章节时自动前置） |
| GET  | `/api/novels/<id>/extraction` | 获取提炼结果 |
| POST | `/api/novels/<id>/extraction/save` | 保存用户编辑后的提炼结果 |
| GET  | `/api/novels/<id>/source-ref` | 按 chapter_id + offset 取原文片段 |
| GET  | `/api/history` | 获取历史记录 |
| GET  | `/api/schemas` | 获取 Schema 列表（含系统默认 + 用户 Schema） |
| GET  | `/api/schemas/<id>` | 获取 Schema 详情 |
| POST | `/api/schemas/create` | 创建 Schema |
| POST | `/api/schemas/<id>/update` | 更新 Schema |
| POST | `/api/schemas/<id>/delete` | 删除 Schema |
| POST | `/api/schemas/<id>/copy` | 复制 Schema |
| POST | `/api/schemas/set-default` | 设置/取消用户的默认 Schema |

## 章节管理操作

1. 在章节列表中点击「新增章节」创建新章节
2. 点击章节名称进入章节编辑页面
3. 在编辑页面输入章节标题和正文
4. 点击「保存草稿」保存当前章节
5. 点击「提炼当前章节」或章节列表中的「提炼」按钮，自动执行识别前置逻辑并跳转 AI 提炼
6. 在多选模式勾选多个章节后点击「AI 提炼」或「删除」
7. 系统不再强制要求至少三章，不再提示三章不足

## 运行测试

```bash
cd backend
python -m unittest tests.test_chapter_parser tests.test_extraction_service tests.test_html_cleaner tests.test_link_import_encoding tests.test_error_responses -v
```

共 56 条测试：
- `test_chapter_parser`：16 条（章节识别、字数统计、内容校验）
- `test_extraction_service`：11 条（25 字段 schema、JSON 解析兜底、prompt 构造）
- `test_html_cleaner`：16 条（编码探测、正文抽取、chrome 清洗、VIP 检测、全链路）
- `test_link_import_encoding`：8 条（编码检测与解码）
- `test_error_responses`：5 条（401/404/405/500 JSON 错误响应）

## 演示视频

> 此项目为参赛作品。

演示视频链接：待补充（已上传至 bilibili 后更新此链接）

## 依赖列表

**后端（Python）：**

- Flask
- supabase
- requests
- PyYAML

**前端（Node.js）：**

- next / react / react-dom
- typescript
- tailwindcss / @tailwindcss/postcss
- eslint / eslint-config-next
- concurrently

## 原创功能与复用说明

- 原创内容：用户登录、小说项目管理、章节列表式管理（章节标题与正文绑定保存）、单章编辑、单章识别、批量识别、小说提炼流程、25 字段 JSON 中间层设计、AI 客户端封装、卡片编辑器、原文依据抽屉、YAML Schema 规则库（格式校验 / CRUD / 权限控制）、侧边栏导航、章节提炼结果独立存储、链接导入 HTML 清洗、通用错误页面组件等全部代码
- 复用内容：无

> 本次章节操作与提炼入口改造未新增第三方依赖。
> 本次提炼结果页面（下拉视图/自适应textarea/大元素折叠/小元素CRUD）、导入小说（文件/链接）改造未新增第三方依赖。
> 本次章节提炼结果编辑能力增强未新增第三方依赖。
> 本次章节提炼查看错误修复未新增第三方依赖。
> 本次新增"查看小说整体提炼"入口未新增第三方依赖。
