import { ArrowLeft, Clock } from "lucide-react";
import { Empty } from "../ui";

export function HorariosPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Equipo
      </button>
      <h2 className="page-title">Horarios</h2>
      <Empty icon={<Clock size={26} strokeWidth={1.3} />} text="Próximamente vas a poder armar los horarios de tu personal aquí." />
    </div>
  );
}
