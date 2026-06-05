# qiniu-demo

## 项目简介

本项目为比赛参赛项目仓库，当前阶段仅完成仓库初始化，后续功能将通过独立 PR 持续交付。

## 选定赛题方向

小说转剧本 AI 工具。

当前计划采用多模块目录管理：

* `backend/`：后端服务
* `frontend/`：前端应用
* `docs/`：项目文档与功能范围说明

## 安装与启动方式

### 后端

```bash
cd backend
pip install -r requirements.txt
copy config.example.py config.py
python app.py
```

运行前需要先在 `backend/config.py` 中填写本地 MySQL 连接信息，并执行 `backend/sql/init.sql` 初始化数据库。

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端默认通过 `NEXT_PUBLIC_API_URL` 连接后端 API；未设置时使用 `http://localhost:5000`。

## 目录结构

```text
qiniu-demo/
├── README.md
├── CONTRIBUTING.md
├── docs/
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── public/
│   └── src/
└── backend/
    ├── app.py
    ├── config.example.py
    ├── requirements.txt
    ├── sql/
    ├── src/
    └── tests/
```

## 依赖列表

### 后端依赖

| 依赖 | 用途 |
|------|------|
| Flask | 提供后端 Web API 服务 |
| mysql-connector-python | 连接 MySQL 数据库 |

### 前端依赖

| 依赖 | 用途 |
|------|------|
| Next.js | 前端应用框架 |
| React | 构建前端交互界面 |
| React DOM | React 浏览器渲染 |
| TypeScript | 前端类型检查 |
| Tailwind CSS | 前端样式工具 |
| ESLint | 前端代码检查 |
| concurrently | 本地同时启动前后端 |

后续如新增第三方库或框架，必须在本章节列明。原则上优先避免不必要的第三方依赖。

## 团队成员与分工

| 成员 | 分工 |
|------|------|
| @xingheliu816-sys | 项目开发与交付 |

## 原创功能与复用说明

当前仓库包含初始化文档、目录结构、后端基础模块和前端基础模块。

* 原创内容：README、CONTRIBUTING、基础目录结构、后端用户与小说章节识别基础代码、前端页面与交互代码
* 复用内容：无

后续如复用过往代码片段，必须在对应 PR 描述和本章节中注明来源。

## 演示视频链接

待补充。

比赛收尾前需上传带声音讲解的演示视频，并在此处填写可播放链接。

## PR 与提交规范

本项目遵守持续交付要求：

* 每个 PR 只做一件事。
* 禁止最后一天一次性导入全部代码。
* PR 描述必须包含功能描述、实现思路、测试方式、分工、依赖与来源。
* main 分支在每次 PR 合并后应保持可运行状态。
