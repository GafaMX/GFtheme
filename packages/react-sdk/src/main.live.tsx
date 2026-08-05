import { createGafaSdk } from "./sdk";
import "./sdk/theme/theme.css";
import "./sdk/widgets/widgets.css";

const apiBaseUrl = import.meta.env.VITE_GAFA_FIT_URL as string;
const companyId = import.meta.env.VITE_GAFA_COMPANY_ID as string;

document.getElementById("target-url")!.textContent = `${apiBaseUrl} (company ${companyId})`;

const sdk = createGafaSdk({
  apiBaseUrl,
  companyId,
  publicClientId: import.meta.env.VITE_GAFA_API_CLIENT as string,
  theme: {
    preset: "boutique",
    colors: {
      primary: "#16110f",
      primaryText: "#fffaf4",
      accent: "#ff6b2c",
      background: "#f5efe8",
      surface: "#fffaf4",
      text: "#16110f",
      mutedText: "#766b63",
      border: "#eadfd4",
    },
  },
});

sdk.mountCalendar("#calendar-live");
