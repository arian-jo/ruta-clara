import CustomerTracking from "@/components/CustomerTracking";

export const metadata = {
  title: "Seguimiento de tu visita · Ruta Clara",
  description: "Estado y horario estimado de tu visita técnica.",
  robots: { index: false, follow: false },
};

export default function TrackingPage() {
  return <CustomerTracking />;
}
