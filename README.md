# 个人生活助手 · Personal Life Assistant

> 本地优先的个人生活记录与回顾助手。记下发生的事，回头看看。

当前进度：**P2 — 记录 + 助手 + 搜索**。

---

## 产品定位

这不是工作台账，也不是文艺向的日记。它是一套围绕生活记录与回顾的助手：

- 记下发生了什么、和谁在一起、当时的心情，以及后来怎样
- 用类别、事情的类型、分量、心情和时间精度组织记录
- 助手基于你记下的事，一起看看、聊聊、回看，并引用到原文
- 支持只记得年份或月份的模糊时间
- 所有数据保存在本机

## 现在能做什么

### 记录

- **结构化记录**：标题、描述、类别、事情类型、分量、心情、后来、一起的人、标签、地点、想记得的日子
- **五类事情**：日常、决定、转折点、烦心事、见面
- **七类类别**：工作、健康、关系、学习、财务、生活、其他
- **模糊时间**：具体时间 / 仅日期 / 仅月份 / 仅年份，可加时间补充（如「夏天」「毕业后」）
- **筛选与搜索**：关键词、类别、类型、最低分量、年份、标签
- **想记得**：有日期的记录会在详情里留下一个想再想起的日子
- **数据导出**：一键导出全部记录为 JSON

### 今天

- 记下的件数、连续记录天数、最近的心情
- 快速记下此刻
- 最近的日子
- 最近的心情、常出现的人、生活的重心

### 助手

- 流式回答，基于记录检索结果 + 最近记录
- 四种模式：聊聊、梳理、一起想、回看
- 回答带引用，点击回到来源记录
- 会话保存在本地
- 支持「2015 年我在做什么」这类按时间提问

### 搜索

- 中文关键词 + FTS5 + 向量语义召回，RRF 融合
- 自然语言时间解析：「2019 年」「去年」「上个月」「今天」
- 按年份、类别、类型筛选
- 结果带片段、命中方式和原文链接
- 搜索状态与一键更新

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16（App Router）+ TypeScript |
| UI | Tailwind CSS 4 + lucide-react |
| 数据库 | SQLite（better-sqlite3）+ Drizzle ORM |
| 全文检索 | SQLite FTS5（trigram）+ 中文 bigram 兜底 |
| 向量检索 | sqlite-vec（1024 维，带时间元数据过滤） |
| 模型接入 | OpenAI 兼容 Chat Completions + Embeddings |
| 后台任务 | 计划 P3 使用 instrumentation + node-cron |

## 快速开始

要求 Node.js 20.9+（本项目在 Node 22 上开发）。

```bash
npm install
npm run dev
```

打开 http://localhost:3000。

## 配置对话模型

```bash
cp .env.example .env.local
```

```dotenv
LLM_PROVIDER=deepseek
LLM_API_KEY=你的密钥
```

| `LLM_PROVIDER` | 平台 | 默认 Base URL | 默认模型 |
|---|---|---|---|
| `deepseek` | DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| `glm` | 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus` |
| `qwen` | 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| `custom` | 任意 OpenAI 兼容服务 | 必须设置 `LLM_BASE_URL` | 必须设置 `LLM_CHAT_MODEL` |

> 模型 ID 会随平台更新，以各平台文档为准，可用 `LLM_CHAT_MODEL` 覆盖。

## 配置语义检索

```dotenv
EMBEDDING_API_KEY=你的密钥
# 默认使用通义 text-embedding-v3（1024 维）
# EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
# EMBEDDING_MODEL=text-embedding-v3
# EMBEDDING_DIM=1024
```

- DeepSeek 没有 Embedding 接口，默认使用通义。
- 也可配置任意 OpenAI 兼容的 `/embeddings` 服务；P2 固定 1024 维。
- 更换 Embedding 模型或维度后，在设置页点击「重建索引」。
- 不配置也能用关键词、年份筛选和按时间浏览，只是没有语义召回。

## 没有 API Key？用本地 Mock

```bash
# 终端 A
npm run mock:llm
```

```dotenv
# .env.local
LLM_PROVIDER=custom
LLM_API_KEY=mock
LLM_BASE_URL=http://127.0.0.1:3300/v1
LLM_CHAT_MODEL=mock-model

EMBEDDING_API_KEY=mock
EMBEDDING_BASE_URL=http://127.0.0.1:3300/v1
EMBEDDING_MODEL=mock-embedding
EMBEDDING_DIM=1024
```

Mock 的 Embedding 是字符级特征，只用于验证链路，不代表真实语义质量。

## 数据与隐私

- 数据库：`data/life.db`（首次启动自动创建）
- 导出：设置页 →「导出全部数据（JSON）」
- 备份：复制整个 `data/` 目录
- 自定义数据目录：`LIFE_DATA_DIR`

**隐私边界**：标记为「只在本机」的记录不建立索引、不出现在搜索结果，也不会发送给云端模型。API Key 只保存在 `.env.local`，不写入数据库。

**搜索说明**：新建或修改记录时会自动分块、建立关键词索引并生成向量。更换 Embedding 模型后旧向量不可复用，需要更新搜索。

## 开发验证

```bash
npm run typecheck   # 类型检查
npm run lint        # 代码检查
npm run build       # 生产构建
npm run db:check    # SQLite + sqlite-vec 冒烟测试
npm run test:e2e    # 事件 / API / 页面端到端测试
npm run test:chat   # 助手流式、引用与隐私端到端测试
npm run test:search # 混合检索、年份与模糊时间端到端测试
```

对话与检索测试建议使用独立 Mock 和数据目录：

```bash
# 终端 A
npm run mock:llm

# 终端 B（Git Bash）
LIFE_DATA_DIR=./.tmp-test-data \
  LLM_PROVIDER=custom LLM_API_KEY=mock \
  LLM_BASE_URL=http://127.0.0.1:3300/v1 LLM_CHAT_MODEL=mock-model \
  EMBEDDING_API_KEY=mock EMBEDDING_BASE_URL=http://127.0.0.1:3300/v1 \
  EMBEDDING_MODEL=mock-embedding EMBEDDING_DIM=1024 \
  npm run dev -- -p 3100

# 终端 C
BASE_URL=http://127.0.0.1:3100 npm run test:e2e
BASE_URL=http://127.0.0.1:3100 npm run test:chat
BASE_URL=http://127.0.0.1:3100 EXPECT_EMBEDDINGS=1 npm run test:search
```

测试脚本只创建带唯一标记的测试数据，并在结束时删除。

## 项目结构

```
app/
├─ page.tsx                     # 概览
├─ events/                      # 事件列表 / 详情 / 新建 / 编辑
├─ assistant/                   # 助手列表 / 新对话 / 对话详情
├─ search/                      # 混合检索与年份浏览
├─ settings/                    # 模型、索引、数据、隐私、路线图
└─ api/
   ├─ events/                   # 事件 CRUD（自动建立索引）
   ├─ search/                   # 检索与重建索引
   ├─ chat/                     # 流式对话（SSE）
   ├─ export/                   # 全量导出
   └─ health/                   # SQLite + 向量扩展自检

components/                     # 侧边栏、事件表单、事件行、图表、助手界面
lib/
├─ ai/                          # 对话与 Embedding 配置、流式客户端
├─ db/                          # Drizzle schema、连接、DDL 与迁移
├─ modules/entries/             # 事件领域服务、统计、跟进
├─ modules/search/              # 分块、索引、混合检索、时间解析
├─ modules/chat/                # 会话、消息、上下文与提示词组装
├─ event-meta.ts                # 类别、类型、重要性、情绪、隐私
├─ time-precision.ts            # 年/月/日/精确时间
├─ citations.ts                 # 引用标记解析
├─ chat-modes.ts                # 四种助手模式
└─ ui.ts                        # 设计系统 class tokens
scripts/
├─ smoke-db.mjs
├─ mock-llm-server.mjs
├─ e2e-test.mjs
├─ e2e-chat.mjs
└─ e2e-search.mjs
docs/P3-plan.md                 # P3 记忆与画像计划（未开始）
```

## 设计原则

1. **记录优先**：记下生活里发生的事，而不是散文式日记或工作台账。
2. **时间可以模糊**：只记得哪一年也值得记录；系统用时间区间表达不确定性。
3. **一切可溯源**：助手引用记录，点击回到原文。
4. **温和、克制**：暖纸色和留白；日期与数字作为视觉锚点，不堆装饰。
5. **检索而非全量**：助手先检索相关记录，再补充最近记录。
6. **本地优先**：数据留在本机；「只在本机」的记录不索引、不发送。

## 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 生活记录、时间线、搜索、导出 | ✅ 完成 |
| P1 | 流式对话、上下文、引用 | ✅ 完成 |
| P2 | 混合检索、模糊时间、回忆/搜索 | ✅ 完成 |
| P3 | 记忆提炼、用户画像、夜间任务 | 计划中（见 `docs/P3-plan.md`） |
| P4 | 回顾、愿望、导入与备份 | 计划中 |

## 注意

- 单用户、本地运行，请不要直接暴露到公网。
- `better-sqlite3` 与 `sqlite-vec` 在 Windows x64 / Node 22 上已验证可用。

## 许可证

[MIT](LICENSE)
- 配置 Embedding 后保存记录会同步生成向量，可能多等一小会儿；后续会移到后台任务。
- P2 固定使用 1024 维向量；更换维度需要重建索引。
