import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { X, Trash2 } from "lucide-react";

export function Sheet({
  title,
  onClose,
  children,
  onDelete,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  onDelete?: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {onDelete && (
          <button className="btn-delete" onClick={onDelete}>
            <Trash2 size={17} /> Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function NumInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" inputMode="decimal" className="num-input" {...props} />;
}

export function SumInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => {
    setText(value ?? "");
  }, [value]);

  function commit() {
    const hasComma = text.includes(",");
    const sum = sumFromTextLocal(text);
    const next = text.trim() === "" ? "" : String(sum);
    setText(next);
    if (hasComma || next !== value) onChange(next);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className="num-input"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      placeholder={placeholder}
    />
  );
}

function sumFromTextLocal(text: string): number {
  if (!text) return 0;
  const parts = text
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n));
  if (parts.length === 0) return 0;
  return Math.round((parts.reduce((a, b) => a + b, 0) + Number.EPSILON) * 100) / 100;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button type="button" className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="toggle-knob" />
      <span className="toggle-label">{label}</span>
    </button>
  );
}

export function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="empty">
      {icon}
      <p>{text}</p>
    </div>
  );
}
