'use client';

export default function PrintButton() {
  return <button className="btn dark block" onClick={() => window.print()}>Imprimir placa</button>;
}
