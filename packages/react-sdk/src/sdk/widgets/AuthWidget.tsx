import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CustomField, CustomFieldValues, GafaClient } from "../client/types";
import type { CaptchaProvider } from "../captcha/CaptchaProvider";
import { WidgetShell } from "./WidgetShell";
import { CustomFieldInput } from "./CustomFieldInput";

export type AuthView = "login" | "register" | "password-recovery" | "profile";

/** Formulario que el widget tiene a la vista; `profile` no es un paso real. */
export type AuthStage = "login" | "register" | "password-recovery" | "password-reset";

export type AuthWidgetProps = {
  client?: GafaClient;
  captcha?: CaptchaProvider;
  initialView?: AuthView;
  /** Marca cuyos campos especiales de registro hay que pedir. */
  brandSlug?: string;
  baseUrl?: string;
  /**
   * El contenedor (checkout, reserva) ya pinta el título del paso: sin esto se
   * ven dos títulos encimados diciendo lo mismo.
   */
  hideHeader?: boolean;
  /** Para que ese contenedor ajuste su título al formulario visible. */
  onStageChange?: (stage: AuthStage) => void;
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

function stageTitle(stage: AuthStage): string {
  if (stage === "register") return "Crea tu cuenta";
  if (stage === "password-recovery") return "Recupera tu contraseña";
  if (stage === "password-reset") return "Elige tu nueva contraseña";
  return "Inicia sesión";
}

function clearPasswordResetLink() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("token");
  url.searchParams.delete("email");
  window.history.replaceState(null, "", url.toString());
}

export function AuthWidget({
  client,
  captcha,
  initialView = "login",
  brandSlug,
  hideHeader,
  onStageChange,
  onAuthenticated,
}: AuthWidgetProps) {
  const [resetLink, setResetLink] = useState(readPasswordResetLink);
  const [view, setView] = useState(initialView);
  const formView = view === "profile" ? "login" : view;
  const stage: AuthStage = resetLink ? "password-reset" : formView;

  // El callback suele venir inline desde el contenedor: por la ref el aviso sale
  // solo cuando cambia el formulario, no en cada render del padre.
  const onStageChangeRef = useRef(onStageChange);
  useEffect(() => {
    onStageChangeRef.current = onStageChange;
  }, [onStageChange]);
  useEffect(() => {
    onStageChangeRef.current?.(stage);
  }, [stage]);

  /** Sin header propio el título lo pone el contenedor. */
  const header = hideHeader
    ? {}
    : { eyebrow: "Cuenta", title: stageTitle(stage), description: resetLink?.email };

  if (resetLink) {
    return (
      <WidgetShell {...header}>
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
      <WidgetShell {...header}>
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
    <WidgetShell {...header}>
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
      {/* El nombre va en un span aparte: en movil se oculta y el boton queda
          como circulo de icono, para que los tres quepan en UNA fila. El
          aria-label mantiene el nombre para lectores de pantalla. */}
      <div className="gafa-social__row">
        <button className="gafa-social__button" type="button" title="Próximamente" aria-label="Google" aria-disabled="true">
          <GoogleGIcon />
          <span>Google</span>
        </button>
        <button className="gafa-social__button" type="button" title="Próximamente" aria-label="Apple" aria-disabled="true">
          <AppleLogoIcon />
          <span>Apple</span>
        </button>
        <button className="gafa-social__button" type="button" title="Próximamente" aria-label="Facebook" aria-disabled="true">
          <FacebookIcon />
          <span>Facebook</span>
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
  const { fieldErrors, formProps } = useSpanishValidation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) return;
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
    <form className="gafa-sdk-form" onSubmit={handleSubmit} {...formProps}>
      <FormAlert fieldErrors={fieldErrors} status={status} error={error} />
      <FloatField
        label="Email"
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        error={fieldErrors.email}
      />
      <FloatField
        label="Contraseña"
        name="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        error={fieldErrors.password}
      />

      {status === "success" ? <p className="gafa-sdk-state gafa-sdk-state--success">Sesión iniciada.</p> : null}

      <button className="gafa-sdk-button" type="submit" disabled={!client || status === "submitting"}>
        {status === "submitting" ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

/**
 * Campo con label flotante: la etiqueta vive dentro del campo y al enfocar o
 * tener valor sube a la esquina. Puro CSS (placeholder=" " + :placeholder-shown).
 */
function FloatField({
  label,
  error,
  ...inputProps
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="gafa-float" data-invalid={error ? "true" : undefined}>
      <input placeholder=" " aria-invalid={error ? true : undefined} {...inputProps} />
      {/* Solo se MARCA en rojo (borde + label); el mensaje va una sola vez
          arriba del formulario. */}
      <span>{label}</span>
    </label>
  );
}

/** Un solo resumen arriba del form; los campos solo se marcan en rojo. */
function validationSummary(fieldErrors: Record<string, string>): string | null {
  const messages = Object.values(fieldErrors);
  if (messages.length === 0) return null;
  const unique = Array.from(new Set(messages));
  if (unique.length === 1 && unique[0] !== "Este campo es obligatorio.") return unique[0];
  return messages.length === 1 ? "Completa el campo marcado en rojo." : "Completa los campos marcados en rojo.";
}

function FormAlert({
  fieldErrors,
  status,
  error,
}: {
  fieldErrors: Record<string, string>;
  status: FormStatus;
  error?: string;
}) {
  const summary = validationSummary(fieldErrors) ?? (status === "error" ? error : null);
  if (!summary) return null;
  return (
    <p className="gafa-sdk-state gafa-sdk-state--error" role="alert">
      {summary}
    </p>
  );
}

/**
 * Validacion con mensajes propios EN ESPAÑOL: los formularios usan noValidate
 * y checkValidity() dispara eventos invalid que aqui se traducen a errores
 * inline por campo (nada de globos del navegador en ingles).
 */
function spanishValidationMessage(control: HTMLInputElement | HTMLSelectElement): string {
  const validity = control.validity;
  if (validity.valueMissing) return "Este campo es obligatorio.";
  if (validity.typeMismatch && control.type === "email") return "Escribe un correo válido.";
  if (validity.tooShort) return `Mínimo ${(control as HTMLInputElement).minLength} caracteres.`;
  return "Revisa este campo.";
}

function useSpanishValidation() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const formProps = {
    noValidate: true,
    onInvalidCapture: (event: React.FormEvent) => {
      event.preventDefault();
      const control = event.target as HTMLInputElement;
      if (!control.name) return;
      const message = spanishValidationMessage(control);
      setFieldErrors((previous) => ({ ...previous, [control.name]: message }));
    },
    onChangeCapture: (event: React.FormEvent) => {
      const control = event.target as HTMLInputElement;
      if (!control.name) return;
      setFieldErrors((previous) => {
        if (!(control.name in previous)) return previous;
        const next = { ...previous };
        delete next[control.name];
        return next;
      });
    },
  };

  return { fieldErrors, setFieldErrors, formProps };
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
  const { fieldErrors, setFieldErrors, formProps } = useSpanishValidation();

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) return;
    if (password !== passwordConfirmation) {
      setFieldErrors((previous) => ({
        ...previous,
        password: "Las contraseñas no coinciden.",
        passwordConfirmation: "Las contraseñas no coinciden.",
      }));
      return;
    }
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
    <form className="gafa-sdk-form" onSubmit={handleSubmit} {...formProps}>
      <FormAlert fieldErrors={fieldErrors} status={status} error={error} />
      <div className="gafa-field-row">
        <FloatField
          label="Nombre"
          name="firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          error={fieldErrors.firstName}
        />
        <FloatField label="Apellido" name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <FloatField
        label="Email"
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        error={fieldErrors.email}
      />
      <div className="gafa-field-row">
        <FloatField
          label="Contraseña"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={5}
          error={fieldErrors.password}
        />
        <FloatField
          label="Confirmar contraseña"
          name="passwordConfirmation"
          type="password"
          value={passwordConfirmation}
          onChange={(e) => setPasswordConfirmation(e.target.value)}
          required
          error={fieldErrors.passwordConfirmation}
        />
      </div>

      {/* Campos extra de la marca, integrados como un campo mas (sin marco). */}
      {groups.map((group) =>
        group.fields.map((field) => (
          <CustomFieldInput
            key={field.id}
            field={field}
            name={`cf-${group.id}-${field.id}`}
            value={customValues[group.id]?.[field.id] ?? field.defaultValue ?? ""}
            onChange={(value) => setCustomValue(group.id, field.id, value)}
            error={fieldErrors[`cf-${group.id}-${field.id}`]}
          />
        )),
      )}

      <button className="gafa-sdk-button" type="submit" disabled={!client || status === "submitting"}>
        {status === "submitting" ? "Creando cuenta..." : "Crear cuenta"}
      </button>
    </form>
  );
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
  const { fieldErrors, setFieldErrors, formProps } = useSpanishValidation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) return;
    if (password !== passwordConfirmation) {
      setFieldErrors((previous) => ({
        ...previous,
        password: "Las contraseñas no coinciden.",
        passwordConfirmation: "Las contraseñas no coinciden.",
      }));
      return;
    }
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
    <form className="gafa-sdk-form" onSubmit={handleSubmit} {...formProps}>
      <FormAlert fieldErrors={fieldErrors} status={status} error={error} />
      <FloatField
        label="Nueva contraseña"
        name="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={5}
        error={fieldErrors.password}
      />
      <FloatField
        label="Confirmar contraseña"
        name="passwordConfirmation"
        type="password"
        value={passwordConfirmation}
        onChange={(e) => setPasswordConfirmation(e.target.value)}
        required
        error={fieldErrors.passwordConfirmation}
      />

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
  const { fieldErrors, formProps } = useSpanishValidation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) return;
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
    <form className="gafa-sdk-form" onSubmit={handleSubmit} {...formProps}>
      <FormAlert fieldErrors={fieldErrors} status={status} error={error} />
      <FloatField
        label="Email"
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        error={fieldErrors.email}
      />

      <button className="gafa-sdk-button" type="submit" disabled={!client || status === "submitting"}>
        {status === "submitting" ? "Enviando..." : "Enviar instrucciones"}
      </button>
    </form>
  );
}
