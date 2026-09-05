import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    links: [
      { rel: "canonical", href: "https://www.oracle.duimai.net/terms" },
    ],
    meta: [
      { title: "用户协议 · 对脉名鉴" },
      {
        name: "description",
        content: "对脉名鉴用户协议：服务性质、点数与付费规则、使用规范与免责声明。",
      },
    ],
  }),
});

function TermsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="法律文件"
        title="用户协议"
        desc="使用对脉名鉴即表示你同意以下条款。最近更新：2026 年 9 月。"
      />
      <div className="mt-8 space-y-7 pb-4">
        <Section title="服务性质">
          <P>
            对脉名鉴是基于传统文化（字义、音韵、诗词典故、五格数理等）与统计模型整理的姓名文化参考工具。全部生成与解析内容仅供文化参考与娱乐，不构成任何预测、占卜、医疗、法律或投资建议，也不对使用结果作任何明示或默示的保证。
          </P>
        </Section>
        <Section title="账号与互通">
          <P>
            你可以通过手机验证码或微信登录。网页端与「对脉名鉴」微信小程序使用同一账号体系，解析记录、点数余额与解锁内容双端同步。
          </P>
        </Section>
        <Section title="点数与付费规则">
          <Ul
            items={[
              "解析与测评类功能按次消耗点数，各功能消耗数在页面明示后才会扣减。",
              "点数充值在微信小程序内完成，充值档位与价格以小程序内展示为准；网页端与小程序端点数通用。",
              "点数是服务使用权凭证，不支持转让；已消耗点数不退不换。",
              "因系统故障导致扣点但未获得内容的，经核实后我们会补还相应点数。",
              "如需退款，请通过小程序客服或 support@duimai.net 联系我们，按相关法律法规处理。",
            ]}
          />
        </Section>
        <Section title="使用规范">
          <P>
            请勿利用本服务从事违法违规活动、批量抓取内容或干扰服务正常运行。我们保留对违规账号限制或终止服务的权利。
          </P>
        </Section>
        <Section title="内容与知识产权">
          <P>
            生成内容中引用的古籍出处属于公有领域；页面设计、文案与程序本身的知识产权归对脉科技（武汉）有限公司所有。你对自己输入的姓名等信息保留全部权利。
          </P>
        </Section>
        <Section title="协议变更">
          <P>协议有重大调整时，我们会在页面内提示。继续使用服务视为接受更新后的协议。</P>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-paper-2/60 p-6 ring-1 ring-ink/5">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-ink-soft">{children}</p>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-vermilion" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
