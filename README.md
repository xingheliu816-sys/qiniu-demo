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
| PyYAML | YAML 格式解析与序列化（`yaml.dump` / `yaml.safe_load`） | 后端 (`backend/`) |
| jsonschema | JSON Schema 校验，用于严格 YAML 生成工具链中的结构校验 | 后端 (`backend/`) |
| Next.js | React 全栈框架，App Router 路由 | 前端 (`frontend/`) |
| React | UI 组件框架 | 前端 (`frontend/`) |
| TypeScript | 类型安全的 JavaScript | 前端 (`frontend/`) |
| Tailwind CSS | 原子化 CSS 样式框架 | 前端 (`frontend/`) |
| cytoscape | 关系图谱可视化渲染（关系图谱功能） | 前端 (`frontend/`) |
| js-yaml | YAML 解析（YAML 编辑器右侧结构预览） | 前端 (`frontend/`) |
| concurrently | 同时启动前后端开发服务器 | 前端 (`frontend/`) |

功能 2「小说提炼」新增 `requests`（调用 DeepSeek Chat Completions API）；功能 3「YAML Schema 规则库」新增 `PyYAML`（YAML 格式校验）；功能 4「YAML 剧本生成」严格 JSON-first 工具链改造新增 `jsonschema`（JSON Schema 校验）——`PyYAML` 仍复用，但现在用于把 AI 返回的 JSON 对象序列化为 YAML，不再直接解析 AI 输出的 YAML 文本。

## 第三方 API / 服务说明

本项目功能 2「小说提炼」使用以下第三方 API：

| 名称 | 用途 | 使用位置 |
|------|------|---------|
| DeepSeek Chat Completions API (`deepseek-v4-flash`，OpenAI 兼容协议) | 从已识别章节的小说中提炼故事骨干：核心故事、角色、地点、关键事件、时间线、冲突、主题、改编风险等 25 个分区 | `backend/src/ai_client.py` |

- API Key 通过 `backend/config.py` 注入，`config.py` 已在 `.gitignore` 中，不会提交到仓库。参考 `backend/config.example.py` 配置。
- AI 客户端按 `config.AI_PROVIDER` 字段分派，目前支持 `deepseek` / `openai`（OpenAI 兼容）和 `gemini`（Google AI Studio），切换 provider / 模型只需改 `config.py` 的 4 行配置，不需要改动代码。
- YAML 剧本生成功能使用 DeepSeek API 根据小说提炼结果和 YAML Schema 生成 YAML 剧本草稿。DeepSeek API 仅作为文本理解与生成能力提供方，小说提炼结果转 YAML、Schema 约束生成、YAML 校验、自动修复、多版本保存、数据库与文件持久化均为本项目原创实现。

## 原创功能

本项目最终成品为结构化 YAML 剧本文件（.yaml / .yml），内容来自 YAML 编辑器左侧 YAML 原文。右侧卡片预览仅用于可视化检查，不参与导出。导出的 YAML 文件保存在 `backend/data/yaml_exports/` 目录下，同时数据库 `yaml_exports` 表保存文件路径和导出记录。

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
48. 侧边栏导航：全局统一侧边栏（我的小说 / 历史记录 / 查看提炼内容 / YAML 剧本 / YAML 编辑器 / YAML Schema 规则库）
49. 章节提炼结果后台持久化到 `chapter_extractions` 表
50. 小说整体提炼结果后台持久化到 `novel_extractions` 表
51. 查看提炼内容只读取已保存结果，不调用 AI
52. 左侧状态栏"查看提炼内容"入口，统一查看小说整体 + 章节提炼
53. 提炼结果优先展示用户修改版（user_result_json），未修改时展示 AI 原版
54. 提炼状态统计（已提炼/未提炼/提炼失败）来自后端保存状态
55. 提炼页面支持查看模式（只读）与编辑模式（可编辑保存）
56. 三章及以上小说自动启用两阶段提炼（先逐章扫描再全局合成）
57. 从小说整体提炼结果映射章节提炼内容（按 chapter_id / title / source_refs / timestamp 匹配）
58. 章节提炼自动派生并持久化到 chapter_extractions 表
59. 查看章节提炼优先读取已保存结果，不重复调用 AI
60. 章节提炼页面不再大面积显示"暂无内容"
61. 章节提炼编辑保存到 user_result_json（不覆盖小说整体提炼）
62. 章节提炼查看页右上角新增"提炼章节/重新提炼"入口
63. 未提炼章节可在查看页直接发起 AI 提炼（POST /api/chapters/<id>/extract-only）
64. 章节级 AI 提炼结果保存到 chapter_extractions 表
65. 重新提炼有二次确认，避免误操作
66. 提炼完成后前端自动重新读取已保存结果，章节列表状态即时更新
67. ExtractionCard 集合项收起/展开抽到独立组件，避免 useCallback 内调 useState 的 hook 顺序错误
68. 章节列表编辑模式：复选框选章 → AI 提炼/删除 只处理选中章节
69. 非编辑模式 AI 提炼按钮灰色禁用，防止误触全量提炼
70. 单章/批量提炼结果统一保存为章节级结果，查看提炼直接读取
71. 章节行「查看提炼」跳转 extraction 只读模式
72. 批量提炼改为逐章独立 AI 调用，每章结果分别持久化
73. 已提炼章节重新提炼前有确认弹窗
74. 我的小说页编辑弹窗：修改小说名称 + 逐章编辑章节名称，统一保存
75. 我的小说页卡片删除字数显示

### 功能 4：YAML 剧本生成（本次新增）

76. 小说提炼完成后可生成 YAML 剧本草稿
77. **严格 JSON-first 工具链**：DeepSeek 输出 JSON 对象（而非 YAML 文本）→ `jsonschema` 库按 JSON Schema 校验结构 → `yaml.dump` 由系统统一序列化为 YAML → `yaml.safe_load` 兜底确认。AI 不再触碰 YAML 文本，缩进、引号、`- ` 对齐、`source_refs` 写法全部由 PyYAML 保证，根本杜绝缩进与结构错误
78. 优先使用 user_result_json，再回退 ai_result_json
79. 没有任何提炼结果时阻止生成
80. 用户选择 Schema 后 AI 必须按 Schema 结构生成
81. 未选择 Schema 时使用系统默认 Schema
82. 保存 Schema 快照 + 提炼结果快照
83. JSON Schema 结构校验（不含必填字段）+ YAML 语法兜底校验
84. 校验失败自动调用 AI 修复一次（修复对象也是 JSON）
85. 修复失败保留失败内容和错误信息
86. Schema 必填字段校验已移除：不因缺少 source_info / adaptation_intent / core_story 等 Schema 字段报错或阻止确认/导出
87. 多版本保存（生成/修复/编辑/确认/删除）
88. MySQL（Supabase PostgreSQL）+ .yaml 文件双重保存
89. 侧边栏"YAML 剧本"入口
90. 提炼页面 + 章节列表页均有 YAML 剧本入口
91. 章节列表提炼状态与后台章节提炼结果同步（get_chapter_extraction）
92. 已保存章节提炼结果自动显示为已提炼
93. 多页面统一章节提炼状态来源
94. 批量/单章/映射提炼后状态即时更新
95. YAML 剧本页面内选择小说组件（弹窗选小说+章节）
96. 小说与章节选择弹窗（左侧小说列表 + 右侧章节列表）
97. 一键选择全部已提炼章节 / 自定义勾选
98. Schema 弹窗选择（系统默认 / 用户 Schema / 不使用）

### YAML 剧本编辑器

99. 左侧侧边栏"YAML 编辑器"入口
100. 编辑器进入前选小说 → 选草稿版本（草稿列表用 y1/y2/y3 展示编号）
101. YAML/卡片/双栏三视图切换（默认双栏）
102. YAML 代码编辑区：行号、等宽字体、暗色主题
103. **右侧结构化剧本预览**：根据左侧 YAML 原文用 js-yaml 动态解析，展示结构概览、metadata、characters（人物名片含 role_type/source_refs）、relationships（关系名片含 from/to/强度）、scenes（场景名片含对白/动作计数）、episodes、source_refs 来源汇总、动态字段，各模块可折叠、文本截断、数量统计
104. 5 秒自动保存 + 手动保存
105. 有未保存修改离开页面时浏览器弹窗提醒
106. 格式化 YAML / 复制 / 下载草稿文件
107. 恢复上一次保存版本 / 恢复 AI 原始生成版本
108. 重新校验（语法 + Schema 结构）
109. AI 修复 YAML（只修格式不改剧情，新建 ai_repair 版本）
110. 校验通过后确认最终 YAML 剧本
111. YAML 编辑器标题统一使用 y{n} · {draft_name} · {Schema}，不再显示 v{version}

### 最终 YAML 导出

112. 确认后导出 .yaml / .yml 文件
113. 左侧 YAML 原文作为导出源，右侧卡片不参与导出
114. 导出文件保存到服务器文件系统 + 数据库记录
115. 未确认或未通过校验时禁止导出
116. 文件路径防穿越，UTF-8 编码
117. 用户可下载最终 YAML 文件

### 功能 5：关系图谱（本次新增）

> **界面设计参考**：bilibili「408 知识图谱」类视频中常见的浅色背景、圆形气泡节点、柔和配色、顶部胶囊式分类切换的可视化风格。

118. 左侧侧边栏新增「关系图谱」入口
119. 进入小说后选择已提炼章节，DeepSeek AI 输出严格 graph JSON（nodes / edges / groups），不输出 Markdown 与 UI 代码
120. 后端校验 graph JSON：nodes/edges 必填、id 唯一、edge.source/target 必须命中已存在 node、未提炼章节拦截、提炼章节合法性校验
121. 图谱数据持久化到 `relationship_graphs` 表（每部小说一个主图谱，重复生成覆盖；表缺失时回退内存存储）
122. 前端使用 Cytoscape.js（cose 力导向布局）渲染：圆形节点、连线、按 importance 调整大小（high 56px / medium 38px / low 24px）、按 strength 调整边宽
123. 9 种节点类型不同柔和配色：人物（蓝灰）/ 地点（绿）/ 事件（橙）/ 故事（紫）/ 冲突（红）/ 线索（黄）/ 阵营（青）/ 物件（棕）/ 主题（淡紫）
124. 顶部胶囊式分类切换（总览 / 人物 / 故事 / 地点 / 事件 / 冲突 / 线索），点击切换隐藏/淡出其他类别节点
125. 章节筛选条：按章节过滤显示节点（无 source_refs 的全局节点保留）
126. 节点详情面板：类型/子类型/重要性/描述/不确定性提示/来源章节列表（含原文片段）
127. 边详情面板：起点→终点/关系类型/强度/说明/来源章节
128. 「添加已提炼章节」追加流程：AI 输出增量 JSON（new_nodes / new_edges / updated_nodes / updated_edges），后端按 id 与 (source,target,type) 自动去重合并，不重复生成同名人物/地点节点
129. 空状态：当前小说没有已提炼章节时阻止生成，提示「请先完成章节提炼」
130. 「清空图谱」二次确认 + 一键删除
131. 图例 + 节点/边计数 + 章节范围 + 更新时间

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
3. 进入 **SQL Editor**，依次粘贴执行：`backend/sql/init.sql`、`backend/sql/init_system_schema.sql`，以及 `backend/sql/migrations/` 目录下所有 `migrate_*.sql`（按文件名字母序执行即可）

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

代码按功能划分目录。每个核心功能在前后端各有一组文件，便于按功能定位、扩展。

```text
├── README.md
├── docs/
│   └── usage-guide.md         # 详细使用指南
├── backend/                       # Flask API 后端
│   ├── app.py                     # Flask 应用入口（全部路由注册）
│   ├── config.example.py          # 配置示例
│   ├── config.py                  # 本地配置（不提交）
│   ├── requirements.txt           # Python 依赖
│   ├── sql/
│   │   ├── init.sql               # 初次建表脚本（功能 0–3 基础表）
│   │   ├── init_system_schema.sql # 系统默认 YAML Schema 初始化
│   │   └── migrations/            # 后续功能演进的迁移脚本（按时间先后执行）
│   │       ├── migrate_chapters.sql                # 功能 1 章节表
│   │       ├── migrate_chapter_extractions.sql     # 功能 2 章节提炼
│   │       ├── migrate_chapter_extractions_v2.sql  # 功能 2 章节提炼 v2
│   │       ├── migrate_yaml_drafts.sql             # 功能 4 YAML 草稿
│   │       ├── migrate_yaml_draft_name.sql         # 功能 4 草稿命名
│   │       ├── migrate_yaml_exports.sql            # 功能 4 最终导出
│   │       └── migrate_relationship_graphs.sql     # 功能 5 关系图谱
│   ├── src/                       # 业务逻辑层（按功能命名）
│   │   ├── __init__.py
│   │   │
│   │   │  # ── 基础设施 ──
│   │   ├── db.py                  # Supabase 客户端封装
│   │   ├── auth.py                # 注册 / 登录 / 密码哈希
│   │   ├── ai_client.py           # AI 客户端（provider 可切换：deepseek / openai / gemini）
│   │   │
│   │   │  # ── 功能 0–1：小说项目 + 章节管理 ──
│   │   ├── novel_service.py       # 小说项目 CRUD + 权限校验
│   │   ├── record_service.py      # 导入历史记录
│   │   ├── chapter_parser.py      # 章节识别（标题规则匹配）
│   │   ├── file_text_extractor.py # 章节文件导入（.txt / .md / .docx）
│   │   ├── html_cleaner.py        # 章节链接导入的 HTML 清洗
│   │   │
│   │   │  # ── 功能 2：小说提炼 ──
│   │   ├── extraction_service.py  # 小说提炼 / 章节提炼 / AI prompt
│   │   │
│   │   │  # ── 功能 3：YAML Schema 规则库 ──
│   │   ├── schema_service.py      # 系统 / 用户 Schema 管理 + 格式校验
│   │   │
│   │   │  # ── 功能 4：YAML 剧本生成 ──
│   │   ├── yaml_generation_service.py  # JSON-first 工具链 / 多版本管理 / 校验 / 导出
│   │   │
│   │   │  # ── 功能 5：关系图谱 ──
│   │   └── relationship_graph_service.py # graph JSON 生成 / 校验 / 合并 / 持久化
│   │
│   └── tests/
│       ├── __init__.py
│       ├── test_chapter_parser.py        # 章节识别测试
│       └── test_extraction_service.py    # 提炼解析与 prompt 测试
│
├── frontend/                              # Next.js 前端
│   ├── package.json
│   ├── src/
│   │   ├── app/                            # App Router 路由（每个目录 = 一个功能页面）
│   │   │   ├── login/                      # 登录页
│   │   │   ├── register/                   # 注册页
│   │   │   │
│   │   │   │  # ── 功能 0–1：我的小说 + 章节管理 ──
│   │   │   ├── novels/                     # 我的小说列表页
│   │   │   │   ├── ConfirmModal.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── import/             # 章节导入与识别页
│   │   │   │       ├── chapter/[chapterId]/ # 单章编辑页
│   │   │   │       │
│   │   │   │       │  # ── 功能 2：小说提炼 ──
│   │   │   │       ├── extraction/         # 提炼页与卡片编辑器
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   ├── ExtractionCard.tsx
│   │   │   │       │   └── SourceRefDrawer.tsx
│   │   │   │       │
│   │   │   │       │  # ── 功能 4：YAML 剧本生成 ──
│   │   │   │       └── yaml/               # YAML 剧本列表 + 草稿管理
│   │   │   │
│   │   │   ├── history/                    # 历史记录页
│   │   │   │
│   │   │   │  # ── 功能 3：YAML Schema 规则库 ──
│   │   │   ├── schemas/                    # Schema 列表 / 新建 / 详情 / 编辑
│   │   │   │
│   │   │   │  # ── 功能 4：YAML 编辑器 ──
│   │   │   ├── yaml-editor/                # YAML 编辑器（行号 / 校验 / 修复 / 结构预览）
│   │   │   │   ├── page.tsx
│   │   │   │   └── YamlStructurePreview.tsx
│   │   │   │
│   │   │   │  # ── 功能 5：关系图谱 ──
│   │   │   ├── relationship-graph/         # 图谱入口 + 选小说 + Cytoscape 渲染
│   │   │   │   ├── page.tsx
│   │   │   │   ├── RelationshipGraphCanvas.tsx
│   │   │   │   └── [novelId]/page.tsx
│   │   │   │
│   │   │   ├── layout.tsx                  # 根布局
│   │   │   ├── globals.css                 # 全局样式
│   │   │   └── page.tsx                    # 首页（自动跳转）
│   │   │
│   │   ├── components/
│   │   │   ├── Sidebar.tsx                 # 全局侧边栏导航
│   │   │   ├── BackButton.tsx              # 通用返回按钮
│   │   │   └── PageError.tsx               # 通用错误占位
│   │   ├── context/
│   │   │   └── AuthContext.tsx             # 认证上下文
│   │   └── lib/
│   │       └── api.ts                      # API 客户端封装（按功能分节）
│
└── package.json                            # 根目录脚本（转发前后端命令）
```

### 数据库迁移执行顺序

首次部署：

```sql
-- 1. 基础表
\i backend/sql/init.sql
\i backend/sql/init_system_schema.sql

-- 2. 演进迁移（按文件名时间序）
\i backend/sql/migrations/migrate_chapters.sql
\i backend/sql/migrations/migrate_chapter_extractions.sql
\i backend/sql/migrations/migrate_chapter_extractions_v2.sql
\i backend/sql/migrations/migrate_yaml_drafts.sql
\i backend/sql/migrations/migrate_yaml_draft_name.sql
\i backend/sql/migrations/migrate_yaml_exports.sql
\i backend/sql/migrations/migrate_relationship_graphs.sql
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
| `/novels/[id]/yaml` | YAML 剧本生成与版本管理 | 是 |
| `/yaml-editor` | YAML 剧本编辑器（支持编辑器入口/选草稿/直接编辑） | 是 |

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
| POST | `/api/novels/<id>/rename` | 重命名小说 |
| POST | `/api/chapters/<id>/rename` | 重命名章节 |
| DELETE | `/api/novels/<id>` | 删除小说 |
| GET  | `/api/novels/<id>/chapters` | 获取章节列表 |
| POST | `/api/novels/<id>/chapters` | 新增章节 |
| GET  | `/api/chapters/<id>` | 获取章节详情（含正文） |
| POST | `/api/chapters/<id>/save` | 保存章节标题与正文 |
| POST | `/api/chapters/<id>/parse` | 单章识别（合并入口的内部前置） |
| POST | `/api/chapters/<id>/extract` | 单章合并入口：保存 → 识别前置 → 进入小说提炼 |
| POST | `/api/chapters/<id>/extract-only` | 单章独立 AI 提炼，结果保存到 `chapter_extractions`，不触发整本小说提炼 |
| POST | `/api/chapters/<id>/delete` | 删除单章 |
| POST | `/api/novels/<id>/chapters/batch-parse` | 批量识别章节 |
| POST | `/api/novels/<id>/chapters/extract` | 批量逐章提炼：只对传入的 chapterIds 逐章独立 AI 提炼并保存 |
| POST | `/api/novels/<id>/extract` | 触发小说提炼（无 parsed 章节时自动前置） |
| GET  | `/api/novels/<id>/extraction` | 获取小说整体提炼结果 + 章节提炼状态（只读） |
| GET  | `/api/novels/<id>/extractions/all` | 获取小说整体 + 全部章节提炼（只读） |
| GET  | `/api/chapters/<id>/extraction` | 获取单个章节提炼结果（只读） |
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
| POST | `/api/novels/<id>/yaml-generate` | 生成 YAML 剧本草稿 |
| GET  | `/api/novels/<id>/yaml-drafts` | 获取 YAML 草稿列表 |
| GET  | `/api/yaml-drafts/<id>` | 获取 YAML 草稿详情 |
| POST | `/api/yaml-drafts/<id>/save` | 保存用户编辑的 YAML |
| POST | `/api/yaml-drafts/<id>/validate` | 重新校验 YAML |
| POST | `/api/yaml-drafts/<id>/confirm` | 确认 YAML 剧本 |
| POST | `/api/yaml-drafts/<id>/delete` | 软删除 YAML 草稿 |
| POST | `/api/novels/<id>/yaml-regenerate` | 重新生成 YAML 剧本 |
| POST | `/api/yaml-drafts/<id>/restore-last-saved` | 恢复上一次保存版本 |
| POST | `/api/yaml-drafts/<id>/restore-ai-original` | 恢复 AI 原始生成版本 |
| POST | `/api/yaml-drafts/<id>/ai-repair` | AI 修复 YAML（新建版本） |
| GET  | `/api/yaml-drafts/<id>/download` | 下载 YAML 草稿文件 |
| POST | `/api/yaml-drafts/batch-delete` | 批量删除 YAML 版本 |
| POST | `/api/yaml-drafts/<id>/autosave` | 自动保存 YAML |
| POST | `/api/yaml-drafts/<id>/export` | 导出最终 YAML 剧本文件 |
| GET  | `/api/yaml-drafts/<id>/download-final` | 下载最终 YAML 剧本文件 |

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
python -m unittest tests.test_chapter_parser tests.test_extraction_service -v
```

共 27 条测试：
- `test_chapter_parser`：16 条（章节识别、字数统计、内容校验）
- `test_extraction_service`：11 条（25 字段 schema、JSON 解析兜底、prompt 构造）

## 演示视频

> 此项目为参赛作品。

演示视频链接：待补充（已上传至 bilibili 后更新此链接）

## 依赖列表

**后端（Python）：**

- Flask
- supabase
- requests
- PyYAML
- jsonschema

**前端（Node.js）：**

- next / react / react-dom
- typescript
- tailwindcss / @tailwindcss/postcss
- eslint / eslint-config-next
- cytoscape（关系图谱可视化）
- js-yaml（YAML 编辑器右侧结构预览解析）
- concurrently

## 原创功能与复用说明

- 原创内容：用户登录、小说项目管理、章节列表式管理（章节标题与正文绑定保存）、单章编辑、单章识别、批量识别、小说提炼流程、25 字段 JSON 中间层设计、AI 客户端封装、卡片编辑器、原文依据抽屉、YAML Schema 规则库（格式校验 / CRUD / 权限控制）、侧边栏导航等全部代码
- 复用内容：无

> 本次章节操作与提炼入口改造未新增第三方依赖。
> 本次提炼结果页面（下拉视图/自适应textarea/大元素折叠/小元素CRUD）、导入小说（文件/链接）改造未新增第三方依赖。
> 本次章节编辑页"导入章节内容→文件导入"链路修复未新增第三方依赖。当前章节文件导入支持 `.txt` / `.md`（自动尝试 UTF-8 with BOM / UTF-8 / GBK / GB2312 / GB18030 编码）/ `.docx`（依赖 `python-docx`）。`.pdf` / `.doc` 暂不支持，会返回 `UNSUPPORTED_FILE_TYPE` 并提示改用文本转换——`.pdf` 取消是因为 PyPDF2 对中文 PDF 与扫描版 PDF 的文本抽取效果不可靠。
> 本次提炼结果保存与查看逻辑修复未新增第三方依赖。需执行 `backend/sql/migrations/migrate_chapter_extractions_v2.sql` 创建 `chapter_extractions` 表。
> 本次从小说整体提炼自动映射章节提炼内容的功能未新增第三方依赖。
> 本次章节提炼查看页新增提炼入口与保存逻辑修复未新增第三方依赖。新增端点 `POST /api/chapters/<id>/extract-only`（单章独立 AI 提炼）；ExtractionCard 修复 hook 顺序错误。
> 本次章节派生提炼增强未新增第三方依赖。改进 `derive_chapter_extraction_from_novel` 从 `chapter_summaries[i]` 内嵌的 `key_events / characters / locations` 提取本章细节；并在 `chapter_extractions` 表缺失时落回 `novel_extractions.user_result_json._chapter_overrides` 兜底存储，保证章节查看页与"提炼章节"按钮在数据库 schema 不完整的情况下也能工作。
> 本次章节多选提炼与章节提炼结果读取修复未新增第三方依赖。批量提炼改为逐章独立 AI 调用 + 分别保存；Import 页按钮重构（编辑/AI提炼/删除 三按钮联动，非编辑模式 AI提炼 禁用）；章节列表状态改用真实提炼状态。
> 本次 YAML 剧本生成功能未新增第三方依赖。需执行 `backend/sql/migrations/migrate_yaml_drafts.sql` 创建 `yaml_drafts` 表。YAML 草稿 `.yaml` 文件保存于 `backend/data/yaml_drafts/user_<id>/novel_<id>/`。
> 本次章节提炼状态同步修复未新增第三方依赖。章节列表接口现在关联 `get_chapter_extraction`（含 fallback）返回每章的 `hasExtraction`/`extractionStatus`，前端标签、按钮、统计全部统一使用该字段。
> 本次 YAML 剧本生成选择弹窗功能未新增第三方依赖。生成区域增加"选择小说"组件（弹窗选小说+章节）；Schema 改为弹窗选择（系统默认/用户/不使用）。
> 本次 YAML 剧本编辑器功能未新增第三方依赖。侧边栏新增"YAML 编辑器"入口；编辑器支持 YAML/卡片/双栏三种视图、行号、等宽字体、自动保存、格式化、复制、下载、恢复版本、AI 修复、重新校验、确认最终 YAML。
> 本次 YAML 根结构修复未新增第三方依赖。系统会对 AI 生成 YAML 做根结构校验，防止出现 `[]` 后接对象字段的非法 YAML；`_fix_yaml_structure()` 自动将 `[]\n    key: value` 修复为 `characters:\n  - key: value`（同缩进块合并为一个数组元素）。
> 本次 YAML 版本重复生成修复未新增第三方依赖。版本号原子化（DB 查 max+1 + 重复检测递增）；generate_yaml 修复循环仅修改同一条记录不创建多版本；前端按钮请求中 disabled + 文本切换防止重复点击。
> 本次最终 YAML 剧本导出功能未新增第三方依赖。需执行 `backend/sql/migrations/migrate_yaml_exports.sql` 创建 `yaml_exports` 表。
> 本次提炼内容页 YAML 剧本入口状态判断未新增第三方依赖。右上角按钮根据 `getYamlDrafts` 返回结果动态切换"生成 YAML 剧本"/"进入 YAML 剧本"。
> 本次 YAML 剧本版本多选删除功能未新增第三方依赖。新增批量删除端点 + YAML 页面编辑模式（复选框多选 → 批量软删除）。
> 本次 DeepSeek YAML 严格生成提示词优化未新增第三方依赖。prompt 强制要求：顶层对象、2空格缩进、数组 `-` 对齐、source_refs 格式铁则、完整结构示例；修复 prompt 限制只修结构不改剧情。
> 本次 YAML 剧本章节选择全选功能未新增第三方依赖。弹窗章节列表增加"全选已提炼章节"复选框，支持全选/半选/取消三种状态联动。
> 本次 YAML 版本展示编号与文件名称编辑功能未新增第三方依赖。需执行 `backend/sql/migrations/migrate_yaml_draft_name.sql` 增加 `draft_name` 列。展示编号 y1/y2/y3 动态计算；右侧"查看"改为"编辑"（编辑名称弹窗）；行点击查看 YAML 内容；顶部"编辑"改为"批量管理"。
> 本次 YAML 校验报告优化未新增第三方依赖。`run_comprehensive_validation()` 返回结构化校验结果（语法/Schema/必填字段/类型/source_refs/业务规则共 6 层），前端折叠式校验报告面板支持行号定位和原始错误查看。
> 本次严格 YAML 生成工具链改造**新增第三方依赖：`jsonschema`**。生成流程从「DeepSeek 直接写 YAML 文本」改为「DeepSeek 输出 JSON 对象 → 后端 `json.loads` 解析 → `jsonschema.Draft7Validator` 按 JSON Schema 校验结构 → `yaml.dump` 序列化为 YAML → `yaml.safe_load` 兜底校验」。由系统统一负责 YAML 缩进、引号、`- ` 对齐、`source_refs` 写法，AI 不再触碰 YAML 文本，根本杜绝缩进与 source_refs 结构错误。AI 修复（`/api/yaml-drafts/<id>/ai-repair`）也改为 JSON-first：把当前 YAML 反序列化为 JSON → 提交给 AI 修复 → 解析 → jsonschema 校验 → 用 `yaml.dump` 重写为 YAML，新建版本保存。
> 本次 YAML 版本显示名称同步修复未新增第三方依赖。YAML 版本对用户展示统一使用 `y1/y2/y3` 展示编号（根据 `created_at` 时间先后动态计算），数据库内部 `version_number`（v29/v30）仅用于内部追踪，不作为用户主显示。`getDisplayCode` / `getDisplayName` / `sortedActiveDrafts` 公用函数统一 Toast、版本列表、查看弹窗、YAML 编辑器标题、确认/导出/修复提示的名称来源。用户自定义名称后全局同步显示。删除版本后 y 编号自动重新计算。后端生成/修复接口不再在提示消息中暴露内部版本号。
> 本次 Schema 必填字段校验移除未新增第三方依赖。`validate_against_schema()` 不再逐 key 比对缺失顶层字段；`run_comprehensive_validation()` 的 Schema 结构校验步骤改为仅检查 Schema 自身是否可解析，不因缺少 `source_info` / `adaptation_intent` / `core_story` 等字段报错或阻止确认/导出。YAML 语法校验、字段类型校验、source_refs 校验、业务规则校验全部保留。
> 本次 YAML 剧本结构预览增强未新增第三方依赖（`js-yaml` 已随 eslint 存在）。右侧"剧本结构预览"从只读 metadata 几个字段改为根据左侧 YAML 原文用 `js-yaml` 完整解析后动态生成：结构概览、metadata、characters 人物列表（含 source_refs）、relationships 人物关系、scenes 场景（含对白/动作计数）、episodes 剧集、source_refs 来源汇总、generation_notes / validation_notes、其他动态字段。各模块可折叠、文本截断、数量统计，左侧 YAML 修改后右侧实时同步。预览仅供阅读，不参与导出。
> 本次「关系图谱」功能**新增第三方依赖：`cytoscape`**。需执行 `backend/sql/migrations/migrate_relationship_graphs.sql` 创建 `relationship_graphs` 表（每用户每小说一条主图谱记录，含 chapter_ids / graph_data_json / status / node_count / edge_count；表缺失时回退内存存储）。左侧侧边栏新增「关系图谱」入口；流程：选择已提炼章节 → DeepSeek 输出严格 graph JSON（nodes / edges / groups）→ 后端校验（id 唯一、edge.source/target 必须命中 nodes、未提炼章节拦截、章节归属校验）→ 持久化。前端 Cytoscape.js cose 力导向布局，节点按 type 上色（9 种柔和配色）、按 importance 调整大小、按 strength 调整边宽。支持顶部胶囊式分类切换（总览/人物/故事/地点/事件/冲突/线索）、章节筛选、节点/边点击查看详情面板（含 source_refs 原文片段）。「添加已提炼章节」追加流程：AI 输出 new_nodes/new_edges/updated_nodes/updated_edges 增量，后端按 id 和 (source,target,type) 自动去重合并旧图谱。仅作为增强功能，不影响 YAML 剧本生成/编辑/导出主流程。
