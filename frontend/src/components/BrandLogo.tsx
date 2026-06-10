import nexusDarkLogo from "../assets/branding/nexus-full-dark.png";
import nexusLightLogo from "../assets/branding/nexus-full-light.png";
import nexusCompactLogo from "../assets/branding/nexus-compact.png";
import { useTheme } from "../contexts/useTheme";

type BrandLogoProps = {
  alt?: string;
  className?: string;
  variant?: "full" | "compact";
};

export function BrandLogo({ alt = "NexusZAP", className, variant = "full" }: BrandLogoProps) {
  const { theme } = useTheme();
  const logoSrc = variant === "compact" ? nexusCompactLogo : theme === "light" ? nexusLightLogo : nexusDarkLogo;

  return <img src={logoSrc} alt={alt} className={className} />;
}
