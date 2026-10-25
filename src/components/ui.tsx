import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
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

// Campo que suma varios montos: "300,450,125.50" o "300+450+125.50" (el
// teclado numérico del celular no tiene coma, por eso el botón "+"). Al
// salir del campo queda solo el total.
export function SumInput({
  value,
  onChange,
  placeholder,
  sumar,
  onPartes,
  alEscribir,
}: {
  value: string;
  onChange: (v: string) => void;
  // Lo que va escrito, en cada tecla (onChange solo avisa al salir del campo).
  alEscribir?: (texto: string) => void;
  placeholder?: string;
  // Recibe los montos sueltos al sumar ("300+450" → [300, 450]); undefined
  // si quedó un solo monto.
  onPartes?: (partes: number[] | undefined) => void;
  // Muestra el botón "+" y la suma en vivo — para campos donde se suman montos.
  sumar?: boolean;
}) {
  const [text, setText] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setText(value ?? "");
  }, [value]);

  const montos = partirMontos(text);
  const variasPartes = /[,+]/.test(text);

  function commit() {
    const sum = sumFromTextLocal(text);
    const next = text.trim() === "" ? "" : String(sum);
    setText(next);
    if (variasPartes || next !== value) {
      onChange(next);
      onPartes?.(variasPartes && montos.length > 1 ? montos : undefined);
    }
  }

  function agregarMas() {
    setText((t) => (t.trim() === "" || /[+,]\s*$/.test(t) ? t : `${t}+`));
    inputRef.current?.focus();
  }

  const input = (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      className="num-input"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        alEscribir?.(e.target.value);
      }}
      onBlur={commit}
      placeholder={placeholder}
    />
  );
  if (!sumar) return input;
  return (
    <span className="sum-input">
      <span className="sum-input-fila">
        {input}
        <button
          type="button"
          className="sum-input-mas"
          aria-label="Sumar otro monto"
          // Sin esto, tocar "+" saca el foco del campo y lo suma antes de tiempo.
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={agregarMas}
        >
          +
        </button>
      </span>
      {variasPartes && montos.length > 0 && (
        <span className="sum-input-total">
          = {sumFromTextLocal(text).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
          <span> · {montos.length} {montos.length === 1 ? "monto" : "montos"}</span>
        </span>
      )}
    </span>
  );
}

function partirMontos(text: string): number[] {
  return text
    .split(/[,+]/)
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n));
}

function sumFromTextLocal(text: string): number {
  if (!text) return 0;
  const parts = partirMontos(text);
  if (parts.length === 0) return 0;
  return Math.round((parts.reduce((a, b) => a + b, 0) + Number.EPSILON) * 100) / 100;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
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
