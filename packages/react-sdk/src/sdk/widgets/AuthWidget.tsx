import { useState } from "react";
import type { GafaClient } from "../client/types";
import { WidgetShell } from "./WidgetShell";

export type AuthView = "login" | "register" | "password-recovery" | "profile";

export type AuthWidgetProps = {
  client?: GafaClient;
  initialView?: AuthView;
  baseUrl?: string;
};

export function AuthWidget({ initialView = "login", baseUrl }: AuthWidgetProps) {
  const [view, setView] = useState(initialView);
  const formView = view === "profile" ? "login" : view;

  return (
    <WidgetShell
      eyebrow="Cuenta"
      title={
        formView === "register" ? "Crea tu cuenta" : formView === "password-recovery" ? "Recupera tu acceso" : "Bienvenido"
      }
      description="Flujo base para login, registro y recuperacion de password."
    >
      <div className="gafa-sdk-auth-tabs" role="tablist" aria-label="Opciones de cuenta">
        <button type="button" aria-pressed={formView === "login"} onClick={() => setView("login")}>
          Login
        </button>
        <button type="button" aria-pressed={formView === "register"} onClick={() => setView("register")}>
          Registro
        </button>
        <button type="button" aria-pressed={formView === "password-recovery"} onClick={() => setView("password-recovery")}>
          Password
        </button>
      </div>

      <form className="gafa-sdk-form">
        {formView === "register" ? (
          <label className="gafa-sdk-field">
            <span>Nombre</span>
            <input placeholder="Tu nombre" />
          </label>
        ) : null}
        <label className="gafa-sdk-field">
          <span>Email</span>
          <input type="email" placeholder="tu@email.com" />
        </label>
        {formView !== "password-recovery" ? (
          <label className="gafa-sdk-field">
            <span>Password</span>
            <input type="password" placeholder="••••••••" />
          </label>
        ) : null}
        <button className="gafa-sdk-button" type="button">
          {formView === "register" ? "Crear cuenta" : formView === "password-recovery" ? "Enviar instrucciones" : "Entrar"}
        </button>
      </form>
      {baseUrl ? <p className="gafa-muted">Base URL configurada: {baseUrl}</p> : null}
    </WidgetShell>
  );
}
