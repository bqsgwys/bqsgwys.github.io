import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

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

type LinkTheme =
  | "blog"
  | "radio"
  | "rhyme"
  | "bilibili"
  | "github"
  | "thujsd";

type LinkItem = {
  title: string;
  subtitle: string;
  href: string;
  avatar: string;
  theme: LinkTheme;
};

const links: LinkItem[] = [
  { title: "Blog", subtitle: "TBD", href: "/", avatar: "/avatars/blog.svg", theme: "blog" },
  {
    title: "Radio",
    subtitle: "@DJ_Kiyoteru",
    href: "/",
    avatar: "/avatars/radio.svg",
    theme: "radio",
  },
  {
    title: "rhyme",
    subtitle: "Annotating Chinese Rhyme",
    href: "/rhyme/",
    avatar: "/avatars/rhyme.svg",
    theme: "rhyme",
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

const linkThemeClassMap: Record<LinkTheme, string> = {
  blog: styles.linkBtnBlog,
  radio: styles.linkBtnRadio,
  rhyme: styles.linkBtnrhyme,
  bilibili: styles.linkBtnBilibili,
  github: styles.linkBtnGithub,
  thujsd: styles.linkBtnThujsd,
};

export default function Home() {
  return (
    <main className={styles.home}>
      <section className={styles.entry} aria-label="Profile entry">
        <header className={styles.entryHeader}>
          <h1 className={styles.word}>
            {entry.term}
            <span className={styles.pronunciation}>{entry.pronunciation}</span>
          </h1>
          <p className={styles.aliases}>
            {aliasTraditional} / {aliasSimplified} / {aliasHiragana} /{" "}
            {aliasKatakana}
          </p>
        </header>

        <div className={styles.senseLine}>
          <em className={styles.part}>{entry.partOfSpeech}</em>
          <ul className={styles.definitionList}>
            {entry.definitionItems.map((item) => (
              <li className={styles.definitionItem} key={item}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <nav className={styles.linkStack} aria-label="External links">
          {links.map((link) => {
            const isExternal = link.href.startsWith("http");
            const content = (
              <>
                <span className={styles.linkLeft}>
                  <span aria-hidden="true" className={styles.linkAvatar}>
                    <Image
                      alt=""
                      className={styles.linkAvatarImg}
                      height={40}
                      src={link.avatar}
                      width={40}
                    />
                  </span>
                  <span className={styles.linkMain}>
                    <span className={styles.linkTitle}>{link.title}</span>
                    <span className={styles.linkSubtitle}>{link.subtitle}</span>
                  </span>
                </span>
                <span aria-hidden="true" className={styles.linkArrow}>
                  -&gt;
                </span>
              </>
            );

            if (isExternal) {
              return (
                <a
                  className={`${styles.linkBtn} ${linkThemeClassMap[link.theme]}`}
                  href={link.href}
                  key={link.title}
                  rel="noreferrer"
                  target="_blank"
                >
                  {content}
                </a>
              );
            }

            return (
              <Link
                className={`${styles.linkBtn} ${linkThemeClassMap[link.theme]}`}
                href={link.href}
                key={link.title}
              >
                {content}
              </Link>
            );
          })}
        </nav>
      </section>
    </main>
  );
}
