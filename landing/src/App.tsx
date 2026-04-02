import { Switch, Route, Router as WouterRouter } from "wouter";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";

/** Vite com `base: "./"` expõe BASE_URL como `./` — wouter espera prefixo vazio na raiz do deploy. */
function normalizeRouterBase(base: string): string {
  const b = base.replace(/\/$/, "");
  if (b === "." || b === "./") return "";
  return b;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WouterRouter
        base={normalizeRouterBase(import.meta.env.BASE_URL)}
      >
        <Router />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
