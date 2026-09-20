import { ArrowLeft, ChefHat } from "lucide-react";
import { Empty } from "../ui";

export function ControlCocinaPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Control de Cocina</h2>
      <Empty icon={<ChefHat size={26} strokeWidth={1.3} />} text="Próximamente vas a poder llevar el control de tu cocina aquí." />
    </div>
  );
}
