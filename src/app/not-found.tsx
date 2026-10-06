import Link from "next/link";

export default function NotFound() {
  return (
    <div className="share">
      <Link href="/" className="brand">
        Fanth<i>o</i>m
      </Link>
      <h1 className="quote" style={{ marginTop: 40 }}>
        Nothing here.
      </h1>
      <p className="muted" style={{ maxWidth: "52ch" }}>
        This meeting or clip does not exist, or the link was cut short. The demo workspace has nine recorded
        meetings you can open without signing in.
      </p>
      <Link className="btn primary" href="/" style={{ marginTop: 16 }}>
        Go to meetings
      </Link>
    </div>
  );
}
