type Props = {
  value: string;
  tone?: "status" | "priority";
};

function normalize(value: string) {
  return String(value || "").toUpperCase();
}

export function StatusBadge({ value, tone = "status" }: Props) {
  const v = normalize(value);
  const css = `badge ${tone} ${v.toLowerCase()}`;
  return <span className={css}>{v.replaceAll("_", " ")}</span>;
}
