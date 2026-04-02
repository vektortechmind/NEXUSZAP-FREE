import { Bot, Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { Button, buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HamburgerToggle } from "./HamburgerToggle";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { name: "Funcionalidades", href: "#funcionalidades" },
    { name: "Experiência", href: "#experiencia" },
    { name: "Preço", href: "#preco" },
    { name: "FAQ", href: "#faq" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
        isScrolled || isMobileMenuOpen
          ? "border-b border-slate-200/70 bg-white/85 py-3 shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80"
          : "bg-transparent py-4 sm:py-5"
      }`}
    >
      {isMobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[90] bg-slate-950/50 backdrop-blur-[2px] md:hidden"
          aria-label="Fechar menu"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="relative z-[110] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 min-h-[3rem]">
          <a
            href="#"
            className="flex min-w-0 items-center gap-2 sm:gap-3"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-[0_14px_30px_-16px_rgba(79,70,229,0.95)]">
              <Bot className="text-white" size={22} />
            </div>
            <div className="min-w-0">
              <span className="block text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Nexus<span className="text-blue-500 dark:text-blue-400">ZAP</span>
              </span>
              <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                IA Intelligence
              </p>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-6 lg:gap-8" aria-label="Principal">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                {link.name}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3 lg:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full text-slate-600 dark:text-slate-300"
              aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <a
              href="#preco"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-full px-5 lg:px-6 text-center shadow-[0_10px_24px_-12px_rgba(79,70,229,0.85)]"
              )}
            >
              Começar agora
            </a>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:hidden">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema" className="h-11 w-11 shrink-0">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <HamburgerToggle
              open={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((o) => !o)}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative z-[110] overflow-hidden border-b border-slate-200/70 bg-white/95 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/95 md:hidden"
          >
            <nav className="flex max-h-[min(70vh,calc(100dvh-5rem))] flex-col gap-1 overflow-y-auto overscroll-contain px-4 py-4" aria-label="Menu mobile">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-xl px-3 py-3 text-base font-medium text-slate-700 transition-colors active:bg-slate-100 dark:text-slate-300 dark:active:bg-slate-800/80"
                >
                  {link.name}
                </a>
              ))}
              <a
                href="#preco"
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(buttonVariants({ size: "lg" }), "mt-3 w-full rounded-xl text-center")}
              >
                Começar agora
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
