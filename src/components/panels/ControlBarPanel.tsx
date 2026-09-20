import { ArrowLeft, Martini } from "lucide-react";
import { Empty } from "../ui";

export function ControlBarPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Control de Bar</h2>
      <Empty icon={<Martini size={26} strokeWidth={1.3} />} text="Próximamente vas a poder llevar el control de tu bar aquí." />
    </div>
  );
}
