import type { Metadata } from "next";
import {
  Database,
  Download,
  KeyRound,
  Lock,
  Search,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ReindexButton } from "@/components/reindex-button";
import { getLlmSetupStatus } from "@/lib/ai/config";
import { getEmbeddingStatus } from "@/lib/ai/embedding-config";
import { databasePath } from "@/lib/db";
import { getStats } from "@/lib/modules/entries/service";
import { getIndexStatus } from "@/lib/modules/search/indexer";
import {
  cardClass,
  cardHeaderClass,
  cardTitleClass,
} from "@/lib/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "设置" };
export const dynamic = "force-dynamic";

function StatusBadge({
  tone,
  children,
}: {
  tone: "ready" | "warning" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
        tone === "ready"
          ? "bg-success/10 text-success"
          : tone === "warning"
            ? "bg-warning/10 text-warning"
            : "bg-surface-soft text-ink-faint",
      )}
    >
      {children}
    </span>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cardClass}>
      <div className={cardHeaderClass}>
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-ink-faint" />
          <h2 className={cardTitleClass}>{title}</h2>
        </div>
        {description ? (
          <span className="text-[10px] text-ink-faint">
            {description}
          </span>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface-soft p-3 text-[11px] leading-5 text-ink-soft">
      {children}
    </pre>
  );
}

export default function SettingsPage() {
  const stats = getStats();
  const llm = getLlmSetupStatus();
  const embedding = getEmbeddingStatus();
  const index = getIndexStatus();

  return (
    <div>
      <PageHeader
        title="设置"
        description="模型、搜索、本地数据和隐私。"
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Section
          icon={Sparkles}
          title="对话模型"
          description="用于助手回答"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-ink">
                {llm.providerLabel}
              </p>
              <p className="mt-1 text-[11px] text-ink-faint">
                {llm.configured ? llm.model : "尚未配置"}
              </p>
            </div>
            <StatusBadge
              tone={llm.configured ? "ready" : "warning"}
            >
              {llm.configured ? "已就绪" : "未配置"}
            </StatusBadge>
          </div>

          {llm.configured ? (
            <dl className="mt-4 space-y-2 border-t border-line pt-3 text-[11px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Base URL</dt>
                <dd className="max-w-[70%] break-all text-right font-mono text-[10px] text-ink-soft">
                  {llm.baseUrl}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">模型</dt>
                <dd className="font-mono text-[10px] text-ink-soft">
                  {llm.model}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">API Key</dt>
                <dd className="text-ink-soft">已配置（不会显示）</dd>
              </div>
            </dl>
          ) : (
            <>
              <p className="mt-4 text-[11px] leading-5 text-ink-soft">
                复制{" "}
                <code className="rounded bg-surface-soft px-1 py-0.5 text-[10px]">
                  .env.example
                </code>{" "}
                为{" "}
                <code className="rounded bg-surface-soft px-1 py-0.5 text-[10px]">
                  .env.local
                </code>
                ，填入后重启服务。
              </p>
              <CodeBlock>{`LLM_PROVIDER=deepseek
LLM_API_KEY=你的密钥
# LLM_CHAT_MODEL=deepseek-chat`}</CodeBlock>
              <p className="mt-2 text-[10px] text-ink-faint">
                当前缺少：{llm.missing.join("、")}
              </p>
            </>
          )}
        </Section>

        <Section
          icon={Search}
          title="智能搜索"
          description="用于搜索和助手回忆"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-ink">
                {embedding.configured
                  ? embedding.model
                  : "未配置 Embedding"}
              </p>
              <p className="mt-1 text-[11px] text-ink-faint">
                {embedding.configured
                  ? `${embedding.dim} 维 · ${embedding.baseUrl}`
                  : "关键词与时间检索仍可用"}
              </p>
            </div>
            <StatusBadge
              tone={
                !embedding.configured
                  ? "neutral"
                  : index.stale
                    ? "warning"
                    : "ready"
              }
            >
              {!embedding.configured
                ? "未开启"
                : index.stale
                  ? "需更新"
                  : "已就绪"}
            </StatusBadge>
          </div>

          <dl className="mt-4 space-y-2 border-t border-line pt-3 text-[11px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-faint">已收录</dt>
              <dd className="text-ink-soft">
                {index.indexedEntries} / {index.totalEntries} 条
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-faint">片段 / 向量</dt>
              <dd className="text-ink-soft">
                {index.chunkCount} / {index.vectorCount}
              </dd>
            </div>
          </dl>

          {index.stale ? (
            <p className="mt-3 text-[12px] text-warning">
              搜索数据和当前设置对不上，建议更新一下。
            </p>
          ) : null}

          <div className="mt-4">
            <ReindexButton />
          </div>

          {!embedding.configured ? (
            <>
              <p className="mt-4 text-[11px] leading-5 text-ink-soft">
                在{" "}
                <code className="rounded bg-surface-soft px-1 py-0.5 text-[10px]">
                  .env.local
                </code>{" "}
                中添加：
              </p>
              <CodeBlock>{`EMBEDDING_API_KEY=你的密钥
# EMBEDDING_MODEL=text-embedding-v3
# EMBEDDING_DIM=1024`}</CodeBlock>
              <p className="mt-2 text-[10px] leading-4 text-ink-faint">
                默认使用通义 text-embedding-v3（1024 维）。DeepSeek
                没有 Embedding 接口。
              </p>
            </>
          ) : null}
        </Section>

        <Section
          icon={Database}
          title="本地数据"
          description="SQLite"
        >
          <dl className="space-y-2 text-[11px]">
            <div>
              <dt className="text-ink-faint">存储位置</dt>
              <dd className="mt-1 break-all font-mono text-[10px] leading-5 text-ink-soft">
                {databasePath}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-2.5">
              <dt className="text-ink-faint">记录</dt>
              <dd className="text-ink-soft">
                {stats.total} 条 ·{" "}
                {stats.characters.toLocaleString("zh-CN")} 字
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-faint">连续记录</dt>
              <dd className="text-ink-soft">{stats.streak} 天</dd>
            </div>
          </dl>

          <a
            href="/api/export"
            download
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-soft transition hover:border-line-strong hover:bg-surface-soft hover:text-ink"
          >
            <Download size={13} />
            导出全部数据（JSON）
          </a>
          <p className="mt-2 text-[10px] leading-4 text-ink-faint">
            建议定期备份 data 目录与导出文件。
          </p>
        </Section>

        <Section
          icon={Lock}
          title="隐私"
          description="本地优先"
        >
          <ul className="space-y-2 text-[11px] leading-5 text-ink-soft">
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
              服务只在本机运行，不对外网开放。
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
              「只在本机」的记录不进入搜索，也不会发送给云端模型。
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
              API Key 只保存在本机 .env.local，不写入数据库。
            </li>
          </ul>
        </Section>

        <Section
          icon={KeyRound}
          title="模型说明"
          description="接入方式"
        >
          <ul className="space-y-2 text-[11px] leading-5 text-ink-soft">
            <li>对话模型支持 DeepSeek / GLM / 通义千问，以及任意 OpenAI 兼容服务。</li>
            <li>Embedding 默认使用通义 text-embedding-v3，固定 1024 维。</li>
            <li>更换 Embedding 模型或维度后，需要更新搜索。</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
