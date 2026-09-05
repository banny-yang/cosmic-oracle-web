import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    links: [
      { rel: "canonical", href: "https://www.oracle.duimai.net/privacy" },
    ],
    meta: [
      { title: "隐私政策 · 对脉名鉴" },
      {
        name: "description",
        content: "对脉名鉴隐私政策：我们收集哪些信息、如何使用与保护、如何删除你的数据。",
      },
    ],
  }),
});

function PrivacyPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="法律文件"
        title="隐私政策"
        desc="我们尽可能少地收集信息，并用直白的话说明它们的去向。最近更新：2026 年 9 月。"
      />
      <div className="mt-8 space-y-7 pb-4">
        <Section title="我们收集哪些信息">
          <P>在使用对脉名鉴时，我们仅收集为提供服务所必需的信息：</P>
          <Ul
            items={[
              "账号信息：手机号码或微信开放平台标识（用于登录与身份识别）；昵称与头像（可自行设置，可不提供）。",
              "出生信息：为生成起名与解析内容所需的出生日期、时间与地点。这些内容仅用于计算，不会用于其他用途。",
              "姓名等输入内容：你在解析、测评等功能中输入的姓名与偏好。",
              "服务数据：点数余额、购买与解锁记录、生成历史，用于在你重新登录后找回内容。",
              "设备信息：访问时间、页面地址等基础统计，用于改进产品体验。",
            ]}
          />
        </Section>
        <Section title="我们如何使用信息">
          <P>
            收集的信息仅用于：提供你请求的生成与解析服务、保持网页端与小程序端的数据同步、保障账号与交易安全、以及汇总统计产品使用情况。我们不会出售你的个人信息，也不会用于与提供服务无关的营销用途。
          </P>
        </Section>
        <Section title="信息的存储与保护">
          <P>
            数据存储于中国境内的服务器，传输过程使用加密连接。我们采取合理的访问控制与技术措施保护你的数据，但请理解互联网环境不存在绝对安全。
          </P>
        </Section>
        <Section title="如何删除你的数据">
          <P>
            你可以在「我的」页面删除出生信息；如需注销账号并删除全部数据，请通过小程序内的客服入口或发邮件到
            <span className="text-vermilion-deep"> support@duimai.net</span>，我们会在核实身份后 15
            个工作日内处理。
          </P>
        </Section>
        <Section title="未成年人保护">
          <P>
            本服务面向为新生儿与家人起名的成年用户。我们不会有意收集未成年人的个人信息；若你发现我们在不知情下收集了相关信息，请联系我们删除。
          </P>
        </Section>
        <Section title="政策更新">
          <P>政策有重大调整时，我们会在页面内提示。继续使用服务视为接受更新后的政策。</P>
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
