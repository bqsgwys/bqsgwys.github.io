import Image from "next/image";

const aliasTraditional = "\u8056\u5149";
const aliasSimplified = "\u5723\u5149";
const aliasKatakana = "\u30AD\u30E8\u30C6\u30EB";
const aliasHiragana = "\u304D\u3088\u3066\u308B";

const entry = {
  term: "Kiyoteru",
  pronunciation: "/ki-yo-te-ru/",
  partOfSpeech: "H. Sapiens",
  definitionItems: [
    "PhD student focused on BCI and circuits.",
    "Band member and DJ.",
    "CR/JR railway fan.",
    "Seiyuu devotee.",
    "Dota player.",
  ],
};

const links = [
  { title: "Blog", subtitle: "TBD", href: "/", avatar: "/avatars/blog.svg", theme: "blog" },
  {
    title: "Radio",
    subtitle: "@DJ_Kiyoteru",
    href: "/",
    avatar: "/avatars/radio.svg",
    theme: "radio",
  },
  {
    title: "Bilibili",
    subtitle: `@${aliasTraditional}Kiyoteru`,
    href: "https://space.bilibili.com/13131167",
    avatar: "/avatars/bilibili.svg",
    theme: "bilibili",
  },
  {
    title: "Github",
    subtitle: "@bqsgwys",
    href: "https://github.com/bqsgwys",
    avatar: "/avatars/github.svg",
    theme: "github",
  },
  {
    title: "Jisedai Club",
    subtitle: "Registry",
    href: "https://reg.thujsd.club/",
    avatar: "/avatars/club.svg",
    theme: "thujsd",
  },
];

export default function Home() {
  return (
    <main className="home">
      <section className="entry" aria-label="Profile entry">
        <header className="entry-header">
          <h1 className="word">
            {entry.term}
            <span className="pronunciation">{entry.pronunciation}</span>
          </h1>
          <p className="aliases">
            {aliasTraditional} / {aliasSimplified} / {aliasHiragana} /{" "}
            {aliasKatakana}
          </p>
        </header>

        <div className="sense-line">
          <em className="part">{entry.partOfSpeech}</em>
          <ul className="definition-list">
            {entry.definitionItems.map((item) => (
              <li className="definition-item" key={item}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <nav className="link-stack" aria-label="External links">
          {links.map((link) => {
            const isExternal = link.href.startsWith("http");
            return (
              <a
                className={`link-btn link-btn--${link.theme}`}
                href={link.href}
                key={link.title}
                rel={isExternal ? "noreferrer" : undefined}
                target={isExternal ? "_blank" : undefined}
              >
                <span className="link-left">
                  <span aria-hidden="true" className="link-avatar">
                    <Image
                      alt=""
                      className="link-avatar-img"
                      height={40}
                      src={link.avatar}
                      width={40}
                    />
                  </span>
                  <span className="link-main">
                    <span className="link-title">{link.title}</span>
                    <span className="link-subtitle">{link.subtitle}</span>
                  </span>
                </span>
                <span aria-hidden="true" className="link-arrow">
                  -&gt;
                </span>
              </a>
            );
          })}
        </nav>
      </section>
    </main>
  );
}
