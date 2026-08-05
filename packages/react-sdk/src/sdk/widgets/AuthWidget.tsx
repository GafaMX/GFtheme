import { useState, type FormEvent } from "react";
import type { GafaClient } from "../client/types";
import type { CaptchaProvider } from "../captcha/CaptchaProvider";
import { WidgetShell } from "./WidgetShell";

export type AuthView = "login" | "register" | "password-recovery" | "profile";

export type AuthWidgetProps = {
  client?: GafaClient;
  captcha?: CaptchaProvider;
  initialView?: AuthView;
  baseUrl?: string;
  onAuthenticated?: () => void;
};

type FormStatus = "idle" | "submitting" | "success" | "error";

export function AuthWidget({ client, captcha, initialView = "login", onAuthenticated }: AuthWidgetProps) {
  const [view, setView] = useState(initialView);
  const formView = view === "profile" ? "login" : view;

  return (
    <WidgetShell
      eyebrow="Cuenta"
      title={
        formView === "register" ? "Crea tu cuenta" : formView === "password-recovery" ? "Recupera tu acceso" : "Bienvenido"
      }
      description="Login, registro y recuperacion de password conectados a tu cuenta real."
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

      {formView === "login" ? <LoginForm client={client} onAuthenticated={onAuthenticated} /> : null}
      {formView === "register" ? <RegisterForm client={client} captcha={captcha} /> : null}
      {formView === "password-recovery" ? <PasswordRecoveryForm client={client} /> : null}
    </WidgetShell>
  );
}

function LoginForm({ client, onAuthenticated }: { client?: GafaClient; onAuthenticated?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!client) return;

    setStatus("submitting");
    setError(undefined);

    try {
      await client.login({ email, password });
      setStatus("success");
      onAuthenticated?.();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No pudimos iniciar sesion.");
    }
  }

  return (
    <form className="gafa-sdk-form" onSubmit={handleSubmit}>
      <label className="gafa-sdk-field">
        <span>Email</span>
        <input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="gafa-sdk-field">
        <span>Password</span>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      {status === "error" ? <p className="gafa-sdk-state gafa-sdk-state--error">{error}</p> : null}
      {status === "success" ? <p className="gafa-sdk-state gafa-sdk-state--success">Sesion iniciada.</p> : null}

      <button className="gafa-sdk-button" type="submit" disabled={!client || status === "submitting"}>
        {status === "submitting" ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

function RegisterForm({ client, captcha }: { client?: GafaClient; captcha?: CaptchaProvider }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!client) return;

    setStatus("submitting");
    setError(undefined);

    try {
      if (!captcha) {
        throw new Error("Falta configurar el captcha (captchaPublicKey) para poder registrarte.");
      }

      const captchaToken = await captcha.execute("register");

      await client.register({
        email,
        password,
        passwordConfirmation,
        firstName,
        lastName: lastName || undefined,
        captchaToken,
      });

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No pudimos crear tu cuenta.");
    }
  }

  if (status === "success") {
    return (
      <p className="gafa-sdk-state gafa-sdk-state--success">
        Cuenta creada. Revisa tu correo para verificar tu cuenta antes de entrar.
      </p>
    );
  }

  return (
    <form className="gafa-sdk-form" onSubmit={handleSubmit}>
      <label className="gafa-sdk-field">
        <span>Nombre</span>
        <input placeholder="Tu nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
      </label>
      <label className="gafa-sdk-field">
        <span>Apellido</span>
        <input placeholder="Tu apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </label>
      <label className="gafa-sdk-field">
        <span>Email</span>
        <input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="gafa-sdk-field">
        <span>Password</span>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={5}
        />
      </label>
      <label className="gafa-sdk-field">
        <span>Confirma tu password</span>
        <input
          type="password"
          placeholder="••••••••"
          value={passwordConfirmation}
          onChange={(e) => setPasswordConfirmation(e.target.value)}
          required
        />
      </label>

      {status === "error" ? <p className="gafa-sdk-state gafa-sdk-state--error">{error}</p> : null}

      <button className="gafa-sdk-button" type="submit" disabled={!client || status === "submitting"}>
        {status === "submitting" ? "Creando cuenta..." : "Crear cuenta"}
      </button>
      <p className="gafa-auth-note">Protegido con reCAPTCHA.</p>
    </form>
  );
}

function PasswordRecoveryForm({ client }: { client?: GafaClient }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!client) return;

    setStatus("submitting");
    setError(undefined);

    try {
      await client.requestPasswordReset({ email, returnUrl: window.location.href });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No pudimos enviar las instrucciones.");
    }
  }

  if (status === "success") {
    return <p className="gafa-sdk-state gafa-sdk-state--success">Listo, revisa tu correo para continuar.</p>;
  }

  return (
    <form className="gafa-sdk-form" onSubmit={handleSubmit}>
      <label className="gafa-sdk-field">
        <span>Email</span>
        <input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>

      {status === "error" ? <p className="gafa-sdk-state gafa-sdk-state--error">{error}</p> : null}

      <button className="gafa-sdk-button" type="submit" disabled={!client || status === "submitting"}>
        {status === "submitting" ? "Enviando..." : "Enviar instrucciones"}
      </button>
    </form>
  );
}
