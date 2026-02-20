type Props = {
  title: string;
  subtitle: string;
};

export function Header({ title, subtitle }: Props) {
  return (
    <header className="app-header">
      <div>
        <h1>{title}</h1>
        <p className="subtle">{subtitle}</p>
      </div>
      <div className="online-pill">● Live</div>
    </header>
  );
}
