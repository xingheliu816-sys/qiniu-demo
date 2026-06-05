# Novel2Script AI 使用指南

本文档详细介绍如何从零开始配置环境、初始化数据库、启动项目并使用功能。

> **架构说明**：本项目采用前后端分离架构
> - **后端**：Python + Flask API（端口 5000）
> - **前端**：React + TypeScript + Next.js（端口 3000）
> - 需要同时启动后端和前端才能完整使用

---

## 目录

1. [前置条件](#1-前置条件)
2. [安装后端依赖（Python）](#2-安装后端依赖python)
3. [安装前端依赖（Node.js）](#3-安装前端依赖nodejs)
4. [配置 MySQL 数据库](#4-配置-mysql-数据库)
5. [复制并编辑配置文件](#5-复制并编辑配置文件)
6. [启动项目](#6-启动项目)
7. [功能使用流程](#7-功能使用流程)
8. [常见问题](#8-常见问题)

---

## 1. 前置条件

确保你的电脑已安装以下软件：

| 软件 | 版本要求 | 用途 |
|------|---------|------|
| Python | 3.8 及以上 | 运行 Web 服务 |
| MySQL | 5.7 及以上 | 存储用户、小说、章节数据 |

### 检查 Python 是否已安装

打开终端（命令提示符 / PowerShell），运行：

```bash
python --version
```

如果显示 `Python 3.x.x`，说明已安装。如果没有，请前往 [python.org](https://www.python.org/downloads/) 下载安装。

### 检查 MySQL 是否已安装

```bash
mysql --version
```

如果显示 `mysql Ver x.x.x`，说明已安装。

**如果你没有安装 MySQL**，可以根据自己的系统选择：

- **Windows**：下载 [MySQL Installer](https://dev.mysql.com/downloads/installer/)，安装时选择"MySQL Server"和"MySQL Shell"，设置 root 密码并记住它。
- **macOS**：`brew install mysql`
- **Linux (Ubuntu/Debian)**：`sudo apt install mysql-server`

---

## 2. 安装后端依赖（Python）

打开终端，进入后端目录：

```bash
cd backend
```

安装依赖：

```bash
pip install -r requirements.txt
```

安装完成后，Flask 和 mysql-connector-python 会被安装到系统中。

---

## 3. 安装前端依赖（Node.js）

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

## 4. 配置 MySQL 数据库

### 4.1 登录 MySQL

用你的 MySQL root 账号登录：

```bash
mysql -u root -p
```

系统会提示输入密码。输入你在安装 MySQL 时设置的 root 密码（输入时不会显示字符），然后按回车。

如果登录成功，你会看到这样的提示符：

```
mysql>
```

### 4.2 执行初始化脚本

在 `mysql>` 提示符下，执行初始化 SQL 脚本：

**方法一**：在 MySQL 命令行中执行（推荐）

```sql
source C:/Users/你的用户名/Desktop/qiniu-demo/backend/sql/init.sql;
```

> 注意：把路径中的 `你的用户名` 替换成你自己的 Windows 用户名。或者直接用绝对路径的 Unix 风格写法，例如：
> ```sql
> source C:/Users/86150/Desktop/qiniu-demo/backend/sql/init.sql;
> ```

**方法二**：在终端中直接导入（不需要先登录 MySQL）

```bash
mysql -u root -p < backend/sql/init.sql
```

### 4.3 验证数据库是否创建成功

执行以下 SQL 检查：

```sql
SHOW DATABASES;
```

你应该能在列表中找到 `novel2script`。

```sql
USE novel2script;
SHOW TABLES;
```

你应该能看到 4 张表：

```
+------------------------+
| Tables_in_novel2script |
+------------------------+
| chapter_parse_records  |
| chapters               |
| novels                 |
| users                  |
+------------------------+
```

完成后输入 `exit` 退出 MySQL。

---

## 5. 复制并编辑配置文件

### 5.1 复制配置模板

在 `backend` 目录下，将 `config.example.py` 复制为 `config.py`：

**Windows：**

```bash
copy config.example.py config.py
```

**macOS / Linux：**

```bash
cp config.example.py config.py
```

### 5.2 编辑 config.py

用任意文本编辑器（记事本、VS Code 等）打开 `config.py`，文件内容如下：

```python
MYSQL_HOST = "localhost"
MYSQL_PORT = 3306
MYSQL_USER = "root"
MYSQL_PASSWORD = "your_password"
MYSQL_DATABASE = "novel2script"

SECRET_KEY = "replace_this_with_a_random_secret_key"
```

需要修改的地方：

| 配置项 | 说明 | 修改建议 |
|--------|------|---------|
| `MYSQL_HOST` | MySQL 服务器地址 | 如果在本机运行，保持 `"localhost"` 不变 |
| `MYSQL_PORT` | MySQL 端口 | 如果没改过，保持 `3306` 不变 |
| `MYSQL_USER` | MySQL 用户名 | 一般用 `"root"` |
| `MYSQL_PASSWORD` | MySQL 密码 | **改成你自己的 MySQL root 密码** |
| `MYSQL_DATABASE` | 数据库名 | 保持 `"novel2script"` 不变 |
| `SECRET_KEY` | Flask 的加密密钥 | **改为一段随机字符串** |

### 5.3 生成安全的 SECRET_KEY

你可以用 Python 生成一个安全的随机密钥：

打开终端，运行：

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

会输出类似：

```
a7f3c8e12b45d6f7890a1b2c3d4e5f67890abcde1234567890fedcba987654321
```

把这串字符复制到 `config.py` 的 `SECRET_KEY` 位置。

### 5.4 完整示例

```python
MYSQL_HOST = "localhost"
MYSQL_PORT = 3306
MYSQL_USER = "root"
MYSQL_PASSWORD = "your_mysql_password"
MYSQL_DATABASE = "novel2script"

SECRET_KEY = "replace_this_with_a_random_secret_key"
```

> **注意**：`config.py` 包含了你的数据库密码，请**不要**把它提交到代码仓库。`.gitignore` 已配置忽略此文件。

---

## 6. 启动项目

本项目采用前后端分离架构，需要**同时启动后端和前端**。

### 6.1 启动后端（Flask API）

打开第一个终端窗口，进入后端目录：

```bash
cd backend
```

启动 Flask API 服务器：

```bash
python app.py
```

如果一切正常，你会看到类似输出：

```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

### 6.2 启动前端（Next.js）

打开第二个终端窗口，进入前端目录：

```bash
cd frontend
```

启动 Next.js 开发服务器：

```bash
npm run dev
```

如果一切正常，你会看到类似输出：

```
▲ Next.js 16.x.x
 - Local: http://localhost:3000
```

### 6.3 访问项目

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可使用。

后端 API 会自动在 `http://localhost:5000` 提供数据服务，前端的 API 请求会自动携带登录会话（cookie）。

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
4. 登录成功后自动跳转到小说导入页面

### 7.3 导入小说并识别章节

**方法一：粘贴文本**

1. 在"小说标题"输入框中输入标题（可选，不填则默认为"未命名小说"）
2. 在"小说正文"文本框中粘贴小说内容
3. 点击 **识别章节** 按钮

**方法二：上传 .txt 文件**

1. 点击 **上传 .txt 文件** 按钮
2. 选择电脑上的 `.txt` 文件
3. 文件内容会自动填充到正文文本框
4. 点击 **识别章节** 按钮

### 7.4 查看识别结果

识别完成后，页面会显示：

- **提示信息**：例如"章节识别成功，共识别到 3 个章节"或字数不足的警告
- **弹窗**：列出所有识别到的章节标题
- **总字数**：小说的非空白字符总数
- **章节数量**：识别到的章节个数
- **章节列表**：每章显示序号、标题、字数

### 7.5 展开查看章节正文

点击章节右侧的 **展开** 按钮，可以查看该章节的完整正文。点击 **收起** 可以隐藏。

### 7.6 修改章节标题

1. 点击章节标题输入框
2. 修改标题内容
3. 停止输入 1 秒后，系统会自动保存到数据库
4. 页面顶部会出现绿色的"章节标题已保存"提示

### 7.7 重新识别

如果修改了正文内容，点击 **重新识别** 按钮可以再次识别章节。重新识别会用当前正文重新提交，并保存为新记录。

### 7.8 清空内容

1. 点击 **清空内容** 按钮
2. 弹出确认框："确定要清空小说标题和正文内容吗？此操作不可恢复。"
3. 点击 **确定** 清空，点击 **取消** 放弃

### 7.9 查看历史记录

1. 点击顶部导航栏的 **历史记录**
2. 页面显示当前登录用户的所有导入与识别记录
3. 表格包含：小说标题、输入方式、总字数、章节数、状态（成功/不足）、提示信息、创建时间

### 7.10 退出登录

点击导航栏右上角的 **退出登录**（或 **退出** 按钮），会清除登录状态并跳转到登录页。

---

## 8. 常见问题

### Q: 启动时报错 `ModuleNotFoundError: No module named 'flask'`

没有安装依赖。运行：

```bash
pip install -r requirements.txt
```

### Q: 启动时报错 `Can't connect to MySQL server`

原因一：MySQL 服务没有启动。

- **Windows**：在"服务"中找到 MySQL，右键点击"启动"
- **macOS**：`brew services start mysql`
- **Linux**：`sudo systemctl start mysql`

原因二：`config.py` 中的 MySQL 配置信息填错了。检查用户名、密码、主机地址是否正确。

### Q: 连接 MySQL 时报错 `Access denied for user 'root'@'localhost'`

`config.py` 中的 `MYSQL_PASSWORD` 填错了。请确认你输入的是正确的 MySQL root 密码。

如果忘记密码，可以参考 MySQL 官方文档重置。

### Q: 执行 init.sql 时报错 `Unknown database 'novel2script'`

先手动创建数据库：

```sql
CREATE DATABASE novel2script DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE novel2script;
```

然后再执行 `source` 导入。

### Q: 页面提示"用户名已存在"

说明该用户名已被注册，换个用户名即可。

### Q: 识别后提示"小说正文至少需要 100 字"

粘贴或上传的小说正文太短，需要至少 100 个非空白字符。

### Q: 前端能打开，但提示"登录状态异常"或接口报错

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

### Q: 数据库中的中文显示为乱码

MySQL 初始化脚本已设置 `utf8mb4` 编码，通常不会出现乱码。如果出现，检查 MySQL 的默认字符集配置。

### Q: 如何查看已保存到数据库的数据？

登录 MySQL：

```bash
mysql -u root -p
```

然后查看数据：

```sql
USE novel2script;
SELECT * FROM users;
SELECT * FROM novels;
SELECT * FROM chapters;
SELECT * FROM chapter_parse_records;
```

### Q: 项目端口被占用

默认端口是 5000。如果被占用，修改 `app.py` 最后一行中的 `port` 参数：

```python
app.run(host='0.0.0.0', port=5001, debug=True)
```

然后访问 [http://127.0.0.1:5001](http://127.0.0.1:5001)。

