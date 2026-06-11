import "./matrix.css";

export default function MatrixLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="matrix-theme">{children}</div>;
}
