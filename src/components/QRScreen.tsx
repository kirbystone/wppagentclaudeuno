"use client";

import { useEffect, useState } from "react";

interface StatusResponse {
  status: "disconnected" | "qr" | "connecting" | "connected";
  qrPng?: string;
  phone?: string;
  updatedAt?: number;
}

interface Props {
  onConnected: (phone: string) => void;
}

export default function QRScreen({ onConnected }: Props) {
  const [data, setData] = useState<StatusResponse>({ status: "disconnected" });
  const [elapsedDisconnected, setElapsedDisconnected] = useState(0);

  useEffect(() => {
    let disconnectedSince = Date.now();

    async function poll() {
      try {
        const res = await fetch("/api/connection/status");
        const json: StatusResponse = await res.json();
        setData(json);

        if (json.status === "connected" && json.phone) {
          onConnected(json.phone);
          return;
        }

        if (json.status !== "disconnected") {
          disconnectedSince = Date.now();
          setElapsedDisconnected(0);
        } else {
          setElapsedDisconnected(Math.floor((Date.now() - disconnectedSince) / 1000));
        }
      } catch {
        // ignorar errores de red transitorios
      }
    }

    poll();
    const timer = setInterval(poll, 2_000);
    return () => clearInterval(timer);
  }, [onConnected]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Conectar número</h1>
        <p className="text-sm text-gray-400 mb-6">
          Abre WhatsApp en tu teléfono y escanea el código QR
        </p>

        {/* QR disponible */}
        {data.qrPng && (
          <div className="flex flex-col items-center gap-4">
            <img
              src={data.qrPng}
              alt="QR de WhatsApp"
              className="w-64 h-64 rounded-xl border border-gray-100"
            />
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Esperando escaneo...
            </div>
          </div>
        )}

        {/* Conectando (sin QR aún) */}
        {!data.qrPng && data.status === "connecting" && (
          <div className="flex items-center justify-center gap-2 text-blue-600 text-sm py-8">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Conectando...
          </div>
        )}

        {/* Desconectado */}
        {!data.qrPng && data.status === "disconnected" && (
          <div className="py-8">
            {elapsedDisconnected < 10 ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Iniciando bot...
              </div>
            ) : (
              <p className="text-sm text-red-400">
                El bot tardó demasiado en responder.
                <br />
                Asegúrate de que <code className="bg-gray-100 px-1 rounded">npm run start:bot</code> esté corriendo.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
