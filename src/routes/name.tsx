import { createFileRoute, redirect } from "@tanstack/react-router";

// 历史/抓取到的单数链接统一 301 到名字灵感库，避免长期 404 浪费爬虫配额
export const Route = createFileRoute("/name")({
  beforeLoad: () => {
    throw redirect({ to: "/names", search: {}, statusCode: 301 });
  },
});
