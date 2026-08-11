import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CustomField, CustomFieldValues, GafaClient } from "../client/types";
import type { CaptchaProvider } from "../captcha/CaptchaProvider";
import { WidgetShell } from "./WidgetShell";

export type AuthView = "login" | "register" | "password-recovery" | "profile";

export type AuthWidgetProps = {
  client?: GafaClient;
  captcha?: CaptchaProvider;
  initialView?: AuthView;
  /** Marca cuyos campos especiales de registro hay que pedir. */
  brandSlug?: string;
  baseUrl?: string;
  onAuthenticated?: () => void;
};

type FormStatus = "idle" | "submitting" | "success" | "error";

/**
 * Si la URL trae `token` + `email` es el link del correo de "olvidé mi
 * contraseña" (return_url + params que agrega gafa.fit): hay que aterrizar
 * directo en el formulario de nueva contraseña.
 */
function readPasswordResetLink(): { token: string; email: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const email = params.get("email");
  return token && email ? { token, email } : null;
}

function clearPasswordResetLink() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("token");
  url.searchParams.delete("email");
  window.history.replaceState(null, "", url.toString());
}

export function AuthWidget({ client, captcha, initialView = "login", brandSlug, onAuthenticated }: AuthWidgetProps) {
  const [resetLink, setResetLink] = useState(readPasswordResetLink);
  const [view, setView] = useState(initialView);
  const formView = view === "profile" ? "login" : view;

  if (resetLink) {
    return (
      <WidgetShell eyebrow="Cuenta" title="Elige tu nueva contraseña" description={resetLink.email}>
        <PasswordResetForm
          client={client}
          token={resetLink.token}
          email={resetLink.email}
          onDone={() => {
            clearPasswordResetLink();
            setResetLink(null);
            onAuthenticated?.();
          }}
        />
      </WidgetShell>
    );
  }

  if (formView === "password-recovery") {
    return (
      <WidgetShell eyebrow="Cuenta" title="Recupera tu contraseña">
        <PasswordRecoveryForm client={client} />
        <p className="gafa-auth-links">
          <button className="gafa-auth-link" type="button" onClick={() => setView("login")}>
            ← Volver a iniciar sesión
          </button>
        </p>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell eyebrow="Cuenta" title={formView === "register" ? "Crea tu cuenta" : "Inicia sesión"}>
      {/* Dos opciones claras; la activa se pinta con el color de marca. */}
      <div className="gafa-sdk-auth-tabs" role="tablist" aria-label="Iniciar sesión o crear cuenta">
        <button type="button" aria-pressed={formView === "login"} onClick={() => setView("login")}>
          Iniciar sesión
        </button>
        <button type="button" aria-pressed={formView === "register"} onClick={() => setView("register")}>
          Crear cuenta
        </button>
      </div>

      {formView === "login" ? (
        <>
          <LoginForm client={client} onAuthenticated={onAuthenticated} />
          <SocialAuthButtons />
          <p className="gafa-auth-links">
            <button className="gafa-auth-link" type="button" onClick={() => setView("password-recovery")}>
              ¿Olvidaste tu contraseña?
            </button>
            <span>
              ¿No tienes cuenta?{" "}
              <button className="gafa-auth-link gafa-auth-link--strong" type="button" onClick={() => setView("register")}>
                Regístrate
              </button>
            </span>
          </p>
        </>
      ) : (
        <>
          <RegisterForm client={client} captcha={captcha} brandSlug={brandSlug} onAuthenticated={onAuthenticated} />
          <SocialAuthButtons />
          <p className="gafa-auth-links">
            <span>
              ¿Ya tienes cuenta?{" "}
              <button className="gafa-auth-link gafa-auth-link--strong" type="button" onClick={() => setView("login")}>
                Inicia sesión
              </button>
            </span>
          </p>
        </>
      )}
    </WidgetShell>
  );
}

/**
 * SOLO POSICIÓN/DISEÑO — sin funcionalidad todavía. El login social real
 * necesita que gafa.fit exponga un endpoint que cambie el token del proveedor
 * por una sesión propia; ver discusión en el PR.
 */
function SocialAuthButtons() {
  return (
    <div className="gafa-social">
      <div className="gafa-social__divider" aria-hidden="true">
        <span>o continúa con</span>
      </div>
      <div className="gafa-social__row">
        <button className="gafa-social__button" type="button" title="Próximamente" aria-disabled="true">
          <GoogleGIcon />
          Google
        </button>
        <button className="gafa-social__button" type="button" title="Próximamente" aria-disabled="true">
          <AppleLogoIcon />
          Apple
        </button>
        <button className="gafa-social__button" type="button" title="Próximamente" aria-disabled="true">
          <FacebookIcon />
          Facebook
        </button>
      </div>
    </div>
  );
}

function GoogleGIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.33Z"
        fill="#4285F4"
      />
      <path
        d="M12 21.6c2.7 0 4.96-.9 6.62-2.42l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.6A9.99 9.99 0 0 0 12 21.6Z"
        fill="#34A853"
      />
      <path d="M6.41 13.5a6 6 0 0 1 0-3.83V7.06H3.06a10 10 0 0 0 0 8.97l3.35-2.53Z" fill="#FBBC05" />
      <path
        d="M12 6.55c1.47 0 2.78.5 3.82 1.5l2.86-2.87A9.6 9.6 0 0 0 12 2.4a9.99 9.99 0 0 0-8.94 5.53l3.35 2.6C7.2 8.31 9.4 6.55 12 6.55Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleLogoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.9c-.03-2.66 2.17-3.94 2.27-4-1.24-1.81-3.16-2.06-3.84-2.09-1.63-.17-3.19.96-4.02.96-.83 0-2.11-.94-3.47-.91-1.78.03-3.43 1.04-4.35 2.64-1.86 3.22-.48 7.98 1.33 10.59.88 1.28 1.93 2.71 3.31 2.66 1.33-.05 1.83-.86 3.44-.86s2.06.86 3.47.83c1.43-.02 2.34-1.3 3.21-2.58 1.01-1.48 1.43-2.92 1.45-2.99-.03-.01-2.78-1.07-2.8-4.25ZM13.72 5.06c.73-.89 1.23-2.13 1.09-3.36-1.06.04-2.34.7-3.1 1.59-.68.79-1.28 2.05-1.12 3.26 1.18.09 2.4-.6 3.13-1.49Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.19 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.78-3.91 1.09 0 2.23.2 2.23.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.57v1.88h2.78l-.45 2.9h-2.33V22c4.78-.75 8.44-4.92 8.44-9.94Z"
        fill="#1877F2"
      />
    </svg>
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

function RegisterForm({
  client,
  captcha,
  brandSlug,
  onAuthenticated,
}: {
  client?: GafaClient;
  captcha?: CaptchaProvider;
  brandSlug?: string;
  onAuthenticated?: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [customValues, setCustomValues] = useState<CustomFieldValues>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string>();

  const brandsQuery = useQuery({
    queryKey: ["auth", "brands"],
    queryFn: () => client!.listBrands(),
    enabled: Boolean(client) && !brandSlug,
  });

  const activeBrandSlug = brandSlug ?? brandsQuery.data?.[0]?.slug;

  // Cada marca configura sus propios campos extra desde gafa.fit; sin ellos el
  // registro falla cuando alguno es obligatorio.
  const fieldsQuery = useQuery({
    queryKey: ["auth", "registration-fields", activeBrandSlug],
    queryFn: () => client!.listRegistrationFields(activeBrandSlug!),
    enabled: Boolean(client) && Boolean(activeBrandSlug),
  });

  const groups = fieldsQuery.data ?? [];

  function setCustomValue(groupId: number, fieldId: number, value: string) {
    setCustomValues((current) => ({
      ...current,
      [groupId]: { ...(current[groupId] ?? {}), [fieldId]: value },
    }));
  }

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
        customFields: customValues,
      });

      // Autologin inmediato, igual que el theme legacy: la cuenta ya queda
      // activa en el sistema, no hay que esperar verificacion de correo.
      await client.login({ email, password });

      setStatus("success");
      onAuthenticated?.();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No pudimos crear tu cuenta.");
    }
  }

  if (status === "success") {
    return (
      <p className="gafa-sdk-state gafa-sdk-state--success">
        Cuenta creada, ya tienes sesión iniciada.
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

      {groups.map((group) => (
        <fieldset className="gafa-sdk-fieldset" key={group.id}>
          <legend>{group.name}</legend>
          {group.description ? <p className="gafa-sdk-field-help">{group.description}</p> : null}
          {group.fields.map((field) => (
            <CustomFieldInput
              key={field.id}
              field={field}
              value={customValues[group.id]?.[field.id] ?? field.defaultValue ?? ""}
              onChange={(value) => setCustomValue(group.id, field.id, value)}
            />
          ))}
        </fieldset>
      ))}

      {status === "error" ? <p className="gafa-sdk-state gafa-sdk-state--error">{error}</p> : null}

      <button className="gafa-sdk-button" type="submit" disabled={!client || status === "submitting"}>
        {status === "submitting" ? "Creando cuenta..." : "Crear cuenta"}
      </button>
    </form>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomField;
  value: string;
  onChange(value: string): void;
}) {
  const label = (
    <span>
      {field.name}
      {field.required ? " *" : ""}
    </span>
  );

  if (field.options.length > 0) {
    return (
      <label className="gafa-sdk-field">
        {label}
        <select value={value} onChange={(event) => onChange(event.target.value)} required={field.required}>
          <option value="">Selecciona una opción</option>
          {field.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        {field.helpText ? <span className="gafa-sdk-field-help">{field.helpText}</span> : null}
      </label>
    );
  }

  return (
    <label className="gafa-sdk-field">
      {label}
      <input
        type={inputTypeFor(field.type)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
      />
      {field.helpText ? <span className="gafa-sdk-field-help">{field.helpText}</span> : null}
    </label>
  );
}

/** Los tipos vienen del catalogo de gafa.fit, no de HTML. */
function inputTypeFor(type: string): string {
  switch (type) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "email":
      return "email";
    case "phone":
      return "tel";
    default:
      return "text";
  }
}

/** Paso final del "olvidé mi contraseña": setea la nueva y deja sesión iniciada. */
function PasswordResetForm({
  client,
  token,
  email,
  onDone,
}: {
  client?: GafaClient;
  token: string;
  email: string;
  onDone(): void;
}) {
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
      await client.resetPassword({ email, password, passwordConfirmation, token });
      // Autologin con la contraseña nueva: no tiene sentido pedirla de nuevo.
      await client.login({ email, password });
      setStatus("success");
      onDone();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No pudimos cambiar tu contraseña.");
    }
  }

  return (
    <form className="gafa-sdk-form" onSubmit={handleSubmit}>
      <label className="gafa-sdk-field">
        <span>Nueva contraseña</span>
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
        <span>Confirma tu contraseña</span>
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
        {status === "submitting" ? "Guardando..." : "Cambiar contraseña y entrar"}
      </button>
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
