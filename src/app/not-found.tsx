import Link from "next/link";
export default function NotFound() {
  return (
    <section className="panel">
      <h1>没有找到这条记录</h1>
      <p>它可能已被删除，或链接不正确。</p>
      <Link className="button" href="/">
        返回投递列表
      </Link>
    </section>
  );
}
