import type { CustomField } from "../client/types";
import { DateField, isBirthDateField, isDateFieldType } from "./DateField";

/**
 * Campo "especial": los que cada marca configura desde gafa.fit (teléfono de
 * emergencia, cómo nos conociste, etc.). Se usa igual en el registro y en los
 * datos de la cuenta.
 */
export function CustomFieldInput({
  field,
  name,
  value,
  onChange,
  error,
}: {
  field: CustomField;
  name: string;
  value: string;
  onChange(value: string): void;
  error?: string;
}) {
  const labelText = `${field.name}${field.required ? " *" : ""}`;

  if (field.options.length > 0) {
    // Un select siempre "tiene valor": el label queda flotado fijo.
    return (
      <label className="gafa-float gafa-float--select" data-invalid={error ? "true" : undefined}>
        <span>{labelText}</span>
        <select
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          aria-invalid={error ? true : undefined}
        >
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

  if (isDateFieldType(field.type)) {
    return (
      <DateField
        label={labelText}
        name={name}
        value={value}
        onChange={onChange}
        required={field.required}
        error={error}
        helpText={field.helpText}
        mode={isBirthDateField(field.name, field.type) ? "birth" : "date"}
      />
    );
  }

  return (
    <label className="gafa-float" data-invalid={error ? "true" : undefined}>
      <input
        placeholder=" "
        name={name}
        type={inputTypeFor(field.type)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        aria-invalid={error ? true : undefined}
      />
      <span>{labelText}</span>
      {field.helpText ? <span className="gafa-sdk-field-help">{field.helpText}</span> : null}
    </label>
  );
}

export function inputTypeFor(type: string): string {
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
