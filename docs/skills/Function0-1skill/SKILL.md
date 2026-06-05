---
name: novel2script-auth-import
description: Novel2Script AI 功能0用户登录与功能1小说导入章节识别开发规范
---

# Novel2Script AI 功能 0 + 功能 1 基础版开发 Skill

## 一、项目背景

项目名称：Novel2Script AI

项目目标：开发一个小说转剧本工具。基础阶段先完成用户登录、小说导入、章节识别、结果展示和数据保存，为后续 AI 分析小说、生成结构化 YAML 剧本、Schema 校验、剧本编辑和导出功能打基础。

当前阶段只实现：

1. 功能 0：用户注册、登录、退出登录
2. 功能 1：小说导入与章节识别

不要实现 AI 生成、YAML Schema、剧本生成、剧本编辑、导出、角色分析、地点分析、场景分析等后续功能。

---

## 二、产品形态

当前版本采用 PC Web 网页端。

第一版只做浏览器网页应用，主要面向电脑端使用。后续版本可以扩展为桌面端或移动端。

页面语言：中文。

界面风格：干净、现代、整洁，偏 SaaS 工具风格。

---

## 三、技术栈要求

后端语言：Python

后端框架：Flask

数据库：MySQL

数据库连接库：mysql-connector-python

前端：原生 HTML、CSS、JavaScript

登录状态：使用 Flask session

密码处理：使用 Python 标准库 hashlib、secrets、hmac 实现密码哈希和校验，禁止明文保存密码。

第三方依赖当前只允许使用：

```txt
Flask
mysql-connector-python
```

不要使用：

```txt
Django
FastAPI
React
Vue
Vite
Bootstrap
Tailwind
jQuery
SQLAlchemy
Flask-Login
PyYAML
OpenAI SDK
DeepSeek SDK
Claude SDK
```

说明：第三方库和框架可以引用，但必须在 README.md 中列明依赖，并说明原创功能部分。

---

## 四、功能范围

### 功能 0：用户登录基础框架

需要实现：

1. 用户注册
2. 用户登录
3. 用户退出登录
4. 登录状态保持
5. 未登录用户不能访问主功能页面
6. 登录后才能进入小说导入与章节识别页面
7. 用户操作记录需要绑定当前登录用户

暂时不做：

1. 邮箱验证
2. 手机验证码
3. 找回密码
4. 第三方登录
5. 用户头像
6. 会员系统
7. 管理员后台
8. 权限分级

---

### 功能 1：小说导入与章节识别

需要实现：

1. 小说标题输入框
2. 小说正文粘贴输入
3. `.txt` 文件上传导入
4. 章节自动识别
5. 章节数量统计
6. 小说总字数统计
7. 每章字数统计
8. 章节列表展示
9. 章节正文展开查看
10. 章节标题可手动修改
11. 清空内容按钮，清空前必须二次确认
12. 重新识别按钮
13. 成功或失败提示
14. 识别完成后弹出提示框，告诉用户识别到了哪些章节
15. 保存小说导入记录到 MySQL
16. 保存章节识别结果到 MySQL

暂时不做：

1. AI 分析小说
2. AI 生成剧本
3. YAML 剧本生成
4. YAML Schema 校验
5. 剧本预览
6. 剧本导出
7. 角色、地点、场景抽取
8. 多版本生成
9. 移动端专门适配

---

## 五、页面路由设计

需要实现以下页面：

```txt
/register    注册页
/login       登录页
/logout      退出登录
/app         小说导入与章节识别主页面，必须登录后才能访问
/history     我的导入与章节识别记录页面
```

### 页面访问规则

1. 未登录用户访问 `/app`，自动跳转到 `/login`
2. 未登录用户访问 `/history`，自动跳转到 `/login`
3. 登录成功后跳转到 `/app`
4. 退出登录后跳转到 `/login`

---

## 六、数据库设计

数据库使用 MySQL。

请提供 `sql/init.sql` 初始化脚本。

### 1. users 用户表

```sql
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 2. novels 小说导入记录表

```sql
CREATE TABLE IF NOT EXISTS novels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  input_type VARCHAR(20) NOT NULL,
  original_text MEDIUMTEXT NOT NULL,
  total_word_count INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

字段说明：

```txt
input_type 可选值：
paste       粘贴文本
txt_upload  上传 txt 文件
```

### 3. chapters 章节表

```sql
CREATE TABLE IF NOT EXISTS chapters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  novel_id INT NOT NULL,
  user_id INT NOT NULL,
  chapter_index INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  word_count INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (novel_id) REFERENCES novels(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 4. chapter_parse_records 章节识别记录表

```sql
CREATE TABLE IF NOT EXISTS chapter_parse_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  novel_id INT NOT NULL,
  user_id INT NOT NULL,
  chapter_count INT NOT NULL,
  is_success TINYINT(1) NOT NULL,
  message VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (novel_id) REFERENCES novels(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 七、项目结构要求

请按以下结构创建项目：

```txt
novel2script/
├── README.md
├── requirements.txt
├── app.py
├── config.example.py
├── sql/
│   └── init.sql
├── src/
│   ├── __init__.py
│   ├── db.py
│   ├── auth.py
│   ├── chapter_parser.py
│   └── record_service.py
├── templates/
│   ├── login.html
│   ├── register.html
│   ├── app.html
│   └── history.html
├── static/
│   ├── style.css
│   └── main.js
└── tests/
    └── test_chapter_parser.py
```

### 文件职责

```txt
app.py
Flask 应用入口，负责路由注册和页面返回。

src/db.py
封装 MySQL 连接，不要在 app.py 里到处直接写数据库连接。

src/auth.py
负责用户注册、登录、密码哈希、密码校验、session 处理。

src/chapter_parser.py
负责原创章节识别逻辑、字数统计、章节切分。

src/record_service.py
负责保存小说记录、章节记录、章节识别记录。

templates/login.html
登录页。

templates/register.html
注册页。

templates/app.html
小说导入与章节识别主页面。

templates/history.html
用户历史导入与识别记录页面。

static/style.css
页面样式。

static/main.js
前端交互逻辑，负责调用后端 API、展示结果、清空确认、重新识别、展开章节正文。

tests/test_chapter_parser.py
章节识别逻辑测试。
```

---

## 八、配置要求

创建 `config.example.py`，内容示例：

```python
MYSQL_HOST = "localhost"
MYSQL_PORT = 3306
MYSQL_USER = "root"
MYSQL_PASSWORD = "your_password"
MYSQL_DATABASE = "novel2script"

SECRET_KEY = "replace_this_with_a_random_secret_key"
```

不要把真实数据库密码提交到代码仓库。

README 中说明用户需要复制：

```txt
config.example.py
```

为：

```txt
config.py
```

并填写自己的 MySQL 配置。

---

## 九、章节识别规则

章节标题必须出现在单独一行。

需要支持常见章节标题格式，具体格式可由开发时设计，但至少应支持：

```txt
第一章
第二章
第三章

第一章 雨夜来信
第二章 旧宅疑云

第1章
第2章
第3章

第001章
第002章

Chapter 1
Chapter 2

序章
楔子
番外
```

### 标题识别要求

1. 识别章节标题后面的名字
2. 例如 `第一章 雨夜来信`，完整标题显示为 `第一章 雨夜来信`
3. 所有章节标题默认根据识别结果展示
4. 识别结果中的章节标题可以手动修改
5. 不需要做复杂的章节格式模板系统

### 正文开头缺少标题的处理

如果正文开头有内容，但第一个正式标题在后面才出现，则把正文开头到第一个标题之前的内容作为一章。

默认标题可以设为：

```txt
未命名章节 1
```

如果全文没有任何章节标题，则把全文作为一章，标题设为：

```txt
未命名章节 1
```

并提示用户章节数量可能不足。

### 空白处理

识别时需要忽略：

1. 空行
2. 前后空白
3. 多余空格
4. 多余换行

---

## 十、字数统计规则

字数统计采用非空白字符统计。

中文、英文、数字都算字数。

空格、换行、制表符不计入字数。

例如：

```txt
第一章 你好 ABC 123
```

去掉空格和换行后计数。

---

## 十一、功能通过条件

基础版要求：

1. 正文总字数至少 100 字
2. 章节数量不设置上限
3. 系统需要识别章节数量
4. 课题要求是支持 3 个章节以上，因此如果识别到 3 章及以上，应显示成功提示
5. 如果识别少于 3 章，应显示提示，告诉用户当前识别到的章节数量可能不满足课题要求
6. 无论识别结果是否完美，都要展示识别出的章节列表，让用户自己检查是否正确

提示文案示例：

成功：

```txt
章节识别成功，共识别到 5 个章节。
```

不足 3 章：

```txt
当前仅识别到 2 个章节，可能不满足“三个章节以上”的课题要求，请检查章节标题格式。
```

正文字数不足：

```txt
小说正文至少需要 100 字，请补充内容后重新识别。
```

---

## 十二、小说导入方式

### 1. 粘贴文本

用户可以在页面 textarea 中直接粘贴小说正文。

### 2. `.txt` 上传

用户可以上传 `.txt` 文件。

要求：

1. 只支持 `.txt`
2. 上传后读取文件内容
3. 文件内容填充到正文输入框中
4. 用户仍然可以手动修改正文
5. 识别时记录 `input_type = txt_upload`
6. 如果用户直接粘贴正文，则记录 `input_type = paste`

暂时不支持：

```txt
.docx
.pdf
.md
.epub
```

---

## 十三、前端页面要求

### `/app` 页面包含

1. 页面标题：Novel2Script AI
2. 副标题：小说导入与章节识别
3. 当前登录用户名展示
4. 退出登录按钮
5. 小说标题输入框
6. 小说正文 textarea
7. `.txt` 文件上传控件
8. 识别章节按钮
9. 重新识别按钮
10. 清空内容按钮
11. 识别结果区域
12. 章节列表区域
13. 成功或失败提示区域

### 小说标题规则

小说标题可选。

如果用户不填写标题，后端默认使用：

```txt
未命名小说
```

### 清空内容规则

点击清空内容按钮时，必须弹出确认框。

确认文案：

```txt
确定要清空小说标题和正文内容吗？此操作不可恢复。
```

用户确认后才清空。

### 下一步按钮

第一版不要显示“下一步”按钮。

因为当前阶段只做小说导入与章节识别，不进入 AI 分析或 YAML 生成。

---

## 十四、识别结果展示要求

识别完成后页面需要显示：

1. 总字数
2. 章节数量
3. 每章标题
4. 每章字数
5. 每章正文可展开查看

注意：

1. 默认不显示章节正文预览
2. 需要提供展开按钮查看章节正文
3. 展开后可以看到该章节完整正文
4. 每个章节标题可以手动修改
5. 修改后需要能够保存到后端数据库

识别完成后弹出提示框，列出识别到的章节标题。

提示框内容示例：

```txt
章节识别完成，共识别到 3 个章节：

1. 第一章 雨夜来信
2. 第二章 旧宅疑云
3. 第三章 神秘电话

如果章节识别有误，请检查小说正文中的章节标题格式，或手动修改章节标题。
```

---

## 十五、后端 API 设计

### 1. 注册

```txt
POST /register
```

表单字段：

```txt
username
password
```

### 2. 登录

```txt
POST /login
```

表单字段：

```txt
username
password
```

### 3. 退出登录

```txt
GET /logout
```

### 4. 章节识别接口

```txt
POST /api/parse-chapters
```

请求 JSON：

```json
{
  "title": "雨夜来信",
  "content": "第一章 雨夜来信\n......",
  "inputType": "paste"
}
```

返回 JSON：

```json
{
  "success": true,
  "novelId": 1,
  "title": "雨夜来信",
  "totalWordCount": 12800,
  "chapterCount": 3,
  "isEnoughChapters": true,
  "message": "章节识别成功，共识别到 3 个章节。",
  "chapters": [
    {
      "id": 1,
      "index": 1,
      "title": "第一章 雨夜来信",
      "content": "本章完整正文……",
      "wordCount": 4200
    }
  ]
}
```

失败返回示例：

```json
{
  "success": false,
  "novelId": null,
  "title": "未命名小说",
  "totalWordCount": 50,
  "chapterCount": 0,
  "isEnoughChapters": false,
  "message": "小说正文至少需要 100 字，请补充内容后重新识别。",
  "chapters": []
}
```

### 5. 保存章节标题修改

```txt
POST /api/chapters/update-title
```

请求 JSON：

```json
{
  "chapterId": 1,
  "title": "第一章 新标题"
}
```

返回 JSON：

```json
{
  "success": true,
  "message": "章节标题已保存。"
}
```

### 6. 获取历史记录

```txt
GET /history
```

页面展示当前登录用户的小说导入与章节识别记录。

---

## 十六、章节识别返回数据结构

功能 1 阶段只整理章节识别相关数据。

不要在功能 1 中设计角色、地点、场景、对白等字段。

角色、地点、场景等数据属于下一步功能，不在本阶段开发。

章节数据结构：

```json
{
  "index": 1,
  "title": "第一章 雨夜来信",
  "content": "本章完整正文……",
  "wordCount": 4200
}
```

后端保存到数据库后，返回时增加：

```json
{
  "id": 1
}
```

---

## 十七、历史记录页面

`/history` 页面需要展示当前登录用户的识别记录。

基础版展示字段：

1. 小说标题
2. 输入方式
3. 总字数
4. 章节数量
5. 是否识别成功
6. 提示信息
7. 创建时间

不需要实现复杂详情页。

---

## 十八、README 要求

README.md 必须包含以下内容。

### 1. 项目简介

说明 Novel2Script AI 是一个小说转剧本工具，当前阶段实现用户登录、小说导入和章节识别。

### 2. 技术栈说明

写明：

```txt
后端：Python + Flask
数据库：MySQL
前端：原生 HTML/CSS/JavaScript
```

### 3. 第三方依赖说明

必须写明：

```txt
Flask：用于 Web 服务、页面路由、API 接口和 session 管理。
mysql-connector-python：用于连接 MySQL 数据库，保存用户、小说和章节识别记录。
```

### 4. 原创功能说明

必须写明：

```txt
本项目当前阶段原创功能包括：

1. 用户注册、登录、退出登录基础流程
2. 基于 Flask session 的登录状态保护
3. MySQL 用户表、小说表、章节表、章节识别记录表设计
4. 小说标题与正文输入页面
5. .txt 文件上传导入
6. 小说章节自动识别逻辑
7. 支持常见章节标题格式识别
8. 支持序章、楔子、番外识别
9. 小说总字数统计
10. 每章字数统计
11. 至少 100 字正文校验
12. 章节数量识别与提示
13. 章节识别结果展示
14. 章节正文展开查看
15. 章节标题手动修改
16. 当前用户导入与识别记录保存
```

### 5. 安装依赖

```bash
pip install -r requirements.txt
```

### 6. 初始化数据库

说明如何执行：

```sql
sql/init.sql
```

### 7. 启动项目

示例：

```bash
python app.py
```

---

## 十九、requirements.txt

内容：

```txt
Flask
mysql-connector-python
```

---

## 二十、测试要求

至少为 `src/chapter_parser.py` 写基础测试。

测试文件：

```txt
tests/test_chapter_parser.py
```

测试场景至少包含：

1. 识别 `第一章`、`第二章`、`第三章`
2. 识别 `第1章`、`第2章`、`第3章`
3. 识别 `Chapter 1`、`Chapter 2`
4. 识别 `序章`、`楔子`、`番外`
5. 正文开头无标题时自动生成 `未命名章节 1`
6. 全文没有标题时作为一章处理
7. 空行和前后空白被忽略
8. 字数统计按非空白字符计算

---

## 二十一、开发顺序建议

请按以下顺序开发：

1. 创建 Flask 项目结构
2. 创建 MySQL 初始化脚本
3. 实现数据库连接封装
4. 实现用户注册、登录、退出登录
5. 实现登录保护
6. 实现 `/app` 页面
7. 实现小说标题和正文输入
8. 实现 `.txt` 上传读取
9. 实现 `src/chapter_parser.py`
10. 实现 `/api/parse-chapters`
11. 保存小说记录、章节记录、识别记录到 MySQL
12. 前端展示识别结果
13. 实现章节正文展开查看
14. 实现章节标题修改并保存
15. 实现清空确认
16. 实现重新识别
17. 实现 `/history` 页面
18. 编写 README.md
19. 编写基础测试

---

## 二十二、禁止事项

当前阶段禁止实现：

```txt
AI 小说分析
AI 剧本生成
YAML 剧本生成
YAML Schema 校验
剧本编辑器
剧本导出
角色抽取
地点抽取
场景抽取
对白生成
移动端 App
桌面端 App
复杂权限系统
管理员后台
```

不要擅自扩大功能范围。

---

## 二十三、验收标准

功能 0 验收：

1. 用户可以注册
2. 用户可以登录
3. 用户可以退出登录
4. 未登录不能访问 `/app`
5. 登录后能访问 `/app`
6. 密码不能明文存储

功能 1 验收：

1. 用户可以输入小说标题
2. 小说标题为空时，自动使用 `未命名小说`
3. 用户可以粘贴小说正文
4. 用户可以上传 `.txt` 文件导入正文
5. 正文少于 100 字时提示错误
6. 系统可以自动识别章节
7. 系统可以识别章节标题后面的名字
8. 系统支持序章、楔子、番外
9. 正文开头没有标题时，会自动设为 `未命名章节 1`
10. 全文没有标题时，会作为一章处理
11. 系统显示总字数
12. 系统显示章节数量
13. 系统显示每章标题
14. 系统显示每章字数
15. 每章正文可以展开查看
16. 章节标题可以手动修改并保存
17. 点击清空内容时必须二次确认
18. 点击重新识别可以重新提交当前文本
19. 识别完成后弹窗列出识别到的章节
20. 识别记录保存到 MySQL
21. 历史记录页面只显示当前登录用户自己的记录
22. README 中列明所有第三方依赖
23. README 中说明原创功能部分
24. 不实现任何后续 AI、YAML、剧本生成相关功能

---

## 二十四、最终目标

完成后，用户可以完成以下流程：

```txt
注册账号
登录系统
进入 Novel2Script AI 主页面
输入小说标题
粘贴小说正文或上传 .txt 文件
点击识别章节
系统自动识别章节
系统展示总字数、章节数量、每章标题、每章字数
用户可以展开查看章节正文
用户可以手动修改章节标题
系统把小说导入记录和章节识别结果保存到 MySQL
用户可以在历史记录页面看到自己的识别记录
```

当前阶段只需要跑通这个闭环。
