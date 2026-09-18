import { ArrowLeft, Wallet } from "lucide-react";
import { Empty } from "../ui";

export function NominaPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Equipo
      </button>
      <h2 className="page-title">Nómina</h2>
      <Empty icon={<Wallet size={26} strokeWidth={1.3} />} text="Próximamente vas a poder generar la nómina de tu personal aquí." />
    </div>
  );
}
