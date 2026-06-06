# Novel2Script AI 使用指南

本文档详细介绍如何从零开始配置环境、初始化数据库、启动项目并使用功能。

> **架构说明**：本项目采用前后端分离架构
> - **后端**：Python + Flask API（端口 5000）
> - **前端**：React + TypeScript + Next.js（端口 3000）
> - **数据库**：Supabase（PostgreSQL 云数据库）
> - 需要同时启动后端和前端才能完整使用

---

## 目录

1. [前置条件](#1-前置条件)
2. [创建 Supabase 项目](#2-创建-supabase-项目)
3. [安装后端依赖（Python）](#3-安装后端依赖python)
4. [复制并编辑配置文件](#4-复制并编辑配置文件)
5. [安装前端依赖（Node.js）](#5-安装前端依赖nodejs)
6. [启动项目](#6-启动项目)
7. [功能使用流程](#7-功能使用流程)
8. [常见问题](#8-常见问题)

---

## 1. 前置条件

确保你的电脑已安装以下软件，并准备好一个 Supabase 账号：

| 软件 / 服务 | 版本要求 | 用途 |
|------|---------|------|
| Python | 3.8 及以上 | 运行 Flask 后端 |
| Node.js | 18 及以上 | 运行 Next.js 前端 |
| Supabase 账号 | 免费即可 | 提供 PostgreSQL 云数据库 |

### 检查 Python 是否已安装

打开终端（命令提示符 / PowerShell），运行：

```bash
python --version
```

如果显示 `Python 3.x.x`，说明已安装。如果没有，请前往 [python.org](https://www.python.org/downloads/) 下载安装。

### 检查 Node.js 是否已安装

```bash
node --version
```

如果显示 `v18.x.x` 或更高版本，说明已安装。如果没有，请前往 [nodejs.org](https://nodejs.org/) 下载 LTS 版本。

---

## 2. 创建 Supabase 项目

本项目使用 Supabase 托管的 PostgreSQL 作为数据库，无需在本地安装数据库。

### 2.1 注册并新建项目

1. 打开 [supabase.com](https://supabase.com)，用 GitHub 或邮箱注册（免费）
2. 登录后点击 **New project**
3. 填写项目名（任意，如 `novel2script`）、数据库密码（妥善保存）、选择就近 Region，点击 **Create new project**
4. 等待 1-2 分钟，项目初始化完成

### 2.2 获取连接凭据

进入项目 Dashboard 后：

1. 左侧菜单点击 **Project Settings**（齿轮图标） → **API**
2. 复制以下两个值，稍后填入后端配置：
   - **Project URL**：形如 `https://xxxxxxxxxxxx.supabase.co`
   - **service_role key**（不是 anon key）：用于后端绕过 Row Level Security 直接访问数据库

> ⚠️ **不要使用 anon key**。本项目后端使用 service_role key 进行数据库操作，使用 anon key 会因 RLS 策略导致读写失败。
> ⚠️ **service_role key 等同于数据库的最高权限**，不要在前端代码、公开文档、公开仓库中暴露。

### 2.3 初始化数据库表

1. 左侧菜单点击 **SQL Editor**
2. 点击 **+ New query**
3. 打开本项目的 `backend/sql/init.sql`，复制全部内容
4. 粘贴到 SQL Editor 中，点击右下角 **Run**（或按 `Ctrl+Enter`）
5. 看到 `Success. No rows returned` 表示建表成功

### 2.4 验证表是否创建成功

1. 左侧菜单点击 **Table Editor**
2. 应当能看到 4 张表：`users`、`novels`、`chapters`、`chapter_parse_records`

---

## 3. 安装后端依赖（Python）

打开终端，进入后端目录：

```bash
cd backend
```

安装依赖：

```bash
pip install -r requirements.txt
```

安装完成后，`Flask` 和 `supabase` 这两个 Python 包会被安装到系统中。

---

## 4. 复制并编辑配置文件

### 4.1 复制配置模板

在 `backend` 目录下，将 `config.example.py` 复制为 `config.py`：

**Windows：**

```bash
copy config.example.py config.py
```

**macOS / Linux：**

```bash
cp config.example.py config.py
```

### 4.2 编辑 config.py

用任意文本编辑器（记事本、VS Code 等）打开 `backend/config.py`，文件内容如下：

```python
SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co"
SUPABASE_SERVICE_KEY = "你的 Supabase service_role key（非 anon key）"

SECRET_KEY = "replace_this_with_a_random_secret_key"
```

需要修改的地方：

| 配置项 | 说明 | 修改建议 |
|--------|------|---------|
| `SUPABASE_URL` | Supabase 项目地址 | 填入第 2.2 步复制的 Project URL |
| `SUPABASE_SERVICE_KEY` | service_role key | 填入第 2.2 步复制的 service_role key |
| `SECRET_KEY` | Flask session 加密密钥 | **改为一段随机字符串**（见下一步） |

### 4.3 生成安全的 SECRET_KEY

打开终端，运行：

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

会输出类似：

```
a7f3c8e12b45d6f7890a1b2c3d4e5f67890abcde1234567890fedcba987654321
```

把这串字符复制到 `config.py` 的 `SECRET_KEY` 位置。

### 4.4 完整示例

```python
SUPABASE_URL = "https://abcdefghijklmnop.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJI...（很长的一串）"

SECRET_KEY = "a7f3c8e12b45d6f7890a1b2c3d4e5f67890abcde1234567890fedcba987654321"
```

> **注意**：`config.py` 包含了访问数据库的最高权限密钥，**绝对不要**把它提交到代码仓库。`.gitignore` 已配置忽略此文件。

---

## 5. 安装前端依赖（Node.js）

打开另一个终端，进入前端目录：

```bash
cd frontend
```

安装依赖：

```bash
npm install
```

安装完成后，Next.js、React、TypeScript 等依赖会被安装到 `node_modules` 中。

---

## 6. 启动项目

本项目采用前后端分离架构，需要**同时启动后端和前端**。提供两种方式。

### 6.1 方式一：一键启动（推荐）

在**项目根目录**执行：

```bash
npm run dev
```

这条命令会通过根目录的 `package.json` 转发到 `frontend/package.json` 的 `dev:all`，使用 `concurrently` 同时启动后端（Flask）和前端（Next.js）。

如果只想启动前端（用于纯前端调试），可以在根目录运行：

```bash
npm run dev:web
```

### 6.2 方式二：分别启动

**终端 1 — 启动后端（端口 5000）：**

```bash
cd backend
python app.py
```

成功后会看到：

```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

**终端 2 — 启动前端（端口 3000）：**

```bash
cd frontend
npm run dev
```

成功后会看到：

```
▲ Next.js 16.x.x
 - Local: http://localhost:3000
```

### 6.3 访问项目

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可使用。

后端 API 在 `http://localhost:5000` 提供数据服务，前端的 API 请求会自动携带登录会话（cookie）。

按 `Ctrl + C` 可以分别停止后端或前端服务。

---

## 7. 功能使用流程

### 7.1 用户注册

1. 打开 [http://localhost:3000/register](http://localhost:3000/register)
2. 输入 **用户名**（任意，如 `testuser`）
3. 输入 **密码**（至少 6 位）
4. 点击 **注册** 按钮
5. 注册成功后自动跳转到登录页

### 7.2 用户登录

1. 打开 [http://localhost:3000/login](http://localhost:3000/login)
2. 输入刚才注册的用户名和密码
3. 点击 **登录** 按钮
4. 登录成功后自动跳转到「我的小说」列表页

### 7.3 创建小说项目

1. 在「我的小说」页面点击 **创建新小说**
2. 系统会自动创建一个草稿小说，并跳转到导入页面

### 7.4 导入小说并识别章节

**方法一：粘贴文本**

1. 在「小说标题」输入框中输入标题（可选，不填则默认为「未命名小说」）
2. 在「小说正文」文本框中粘贴小说内容
3. 点击 **识别章节** 按钮

**方法二：上传 .txt 文件**

1. 点击 **上传 .txt 文件** 按钮
2. 选择电脑上的 `.txt` 文件
3. 文件名会自动作为小说标题，文件内容会自动填充到正文文本框
4. 点击 **识别章节** 按钮

### 7.5 查看识别结果

识别完成后，页面会显示：

- **提示信息**：例如「章节识别成功，共识别到 3 个章节」或字数不足的警告
- **弹窗**：列出所有识别到的章节标题
- **总字数**：小说的非空白字符总数
- **章节数量**：识别到的章节个数
- **章节列表**：每章显示序号、标题、字数

### 7.6 展开查看章节正文

点击章节右侧的 **展开** 按钮，可以查看该章节的完整正文。点击 **收起** 可以隐藏。

### 7.7 修改章节标题

1. 点击章节标题输入框
2. 修改标题内容
3. 停止输入约 0.8 秒后，系统会自动保存到数据库
4. 页面顶部会出现绿色的「章节标题已保存」提示

### 7.8 保存与删除

- 顶部「保存」按钮：将小说状态标记为「已保存」
- 顶部「删除」按钮：永久删除该小说及其所有章节、解析记录（不可恢复）

### 7.9 重新识别 / 清空内容

- **重新识别**：用当前正文重新识别章节，旧的章节数据会被覆盖
- **清空内容**：清空标题、章节名、正文输入（不会删除数据库中的小说）

### 7.10 查看历史记录

1. 点击顶部导航栏的 **历史记录**
2. 页面显示当前登录用户的所有导入与识别记录
3. 表格包含：小说标题、输入方式、总字数、章节数、状态（成功/不足）、提示信息、创建时间

### 7.11 退出登录

点击导航栏右上角的 **退出** 按钮，会清除登录状态并跳转到登录页。

---

## 8. 常见问题

### Q: 启动时报错 `ModuleNotFoundError: No module named 'flask'` 或 `'supabase'`

没有安装依赖。运行：

```bash
cd backend
pip install -r requirements.txt
```

### Q: 启动后端时报错 `AttributeError: module 'config' has no attribute 'SUPABASE_URL'`

`config.py` 还没创建或没有正确填写。请回到第 4 节按步骤复制并编辑配置。

### Q: 注册/登录时报错 `Invalid API key` 或 `JWT expired`

`config.py` 中的 `SUPABASE_SERVICE_KEY` 填错了。请回到 Supabase Dashboard → Project Settings → API 重新复制 **service_role** key（不要复制 anon key）。

### Q: 注册/登录时报错 `relation "users" does not exist`

Supabase 项目中还没有初始化数据库表。请回到第 2.3 步，在 SQL Editor 中执行 `backend/sql/init.sql`。

### Q: 注册时报错 `permission denied for table users` 或 `new row violates row-level security policy`

你可能使用了 anon key 而不是 service_role key。anon key 受 Row Level Security 限制，无法直接写入表。请改用 service_role key。

### Q: 页面提示「用户名已存在」

说明该用户名已被注册，换个用户名即可。

### Q: 识别后提示「小说正文至少需要 100 字」

粘贴或上传的小说正文太短，需要至少 100 个非空白字符。

### Q: 前端能打开，但提示「登录状态异常」或接口报错

前后端分离架构下，需要**同时启动后端和前端**才能正常使用。

1. 后端必须在 `http://localhost:5000` 运行（`python backend/app.py`）
2. 前端访问 `http://localhost:3000`（`npm run dev`）
3. 如果改动了后端端口，需要在 `frontend/.env.local` 中设置 `NEXT_PUBLIC_API_URL`

### Q: 前端页面没有数据，控制台报 CORS 错误

CORS 跨域错误通常是因为后端没有正确启动或端口不匹配。

检查：
1. 后端是否在运行（`http://localhost:5000` 能否访问）
2. 是否先启动了后端再启动前端
3. 如果后端不在本机，需要在 `frontend/.env.local` 中配置后端地址

### Q: 如何查看已保存到数据库的数据？

打开 Supabase Dashboard → 左侧 **Table Editor**，依次点击表名即可查看：

- `users`：所有注册用户
- `novels`：所有小说项目
- `chapters`：所有章节
- `chapter_parse_records`：所有解析记录

也可以在 **SQL Editor** 中执行查询：

```sql
SELECT * FROM users;
SELECT * FROM novels ORDER BY created_at DESC;
SELECT * FROM chapters WHERE novel_id = 1;
```

### Q: 后端 5000 端口被占用

修改 `backend/app.py` 最后一行的 `port` 参数：

```python
app.run(host='0.0.0.0', port=5001, debug=True)
```

同时在 `frontend/.env.local` 中设置：

```bash
NEXT_PUBLIC_API_URL=http://localhost:5001
```

然后重启前端。

### Q: 想换用本地 PostgreSQL 或 MySQL 行不行？

理论上可以，但需要替换 `backend/src/db.py` 中的 Supabase 客户端实现，并改写所有 `db.table(...)` 风格的查询。当前项目仅适配 Supabase。
