export const DEFAULT_LOCALE = "pt-BR";
export type Locale = "pt-BR" | "en";
export const isLocale = (value: unknown): value is Locale => value === "pt-BR" || value === "en";

const pt = {
  language: "Idioma",
  home: "Início",
  projects: "Projetos",
  calculator: "Calculadora",
  calculate: "Calcular",
  team: "Equipe",
  profile: "Perfil",
  logout: "Sair",
  loggingOut: "Saindo...",
  mainNavigation: "Navegação principal",
  email: "E-mail",
  password: "Senha",
  emailPlaceholder: "Digite seu e-mail",
  passwordPlaceholder: "Sua senha secreta",
  connecting: "Conectando...",
  login: "Entrar",
  forgotPassword: "Esqueceu sua senha?",
  noAccount: "Não tem uma conta?",
  signup: "Cadastre-se aqui",
  requiredCredentials: "Por favor, preencha e-mail e senha.",
  partialLogout: "Sessão encerrada neste navegador. Não foi possível confirmar a saída nos outros dispositivos.",
};

export type MessageKey = keyof typeof pt;
const en: Record<MessageKey, string> = {
  language: "Language",
  home: "Home",
  projects: "Projects",
  calculator: "Calculator",
  calculate: "Calculate",
  team: "Team",
  profile: "Profile",
  logout: "Sign out",
  loggingOut: "Signing out...",
  mainNavigation: "Main navigation",
  email: "Email",
  password: "Password",
  emailPlaceholder: "Enter your email",
  passwordPlaceholder: "Enter your password",
  connecting: "Signing in...",
  login: "Sign in",
  forgotPassword: "Forgot your password?",
  noAccount: "Don't have an account?",
  signup: "Sign up here",
  requiredCredentials: "Please enter your email and password.",
  partialLogout: "Signed out in this browser. We could not confirm sign-out on your other devices.",
};

export function translate(locale: Locale, key: MessageKey): string {
  return (locale === "en" ? en : pt)[key];
}

// Adaptador das mensagens já usadas pelo controlador de autenticação.
// A lógica de sessão continua independente do idioma de apresentação.
const authMessages: Record<string, string> = {
  "Conectando...": "Signing in...",
  "Saindo do sistema...": "Signing out...",
  "Informe e-mail e senha.": "Enter your email and password.",
  "E-mail ou senha incorretos.": "Incorrect email or password.",
  "Confirme seu e-mail antes de entrar.": "Confirm your email before signing in.",
  "Não foi possível confirmar o login. Confira sua conexão e tente novamente.": "We could not confirm sign-in. Check your connection and try again.",
  "Não foi possível confirmar a saída. Confira sua conexão e tente novamente.": "We could not confirm sign-out. Check your connection and try again.",
  "Não foi possível concluir a operação. Atualize a página e tente novamente.": "We could not complete the request. Reload the page and try again.",
  "Login confirmado.": "Signed in successfully.",
  "Sessão encerrada.": "Signed out.",
};

export function translateAuthMessage(locale: Locale, message: string): { text: string; lang: Locale } {
  // Mensagens ainda não catalogadas preservam o idioma original explicitamente.
  const translated = locale === "en" && Object.hasOwn(authMessages, message) ? authMessages[message] : undefined;
  return { text: translated ?? message, lang: translated ? "en" : "pt-BR" };
}
